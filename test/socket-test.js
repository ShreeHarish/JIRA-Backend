// test/socket-test.js
const { io } = require('socket.io-client');
const axios = require('axios');

// Configuration - update these!
const API_URL = process.env.API_URL || 'http://localhost:3000';
const SOCKET_URL = process.env.SOCKET_URL || 'http://localhost:3000';
const TEST_DURATION = 7000; // 7 seconds
const MAX_UPDATES = 5;

let createdIssueIds = [];
let updatesCount = 0;
let projectId = null;
let userId = null;

async function initTestData() {
  try {
    // Create a test user
    const userResponse = await axios.post(`${API_URL}/api/users`, {
      email: `test-user-${Date.now()}@example.com`,
      displayName: 'Test User'
    });
    userId = userResponse.data.id;
    console.log('Created test user:', userId);

    // Create a test project
    const projectResponse = await axios.post(`${API_URL}/api/projects`, {
      name: 'Test Project',
      key: `TEST${Date.now() % 10000}`,
      leadId: userId
    });
    projectId = projectResponse.data.id;
    console.log('Created test project:', projectId);
  } catch (error) {
    console.error('Error creating test data:', error.response?.data || error.message);
    process.exit(1);
  }
}

function setupSocket() {
  const socket = io(SOCKET_URL);

  socket.on('connect', () => {
    console.log('✅ Connected to socket server');
    socket.emit('join_board', projectId);
    console.log(`🚀 Joined project board: ${projectId}`);
  });

  // Listen for real-time events
  socket.on('issue_created', (issue) => {
    console.log(`📬 Received issue_created: ${issue.issueKey} - ${issue.title}`);
  });

  socket.on('issue_updated', (issue) => {
    console.log(`📬 Received issue_updated: ${issue.issueKey} - ${issue.title} (v${issue.version})`);
  });

  socket.on('disconnect', () => {
    console.log('❌ Disconnected from socket server');
  });

  return socket;
}

async function createAndUpdateIssues() {
  while (updatesCount < MAX_UPDATES) {
    try {
      // Create a new issue
      const newIssue = await axios.post(`${API_URL}/api/projects/${projectId}/issues`, {
        type: 'STORY',
        title: `Test Issue ${createdIssueIds.length + 1}`,
        description: 'This is a test issue',
        priority: 'MEDIUM',
        reporterId: userId,
        storyPoints: 3
      });
      createdIssueIds.push(newIssue.data.id);
      console.log(`✅ Created issue: ${newIssue.data.issueKey}`);

      // Wait a little, then update the issue
      await new Promise(resolve => setTimeout(resolve, 800));
      const updatedIssue = await axios.patch(`${API_URL}/api/issues/${newIssue.data.id}`, {
        version: newIssue.data.version,
        title: `Updated Test Issue ${createdIssueIds.length}`,
        priority: 'HIGH'
      });
      console.log(`✅ Updated issue: ${updatedIssue.data.issueKey}`);

      updatesCount++;
      // Wait before next iteration
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error('Error creating/updating issue:', error.response?.data || error.message);
      break;
    }
  }
}

async function main() {
  console.log('🧪 Starting socket test...');
  console.log(`⏱️ Test duration: ${TEST_DURATION / 1000} seconds`);
  console.log(`🔢 Max updates: ${MAX_UPDATES}`);

  // Create test project and user
  await initTestData();

  // Connect to socket
  const socket = setupSocket();

  // Wait for socket to connect
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Start creating and updating issues
  createAndUpdateIssues().catch(console.error);

  // Stop test after TEST_DURATION
  setTimeout(async () => {
    console.log('\n⏰ Test duration reached! Stopping...');
    socket.disconnect();
    console.log('✅ Test complete!');
    process.exit(0);
  }, TEST_DURATION);
}

main().catch(console.error);
