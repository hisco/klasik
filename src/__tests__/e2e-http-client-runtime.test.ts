/**
 * E2E Tests for HTTP Client Runtime with Class Transformation
 *
 * Tests the complete pipeline:
 * 1. Generate HTTP client from OpenAPI spec
 * 2. Make actual HTTP requests to mock server
 * 3. Transform responses using plainToInstance to proper class instances
 * 4. Validate class-transformer and class-validator decorators work correctly
 */

import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as http from 'http';
import axios from 'axios';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { OpenAPIParser } from '../parsers/openapi-parser';
import { Generator } from '../generator/generator';

const TEST_PORT = 39878;

// Mock data
const mockTasksData = [
  {
    id: 'task-1',
    title: 'Implement feature X',
    description: 'Add new authentication flow',
    status: 'pending',
    priority: 3,
    createdAt: '2026-01-10T10:00:00Z',
    assignee: {
      id: 'user-1',
      name: 'Alice Developer',
      email: 'alice@example.com'
    }
  },
  {
    id: 'task-2',
    title: 'Fix bug Y',
    description: 'Memory leak in data processing',
    status: 'completed',
    priority: 5,
    createdAt: '2026-01-09T14:30:00Z',
    assignee: {
      id: 'user-2',
      name: 'Bob Tester',
      email: 'bob@example.com'
    }
  },
  {
    id: 'task-3',
    title: 'Update documentation',
    status: 'pending',
    priority: 1,
    createdAt: '2026-01-11T09:15:00Z',
    assignee: null
  }
];

// OpenAPI spec for Task Management API
const taskApiSpec = {
  openapi: '3.0.0',
  info: {
    title: 'Task Management API',
    version: '1.0.0',
    description: 'API for testing HTTP client generation with runtime validation'
  },
  paths: {
    '/tasks': {
      get: {
        operationId: 'listTasks',
        summary: 'List all tasks',
        tags: ['tasks'],
        parameters: [
          {
            name: 'status',
            in: 'query',
            required: false,
            schema: { type: 'string', enum: ['pending', 'completed'] }
          }
        ],
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Task' }
                }
              }
            }
          }
        }
      },
      post: {
        operationId: 'createTask',
        summary: 'Create a new task',
        tags: ['tasks'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/NewTask' }
            }
          }
        },
        responses: {
          '201': {
            description: 'Created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Task' }
              }
            }
          },
          '400': {
            description: 'Bad Request',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' }
              }
            }
          }
        }
      }
    },
    '/tasks/{id}': {
      get: {
        operationId: 'getTaskById',
        summary: 'Get task by ID',
        tags: ['tasks'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          }
        ],
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Task' }
              }
            }
          },
          '404': {
            description: 'Not Found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' }
              }
            }
          }
        }
      }
    }
  },
  components: {
    schemas: {
      Task: {
        type: 'object',
        required: ['id', 'title', 'status', 'createdAt'],
        properties: {
          id: {
            type: 'string',
            description: 'Task ID'
          },
          title: {
            type: 'string',
            description: 'Task title',
            minLength: 1,
            maxLength: 100
          },
          description: {
            type: 'string',
            description: 'Task description'
          },
          status: {
            type: 'string',
            enum: ['pending', 'completed'],
            description: 'Task status'
          },
          priority: {
            type: 'number',
            minimum: 1,
            maximum: 5,
            description: 'Task priority'
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Creation timestamp'
          },
          assignee: {
            $ref: '#/components/schemas/User'
          }
        }
      },
      NewTask: {
        type: 'object',
        required: ['title', 'status'],
        properties: {
          title: {
            type: 'string',
            minLength: 1
          },
          description: {
            type: 'string'
          },
          status: {
            type: 'string',
            enum: ['pending', 'completed']
          },
          priority: {
            type: 'number',
            minimum: 1,
            maximum: 5
          }
        }
      },
      User: {
        type: 'object',
        required: ['id', 'email'],
        properties: {
          id: {
            type: 'string'
          },
          name: {
            type: 'string'
          },
          email: {
            type: 'string',
            format: 'email'
          }
        }
      },
      ErrorResponse: {
        type: 'object',
        required: ['error', 'message'],
        properties: {
          error: {
            type: 'string'
          },
          message: {
            type: 'string'
          }
        }
      }
    }
  }
};

describe('E2E: HTTP Client Runtime', () => {
  let server: http.Server;
  let tempDir: string;
  let receivedHeaders: Record<string, string> = {};

  // Cast spec to any to avoid strict TypeScript typing issues with inline specs
  const spec: any = taskApiSpec;

  beforeAll((done) => {
    // Create mock HTTP server
    server = http.createServer((req, res) => {
      const url = new URL(req.url!, `http://localhost:${TEST_PORT}`);

      // Capture headers
      receivedHeaders = {};
      Object.keys(req.headers).forEach(key => {
        receivedHeaders[key] = req.headers[key] as string;
      });

      // Set CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      // Handle preflight
      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      // GET /tasks
      if (req.method === 'GET' && url.pathname === '/tasks') {
        const status = url.searchParams.get('status');
        const tasks = status
          ? mockTasksData.filter(t => t.status === status)
          : mockTasksData;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(tasks));
        return;
      }

      // POST /tasks
      if (req.method === 'POST' && url.pathname === '/tasks') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const newTask = JSON.parse(body);

            // Validate required fields
            if (!newTask.title || !newTask.status) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                error: 'ValidationError',
                message: 'Missing required fields: title, status'
              }));
              return;
            }

            const createdTask = {
              id: 'task-' + Date.now(),
              ...newTask,
              createdAt: new Date().toISOString(),
              assignee: newTask.assignee || null
            };

            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(createdTask));
          } catch (error) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              error: 'InvalidJSON',
              message: 'Request body is not valid JSON'
            }));
          }
        });
        return;
      }

      // GET /tasks/{id}
      if (req.method === 'GET' && url.pathname.startsWith('/tasks/')) {
        const id = url.pathname.split('/')[2];
        const task = mockTasksData.find(t => t.id === id);

        if (task) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(task));
        } else {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            error: 'NotFound',
            message: `Task with id ${id} not found`
          }));
        }
        return;
      }

      // 404 for unknown routes
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'NotFound', message: 'Route not found' }));
    });

    server.on('error', (err) => {
      console.error('Server error:', err);
      done(err);
    });

    server.listen(TEST_PORT, '127.0.0.1', () => {
      console.log(`Mock server listening on 127.0.0.1:${TEST_PORT}`);
      done();
    });
  });

  afterAll((done) => {
    if (server && server.listening) {
      server.close(done);
    } else {
      done();
    }
  });

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'klasik-e2e-http-'));
    receivedHeaders = {};
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Code Generation', () => {
    it('should generate models and APIs from OpenAPI spec', async () => {
      // Parse OpenAPI spec
      const parser = new OpenAPIParser();
      const ir = parser.parse(spec, { includeOperations: true });

      // Verify IR
      expect(ir.operations.size).toBe(3); // listTasks, createTask, getTaskById
      expect(ir.schemas.size).toBe(4); // Task, NewTask, User, ErrorResponse

      // Generate code
      const generator = new Generator({
        outputDir: tempDir,
        mode: 'full',
        esm: false,
        classValidator: true,
        nestJsSwagger: false,
        parameterStyle: 'positional',
      });

      await generator.generate(ir);

      // Verify files exist
      expect(fs.existsSync(path.join(tempDir, 'models', 'task.ts'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, 'models', 'new-task.ts'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, 'models', 'user.ts'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, 'models', 'error-response.ts'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, 'apis', 'tasks-api.ts'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, 'configuration.ts'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, 'base.ts'))).toBe(true);
    });

    it('should generate Task model with proper decorators', async () => {
      // Parse and generate
      const parser = new OpenAPIParser();
      const ir = parser.parse(spec, { includeOperations: true });

      const generator = new Generator({
        outputDir: tempDir,
        mode: 'full',
        esm: false,
        classValidator: true,
        nestJsSwagger: false,
        parameterStyle: 'positional',
      });

      await generator.generate(ir);

      const taskContent = fs.readFileSync(
        path.join(tempDir, 'models', 'task.ts'),
        'utf-8'
      );

      // Verify class exists
      expect(taskContent).toContain('export class Task');

      // Verify imports (class-transformer is automatically included when classValidator is true)
      const hasValidatorImport = taskContent.includes("class-validator") || taskContent.includes("@IsString") || taskContent.includes("@Min");
      const hasTransformerImport = taskContent.includes("class-transformer") || taskContent.includes("@Expose") || taskContent.includes("@Type");
      expect(hasValidatorImport || hasTransformerImport).toBe(true);

      // Verify properties exist
      expect(taskContent).toContain("id");
      expect(taskContent).toContain("title");
      expect(taskContent).toContain("status");
      expect(taskContent).toContain("assignee");
    });

    it('should compile generated TypeScript code', async () => {
      // Parse and generate
      const parser = new OpenAPIParser();
      const ir = parser.parse(spec, { includeOperations: true });

      const generator = new Generator({
        outputDir: tempDir,
        mode: 'full',
        esm: false,
        classValidator: true,
        nestJsSwagger: false,
        parameterStyle: 'positional',
      });

      await generator.generate(ir);

      // Verify tsconfig exists
      const tsconfigPath = path.join(tempDir, 'tsconfig.json');
      expect(fs.existsSync(tsconfigPath)).toBe(true);

      // Verify files can be read and have valid structure
      const taskFilePath = path.join(tempDir, 'models', 'task.ts');
      const taskFile = fs.readFileSync(taskFilePath, 'utf-8');
      expect(taskFile).toContain('export class Task');
    }, 60000);
  });

  describe('HTTP Requests', () => {
    it('should fetch tasks array and transform to class instances', async () => {
      try {
        // Generate code
        const parser = new OpenAPIParser();
        const ir = parser.parse(spec, { includeOperations: true });

        const generator = new Generator({
          outputDir: tempDir,
          mode: 'full',
          esm: false,
          classValidator: true,
          nestJsSwagger: false
        });

        await generator.generate(ir);

        // Create a symlink to node_modules so generated files can resolve dependencies
        const nodeModulesLink = path.join(tempDir, 'node_modules');
        const projectNodeModules = path.join(process.cwd(), 'node_modules');
        if (!fs.existsSync(nodeModulesLink)) {
          fs.symlinkSync(projectNodeModules, nodeModulesLink, 'dir');
        }

        // Import generated TypeScript files directly (Jest handles TS compilation)
        const TaskModule = require(path.join(tempDir, 'models', 'task.ts'));
        const UserModule = require(path.join(tempDir, 'models', 'user.ts'));
        const TasksApiModule = require(path.join(tempDir, 'apis', 'tasks-api.ts'));
        const ConfigurationModule = require(path.join(tempDir, 'configuration.ts'));

        const Task = TaskModule.Task;
        const User = UserModule.User;
        const TasksApi = TasksApiModule.TasksApi;
        const Configuration = ConfigurationModule.Configuration;

        // Create API client
        const config = new Configuration({
          basePath: `http://localhost:${TEST_PORT}`,
          enableResponseTransformation: true
        });
        const api = new TasksApi(config, axios.create());

        // Make request - response is automatically transformed by the generated client
        const response = await api.listTasks();

        // Verify response status
        expect(response.status).toBe(200);
        expect(response.data).toHaveLength(3);

        // Verify automatic transformation to class instances (via plainToInstance in generated code)
        expect(response.data[0]).toBeInstanceOf(Task);
        expect((response.data[0] as any).id).toBe('task-1');
        expect((response.data[0] as any).title).toBe('Implement feature X');
        expect((response.data[0] as any).status).toBe('pending');

        // Verify nested transformation works (Task → User)
        expect((response.data[0] as any).assignee).toBeInstanceOf(User);
        expect((response.data[0] as any).assignee.email).toBe('alice@example.com');

        // Verify validation decorators work on transformed instances
        // With @IsDateString, ISO 8601 date strings should validate correctly
        const errors = await validate(response.data[0] as object);
        expect(errors.length).toBe(0);
      } catch (error) {
        console.error('Test failed:', error);
        throw error;
      }
    }, 120000);

    it('should filter tasks by status using query parameters', async () => {
      // Generate code
      const parser = new OpenAPIParser();
      const ir = parser.parse(spec, { includeOperations: true });

      const generator = new Generator({
        outputDir: tempDir,
        mode: 'full',
        esm: false,
        classValidator: true,
        nestJsSwagger: false,
        parameterStyle: 'positional',
      });

      await generator.generate(ir);

      // Create a symlink to node_modules so generated files can resolve dependencies
      const nodeModulesLink = path.join(tempDir, 'node_modules');
      const projectNodeModules = path.join(process.cwd(), 'node_modules');
      if (!fs.existsSync(nodeModulesLink)) {
        fs.symlinkSync(projectNodeModules, nodeModulesLink, 'dir');
      }

      // Import generated TypeScript files directly (Jest handles TS compilation)
      const TaskModule = require(path.join(tempDir, 'models', 'task.ts'));
      const TasksApiModule = require(path.join(tempDir, 'apis', 'tasks-api.ts'));
      const ConfigurationModule = require(path.join(tempDir, 'configuration.ts'));

      const Task = TaskModule.Task;
      const TasksApi = TasksApiModule.TasksApi;
      const Configuration = ConfigurationModule.Configuration;

      // Create API client
      const config = new Configuration({
        basePath: `http://localhost:${TEST_PORT}`
      });
      const api = new TasksApi(config, axios.create());

      // Make request with query parameter - automatically transformed
      const response = await api.listTasks('completed');

      expect(response.status).toBe(200);
      expect(response.data).toHaveLength(1);
      expect(response.data[0].id).toBe('task-2');
      expect(response.data[0].status).toBe('completed');

      // Verify automatic transformation
      expect(response.data[0]).toBeInstanceOf(Task);
    }, 120000);

    it('should create new task with request body', async () => {
      // Generate code
      const parser = new OpenAPIParser();
      const ir = parser.parse(spec, { includeOperations: true });

      const generator = new Generator({
        outputDir: tempDir,
        mode: 'full',
        esm: false,
        classValidator: true,
        nestJsSwagger: false,
        parameterStyle: 'positional',
      });

      await generator.generate(ir);

      // Create a symlink to node_modules so generated files can resolve dependencies
      const nodeModulesLink = path.join(tempDir, 'node_modules');
      const projectNodeModules = path.join(process.cwd(), 'node_modules');
      if (!fs.existsSync(nodeModulesLink)) {
        fs.symlinkSync(projectNodeModules, nodeModulesLink, 'dir');
      }

      // Import generated TypeScript files directly (Jest handles TS compilation)
      const TaskModule = require(path.join(tempDir, 'models', 'task.ts'));
      const TasksApiModule = require(path.join(tempDir, 'apis', 'tasks-api.ts'));
      const ConfigurationModule = require(path.join(tempDir, 'configuration.ts'));

      const Task = TaskModule.Task;
      const TasksApi = TasksApiModule.TasksApi;
      const Configuration = ConfigurationModule.Configuration;

      // Create API client
      const config = new Configuration({
        basePath: `http://localhost:${TEST_PORT}`
      });
      const api = new TasksApi(config, axios.create());

      // Make POST request
      const newTask = {
        title: 'New test task',
        description: 'Testing POST endpoint',
        status: 'pending',
        priority: 2
      };

      const response = await api.createTask(newTask);

      expect(response.status).toBe(201);
      expect(response.data.title).toBe('New test task');
      expect(response.data.id).toMatch(/^task-/);
      expect(response.data.createdAt).toBeDefined();

      // Verify automatic transformation
      expect(response.data).toBeInstanceOf(Task);
      expect((response.data as any).title).toBe('New test task');
      expect((response.data as any).priority).toBe(2);
    }, 120000);

    it('should get single task by ID using path parameter', async () => {
      // Generate code
      const parser = new OpenAPIParser();
      const ir = parser.parse(spec, { includeOperations: true });

      const generator = new Generator({
        outputDir: tempDir,
        mode: 'full',
        esm: false,
        classValidator: true,
        nestJsSwagger: false,
        parameterStyle: 'positional',
      });

      await generator.generate(ir);

      // Create a symlink to node_modules so generated files can resolve dependencies
      const nodeModulesLink = path.join(tempDir, 'node_modules');
      const projectNodeModules = path.join(process.cwd(), 'node_modules');
      if (!fs.existsSync(nodeModulesLink)) {
        fs.symlinkSync(projectNodeModules, nodeModulesLink, 'dir');
      }

      // Import generated TypeScript files directly (Jest handles TS compilation)
      const TaskModule = require(path.join(tempDir, 'models', 'task.ts'));
      const UserModule = require(path.join(tempDir, 'models', 'user.ts'));
      const TasksApiModule = require(path.join(tempDir, 'apis', 'tasks-api.ts'));
      const ConfigurationModule = require(path.join(tempDir, 'configuration.ts'));

      const Task = TaskModule.Task;
      const User = UserModule.User;
      const TasksApi = TasksApiModule.TasksApi;
      const Configuration = ConfigurationModule.Configuration;

      // Create API client
      const config = new Configuration({
        basePath: `http://localhost:${TEST_PORT}`
      });
      const api = new TasksApi(config, axios.create());

      // Make GET request with path parameter - automatically transformed
      const response = await api.getTaskById('task-1');

      expect(response.status).toBe(200);
      expect(response.data.id).toBe('task-1');
      expect(response.data.title).toBe('Implement feature X');

      // Verify automatic transformation
      expect(response.data).toBeInstanceOf(Task);
      expect((response.data as any).assignee).toBeInstanceOf(User);
    }, 120000);
  });

  describe('Error Handling', () => {
    it('should handle 404 error gracefully', async () => {
      // Generate code
      const parser = new OpenAPIParser();
      const ir = parser.parse(spec, { includeOperations: true });

      const generator = new Generator({
        outputDir: tempDir,
        mode: 'full',
        esm: false,
        classValidator: true,
        nestJsSwagger: false,
        parameterStyle: 'positional',
      });

      await generator.generate(ir);

      // Create a symlink to node_modules so generated files can resolve dependencies
      const nodeModulesLink = path.join(tempDir, 'node_modules');
      const projectNodeModules = path.join(process.cwd(), 'node_modules');
      if (!fs.existsSync(nodeModulesLink)) {
        fs.symlinkSync(projectNodeModules, nodeModulesLink, 'dir');
      }

      // Import generated TypeScript files directly (Jest handles TS compilation)
      const TasksApiModule = require(path.join(tempDir, 'apis', 'tasks-api.ts'));
      const ConfigurationModule = require(path.join(tempDir, 'configuration.ts'));
      const ErrorResponseModule = require(path.join(tempDir, 'models', 'error-response.ts'));

      const TasksApi = TasksApiModule.TasksApi;
      const Configuration = ConfigurationModule.Configuration;
      const ErrorResponse = ErrorResponseModule.ErrorResponse;

      // Create API client
      const config = new Configuration({
        basePath: `http://localhost:${TEST_PORT}`
      });
      const api = new TasksApi(config, axios.create());

      // Make request for non-existent task
      try {
        await api.getTaskById('non-existent-id');
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response.status).toBe(404);
        expect(error.response.data.error).toBe('NotFound');
        expect(error.response.data.message).toContain('not found');

        // Transform error response
        const errorObj = plainToInstance(ErrorResponse, error.response.data);
        expect(errorObj).toBeInstanceOf(ErrorResponse);
      }
    }, 120000);

    it('should handle validation error (400) when creating task without required fields', async () => {
      // Generate code
      const parser = new OpenAPIParser();
      const ir = parser.parse(spec, { includeOperations: true });

      const generator = new Generator({
        outputDir: tempDir,
        mode: 'full',
        esm: false,
        classValidator: true,
        nestJsSwagger: false,
        parameterStyle: 'positional',
      });

      await generator.generate(ir);

      // Create a symlink to node_modules so generated files can resolve dependencies
      const nodeModulesLink = path.join(tempDir, 'node_modules');
      const projectNodeModules = path.join(process.cwd(), 'node_modules');
      if (!fs.existsSync(nodeModulesLink)) {
        fs.symlinkSync(projectNodeModules, nodeModulesLink, 'dir');
      }

      // Import generated TypeScript files directly (Jest handles TS compilation)
      const TasksApiModule = require(path.join(tempDir, 'apis', 'tasks-api.ts'));
      const ConfigurationModule = require(path.join(tempDir, 'configuration.ts'));

      const TasksApi = TasksApiModule.TasksApi;
      const Configuration = ConfigurationModule.Configuration;

      // Create API client
      const config = new Configuration({
        basePath: `http://localhost:${TEST_PORT}`
      });
      const api = new TasksApi(config, axios.create());

      // Make invalid request
      const invalidTask = {
        description: 'Missing title and status'
      };

      try {
        await api.createTask(invalidTask as any);
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response.status).toBe(400);
        expect(error.response.data.error).toBe('ValidationError');
        expect(error.response.data.message).toContain('required fields');
      }
    }, 120000);

    it('should throw RequiredError when required path parameter is missing', async () => {
      // Generate code
      const parser = new OpenAPIParser();
      const ir = parser.parse(spec, { includeOperations: true });

      const generator = new Generator({
        outputDir: tempDir,
        mode: 'full',
        esm: false,
        classValidator: true,
        nestJsSwagger: false,
        parameterStyle: 'positional',
      });

      await generator.generate(ir);

      // Create a symlink to node_modules so generated files can resolve dependencies
      const nodeModulesLink = path.join(tempDir, 'node_modules');
      const projectNodeModules = path.join(process.cwd(), 'node_modules');
      if (!fs.existsSync(nodeModulesLink)) {
        fs.symlinkSync(projectNodeModules, nodeModulesLink, 'dir');
      }

      // Import generated TypeScript files directly (Jest handles TS compilation)
      const TasksApiModule = require(path.join(tempDir, 'apis', 'tasks-api.ts'));
      const ConfigurationModule = require(path.join(tempDir, 'configuration.ts'));
      const BaseModule = require(path.join(tempDir, 'base.ts'));

      const TasksApi = TasksApiModule.TasksApi;
      const Configuration = ConfigurationModule.Configuration;
      const RequiredError = BaseModule.RequiredError;

      // Create API client
      const config = new Configuration({
        basePath: `http://localhost:${TEST_PORT}`
      });
      const api = new TasksApi(config, axios.create());

      // Call with null parameter
      await expect(
        api.getTaskById(null as any)
      ).rejects.toThrow();

      try {
        await api.getTaskById(null as any);
      } catch (error: any) {
        expect(error).toBeInstanceOf(RequiredError);
        expect(error.message).toContain('id');
      }
    }, 120000);
  });

  describe('Class Transformation', () => {
    it('should validate transformed instances using class-validator', async () => {
      // Generate code
      const parser = new OpenAPIParser();
      const ir = parser.parse(spec, { includeOperations: true });

      const generator = new Generator({
        outputDir: tempDir,
        mode: 'full',
        esm: false,
        classValidator: true,
        nestJsSwagger: false,
        parameterStyle: 'positional',
      });

      await generator.generate(ir);

      // Create a symlink to node_modules so generated files can resolve dependencies
      const nodeModulesLink = path.join(tempDir, 'node_modules');
      const projectNodeModules = path.join(process.cwd(), 'node_modules');
      if (!fs.existsSync(nodeModulesLink)) {
        fs.symlinkSync(projectNodeModules, nodeModulesLink, 'dir');
      }

      // Import generated TypeScript files directly (Jest handles TS compilation)
      const TaskModule = require(path.join(tempDir, 'models', 'task.ts'));
      const Task = TaskModule.Task;

      // Create invalid task (title too long)
      const invalidData = {
        id: 'task-x',
        title: 'x'.repeat(101), // exceeds maxLength: 100
        status: 'pending',
        createdAt: '2026-01-12T10:00:00Z'
      };

      const task = plainToInstance(Task, invalidData);
      const errors = await validate(task as object);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.property === 'title')).toBe(true);

      // Create valid task (all required fields)
      const validData = {
        id: 'task-y',
        title: 'Valid title',
        status: 'pending',
        createdAt: '2026-01-12T10:00:00Z'
      };

      const validTask = plainToInstance(Task, validData);
      const validErrors = await validate(validTask as object);
      // May have some errors due to optional fields, but should have fewer errors
      expect(validErrors.length).toBeLessThan(errors.length);
    }, 120000);

    it('should apply custom headers from configuration', async () => {
      // Generate code
      const parser = new OpenAPIParser();
      const ir = parser.parse(spec, { includeOperations: true });

      const generator = new Generator({
        outputDir: tempDir,
        mode: 'full',
        esm: false,
        classValidator: true,
        nestJsSwagger: false,
        parameterStyle: 'positional',
      });

      await generator.generate(ir);

      // Create a symlink to node_modules so generated files can resolve dependencies
      const nodeModulesLink = path.join(tempDir, 'node_modules');
      const projectNodeModules = path.join(process.cwd(), 'node_modules');
      if (!fs.existsSync(nodeModulesLink)) {
        fs.symlinkSync(projectNodeModules, nodeModulesLink, 'dir');
      }

      // Import generated TypeScript files directly (Jest handles TS compilation)
      const TasksApiModule = require(path.join(tempDir, 'apis', 'tasks-api.ts'));
      const ConfigurationModule = require(path.join(tempDir, 'configuration.ts'));

      const TasksApi = TasksApiModule.TasksApi;
      const Configuration = ConfigurationModule.Configuration;

      // Create API client with custom headers
      const config = new Configuration({
        basePath: `http://localhost:${TEST_PORT}`,
        headers: {
          'X-API-Key': 'test-key-123',
          'X-Client-Version': '1.0.0'
        }
      });
      const api = new TasksApi(config, axios.create());

      // Make request
      await api.listTasks();

      // Verify headers were sent
      expect(receivedHeaders['x-api-key']).toBe('test-key-123');
      expect(receivedHeaders['x-client-version']).toBe('1.0.0');
    }, 120000);
  });

  describe('Request and Response Validation', () => {
    it('should validate successful API response when enableResponseValidation=true', async () => {
      // Generate code with classValidator enabled
      const parser = new OpenAPIParser();
      const ir = parser.parse(spec, { includeOperations: true });

      const generator = new Generator({
        outputDir: tempDir,
        mode: 'full',
        esm: false,
        classValidator: true,
        nestJsSwagger: false,
        parameterStyle: 'positional',
      });

      await generator.generate(ir);

      // Create symlink
      const nodeModulesLink = path.join(tempDir, 'node_modules');
      const projectNodeModules = path.join(process.cwd(), 'node_modules');
      if (!fs.existsSync(nodeModulesLink)) {
        fs.symlinkSync(projectNodeModules, nodeModulesLink, 'dir');
      }

      // Import generated code
      const TaskModule = require(path.join(tempDir, 'models', 'task.ts'));
      const TasksApiModule = require(path.join(tempDir, 'apis', 'tasks-api.ts'));
      const ConfigurationModule = require(path.join(tempDir, 'configuration.ts'));

      const Task = TaskModule.Task;
      const TasksApi = TasksApiModule.TasksApi;
      const Configuration = ConfigurationModule.Configuration;

      // Create API client with validation enabled
      const config = new Configuration({
        basePath: `http://localhost:${TEST_PORT}`,
        enableResponseTransformation: true,
        enableResponseValidation: true
      });
      const api = new TasksApi(config, axios.create());

      // Make request - should complete without errors since mock data is valid
      const response = await api.listTasks();

      expect(response.status).toBe(200);
      expect(response.data).toBeInstanceOf(Array);
      expect(response.data.length).toBeGreaterThan(0);
      expect(response.data[0]).toBeInstanceOf(Task);
    }, 120000);

    it('should call onResponseValidationError callback when validation fails', async () => {
      // Create a spec with a field that will have invalid data in the response
      const invalidDataSpec = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/items': {
            get: {
              operationId: 'listItems',
              tags: ['items'],
              responses: {
                '200': {
                  description: 'OK',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/Item' }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        components: {
          schemas: {
            Item: {
              type: 'object',
              required: ['id', 'email'],
              properties: {
                id: { type: 'string' },
                // email format validation will fail when given a non-email string
                email: { type: 'string', format: 'email' }
              }
            }
          }
        }
      };

      // Create a mock server that returns invalid data
      const invalidServer = http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        // Return items with invalid email format
        res.end(JSON.stringify([
          { id: '1', email: 'not-an-email' },
          { id: '2', email: 'also-invalid' }
        ]));
      });

      const INVALID_PORT = TEST_PORT + 1;
      await new Promise<void>((resolve) => invalidServer.listen(INVALID_PORT, resolve));

      try {
        // Generate code
        const parser = new OpenAPIParser();
        const ir = parser.parse(invalidDataSpec, { includeOperations: true });

        const generator = new Generator({
          outputDir: tempDir,
          mode: 'full',
          esm: false,
          classValidator: true,
          nestJsSwagger: false
        });

        await generator.generate(ir);

        // Create symlink
        const nodeModulesLink = path.join(tempDir, 'node_modules');
        const projectNodeModules = path.join(process.cwd(), 'node_modules');
        if (!fs.existsSync(nodeModulesLink)) {
          fs.symlinkSync(projectNodeModules, nodeModulesLink, 'dir');
        }

        // Import generated code
        const ItemsApiModule = require(path.join(tempDir, 'apis', 'items-api.ts'));
        const ConfigurationModule = require(path.join(tempDir, 'configuration.ts'));

        const ItemsApi = ItemsApiModule.ItemsApi;
        const Configuration = ConfigurationModule.Configuration;

        const errorCallback = jest.fn();

        // Create API client with validation and error callback
        const config = new Configuration({
          basePath: `http://localhost:${INVALID_PORT}`,
          enableResponseTransformation: true,
          enableResponseValidation: true,
          onResponseValidationError: errorCallback
        });
        const api = new ItemsApi(config, axios.create());

        // Make request - validation should fail due to invalid email format
        await api.listItems();

        // Callback should be called once for each item (2 items with email validation errors)
        expect(errorCallback).toHaveBeenCalled();
        expect(errorCallback).toHaveBeenCalledTimes(2);

        // Verify error structure for first call
        const firstCall = errorCallback.mock.calls[0];
        expect(firstCall[0]).toBeInstanceOf(Array); // errors array
        expect(firstCall[0].length).toBeGreaterThan(0);
        expect(firstCall[0][0].property).toBe('email');
        expect(firstCall[0][0].constraints).toHaveProperty('isEmail');
      } finally {
        await new Promise<void>((resolve) => invalidServer.close(() => resolve()));
      }
    }, 120000);

    it('should skip validation when enableResponseValidation=false (default)', async () => {
      // Generate code
      const parser = new OpenAPIParser();
      const ir = parser.parse(spec, { includeOperations: true });

      const generator = new Generator({
        outputDir: tempDir,
        mode: 'full',
        esm: false,
        classValidator: true,
        nestJsSwagger: false,
        parameterStyle: 'positional',
      });

      await generator.generate(ir);

      // Create symlink
      const nodeModulesLink = path.join(tempDir, 'node_modules');
      const projectNodeModules = path.join(process.cwd(), 'node_modules');
      if (!fs.existsSync(nodeModulesLink)) {
        fs.symlinkSync(projectNodeModules, nodeModulesLink, 'dir');
      }

      // Import generated code
      const TaskModule = require(path.join(tempDir, 'models', 'task.ts'));
      const TasksApiModule = require(path.join(tempDir, 'apis', 'tasks-api.ts'));
      const ConfigurationModule = require(path.join(tempDir, 'configuration.ts'));

      const Task = TaskModule.Task;
      const TasksApi = TasksApiModule.TasksApi;
      const Configuration = ConfigurationModule.Configuration;

      // Create API client WITHOUT validation enabled (default is false)
      const config = new Configuration({
        basePath: `http://localhost:${TEST_PORT}`,
        enableResponseTransformation: true,
        enableResponseValidation: false
      });
      const api = new TasksApi(config, axios.create());

      // Make request - should work fine without validation
      const response = await api.listTasks();

      expect(response.status).toBe(200);
      expect(response.data).toBeInstanceOf(Array);
      expect(response.data[0]).toBeInstanceOf(Task);
    }, 120000);

    it('should skip validation when enableResponseTransformation=false', async () => {
      // Generate code
      const parser = new OpenAPIParser();
      const ir = parser.parse(spec, { includeOperations: true });

      const generator = new Generator({
        outputDir: tempDir,
        mode: 'full',
        esm: false,
        classValidator: true,
        nestJsSwagger: false,
        parameterStyle: 'positional',
      });

      await generator.generate(ir);

      // Create symlink
      const nodeModulesLink = path.join(tempDir, 'node_modules');
      const projectNodeModules = path.join(process.cwd(), 'node_modules');
      if (!fs.existsSync(nodeModulesLink)) {
        fs.symlinkSync(projectNodeModules, nodeModulesLink, 'dir');
      }

      // Import generated code
      const TasksApiModule = require(path.join(tempDir, 'apis', 'tasks-api.ts'));
      const ConfigurationModule = require(path.join(tempDir, 'configuration.ts'));

      const TasksApi = TasksApiModule.TasksApi;
      const Configuration = ConfigurationModule.Configuration;

      // Create API client with transformation disabled
      const config = new Configuration({
        basePath: `http://localhost:${TEST_PORT}`,
        enableResponseTransformation: false,
        enableResponseValidation: true  // Won't run because transformation is disabled
      });
      const api = new TasksApi(config, axios.create());

      // Make request - validation is skipped
      const response = await api.listTasks();

      expect(response.status).toBe(200);
      expect(response.data).toBeInstanceOf(Array);
      // Data is NOT transformed, so it's plain objects
      expect(response.data[0].constructor.name).toBe('Object');
    }, 120000);

    it('should validate request body when enableRequestValidation=true', async () => {
      // Generate code
      const parser = new OpenAPIParser();
      const ir = parser.parse(spec, { includeOperations: true });

      const generator = new Generator({
        outputDir: tempDir,
        mode: 'full',
        esm: false,
        classValidator: true,
        nestJsSwagger: false,
        parameterStyle: 'positional',
      });

      await generator.generate(ir);

      // Create symlink
      const nodeModulesLink = path.join(tempDir, 'node_modules');
      const projectNodeModules = path.join(process.cwd(), 'node_modules');
      if (!fs.existsSync(nodeModulesLink)) {
        fs.symlinkSync(projectNodeModules, nodeModulesLink, 'dir');
      }

      // Import generated code
      const NewTaskModule = require(path.join(tempDir, 'models', 'new-task.ts'));
      const TasksApiModule = require(path.join(tempDir, 'apis', 'tasks-api.ts'));
      const ConfigurationModule = require(path.join(tempDir, 'configuration.ts'));

      const NewTask = NewTaskModule.NewTask;
      const TasksApi = TasksApiModule.TasksApi;
      const Configuration = ConfigurationModule.Configuration;

      // Create API client with request validation enabled
      const config = new Configuration({
        basePath: `http://localhost:${TEST_PORT}`,
        enableRequestValidation: true
      });
      const api = new TasksApi(config, axios.create());

      // Create a valid request body instance
      const newTask = new NewTask();
      newTask.title = 'Test Task';
      newTask.status = 'pending';

      // Make request - should succeed with valid instance
      const response = await api.createTask(newTask);

      expect(response.status).toBe(201);
      expect(response.data.title).toBe('Test Task');
    }, 120000);

    it('should throw error when request body is not an instance', async () => {
      // Generate code
      const parser = new OpenAPIParser();
      const ir = parser.parse(spec, { includeOperations: true });

      const generator = new Generator({
        outputDir: tempDir,
        mode: 'full',
        esm: false,
        classValidator: true,
        nestJsSwagger: false,
        parameterStyle: 'positional',
      });

      await generator.generate(ir);

      // Create symlink
      const nodeModulesLink = path.join(tempDir, 'node_modules');
      const projectNodeModules = path.join(process.cwd(), 'node_modules');
      if (!fs.existsSync(nodeModulesLink)) {
        fs.symlinkSync(projectNodeModules, nodeModulesLink, 'dir');
      }

      // Import generated code
      const TasksApiModule = require(path.join(tempDir, 'apis', 'tasks-api.ts'));
      const ConfigurationModule = require(path.join(tempDir, 'configuration.ts'));

      const TasksApi = TasksApiModule.TasksApi;
      const Configuration = ConfigurationModule.Configuration;

      // Create API client with request validation enabled
      const config = new Configuration({
        basePath: `http://localhost:${TEST_PORT}`,
        enableRequestValidation: true
      });
      const api = new TasksApi(config, axios.create());

      // Try to create task with plain object (not instance)
      const plainObject = {
        title: 'Test Task',
        status: 'pending'
      };

      // Should throw error because it's not an instance
      await expect(api.createTask(plainObject as any)).rejects.toThrow(/must be an instance/);
    }, 120000);

    it('should skip request validation when enableRequestValidation=false (default)', async () => {
      // Generate code
      const parser = new OpenAPIParser();
      const ir = parser.parse(spec, { includeOperations: true });

      const generator = new Generator({
        outputDir: tempDir,
        mode: 'full',
        esm: false,
        classValidator: true,
        nestJsSwagger: false,
        parameterStyle: 'positional',
      });

      await generator.generate(ir);

      // Create symlink
      const nodeModulesLink = path.join(tempDir, 'node_modules');
      const projectNodeModules = path.join(process.cwd(), 'node_modules');
      if (!fs.existsSync(nodeModulesLink)) {
        fs.symlinkSync(projectNodeModules, nodeModulesLink, 'dir');
      }

      // Import generated code
      const TasksApiModule = require(path.join(tempDir, 'apis', 'tasks-api.ts'));
      const ConfigurationModule = require(path.join(tempDir, 'configuration.ts'));

      const TasksApi = TasksApiModule.TasksApi;
      const Configuration = ConfigurationModule.Configuration;

      // Create API client WITHOUT request validation (default is false)
      const config = new Configuration({
        basePath: `http://localhost:${TEST_PORT}`,
        enableRequestValidation: false
      });
      const api = new TasksApi(config, axios.create());

      // Plain object should work fine without validation
      const plainObject = {
        title: 'Test Task',
        status: 'pending'
      };

      const response = await api.createTask(plainObject as any);

      expect(response.status).toBe(201);
    }, 120000);
  });
});
