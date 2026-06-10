const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding data...');

  // 1. Create Users
  const users = [
    { email: 'jane@example.com', displayName: 'Jane Smith', avatar: 'https://i.pravatar.cc/150?u=jane' },
    { email: 'bob@example.com', displayName: 'Bob Chen', avatar: 'https://i.pravatar.cc/150?u=bob' },
    { email: 'alice@example.com', displayName: 'Alice Wong', avatar: 'https://i.pravatar.cc/150?u=alice' },
  ];

  const seededUsers = [];
  for (const u of users) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: u,
    });
    seededUsers.push(user);
  }
  const [user1, user2, user3] = seededUsers;

  // Create Project
  const project = await prisma.project.upsert({
    where: { key: 'PROJ' },
    update: {},
    create: {
      name: 'Alpha Project',
      key: 'PROJ',
      description: 'The first big project',
      leadId: user1.id,
      workflow: {
        statuses: [
          { id: 'todo', name: 'To Do', category: 'TODO' },
          { id: 'inprogress', name: 'In Progress', category: 'IN_PROGRESS' },
          { id: 'review', name: 'In Review', category: 'IN_PROGRESS' },
          { id: 'done', name: 'Done', category: 'DONE' }
        ],
        transitions: [
          { from: 'todo', to: 'inprogress' },
          { from: 'inprogress', to: 'review' },
          { from: 'review', to: 'done' },
          { from: 'review', to: 'inprogress' },
          { from: 'inprogress', to: 'todo' }
        ]
      }
    },
  });

  // Create Sprint
  const sprint = await prisma.sprint.upsert({
    where: { id: 'seed-sprint-1' }, // Providing a fixed ID for seeding to make it idempotent
    update: {},
    create: {
      id: 'seed-sprint-1',
      name: 'Sprint 1',
      projectId: project.id,
      startDate: new Date(),
      endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      status: 'ACTIVE',
    },
  });

  // Create Issues
  await prisma.issue.upsert({
    where: { issueKey: 'PROJ-1' },
    update: {},
    create: {
      issueKey: 'PROJ-1',
      projectId: project.id,
      type: 'STORY',
      title: 'Add user authentication via OAuth',
      description: 'Implement OAuth 2.0 login flow...',
      status: 'inprogress',
      priority: 'HIGH',
      assigneeId: user1.id,
      reporterId: user2.id,
      sprintId: sprint.id,
      storyPoints: 5,
      labels: ['auth', 'backend'],
    },
  });

  await prisma.issue.upsert({
    where: { issueKey: 'PROJ-2' },
    update: {},
    create: {
      issueKey: 'PROJ-2',
      projectId: project.id,
      type: 'TASK',
      title: 'Setup CI/CD pipeline',
      description: 'Configure GitHub Actions',
      status: 'todo',
      priority: 'MEDIUM',
      assigneeId: user2.id,
      reporterId: user1.id,
      sprintId: sprint.id,
      storyPoints: 3,
    },
  });

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
