/**
 * Tests for NestJS GraphQL Plugin
 * Comprehensive coverage of @ObjectType and @Field decorator generation
 */

import { Project } from 'ts-morph';
import { NestJSGraphQLPlugin } from '../nestjs-graphql-plugin';
import { GenerationContext, GeneratorOptions } from '../../builders/class-builder';
import { ImportManager } from '../../builders/import-manager';
import {
  PropertyDefinition,
  TypeReference,
  IRHelpers as ImportedIRHelpers,
} from '../../ir/types';

const createPropertyWithOptions = (
  name: string,
  type: TypeReference,
  options: {
    required?: boolean;
    description?: string;
    format?: string;
    nullable?: boolean;
    deprecated?: boolean;
  } = {}
): PropertyDefinition => {
  const property = ImportedIRHelpers.createProperty(name, type);

  return {
    ...property,
    description: options.description,
    required: options.required ?? false,
    nullable: options.nullable ?? false,
    format: options.format,
    metadata: {
      deprecated: options.deprecated,
    },
  };
};

describe('NestJSGraphQLPlugin', () => {
  let plugin: NestJSGraphQLPlugin;
  let project: Project;
  let context: GenerationContext;
  let importManager: ImportManager;

  beforeEach(() => {
    plugin = new NestJSGraphQLPlugin();
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
      expect(plugin.name).toBe('nestjs-graphql');
      expect(plugin.priority).toBe(100);
    });
  });

  describe('beforeGeneration', () => {
    it('should add ObjectType and Field imports', () => {
      const ir = ImportedIRHelpers.createSchemaIR();
      plugin.beforeGeneration(context, ir);

      expect(importManager.hasImport('@nestjs/graphql')).toBe(true);
    });
  });

  describe('decorateClass', () => {
    it('should add @ObjectType() to object schema', () => {
      const sourceFile = project.createSourceFile('test.ts', 'export class User {}');
      const classDecl = sourceFile.getClass('User')!;
      const schema = ImportedIRHelpers.createSchema('User');

      plugin.decorateClass(classDecl, schema, context);

      const decorator = classDecl.getDecorator('ObjectType');
      expect(decorator).toBeDefined();
    });

    it('should add description to @ObjectType when present', () => {
      const sourceFile = project.createSourceFile('test.ts', 'export class User {}');
      const classDecl = sourceFile.getClass('User')!;
      const schema = ImportedIRHelpers.createSchema('User');
      schema.description = 'A user entity';

      plugin.decorateClass(classDecl, schema, context);

      const decorator = classDecl.getDecorator('ObjectType');
      expect(decorator).toBeDefined();
      const text = decorator!.getText();
      expect(text).toContain('description: `A user entity`');
    });

    it('should skip non-object schemas (enum)', () => {
      const sourceFile = project.createSourceFile('test.ts', 'export class Status {}');
      const classDecl = sourceFile.getClass('Status')!;
      const schema = ImportedIRHelpers.createSchema('Status');
      (schema as any).type = 'enum';

      plugin.decorateClass(classDecl, schema, context);

      const decorator = classDecl.getDecorator('ObjectType');
      expect(decorator).toBeUndefined();
    });
  });

  describe('decorateProperty - basic types', () => {
    it('should add @Field(() => String) for string property', () => {
      const sourceFile = project.createSourceFile('test.ts', 'export class User {}');
      const classDecl = sourceFile.getClass('User')!;
      const propertyDecl = classDecl.addProperty({ name: 'name', type: 'string' });

      const schema = ImportedIRHelpers.createSchema('User');
      const propertyDef = createPropertyWithOptions(
        'name',
        ImportedIRHelpers.createTypeReference('primitive', 'string'),
        { required: true }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      const decorator = propertyDecl.getDecorator('Field');
      expect(decorator).toBeDefined();
      const text = decorator!.getText();
      expect(text).toContain('() => String');
    });

    it('should add @Field(() => Float) for number property', () => {
      const sourceFile = project.createSourceFile('test.ts', 'export class User {}');
      const classDecl = sourceFile.getClass('User')!;
      const propertyDecl = classDecl.addProperty({ name: 'score', type: 'number' });

      const schema = ImportedIRHelpers.createSchema('User');
      const propertyDef = createPropertyWithOptions(
        'score',
        ImportedIRHelpers.createTypeReference('primitive', 'number'),
        { required: true }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      const text = propertyDecl.getDecorator('Field')!.getText();
      expect(text).toContain('() => Float');
    });

    it('should add @Field(() => Int) for int32 format', () => {
      const sourceFile = project.createSourceFile('test.ts', 'export class User {}');
      const classDecl = sourceFile.getClass('User')!;
      const propertyDecl = classDecl.addProperty({ name: 'age', type: 'number' });

      const schema = ImportedIRHelpers.createSchema('User');
      const propertyDef = createPropertyWithOptions(
        'age',
        ImportedIRHelpers.createTypeReference('primitive', 'number'),
        { required: true, format: 'int32' }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      const text = propertyDecl.getDecorator('Field')!.getText();
      expect(text).toContain('() => Int');
    });

    it('should add @Field(() => Int) for int64 format', () => {
      const sourceFile = project.createSourceFile('test.ts', 'export class User {}');
      const classDecl = sourceFile.getClass('User')!;
      const propertyDecl = classDecl.addProperty({ name: 'bigNum', type: 'number' });

      const schema = ImportedIRHelpers.createSchema('User');
      const propertyDef = createPropertyWithOptions(
        'bigNum',
        ImportedIRHelpers.createTypeReference('primitive', 'number'),
        { required: true, format: 'int64' }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      const text = propertyDecl.getDecorator('Field')!.getText();
      expect(text).toContain('() => Int');
    });

    it('should add @Field(() => Boolean) for boolean property', () => {
      const sourceFile = project.createSourceFile('test.ts', 'export class User {}');
      const classDecl = sourceFile.getClass('User')!;
      const propertyDecl = classDecl.addProperty({ name: 'active', type: 'boolean' });

      const schema = ImportedIRHelpers.createSchema('User');
      const propertyDef = createPropertyWithOptions(
        'active',
        ImportedIRHelpers.createTypeReference('primitive', 'boolean'),
        { required: true }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      const text = propertyDecl.getDecorator('Field')!.getText();
      expect(text).toContain('() => Boolean');
    });

    it('should add @Field(() => ID) for uuid format', () => {
      const sourceFile = project.createSourceFile('test.ts', 'export class User {}');
      const classDecl = sourceFile.getClass('User')!;
      const propertyDecl = classDecl.addProperty({ name: 'id', type: 'string' });

      const schema = ImportedIRHelpers.createSchema('User');
      const propertyDef = createPropertyWithOptions(
        'id',
        ImportedIRHelpers.createTypeReference('primitive', 'string'),
        { required: true, format: 'uuid' }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      const text = propertyDecl.getDecorator('Field')!.getText();
      expect(text).toContain('() => ID');
    });
  });

  describe('decorateProperty - complex types', () => {
    it('should add @Field(() => ClassName) for reference type', () => {
      const sourceFile = project.createSourceFile('test.ts', 'export class User {}');
      const classDecl = sourceFile.getClass('User')!;
      const propertyDecl = classDecl.addProperty({ name: 'address', type: 'Address' });

      const schema = ImportedIRHelpers.createSchema('User');
      const propertyDef = createPropertyWithOptions(
        'address',
        ImportedIRHelpers.createTypeReference('reference', 'Address'),
        { required: true }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      const text = propertyDecl.getDecorator('Field')!.getText();
      expect(text).toContain('() => Address');
    });

    it('should add @Field(() => [String]) for array of primitives', () => {
      const sourceFile = project.createSourceFile('test.ts', 'export class User {}');
      const classDecl = sourceFile.getClass('User')!;
      const propertyDecl = classDecl.addProperty({ name: 'tags', type: 'Array<string>' });

      const schema = ImportedIRHelpers.createSchema('User');
      const propertyDef = createPropertyWithOptions(
        'tags',
        ImportedIRHelpers.createTypeReference('array', 'Array',
          ImportedIRHelpers.createTypeReference('primitive', 'string')
        ),
        { required: true }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      const text = propertyDecl.getDecorator('Field')!.getText();
      expect(text).toContain('() => [String]');
    });

    it('should add @Field(() => [ClassName]) for array of references', () => {
      const sourceFile = project.createSourceFile('test.ts', 'export class User {}');
      const classDecl = sourceFile.getClass('User')!;
      const propertyDecl = classDecl.addProperty({ name: 'friends', type: 'Array<User>' });

      const schema = ImportedIRHelpers.createSchema('User');
      const propertyDef = createPropertyWithOptions(
        'friends',
        ImportedIRHelpers.createTypeReference('array', 'Array',
          ImportedIRHelpers.createTypeReference('reference', 'User')
        ),
        { required: false }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      const text = propertyDecl.getDecorator('Field')!.getText();
      expect(text).toContain('() => [User]');
    });
  });

  describe('decorateProperty - skipped types', () => {
    it('should skip dictionary type', () => {
      const sourceFile = project.createSourceFile('test.ts', 'export class User {}');
      const classDecl = sourceFile.getClass('User')!;
      const propertyDecl = classDecl.addProperty({ name: 'labels', type: '{ [key: string]: string }' });

      const schema = ImportedIRHelpers.createSchema('User');
      const propertyDef = createPropertyWithOptions(
        'labels',
        ImportedIRHelpers.createTypeReference('dictionary', 'string'),
        { required: false }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      expect(propertyDecl.getDecorator('Field')).toBeUndefined();
    });

    it('should skip union type', () => {
      const sourceFile = project.createSourceFile('test.ts', 'export class User {}');
      const classDecl = sourceFile.getClass('User')!;
      const propertyDecl = classDecl.addProperty({ name: 'value', type: 'string | number' });

      const schema = ImportedIRHelpers.createSchema('User');
      const propertyDef = createPropertyWithOptions(
        'value',
        ImportedIRHelpers.createTypeReference('union', 'string | number'),
        { required: true }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      expect(propertyDecl.getDecorator('Field')).toBeUndefined();
    });

    it('should skip unknown type', () => {
      const sourceFile = project.createSourceFile('test.ts', 'export class User {}');
      const classDecl = sourceFile.getClass('User')!;
      const propertyDecl = classDecl.addProperty({ name: 'data', type: 'any' });

      const schema = ImportedIRHelpers.createSchema('User');
      const propertyDef = createPropertyWithOptions(
        'data',
        ImportedIRHelpers.createTypeReference('unknown', 'any'),
        { required: false }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      expect(propertyDecl.getDecorator('Field')).toBeUndefined();
    });
  });

  describe('decorateProperty - options', () => {
    it('should add nullable: true when not required', () => {
      const sourceFile = project.createSourceFile('test.ts', 'export class User {}');
      const classDecl = sourceFile.getClass('User')!;
      const propertyDecl = classDecl.addProperty({ name: 'email', type: 'string' });

      const schema = ImportedIRHelpers.createSchema('User');
      const propertyDef = createPropertyWithOptions(
        'email',
        ImportedIRHelpers.createTypeReference('primitive', 'string'),
        { required: false }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      const text = propertyDecl.getDecorator('Field')!.getText();
      expect(text).toContain('nullable: true');
    });

    it('should add nullable: true when nullable', () => {
      const sourceFile = project.createSourceFile('test.ts', 'export class User {}');
      const classDecl = sourceFile.getClass('User')!;
      const propertyDecl = classDecl.addProperty({ name: 'email', type: 'string' });

      const schema = ImportedIRHelpers.createSchema('User');
      const propertyDef = createPropertyWithOptions(
        'email',
        ImportedIRHelpers.createTypeReference('primitive', 'string'),
        { required: true, nullable: true }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      const text = propertyDecl.getDecorator('Field')!.getText();
      expect(text).toContain('nullable: true');
    });

    it('should not add nullable when required and not nullable', () => {
      const sourceFile = project.createSourceFile('test.ts', 'export class User {}');
      const classDecl = sourceFile.getClass('User')!;
      const propertyDecl = classDecl.addProperty({ name: 'name', type: 'string' });

      const schema = ImportedIRHelpers.createSchema('User');
      const propertyDef = createPropertyWithOptions(
        'name',
        ImportedIRHelpers.createTypeReference('primitive', 'string'),
        { required: true }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      const text = propertyDecl.getDecorator('Field')!.getText();
      expect(text).not.toContain('nullable');
    });

    it('should add description', () => {
      const sourceFile = project.createSourceFile('test.ts', 'export class User {}');
      const classDecl = sourceFile.getClass('User')!;
      const propertyDecl = classDecl.addProperty({ name: 'name', type: 'string' });

      const schema = ImportedIRHelpers.createSchema('User');
      const propertyDef = createPropertyWithOptions(
        'name',
        ImportedIRHelpers.createTypeReference('primitive', 'string'),
        { required: true, description: 'The user name' }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      const text = propertyDecl.getDecorator('Field')!.getText();
      expect(text).toContain('description: `The user name`');
    });

    it('should add deprecationReason when deprecated', () => {
      const sourceFile = project.createSourceFile('test.ts', 'export class User {}');
      const classDecl = sourceFile.getClass('User')!;
      const propertyDecl = classDecl.addProperty({ name: 'oldField', type: 'string' });

      const schema = ImportedIRHelpers.createSchema('User');
      const propertyDef = createPropertyWithOptions(
        'oldField',
        ImportedIRHelpers.createTypeReference('primitive', 'string'),
        { required: false, deprecated: true }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      const text = propertyDecl.getDecorator('Field')!.getText();
      expect(text).toContain('deprecationReason: `Deprecated`');
    });
  });

  describe('decorateProperty - escaping', () => {
    it('should escape backticks in description', () => {
      const sourceFile = project.createSourceFile('test.ts', 'export class User {}');
      const classDecl = sourceFile.getClass('User')!;
      const propertyDecl = classDecl.addProperty({ name: 'code', type: 'string' });

      const schema = ImportedIRHelpers.createSchema('User');
      const propertyDef = createPropertyWithOptions(
        'code',
        ImportedIRHelpers.createTypeReference('primitive', 'string'),
        { required: true, description: 'Use `backticks` for code' }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      const text = propertyDecl.getDecorator('Field')!.getText();
      expect(text).toContain('description: `Use \\`backticks\\` for code`');
    });

    it('should escape dollar signs in description', () => {
      const sourceFile = project.createSourceFile('test.ts', 'export class User {}');
      const classDecl = sourceFile.getClass('User')!;
      const propertyDecl = classDecl.addProperty({ name: 'price', type: 'number' });

      const schema = ImportedIRHelpers.createSchema('User');
      const propertyDef = createPropertyWithOptions(
        'price',
        ImportedIRHelpers.createTypeReference('primitive', 'number'),
        { required: true, description: 'Price in $USD' }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      const text = propertyDecl.getDecorator('Field')!.getText();
      expect(text).toContain('description: `Price in \\$USD`');
    });
  });

  describe('decorateProperty - imports', () => {
    it('should add Int import when int32 field exists', () => {
      const sourceFile = project.createSourceFile('test.ts', 'export class User {}');
      const classDecl = sourceFile.getClass('User')!;
      const propertyDecl = classDecl.addProperty({ name: 'age', type: 'number' });

      const schema = ImportedIRHelpers.createSchema('User');
      const propertyDef = createPropertyWithOptions(
        'age',
        ImportedIRHelpers.createTypeReference('primitive', 'number'),
        { required: true, format: 'int32' }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      expect(importManager.hasImport('@nestjs/graphql')).toBe(true);
    });

    it('should add Float import when float field exists', () => {
      const sourceFile = project.createSourceFile('test.ts', 'export class User {}');
      const classDecl = sourceFile.getClass('User')!;
      const propertyDecl = classDecl.addProperty({ name: 'score', type: 'number' });

      const schema = ImportedIRHelpers.createSchema('User');
      const propertyDef = createPropertyWithOptions(
        'score',
        ImportedIRHelpers.createTypeReference('primitive', 'number'),
        { required: true }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      expect(importManager.hasImport('@nestjs/graphql')).toBe(true);
    });

    it('should add ID import when uuid field exists', () => {
      const sourceFile = project.createSourceFile('test.ts', 'export class User {}');
      const classDecl = sourceFile.getClass('User')!;
      const propertyDecl = classDecl.addProperty({ name: 'id', type: 'string' });

      const schema = ImportedIRHelpers.createSchema('User');
      const propertyDef = createPropertyWithOptions(
        'id',
        ImportedIRHelpers.createTypeReference('primitive', 'string'),
        { required: true, format: 'uuid' }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      expect(importManager.hasImport('@nestjs/graphql')).toBe(true);
    });
  });

  describe('decorateEnum', () => {
    it('should add registerEnumType call for enum schema', () => {
      const sourceFile = project.createSourceFile('status.ts',
        `export enum Status {\n  Active = 'active',\n  Inactive = 'inactive',\n}`
      );
      const schema = ImportedIRHelpers.createSchema('Status');
      schema.type = 'enum';
      schema.enumValues = ['active', 'inactive'];

      plugin.decorateEnum(sourceFile, schema, context);

      const text = sourceFile.getFullText();
      expect(text).toContain('registerEnumType(Status');
      expect(text).toContain("name: 'Status'");
      expect(importManager.hasImport('@nestjs/graphql')).toBe(true);
    });

    it('should include description in registerEnumType when present', () => {
      const sourceFile = project.createSourceFile('status2.ts',
        `export enum Status {\n  Active = 'active',\n}`
      );
      const schema = ImportedIRHelpers.createSchema('Status');
      schema.type = 'enum';
      schema.enumValues = ['active'];
      schema.description = 'Entity status';

      plugin.decorateEnum(sourceFile, schema, context);

      const text = sourceFile.getFullText();
      expect(text).toContain('description: `Entity status`');
    });

    it('should escape special characters in enum description', () => {
      const sourceFile = project.createSourceFile('mode.ts',
        `export enum Mode {\n  Fast = 'fast',\n}`
      );
      const schema = ImportedIRHelpers.createSchema('Mode');
      schema.type = 'enum';
      schema.enumValues = ['fast'];
      schema.description = 'Use `mode` with $variable';

      plugin.decorateEnum(sourceFile, schema, context);

      const text = sourceFile.getFullText();
      expect(text).toContain('\\`mode\\`');
      expect(text).toContain('\\$variable');
    });
  });

  describe('modifyPackageJson', () => {
    it('should add @nestjs/graphql to existing dependencies', () => {
      const packageJson: any = {
        name: 'test-package',
        version: '1.0.0',
        dependencies: {
          'class-transformer': '^0.5.1',
        },
      };

      plugin.modifyPackageJson(packageJson, context);

      expect(packageJson.dependencies['@nestjs/graphql']).toBe('^12.0.0');
      expect(packageJson.dependencies['class-transformer']).toBe('^0.5.1');
    });

    it('should create dependencies object if it does not exist', () => {
      const packageJson = {
        name: 'test-package',
        version: '1.0.0',
      };

      plugin.modifyPackageJson(packageJson, context);

      expect((packageJson as any).dependencies['@nestjs/graphql']).toBe('^12.0.0');
    });
  });
});
