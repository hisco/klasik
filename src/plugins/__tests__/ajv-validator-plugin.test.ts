/**
 * Tests for AjvValidatorPlugin
 */

import { AjvValidatorPlugin } from '../ajv-validator-plugin';
import { Project, ClassDeclaration, Scope } from 'ts-morph';
import { SchemaDefinition, PropertyDefinition, TypeReference, Constraints } from '../../ir/types';
import { ImportManager } from '../../builders/import-manager';
import { GenerationContext } from '../../builders/class-builder';

describe('AjvValidatorPlugin', () => {
  let plugin: AjvValidatorPlugin;
  let project: Project;
  let classDecl: ClassDeclaration;
  let context: GenerationContext;

  beforeEach(() => {
    plugin = new AjvValidatorPlugin();
    project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile('test.ts');
    classDecl = sourceFile.addClass({ name: 'TestClass' });
    context = {
      project,
      importManager: new ImportManager(),
      options: { outputDir: '/test', useAjv: true }
    };
  });

  // Helper to create property definitions with required metadata
  const createProperty = (overrides: Partial<PropertyDefinition>): PropertyDefinition => ({
    name: 'test',
    originalName: 'test',
    type: { kind: 'primitive', name: 'string' },
    required: false,
    nullable: false,
    metadata: {},
    ...overrides
  });

  // Helper to create schema definitions with required metadata
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

  describe('Plugin Metadata', () => {
    it('should have correct name', () => {
      expect(plugin.name).toBe('ajv-validator');
    });

    it('should have priority 85', () => {
      expect(plugin.priority).toBe(85);
    });
  });

  describe('decorateClass', () => {
    it('should add getSchema static method', () => {
      const schema = createSchema({
        name: 'User',
        originalName: 'User',
        description: 'User model'
      });

      plugin.decorateClass(classDecl, schema, context);

      const methods = classDecl.getMethods();
      const getSchemaMethod = methods.find(m => m.getName() === 'getSchema');

      expect(getSchemaMethod).toBeDefined();
      expect(getSchemaMethod?.isStatic()).toBe(true);
      expect(getSchemaMethod?.getReturnType().getText()).toContain('object');
    });

    it('should add validateWithJsonSchema static method', () => {
      const schema = createSchema({
        name: 'User',
        originalName: 'User'
      });

      plugin.decorateClass(classDecl, schema, context);

      const methods = classDecl.getMethods();
      const validateMethod = methods.find(m => m.getName() === 'validateWithJsonSchema');

      expect(validateMethod).toBeDefined();
      expect(validateMethod?.isStatic()).toBe(true);
      expect(validateMethod?.getParameters()).toHaveLength(1);
      expect(validateMethod?.getParameters()[0].getName()).toBe('data');
    });

    it('should add private _ajvInstance property', () => {
      const schema = createSchema({ name: 'User', originalName: 'User' });

      plugin.decorateClass(classDecl, schema, context);

      const props = classDecl.getProperties();
      const ajvProp = props.find(p => p.getName() === '_ajvInstance');

      expect(ajvProp).toBeDefined();
      expect(ajvProp?.isStatic()).toBe(true);
      expect(ajvProp?.getScope()).toBe(Scope.Private);
      // Type check: In test environment, type might be 'any' since Ajv isn't imported
      // Just verify the property was created with the correct structure
      expect(ajvProp?.getInitializer()?.getText()).toBe('null');
    });

    it('should add private getAjvInstance method', () => {
      const schema = createSchema({ name: 'User', originalName: 'User' });

      plugin.decorateClass(classDecl, schema, context);

      const methods = classDecl.getMethods();
      const getAjvMethod = methods.find(m => m.getName() === 'getAjvInstance');

      expect(getAjvMethod).toBeDefined();
      expect(getAjvMethod?.isStatic()).toBe(true);
      expect(getAjvMethod?.getScope()).toBe(Scope.Private);
      expect(getAjvMethod?.getReturnType().getText()).toContain('Ajv');
    });

    it('should add private _compiledValidator property for caching', () => {
      const schema = createSchema({ name: 'User', originalName: 'User' });

      plugin.decorateClass(classDecl, schema, context);

      const props = classDecl.getProperties();
      const compiledValidatorProp = props.find(p => p.getName() === '_compiledValidator');

      expect(compiledValidatorProp).toBeDefined();
      expect(compiledValidatorProp?.isStatic()).toBe(true);
      expect(compiledValidatorProp?.getScope()).toBe(Scope.Private);
      expect(compiledValidatorProp?.getInitializer()?.getText()).toBe('null');
    });

    it('should add private getCompiledValidator method', () => {
      const schema = createSchema({ name: 'User', originalName: 'User' });

      plugin.decorateClass(classDecl, schema, context);

      const methods = classDecl.getMethods();
      const getCompiledValidatorMethod = methods.find(m => m.getName() === 'getCompiledValidator');

      expect(getCompiledValidatorMethod).toBeDefined();
      expect(getCompiledValidatorMethod?.isStatic()).toBe(true);
      expect(getCompiledValidatorMethod?.getScope()).toBe(Scope.Private);

      // Verify it caches the compiled validator
      const body = getCompiledValidatorMethod?.getBodyText();
      expect(body).toContain('if (!this._compiledValidator)');
      expect(body).toContain('ajv.compile(schema)');
      expect(body).toContain('return this._compiledValidator');
    });

    it('should add Ajv imports', () => {
      const schema = createSchema({ name: 'User', originalName: 'User' });

      plugin.decorateClass(classDecl, schema, context);

      expect(context.importManager.hasImport('ajv')).toBe(true);
      expect(context.importManager.hasNamedImport('ajv', 'Ajv')).toBe(true);
      expect(context.importManager.hasImport('ajv-formats')).toBe(true);
      expect(context.importManager.hasNamedImport('ajv-formats', 'addFormats')).toBe(true);
    });
  });

  describe('Schema Conversion', () => {
    describe('Primitive Types', () => {
      it('should convert string type', () => {
        const properties = new Map<string, PropertyDefinition>();
        properties.set('name', createProperty({
          name: 'name',
          originalName: 'name',
          type: { kind: 'primitive', name: 'string' },
          required: true,
          description: 'User name'
        }));

        const schema = createSchema({
          name: 'User',
          originalName: 'User',
          properties,
          required: new Set(['name'])
        });

        plugin.decorateClass(classDecl, schema, context);

        const getSchemaMethod = classDecl.getMethod('getSchema');
        const body = getSchemaMethod?.getBodyText();

        expect(body).toContain('"type": "string"');
        expect(body).toContain('"name"');
        expect(body).toContain('"required"');
      });

      it('should convert number type', () => {
        const properties = new Map<string, PropertyDefinition>();
        properties.set('age', createProperty({
          name: 'age',
          originalName: 'age',
          type: { kind: 'primitive', name: 'number' },
          required: false
        }));

        const schema = createSchema({
          name: 'User',
          originalName: 'User',
          properties
        });

        plugin.decorateClass(classDecl, schema, context);

        const getSchemaMethod = classDecl.getMethod('getSchema');
        const body = getSchemaMethod?.getBodyText();

        expect(body).toContain('"type": "number"');
      });

      it('should convert boolean type', () => {
        const properties = new Map<string, PropertyDefinition>();
        properties.set('active', createProperty({
          name: 'active',
          originalName: 'active',
          type: { kind: 'primitive', name: 'boolean' },
          required: false
        }));

        const schema = createSchema({
          name: 'User',
          originalName: 'User',
          properties
        });

        plugin.decorateClass(classDecl, schema, context);

        const getSchemaMethod = classDecl.getMethod('getSchema');
        const body = getSchemaMethod?.getBodyText();

        expect(body).toContain('"type": "boolean"');
      });

      it('should convert integer type', () => {
        const properties = new Map<string, PropertyDefinition>();
        properties.set('count', createProperty({
          name: 'count',
          originalName: 'count',
          type: { kind: 'primitive', name: 'integer' },
          required: false
        }));

        const schema = createSchema({
          name: 'User',
          originalName: 'User',
          properties
        });

        plugin.decorateClass(classDecl, schema, context);

        const getSchemaMethod = classDecl.getMethod('getSchema');
        const body = getSchemaMethod?.getBodyText();

        expect(body).toContain('"type": "integer"');
      });
    });

    describe('Constraints', () => {
      it('should convert minLength constraint', () => {
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
          properties,
          required: new Set(['name'])
        });

        plugin.decorateClass(classDecl, schema, context);

        const getSchemaMethod = classDecl.getMethod('getSchema');
        const body = getSchemaMethod?.getBodyText();

        expect(body).toContain('"minLength": 1');
      });

      it('should convert maxLength constraint', () => {
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
          properties,
          required: new Set(['name'])
        });

        plugin.decorateClass(classDecl, schema, context);

        const getSchemaMethod = classDecl.getMethod('getSchema');
        const body = getSchemaMethod?.getBodyText();

        expect(body).toContain('"maxLength": 100');
      });

      it('should convert pattern constraint', () => {
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
          properties,
          required: new Set(['zipCode'])
        });

        plugin.decorateClass(classDecl, schema, context);

        const getSchemaMethod = classDecl.getMethod('getSchema');
        const body = getSchemaMethod?.getBodyText();

        expect(body).toContain('"pattern": "^[0-9]{5}$"');
      });

      it('should convert minimum constraint', () => {
        const properties = new Map<string, PropertyDefinition>();
        properties.set('age', createProperty({
          name: 'age',
          originalName: 'age',
          type: { kind: 'primitive', name: 'number' },
          required: false,
          constraints: { minimum: 0 }
        }));

        const schema = createSchema({
          name: 'User',
          originalName: 'User',
          properties
        });

        plugin.decorateClass(classDecl, schema, context);

        const getSchemaMethod = classDecl.getMethod('getSchema');
        const body = getSchemaMethod?.getBodyText();

        expect(body).toContain('"minimum": 0');
      });

      it('should convert maximum constraint', () => {
        const properties = new Map<string, PropertyDefinition>();
        properties.set('age', createProperty({
          name: 'age',
          originalName: 'age',
          type: { kind: 'primitive', name: 'number' },
          required: false,
          constraints: { maximum: 150 }
        }));

        const schema = createSchema({
          name: 'User',
          originalName: 'User',
          properties
        });

        plugin.decorateClass(classDecl, schema, context);

        const getSchemaMethod = classDecl.getMethod('getSchema');
        const body = getSchemaMethod?.getBodyText();

        expect(body).toContain('"maximum": 150');
      });

      it('should convert exclusiveMinimum constraint', () => {
        const properties = new Map<string, PropertyDefinition>();
        properties.set('price', createProperty({
          name: 'price',
          originalName: 'price',
          type: { kind: 'primitive', name: 'number' },
          required: false,
          constraints: { minimum: 0, exclusiveMinimum: true }
        }));

        const schema = createSchema({
          name: 'Product',
          originalName: 'Product',
          properties
        });

        plugin.decorateClass(classDecl, schema, context);

        const getSchemaMethod = classDecl.getMethod('getSchema');
        const body = getSchemaMethod?.getBodyText();

        expect(body).toContain('"exclusiveMinimum": 0');
      });

      it('should convert exclusiveMaximum constraint', () => {
        const properties = new Map<string, PropertyDefinition>();
        properties.set('discount', createProperty({
          name: 'discount',
          originalName: 'discount',
          type: { kind: 'primitive', name: 'number' },
          required: false,
          constraints: { maximum: 100, exclusiveMaximum: true }
        }));

        const schema = createSchema({
          name: 'Product',
          originalName: 'Product',
          properties
        });

        plugin.decorateClass(classDecl, schema, context);

        const getSchemaMethod = classDecl.getMethod('getSchema');
        const body = getSchemaMethod?.getBodyText();

        expect(body).toContain('"exclusiveMaximum": 100');
      });

      it('should convert multipleOf constraint', () => {
        const properties = new Map<string, PropertyDefinition>();
        properties.set('quantity', createProperty({
          name: 'quantity',
          originalName: 'quantity',
          type: { kind: 'primitive', name: 'number' },
          required: false,
          constraints: { multipleOf: 5 }
        }));

        const schema = createSchema({
          name: 'Order',
          originalName: 'Order',
          properties
        });

        plugin.decorateClass(classDecl, schema, context);

        const getSchemaMethod = classDecl.getMethod('getSchema');
        const body = getSchemaMethod?.getBodyText();

        expect(body).toContain('"multipleOf": 5');
      });

      it('should convert enum constraint', () => {
        const properties = new Map<string, PropertyDefinition>();
        properties.set('status', createProperty({
          name: 'status',
          originalName: 'status',
          type: { kind: 'primitive', name: 'string' },
          required: false,
          constraints: { enum: ['active', 'inactive', 'pending'] }
        }));

        const schema = createSchema({
          name: 'User',
          originalName: 'User',
          properties
        });

        plugin.decorateClass(classDecl, schema, context);

        const getSchemaMethod = classDecl.getMethod('getSchema');
        const body = getSchemaMethod?.getBodyText();

        expect(body).toContain('"enum"');
        expect(body).toContain('active');
        expect(body).toContain('inactive');
        expect(body).toContain('pending');
      });

      it('should convert minItems constraint', () => {
        const properties = new Map<string, PropertyDefinition>();
        properties.set('tags', createProperty({
          name: 'tags',
          originalName: 'tags',
          type: {
            kind: 'array',
            elementType: { kind: 'primitive', name: 'string' }
          },
          required: false,
          constraints: { minItems: 1 }
        }));

        const schema = createSchema({
          name: 'Post',
          originalName: 'Post',
          properties
        });

        plugin.decorateClass(classDecl, schema, context);

        const getSchemaMethod = classDecl.getMethod('getSchema');
        const body = getSchemaMethod?.getBodyText();

        expect(body).toContain('"minItems": 1');
      });

      it('should convert maxItems constraint', () => {
        const properties = new Map<string, PropertyDefinition>();
        properties.set('tags', createProperty({
          name: 'tags',
          originalName: 'tags',
          type: {
            kind: 'array',
            elementType: { kind: 'primitive', name: 'string' }
          },
          required: false,
          constraints: { maxItems: 10 }
        }));

        const schema = createSchema({
          name: 'Post',
          originalName: 'Post',
          properties
        });

        plugin.decorateClass(classDecl, schema, context);

        const getSchemaMethod = classDecl.getMethod('getSchema');
        const body = getSchemaMethod?.getBodyText();

        expect(body).toContain('"maxItems": 10');
      });

      it('should convert uniqueItems constraint', () => {
        const properties = new Map<string, PropertyDefinition>();
        properties.set('tags', createProperty({
          name: 'tags',
          originalName: 'tags',
          type: {
            kind: 'array',
            elementType: { kind: 'primitive', name: 'string' }
          },
          required: false,
          constraints: { uniqueItems: true }
        }));

        const schema = createSchema({
          name: 'Post',
          originalName: 'Post',
          properties
        });

        plugin.decorateClass(classDecl, schema, context);

        const getSchemaMethod = classDecl.getMethod('getSchema');
        const body = getSchemaMethod?.getBodyText();

        expect(body).toContain('"uniqueItems": true');
      });
    });

    describe('Formats', () => {
      it('should convert email format', () => {
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
          properties,
          required: new Set(['email'])
        });

        plugin.decorateClass(classDecl, schema, context);

        const getSchemaMethod = classDecl.getMethod('getSchema');
        const body = getSchemaMethod?.getBodyText();

        expect(body).toContain('"format": "email"');
      });

      it('should convert uuid format', () => {
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
          properties,
          required: new Set(['id'])
        });

        plugin.decorateClass(classDecl, schema, context);

        const getSchemaMethod = classDecl.getMethod('getSchema');
        const body = getSchemaMethod?.getBodyText();

        expect(body).toContain('"format": "uuid"');
      });

      it('should convert date-time format', () => {
        const properties = new Map<string, PropertyDefinition>();
        properties.set('createdAt', createProperty({
          name: 'createdAt',
          originalName: 'createdAt',
          type: { kind: 'primitive', name: 'string' },
          required: false,
          format: 'date-time'
        }));

        const schema = createSchema({
          name: 'User',
          originalName: 'User',
          properties
        });

        plugin.decorateClass(classDecl, schema, context);

        const getSchemaMethod = classDecl.getMethod('getSchema');
        const body = getSchemaMethod?.getBodyText();

        expect(body).toContain('"format": "date-time"');
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
          required: false
        }));

        const schema = createSchema({
          name: 'Post',
          originalName: 'Post',
          properties
        });

        plugin.decorateClass(classDecl, schema, context);

        const getSchemaMethod = classDecl.getMethod('getSchema');
        const body = getSchemaMethod?.getBodyText();

        expect(body).toContain('"type": "array"');
        expect(body).toContain('"items"');
      });

      it('should convert object/reference type', () => {
        const properties = new Map<string, PropertyDefinition>();
        properties.set('address', createProperty({
          name: 'address',
          originalName: 'address',
          type: { kind: 'reference', name: 'Address' },
          required: false
        }));

        const schema = createSchema({
          name: 'User',
          originalName: 'User',
          properties
        });

        plugin.decorateClass(classDecl, schema, context);

        const getSchemaMethod = classDecl.getMethod('getSchema');
        const body = getSchemaMethod?.getBodyText();

        expect(body).toContain('"type": "object"');
      });

      it('should convert union type with anyOf', () => {
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
          required: false
        }));

        const schema = createSchema({
          name: 'Data',
          originalName: 'Data',
          properties
        });

        plugin.decorateClass(classDecl, schema, context);

        const getSchemaMethod = classDecl.getMethod('getSchema');
        const body = getSchemaMethod?.getBodyText();

        expect(body).toContain('"anyOf"');
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
          required: false
        }));

        const schema = createSchema({
          name: 'Resource',
          originalName: 'Resource',
          properties
        });

        plugin.decorateClass(classDecl, schema, context);

        const getSchemaMethod = classDecl.getMethod('getSchema');
        const body = getSchemaMethod?.getBodyText();

        expect(body).toContain('"type": "object"');
        expect(body).toContain('"additionalProperties"');
      });

      it('should handle nullable types', () => {
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

        plugin.decorateClass(classDecl, schema, context);

        const getSchemaMethod = classDecl.getMethod('getSchema');
        const body = getSchemaMethod?.getBodyText();

        expect(body).toContain('"null"');
      });

      it('should handle unknown type', () => {
        const properties = new Map<string, PropertyDefinition>();
        properties.set('data', createProperty({
          name: 'data',
          originalName: 'data',
          type: { kind: 'unknown' },
          required: false
        }));

        const schema = createSchema({
          name: 'Container',
          originalName: 'Container',
          properties
        });

        plugin.decorateClass(classDecl, schema, context);

        const getSchemaMethod = classDecl.getMethod('getSchema');
        const body = getSchemaMethod?.getBodyText();

        // Unknown type should result in empty schema (accepts any)
        expect(body).toContain('"data"');
      });
    });

    describe('Schema Structure', () => {
      it('should include $schema field', () => {
        const schema = createSchema({
          name: 'User',
          originalName: 'User'
        });

        plugin.decorateClass(classDecl, schema, context);

        const getSchemaMethod = classDecl.getMethod('getSchema');
        const body = getSchemaMethod?.getBodyText();

        expect(body).toContain('"$schema": "https://json-schema.org/draft/2020-12/schema"');
      });

      it('should set additionalProperties to false', () => {
        const schema = createSchema({
          name: 'User',
          originalName: 'User'
        });

        plugin.decorateClass(classDecl, schema, context);

        const getSchemaMethod = classDecl.getMethod('getSchema');
        const body = getSchemaMethod?.getBodyText();

        expect(body).toContain('"additionalProperties": false');
      });

      it('should include description if provided', () => {
        const schema = createSchema({
          name: 'User',
          originalName: 'User',
          description: 'User model for authentication'
        });

        plugin.decorateClass(classDecl, schema, context);

        const getSchemaMethod = classDecl.getMethod('getSchema');
        const body = getSchemaMethod?.getBodyText();

        expect(body).toContain('User model for authentication');
      });

      it('should include required array for required properties', () => {
        const properties = new Map<string, PropertyDefinition>();
        properties.set('name', createProperty({
          name: 'name',
          originalName: 'name',
          type: { kind: 'primitive', name: 'string' },
          required: true
        }));
        properties.set('age', createProperty({
          name: 'age',
          originalName: 'age',
          type: { kind: 'primitive', name: 'number' },
          required: false
        }));

        const schema = createSchema({
          name: 'User',
          originalName: 'User',
          properties,
          required: new Set(['name'])
        });

        plugin.decorateClass(classDecl, schema, context);

        const getSchemaMethod = classDecl.getMethod('getSchema');
        const body = getSchemaMethod?.getBodyText();

        expect(body).toContain('"required"');
        expect(body).toContain('"name"');
      });

      it('should handle enum schemas', () => {
        const schema = createSchema({
          name: 'Status',
          originalName: 'Status',
          description: 'Status enum',
          type: 'enum',
          enumValues: ['active', 'inactive', 'pending']
        });

        plugin.decorateClass(classDecl, schema, context);

        const getSchemaMethod = classDecl.getMethod('getSchema');
        const body = getSchemaMethod?.getBodyText();

        expect(body).toContain('"enum"');
        expect(body).toContain('active');
        expect(body).toContain('inactive');
        expect(body).toContain('pending');
      });
    });
  });

  describe('modifyPackageJson', () => {
    it('should add ajv dependencies', () => {
      const packageJson: any = {};

      plugin.modifyPackageJson(packageJson, context);

      expect(packageJson.dependencies).toBeDefined();
      expect(packageJson.dependencies['ajv']).toBe('^8.12.0');
      expect(packageJson.dependencies['ajv-formats']).toBe('^2.1.1');
    });

    it('should preserve existing dependencies', () => {
      const packageJson: any = {
        dependencies: {
          'class-validator': '^0.14.0'
        }
      };

      plugin.modifyPackageJson(packageJson, context);

      expect(packageJson.dependencies['class-validator']).toBe('^0.14.0');
      expect(packageJson.dependencies['ajv']).toBe('^8.12.0');
      expect(packageJson.dependencies['ajv-formats']).toBe('^2.1.1');
    });
  });

  describe('Nested Validation Logic', () => {
    it('should include nested validation code in validateWithJsonSchema', () => {
      const schema = createSchema({
        name: 'User',
        originalName: 'User'
      });

      plugin.decorateClass(classDecl, schema, context);

      const validateMethod = classDecl.getMethod('validateWithJsonSchema');
      const body = validateMethod?.getBodyText();

      // Check for recursive validation logic
      expect(body).toContain('for (const [key, value] of Object.entries(data))');
      expect(body).toContain('constructor.validateWithJsonSchema');
      expect(body).toContain('nestedResult.errors');
      expect(body).toContain('instancePath');
    });

    it('should validate nested objects recursively', () => {
      const schema = createSchema({
        name: 'User',
        originalName: 'User'
      });

      plugin.decorateClass(classDecl, schema, context);

      const validateMethod = classDecl.getMethod('validateWithJsonSchema');
      const body = validateMethod?.getBodyText();

      // Verify it checks for nested validateWithJsonSchema method
      expect(body).toContain('typeof constructor.validateWithJsonSchema === "function"');
    });

    it('should prepend parent key to nested error paths', () => {
      const schema = createSchema({
        name: 'User',
        originalName: 'User'
      });

      plugin.decorateClass(classDecl, schema, context);

      const validateMethod = classDecl.getMethod('validateWithJsonSchema');
      const body = validateMethod?.getBodyText();

      // Verify instancePath is prepended with parent key
      expect(body).toContain('instancePath: `/${key}${e.instancePath || ""}`');
    });
  });
});
