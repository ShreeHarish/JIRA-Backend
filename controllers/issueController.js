const prisma = require('../lib/prisma');
const workflowService = require('../services/workflowService');

exports.createIssue = async (req, res, next) => {
  try {
    const { id: projectIdParam } = req.params;
    const { 
      projectId: projectIdBody, type, title, description, priority, 
      assigneeId, reporterId, sprintId, storyPoints, parentId, labels 
    } = req.body;

    const projectId = projectIdParam || projectIdBody;

    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    // Validate Issue Type Hierarchy
    if (parentId) {
      const parentIssue = await prisma.issue.findUnique({ where: { id: parentId } });
      
      if (!parentIssue) {
        return res.status(404).json({ error: 'Parent issue not found' });
      }

      // Rules:
      // 1. Only EPIC can be parent to STORY
      // 2. Only STORY can be parent to TASK
      // 3. Only TASK can be parent to SUB_TASK
      // 4. EPIC cannot have parent
      // 5. BUG can be under anything

      if (type === 'EPIC') {
        return res.status(422).json({ error: 'EPIC cannot have a parent' });
      }

      if (type === 'STORY' && parentIssue.type !== 'EPIC') {
        return res.status(422).json({ error: 'STORY must have an EPIC as its parent' });
      }

      if (type === 'TASK' && parentIssue.type !== 'STORY') {
        return res.status(422).json({ error: 'Only STORY can be parent to TASK' });
      }

      if (type === 'SUB_TASK' && parentIssue.type !== 'TASK') {
        return res.status(422).json({ error: 'Only TASK can be parent to SUB_TASK' });
      }
    }

    // Generate issue key (e.g., PROJ-123) with atomic counter and retry logic
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    let issueCreated = false;
    let attempts = 0;
    const maxAttempts = 5; // Increased for high concurrency load tests

    while (!issueCreated && attempts < maxAttempts) {
      const updatedCounter = await prisma.issueCounter.upsert({
        where: { projectId },
        update: { lastValue: { increment: 1 } },
        create: { projectId, lastValue: 1 }
      });
      const issueKey = `${project.key}-${updatedCounter.lastValue}`;

      try {
        const issue = await prisma.issue.create({
          data: {
            issueKey,
            projectId,
            type,
            title,
            description,
            status: 'todo', // Default status
            priority: priority || 'MEDIUM',
            assigneeId,
            reporterId,
            sprintId,
            storyPoints,
            parentId,
            labels: labels || [],
          },
          include: {
            assignee: true,
            reporter: true,
          }
        });

        // Log activity
        await prisma.activityLog.create({
          data: {
            projectId,
            issueId: issue.id,
            userId: reporterId,
            action: 'ISSUE_CREATED',
          }
        });

        // Broadcast
        req.io.to(`project:${projectId}`).emit('issue_created', issue);

        return res.status(201).json(issue);
      } catch (error) {
        // P2002 is Prisma's unique constraint violation error code
        if (error.code === 'P2002') {
          attempts++;
          continue; // Try again with the next incremented value
        }
        throw error;
      }
    }

    if (!issueCreated) {
      throw new Error('Failed to generate a unique issue key after multiple attempts');
    }
  } catch (error) {
    next(error);
  }
};

exports.getIssueById = async (req, res, next) => {
  try {
    const issue = await prisma.issue.findUnique({
      where: { id: req.params.id },
      include: {
        assignee: true,
        reporter: true,
        project: true,
        sprint: true,
        parent: true,
        subtasks: true,
        comments: {
          include: { author: true },
          orderBy: { createdAt: 'desc' }
        },
        watchers: { include: { user: true } }
      }
    });

    if (!issue) return res.status(404).json({ error: 'Issue not found' });
    res.json(issue);
  } catch (error) {
    next(error);
  }
};

exports.updateIssue = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { version, parentId, type, updatedBy, ...data } = req.body;

    if (version === undefined) {
      return res.status(400).json({ error: 'Version is required for optimistic locking' });
    }

    const oldIssue = await prisma.issue.findUnique({ where: { id } });
    if (!oldIssue) return res.status(404).json({ error: 'Issue not found' });

    if (oldIssue.version !== version) {
      return res.status(409).json({ 
        error: 'Conflict: Issue has been updated by another user',
        currentVersion: oldIssue.version 
      });
    }

    // Validate Issue Type Hierarchy if parentId or type is changing
    if (parentId !== undefined || type !== undefined) {
      const newType = type || oldIssue.type;
      const newParentId = parentId !== undefined ? parentId : oldIssue.parentId;

      if (newParentId) {
        const parentIssue = await prisma.issue.findUnique({ where: { id: newParentId } });
        
        if (!parentIssue) {
          return res.status(404).json({ error: 'Parent issue not found' });
        }

        // Rules:
        // 1. Only EPIC can be parent to STORY
        // 2. Only STORY can be parent to TASK
        // 3. Only TASK can be parent to SUB_TASK
        // 4. EPIC cannot have parent
        // 5. BUG can be under anything

        if (newType === 'EPIC') {
          return res.status(422).json({ error: 'EPIC cannot have a parent' });
        }

        if (newType === 'STORY' && parentIssue.type !== 'EPIC') {
          return res.status(422).json({ error: 'STORY must have an EPIC as its parent' });
        }

        if (newType === 'TASK' && parentIssue.type !== 'STORY') {
          return res.status(422).json({ error: 'Only STORY can be parent to TASK' });
        }

        if (newType === 'SUB_TASK' && parentIssue.type !== 'TASK') {
          return res.status(422).json({ error: 'Only TASK can be parent to SUB_TASK' });
        }
      }
    }

    let updatedIssue;
    try {
      updatedIssue = await prisma.issue.update({
        where: { id, version },
        data: {
          ...data,
          version: { increment: 1 }
        },
        include: { assignee: true, reporter: true }
      });
    } catch (updateError) {
      // If the update failed because the record wasn't found (version mismatch)
      const currentIssueAfter = await prisma.issue.findUnique({ where: { id } });
      if (currentIssueAfter && currentIssueAfter.version !== version) {
        return res.status(409).json({ 
          error: 'Conflict: Issue has been updated by another user',
          currentVersion: currentIssueAfter.version 
        });
      }
      throw updateError;
    }

    // Log activity
    await prisma.activityLog.create({
      data: {
        projectId: updatedIssue.projectId,
        issueId: id,
        userId: updatedBy || updatedIssue.reporterId, // Assume updatedBy is passed or use reporter
        action: 'ISSUE_UPDATED',
        changes: { before: oldIssue, after: updatedIssue }
      }
    });

    req.io.to(`project:${updatedIssue.projectId}`).emit('issue_updated', updatedIssue);

    res.json(updatedIssue);
  } catch (error) {
    next(error);
  }
};

exports.transitionIssue = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { toStatus, userId, version } = req.body;

    if (version === undefined) {
      return res.status(400).json({ error: 'Version is required for optimistic locking' });
    }

    const currentIssue = await prisma.issue.findUnique({ where: { id } });
    if (!currentIssue) return res.status(404).json({ error: 'Issue not found' });

    if (currentIssue.version !== version) {
      return res.status(409).json({ 
        error: 'Conflict: Issue has been updated by another user',
        currentVersion: currentIssue.version 
      });
    }

    // Validate transition
    await workflowService.validateTransition(id, toStatus, userId);

    let updatedIssue;
    try {
      updatedIssue = await prisma.issue.update({
        where: { id, version },
        data: { 
          status: toStatus,
          version: { increment: 1 }
        },
      });
    } catch (updateError) {
      // If the update failed because the record wasn't found (version mismatch)
      const currentIssueAfter = await prisma.issue.findUnique({ where: { id } });
      if (currentIssueAfter && currentIssueAfter.version !== version) {
        return res.status(409).json({ 
          error: 'Conflict: Issue has been updated by another user',
          currentVersion: currentIssueAfter.version 
        });
      }
      throw updateError;
    }

    // Log activity
    await prisma.activityLog.create({
      data: {
        projectId: currentIssue.projectId,
        issueId: id,
        userId: userId,
        action: 'STATUS_CHANGED',
        changes: { from: currentIssue.status, to: toStatus }
      }
    });

    // Post-transition actions
    await workflowService.executePostTransitionActions(updatedIssue, toStatus, req.io);

    res.json(updatedIssue);
  } catch (error) {
    next(error);
  }
};

exports.getIssueComments = async (req, res, next) => {
  try {
    const comments = await prisma.comment.findMany({
      where: { issueId: req.params.id },
      include: { 
        author: { select: { id: true, displayName: true, avatar: true } },
        replies: { include: { author: true } }
      },
      orderBy: { createdAt: 'asc' }
    });
    res.json(comments);
  } catch (error) {
    next(error);
  }
};

exports.addComment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { authorId, content, parentId } = req.body;

    const comment = await prisma.comment.create({
      data: {
        issueId: id,
        authorId,
        content,
        parentId
      },
      include: { author: true }
    });

    // Notify watchers (simple implementation)
    const watchers = await prisma.watcher.findMany({ where: { issueId: id } });
    for (const watcher of watchers) {
      if (watcher.userId !== authorId) {
        await prisma.notification.create({
          data: {
            userId: watcher.userId,
            type: 'NEW_COMMENT',
            content: `New comment on issue ${id}`,
            link: `/issues/${id}`
          }
        });
      }
    }

    req.io.to(`issue:${id}`).emit('comment_added', comment);

    res.status(201).json(comment);
  } catch (error) {
    next(error);
  }
};

exports.watchIssue = async (req, res, next) => {
  try {
    const { userId } = req.body;
    const { id } = req.params;

    await prisma.watcher.upsert({
      where: { userId_issueId: { userId, issueId: id } },
      update: {},
      create: { userId, issueId: id }
    });

    res.status(204).end();
  } catch (error) {
    next(error);
  }
};

exports.unwatchIssue = async (req, res, next) => {
  try {
    const { userId } = req.body;
    const { id } = req.params;

    await prisma.watcher.deleteMany({
      where: { userId, issueId: id }
    });

    res.status(204).end();
  } catch (error) {
    next(error);
  }
};
