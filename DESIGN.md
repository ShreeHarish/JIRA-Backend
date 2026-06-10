# Design Documentation: Jira Backend System

## 1. Architecture Decisions

### Runtime & Framework
- **Node.js (Express)**: Chosen for its asynchronous nature, which is ideal for high-throughput I/O bound applications like issue tracking.
- **Socket.io**: Used for real-time synchronization. It handles reconnection, buffering, and fallback transports automatically.

### Database & ORM
- **PostgreSQL**: A reliable relational database that supports ACID transactions, complex joins, and JSONB fields, making it perfect for structured yet flexible data like project workflows.
- **Prisma ORM**: Provides type-safety, auto-generated migrations, and a clean API for complex relations.

### Concurrency Control
- **Optimistic Locking**: Implemented via a `version` field on the `Issue` model. This ensures that concurrent updates (e.g., two users editing the same issue) are handled safely without data loss. If versions mismatch, a `409 Conflict` is returned.

## 2. Database Schema (ERD Overview)

The schema is designed to handle hierarchical relationships and flexible project configurations:

- **User**: Core identity model.
- **Project**: Contains a `workflow` (JSONB) defining statuses and transitions.
- **Issue**: The central entity. Supports:
    - **Self-referencing relationship**: `parentId` for Epic -> Story -> Sub-task hierarchy.
    - **Status**: Managed by the Project's workflow engine.
    - **Custom Fields**: Extensible through `CustomField` and `CustomFieldValue` tables.
- **Sprint**: Time-boxed containers for issues.
- **ActivityLog**: Immutable audit trail for every mutation.
- **Comment**: Threaded discussions on issues.
- **Notification**: In-app event stream for users.

## 3. Workflow Engine Logic

The workflow engine is **data-driven**:
- **Status Validation**: Every status change calls `WorkflowService.validateTransition`.
- **Rules**: Transitions are checked against the project's allowed rules defined in the `workflow` JSON.
- **Hooks**: Supports business rules like "Cannot close an Epic if it has open subtasks".

## 4. Real-Time Synchronization

- **Namespace/Rooms**: Users join a "room" per project (`project:{id}`).
- **Events**: 
    - `issue_created`: Fired when a new issue is added.
    - `issue_updated`: Fired for field changes or status transitions.
    - `comment_added`: Fired for new threaded comments.
    - `sprint_updated`: Fired when sprints are started or completed.

## 5. Trade-offs & Optimizations

### Optimized for:
- **Flexibility**: Workflows and custom fields allow the system to adapt to different project management styles without schema changes.
- **Data Integrity**: Relational constraints and optimistic locking prevent orphaned records and race conditions.
- **Auditability**: The `ActivityLog` ensures every change is traceable, a critical requirement for enterprise tools.

### Trade-offs:
- **JSON for Workflows**: While flexible, querying *inside* the workflow rules via SQL is harder than using normalized tables. However, since workflows are mostly read as a whole by the application, JSON is more efficient for retrieval.
- **Last-Write-Wins vs. Versioning**: We chose Optimistic Locking (Versioning) to prioritize data correctness over "silent" overwrites, even though it requires clients to handle conflicts.

## 6. Scaling Strategy

- **Database Indexing**: Indexes are placed on `projectId`, `sprintId`, and `assigneeId` to speed up board rendering and search.
- **Cursor Pagination**: Used for search and activity feeds to ensure stable performance even as the database grows.
- **Stateless API**: The Express server is stateless, allowing it to scale horizontally behind a load balancer (using Redis for Socket.io adapter if needed in the future).
