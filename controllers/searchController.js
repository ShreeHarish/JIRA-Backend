const prisma = require('../lib/prisma');

exports.searchIssues = async (req, res, next) => {
  try {
    const { q, status, assignee, priority, projectId, cursor, limit = 20 } = req.query;

    const where = {};

    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { issueKey: { contains: q, mode: 'insensitive' } },
        { comments: { some: { content: { contains: q, mode: 'insensitive' } } } }
      ];
    }

    if (status) where.status = status;
    if (assignee) where.assigneeId = assignee;
    if (priority) where.priority = priority;
    if (projectId) where.projectId = projectId;

    const issues = await prisma.issue.findMany({
      where,
      take: parseInt(limit),
      ...(cursor && { skip: 1, cursor: { id: cursor } }),
      orderBy: { createdAt: 'desc' },
      include: {
        assignee: { select: { id: true, displayName: true } },
        project: { select: { id: true, name: true, key: true } }
      }
    });

    const nextCursor = issues.length === parseInt(limit) ? issues[issues.length - 1].id : null;

    res.json({
      items: issues,
      nextCursor
    });
  } catch (error) {
    next(error);
  }
};
