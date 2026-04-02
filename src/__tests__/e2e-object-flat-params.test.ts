/**
 * E2E Tests for Object-Flat Parameter Style
 *
 * Tests all 4 signature patterns:
 * 1. Params + body: (params, requestBody, options)
 * 2. Body only: (requestBody, options)
 * 3. Params only: (params, options)
 * 4. Neither: (options)
 */

import { Generator } from '../generator/generator';
import { OpenAPIParser } from '../parsers/openapi-parser';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { robustRemoveDir } from './test-helpers/cleanup-utils';

describe('E2E: Object-Flat Parameter Style', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'klasik-object-flat-'));
  });

  afterEach(async () => {
    if (fs.existsSync(tempDir)) {
      await robustRemoveDir(tempDir, { silent: true });
    }
  });

  describe('Pattern 1: Params + Body', () => {
    it('should generate method with params object and separate requestBody', async () => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/users/{userId}/posts': {
            post: {
              operationId: 'createUserPost',
              summary: 'Create a post for a user',
              tags: ['posts'],
              parameters: [
                {
                  name: 'userId',
                  in: 'path' as const,
                  required: true,
                  schema: { type: 'string' },
                },
                {
                  name: 'X-API-Key',
                  in: 'header' as const,
                  required: true,
                  schema: { type: 'string' },
                },
                {
                  name: 'notify',
                  in: 'query' as const,
                  required: false,
                  schema: { type: 'boolean' },
                },
              ],
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/CreatePost' },
                  },
                },
              },
              responses: {
                '201': {
                  description: 'Created',
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/Post' },
                    },
                  },
                },
              },
            },
          },
        },
        components: {
          schemas: {
            CreatePost: {
              type: 'object',
              required: ['title'],
              properties: {
                title: { type: 'string' },
                content: { type: 'string' },
              },
            },
            Post: {
              type: 'object',
              required: ['id', 'title'],
              properties: {
                id: { type: 'string' },
                title: { type: 'string' },
                content: { type: 'string' },
              },
            },
          },
        },
      };

      const parser = new OpenAPIParser();
      const ir = parser.parse(spec, { includeOperations: true });

      const generator = new Generator({
        outputDir: tempDir,
        mode: 'full',
        esm: false,
        parameterStyle: 'object-flat',
      });

      await generator.generate(ir);

      const apiContent = fs.readFileSync(
        path.join(tempDir, 'apis', 'posts-api.ts'),
        'utf-8'
      );

      // Verify parameter interface exists
      expect(apiContent).toContain('export interface CreateUserPostParams');
      expect(apiContent).toContain('userId: string');
      expect(apiContent).toContain('xApiKey: string');
      expect(apiContent).toContain('notify?: boolean');

      // Verify interface does NOT contain requestBody
      const interfaceMatch = apiContent.match(/export interface CreateUserPostParams\s*\{[^}]+\}/s);
      expect(interfaceMatch).toBeTruthy();
      expect(interfaceMatch![0]).not.toContain('requestBody');

      // Verify method signature: params, requestBody, options
      expect(apiContent).toContain('async createUserPost(');
      expect(apiContent).toContain('params: CreateUserPostParams');
      expect(apiContent).toContain('requestBody: CreatePost');
      expect(apiContent).toContain('options?: RawAxiosRequestConfig');

      // Verify parameter extraction
      expect(apiContent).toContain('const { userId, xApiKey, notify } = params || {};');

      // Verify file header comment
      expect(apiContent).toContain('Parameter style: object-flat');
    });

    it('should handle optional request body in params+body pattern', async () => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/items/{id}': {
            patch: {
              operationId: 'updateItem',
              tags: ['items'],
              parameters: [
                {
                  name: 'id',
                  in: 'path' as const,
                  required: true,
                  schema: { type: 'string' },
                },
              ],
              requestBody: {
                required: false, // Optional body
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/ItemUpdate' },
                  },
                },
              },
              responses: {
                '200': {
                  description: 'Success',
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/Item' },
                    },
                  },
                },
              },
            },
          },
        },
        components: {
          schemas: {
            ItemUpdate: {
              type: 'object',
              properties: {
                name: { type: 'string' },
              },
            },
            Item: {
              type: 'object',
              required: ['id'],
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
              },
            },
          },
        },
      };

      const parser = new OpenAPIParser();
      const ir = parser.parse(spec, { includeOperations: true });

      const generator = new Generator({
        outputDir: tempDir,
        mode: 'full',
        esm: false,
        parameterStyle: 'object-flat',
      });

      await generator.generate(ir);

      const apiContent = fs.readFileSync(
        path.join(tempDir, 'apis', 'items-api.ts'),
        'utf-8'
      );

      // Verify optional requestBody parameter
      expect(apiContent).toContain('requestBody?: ItemUpdate');
    });
  });

  describe('Pattern 2: Body Only', () => {
    it('should generate method with only requestBody (no params object)', async () => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/posts': {
            post: {
              operationId: 'createPost',
              summary: 'Create a post',
              tags: ['posts'],
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/CreatePost' },
                  },
                },
              },
              responses: {
                '201': {
                  description: 'Created',
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/Post' },
                    },
                  },
                },
              },
            },
          },
        },
        components: {
          schemas: {
            CreatePost: {
              type: 'object',
              required: ['title'],
              properties: {
                title: { type: 'string' },
                content: { type: 'string' },
              },
            },
            Post: {
              type: 'object',
              required: ['id', 'title'],
              properties: {
                id: { type: 'string' },
                title: { type: 'string' },
                content: { type: 'string' },
              },
            },
          },
        },
      };

      const parser = new OpenAPIParser();
      const ir = parser.parse(spec, { includeOperations: true });

      const generator = new Generator({
        outputDir: tempDir,
        mode: 'full',
        esm: false,
        parameterStyle: 'object-flat',
      });

      await generator.generate(ir);

      const apiContent = fs.readFileSync(
        path.join(tempDir, 'apis', 'posts-api.ts'),
        'utf-8'
      );

      // Verify NO params interface
      expect(apiContent).not.toContain('export interface CreatePostParams');

      // Verify method signature: requestBody, options (no params)
      expect(apiContent).toContain('async createPost(');
      expect(apiContent).toContain('requestBody: CreatePost');
      expect(apiContent).toContain('options?: RawAxiosRequestConfig');

      // Verify method signature does NOT have params parameter
      const methodMatch = apiContent.match(/async createPost\([^)]+\)/);
      expect(methodMatch).toBeTruthy();
      expect(methodMatch![0]).not.toContain('params:');

      // Verify NO parameter extraction
      expect(apiContent).not.toContain('const { ');
    });
  });

  describe('Pattern 3: Params Only', () => {
    it('should generate method with only params object (no requestBody)', async () => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/users/{userId}': {
            get: {
              operationId: 'getUser',
              summary: 'Get user by ID',
              tags: ['users'],
              parameters: [
                {
                  name: 'userId',
                  in: 'path' as const,
                  required: true,
                  schema: { type: 'string' },
                },
                {
                  name: 'include',
                  in: 'query' as const,
                  required: false,
                  schema: { type: 'string' },
                },
              ],
              responses: {
                '200': {
                  description: 'Success',
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/User' },
                    },
                  },
                },
              },
            },
          },
        },
        components: {
          schemas: {
            User: {
              type: 'object',
              required: ['id'],
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
              },
            },
          },
        },
      };

      const parser = new OpenAPIParser();
      const ir = parser.parse(spec, { includeOperations: true });

      const generator = new Generator({
        outputDir: tempDir,
        mode: 'full',
        esm: false,
        parameterStyle: 'object-flat',
      });

      await generator.generate(ir);

      const apiContent = fs.readFileSync(
        path.join(tempDir, 'apis', 'users-api.ts'),
        'utf-8'
      );

      // Verify params interface exists
      expect(apiContent).toContain('export interface GetUserParams');
      expect(apiContent).toContain('userId: string');
      expect(apiContent).toContain('include?: string');

      // Verify method signature: params, options (no requestBody)
      expect(apiContent).toContain('async getUser(');
      expect(apiContent).toContain('params: GetUserParams');
      expect(apiContent).toContain('options?: RawAxiosRequestConfig');

      // Verify method signature does NOT have requestBody
      const methodMatch = apiContent.match(/async getUser\([^)]+\)/);
      expect(methodMatch).toBeTruthy();
      expect(methodMatch![0]).not.toContain('requestBody');

      // Verify parameter extraction
      expect(apiContent).toContain('const { userId, include } = params || {};');
    });

    it('should make params optional when all parameters are optional', async () => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/tasks': {
            get: {
              operationId: 'listTasks',
              tags: ['tasks'],
              parameters: [
                {
                  name: 'status',
                  in: 'query' as const,
                  required: false,
                  schema: { type: 'string' },
                },
                {
                  name: 'limit',
                  in: 'query' as const,
                  required: false,
                  schema: { type: 'integer' },
                },
              ],
              responses: {
                '200': {
                  description: 'Success',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/Task' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        components: {
          schemas: {
            Task: {
              type: 'object',
              required: ['id'],
              properties: {
                id: { type: 'string' },
                title: { type: 'string' },
              },
            },
          },
        },
      };

      const parser = new OpenAPIParser();
      const ir = parser.parse(spec, { includeOperations: true });

      const generator = new Generator({
        outputDir: tempDir,
        mode: 'full',
        esm: false,
        parameterStyle: 'object-flat',
      });

      await generator.generate(ir);

      const apiContent = fs.readFileSync(
        path.join(tempDir, 'apis', 'tasks-api.ts'),
        'utf-8'
      );

      // Verify params parameter is optional
      expect(apiContent).toContain('params?: ListTasksParams');

      // Verify parameter extraction handles undefined
      expect(apiContent).toContain('const { status, limit } = params || {};');
    });
  });

  describe('Pattern 4: No Params or Body', () => {
    it('should generate method with only options parameter', async () => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/health': {
            get: {
              operationId: 'getHealth',
              summary: 'Health check',
              tags: ['system'],
              responses: {
                '200': {
                  description: 'Success',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          status: { type: 'string' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      };

      const parser = new OpenAPIParser();
      const ir = parser.parse(spec, { includeOperations: true });

      const generator = new Generator({
        outputDir: tempDir,
        mode: 'full',
        esm: false,
        parameterStyle: 'object-flat',
      });

      await generator.generate(ir);

      const apiContent = fs.readFileSync(
        path.join(tempDir, 'apis', 'system-api.ts'),
        'utf-8'
      );

      // Verify NO params interface
      expect(apiContent).not.toContain('export interface GetHealthParams');

      // Verify method signature: only options
      expect(apiContent).toContain('async getHealth(');
      expect(apiContent).toContain('options?: RawAxiosRequestConfig');

      // Verify method signature has ONLY options parameter
      const methodMatch = apiContent.match(/async getHealth\([^)]+\)/);
      expect(methodMatch).toBeTruthy();
      expect(methodMatch![0]).not.toContain('params');
      expect(methodMatch![0]).not.toContain('requestBody');

      // Verify NO parameter extraction
      expect(apiContent).not.toContain('const { ');
    });
  });

  describe('Collision Detection', () => {
    it('should throw error on parameter name collision', async () => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/users': {
            get: {
              operationId: 'getUsers',
              tags: ['users'],
              parameters: [
                {
                  name: 'user_id',
                  in: 'query' as const,
                  required: false,
                  schema: { type: 'string' },
                },
                {
                  name: 'userId', // Collision: both become "userId" in camelCase
                  in: 'header' as const,
                  required: false,
                  schema: { type: 'string' },
                },
              ],
              responses: {
                '200': { description: 'Success' },
              },
            },
          },
        },
      };

      const parser = new OpenAPIParser();
      const ir = parser.parse(spec, { includeOperations: true });

      const generator = new Generator({
        outputDir: tempDir,
        mode: 'full',
        esm: false,
        parameterStyle: 'object-flat',
      });

      // Should throw error due to collision
      await expect(generator.generate(ir)).rejects.toThrow(/collision/i);
      await expect(generator.generate(ir)).rejects.toThrow(/userId/);
      await expect(generator.generate(ir)).rejects.toThrow(/user_id/);
    });

    it('should provide helpful error message for collisions', async () => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/items': {
            get: {
              operationId: 'getItems',
              tags: ['items'],
              parameters: [
                {
                  name: 'filter-type',
                  in: 'query' as const,
                  required: false,
                  schema: { type: 'string' },
                },
                {
                  name: 'filterType',
                  in: 'header' as const,
                  required: false,
                  schema: { type: 'string' },
                },
              ],
              responses: {
                '200': { description: 'Success' },
              },
            },
          },
        },
      };

      const parser = new OpenAPIParser();
      const ir = parser.parse(spec, { includeOperations: true });

      const generator = new Generator({
        outputDir: tempDir,
        mode: 'full',
        esm: false,
        parameterStyle: 'object-flat',
      });

      try {
        await generator.generate(ir);
        fail('Should have thrown error');
      } catch (error: any) {
        // Verify error message includes helpful information
        expect(error.message).toContain('collision');
        expect(error.message).toContain('filter-type');
        expect(error.message).toContain('filterType');
        expect(error.message).toContain('Solutions');
        expect(error.message).toContain('--parameter-style positional');
      }
    });

    it('should NOT detect collision in positional style', async () => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/users': {
            get: {
              operationId: 'getUsers',
              tags: ['users'],
              parameters: [
                {
                  name: 'user_id',
                  in: 'query' as const,
                  required: false,
                  schema: { type: 'string' },
                },
                {
                  name: 'userId',
                  in: 'header' as const,
                  required: false,
                  schema: { type: 'string' },
                },
              ],
              responses: {
                '200': { description: 'Success' },
              },
            },
          },
        },
      };

      const parser = new OpenAPIParser();
      const ir = parser.parse(spec, { includeOperations: true });

      const generator = new Generator({
        outputDir: tempDir,
        mode: 'full',
        esm: false,
        parameterStyle: 'positional', // Positional style doesn't detect collisions
      });

      // Should NOT throw error
      await expect(generator.generate(ir)).resolves.not.toThrow();
    });
  });

  describe('File-Level Documentation', () => {
    it('should include parameter style in file header comment', async () => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/test': {
            get: {
              operationId: 'test',
              tags: ['test'],
              responses: { '200': { description: 'OK' } },
            },
          },
        },
      };

      const parser = new OpenAPIParser();
      const ir = parser.parse(spec, { includeOperations: true });

      const generator = new Generator({
        outputDir: tempDir,
        mode: 'full',
        esm: false,
        parameterStyle: 'object-flat',
      });

      await generator.generate(ir);

      const apiContent = fs.readFileSync(
        path.join(tempDir, 'apis', 'test-api.ts'),
        'utf-8'
      );

      // Verify file header comment
      expect(apiContent).toContain('Generated by Klasik');
      expect(apiContent).toContain('Parameter style: object-flat');
      expect(apiContent).toContain('Methods use named parameters for better ergonomics');
      expect(apiContent).toContain('Parameters (path, query, header) go in first object');
      expect(apiContent).toContain('Request body is second parameter (if present)');
      expect(apiContent).toContain('Options are always last');
    });
  });
});
