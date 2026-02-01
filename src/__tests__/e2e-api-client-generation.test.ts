/**
 * E2E Test for API Client Generation
 *
 * Tests the full pipeline: OpenAPI → IR → Models + APIs
 */

import { Generator } from '../generator/generator';
import { OpenAPIParser } from '../parsers/openapi-parser';
import { SchemaIR } from '../ir/types';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { robustRemoveDir } from './test-helpers/cleanup-utils';

describe('E2E: API Client Generation', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'klasik-e2e-api-'));
  });

  afterEach(async () => {
    if (fs.existsSync(tempDir)) {
      await robustRemoveDir(tempDir, { silent: true });
    }
  });

  describe('Full API Client Generation', () => {
    it('should generate models and APIs from Petstore OpenAPI spec', async () => {
      const petstoreSpec = {
        openapi: '3.0.0',
        info: {
          title: 'Petstore API',
          version: '1.0.0',
        },
        paths: {
          '/pets': {
            get: {
              operationId: 'listPets',
              summary: 'List all pets',
              tags: ['pets'],
              parameters: [
                {
                  name: 'limit',
                  in: 'query' as const,
                  description: 'Maximum number of pets to return',
                  required: false,
                  schema: {
                    type: 'integer',
                    format: 'int32',
                  },
                },
              ],
              responses: {
                '200': {
                  description: 'Success',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'array',
                        items: {
                          $ref: '#/components/schemas/Pet',
                        },
                      },
                    },
                  },
                },
              },
            },
            post: {
              operationId: 'createPet',
              summary: 'Create a pet',
              tags: ['pets'],
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      $ref: '#/components/schemas/NewPet',
                    },
                  },
                },
              },
              responses: {
                '201': {
                  description: 'Created',
                  content: {
                    'application/json': {
                      schema: {
                        $ref: '#/components/schemas/Pet',
                      },
                    },
                  },
                },
              },
            },
          },
          '/pets/{id}': {
            get: {
              operationId: 'getPetById',
              summary: 'Get a pet by ID',
              tags: ['pets'],
              parameters: [
                {
                  name: 'id',
                  in: 'path' as const,
                  description: 'Pet ID',
                  required: true,
                  schema: {
                    type: 'string',
                  },
                },
              ],
              responses: {
                '200': {
                  description: 'Success',
                  content: {
                    'application/json': {
                      schema: {
                        $ref: '#/components/schemas/Pet',
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
            Pet: {
              type: 'object',
              required: ['id', 'name'],
              properties: {
                id: {
                  type: 'string',
                  description: 'Pet ID',
                },
                name: {
                  type: 'string',
                  description: 'Pet name',
                },
                tag: {
                  type: 'string',
                  description: 'Pet tag',
                },
              },
            },
            NewPet: {
              type: 'object',
              required: ['name'],
              properties: {
                name: {
                  type: 'string',
                  description: 'Pet name',
                },
                tag: {
                  type: 'string',
                  description: 'Pet tag',
                },
              },
            },
          },
        },
      };

      // Parse OpenAPI
      const parser = new OpenAPIParser();
      const ir = parser.parse(petstoreSpec, { includeOperations: true });

      // Verify IR has operations
      expect(ir.operations.size).toBe(3);
      expect(ir.schemas.size).toBe(2);

      // Generate code
      const generator = new Generator({
        outputDir: tempDir,
        mode: 'full',
        esm: false,
      });

      await generator.generate(ir);

      // Verify generated files
      expect(fs.existsSync(path.join(tempDir, 'models'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, 'models', 'pet.ts'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, 'models', 'new-pet.ts'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, 'models', 'index.ts'))).toBe(true);

      expect(fs.existsSync(path.join(tempDir, 'apis'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, 'apis', 'pets-api.ts'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, 'apis', 'index.ts'))).toBe(true);

      expect(fs.existsSync(path.join(tempDir, 'base.ts'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, 'configuration.ts'))).toBe(true);
    });

    it('should verify API class structure', async () => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/users/{id}': {
            get: {
              operationId: 'getUser',
              summary: 'Get user by ID',
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
              required: ['id', 'name'],
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
      });

      await generator.generate(ir);

      const apiContent = fs.readFileSync(
        path.join(tempDir, 'apis', 'users-api.ts'),
        'utf-8'
      );

      // Verify imports
      expect(apiContent).toContain("import { AxiosInstance, AxiosResponse, RawAxiosRequestConfig } from 'axios'");
      expect(apiContent).toContain("import { Configuration } from '../configuration'");
      expect(apiContent).toContain("import { RequiredError } from '../base'");
      expect(apiContent).toContain("import { User } from '../models/user'");

      // Verify class structure
      expect(apiContent).toContain('export class UsersApi');
      expect(apiContent).toContain('protected configuration: Configuration');
      expect(apiContent).toContain('protected axios: AxiosInstance');
      expect(apiContent).toContain('constructor(configuration: Configuration, axios: AxiosInstance)');

      // Verify method signature
      expect(apiContent).toContain('async getUser(');
      expect(apiContent).toContain('id: string');
      expect(apiContent).toContain('options?: RawAxiosRequestConfig');
      expect(apiContent).toContain('Promise<AxiosResponse<User>>');

      // Verify method body
      expect(apiContent).toContain('if (id === null || id === undefined)');
      expect(apiContent).toContain('throw new RequiredError');
      expect(apiContent).toContain(".replace('{id}'");
      expect(apiContent).toContain('return this.axios.request(localVarRequestOptions)');
    });

    it('should verify TSDoc comments', async () => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/users': {
            post: {
              operationId: 'createUser',
              summary: 'Create a new user',
              description: 'Creates a new user in the system',
              tags: ['users'],
              requestBody: {
                description: 'User data',
                required: true,
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/User' },
                  },
                },
              },
              responses: {
                '201': {
                  description: 'Created',
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
              required: ['name'],
              properties: {
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
      });

      await generator.generate(ir);

      const apiContent = fs.readFileSync(
        path.join(tempDir, 'apis', 'users-api.ts'),
        'utf-8'
      );

      // Verify JSDoc comments
      expect(apiContent).toContain('Create a new user');
      expect(apiContent).toContain('Creates a new user in the system');
      expect(apiContent).toContain('@method POST');
      expect(apiContent).toContain('@param');
      expect(apiContent).toContain('@throws {RequiredError}');
      expect(apiContent).toContain('@returns');
    });

    it('should verify RequiredError validation', async () => {
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
      });

      await generator.generate(ir);

      const apiContent = fs.readFileSync(
        path.join(tempDir, 'apis', 'users-api.ts'),
        'utf-8'
      );

      expect(apiContent).toContain('if (id === null || id === undefined)');
      expect(apiContent).toContain("throw new RequiredError('id'");
    });

    it('should verify Configuration class', async () => {
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
      });

      await generator.generate(ir);

      const configContent = fs.readFileSync(
        path.join(tempDir, 'configuration.ts'),
        'utf-8'
      );

      expect(configContent).toContain('export class Configuration');
      expect(configContent).toContain('basePath: string');
      expect(configContent).toContain('headers: { [key: string]: string }');
      expect(configContent).toContain('timeout: number');
      expect(configContent).toContain('enableResponseTransformation: boolean');
      expect(configContent).toContain('onTransformationError?:');
    });

    it('should verify index exports', async () => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/users': {
            get: {
              operationId: 'listUsers',
              tags: ['users'],
              responses: { '200': { description: 'OK' } },
            },
          },
          '/pets': {
            get: {
              operationId: 'listPets',
              tags: ['pets'],
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
      });

      await generator.generate(ir);

      const indexContent = fs.readFileSync(
        path.join(tempDir, 'apis', 'index.ts'),
        'utf-8'
      );

      expect(indexContent).toContain("export * from './pets-api'");
      expect(indexContent).toContain("export * from './users-api'");
    });

    it('should support ESM mode', async () => {
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
        esm: true,
      });

      await generator.generate(ir);

      const apiContent = fs.readFileSync(
        path.join(tempDir, 'apis', 'test-api.ts'),
        'utf-8'
      );

      expect(apiContent).toContain('../configuration.js');
      expect(apiContent).toContain('../base.js');

      const indexContent = fs.readFileSync(
        path.join(tempDir, 'apis', 'index.ts'),
        'utf-8'
      );

      expect(indexContent).toContain('./test-api.js');
    });

    it('should skip API generation in models-only mode', async () => {
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
        components: {
          schemas: {
            User: {
              type: 'object',
              properties: {
                id: { type: 'string' },
              },
            },
          },
        },
      };

      const parser = new OpenAPIParser();
      const ir = parser.parse(spec, { includeOperations: true });

      const generator = new Generator({
        outputDir: tempDir,
        mode: 'models-only',
        esm: false,
      });

      await generator.generate(ir);

      // Models should be generated
      expect(fs.existsSync(path.join(tempDir, 'models', 'user.ts'))).toBe(true);

      // APIs should NOT be generated
      expect(fs.existsSync(path.join(tempDir, 'apis'))).toBe(false);
      expect(fs.existsSync(path.join(tempDir, 'base.ts'))).toBe(false);
      expect(fs.existsSync(path.join(tempDir, 'configuration.ts'))).toBe(false);
    });

    it('should include axios in package.json when generating API clients', async () => {
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
      });

      await generator.generate(ir);

      // Read generated package.json
      const packageJsonPath = path.join(tempDir, 'package.json');
      expect(fs.existsSync(packageJsonPath)).toBe(true);

      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

      // Verify axios is included
      expect(packageJson.dependencies).toBeDefined();
      expect(packageJson.dependencies.axios).toBeDefined();
      expect(packageJson.dependencies.axios).toBe('^1.6.0');
    });

    it('should not include axios in package.json in models-only mode', async () => {
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
        components: {
          schemas: {
            User: {
              type: 'object',
              properties: {
                id: { type: 'string' },
              },
            },
          },
        },
      };

      const parser = new OpenAPIParser();
      const ir = parser.parse(spec, { includeOperations: true });

      const generator = new Generator({
        outputDir: tempDir,
        mode: 'models-only',
        esm: false,
      });

      await generator.generate(ir);

      // Read generated package.json
      const packageJsonPath = path.join(tempDir, 'package.json');
      expect(fs.existsSync(packageJsonPath)).toBe(true);

      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

      // Verify axios is NOT included
      expect(packageJson.dependencies.axios).toBeUndefined();
    });
  });
});
