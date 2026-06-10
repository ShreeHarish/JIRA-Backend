const prisma = require('../lib/prisma');

class WorkflowService {
  async validateTransition(issueId, toStatus, userId) {
    const issue = await prisma.issue.findUnique({
      where: { id: issueId },
      include: { project: true }
    });

    if (!issue) throw new Error('Issue not found');

    const workflow = issue.project.workflow;
    const currentStatus = issue.status;

    // Check if transition is allowed
    const isAllowed = workflow.transitions.some(
      t => t.from === currentStatus && t.to === toStatus
    );

    if (!isAllowed) {
      const allowedTransitions = workflow.transitions
        .filter(t => t.from === currentStatus)
        .map(t => t.to)
        .join(', ');
      
      throw new Error(`Transition from ${currentStatus} to ${toStatus} is not allowed. Allowed transitions from ${currentStatus}: ${allowedTransitions || 'None'}`);
    }

    // Validation hooks (e.g., check required fields)
    // For now, let's just implement a simple one: EPICs cannot be moved to DONE if they have open subtasks
    if (issue.type === 'EPIC' && toStatus === 'done') {
      const openSubtasks = await prisma.issue.count({
        where: {
          parentId: issue.id,
          NOT: { status: 'done' }
        }
      });

      if (openSubtasks > 0) {
        throw new Error('Cannot close Epic with open subtasks');
      }
    }

    return issue;
  }

  async executePostTransitionActions(issue, toStatus, io) {
    // Automatic actions on transitions
    // Example: Assign to a default reviewer when moved to 'In Review'
    if (toStatus === 'review' || toStatus === 'inprogress_review') {
       // Logic to assign reviewer if needed
    }

    // Broadcast change via WebSocket
    io.to(`project:${issue.projectId}`).emit('issue_updated', {
      issueId: issue.id,
      status: toStatus,
      action: 'STATUS_CHANGED'
    });
  }
}

module.exports = new WorkflowService();
