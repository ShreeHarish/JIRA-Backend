const axios = require('axios');

// ------------------------------
// Configuration
// ------------------------------
const TIME_LIMIT_SECONDS = 10; // Time limit for the test
const PARALLEL_REQUESTS = 500; // Number of parallel requests
const BASE_URL = 'http://localhost:3000/api'; // API base URL

// ------------------------------
// Helper functions to generate dynamic data
// ------------------------------
const generateRandomString = (length = 8) => {
  return Math.random().toString(36).substring(2, 2 + length);
};

const generateEmail = () => {
  return `${generateRandomString()}@example.com`;
};

const generateProjectData = () => ({
  name: `Project ${generateRandomString()}`,
  description: `Test project description ${generateRandomString()}`,
});

const generateIssueData = (projectId, reporterId, assigneeId) => {
  const types = ['EPIC', 'STORY', 'TASK', 'BUG', 'SUB_TASK'];
  const priorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
  const type = types[Math.floor(Math.random() * types.length)];
  
  return {
    projectId,
    type,
    title: `Test Issue ${generateRandomString()}`,
    description: `Test description ${generateRandomString()}`,
    priority: priorities[Math.floor(Math.random() * priorities.length)],
    assigneeId,
    reporterId,
    storyPoints: Math.floor(Math.random() * 10) + 1,
  };
};

const generateUserData = () => ({
  email: generateEmail(),
  displayName: `User ${generateRandomString()}`,
  avatar: `https://example.com/avatar-${generateRandomString()}.png`,
});

const generateSprintData = (projectId) => ({
  name: `Sprint ${generateRandomString()}`,
  projectId,
  startDate: new Date().toISOString(),
  endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 2 weeks
});

// ------------------------------
// Prepare initial data cache
// ------------------------------
let cachedData = {
  users: [],
  projects: [],
  issues: [],
  sprints: [],
  watchedIssues: new Set(), // Store "userId:issueId"
};

// ------------------------------
// API call functions
// ------------------------------
const apiCalls = [
  // User Endpoints
  {
    name: 'getAllUsers',
    method: 'get',
    path: '/users',
    expectedStatus: 200,
    prepare: async () => ({ url: `${BASE_URL}/users` }),
  },
  {
    name: 'createUser',
    method: 'post',
    path: '/users',
    expectedStatus: 201,
    prepare: async () => ({
      url: `${BASE_URL}/users`,
      data: generateUserData(),
    }),
    onSuccess: async (response) => {
      cachedData.users.push(response.data);
    },
  },
  {
    name: 'getUserById',
    method: 'get',
    path: '/users/:id',
    expectedStatus: 200,
    prepare: async () => {
      const user = cachedData.users.length > 0 
        ? cachedData.users[Math.floor(Math.random() * cachedData.users.length)] 
        : null;
      if (!user) return { skip: true };
      return { url: `${BASE_URL}/users/${user.id}` };
    },
  },
  {
    name: 'getUserNotifications',
    method: 'get',
    path: '/users/:id/notifications',
    expectedStatus: 200,
    prepare: async () => {
      const user = cachedData.users.length > 0 
        ? cachedData.users[Math.floor(Math.random() * cachedData.users.length)] 
        : null;
      if (!user) return { skip: true };
      return { url: `${BASE_URL}/users/${user.id}/notifications` };
    },
  },

  // Project Endpoints
  {
    name: 'getAllProjects',
    method: 'get',
    path: '/projects',
    expectedStatus: 200,
    prepare: async () => ({ url: `${BASE_URL}/projects` }),
    onSuccess: async (response) => {
      cachedData.projects = response.data;
    },
  },
  {
    name: 'createProject',
    method: 'post',
    path: '/projects',
    expectedStatus: 201,
    prepare: async () => {
      const lead = cachedData.users.length > 0 
        ? cachedData.users[Math.floor(Math.random() * cachedData.users.length)] 
        : null;
      const projectData = generateProjectData();
      if (lead) projectData.leadId = lead.id;
      return {
        url: `${BASE_URL}/projects`,
        data: projectData,
      };
    },
    onSuccess: async (response) => {
      cachedData.projects.push(response.data);
    },
  },
  {
    name: 'getProjectById',
    method: 'get',
    path: '/projects/:id',
    expectedStatus: 200,
    prepare: async () => {
      const project = cachedData.projects.length > 0 
        ? cachedData.projects[Math.floor(Math.random() * cachedData.projects.length)] 
        : null;
      if (!project) return { skip: true };
      return { url: `${BASE_URL}/projects/${project.id}` };
    },
  },
  {
    name: 'getProjectBoard',
    method: 'get',
    path: '/projects/:id/board',
    expectedStatus: 200,
    prepare: async () => {
      const project = cachedData.projects.length > 0 
        ? cachedData.projects[Math.floor(Math.random() * cachedData.projects.length)] 
        : null;
      if (!project) return { skip: true };
      return { url: `${BASE_URL}/projects/${project.id}/board` };
    },
  },
  {
    name: 'getProjectActivity',
    method: 'get',
    path: '/projects/:id/activity',
    expectedStatus: 200,
    prepare: async () => {
      const project = cachedData.projects.length > 0 
        ? cachedData.projects[Math.floor(Math.random() * cachedData.projects.length)] 
        : null;
      if (!project) return { skip: true };
      return { 
        url: `${BASE_URL}/projects/${project.id}/activity`,
        params: { page: 1, limit: 10 }
      };
    },
  },
  {
    name: 'getProjectSprints',
    method: 'get',
    path: '/projects/:id/sprints',
    expectedStatus: 200,
    prepare: async () => {
      const project = cachedData.projects.length > 0 
        ? cachedData.projects[Math.floor(Math.random() * cachedData.projects.length)] 
        : null;
      if (!project) return { skip: true };
      return { url: `${BASE_URL}/projects/${project.id}/sprints` };
    },
  },
  {
    name: 'createProjectIssue',
    method: 'post',
    path: '/projects/:id/issues',
    expectedStatus: 201,
    prepare: async () => {
      const project = cachedData.projects.length > 0 
        ? cachedData.projects[Math.floor(Math.random() * cachedData.projects.length)] 
        : null;
      const reporter = cachedData.users.length > 0 
        ? cachedData.users[Math.floor(Math.random() * cachedData.users.length)] 
        : null;
      const assignee = cachedData.users.length > 0 
        ? cachedData.users[Math.floor(Math.random() * cachedData.users.length)] 
        : null;
      if (!project || !reporter) return { skip: true };
      const issueData = generateIssueData(project.id, reporter.id, assignee.id);
      delete issueData.projectId; // Since projectId is in URL
      return {
        url: `${BASE_URL}/projects/${project.id}/issues`,
        data: issueData,
      };
    },
    onSuccess: async (response) => {
      cachedData.issues.push(response.data);
    },
  },

  // Issue Endpoints
  {
    name: 'createIssue',
    method: 'post',
    path: '/issues',
    expectedStatus: 201,
    prepare: async () => {
      const project = cachedData.projects.length > 0 
        ? cachedData.projects[Math.floor(Math.random() * cachedData.projects.length)] 
        : null;
      const reporter = cachedData.users.length > 0 
        ? cachedData.users[Math.floor(Math.random() * cachedData.users.length)] 
        : null;
      const assignee = cachedData.users.length > 0 
        ? cachedData.users[Math.floor(Math.random() * cachedData.users.length)] 
        : null;
      if (!project || !reporter) return { skip: true };
      return {
        url: `${BASE_URL}/issues`,
        data: generateIssueData(project.id, reporter.id, assignee.id),
      };
    },
    onSuccess: async (response) => {
      cachedData.issues.push(response.data);
    },
  },
  {
    name: 'getIssueById',
    method: 'get',
    path: '/issues/:id',
    expectedStatus: 200,
    prepare: async () => {
      const issue = cachedData.issues.length > 0 
        ? cachedData.issues[Math.floor(Math.random() * cachedData.issues.length)] 
        : null;
      if (!issue) return { skip: true };
      return { url: `${BASE_URL}/issues/${issue.id}` };
    },
  },
  {
    name: 'updateIssue',
    method: 'patch',
    path: '/issues/:id',
    expectedStatus: 200,
    prepare: async () => {
      const issue = cachedData.issues.length > 0 
        ? cachedData.issues[Math.floor(Math.random() * cachedData.issues.length)] 
        : null;
      if (!issue) return { skip: true };
      return {
        url: `${BASE_URL}/issues/${issue.id}`,
        data: {
          title: `Updated Issue ${generateRandomString()}`,
          version: issue.version || 1
        },
      };
    },
    onSuccess: async (response) => {
      // Update cached issue
      const index = cachedData.issues.findIndex(i => i.id === response.data.id);
      if (index !== -1) {
        cachedData.issues[index] = response.data;
      }
    },
  },
  {
    name: 'transitionIssue',
    method: 'post',
    path: '/issues/:id/transitions',
    expectedStatus: 200,
    prepare: async () => {
      const issue = cachedData.issues.length > 0 
        ? cachedData.issues[Math.floor(Math.random() * cachedData.issues.length)] 
        : null;
      const user = cachedData.users.length > 0 
        ? cachedData.users[Math.floor(Math.random() * cachedData.users.length)] 
        : null;
      if (!issue) return { skip: true };
      
      // Allowed transitions based on default workflow
      let allowedTransitions;
      switch (issue.status) {
        case 'todo':
          allowedTransitions = ['inprogress'];
          break;
        case 'inprogress':
          allowedTransitions = ['done', 'todo'];
          break;
        case 'done':
          allowedTransitions = ['inprogress'];
          break;
        default:
          // If status is something else, skip to avoid errors
          return { skip: true };
      }
      
      const toStatus = allowedTransitions[Math.floor(Math.random() * allowedTransitions.length)];
      return {
        url: `${BASE_URL}/issues/${issue.id}/transitions`,
        data: {
          toStatus,
          userId: user ? user.id : null,
          version: issue.version || 1
        },
      };
    },
    onSuccess: async (response) => {
      // Update cached issue
      const index = cachedData.issues.findIndex(i => i.id === response.data.id);
      if (index !== -1) {
        cachedData.issues[index] = response.data;
      }
    },
  },
  {
    name: 'getIssueComments',
    method: 'get',
    path: '/issues/:id/comments',
    expectedStatus: 200,
    prepare: async () => {
      const issue = cachedData.issues.length > 0 
        ? cachedData.issues[Math.floor(Math.random() * cachedData.issues.length)] 
        : null;
      if (!issue) return { skip: true };
      return { url: `${BASE_URL}/issues/${issue.id}/comments` };
    },
  },
  {
    name: 'addComment',
    method: 'post',
    path: '/issues/:id/comments',
    expectedStatus: 201,
    prepare: async () => {
      const issue = cachedData.issues.length > 0 
        ? cachedData.issues[Math.floor(Math.random() * cachedData.issues.length)] 
        : null;
      const user = cachedData.users.length > 0 
        ? cachedData.users[Math.floor(Math.random() * cachedData.users.length)] 
        : null;
      if (!issue || !user) return { skip: true };
      return {
        url: `${BASE_URL}/issues/${issue.id}/comments`,
        data: {
          authorId: user.id,
          content: `Test comment ${generateRandomString()}`
        },
      };
    },
  },
  {
    name: 'watchIssue',
    method: 'post',
    path: '/issues/:id/watch',
    expectedStatus: 204,
    prepare: async () => {
      const issue = cachedData.issues.length > 0 
        ? cachedData.issues[Math.floor(Math.random() * cachedData.issues.length)] 
        : null;
      const user = cachedData.users.length > 0 
        ? cachedData.users[Math.floor(Math.random() * cachedData.users.length)] 
        : null;
      if (!issue || !user) return { skip: true };
      const watchKey = `${user.id}:${issue.id}`;
      // If already watching, skip
      if (cachedData.watchedIssues.has(watchKey)) return { skip: true };
      return {
        url: `${BASE_URL}/issues/${issue.id}/watch`,
        data: { userId: user.id },
        watchKey,
      };
    },
    onSuccess: async (_, requestOptions) => {
      // Add to watched issues
      if (requestOptions.watchKey) {
        cachedData.watchedIssues.add(requestOptions.watchKey);
      }
    },
  },
  {
    name: 'unwatchIssue',
    method: 'delete',
    path: '/issues/:id/watch',
    expectedStatus: 204,
    prepare: async () => {
      // Get all watched issues
      const watchedArray = Array.from(cachedData.watchedIssues);
      if (watchedArray.length === 0) return { skip: true };
      
      // Pick a random watched issue
      const randomWatchKey = watchedArray[Math.floor(Math.random() * watchedArray.length)];
      const [userId, issueId] = randomWatchKey.split(':');
      
      return {
        url: `${BASE_URL}/issues/${issueId}/watch`,
        data: { userId },
        watchKey: randomWatchKey,
      };
    },
    onSuccess: async (_, requestOptions) => {
      // Remove from watched issues
      if (requestOptions.watchKey) {
        cachedData.watchedIssues.delete(requestOptions.watchKey);
      }
    },
  },

  // Search Endpoints
  {
    name: 'searchIssues',
    method: 'get',
    path: '/search',
    expectedStatus: 200,
    prepare: async () => {
      const q = generateRandomString(3);
      const priorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
      const randomPriority = priorities[Math.floor(Math.random() * priorities.length)];
      return {
        url: `${BASE_URL}/search`,
        params: { q, priority: randomPriority, limit: 10 },
      };
    },
  },

  // Sprint Endpoints
  {
    name: 'createSprint',
    method: 'post',
    path: '/sprints',
    expectedStatus: 201,
    prepare: async () => {
      const project = cachedData.projects.length > 0 
        ? cachedData.projects[Math.floor(Math.random() * cachedData.projects.length)] 
        : null;
      if (!project) return { skip: true };
      return {
        url: `${BASE_URL}/sprints`,
        data: generateSprintData(project.id),
      };
    },
    onSuccess: async (response) => {
      cachedData.sprints.push(response.data);
    },
  },
  {
    name: 'updateSprint',
    method: 'patch',
    path: '/sprints/:id',
    expectedStatus: 200,
    prepare: async () => {
      const sprint = cachedData.sprints.length > 0 
        ? cachedData.sprints[Math.floor(Math.random() * cachedData.sprints.length)] 
        : null;
      if (!sprint) return { skip: true };
      return {
        url: `${BASE_URL}/sprints/${sprint.id}`,
        data: { name: `Updated Sprint ${generateRandomString()}` },
      };
    },
    onSuccess: async (response) => {
      // Update cached sprint
      const index = cachedData.sprints.findIndex(s => s.id === response.data.id);
      if (index !== -1) {
        cachedData.sprints[index] = response.data;
      }
    },
  },
  {
    name: 'startSprint',
    method: 'post',
    path: '/sprints/:id/start',
    expectedStatus: 200,
    prepare: async () => {
      const sprint = cachedData.sprints.length > 0 
        ? cachedData.sprints[Math.floor(Math.random() * cachedData.sprints.length)] 
        : null;
      if (!sprint || sprint.status === 'ACTIVE') return { skip: true };
      return { url: `${BASE_URL}/sprints/${sprint.id}/start` };
    },
    onSuccess: async (response) => {
      // Update cached sprint
      const index = cachedData.sprints.findIndex(s => s.id === response.data.id);
      if (index !== -1) {
        cachedData.sprints[index] = response.data;
      }
    },
  },
  {
    name: 'addIssuesToSprint',
    method: 'post',
    path: '/sprints/:id/issues',
    expectedStatus: 204,
    prepare: async () => {
      const sprint = cachedData.sprints.length > 0 
        ? cachedData.sprints[Math.floor(Math.random() * cachedData.sprints.length)] 
        : null;
      const issues = cachedData.issues.slice(0, 3);
      if (!sprint || issues.length === 0) return { skip: true };
      return {
        url: `${BASE_URL}/sprints/${sprint.id}/issues`,
        data: { issueIds: issues.map(i => i.id) },
      };
    },
  },
];

// ------------------------------
// Test execution
// ------------------------------
let totalSuccess = 0;
let totalFailed = 0;
let testEndTime = Date.now() + TIME_LIMIT_SECONDS * 1000;

// Pre-populate some initial data for testing
const prepopulateData = async () => {
  try {
    // Create initial user
    const userResponse = await axios.post(`${BASE_URL}/users`, generateUserData());
    cachedData.users.push(userResponse.data);

    // Create initial project
    const projectData = generateProjectData();
    projectData.leadId = userResponse.data.id;
    const projectResponse = await axios.post(`${BASE_URL}/projects`, projectData);
    cachedData.projects.push(projectResponse.data);

    console.log('Pre-populated initial data');
  } catch (error) {
    console.log('Error pre-populating data:', error.message);
  }
};

const executeRandomRequest = async () => {
  const apiConfig = apiCalls[Math.floor(Math.random() * apiCalls.length)];

  try {
    const requestOptions = await apiConfig.prepare();
    
    if (requestOptions.skip) {
      return; // Not enough data, skip this call
    }

    const response = await axios({
      method: apiConfig.method,
      url: requestOptions.url,
      data: requestOptions.data,
      params: requestOptions.params,
      timeout: 10000,
    });

    if (response.status === apiConfig.expectedStatus) {
      console.log(`✓ ${apiConfig.name} succeeded (${response.status})`);
      totalSuccess++;
      if (apiConfig.onSuccess) {
        await apiConfig.onSuccess(response);
      }
    } else {
      console.log(`✗ ${apiConfig.name} failed (expected ${apiConfig.expectedStatus}, got ${response.status})`);
      totalFailed++;
    }
  } catch (error) {
    if (error.response) {
      console.log(`✗ ${apiConfig.name} failed (${error.response.status}):`, error.response.data.error || error.response.statusText);
    } else {
      console.log(`✗ ${apiConfig.name} failed:`, error.message);
    }
    totalFailed++;
  }
};

const startLoadTest = async () => {
  console.log('Starting load test...');
  console.log(`Time limit: ${TIME_LIMIT_SECONDS} seconds`);
  console.log(`Target parallel requests: ${PARALLEL_REQUESTS}`);
  console.log('----------------------------------------');

  // Pre-populate initial data
  await prepopulateData();

  // Run the test for the specified time limit
  while (Date.now() < testEndTime) {
    // Launch a batch of parallel requests
    const promises = [];
    for (let i = 0; i < PARALLEL_REQUESTS; i++) {
      promises.push(executeRandomRequest());
    }
    await Promise.all(promises);
  }

  console.log('----------------------------------------');
  console.log('Load test complete!');
  console.log(`Total successful: ${totalSuccess}`);
  console.log(`Total failed: ${totalFailed}`);
};

startLoadTest();
