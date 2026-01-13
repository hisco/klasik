/**
 * Tests for ClassTransformer Plugin
 * Comprehensive coverage of @Expose and @Type decorator generation
 */

import { Project } from 'ts-morph';
import { ClassTransformerPlugin } from '../class-transformer-plugin';
import { GenerationContext, GeneratorOptions } from '../../builders/class-builder';
import { ImportManager } from '../../builders/import-manager';
import {
  PropertyDefinition,
  TypeReference,
  SchemaIR,
  IRHelpers,
} from '../../ir/types';

/**
 * Helper to create test properties
 */
const createPropertyWithType = (
  name: string,
  type: TypeReference
): PropertyDefinition => {
  return IRHelpers.createProperty(name, type);
};

describe('ClassTransformerPlugin', () => {
  let plugin: ClassTransformerPlugin;
  let project: Project;
  let context: GenerationContext;
  let importManager: ImportManager;

  beforeEach(() => {
    plugin = new ClassTransformerPlugin();
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
      expect(plugin.name).toBe('class-transformer');
      expect(plugin.priority).toBe(200);
    });
  });

  describe('beforeGeneration', () => {
    it('should add Expose and Type imports', () => {
      const ir = IRHelpers.createSchemaIR();
      plugin.beforeGeneration(context, ir);

      expect(importManager.hasImport('class-transformer')).toBe(true);
    });
  });

  describe('decorateProperty - @Expose decorator', () => {
    it('should always add @Expose decorator', () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        'export class User {}'
      );
      const classDecl = sourceFile.getClass('User')!;
      const propertyDecl = classDecl.addProperty({
        name: 'name',
        type: 'string',
      });

      const schema = IRHelpers.createSchema('User');
      const propertyDef = createPropertyWithType(
        'name',
        IRHelpers.createTypeReference('primitive', 'string')
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      expect(propertyDecl.getDecorator('Expose')).toBeDefined();
    });
  });

  describe('decorateProperty - @Type decorator for complex types', () => {
    it('should add @Type for reference type', () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        'export class User {}'
      );
      const classDecl = sourceFile.getClass('User')!;
      const propertyDecl = classDecl.addProperty({
        name: 'profile',
        type: 'UserProfile',
      });

      const schema = IRHelpers.createSchema('User');
      const propertyDef = createPropertyWithType(
        'profile',
        IRHelpers.createTypeReference('reference', 'UserProfile')
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      const typeDecorator = propertyDecl.getDecorator('Type');
      expect(typeDecorator).toBeDefined();
      expect(typeDecorator!.getText()).toContain('() => UserProfile');
    });

    it('should add @Type for object type', () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        'export class User {}'
      );
      const classDecl = sourceFile.getClass('User')!;
      const propertyDecl = classDecl.addProperty({
        name: 'settings',
        type: 'Settings',
      });

      const schema = IRHelpers.createSchema('User');
      const propertyDef = createPropertyWithType(
        'settings',
        IRHelpers.createTypeReference('object', 'Settings')
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      const typeDecorator = propertyDecl.getDecorator('Type');
      expect(typeDecorator).toBeDefined();
      expect(typeDecorator!.getText()).toContain('() => Settings');
    });

    it('should add @Type for array of references', () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        'export class User {}'
      );
      const classDecl = sourceFile.getClass('User')!;
      const propertyDecl = classDecl.addProperty({
        name: 'addresses',
        type: 'Array<Address>',
      });

      const schema = IRHelpers.createSchema('User');
      const propertyDef = createPropertyWithType(
        'addresses',
        IRHelpers.createTypeReference('array', 'Array',
          IRHelpers.createTypeReference('reference', 'Address')
        )
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      const typeDecorator = propertyDecl.getDecorator('Type');
      expect(typeDecorator).toBeDefined();
      expect(typeDecorator!.getText()).toContain('() => Address');
    });

    it('should add @Type for array of objects', () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        'export class User {}'
      );
      const classDecl = sourceFile.getClass('User')!;
      const propertyDecl = classDecl.addProperty({
        name: 'metadata',
        type: 'Array<Metadata>',
      });

      const schema = IRHelpers.createSchema('User');
      const propertyDef = createPropertyWithType(
        'metadata',
        IRHelpers.createTypeReference('array', 'Array',
          IRHelpers.createTypeReference('object', 'Metadata')
        )
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      const typeDecorator = propertyDecl.getDecorator('Type');
      expect(typeDecorator).toBeDefined();
      expect(typeDecorator!.getText()).toContain('() => Metadata');
    });

    it('should add @Type for dictionary with reference values', () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        'export class User {}'
      );
      const classDecl = sourceFile.getClass('User')!;
      const propertyDecl = classDecl.addProperty({
        name: 'mappings',
        type: '{ [key: string]: Config }',
      });

      const schema = IRHelpers.createSchema('User');
      const dictionaryType = IRHelpers.createTypeReference('dictionary', 'string');
      dictionaryType.additionalProperties = IRHelpers.createTypeReference('reference', 'Config');

      const propertyDef = createPropertyWithType('mappings', dictionaryType);

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      const typeDecorator = propertyDecl.getDecorator('Type');
      expect(typeDecorator).toBeDefined();
      expect(typeDecorator!.getText()).toContain('() => Config');
    });

    it('should add @Type for dictionary with object values', () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        'export class User {}'
      );
      const classDecl = sourceFile.getClass('User')!;
      const propertyDecl = classDecl.addProperty({
        name: 'configs',
        type: '{ [key: string]: ConfigObject }',
      });

      const schema = IRHelpers.createSchema('User');
      const dictionaryType = IRHelpers.createTypeReference('dictionary', 'string');
      dictionaryType.additionalProperties = IRHelpers.createTypeReference('object', 'ConfigObject');

      const propertyDef = createPropertyWithType('configs', dictionaryType);

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      const typeDecorator = propertyDecl.getDecorator('Type');
      expect(typeDecorator).toBeDefined();
      expect(typeDecorator!.getText()).toContain('() => ConfigObject');
    });
  });

  describe('decorateProperty - no @Type decorator for simple types', () => {
    it('should not add @Type for primitive string', () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        'export class User {}'
      );
      const classDecl = sourceFile.getClass('User')!;
      const propertyDecl = classDecl.addProperty({
        name: 'name',
        type: 'string',
      });

      const schema = IRHelpers.createSchema('User');
      const propertyDef = createPropertyWithType(
        'name',
        IRHelpers.createTypeReference('primitive', 'string')
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      const decorators = propertyDecl.getDecorators();
      const decoratorNames = decorators.map(d => d.getName());
      expect(decoratorNames).toEqual(['Expose']); // Only @Expose, no @Type
    });

    it('should not add @Type for primitive number', () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        'export class User {}'
      );
      const classDecl = sourceFile.getClass('User')!;
      const propertyDecl = classDecl.addProperty({
        name: 'age',
        type: 'number',
      });

      const schema = IRHelpers.createSchema('User');
      const propertyDef = createPropertyWithType(
        'age',
        IRHelpers.createTypeReference('primitive', 'number')
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      const decorators = propertyDecl.getDecorators();
      const decoratorNames = decorators.map(d => d.getName());
      expect(decoratorNames).toEqual(['Expose']);
    });

    it('should not add @Type for array of primitives', () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        'export class User {}'
      );
      const classDecl = sourceFile.getClass('User')!;
      const propertyDecl = classDecl.addProperty({
        name: 'tags',
        type: 'Array<string>',
      });

      const schema = IRHelpers.createSchema('User');
      const propertyDef = createPropertyWithType(
        'tags',
        IRHelpers.createTypeReference('array', 'Array',
          IRHelpers.createTypeReference('primitive', 'string')
        )
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      const decorators = propertyDecl.getDecorators();
      const decoratorNames = decorators.map(d => d.getName());
      expect(decoratorNames).toEqual(['Expose']);
    });

    it('should not add @Type for array without elementType', () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        'export class User {}'
      );
      const classDecl = sourceFile.getClass('User')!;
      const propertyDecl = classDecl.addProperty({
        name: 'items',
        type: 'Array<any>',
      });

      const schema = IRHelpers.createSchema('User');
      const arrayType = IRHelpers.createTypeReference('array', 'Array');
      delete (arrayType as any).elementType; // Remove elementType to test edge case

      const propertyDef = createPropertyWithType('items', arrayType);

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      const decorators = propertyDecl.getDecorators();
      const decoratorNames = decorators.map(d => d.getName());
      expect(decoratorNames).toEqual(['Expose']);
    });

    it('should not add @Type for dictionary with primitive values', () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        'export class User {}'
      );
      const classDecl = sourceFile.getClass('User')!;
      const propertyDecl = classDecl.addProperty({
        name: 'labels',
        type: '{ [key: string]: string }',
      });

      const schema = IRHelpers.createSchema('User');
      const dictionaryType = IRHelpers.createTypeReference('dictionary', 'string');
      dictionaryType.additionalProperties = IRHelpers.createTypeReference('primitive', 'string');

      const propertyDef = createPropertyWithType('labels', dictionaryType);

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      const decorators = propertyDecl.getDecorators();
      const decoratorNames = decorators.map(d => d.getName());
      expect(decoratorNames).toEqual(['Expose']);
    });

    it('should not add @Type for dictionary without additionalProperties', () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        'export class User {}'
      );
      const classDecl = sourceFile.getClass('User')!;
      const propertyDecl = classDecl.addProperty({
        name: 'data',
        type: '{ [key: string]: any }',
      });

      const schema = IRHelpers.createSchema('User');
      const dictionaryType = IRHelpers.createTypeReference('dictionary', 'any');
      delete (dictionaryType as any).additionalProperties; // Remove to test edge case

      const propertyDef = createPropertyWithType('data', dictionaryType);

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      const decorators = propertyDecl.getDecorators();
      const decoratorNames = decorators.map(d => d.getName());
      expect(decoratorNames).toEqual(['Expose']);
    });

    it('should not add @Type for union type', () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        'export class User {}'
      );
      const classDecl = sourceFile.getClass('User')!;
      const propertyDecl = classDecl.addProperty({
        name: 'value',
        type: 'string | number',
      });

      const schema = IRHelpers.createSchema('User');
      const propertyDef = createPropertyWithType(
        'value',
        IRHelpers.createTypeReference('union', 'string | number')
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      const decorators = propertyDecl.getDecorators();
      const decoratorNames = decorators.map(d => d.getName());
      expect(decoratorNames).toEqual(['Expose']);
    });

    it('should not add @Type for unknown type', () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        'export class User {}'
      );
      const classDecl = sourceFile.getClass('User')!;
      const propertyDecl = classDecl.addProperty({
        name: 'data',
        type: 'any',
      });

      const schema = IRHelpers.createSchema('User');
      const propertyDef = createPropertyWithType(
        'data',
        IRHelpers.createTypeReference('unknown', 'any')
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      const decorators = propertyDecl.getDecorators();
      const decoratorNames = decorators.map(d => d.getName());
      expect(decoratorNames).toEqual(['Expose']);
    });
  });

  describe('modifyPackageJson', () => {
    it('should add class-transformer and reflect-metadata to existing dependencies', () => {
      const packageJson: any = {
        name: 'test-package',
        version: '1.0.0',
        dependencies: {
          '@nestjs/swagger': '^7.0.0',
        },
      };

      plugin.modifyPackageJson(packageJson, context);

      expect(packageJson.dependencies['class-transformer']).toBe('^0.5.1');
      expect(packageJson.dependencies['reflect-metadata']).toBe('^0.2.2');
      expect(packageJson.dependencies['@nestjs/swagger']).toBe('^7.0.0');
    });

    it('should create dependencies object if it does not exist', () => {
      const packageJson: any = {
        name: 'test-package',
        version: '1.0.0',
      };

      plugin.modifyPackageJson(packageJson, context);

      expect(packageJson).toHaveProperty('dependencies');
      expect(packageJson.dependencies['class-transformer']).toBe('^0.5.1');
      expect(packageJson.dependencies['reflect-metadata']).toBe('^0.2.2');
    });
  });
});
