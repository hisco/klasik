/**
 * E2E tests for external $ref resolution and inlining
 *
 * Tests the full pipeline:
 * 1. Load spec with external refs
 * 2. Resolve and download refs
 * 3. Inline refs into spec
 * 4. Generate code from resolved spec
 */

import axios from 'axios';
import { SpecLoader } from '../loaders/spec-loader';
import { OpenAPIParser } from '../parsers/openapi-parser';
import { Generator } from '../generator/generator';
import * as fs from 'fs';
import * as path from 'path';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const TEST_OUTPUT_DIR = path.join(__dirname, '../../test-output/ref-resolution');

describe('E2E: External $ref Resolution', () => {
  beforeAll(() => {
    // Clean test output directory
    if (fs.existsSync(TEST_OUTPUT_DIR)) {
      fs.rmSync(TEST_OUTPUT_DIR, { recursive: true });
    }
    fs.mkdirSync(TEST_OUTPUT_DIR, { recursive: true });
  });

  afterAll(() => {
    // Clean up test output
    if (fs.existsSync(TEST_OUTPUT_DIR)) {
      fs.rmSync(TEST_OUTPUT_DIR, { recursive: true });
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('basic ref resolution', () => {
    it('should resolve single external ref from remote server', async () => {
      const baseUrl = 'https://api.example.com';

      mockedAxios.get.mockImplementation((url: string) => {
        if (url === `${baseUrl}/spec.yaml`) {
          return Promise.resolve({
            data: `
openapi: 3.0.0
info:
  title: Pet Store API
  version: 1.0.0
paths:
  /pets:
    get:
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                $ref: '${baseUrl}/schemas/Pet.yaml'
`,
          });
        }
        if (url === `${baseUrl}/schemas/Pet.yaml`) {
          return Promise.resolve({
            data: `
type: object
properties:
  id:
    type: integer
  name:
    type: string
  status:
    type: string
required:
  - id
  - name
`,
          });
        }
        return Promise.reject(new Error('Not found'));
      });

      // Load spec with refs resolved
      const loader = new SpecLoader();
      const spec = await loader.loadWithRefs({
        url: `${baseUrl}/spec.yaml`,
        resolveRefs: true,
      });

      // Verify ref was inlined
      const responseSchema =
        spec.paths['/pets'].get.responses['200'].content['application/json']
          .schema;
      expect(responseSchema).toEqual({
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
          status: { type: 'string' },
        },
        required: ['id', 'name'],
      });

      // Verify no external refs remain
      expect(responseSchema.$ref).toBeUndefined();
    });

    it('should resolve multiple external refs', async () => {
      const baseUrl = 'https://api.example.com';

      mockedAxios.get.mockImplementation((url: string) => {
        if (url === `${baseUrl}/spec.yaml`) {
          return Promise.resolve({
            data: `
openapi: 3.0.0
info:
  title: Pet Store API
  version: 1.0.0
components:
  schemas:
    Pet:
      $ref: '${baseUrl}/schemas/Pet.yaml'
    User:
      $ref: '${baseUrl}/schemas/User.yaml'
`,
          });
        }
        if (url === `${baseUrl}/schemas/Pet.yaml`) {
          return Promise.resolve({
            data: `
type: object
properties:
  name:
    type: string
`,
          });
        }
        if (url === `${baseUrl}/schemas/User.yaml`) {
          return Promise.resolve({
            data: `
type: object
properties:
  email:
    type: string
`,
          });
        }
        return Promise.reject(new Error('Not found'));
      });

      const loader = new SpecLoader();
      const spec = await loader.loadWithRefs({
        url: `${baseUrl}/spec.yaml`,
        resolveRefs: true,
      });

      // Verify both refs were inlined
      expect(spec.components.schemas.Pet).toEqual({
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
      });

      expect(spec.components.schemas.User).toEqual({
        type: 'object',
        properties: {
          email: { type: 'string' },
        },
      });
    });
  });

  describe('nested ref resolution', () => {
    it('should resolve nested refs (3 levels deep)', async () => {
      const baseUrl = 'https://api.example.com';

      mockedAxios.get.mockImplementation((url: string) => {
        if (url === `${baseUrl}/spec.yaml`) {
          return Promise.resolve({
            data: `
openapi: 3.0.0
info:
  title: Test API
  version: 1.0.0
components:
  schemas:
    Pet:
      $ref: '${baseUrl}/schemas/Pet.yaml'
`,
          });
        }
        if (url === `${baseUrl}/schemas/Pet.yaml`) {
          return Promise.resolve({
            data: `
type: object
properties:
  name:
    type: string
  owner:
    $ref: '${baseUrl}/schemas/Owner.yaml'
`,
          });
        }
        if (url === `${baseUrl}/schemas/Owner.yaml`) {
          return Promise.resolve({
            data: `
type: object
properties:
  name:
    type: string
  address:
    $ref: '${baseUrl}/schemas/Address.yaml'
`,
          });
        }
        if (url === `${baseUrl}/schemas/Address.yaml`) {
          return Promise.resolve({
            data: `
type: object
properties:
  street:
    type: string
  city:
    type: string
`,
          });
        }
        return Promise.reject(new Error('Not found'));
      });

      const loader = new SpecLoader();
      const spec = await loader.loadWithRefs({
        url: `${baseUrl}/spec.yaml`,
        resolveRefs: true,
      });

      // Verify all nested refs were inlined
      expect(spec.components.schemas.Pet).toEqual({
        type: 'object',
        properties: {
          name: { type: 'string' },
          owner: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              address: {
                type: 'object',
                properties: {
                  street: { type: 'string' },
                  city: { type: 'string' },
                },
              },
            },
          },
        },
      });
    });

    it('should handle refs with fragments', async () => {
      const baseUrl = 'https://api.example.com';

      mockedAxios.get.mockImplementation((url: string) => {
        if (url === `${baseUrl}/spec.yaml`) {
          return Promise.resolve({
            data: `
openapi: 3.0.0
info:
  title: Test API
  version: 1.0.0
components:
  schemas:
    Pet:
      $ref: '${baseUrl}/schemas/common.yaml#/definitions/Pet'
    User:
      $ref: '${baseUrl}/schemas/common.yaml#/definitions/User'
`,
          });
        }
        if (url === `${baseUrl}/schemas/common.yaml`) {
          return Promise.resolve({
            data: `
definitions:
  Pet:
    type: object
    properties:
      name:
        type: string
  User:
    type: object
    properties:
      email:
        type: string
`,
          });
        }
        return Promise.reject(new Error('Not found'));
      });

      const loader = new SpecLoader();
      const spec = await loader.loadWithRefs({
        url: `${baseUrl}/spec.yaml`,
        resolveRefs: true,
      });

      // Verify fragments were resolved correctly
      expect(spec.components.schemas.Pet).toEqual({
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
      });

      expect(spec.components.schemas.User).toEqual({
        type: 'object',
        properties: {
          email: { type: 'string' },
        },
      });
    });
  });

  describe('auth headers', () => {
    it('should pass auth headers to all ref requests', async () => {
      const baseUrl = 'https://api.example.com';
      const authToken = 'Bearer secret-token';

      mockedAxios.get.mockImplementation((url: string, config: any) => {
        // Verify auth header is present
        expect(config.headers.Authorization).toBe(authToken);

        if (url === `${baseUrl}/spec.yaml`) {
          return Promise.resolve({
            data: `
openapi: 3.0.0
info:
  title: Test API
  version: 1.0.0
components:
  schemas:
    Pet:
      $ref: '${baseUrl}/schemas/Pet.yaml'
`,
          });
        }
        if (url === `${baseUrl}/schemas/Pet.yaml`) {
          return Promise.resolve({
            data: `
type: object
properties:
  name:
    type: string
`,
          });
        }
        return Promise.reject(new Error('Not found'));
      });

      const loader = new SpecLoader();
      const spec = await loader.loadWithRefs({
        url: `${baseUrl}/spec.yaml`,
        resolveRefs: true,
        headers: {
          Authorization: authToken,
        },
      });

      // Verify ref was inlined (which means both requests succeeded with auth)
      expect(spec.components.schemas.Pet).toEqual({
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
      });
    });
  });

  describe('code generation from resolved spec', () => {
    it('should generate code from spec with resolved refs', async () => {
      const baseUrl = 'https://api.example.com';

      mockedAxios.get.mockImplementation((url: string) => {
        if (url === `${baseUrl}/spec.yaml`) {
          return Promise.resolve({
            data: `
openapi: 3.0.0
info:
  title: Pet Store API
  version: 1.0.0
components:
  schemas:
    Pet:
      $ref: '${baseUrl}/schemas/Pet.yaml'
`,
          });
        }
        if (url === `${baseUrl}/schemas/Pet.yaml`) {
          return Promise.resolve({
            data: `
type: object
properties:
  id:
    type: integer
  name:
    type: string
  status:
    type: string
    enum:
      - available
      - pending
      - sold
required:
  - id
  - name
`,
          });
        }
        return Promise.reject(new Error('Not found'));
      });

      // Load and resolve refs
      const loader = new SpecLoader();
      const spec = await loader.loadWithRefs({
        url: `${baseUrl}/spec.yaml`,
        resolveRefs: true,
      });

      // Parse to IR
      const parser = new OpenAPIParser();
      const ir = parser.parse(spec);

      // Generate code
      const outputDir = path.join(TEST_OUTPUT_DIR, 'generated-from-refs');
      const generator = new Generator({ outputDir });
      await generator.generate(ir);

      // Verify generated file exists
      const petFilePath = path.join(outputDir, 'models', 'pet.ts');
      expect(fs.existsSync(petFilePath)).toBe(true);

      // Verify generated code content
      const petCode = fs.readFileSync(petFilePath, 'utf-8');
      expect(petCode).toContain('export class Pet');
      expect(petCode).toContain('id');
      expect(petCode).toContain('name');
      expect(petCode).toContain('status');
    });

    it('should generate code from spec with nested refs', async () => {
      const baseUrl = 'https://api.example.com';

      mockedAxios.get.mockImplementation((url: string) => {
        if (url === `${baseUrl}/spec.yaml`) {
          return Promise.resolve({
            data: `
openapi: 3.0.0
info:
  title: Test API
  version: 1.0.0
components:
  schemas:
    Pet:
      $ref: '${baseUrl}/schemas/Pet.yaml'
`,
          });
        }
        if (url === `${baseUrl}/schemas/Pet.yaml`) {
          return Promise.resolve({
            data: `
type: object
properties:
  id:
    type: integer
  name:
    type: string
  owner:
    $ref: '${baseUrl}/schemas/Owner.yaml'
`,
          });
        }
        if (url === `${baseUrl}/schemas/Owner.yaml`) {
          return Promise.resolve({
            data: `
type: object
properties:
  id:
    type: integer
  name:
    type: string
  email:
    type: string
`,
          });
        }
        return Promise.reject(new Error('Not found'));
      });

      // Load and resolve refs
      const loader = new SpecLoader();
      const spec = await loader.loadWithRefs({
        url: `${baseUrl}/spec.yaml`,
        resolveRefs: true,
      });

      // Parse to IR
      const parser = new OpenAPIParser();
      const ir = parser.parse(spec);

      // Generate code
      const outputDir = path.join(TEST_OUTPUT_DIR, 'generated-nested-refs');
      const generator = new Generator({ outputDir });
      await generator.generate(ir);

      // Verify Pet file exists
      const petFilePath = path.join(outputDir, 'models', 'pet.ts');
      expect(fs.existsSync(petFilePath)).toBe(true);

      // Verify generated code has nested structure
      const petCode = fs.readFileSync(petFilePath, 'utf-8');
      expect(petCode).toContain('export class Pet');
      expect(petCode).toContain('owner');
    });
  });

  describe('error handling', () => {
    it('should handle 404 for missing ref', async () => {
      const baseUrl = 'https://api.example.com';

      mockedAxios.get.mockImplementation((url: string) => {
        if (url === `${baseUrl}/spec.yaml`) {
          return Promise.resolve({
            data: `
openapi: 3.0.0
info:
  title: Test API
  version: 1.0.0
components:
  schemas:
    Pet:
      $ref: '${baseUrl}/schemas/Pet.yaml'
`,
          });
        }
        if (url === `${baseUrl}/schemas/Pet.yaml`) {
          const error: any = new Error('Request failed with status code 404');
          error.isAxiosError = true;
          error.response = {
            status: 404,
            statusText: 'Not Found',
          };
          return Promise.reject(error);
        }
        return Promise.reject(new Error('Not found'));
      });
      mockedAxios.isAxiosError.mockReturnValue(true);

      const loader = new SpecLoader();

      await expect(
        loader.loadWithRefs({
          url: `${baseUrl}/spec.yaml`,
          resolveRefs: true,
        })
      ).rejects.toThrow();
    });

    it('should handle network timeout', async () => {
      const baseUrl = 'https://api.example.com';

      mockedAxios.get.mockImplementation((url: string) => {
        if (url === `${baseUrl}/spec.yaml`) {
          return Promise.resolve({
            data: `
openapi: 3.0.0
info:
  title: Test API
  version: 1.0.0
components:
  schemas:
    Pet:
      $ref: '${baseUrl}/schemas/Pet.yaml'
`,
          });
        }
        if (url === `${baseUrl}/schemas/Pet.yaml`) {
          const error: any = new Error('timeout of 100ms exceeded');
          error.isAxiosError = true;
          error.code = 'ECONNABORTED';
          return Promise.reject(error);
        }
        return Promise.reject(new Error('Not found'));
      });
      mockedAxios.isAxiosError.mockReturnValue(true);

      const loader = new SpecLoader();

      await expect(
        loader.loadWithRefs({
          url: `${baseUrl}/spec.yaml`,
          resolveRefs: true,
          timeout: 100,
        })
      ).rejects.toThrow();
    });
  });

  describe('internal refs preservation', () => {
    it('should preserve internal refs while inlining external refs', async () => {
      const baseUrl = 'https://api.example.com';

      mockedAxios.get.mockImplementation((url: string) => {
        if (url === `${baseUrl}/spec.yaml`) {
          return Promise.resolve({
            data: `
openapi: 3.0.0
info:
  title: Test API
  version: 1.0.0
components:
  schemas:
    Pet:
      $ref: '${baseUrl}/schemas/Pet.yaml'
    User:
      type: object
      properties:
        id:
          type: integer
        pet:
          $ref: '#/components/schemas/Pet'
`,
          });
        }
        if (url === `${baseUrl}/schemas/Pet.yaml`) {
          return Promise.resolve({
            data: `
type: object
properties:
  name:
    type: string
`,
          });
        }
        return Promise.reject(new Error('Not found'));
      });

      const loader = new SpecLoader();
      const spec = await loader.loadWithRefs({
        url: `${baseUrl}/spec.yaml`,
        resolveRefs: true,
      });

      // External ref should be inlined
      expect(spec.components.schemas.Pet).toEqual({
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
      });

      // Internal ref should be preserved
      expect(spec.components.schemas.User.properties.pet).toEqual({
        $ref: '#/components/schemas/Pet',
      });
    });
  });
});
