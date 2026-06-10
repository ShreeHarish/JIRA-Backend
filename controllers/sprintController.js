const prisma = require('../lib/prisma');
const { retryOnDeadlock } = require('../lib/utils');

exports.createSprint = async (req, res, next) => {
  try {
    const { name, projectId, startDate, endDate } = req.body;
    const sprint = await prisma.sprint.create({
      data: { name, projectId, startDate, endDate }
    });
    res.status(201).json(sprint);
  } catch (error) {
    next(error);
  }
};

exports.updateSprint = async (req, res, next) => {
  try {
    const { id } = req.params;
    const sprint = await prisma.sprint.update({
      where: { id },
      data: req.body
    });
    res.json(sprint);
  } catch (error) {
    next(error);
  }
};

exports.startSprint = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Check if there's already an active sprint for this project
    const sprint = await prisma.sprint.findUnique({ where: { id } });
    const activeSprint = await prisma.sprint.findFirst({
      where: { projectId: sprint.projectId, status: 'ACTIVE' }
    });

    if (activeSprint) {
      return res.status(400).json({ error: 'Another sprint is already active' });
    }

    const updatedSprint = await prisma.sprint.update({
      where: { id },
      data: { status: 'ACTIVE', startDate: new Date() }
    });

    req.io.to(`project:${sprint.projectId}`).emit('sprint_updated', updatedSprint);
    res.json(updatedSprint);
  } catch (error) {
    next(error);
  }
};

exports.completeSprint = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { carryOverToSprintId, issueIdsToCarryOver } = req.body;

    const sprint = await prisma.sprint.findUnique({
      where: { id },
      include: { issues: true }
    });

    if (!sprint) return res.status(404).json({ error: 'Sprint not found' });

    const completedIssues = sprint.issues.filter(i => i.status === 'done');
    const incompleteIssues = sprint.issues.filter(i => i.status !== 'done');

    // Determine which issues to carry over
    const issuesToMove = issueIdsToCarryOver 
      ? incompleteIssues.filter(i => issueIdsToCarryOver.includes(i.id))
      : incompleteIssues;

    // Calculate velocity
    const velocity = completedIssues.reduce((sum, i) => sum + (i.storyPoints || 0), 0);

    // Update sprint status
    const updatedSprint = await prisma.sprint.update({
      where: { id },
      data: { status: 'COMPLETED', endDate: new Date() }
    });

    // Carry over issues - sort IDs to prevent deadlocks and retry on deadlock
    if (issuesToMove.length > 0) {
      const sortedIds = issuesToMove.map(i => i.id).sort();
      await retryOnDeadlock(() => 
        prisma.issue.updateMany({
          where: { id: { in: sortedIds } },
          data: { sprintId: carryOverToSprintId || null }
        })
      );
    }

    // Audit log for each moved issue
    for (const issue of issuesToMove) {
      await prisma.activityLog.create({
        data: {
          projectId: sprint.projectId,
          issueId: issue.id,
          userId: req.body.userId || 'system',
          action: 'SPRINT_CARRY_OVER',
          changes: { fromSprintId: id, toSprintId: carryOverToSprintId || null }
        }
      });
    }

    req.io.to(`project:${sprint.projectId}`).emit('sprint_completed', {
      sprint: updatedSprint,
      velocity,
      carriedOver: incompleteIssues.length
    });

    res.json({
      message: 'Sprint completed',
      velocity,
      carriedOverCount: incompleteIssues.length
    });
  } catch (error) {
    next(error);
  }
};

exports.addIssuesToSprint = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { issueIds } = req.body;

    // Sort IDs to prevent deadlocks and retry on deadlock
    const sortedIssueIds = [...issueIds].sort();
    
    await retryOnDeadlock(() =>
      prisma.issue.updateMany({
        where: { id: { in: sortedIssueIds } },
        data: { sprintId: id }
      })
    );

    const sprint = await prisma.sprint.findUnique({ where: { id } });
    req.io.to(`project:${sprint.projectId}`).emit('sprint_issues_updated', { sprintId: id, issueIds: sortedIssueIds });

    res.status(204).end();
  } catch (error) {
    next(error);
  }
};
