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

  describe('deduplication with different relative paths', () => {
    it('should resolve same file referenced from different relative paths', async () => {
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
    Owner:
      $ref: '${baseUrl}/schemas/Owner.yaml'
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
    $ref: './Owner.yaml'
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
  email:
    type: string
`,
          });
        }
        return Promise.reject(new Error(`Not found: ${url}`));
      });

      const loader = new SpecLoader();
      const spec = await loader.loadWithRefs({
        url: `${baseUrl}/spec.yaml`,
        resolveRefs: true,
      });

      // Both refs should be inlined even though they resolve to the same URL
      expect(spec.components.schemas.Pet).toEqual({
        type: 'object',
        properties: {
          name: { type: 'string' },
          owner: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              email: { type: 'string' },
            },
          },
        },
      });

      expect(spec.components.schemas.Owner).toEqual({
        type: 'object',
        properties: {
          name: { type: 'string' },
          email: { type: 'string' },
        },
      });
    });

    it('should generate all models when same file is referenced via different paths', async () => {
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
    Order:
      type: object
      properties:
        id:
          type: integer
        customer:
          $ref: '${baseUrl}/schemas/Customer.yaml'
    Customer:
      $ref: '${baseUrl}/schemas/Customer.yaml'
`,
          });
        }
        if (url === `${baseUrl}/schemas/Customer.yaml`) {
          return Promise.resolve({
            data: `
type: object
properties:
  name:
    type: string
  email:
    type: string
required:
  - name
`,
          });
        }
        return Promise.reject(new Error(`Not found: ${url}`));
      });

      // Load and resolve
      const loader = new SpecLoader();
      const spec = await loader.loadWithRefs({
        url: `${baseUrl}/spec.yaml`,
        resolveRefs: true,
      });

      // Parse and generate
      const parser = new OpenAPIParser();
      const ir = parser.parse(spec);
      const outputDir = path.join(TEST_OUTPUT_DIR, 'dedup-refs');
      const generator = new Generator({ outputDir });
      await generator.generate(ir);

      // Verify both Order and Customer models exist
      const orderFile = path.join(outputDir, 'models', 'order.ts');
      expect(fs.existsSync(orderFile)).toBe(true);
      const orderCode = fs.readFileSync(orderFile, 'utf-8');
      expect(orderCode).toContain('export class Order');
      expect(orderCode).toContain('customer');
    });
  });

  describe('auth headers with nested refs', () => {
    it('should pass auth headers to all nested ref requests', async () => {
      const baseUrl = 'https://api.example.com';
      const authToken = 'Bearer secret-token-123';
      const requestUrls: string[] = [];

      mockedAxios.get.mockImplementation((url: string, config: any) => {
        requestUrls.push(url);
        // Verify auth header is present on EVERY request
        expect(config?.headers?.Authorization).toBe(authToken);

        if (url === `${baseUrl}/spec.yaml`) {
          return Promise.resolve({
            data: `
openapi: 3.0.0
info:
  title: Auth Test API
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
`,
          });
        }
        return Promise.reject(new Error(`Not found: ${url}`));
      });

      const loader = new SpecLoader();
      const spec = await loader.loadWithRefs({
        url: `${baseUrl}/spec.yaml`,
        resolveRefs: true,
        headers: { Authorization: authToken },
      });

      // All 3 URLs should have been fetched with auth
      expect(requestUrls).toContain(`${baseUrl}/spec.yaml`);
      expect(requestUrls).toContain(`${baseUrl}/schemas/Pet.yaml`);
      expect(requestUrls).toContain(`${baseUrl}/schemas/Owner.yaml`);

      // Verify full resolution worked
      expect(spec.components.schemas.Pet.properties.owner).toEqual({
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
      });
    });
  });

  describe('local file nested refs with fragments (customer reproduction)', () => {
    /**
     * Tests nested relative $ref between sibling schema files:
     * api/
     *   openapi.yaml          # $ref: './schemas/entity.yaml#/components/schemas/Entity'
     *   schemas/
     *     entity.yaml         # $ref: './metadata.yaml#/components/schemas/Metadata'
     *     metadata.yaml       # defines Metadata
     *
     * Previously failed: Cannot inline ref "./metadata.yaml#/...": not found in resolved refs
     */
    const tempDir = path.join(__dirname, '../../test-output/ref-resolution-local');

    beforeEach(() => {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true });
      }
      fs.mkdirSync(path.join(tempDir, 'api', 'schemas'), { recursive: true });
    });

    afterEach(() => {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true });
      }
    });

    it('should resolve nested relative refs between sibling schema files', async () => {
      fs.writeFileSync(path.join(tempDir, 'api', 'openapi.yaml'), `
openapi: 3.0.0
info:
  title: Platform API
  version: 1.0.0
components:
  schemas:
    Entity:
      $ref: './schemas/entity.yaml#/components/schemas/Entity'
    Metadata:
      $ref: './schemas/metadata.yaml#/components/schemas/Metadata'
`);

      // entity.yaml references sibling ./metadata.yaml#/...
      fs.writeFileSync(path.join(tempDir, 'api', 'schemas', 'entity.yaml'), `
components:
  schemas:
    Entity:
      type: object
      properties:
        name:
          type: string
        meta:
          $ref: './metadata.yaml#/components/schemas/Metadata'
      required:
        - name
`);

      fs.writeFileSync(path.join(tempDir, 'api', 'schemas', 'metadata.yaml'), `
components:
  schemas:
    Metadata:
      type: object
      properties:
        key:
          type: string
        value:
          type: string
        source:
          type: string
          enum:
            - manual
            - automated
            - imported
      required:
        - key
`);

      const specPath = path.join(tempDir, 'api', 'openapi.yaml');
      const loader = new SpecLoader();
      const spec = await loader.loadWithRefs({
        url: specPath,
        resolveRefs: true,
      });

      // Entity should be promoted to components/schemas with proper structure
      const entity = spec.components.schemas.Entity;
      expect(entity.type).toBe('object');
      expect(entity.properties.name.type).toBe('string');

      // The nested ref from entity.yaml → metadata.yaml should be promoted as internal $ref
      const meta = entity.properties.meta;
      expect(meta.$ref).toBe('#/components/schemas/Metadata');

      // Metadata should be promoted to components/schemas
      const metadata = spec.components.schemas.Metadata;
      expect(metadata.type).toBe('object');
      expect(metadata.properties.key.type).toBe('string');
      expect(metadata.properties.value.type).toBe('string');
      expect(metadata.properties.source.type).toBe('string');
      expect(metadata.properties.source.enum).toEqual(['manual', 'automated', 'imported']);
    });

    it('should generate models from local spec with nested refs and fragments', async () => {
      fs.writeFileSync(path.join(tempDir, 'api', 'openapi.yaml'), `
openapi: 3.0.0
info:
  title: Platform API
  version: 1.0.0
paths:
  /entities:
    get:
      operationId: listEntities
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Entity'
components:
  schemas:
    Entity:
      $ref: './schemas/entity.yaml#/components/schemas/Entity'
`);

      fs.writeFileSync(path.join(tempDir, 'api', 'schemas', 'entity.yaml'), `
components:
  schemas:
    Entity:
      type: object
      properties:
        name:
          type: string
        meta:
          $ref: './metadata.yaml#/components/schemas/Metadata'
      required:
        - name
`);

      fs.writeFileSync(path.join(tempDir, 'api', 'schemas', 'metadata.yaml'), `
components:
  schemas:
    Metadata:
      type: object
      properties:
        key:
          type: string
        value:
          type: string
      required:
        - key
`);

      const specPath = path.join(tempDir, 'api', 'openapi.yaml');
      const loader = new SpecLoader();
      const spec = await loader.loadWithRefs({
        url: specPath,
        resolveRefs: true,
      });

      // Parse and generate
      const parser = new OpenAPIParser();
      const ir = parser.parse(spec);
      const outputDir = path.join(tempDir, 'generated');
      const generator = new Generator({ outputDir });
      await generator.generate(ir);

      // Verify Entity model was generated
      const entityFile = path.join(outputDir, 'models', 'entity.ts');
      expect(fs.existsSync(entityFile)).toBe(true);
      const entityCode = fs.readFileSync(entityFile, 'utf-8');
      expect(entityCode).toContain('export class Entity');
      expect(entityCode).toContain('name');
      expect(entityCode).toContain('meta');
    });
  });

  describe('schema promotion from sub-files', () => {
    /**
     * Tests that schemas defined in sub-files are promoted to components/schemas
     * and generate standalone model files, not just inlined as raw content.
     */
    const tempDir = path.join(__dirname, '../../test-output/ref-resolution-promote');

    beforeEach(() => {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true });
      }
      fs.mkdirSync(path.join(tempDir, 'api', 'schemas'), { recursive: true });
    });

    afterEach(() => {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true });
      }
    });

    it('should promote sub-file schemas to standalone models', async () => {
      // Main spec defines some schemas directly, references others from sub-files
      fs.writeFileSync(path.join(tempDir, 'api', 'openapi.yaml'), `
openapi: 3.0.0
info:
  title: Platform API
  version: 1.0.0
paths:
  /projects:
    get:
      operationId: listProjects
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Project'
components:
  schemas:
    Project:
      type: object
      properties:
        id:
          type: string
          format: uuid
        name:
          type: string
        config:
          $ref: './schemas/config.yaml#/components/schemas/ProjectConfig'
      required:
        - id
        - name
    Status:
      type: object
      properties:
        code:
          type: integer
        message:
          type: string
`);

      // Sub-file defines ProjectConfig which references ResourceQuota
      fs.writeFileSync(path.join(tempDir, 'api', 'schemas', 'config.yaml'), `
components:
  schemas:
    ProjectConfig:
      type: object
      properties:
        region:
          type: string
        tier:
          type: string
          enum:
            - free
            - standard
            - enterprise
        quota:
          $ref: './resources.yaml#/components/schemas/ResourceQuota'
      required:
        - region
`);

      // Another sub-file defines ResourceQuota
      fs.writeFileSync(path.join(tempDir, 'api', 'schemas', 'resources.yaml'), `
components:
  schemas:
    ResourceQuota:
      type: object
      properties:
        maxCpu:
          type: integer
        maxMemoryMb:
          type: integer
        maxInstances:
          type: integer
      required:
        - maxCpu
`);

      const specPath = path.join(tempDir, 'api', 'openapi.yaml');
      const loader = new SpecLoader();
      const spec = await loader.loadWithRefs({
        url: specPath,
        resolveRefs: true,
      });

      // Parse and generate
      const parser = new OpenAPIParser();
      const ir = parser.parse(spec);
      const outputDir = path.join(tempDir, 'generated');
      const generator = new Generator({ outputDir });
      await generator.generate(ir);

      // Directly defined schemas should exist
      const projectFile = path.join(outputDir, 'models', 'project.ts');
      expect(fs.existsSync(projectFile)).toBe(true);
      const projectCode = fs.readFileSync(projectFile, 'utf-8');
      expect(projectCode).toContain('export class Project');
      expect(projectCode).toContain('config');

      const statusFile = path.join(outputDir, 'models', 'status.ts');
      expect(fs.existsSync(statusFile)).toBe(true);

      // Sub-file schemas should be promoted and generate standalone model files
      const configFile = path.join(outputDir, 'models', 'project-config.ts');
      expect(fs.existsSync(configFile)).toBe(true);
      const configCode = fs.readFileSync(configFile, 'utf-8');
      expect(configCode).toContain('export class ProjectConfig');
      expect(configCode).toContain('region');
      expect(configCode).toContain('tier');
      expect(configCode).toContain('quota');

      const quotaFile = path.join(outputDir, 'models', 'resource-quota.ts');
      expect(fs.existsSync(quotaFile)).toBe(true);
      const quotaCode = fs.readFileSync(quotaFile, 'utf-8');
      expect(quotaCode).toContain('export class ResourceQuota');
      expect(quotaCode).toContain('maxCpu');
      expect(quotaCode).toContain('maxMemoryMb');
      expect(quotaCode).toContain('maxInstances');
    });

    it('should promote schemas referenced only from paths (not in components/schemas)', async () => {
      // Main spec references sub-file schema directly from a path response
      fs.writeFileSync(path.join(tempDir, 'api', 'openapi.yaml'), `
openapi: 3.0.0
info:
  title: Platform API
  version: 1.0.0
paths:
  /audit-log:
    get:
      operationId: getAuditLog
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                $ref: './schemas/audit.yaml#/components/schemas/AuditEntry'
components:
  schemas:
    User:
      type: object
      properties:
        name:
          type: string
`);

      fs.writeFileSync(path.join(tempDir, 'api', 'schemas', 'audit.yaml'), `
components:
  schemas:
    AuditEntry:
      type: object
      properties:
        action:
          type: string
        timestamp:
          type: string
          format: date-time
        actor:
          type: string
      required:
        - action
        - timestamp
`);

      const specPath = path.join(tempDir, 'api', 'openapi.yaml');
      const loader = new SpecLoader();
      const spec = await loader.loadWithRefs({
        url: specPath,
        resolveRefs: true,
      });

      // AuditEntry should be promoted to components/schemas
      expect(spec.components.schemas.AuditEntry).toBeDefined();
      expect(spec.components.schemas.AuditEntry.type).toBe('object');
      expect(spec.components.schemas.AuditEntry.properties.action.type).toBe('string');

      // Path should reference the promoted schema via internal $ref
      const responseSchema =
        spec.paths['/audit-log'].get.responses['200'].content['application/json'].schema;
      expect(responseSchema.$ref).toBe('#/components/schemas/AuditEntry');

      // Parse and generate
      const parser = new OpenAPIParser();
      const ir = parser.parse(spec);
      const outputDir = path.join(tempDir, 'generated');
      const generator = new Generator({ outputDir });
      await generator.generate(ir);

      // AuditEntry should have its own model file
      const auditFile = path.join(outputDir, 'models', 'audit-entry.ts');
      expect(fs.existsSync(auditFile)).toBe(true);
      const auditCode = fs.readFileSync(auditFile, 'utf-8');
      expect(auditCode).toContain('export class AuditEntry');
      expect(auditCode).toContain('action');
      expect(auditCode).toContain('timestamp');
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
