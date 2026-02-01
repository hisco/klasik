/**
 * Tests for ZodValidatorPlugin
 */

import * as fs from 'fs';
import * as path from 'path';
import { ZodValidatorPlugin } from '../zod-validator-plugin';
import { Project } from 'ts-morph';
import { SchemaDefinition, PropertyDefinition, SchemaIR, IRHelpers } from '../../ir/types';
import { ImportManager } from '../../builders/import-manager';
import { GenerationContext } from '../../builders/class-builder';

describe('ZodValidatorPlugin', () => {
  let plugin: ZodValidatorPlugin;
  let project: Project;
  let context: GenerationContext;
  let testOutputDir: string;

  beforeEach(() => {
    plugin = new ZodValidatorPlugin();
    project = new Project({ useInMemoryFileSystem: true });
    testOutputDir = '/tmp/zod-test-' + Date.now();

    // Create test directory
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }

    context = {
      project,
      importManager: new ImportManager(),
      options: { outputDir: testOutputDir, useZod: true }
    };
  });

  afterEach(() => {
    // Cleanup test directory
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true, force: true });
    }
  });

  // Helper to create property definitions
  const createProperty = (overrides: Partial<PropertyDefinition>): PropertyDefinition => ({
    name: 'test',
    originalName: 'test',
    type: { kind: 'primitive', name: 'string' },
    required: false,
    nullable: false,
    metadata: {},
    ...overrides
  });

  // Helper to create schema definitions
  const createSchema = (overrides: Partial<SchemaDefinition>): SchemaDefinition => ({
    name: 'TestSchema',
    originalName: 'TestSchema',
    description: '',
    properties: new Map(),
    required: new Set(),
    type: 'object',
    metadata: {},
    ...overrides
  });

  // Helper to create IR
  const createIR = (schemas: SchemaDefinition[]): SchemaIR => {
    const ir = IRHelpers.createSchemaIR();
    for (const schema of schemas) {
      ir.schemas.set(schema.name, schema);
    }
    return ir;
  };

  describe('Plugin Metadata', () => {
    it('should have correct name', () => {
      expect(plugin.name).toBe('zod-validator');
    });

    it('should have priority 85', () => {
      expect(plugin.priority).toBe(85);
    });
  });

  describe('modifyPackageJson', () => {
    it('should add zod dependency', () => {
      const packageJson: any = {};

      plugin.modifyPackageJson(packageJson, context);

      expect(packageJson.dependencies).toBeDefined();
      expect(packageJson.dependencies['zod']).toBe('^3.23.0');
    });

    it('should preserve existing dependencies', () => {
      const packageJson: any = {
        dependencies: {
          'class-validator': '^0.14.0'
        }
      };

      plugin.modifyPackageJson(packageJson, context);

      expect(packageJson.dependencies['class-validator']).toBe('^0.14.0');
      expect(packageJson.dependencies['zod']).toBe('^3.23.0');
    });
  });

  describe('afterGeneration - File Generation', () => {
    it('should generate .zod.ts file for each schema', () => {
      const schema = createSchema({
        name: 'User',
        originalName: 'User'
      });
      const ir = createIR([schema]);

      // Create models directory
      const modelsDir = path.join(testOutputDir, 'models');
      fs.mkdirSync(modelsDir, { recursive: true });

      plugin.afterGeneration(context, ir);

      const zodFile = path.join(modelsDir, 'user.zod.ts');
      expect(fs.existsSync(zodFile)).toBe(true);
    });

    it('should generate index.zod.ts file', () => {
      const schema = createSchema({
        name: 'User',
        originalName: 'User'
      });
      const ir = createIR([schema]);

      // Create models directory
      const modelsDir = path.join(testOutputDir, 'models');
      fs.mkdirSync(modelsDir, { recursive: true });

      plugin.afterGeneration(context, ir);

      const indexFile = path.join(modelsDir, 'index.zod.ts');
      expect(fs.existsSync(indexFile)).toBe(true);
    });

    it('should import zod in generated file', () => {
      const schema = createSchema({
        name: 'User',
        originalName: 'User'
      });
      const ir = createIR([schema]);

      // Create models directory
      const modelsDir = path.join(testOutputDir, 'models');
      fs.mkdirSync(modelsDir, { recursive: true });

      plugin.afterGeneration(context, ir);

      const zodFile = path.join(modelsDir, 'user.zod.ts');
      const content = fs.readFileSync(zodFile, 'utf-8');

      expect(content).toContain("import { z } from 'zod';");
    });

    it('should export schema and type', () => {
      const schema = createSchema({
        name: 'User',
        originalName: 'User'
      });
      const ir = createIR([schema]);

      // Create models directory
      const modelsDir = path.join(testOutputDir, 'models');
      fs.mkdirSync(modelsDir, { recursive: true });

      plugin.afterGeneration(context, ir);

      const zodFile = path.join(modelsDir, 'user.zod.ts');
      const content = fs.readFileSync(zodFile, 'utf-8');

      expect(content).toContain('export const UserSchema = z.object');
      expect(content).toContain('export type User = z.infer<typeof UserSchema>;');
    });
  });

  describe('Primitive Type Conversion', () => {
    it('should convert string type', () => {
      const properties = new Map<string, PropertyDefinition>();
      properties.set('name', createProperty({
        name: 'name',
        originalName: 'name',
        type: { kind: 'primitive', name: 'string' },
        required: true
      }));

      const schema = createSchema({
        name: 'User',
        originalName: 'User',
        properties
      });
      const ir = createIR([schema]);

      const modelsDir = path.join(testOutputDir, 'models');
      fs.mkdirSync(modelsDir, { recursive: true });

      plugin.afterGeneration(context, ir);

      const zodFile = path.join(modelsDir, 'user.zod.ts');
      const content = fs.readFileSync(zodFile, 'utf-8');

      expect(content).toContain('name: z.string()');
    });

    it('should convert number type', () => {
      const properties = new Map<string, PropertyDefinition>();
      properties.set('age', createProperty({
        name: 'age',
        originalName: 'age',
        type: { kind: 'primitive', name: 'number' },
        required: true
      }));

      const schema = createSchema({
        name: 'User',
        originalName: 'User',
        properties
      });
      const ir = createIR([schema]);

      const modelsDir = path.join(testOutputDir, 'models');
      fs.mkdirSync(modelsDir, { recursive: true });

      plugin.afterGeneration(context, ir);

      const zodFile = path.join(modelsDir, 'user.zod.ts');
      const content = fs.readFileSync(zodFile, 'utf-8');

      expect(content).toContain('age: z.number()');
    });

    it('should convert integer type with .int()', () => {
      const properties = new Map<string, PropertyDefinition>();
      properties.set('count', createProperty({
        name: 'count',
        originalName: 'count',
        type: { kind: 'primitive', name: 'integer' },
        required: true
      }));

      const schema = createSchema({
        name: 'Counter',
        originalName: 'Counter',
        properties
      });
      const ir = createIR([schema]);

      const modelsDir = path.join(testOutputDir, 'models');
      fs.mkdirSync(modelsDir, { recursive: true });

      plugin.afterGeneration(context, ir);

      const zodFile = path.join(modelsDir, 'counter.zod.ts');
      const content = fs.readFileSync(zodFile, 'utf-8');

      expect(content).toContain('z.number().int()');
    });

    it('should convert boolean type', () => {
      const properties = new Map<string, PropertyDefinition>();
      properties.set('active', createProperty({
        name: 'active',
        originalName: 'active',
        type: { kind: 'primitive', name: 'boolean' },
        required: true
      }));

      const schema = createSchema({
        name: 'User',
        originalName: 'User',
        properties
      });
      const ir = createIR([schema]);

      const modelsDir = path.join(testOutputDir, 'models');
      fs.mkdirSync(modelsDir, { recursive: true });

      plugin.afterGeneration(context, ir);

      const zodFile = path.join(modelsDir, 'user.zod.ts');
      const content = fs.readFileSync(zodFile, 'utf-8');

      expect(content).toContain('active: z.boolean()');
    });
  });

  describe('Format Validations', () => {
    it('should add .email() for email format', () => {
      const properties = new Map<string, PropertyDefinition>();
      properties.set('email', createProperty({
        name: 'email',
        originalName: 'email',
        type: { kind: 'primitive', name: 'string' },
        required: true,
        format: 'email'
      }));

      const schema = createSchema({
        name: 'User',
        originalName: 'User',
        properties
      });
      const ir = createIR([schema]);

      const modelsDir = path.join(testOutputDir, 'models');
      fs.mkdirSync(modelsDir, { recursive: true });

      plugin.afterGeneration(context, ir);

      const zodFile = path.join(modelsDir, 'user.zod.ts');
      const content = fs.readFileSync(zodFile, 'utf-8');

      expect(content).toContain('z.string().email()');
    });

    it('should add .url() for url format', () => {
      const properties = new Map<string, PropertyDefinition>();
      properties.set('website', createProperty({
        name: 'website',
        originalName: 'website',
        type: { kind: 'primitive', name: 'string' },
        required: true,
        format: 'url'
      }));

      const schema = createSchema({
        name: 'User',
        originalName: 'User',
        properties
      });
      const ir = createIR([schema]);

      const modelsDir = path.join(testOutputDir, 'models');
      fs.mkdirSync(modelsDir, { recursive: true });

      plugin.afterGeneration(context, ir);

      const zodFile = path.join(modelsDir, 'user.zod.ts');
      const content = fs.readFileSync(zodFile, 'utf-8');

      expect(content).toContain('z.string().url()');
    });

    it('should add .uuid() for uuid format', () => {
      const properties = new Map<string, PropertyDefinition>();
      properties.set('id', createProperty({
        name: 'id',
        originalName: 'id',
        type: { kind: 'primitive', name: 'string' },
        required: true,
        format: 'uuid'
      }));

      const schema = createSchema({
        name: 'User',
        originalName: 'User',
        properties
      });
      const ir = createIR([schema]);

      const modelsDir = path.join(testOutputDir, 'models');
      fs.mkdirSync(modelsDir, { recursive: true });

      plugin.afterGeneration(context, ir);

      const zodFile = path.join(modelsDir, 'user.zod.ts');
      const content = fs.readFileSync(zodFile, 'utf-8');

      expect(content).toContain('z.string().uuid()');
    });

    it('should add .datetime() for date-time format', () => {
      const properties = new Map<string, PropertyDefinition>();
      properties.set('createdAt', createProperty({
        name: 'createdAt',
        originalName: 'createdAt',
        type: { kind: 'primitive', name: 'string' },
        required: true,
        format: 'date-time'
      }));

      const schema = createSchema({
        name: 'User',
        originalName: 'User',
        properties
      });
      const ir = createIR([schema]);

      const modelsDir = path.join(testOutputDir, 'models');
      fs.mkdirSync(modelsDir, { recursive: true });

      plugin.afterGeneration(context, ir);

      const zodFile = path.join(modelsDir, 'user.zod.ts');
      const content = fs.readFileSync(zodFile, 'utf-8');

      expect(content).toContain('z.string().datetime()');
    });
  });

  describe('Constraint Validations', () => {
    it('should add .min() for minLength', () => {
      const properties = new Map<string, PropertyDefinition>();
      properties.set('name', createProperty({
        name: 'name',
        originalName: 'name',
        type: { kind: 'primitive', name: 'string' },
        required: true,
        constraints: { minLength: 1 }
      }));

      const schema = createSchema({
        name: 'User',
        originalName: 'User',
        properties
      });
      const ir = createIR([schema]);

      const modelsDir = path.join(testOutputDir, 'models');
      fs.mkdirSync(modelsDir, { recursive: true });

      plugin.afterGeneration(context, ir);

      const zodFile = path.join(modelsDir, 'user.zod.ts');
      const content = fs.readFileSync(zodFile, 'utf-8');

      expect(content).toContain('z.string().min(1)');
    });

    it('should add .max() for maxLength', () => {
      const properties = new Map<string, PropertyDefinition>();
      properties.set('name', createProperty({
        name: 'name',
        originalName: 'name',
        type: { kind: 'primitive', name: 'string' },
        required: true,
        constraints: { maxLength: 100 }
      }));

      const schema = createSchema({
        name: 'User',
        originalName: 'User',
        properties
      });
      const ir = createIR([schema]);

      const modelsDir = path.join(testOutputDir, 'models');
      fs.mkdirSync(modelsDir, { recursive: true });

      plugin.afterGeneration(context, ir);

      const zodFile = path.join(modelsDir, 'user.zod.ts');
      const content = fs.readFileSync(zodFile, 'utf-8');

      expect(content).toContain('z.string().max(100)');
    });

    it('should add .regex() for pattern', () => {
      const properties = new Map<string, PropertyDefinition>();
      properties.set('zipCode', createProperty({
        name: 'zipCode',
        originalName: 'zipCode',
        type: { kind: 'primitive', name: 'string' },
        required: true,
        constraints: { pattern: '^[0-9]{5}$' }
      }));

      const schema = createSchema({
        name: 'Address',
        originalName: 'Address',
        properties
      });
      const ir = createIR([schema]);

      const modelsDir = path.join(testOutputDir, 'models');
      fs.mkdirSync(modelsDir, { recursive: true });

      plugin.afterGeneration(context, ir);

      const zodFile = path.join(modelsDir, 'address.zod.ts');
      const content = fs.readFileSync(zodFile, 'utf-8');

      expect(content).toContain('.regex(/^[0-9]{5}$/)');
    });

    it('should add .min() for number minimum', () => {
      const properties = new Map<string, PropertyDefinition>();
      properties.set('age', createProperty({
        name: 'age',
        originalName: 'age',
        type: { kind: 'primitive', name: 'number' },
        required: true,
        constraints: { minimum: 0 }
      }));

      const schema = createSchema({
        name: 'User',
        originalName: 'User',
        properties
      });
      const ir = createIR([schema]);

      const modelsDir = path.join(testOutputDir, 'models');
      fs.mkdirSync(modelsDir, { recursive: true });

      plugin.afterGeneration(context, ir);

      const zodFile = path.join(modelsDir, 'user.zod.ts');
      const content = fs.readFileSync(zodFile, 'utf-8');

      expect(content).toContain('z.number().min(0)');
    });

    it('should add .gt() for exclusiveMinimum', () => {
      const properties = new Map<string, PropertyDefinition>();
      properties.set('price', createProperty({
        name: 'price',
        originalName: 'price',
        type: { kind: 'primitive', name: 'number' },
        required: true,
        constraints: { minimum: 0, exclusiveMinimum: true }
      }));

      const schema = createSchema({
        name: 'Product',
        originalName: 'Product',
        properties
      });
      const ir = createIR([schema]);

      const modelsDir = path.join(testOutputDir, 'models');
      fs.mkdirSync(modelsDir, { recursive: true });

      plugin.afterGeneration(context, ir);

      const zodFile = path.join(modelsDir, 'product.zod.ts');
      const content = fs.readFileSync(zodFile, 'utf-8');

      expect(content).toContain('.gt(0)');
    });
  });

  describe('Optional and Nullable Handling', () => {
    it('should add .optional() for non-required properties', () => {
      const properties = new Map<string, PropertyDefinition>();
      properties.set('nickname', createProperty({
        name: 'nickname',
        originalName: 'nickname',
        type: { kind: 'primitive', name: 'string' },
        required: false,
        nullable: false
      }));

      const schema = createSchema({
        name: 'User',
        originalName: 'User',
        properties
      });
      const ir = createIR([schema]);

      const modelsDir = path.join(testOutputDir, 'models');
      fs.mkdirSync(modelsDir, { recursive: true });

      plugin.afterGeneration(context, ir);

      const zodFile = path.join(modelsDir, 'user.zod.ts');
      const content = fs.readFileSync(zodFile, 'utf-8');

      expect(content).toContain('.optional()');
    });

    it('should add .nullable() for nullable required properties', () => {
      const properties = new Map<string, PropertyDefinition>();
      properties.set('middleName', createProperty({
        name: 'middleName',
        originalName: 'middleName',
        type: { kind: 'primitive', name: 'string' },
        required: true,
        nullable: true
      }));

      const schema = createSchema({
        name: 'User',
        originalName: 'User',
        properties
      });
      const ir = createIR([schema]);

      const modelsDir = path.join(testOutputDir, 'models');
      fs.mkdirSync(modelsDir, { recursive: true });

      plugin.afterGeneration(context, ir);

      const zodFile = path.join(modelsDir, 'user.zod.ts');
      const content = fs.readFileSync(zodFile, 'utf-8');

      expect(content).toContain('.nullable()');
    });

    it('should add .nullish() for nullable non-required properties', () => {
      const properties = new Map<string, PropertyDefinition>();
      properties.set('middleName', createProperty({
        name: 'middleName',
        originalName: 'middleName',
        type: { kind: 'primitive', name: 'string' },
        required: false,
        nullable: true
      }));

      const schema = createSchema({
        name: 'User',
        originalName: 'User',
        properties
      });
      const ir = createIR([schema]);

      const modelsDir = path.join(testOutputDir, 'models');
      fs.mkdirSync(modelsDir, { recursive: true });

      plugin.afterGeneration(context, ir);

      const zodFile = path.join(modelsDir, 'user.zod.ts');
      const content = fs.readFileSync(zodFile, 'utf-8');

      expect(content).toContain('.nullish()');
    });
  });

  describe('Complex Types', () => {
    it('should convert array type', () => {
      const properties = new Map<string, PropertyDefinition>();
      properties.set('tags', createProperty({
        name: 'tags',
        originalName: 'tags',
        type: {
          kind: 'array',
          elementType: { kind: 'primitive', name: 'string' }
        },
        required: true
      }));

      const schema = createSchema({
        name: 'Post',
        originalName: 'Post',
        properties
      });
      const ir = createIR([schema]);

      const modelsDir = path.join(testOutputDir, 'models');
      fs.mkdirSync(modelsDir, { recursive: true });

      plugin.afterGeneration(context, ir);

      const zodFile = path.join(modelsDir, 'post.zod.ts');
      const content = fs.readFileSync(zodFile, 'utf-8');

      expect(content).toContain('z.array(z.string())');
    });

    it('should convert dictionary type', () => {
      const properties = new Map<string, PropertyDefinition>();
      properties.set('metadata', createProperty({
        name: 'metadata',
        originalName: 'metadata',
        type: {
          kind: 'dictionary',
          additionalProperties: { kind: 'primitive', name: 'string' }
        },
        required: true
      }));

      const schema = createSchema({
        name: 'Resource',
        originalName: 'Resource',
        properties
      });
      const ir = createIR([schema]);

      const modelsDir = path.join(testOutputDir, 'models');
      fs.mkdirSync(modelsDir, { recursive: true });

      plugin.afterGeneration(context, ir);

      const zodFile = path.join(modelsDir, 'resource.zod.ts');
      const content = fs.readFileSync(zodFile, 'utf-8');

      expect(content).toContain('z.record(z.string(), z.string())');
    });

    it('should convert union type', () => {
      const properties = new Map<string, PropertyDefinition>();
      properties.set('value', createProperty({
        name: 'value',
        originalName: 'value',
        type: {
          kind: 'union',
          unionTypes: [
            { kind: 'primitive', name: 'string' },
            { kind: 'primitive', name: 'number' }
          ]
        },
        required: true
      }));

      const schema = createSchema({
        name: 'Data',
        originalName: 'Data',
        properties
      });
      const ir = createIR([schema]);

      const modelsDir = path.join(testOutputDir, 'models');
      fs.mkdirSync(modelsDir, { recursive: true });

      plugin.afterGeneration(context, ir);

      const zodFile = path.join(modelsDir, 'data.zod.ts');
      const content = fs.readFileSync(zodFile, 'utf-8');

      expect(content).toContain('z.union([z.string(), z.number()])');
    });

    it('should convert enum type with z.enum', () => {
      const properties = new Map<string, PropertyDefinition>();
      properties.set('status', createProperty({
        name: 'status',
        originalName: 'status',
        type: { kind: 'primitive', name: 'string' },
        required: true,
        constraints: { enum: ['active', 'inactive', 'pending'] }
      }));

      const schema = createSchema({
        name: 'User',
        originalName: 'User',
        properties
      });
      const ir = createIR([schema]);

      const modelsDir = path.join(testOutputDir, 'models');
      fs.mkdirSync(modelsDir, { recursive: true });

      plugin.afterGeneration(context, ir);

      const zodFile = path.join(modelsDir, 'user.zod.ts');
      const content = fs.readFileSync(zodFile, 'utf-8');

      expect(content).toContain("z.enum(['active', 'inactive', 'pending'])");
    });
  });

  describe('Reference Type Handling', () => {
    it('should reference other schema with import', () => {
      const addressSchema = createSchema({
        name: 'Address',
        originalName: 'Address'
      });

      const userProperties = new Map<string, PropertyDefinition>();
      userProperties.set('address', createProperty({
        name: 'address',
        originalName: 'address',
        type: { kind: 'reference', name: 'Address' },
        required: true
      }));

      const userSchema = createSchema({
        name: 'User',
        originalName: 'User',
        properties: userProperties
      });

      const ir = createIR([addressSchema, userSchema]);

      const modelsDir = path.join(testOutputDir, 'models');
      fs.mkdirSync(modelsDir, { recursive: true });

      plugin.afterGeneration(context, ir);

      const zodFile = path.join(modelsDir, 'user.zod.ts');
      const content = fs.readFileSync(zodFile, 'utf-8');

      expect(content).toContain("import { AddressSchema } from './address.zod';");
      expect(content).toContain('address: AddressSchema');
    });
  });

  describe('Enum Schema Handling', () => {
    it('should generate z.enum for enum schemas', () => {
      const schema = createSchema({
        name: 'Status',
        originalName: 'Status',
        type: 'enum',
        enumValues: ['active', 'inactive', 'pending']
      });

      const ir = createIR([schema]);

      const modelsDir = path.join(testOutputDir, 'models');
      fs.mkdirSync(modelsDir, { recursive: true });

      plugin.afterGeneration(context, ir);

      const zodFile = path.join(modelsDir, 'status.zod.ts');
      const content = fs.readFileSync(zodFile, 'utf-8');

      expect(content).toContain("export const StatusSchema = z.enum(['active', 'inactive', 'pending'])");
    });
  });

  describe('Description Handling', () => {
    it('should add .describe() for property description', () => {
      const properties = new Map<string, PropertyDefinition>();
      properties.set('name', createProperty({
        name: 'name',
        originalName: 'name',
        type: { kind: 'primitive', name: 'string' },
        required: true,
        description: 'The user name'
      }));

      const schema = createSchema({
        name: 'User',
        originalName: 'User',
        properties
      });
      const ir = createIR([schema]);

      const modelsDir = path.join(testOutputDir, 'models');
      fs.mkdirSync(modelsDir, { recursive: true });

      plugin.afterGeneration(context, ir);

      const zodFile = path.join(modelsDir, 'user.zod.ts');
      const content = fs.readFileSync(zodFile, 'utf-8');

      expect(content).toContain(".describe('The user name')");
    });

    it('should add JSDoc for schema description', () => {
      const schema = createSchema({
        name: 'User',
        originalName: 'User',
        description: 'Represents a user in the system'
      });
      const ir = createIR([schema]);

      const modelsDir = path.join(testOutputDir, 'models');
      fs.mkdirSync(modelsDir, { recursive: true });

      plugin.afterGeneration(context, ir);

      const zodFile = path.join(modelsDir, 'user.zod.ts');
      const content = fs.readFileSync(zodFile, 'utf-8');

      expect(content).toContain('/**');
      expect(content).toContain('Represents a user in the system');
      expect(content).toContain('*/');
    });
  });

  describe('ESM Support', () => {
    it('should add .js extension to imports when ESM is enabled', () => {
      context.options.esm = true;

      const addressSchema = createSchema({
        name: 'Address',
        originalName: 'Address'
      });

      const userProperties = new Map<string, PropertyDefinition>();
      userProperties.set('address', createProperty({
        name: 'address',
        originalName: 'address',
        type: { kind: 'reference', name: 'Address' },
        required: true
      }));

      const userSchema = createSchema({
        name: 'User',
        originalName: 'User',
        properties: userProperties
      });

      const ir = createIR([addressSchema, userSchema]);

      const modelsDir = path.join(testOutputDir, 'models');
      fs.mkdirSync(modelsDir, { recursive: true });

      plugin.afterGeneration(context, ir);

      const zodFile = path.join(modelsDir, 'user.zod.ts');
      const content = fs.readFileSync(zodFile, 'utf-8');

      expect(content).toContain("from './address.zod.js'");
    });
  });

  describe('Bare Mode', () => {
    it('should generate files directly in output directory in bare mode', () => {
      context.options.bare = true;

      const schema = createSchema({
        name: 'User',
        originalName: 'User'
      });
      const ir = createIR([schema]);

      plugin.afterGeneration(context, ir);

      const zodFile = path.join(testOutputDir, 'user.zod.ts');
      expect(fs.existsSync(zodFile)).toBe(true);
    });
  });
});
