const prisma = require('../lib/prisma');

const defaultWorkflow = {
  statuses: [
    { id: 'todo', name: 'To Do', category: 'TODO' },
    { id: 'inprogress', name: 'In Progress', category: 'IN_PROGRESS' },
    { id: 'done', name: 'Done', category: 'DONE' }
  ],
  transitions: [
    { from: 'todo', to: 'inprogress' },
    { from: 'inprogress', to: 'done' },
    { from: 'inprogress', to: 'todo' },
    { from: 'done', to: 'inprogress' }
  ]
};

exports.createProject = async (req, res, next) => {
  try {
    let { name, key, description, leadId, workflow } = req.body;
    
    // Auto-generate key in PROJ-X format if not provided
    if (!key) {
      let projectCreated = false;
      let attempts = 0;
      const maxAttempts = 50; // Increased for high concurrency

      while (!projectCreated && attempts < maxAttempts) {
        const updatedCounter = await prisma.projectCounter.upsert({
          where: { id: 1 },
          update: { lastValue: { increment: 1 } },
          create: { id: 1, lastValue: 1 }
        });

        key = `PROJ-${updatedCounter.lastValue}`;

        try {
          const project = await prisma.project.create({
            data: {
              name,
              key,
              description,
              leadId,
              workflow: workflow || defaultWorkflow,
            },
          });
          return res.status(201).json(project);
        } catch (error) {
          if (error.code === 'P2002') {
            attempts++;
            continue; // Try again with next counter value
          }
          throw error;
        }
      }

      if (!projectCreated) {
        throw new Error('Failed to generate a unique project key after multiple attempts');
      }
    } else {
      const project = await prisma.project.create({
        data: {
          name,
          key,
          description,
          leadId,
          workflow: workflow || defaultWorkflow,
        },
      });
      return res.status(201).json(project);
    }
  } catch (error) {
    next(error);
  }
};

exports.getAllProjects = async (req, res, next) => {
  try {
    const projects = await prisma.project.findMany({
      include: {
        lead: {
          select: { id: true, displayName: true, email: true, avatar: true }
        }
      }
    });
    res.json(projects);
  } catch (error) {
    next(error);
  }
};

exports.getProjectById = async (req, res, next) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: {
        lead: true,
        customFields: true,
      }
    });
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    res.json(project);
  } catch (error) {
    next(error);
  }
};

exports.getProjectBoard = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        issues: {
          include: {
            assignee: true,
            reporter: true,
            sprint: true,
          }
        },
        sprints: {
          where: { status: 'ACTIVE' }
        }
      }
    });
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({
      project: {
        id: project.id,
        name: project.name,
        key: project.key,
        workflow: project.workflow,
      },
      issues: project.issues,
      activeSprints: project.sprints,
    });
  } catch (error) {
    next(error);
  }
};

exports.getProjectActivity = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;
    
    const activities = await prisma.activityLog.findMany({
      where: { projectId: id },
      include: {
        user: { select: { id: true, displayName: true, avatar: true } },
        issue: { select: { id: true, issueKey: true, title: true } }
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: parseInt(limit),
    });
    
    res.json(activities);
  } catch (error) {
    next(error);
  }
};

exports.getProjectSprints = async (req, res, next) => {
  try {
    const sprints = await prisma.sprint.findMany({
      where: { projectId: req.params.id },
      orderBy: { createdAt: 'desc' }
    });
    res.json(sprints);
  } catch (error) {
    next(error);
  }
};
