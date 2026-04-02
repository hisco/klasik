/**
 * E2E Advanced Tests for Object-Flat Parameter Style
 *
 * Tests edge cases, complex scenarios, and integration with other features
 */

import { Generator } from '../generator/generator';
import { OpenAPIParser } from '../parsers/openapi-parser';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { robustRemoveDir } from './test-helpers/cleanup-utils';

describe('E2E: Object-Flat Advanced Scenarios', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'klasik-obj-flat-adv-'));
  });

  afterEach(async () => {
    if (fs.existsSync(tempDir)) {
      await robustRemoveDir(tempDir, { silent: true });
    }
  });

  describe('HTTP Methods Coverage', () => {
    it('should handle all HTTP methods with object-flat style', async () => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/resources/{id}': {
            get: {
              operationId: 'getResource',
              tags: ['resources'],
              parameters: [
                {
                  name: 'id',
                  in: 'path' as const,
                  required: true,
                  schema: { type: 'string' },
                },
              ],
              responses: { '200': { description: 'Success' } },
            },
            post: {
              operationId: 'createResource',
              tags: ['resources'],
              parameters: [
                {
                  name: 'id',
                  in: 'path' as const,
                  required: true,
                  schema: { type: 'string' },
                },
              ],
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: { type: 'object', properties: { name: { type: 'string' } } },
                  },
                },
              },
              responses: { '201': { description: 'Created' } },
            },
            put: {
              operationId: 'updateResource',
              tags: ['resources'],
              parameters: [
                {
                  name: 'id',
                  in: 'path' as const,
                  required: true,
                  schema: { type: 'string' },
                },
              ],
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: { type: 'object', properties: { name: { type: 'string' } } },
                  },
                },
              },
              responses: { '200': { description: 'Updated' } },
            },
            patch: {
              operationId: 'patchResource',
              tags: ['resources'],
              parameters: [
                {
                  name: 'id',
                  in: 'path' as const,
                  required: true,
                  schema: { type: 'string' },
                },
              ],
              requestBody: {
                required: false,
                content: {
                  'application/json': {
                    schema: { type: 'object', properties: { name: { type: 'string' } } },
                  },
                },
              },
              responses: { '200': { description: 'Patched' } },
            },
            delete: {
              operationId: 'deleteResource',
              tags: ['resources'],
              parameters: [
                {
                  name: 'id',
                  in: 'path' as const,
                  required: true,
                  schema: { type: 'string' },
                },
              ],
              responses: { '204': { description: 'Deleted' } },
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
        path.join(tempDir, 'apis', 'resources-api.ts'),
        'utf-8'
      );

      // All methods should use object-flat style
      expect(apiContent).toContain('getResource(params: GetResourceParams');
      expect(apiContent).toContain('createResource(params: CreateResourceParams, requestBody:');
      expect(apiContent).toContain('updateResource(params: UpdateResourceParams, requestBody:');
      expect(apiContent).toContain('patchResource(params: PatchResourceParams, requestBody?:');
      expect(apiContent).toContain('deleteResource(params: DeleteResourceParams');
    });
  });

  describe('Complex Parameter Types', () => {
    it('should handle array parameters', async () => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/items': {
            get: {
              operationId: 'searchItems',
              tags: ['items'],
              parameters: [
                {
                  name: 'tags',
                  in: 'query' as const,
                  required: false,
                  schema: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                },
                {
                  name: 'ids',
                  in: 'query' as const,
                  required: false,
                  schema: {
                    type: 'array',
                    items: { type: 'integer' },
                  },
                },
              ],
              responses: { '200': { description: 'Success' } },
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

      // Verify array types in interface
      expect(apiContent).toContain('export interface SearchItemsParams');
      expect(apiContent).toContain('tags?: Array<string>');
      expect(apiContent).toContain('ids?: Array<number>');
    });

    it('should handle enum parameters', async () => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/orders': {
            get: {
              operationId: 'listOrders',
              tags: ['orders'],
              parameters: [
                {
                  name: 'status',
                  in: 'query' as const,
                  required: false,
                  schema: {
                    type: 'string',
                    enum: ['pending', 'completed', 'cancelled'],
                  },
                },
                {
                  name: 'priority',
                  in: 'query' as const,
                  required: false,
                  schema: {
                    type: 'integer',
                    enum: [1, 2, 3, 4, 5],
                  },
                },
              ],
              responses: { '200': { description: 'Success' } },
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
        path.join(tempDir, 'apis', 'orders-api.ts'),
        'utf-8'
      );

      // Verify enum handling
      expect(apiContent).toContain('export interface ListOrdersParams');
      expect(apiContent).toContain('status?:');
      expect(apiContent).toContain('priority?:');
    });
  });

  describe('Mixed Required and Optional Parameters', () => {
    it('should handle mix of required and optional params correctly', async () => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/users/{userId}/orders': {
            get: {
              operationId: 'getUserOrders',
              tags: ['orders'],
              parameters: [
                {
                  name: 'userId',
                  in: 'path' as const,
                  required: true,
                  schema: { type: 'string' },
                },
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
                {
                  name: 'X-API-Key',
                  in: 'header' as const,
                  required: true,
                  schema: { type: 'string' },
                },
              ],
              responses: { '200': { description: 'Success' } },
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
        path.join(tempDir, 'apis', 'orders-api.ts'),
        'utf-8'
      );

      // Verify interface has required and optional params
      expect(apiContent).toContain('export interface GetUserOrdersParams');
      expect(apiContent).toContain('userId: string'); // required
      expect(apiContent).toContain('status?: string'); // optional
      expect(apiContent).toContain('limit?: number'); // optional
      expect(apiContent).toContain('xApiKey: string'); // required

      // Params object should be required (has required params)
      expect(apiContent).toContain('params: GetUserOrdersParams');
      expect(apiContent).not.toContain('params?: GetUserOrdersParams');
    });
  });

  describe('Parameter Name Transformations', () => {
    it('should transform snake_case to camelCase', async () => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/data': {
            get: {
              operationId: 'getData',
              tags: ['data'],
              parameters: [
                {
                  name: 'user_id',
                  in: 'query' as const,
                  required: false,
                  schema: { type: 'string' },
                },
                {
                  name: 'created_at',
                  in: 'query' as const,
                  required: false,
                  schema: { type: 'string' },
                },
              ],
              responses: { '200': { description: 'Success' } },
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
        path.join(tempDir, 'apis', 'data-api.ts'),
        'utf-8'
      );

      // Verify camelCase transformation
      expect(apiContent).toContain('userId?: string');
      expect(apiContent).toContain('createdAt?: string');
      expect(apiContent).toContain('const { userId, createdAt } = params || {};');
    });

    it('should transform kebab-case to camelCase', async () => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/data': {
            get: {
              operationId: 'getData',
              tags: ['data'],
              parameters: [
                {
                  name: 'user-id',
                  in: 'query' as const,
                  required: false,
                  schema: { type: 'string' },
                },
                {
                  name: 'created-at',
                  in: 'query' as const,
                  required: false,
                  schema: { type: 'string' },
                },
              ],
              responses: { '200': { description: 'Success' } },
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
        path.join(tempDir, 'apis', 'data-api.ts'),
        'utf-8'
      );

      // Verify camelCase transformation
      expect(apiContent).toContain('userId?: string');
      expect(apiContent).toContain('createdAt?: string');
    });
  });

  describe('Integration with Other Features', () => {
    it('should work with ESM mode', async () => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/users/{id}': {
            get: {
              operationId: 'getUser',
              tags: ['users'],
              parameters: [
                {
                  name: 'id',
                  in: 'path' as const,
                  required: true,
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
        esm: true,
        parameterStyle: 'object-flat',
      });

      await generator.generate(ir);

      const apiContent = fs.readFileSync(
        path.join(tempDir, 'apis', 'users-api.ts'),
        'utf-8'
      );

      // Verify ESM imports
      expect(apiContent).toContain('../configuration.js');
      expect(apiContent).toContain('../base.js');
      expect(apiContent).toContain('../models/user.js');

      // Verify object-flat style still applied
      expect(apiContent).toContain('export interface GetUserParams');
      expect(apiContent).toContain('params: GetUserParams');
    });

    it('should work with fetch HTTP client', async () => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/items': {
            post: {
              operationId: 'createItem',
              tags: ['items'],
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: { type: 'object', properties: { name: { type: 'string' } } },
                  },
                },
              },
              responses: { '201': { description: 'Created' } },
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
        httpClient: 'fetch',
        parameterStyle: 'object-flat',
      });

      await generator.generate(ir);

      const apiContent = fs.readFileSync(
        path.join(tempDir, 'apis', 'items-api.ts'),
        'utf-8'
      );

      // Verify fetch client
      expect(apiContent).toContain('Partial<RequestConfig>');

      // Verify object-flat style (body-only pattern)
      expect(apiContent).toContain('async createItem(');
      expect(apiContent).toContain('requestBody:');
      expect(apiContent).not.toContain('export interface CreateItemParams');
    });

    it('should work with class-validator', async () => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/users/{id}': {
            get: {
              operationId: 'getUser',
              tags: ['users'],
              parameters: [
                {
                  name: 'id',
                  in: 'path' as const,
                  required: true,
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
        classValidator: true,
        parameterStyle: 'object-flat',
      });

      await generator.generate(ir);

      const apiContent = fs.readFileSync(
        path.join(tempDir, 'apis', 'users-api.ts'),
        'utf-8'
      );

      // Verify class-validator imports
      expect(apiContent).toContain("from 'class-validator'");

      // Verify object-flat style
      expect(apiContent).toContain('export interface GetUserParams');
      expect(apiContent).toContain('params: GetUserParams');
    });
  });

  describe('Multiple APIs in Same Spec', () => {
    it('should handle multiple tags/APIs with object-flat style', async () => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/users': {
            get: {
              operationId: 'listUsers',
              tags: ['users'],
              parameters: [
                {
                  name: 'limit',
                  in: 'query' as const,
                  required: false,
                  schema: { type: 'integer' },
                },
              ],
              responses: { '200': { description: 'Success' } },
            },
          },
          '/products': {
            get: {
              operationId: 'listProducts',
              tags: ['products'],
              parameters: [
                {
                  name: 'category',
                  in: 'query' as const,
                  required: false,
                  schema: { type: 'string' },
                },
              ],
              responses: { '200': { description: 'Success' } },
            },
          },
          '/orders': {
            post: {
              operationId: 'createOrder',
              tags: ['orders'],
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: { type: 'object', properties: { items: { type: 'array' } } },
                  },
                },
              },
              responses: { '201': { description: 'Created' } },
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

      // Verify all API files generated
      expect(fs.existsSync(path.join(tempDir, 'apis', 'users-api.ts'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, 'apis', 'products-api.ts'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, 'apis', 'orders-api.ts'))).toBe(true);

      // Verify each API uses object-flat style
      const usersApi = fs.readFileSync(path.join(tempDir, 'apis', 'users-api.ts'), 'utf-8');
      expect(usersApi).toContain('export interface ListUsersParams');
      expect(usersApi).toContain('Parameter style: object-flat');

      const productsApi = fs.readFileSync(path.join(tempDir, 'apis', 'products-api.ts'), 'utf-8');
      expect(productsApi).toContain('export interface ListProductsParams');

      const ordersApi = fs.readFileSync(path.join(tempDir, 'apis', 'orders-api.ts'), 'utf-8');
      expect(ordersApi).toContain('async createOrder(requestBody:');
      expect(ordersApi).not.toContain('export interface CreateOrderParams');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long parameter lists', async () => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/search': {
            get: {
              operationId: 'advancedSearch',
              tags: ['search'],
              parameters: [
                { name: 'query', in: 'query' as const, schema: { type: 'string' } },
                { name: 'field1', in: 'query' as const, schema: { type: 'string' } },
                { name: 'field2', in: 'query' as const, schema: { type: 'string' } },
                { name: 'field3', in: 'query' as const, schema: { type: 'string' } },
                { name: 'field4', in: 'query' as const, schema: { type: 'string' } },
                { name: 'field5', in: 'query' as const, schema: { type: 'string' } },
                { name: 'field6', in: 'query' as const, schema: { type: 'string' } },
                { name: 'field7', in: 'query' as const, schema: { type: 'string' } },
                { name: 'field8', in: 'query' as const, schema: { type: 'string' } },
                { name: 'field9', in: 'query' as const, schema: { type: 'string' } },
                { name: 'field10', in: 'query' as const, schema: { type: 'string' } },
              ],
              responses: { '200': { description: 'Success' } },
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
        path.join(tempDir, 'apis', 'search-api.ts'),
        'utf-8'
      );

      // Verify all parameters in interface
      expect(apiContent).toContain('export interface AdvancedSearchParams');
      expect(apiContent).toContain('query?:');
      expect(apiContent).toContain('field1?:');
      expect(apiContent).toContain('field10?:');

      // Verify destructuring
      expect(apiContent).toContain('const { query, field1, field2, field3, field4, field5, field6, field7, field8, field9, field10 } = params || {};');
    });

    it('should handle parameters with special characters in names', async () => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/data': {
            get: {
              operationId: 'getData',
              tags: ['data'],
              parameters: [
                {
                  name: 'x-request-id',
                  in: 'header' as const,
                  required: false,
                  schema: { type: 'string' },
                },
                {
                  name: 'X-API-Key',
                  in: 'header' as const,
                  required: true,
                  schema: { type: 'string' },
                },
              ],
              responses: { '200': { description: 'Success' } },
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
        path.join(tempDir, 'apis', 'data-api.ts'),
        'utf-8'
      );

      // Verify camelCase transformation of special chars
      expect(apiContent).toContain('xRequestId?:');
      expect(apiContent).toContain('xApiKey:');
    });
  });

  describe('Regression Tests', () => {
    it('should not break when switching from positional to object-flat', async () => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/items/{id}': {
            get: {
              operationId: 'getItem',
              tags: ['items'],
              parameters: [
                {
                  name: 'id',
                  in: 'path' as const,
                  required: true,
                  schema: { type: 'string' },
                },
              ],
              responses: { '200': { description: 'Success' } },
            },
          },
        },
      };

      const parser = new OpenAPIParser();
      const ir = parser.parse(spec, { includeOperations: true });

      // Generate with positional
      const positionalDir = path.join(tempDir, 'positional');
      const positionalGen = new Generator({
        outputDir: positionalDir,
        mode: 'full',
        esm: false,
        parameterStyle: 'positional',
      });
      await positionalGen.generate(ir);

      // Generate with object-flat
      const objectFlatDir = path.join(tempDir, 'object-flat');
      const objectFlatGen = new Generator({
        outputDir: objectFlatDir,
        mode: 'full',
        esm: false,
        parameterStyle: 'object-flat',
      });
      await objectFlatGen.generate(ir);

      // Both should generate successfully
      expect(fs.existsSync(path.join(positionalDir, 'apis', 'items-api.ts'))).toBe(true);
      expect(fs.existsSync(path.join(objectFlatDir, 'apis', 'items-api.ts'))).toBe(true);

      const positionalContent = fs.readFileSync(
        path.join(positionalDir, 'apis', 'items-api.ts'),
        'utf-8'
      );
      const objectFlatContent = fs.readFileSync(
        path.join(objectFlatDir, 'apis', 'items-api.ts'),
        'utf-8'
      );

      // Verify positional doesn't have params interface
      expect(positionalContent).not.toContain('export interface GetItemParams');
      expect(positionalContent).toContain('id: string');

      // Verify object-flat has params interface
      expect(objectFlatContent).toContain('export interface GetItemParams');
      expect(objectFlatContent).toContain('params: GetItemParams');
    });
  });
});
