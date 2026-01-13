/**
 * Tests for NestJS Swagger Plugin
 * Comprehensive coverage of @ApiProperty decorator generation
 */

import { Project, SyntaxKind } from 'ts-morph';
import { NestJSSwaggerPlugin } from '../nestjs-swagger-plugin';
import { GenerationContext, GeneratorOptions } from '../../builders/class-builder';
import { ImportManager } from '../../builders/import-manager';
import {
  SchemaDefinition,
  PropertyDefinition,
  TypeReference,
  SchemaIR,
  PropertyMetadata,
  Constraints,
  IRHelpers as ImportedIRHelpers,
} from '../../ir/types';

/**
 * Helper to create test properties with custom options
 */
const createPropertyWithOptions = (
  name: string,
  type: TypeReference,
  options: {
    required?: boolean;
    description?: string;
    format?: string;
    nullable?: boolean;
    example?: any;
    deprecated?: boolean;
    constraints?: Constraints;
  } = {}
): PropertyDefinition => {
  const property = ImportedIRHelpers.createProperty(name, type);

  return {
    ...property,
    description: options.description,
    required: options.required ?? false,
    nullable: options.nullable ?? false,
    format: options.format,
    example: options.example,
    constraints: options.constraints,
    metadata: {
      deprecated: options.deprecated,
    },
  };
};

describe('NestJSSwaggerPlugin', () => {
  let plugin: NestJSSwaggerPlugin;
  let project: Project;
  let context: GenerationContext;
  let importManager: ImportManager;

  beforeEach(() => {
    plugin = new NestJSSwaggerPlugin();
    project = new Project({ useInMemoryFileSystem: true });
    importManager = new ImportManager({ esm: false });
    const options: GeneratorOptions = {
      outputDir: '/test/output',
      esm: false,
    };
    context = {
      importManager,
      project,
      options,
    };
  });

  describe('plugin metadata', () => {
    it('should have correct name and priority', () => {
      expect(plugin.name).toBe('nestjs-swagger');
      expect(plugin.priority).toBe(100);
    });
  });

  describe('beforeGeneration', () => {
    it('should add ApiProperty import', () => {
      const ir = ImportedIRHelpers.createSchemaIR();
      plugin.beforeGeneration(context, ir);

      expect(importManager.hasImport('@nestjs/swagger')).toBe(true);
    });
  });

  describe('decorateProperty - basic types', () => {
    it('should add @ApiProperty for string property', () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        'export class User {}'
      );
      const classDecl = sourceFile.getClass('User')!;
      const propertyDecl = classDecl.addProperty({
        name: 'name',
        type: 'string',
      });

      const schema = ImportedIRHelpers.createSchema('User');
      const propertyDef = createPropertyWithOptions(
        'name',
        ImportedIRHelpers.createTypeReference('primitive', 'string'),
        { required: true, description: 'User name' }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      const decorator = propertyDecl.getDecorator('ApiProperty');
      expect(decorator).toBeDefined();

      const decoratorText = decorator!.getText();
      expect(decoratorText).toContain('type: String');
      expect(decoratorText).toContain('description: `User name`');
      expect(decoratorText).toContain('required: true');
    });

    it('should add @ApiProperty for number property', () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        'export class User {}'
      );
      const classDecl = sourceFile.getClass('User')!;
      const propertyDecl = classDecl.addProperty({
        name: 'age',
        type: 'number',
      });

      const schema = ImportedIRHelpers.createSchema('User');
      const propertyDef = createPropertyWithOptions(
        'age',
        ImportedIRHelpers.createTypeReference('primitive', 'number'),
        { required: true }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      const decorator = propertyDecl.getDecorator('ApiProperty');
      expect(decorator).toBeDefined();

      const decoratorText = decorator!.getText();
      expect(decoratorText).toContain('type: Number');
      expect(decoratorText).toContain('required: true');
    });

    it('should add @ApiProperty for boolean property', () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        'export class User {}'
      );
      const classDecl = sourceFile.getClass('User')!;
      const propertyDecl = classDecl.addProperty({
        name: 'active',
        type: 'boolean',
      });

      const schema = ImportedIRHelpers.createSchema('User');
      const propertyDef = createPropertyWithOptions(
        'active',
        ImportedIRHelpers.createTypeReference('primitive', 'boolean'),
        { required: false }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      const decorator = propertyDecl.getDecorator('ApiProperty');
      expect(decorator).toBeDefined();

      const decoratorText = decorator!.getText();
      expect(decoratorText).toContain('type: Boolean');
      expect(decoratorText).toContain('required: false');
    });

    it('should handle unknown primitive type with default String', () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        'export class User {}'
      );
      const classDecl = sourceFile.getClass('User')!;
      const propertyDecl = classDecl.addProperty({
        name: 'custom',
        type: 'any',
      });

      const schema = ImportedIRHelpers.createSchema('User');
      const propertyDef = createPropertyWithOptions(
        'custom',
        ImportedIRHelpers.createTypeReference('primitive', 'unknown' as any),
        { required: true }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      const decorator = propertyDecl.getDecorator('ApiProperty');
      expect(decorator).toBeDefined();

      const decoratorText = decorator!.getText();
      expect(decoratorText).toContain('type: String');
    });
  });

  describe('decorateProperty - optional fields', () => {
    it('should add nullable option when property is nullable', () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        'export class User {}'
      );
      const classDecl = sourceFile.getClass('User')!;
      const propertyDecl = classDecl.addProperty({
        name: 'email',
        type: 'string',
      });

      const schema = ImportedIRHelpers.createSchema('User');
      const propertyDef = createPropertyWithOptions(
        'email',
        ImportedIRHelpers.createTypeReference('primitive', 'string'),
        { required: false, nullable: true }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      const decoratorText = propertyDecl.getDecorator('ApiProperty')!.getText();
      expect(decoratorText).toContain('nullable: true');
    });

    it('should add format option when specified', () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        'export class User {}'
      );
      const classDecl = sourceFile.getClass('User')!;
      const propertyDecl = classDecl.addProperty({
        name: 'email',
        type: 'string',
      });

      const schema = ImportedIRHelpers.createSchema('User');
      const propertyDef = createPropertyWithOptions(
        'email',
        ImportedIRHelpers.createTypeReference('primitive', 'string'),
        { required: true, format: 'email' }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      const decoratorText = propertyDecl.getDecorator('ApiProperty')!.getText();
      expect(decoratorText).toContain('format: `email`');
    });

    it('should add example option when specified', () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        'export class User {}'
      );
      const classDecl = sourceFile.getClass('User')!;
      const propertyDecl = classDecl.addProperty({
        name: 'name',
        type: 'string',
      });

      const schema = ImportedIRHelpers.createSchema('User');
      const propertyDef = createPropertyWithOptions(
        'name',
        ImportedIRHelpers.createTypeReference('primitive', 'string'),
        { required: true, example: 'John Doe' }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      const decoratorText = propertyDecl.getDecorator('ApiProperty')!.getText();
      expect(decoratorText).toContain('example: `John Doe`');
    });

    it('should add deprecated option when property is deprecated', () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        'export class User {}'
      );
      const classDecl = sourceFile.getClass('User')!;
      const propertyDecl = classDecl.addProperty({
        name: 'oldField',
        type: 'string',
      });

      const schema = ImportedIRHelpers.createSchema('User');
      const propertyDef = createPropertyWithOptions(
        'oldField',
        ImportedIRHelpers.createTypeReference('primitive', 'string'),
        { required: false, deprecated: true }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      const decoratorText = propertyDecl.getDecorator('ApiProperty')!.getText();
      expect(decoratorText).toContain('deprecated: true');
    });
  });

  describe('decorateProperty - constraints', () => {
    it('should add minimum and maximum for number constraints', () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        'export class User {}'
      );
      const classDecl = sourceFile.getClass('User')!;
      const propertyDecl = classDecl.addProperty({
        name: 'age',
        type: 'number',
      });

      const schema = ImportedIRHelpers.createSchema('User');
      const propertyDef = createPropertyWithOptions(
        'age',
        ImportedIRHelpers.createTypeReference('primitive', 'number'),
        {
          required: true,
          constraints: {
            minimum: 0,
            maximum: 120,
          },
        }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      const decoratorText = propertyDecl.getDecorator('ApiProperty')!.getText();
      expect(decoratorText).toContain('minimum: 0');
      expect(decoratorText).toContain('maximum: 120');
    });

    it('should add minLength and maxLength for string constraints', () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        'export class User {}'
      );
      const classDecl = sourceFile.getClass('User')!;
      const propertyDecl = classDecl.addProperty({
        name: 'username',
        type: 'string',
      });

      const schema = ImportedIRHelpers.createSchema('User');
      const propertyDef = createPropertyWithOptions(
        'username',
        ImportedIRHelpers.createTypeReference('primitive', 'string'),
        {
          required: true,
          constraints: {
            minLength: 3,
            maxLength: 20,
          },
        }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      const decoratorText = propertyDecl.getDecorator('ApiProperty')!.getText();
      expect(decoratorText).toContain('minLength: 3');
      expect(decoratorText).toContain('maxLength: 20');
    });

    it('should add pattern for regex constraints', () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        'export class User {}'
      );
      const classDecl = sourceFile.getClass('User')!;
      const propertyDecl = classDecl.addProperty({
        name: 'code',
        type: 'string',
      });

      const schema = ImportedIRHelpers.createSchema('User');
      const propertyDef = createPropertyWithOptions(
        'code',
        ImportedIRHelpers.createTypeReference('primitive', 'string'),
        {
          required: true,
          constraints: {
            pattern: '^[A-Z]{3}$',
          },
        }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      const decoratorText = propertyDecl.getDecorator('ApiProperty')!.getText();
      expect(decoratorText).toContain('pattern: `^[A-Z]{3}$`');
    });

    it('should add minItems, maxItems, and uniqueItems for array constraints', () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        'export class User {}'
      );
      const classDecl = sourceFile.getClass('User')!;
      const propertyDecl = classDecl.addProperty({
        name: 'tags',
        type: 'Array<string>',
      });

      const schema = ImportedIRHelpers.createSchema('User');
      const propertyDef = createPropertyWithOptions(
        'tags',
        ImportedIRHelpers.createTypeReference('array', 'Array',
          ImportedIRHelpers.createTypeReference('primitive', 'string')
        ),
        {
          required: true,
          constraints: {
            minItems: 1,
            maxItems: 10,
            uniqueItems: true,
          },
        }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      const decoratorText = propertyDecl.getDecorator('ApiProperty')!.getText();
      expect(decoratorText).toContain('minItems: 1');
      expect(decoratorText).toContain('maxItems: 10');
      expect(decoratorText).toContain('uniqueItems: true');
    });

    it('should add enum constraint', () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        'export class User {}'
      );
      const classDecl = sourceFile.getClass('User')!;
      const propertyDecl = classDecl.addProperty({
        name: 'status',
        type: 'string',
      });

      const schema = ImportedIRHelpers.createSchema('User');
      const propertyDef = createPropertyWithOptions(
        'status',
        ImportedIRHelpers.createTypeReference('primitive', 'string'),
        {
          required: true,
          constraints: {
            enum: ['active', 'inactive', 'pending'],
          },
        }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      const decoratorText = propertyDecl.getDecorator('ApiProperty')!.getText();
      expect(decoratorText).toContain('enum: ["active","inactive","pending"]');
    });
  });

  describe('decorateProperty - complex types', () => {
    it('should handle array of primitives', () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        'export class User {}'
      );
      const classDecl = sourceFile.getClass('User')!;
      const propertyDecl = classDecl.addProperty({
        name: 'tags',
        type: 'Array<string>',
      });

      const schema = ImportedIRHelpers.createSchema('User');
      const propertyDef = createPropertyWithOptions(
        'tags',
        ImportedIRHelpers.createTypeReference('array', 'Array',
          ImportedIRHelpers.createTypeReference('primitive', 'string')
        ),
        { required: true }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      const decoratorText = propertyDecl.getDecorator('ApiProperty')!.getText();
      expect(decoratorText).toContain('type: [String]');
    });

    it('should handle array of objects (reference)', () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        'export class User {}'
      );
      const classDecl = sourceFile.getClass('User')!;
      const propertyDecl = classDecl.addProperty({
        name: 'addresses',
        type: 'Array<Address>',
      });

      const schema = ImportedIRHelpers.createSchema('User');
      const propertyDef = createPropertyWithOptions(
        'addresses',
        ImportedIRHelpers.createTypeReference('array', 'Array',
          ImportedIRHelpers.createTypeReference('reference', 'Address')
        ),
        { required: false }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      const decoratorText = propertyDecl.getDecorator('ApiProperty')!.getText();
      expect(decoratorText).toContain('type: [Address]');
    });

    it('should handle array without elementType', () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        'export class User {}'
      );
      const classDecl = sourceFile.getClass('User')!;
      const propertyDecl = classDecl.addProperty({
        name: 'items',
        type: 'Array<any>',
      });

      const schema = ImportedIRHelpers.createSchema('User');
      const arrayType = ImportedIRHelpers.createTypeReference('array', 'Array');
      delete (arrayType as any).elementType; // Remove elementType to test edge case

      const propertyDef = createPropertyWithOptions(
        'items',
        arrayType,
        { required: true }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      const decoratorText = propertyDecl.getDecorator('ApiProperty')!.getText();
      expect(decoratorText).toContain('type: [Object]');
    });

    it('should handle array with unknown elementType kind', () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        'export class User {}'
      );
      const classDecl = sourceFile.getClass('User')!;
      const propertyDecl = classDecl.addProperty({
        name: 'items',
        type: 'Array<any>',
      });

      const schema = ImportedIRHelpers.createSchema('User');
      const propertyDef = createPropertyWithOptions(
        'items',
        ImportedIRHelpers.createTypeReference('array', 'Array',
          ImportedIRHelpers.createTypeReference('union' as any, 'unknown')
        ),
        { required: true }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      const decoratorText = propertyDecl.getDecorator('ApiProperty')!.getText();
      expect(decoratorText).toContain('type: [Object]');
    });

    it('should handle object reference with arrow function', () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        'export class User {}'
      );
      const classDecl = sourceFile.getClass('User')!;
      const propertyDecl = classDecl.addProperty({
        name: 'profile',
        type: 'UserProfile',
      });

      const schema = ImportedIRHelpers.createSchema('User');
      const propertyDef = createPropertyWithOptions(
        'profile',
        ImportedIRHelpers.createTypeReference('reference', 'UserProfile'),
        { required: false }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      const decoratorText = propertyDecl.getDecorator('ApiProperty')!.getText();
      expect(decoratorText).toContain('type: () => UserProfile');
    });

    it('should handle nested object type', () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        'export class User {}'
      );
      const classDecl = sourceFile.getClass('User')!;
      const propertyDecl = classDecl.addProperty({
        name: 'metadata',
        type: 'Metadata',
      });

      const schema = ImportedIRHelpers.createSchema('User');
      const propertyDef = createPropertyWithOptions(
        'metadata',
        ImportedIRHelpers.createTypeReference('object', 'Metadata'),
        { required: true }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      const decoratorText = propertyDecl.getDecorator('ApiProperty')!.getText();
      expect(decoratorText).toContain('type: () => Metadata');
    });

    it('should handle dictionary type with Object', () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        'export class User {}'
      );
      const classDecl = sourceFile.getClass('User')!;
      const propertyDecl = classDecl.addProperty({
        name: 'labels',
        type: '{ [key: string]: string }',
      });

      const schema = ImportedIRHelpers.createSchema('User');
      const propertyDef = createPropertyWithOptions(
        'labels',
        ImportedIRHelpers.createTypeReference('dictionary', 'string'),
        { required: false }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      const decoratorText = propertyDecl.getDecorator('ApiProperty')!.getText();
      expect(decoratorText).toContain('type: Object');
    });

    it('should handle union type with Object', () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        'export class User {}'
      );
      const classDecl = sourceFile.getClass('User')!;
      const propertyDecl = classDecl.addProperty({
        name: 'value',
        type: 'string | number',
      });

      const schema = ImportedIRHelpers.createSchema('User');
      const propertyDef = createPropertyWithOptions(
        'value',
        ImportedIRHelpers.createTypeReference('union', 'string | number'),
        { required: true }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      const decoratorText = propertyDecl.getDecorator('ApiProperty')!.getText();
      expect(decoratorText).toContain('type: Object');
    });

    it('should handle unknown type with Object', () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        'export class User {}'
      );
      const classDecl = sourceFile.getClass('User')!;
      const propertyDecl = classDecl.addProperty({
        name: 'data',
        type: 'any',
      });

      const schema = ImportedIRHelpers.createSchema('User');
      const propertyDef = createPropertyWithOptions(
        'data',
        ImportedIRHelpers.createTypeReference('unknown', 'any'),
        { required: false }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      const decoratorText = propertyDecl.getDecorator('ApiProperty')!.getText();
      expect(decoratorText).toContain('type: Object');
    });
  });

  describe('decorateProperty - special characters in description', () => {
    it('should escape backticks in description', () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        'export class User {}'
      );
      const classDecl = sourceFile.getClass('User')!;
      const propertyDecl = classDecl.addProperty({
        name: 'code',
        type: 'string',
      });

      const schema = ImportedIRHelpers.createSchema('User');
      const propertyDef = createPropertyWithOptions(
        'code',
        ImportedIRHelpers.createTypeReference('primitive', 'string'),
        { required: true, description: 'Use `backticks` for code' }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      const decoratorText = propertyDecl.getDecorator('ApiProperty')!.getText();
      expect(decoratorText).toContain('description: `Use \\`backticks\\` for code`');
    });

    it('should escape dollar signs in description', () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        'export class User {}'
      );
      const classDecl = sourceFile.getClass('User')!;
      const propertyDecl = classDecl.addProperty({
        name: 'price',
        type: 'number',
      });

      const schema = ImportedIRHelpers.createSchema('User');
      const propertyDef = createPropertyWithOptions(
        'price',
        ImportedIRHelpers.createTypeReference('primitive', 'number'),
        { required: true, description: 'Price in $USD' }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      const decoratorText = propertyDecl.getDecorator('ApiProperty')!.getText();
      expect(decoratorText).toContain('description: `Price in \\$USD`');
    });

    it('should escape backslashes in description', () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        'export class User {}'
      );
      const classDecl = sourceFile.getClass('User')!;
      const propertyDecl = classDecl.addProperty({
        name: 'path',
        type: 'string',
      });

      const schema = ImportedIRHelpers.createSchema('User');
      const propertyDef = createPropertyWithOptions(
        'path',
        ImportedIRHelpers.createTypeReference('primitive', 'string'),
        { required: true, description: 'Windows path: C:\\Users\\file' }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      const decoratorText = propertyDecl.getDecorator('ApiProperty')!.getText();
      expect(decoratorText).toContain('description: `Windows path: C:\\\\Users\\\\file`');
    });
  });

  describe('decorateProperty - options with object values', () => {
    it('should handle example with object value', () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        'export class User {}'
      );
      const classDecl = sourceFile.getClass('User')!;
      const propertyDecl = classDecl.addProperty({
        name: 'metadata',
        type: 'any',
      });

      const schema = ImportedIRHelpers.createSchema('User');
      const propertyDef = createPropertyWithOptions(
        'metadata',
        ImportedIRHelpers.createTypeReference('object', 'any'),
        {
          required: true,
          example: { key: 'value', nested: { foo: 'bar' } }
        }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      const decoratorText = propertyDecl.getDecorator('ApiProperty')!.getText();
      expect(decoratorText).toContain('example: {"key":"value","nested":{"foo":"bar"}}');
    });
  });

  describe('modifyPackageJson', () => {
    it('should add @nestjs/swagger to existing dependencies', () => {
      const packageJson: any = {
        name: 'test-package',
        version: '1.0.0',
        dependencies: {
          'class-transformer': '^0.5.1',
        },
      };

      plugin.modifyPackageJson(packageJson, context);

      expect(packageJson.dependencies['@nestjs/swagger']).toBe('^7.0.0');
      expect(packageJson.dependencies['class-transformer']).toBe('^0.5.1');
    });

    it('should create dependencies object if it does not exist', () => {
      const packageJson = {
        name: 'test-package',
        version: '1.0.0',
      };

      plugin.modifyPackageJson(packageJson, context);

      expect(packageJson).toHaveProperty('dependencies');
      expect((packageJson as any).dependencies['@nestjs/swagger']).toBe('^7.0.0');
    });
  });
});
