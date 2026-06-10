# Jira Backend System

A clean, scalable relational data model and RESTful API for issue tracking and sprint management.

## Architecture Overview

- **Runtime**: Node.js (Express)
- **Database**: PostgreSQL with Prisma ORM
- **Real-time**: Socket.io for WebSocket updates
- **Validation**: Zod (planned)
- **Containerization**: Docker & Docker Compose

### Key Features

1. **Flexible Data Model**: Supports Projects, Issues (Epic -> Story -> Sub-task), Sprints, Users, and Activity Logs.
2. **Configurable Workflow Engine**: Define custom statuses and transition rules per project.
3. **Sprint Management**: CRUD for sprints, move issues, and track velocity.
4. **Real-time Updates**: Instant broadcasting of issue changes, comments, and sprint updates via WebSockets.
5. **Full Audit Trail**: Every issue mutation is logged in the Activity Feed.
6. **Search & Filtering**: Cursor-based pagination and full-text search support.

## Project Structure

```
├── controllers/      # Route handlers
├── routes/           # API route definitions
├── services/         # Business logic (Workflow Engine, etc.)
├── prisma/           # Database schema and migrations
├── lib/              # Shared utilities (Prisma client)
├── Dockerfile        # Container definition
└── docker-compose.yml # Local development setup
```

## Setup Instructions

### Prerequisites
- Node.js 18+
- Docker & Docker Compose

### Local Development

#### Option 1: Docker Compose (Recommended - Run Everything)
Run both the PostgreSQL database and the backend API in one command:
1. **Clone the repository**
2. **Start the services**:
   ```bash
   docker-compose up --build
   ```
3. **Open a new terminal and seed the database** (optional):
   ```bash
   docker-compose exec api npm run seed
   ```
4. The API will be available at `http://localhost:3000`

#### Option 2: Local Setup
1. **Clone the repository**
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Setup environment variables**:
   Create a `.env` file based on the provided configuration.
   DATABASE_URL="postgresql://postgres:toor@localhost:5432/jira_db?schema=public"
   PORT=3000
4. **Start the database**:
   ```bash
   docker-compose up -d db
   ```
5. **Run migrations and generate client**:
   ```bash
   npx prisma migrate dev
   npx prisma generate
   ```
6. **Seed the database**:
   ```bash
   npm run seed
   ```
7. **Start the server**:
   ```bash
   npm run dev
   ```

## API Documentation

### Users
- `POST /api/users`: Create user
    - **Body**: `{ "email": "string", "displayName": "string", "avatar": "string?" }`
    - **Response**: `{ "id": "uuid", "email": "string", "displayName": "string", "avatar": "string", "createdAt": "date", "updatedAt": "date" }`
- `GET /api/users`: List all users
    - **Response**: `[{ "id": "uuid", "email": "string", ... }]`
- `GET /api/users/:id`: Get user details and assigned issues
    - **Response**: `{ "id": "uuid", "displayName": "string", ..., "assignedIssues": [...], "reportedIssues": [...], "projectsLead": [...] }`
- `GET /api/users/:id/notifications`: Get user notifications
    - **Response**: `[{ "id": "uuid", "type": "string", "content": "string", "isRead": "boolean", "createdAt": "date" }]`

### Projects
- `POST /api/projects`: Create project
    - **Body**: `{ "name": "string", "key": "string?", "description": "string?", "leadId": "uuid", "workflow": "object?" }`
    - **Response**: `{ "id": "uuid", "name": "string", "key": "string", "workflow": {...}, ... }`
- `GET /api/projects`: List all projects
    - **Response**: `[{ "id": "uuid", "name": "string", "lead": { "displayName": "string", ... }, ... }]`
- `GET /api/projects/:id`: Get project details
    - **Response**: `{ "id": "uuid", "name": "string", "lead": {...}, "customFields": [...], ... }`
- `GET /api/projects/:id/board`: Get board state (issues + active sprints)
    - **Response**: `{ "project": {...}, "issues": [...], "activeSprints": [...] }`
- `GET /api/projects/:id/activity`: Get project activity feed
    - **Query Params**: `page` (default 1), `limit` (default 20)
    - **Response**: `[{ "id": "uuid", "action": "string", "user": {...}, "issue": {...}, "changes": {...}, "createdAt": "date" }]`
- `GET /api/projects/:id/sprints`: List all sprints for a project
    - **Response**: `[{ "id": "uuid", "name": "string", "status": "PLANNED|ACTIVE|COMPLETED", ... }]`
- `POST /api/projects/:id/issues`: Create issue for a project
    - **Body**: Same as `POST /api/issues` below
    - **Response**: Same as `POST /api/issues` below

### Issues
- `POST /api/issues`: Create issue
    - **Body**: `{ "projectId": "uuid", "type": "EPIC|STORY|TASK|BUG|SUB_TASK", "title": "string", "description": "string?", "priority": "LOW|MEDIUM|HIGH|URGENT", "assigneeId": "uuid?", "reporterId": "uuid", "sprintId": "uuid?", "storyPoints": "number?", "parentId": "uuid?", "labels": "string[]?" }`
    - **Response**: `{ "id": "uuid", "issueKey": "PROJ-1", "title": "string", "status": "todo", "version": 1, ... }`
- `GET /api/issues/:id`: Get issue details including comments and watchers
    - **Response**: `{ "id": "uuid", "title": "string", "comments": [...], "subtasks": [...], "watchers": [...], ... }`
- `PATCH /api/issues/:id`: Update issue fields
    - **Body**: `{ "version": "number", "title": "string?", "description": "string?", "priority": "enum?", "assigneeId": "uuid?", "storyPoints": "number?", "labels": "string[]?" }`
    - *Note: `version` is required for optimistic locking.*
    - **Response**: `{ "id": "uuid", "version": 2, ... }`
- `POST /api/issues/:id/transitions`: Transition issue status (Workflow Engine)
    - **Body**: `{ "toStatus": "string", "userId": "uuid", "version": "number" }`
    - **Response**: `{ "id": "uuid", "status": "new_status", "version": "next_version" }`
- `GET /api/issues/:id/comments`: List threaded comments
    - **Response**: `[{ "id": "uuid", "content": "string", "author": {...}, "replies": [...] }]`
- `POST /api/issues/:id/comments`: Add comment
    - **Body**: `{ "authorId": "uuid", "content": "string", "parentId": "uuid?" }`
    - **Response**: `{ "id": "uuid", "content": "string", "author": {...} }`
- `POST /api/issues/:id/watch`: Watch an issue
    - **Body**: `{ "userId": "uuid" }`
    - **Response**: `204 No Content`
- `DELETE /api/issues/:id/watch`: Unwatch an issue
    - **Body**: `{ "userId": "uuid" }`
    - **Response**: `204 No Content`

### Sprints
- `POST /api/sprints`: Create sprint
    - **Body**: `{ "name": "string", "projectId": "uuid", "startDate": "iso-date?", "endDate": "iso-date?" }`
    - **Response**: `{ "id": "uuid", "name": "string", "status": "PLANNED", ... }`
- `PATCH /api/sprints/:id`: Update sprint details
    - **Response**: `{ "id": "uuid", ... }`
- `POST /api/sprints/:id/start`: Start a sprint (sets status to ACTIVE)
    - **Response**: `{ "id": "uuid", "status": "ACTIVE", "startDate": "date" }`
- `POST /api/sprints/:id/complete`: Complete sprint & carry over items
    - **Body**: `{ "carryOverToSprintId": "uuid?", "issueIdsToCarryOver": "uuid[]?", "userId": "uuid?" }`
    - **Response**: `{ "message": "Sprint completed", "velocity": 15, "carriedOverCount": 3 }`
- `POST /api/sprints/:id/issues`: Add issues to a sprint
    - **Body**: `{ "issueIds": "uuid[]" }`
    - **Response**: `204 No Content`

### Search
- `GET /api/search`: Search issues with filters and pagination
    - **Query Params**: `q` (text search), `status`, `assignee` (uuid), `priority`, `projectId`, `cursor` (uuid), `limit` (default 20)
    - **Response**: `{ "items": [...], "nextCursor": "uuid" }`

## Design Decisions & Trade-offs

- **Prisma ORM**: Chosen for type safety and easy schema management, though it has slightly more overhead than raw SQL.
- **WebSocket Broadcasts**: Implemented via Socket.io for real-time board updates, ensuring a collaborative experience.
- **Workflow Engine**: Statuses and transitions are stored as JSON in the Project model, allowing for high flexibility without complex table joins.
- **Activity Logging**: Every mutation creates an `ActivityLog` entry, providing a full audit trail.
