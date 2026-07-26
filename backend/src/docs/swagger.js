const swaggerJsdoc = require("swagger-jsdoc");
const config = require("../config");

const errorEnvelope = {
  type: "object",
  properties: {
    error: {
      type: "object",
      properties: {
        code:    { type: "string", example: "NOT_FOUND" },
        message: { type: "string", example: "Task not found" },
        details: { type: "array", items: { type: "object" }, nullable: true },
      },
    },
  },
};

const options = {
  definition: {
    openapi: "3.0.3",
    info: {
      title: "TaskBid API",
      version: "1.0.0",
      description:
        "TaskBid backend — task bidding and assignment system. " +
        "All mutating endpoints require X-User-Id header (simulated auth). " +
        "Error envelope shape: { error: { code, message, details? } }.",
    },
    servers: config.nodeEnv === "production"
      ? [
          { url: "https://taskbid-production-ebb6.up.railway.app", description: "Production (Railway)" },
          { url: "http://localhost:4000", description: "Local development" },
        ]
      : [
          { url: "http://localhost:4000", description: "Local development" },
          { url: "https://taskbid-production-ebb6.up.railway.app", description: "Production (Railway)" },
        ],
    components: {
      parameters: {
        XUserId: {
          in: "header",
          name: "X-User-Id",
          required: true,
          schema: { type: "string", example: "64b1f2c3d4e5f6a7b8c9d0e1" },
          description: "MongoDB ObjectId of the acting user (simulated auth header).",
        },
        TaskId: {
          in: "path",
          name: "id",
          required: true,
          schema: { type: "string", example: "64b1f2c3d4e5f6a7b8c9d0e1" },
          description: "Task ObjectId.",
        },
        UserId: {
          in: "path",
          name: "id",
          required: true,
          schema: { type: "string", example: "64b1f2c3d4e5f6a7b8c9d0e1" },
          description: "User ObjectId.",
        },
      },
      schemas: {
        ErrorEnvelope: errorEnvelope,
        Task: {
          type: "object",
          properties: {
            _id:           { type: "string" },
            title:         { type: "string" },
            description:   { type: "string", nullable: true },
            complexity:    { type: "integer", minimum: 1, maximum: 5 },
            status:        { type: "string", enum: ["draft","open","bidding_closed","assigned","in_progress","review","done"] },
            createdBy:     { type: "string" },
            assignedUser:  { type: "string", nullable: true },
            assignedBid:   { type: "string", nullable: true },
            deadline:      { type: "string", format: "date-time" },
            createdAt:     { type: "string", format: "date-time" },
            updatedAt:     { type: "string", format: "date-time" },
            bidCount:      { type: "integer", description: "Only present on GET /api/tasks list response." },
            lowestBidHours:{ type: "number", nullable: true, description: "Only present on GET /api/tasks list response." },
          },
        },
        Bid: {
          type: "object",
          properties: {
            _id:          { type: "string" },
            task:         { type: "string" },
            user:         { type: "string" },
            hoursOffered: { type: "number" },
            status:       { type: "string", enum: ["pending","assigned","not_selected"] },
            createdAt:    { type: "string", format: "date-time" },
          },
        },
      },
    },
    paths: {
      "/health": {
        get: {
          tags: ["Health"],
          summary: "Health check",
          description: "Returns 200 when MongoDB is connected, 503 otherwise.",
          responses: {
            200: { description: "OK", content: { "application/json": { schema: { type: "object", properties: { status: { type: "string", example: "ok" } } } } } },
            503: { description: "Database unavailable", content: { "application/json": { schema: { type: "object", properties: { status: { type: "string", example: "unavailable" } } } } } },
          },
        },
      },
      "/api/users": {
        get: {
          tags: ["Users"],
          summary: "List all users",
          description:
            "Returns id + name for every user. Added pragmatically for the frontend user-switcher (Feature 12) — not originally specced; flagged in TRACKING.md as an unspecced addition pending architect sign-off.",
          responses: {
            200: {
              description: "Array of users",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        _id:   { type: "string" },
                        name:  { type: "string" },
                        email: { type: "string" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/users/{id}/workload": {
        get: {
          tags: ["Users"],
          summary: "Get user workload",
          description: "Returns current workload and remaining capacity for a user. No X-User-Id required.",
          parameters: [{ $ref: "#/components/parameters/UserId" }],
          responses: {
            200: {
              description: "Workload data",
              content: { "application/json": { schema: { type: "object", properties: {
                userId:                 { type: "string" },
                currentWorkloadHours:   { type: "number" },
                maxCapacityHours:       { type: "number" },
                remainingCapacityHours: { type: "number" },
              } } } },
            },
            400: { description: "Invalid ObjectId param", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } } },
            404: { description: "User not found",        content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } } },
          },
        },
      },
      "/api/tasks": {
        post: {
          tags: ["Tasks"],
          summary: "Create a task",
          description: "Creates a new task in draft status. Requires X-User-Id.",
          parameters: [{ $ref: "#/components/parameters/XUserId" }],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object", required: ["title","complexity","deadline"], properties: {
              title:       { type: "string", maxLength: 200, example: "Build auth module" },
              description: { type: "string", nullable: true, example: "Implement JWT-based auth" },
              complexity:  { type: "integer", minimum: 1, maximum: 5, example: 3 },
              deadline:    { type: "string", format: "date-time", example: "2027-01-01T00:00:00.000Z" },
            } } } },
          },
          responses: {
            201: { description: "Task created", content: { "application/json": { schema: { $ref: "#/components/schemas/Task" } } } },
            400: { description: "Validation error / invalid X-User-Id", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } } },
          },
        },
        get: {
          tags: ["Tasks"],
          summary: "List tasks",
          description: "Returns all tasks with bid counts and lowest bid. Optional status filter. No X-User-Id required.",
          parameters: [
            { in: "query", name: "status", required: false, schema: { type: "string", enum: ["draft","open","bidding_closed","assigned","in_progress","review","done"] }, description: "Filter by task status." },
          ],
          responses: {
            200: { description: "Array of tasks", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Task" } } } } },
          },
        },
      },
      "/api/tasks/{id}/status": {
        patch: {
          tags: ["Tasks"],
          summary: "Advance task status",
          description: "Moves a task to the next status in sequence (forward-only). Requires X-User-Id.",
          parameters: [
            { $ref: "#/components/parameters/XUserId" },
            { $ref: "#/components/parameters/TaskId" },
          ],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object", required: ["targetStatus"], properties: {
              targetStatus: { type: "string", enum: ["draft","open","bidding_closed","assigned","in_progress","review","done"], example: "open" },
            } } } },
          },
          responses: {
            200: { description: "Updated task",              content: { "application/json": { schema: { $ref: "#/components/schemas/Task" } } } },
            400: { description: "Validation error",          content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } } },
            404: { description: "Task not found",            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } } },
            409: { description: "Illegal status transition", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } } },
          },
        },
      },
      "/api/tasks/{id}/bids": {
        post: {
          tags: ["Bids"],
          summary: "Place a bid",
          description: "Places a bid on a task. Task must be in open status. Requires X-User-Id.",
          parameters: [
            { $ref: "#/components/parameters/XUserId" },
            { $ref: "#/components/parameters/TaskId" },
          ],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object", required: ["hoursOffered"], properties: {
              hoursOffered: { type: "number", exclusiveMinimum: 0, example: 4 },
            } } } },
          },
          responses: {
            201: { description: "Bid placed",                    content: { "application/json": { schema: { $ref: "#/components/schemas/Bid" } } } },
            400: { description: "Validation error",              content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } } },
            403: { description: "Cannot bid on own task",        content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } } },
            404: { description: "Task not found",                content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } } },
            409: { description: "Duplicate bid / bidding closed", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } } },
            422: { description: "Exceeds remaining capacity",    content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } } },
          },
        },
        get: {
          tags: ["Bids"],
          summary: "List bids for a task",
          description: "Returns all bids for a task, sorted by hoursOffered ascending. No X-User-Id required.",
          parameters: [{ $ref: "#/components/parameters/TaskId" }],
          responses: {
            200: { description: "Array of bids", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Bid" } } } } },
            400: { description: "Invalid task id", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } } },
            404: { description: "Task not found",  content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } } },
          },
        },
      },
      "/api/tasks/{id}/assign": {
        post: {
          tags: ["Assignment"],
          summary: "Assign a task",
          description:
            "Assigns a bidding_closed task to its lowest-hours eligible bidder. " +
            "Uses a MongoDB transaction with optimistic concurrency control (capacityVersion) " +
            "to prevent double-booking under concurrent calls. Retries up to 3 times on conflict. " +
            "Requires X-User-Id.",
          parameters: [
            { $ref: "#/components/parameters/XUserId" },
            { $ref: "#/components/parameters/TaskId" },
          ],
          responses: {
            200: {
              description: "Assignment successful",
              content: { "application/json": { schema: { type: "object", properties: {
                assignedUserId: { type: "string" },
                assignedBidId:  { type: "string" },
                task:           { $ref: "#/components/schemas/Task" },
              } } } },
            },
            400: { description: "Validation error",                          content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } } },
            404: { description: "Task not found",                            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } } },
            409: { description: "Task not in bidding_closed status",         content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } } },
            422: { description: "No bids / no eligible bidder has capacity", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } } },
            503: { description: "Retry budget exhausted (high contention)",  content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } } },
          },
        },
      },
      "/api/dashboard/stats": {
        get: {
          tags: ["Dashboard"],
          summary: "Get dashboard stats",
          description:
            "Returns four aggregated metrics computed in parallel: tasks grouped by status, " +
            "average bid hours per complexity level, top 3 users by completed task count, " +
            "and tasks with zero bids that are past their deadline. No X-User-Id required.",
          responses: {
            200: {
              description: "Dashboard statistics",
              content: { "application/json": { schema: { type: "object", properties: {
                tasksByStatus: {
                  type: "array",
                  items: { type: "object", properties: { status: { type: "string" }, count: { type: "integer" } } },
                },
                avgBidByComplexity: {
                  type: "array",
                  items: { type: "object", properties: { complexity: { type: "integer" }, averageHours: { type: "number" } } },
                },
                topUsersByCompleted: {
                  type: "array",
                  items: { type: "object", properties: { userId: { type: "string" }, name: { type: "string" }, completedCount: { type: "integer" } } },
                },
                zeroBidPastDeadline: {
                  type: "array",
                  items: { type: "object", properties: { taskId: { type: "string" }, title: { type: "string" }, deadline: { type: "string", format: "date-time" } } },
                },
              } } } },
            },
          },
        },
      },
    },
  },
  apis: [],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
