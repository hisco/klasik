/**
 * Tests for Class Validator Plugin
 * Comprehensive coverage of validation decorator generation
 */

import { Project } from 'ts-morph';
import { ClassValidatorPlugin } from '../class-validator-plugin';
import { GenerationContext, GeneratorOptions } from '../../builders/class-builder';
import { ImportManager } from '../../builders/import-manager';
import {
  PropertyDefinition,
  TypeReference,
  SchemaIR,
  Constraints,
  IRHelpers,
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
  const property = IRHelpers.createProperty(name, type);

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

describe('ClassValidatorPlugin', () => {
  let plugin: ClassValidatorPlugin;
  let project: Project;
  let context: GenerationContext;
  let importManager: ImportManager;

  beforeEach(() => {
    plugin = new ClassValidatorPlugin();
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
      expect(plugin.name).toBe('class-validator');
      expect(plugin.priority).toBe(90);
    });
  });

  // Note: ClassValidatorPlugin no longer has beforeGeneration method.
  // Imports are added on-demand in decorateProperty() to prevent unused imports.

  describe('decorateProperty - optional properties', () => {
    it('should add @IsOptional for optional string property', () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        'export class User {}'
      );
      const classDecl = sourceFile.getClass('User')!;
      const propertyDecl = classDecl.addProperty({
        name: 'email',
        type: 'string',
      });

      const schema = IRHelpers.createSchema('User');
      const propertyDef = createPropertyWithOptions(
        'email',
        IRHelpers.createTypeReference('primitive', 'string'),
        { required: false }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      const decorators = propertyDecl.getDecorators();
      const decoratorNames = decorators.map(d => d.getName());
      expect(decoratorNames).toContain('IsOptional');
      expect(decoratorNames).toContain('IsString');
    });

    it('should not add @IsOptional for required property', () => {
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
      const propertyDef = createPropertyWithOptions(
        'name',
        IRHelpers.createTypeReference('primitive', 'string'),
        { required: true }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      const decorators = propertyDecl.getDecorators();
      const decoratorNames = decorators.map(d => d.getName());
      expect(decoratorNames).not.toContain('IsOptional');
      expect(decoratorNames).toContain('IsString');
    });
  });

  describe('decorateProperty - primitive types', () => {
    it('should add @IsString for string property', () => {
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
      const propertyDef = createPropertyWithOptions(
        'name',
        IRHelpers.createTypeReference('primitive', 'string'),
        { required: true }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      expect(propertyDecl.getDecorator('IsString')).toBeDefined();
    });

    it('should add @IsNumber for number property', () => {
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
      const propertyDef = createPropertyWithOptions(
        'age',
        IRHelpers.createTypeReference('primitive', 'number'),
        { required: true }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      expect(propertyDecl.getDecorator('IsNumber')).toBeDefined();
    });

    it('should add @IsBoolean for boolean property', () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        'export class User {}'
      );
      const classDecl = sourceFile.getClass('User')!;
      const propertyDecl = classDecl.addProperty({
        name: 'active',
        type: 'boolean',
      });

      const schema = IRHelpers.createSchema('User');
      const propertyDef = createPropertyWithOptions(
        'active',
        IRHelpers.createTypeReference('primitive', 'boolean'),
        { required: true }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      expect(propertyDecl.getDecorator('IsBoolean')).toBeDefined();
    });
  });

  describe('decorateProperty - array types', () => {
    it('should add @IsArray for array of primitives', () => {
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
      const propertyDef = createPropertyWithOptions(
        'tags',
        IRHelpers.createTypeReference('array', 'Array',
          IRHelpers.createTypeReference('primitive', 'string')
        ),
        { required: true }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      expect(propertyDecl.getDecorator('IsArray')).toBeDefined();
    });

    it('should add @ValidateNested for array of objects (reference)', () => {
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
      const propertyDef = createPropertyWithOptions(
        'addresses',
        IRHelpers.createTypeReference('array', 'Array',
          IRHelpers.createTypeReference('reference', 'Address')
        ),
        { required: true }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      const validateNested = propertyDecl.getDecorator('ValidateNested');
      expect(validateNested).toBeDefined();
      expect(validateNested!.getText()).toContain('{ each: true }');
    });

    it('should add @ValidateNested for array of nested objects', () => {
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
      const propertyDef = createPropertyWithOptions(
        'metadata',
        IRHelpers.createTypeReference('array', 'Array',
          IRHelpers.createTypeReference('object', 'Metadata')
        ),
        { required: true }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      const validateNested = propertyDecl.getDecorator('ValidateNested');
      expect(validateNested).toBeDefined();
      expect(validateNested!.getText()).toContain('{ each: true }');
    });
  });

  describe('decorateProperty - complex types', () => {
    it('should add @ValidateNested for reference property', () => {
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
      const propertyDef = createPropertyWithOptions(
        'profile',
        IRHelpers.createTypeReference('reference', 'UserProfile'),
        { required: true }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      expect(propertyDecl.getDecorator('ValidateNested')).toBeDefined();
    });

    it('should add @ValidateNested for object property', () => {
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
      const propertyDef = createPropertyWithOptions(
        'settings',
        IRHelpers.createTypeReference('object', 'Settings'),
        { required: true }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      expect(propertyDecl.getDecorator('ValidateNested')).toBeDefined();
    });

    it('should add @IsObject for dictionary property', () => {
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
      const propertyDef = createPropertyWithOptions(
        'labels',
        IRHelpers.createTypeReference('dictionary', 'string'),
        { required: true }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      expect(propertyDecl.getDecorator('IsObject')).toBeDefined();
    });

    it('should handle union type without adding type decorators', () => {
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
      const propertyDef = createPropertyWithOptions(
        'value',
        IRHelpers.createTypeReference('union', 'string | number'),
        { required: true }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      // Union types don't get specific validators, only @IsOptional if optional
      const decorators = propertyDecl.getDecorators();
      expect(decorators.length).toBe(0);
    });

    it('should handle unknown type without adding type decorators', () => {
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
      const propertyDef = createPropertyWithOptions(
        'data',
        IRHelpers.createTypeReference('unknown', 'any'),
        { required: false }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      // Unknown types get only @IsOptional if optional
      const decorators = propertyDecl.getDecorators();
      const decoratorNames = decorators.map(d => d.getName());
      expect(decoratorNames).toEqual(['IsOptional']);
    });
  });

  describe('decorateProperty - format validators', () => {
    it('should add @IsEmail for email format', () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        'export class User {}'
      );
      const classDecl = sourceFile.getClass('User')!;
      const propertyDecl = classDecl.addProperty({
        name: 'email',
        type: 'string',
      });

      const schema = IRHelpers.createSchema('User');
      const propertyDef = createPropertyWithOptions(
        'email',
        IRHelpers.createTypeReference('primitive', 'string'),
        { required: true, format: 'email' }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      expect(propertyDecl.getDecorator('IsEmail')).toBeDefined();
    });

    it('should add @IsUrl for url format', () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        'export class User {}'
      );
      const classDecl = sourceFile.getClass('User')!;
      const propertyDecl = classDecl.addProperty({
        name: 'website',
        type: 'string',
      });

      const schema = IRHelpers.createSchema('User');
      const propertyDef = createPropertyWithOptions(
        'website',
        IRHelpers.createTypeReference('primitive', 'string'),
        { required: true, format: 'url' }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      expect(propertyDecl.getDecorator('IsUrl')).toBeDefined();
    });

    it('should add @IsUrl for uri format', () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        'export class User {}'
      );
      const classDecl = sourceFile.getClass('User')!;
      const propertyDecl = classDecl.addProperty({
        name: 'uri',
        type: 'string',
      });

      const schema = IRHelpers.createSchema('User');
      const propertyDef = createPropertyWithOptions(
        'uri',
        IRHelpers.createTypeReference('primitive', 'string'),
        { required: true, format: 'uri' }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      expect(propertyDecl.getDecorator('IsUrl')).toBeDefined();
    });

    it('should add @IsUUID for uuid format', () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        'export class User {}'
      );
      const classDecl = sourceFile.getClass('User')!;
      const propertyDecl = classDecl.addProperty({
        name: 'id',
        type: 'string',
      });

      const schema = IRHelpers.createSchema('User');
      const propertyDef = createPropertyWithOptions(
        'id',
        IRHelpers.createTypeReference('primitive', 'string'),
        { required: true, format: 'uuid' }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      expect(propertyDecl.getDecorator('IsUUID')).toBeDefined();
    });

    it('should add @IsDateString for date format', () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        'export class User {}'
      );
      const classDecl = sourceFile.getClass('User')!;
      const propertyDecl = classDecl.addProperty({
        name: 'birthdate',
        type: 'string',
      });

      const schema = IRHelpers.createSchema('User');
      const propertyDef = createPropertyWithOptions(
        'birthdate',
        IRHelpers.createTypeReference('primitive', 'string'),
        { required: true, format: 'date' }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      expect(propertyDecl.getDecorator('IsDateString')).toBeDefined();
    });

    it('should add @IsDateString for date-time format', () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        'export class User {}'
      );
      const classDecl = sourceFile.getClass('User')!;
      const propertyDecl = classDecl.addProperty({
        name: 'createdAt',
        type: 'string',
      });

      const schema = IRHelpers.createSchema('User');
      const propertyDef = createPropertyWithOptions(
        'createdAt',
        IRHelpers.createTypeReference('primitive', 'string'),
        { required: true, format: 'date-time' }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      expect(propertyDecl.getDecorator('IsDateString')).toBeDefined();
    });

    it('should add @IsBase64 for byte format', () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        'export class Data {}'
      );
      const classDecl = sourceFile.getClass('Data')!;
      const propertyDecl = classDecl.addProperty({
        name: 'content',
        type: 'string',
      });

      const schema = IRHelpers.createSchema('Data');
      const propertyDef = createPropertyWithOptions(
        'content',
        IRHelpers.createTypeReference('primitive', 'string'),
        { required: true, format: 'byte' }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      expect(propertyDecl.getDecorator('IsBase64')).toBeDefined();
    });

    it('should add @IsFQDN for hostname format', () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        'export class Server {}'
      );
      const classDecl = sourceFile.getClass('Server')!;
      const propertyDecl = classDecl.addProperty({
        name: 'host',
        type: 'string',
      });

      const schema = IRHelpers.createSchema('Server');
      const propertyDef = createPropertyWithOptions(
        'host',
        IRHelpers.createTypeReference('primitive', 'string'),
        { required: true, format: 'hostname' }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      expect(propertyDecl.getDecorator('IsFQDN')).toBeDefined();
    });

    it('should add @IsIP with version 4 for ipv4 format', () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        'export class Server {}'
      );
      const classDecl = sourceFile.getClass('Server')!;
      const propertyDecl = classDecl.addProperty({
        name: 'ipAddress',
        type: 'string',
      });

      const schema = IRHelpers.createSchema('Server');
      const propertyDef = createPropertyWithOptions(
        'ipAddress',
        IRHelpers.createTypeReference('primitive', 'string'),
        { required: true, format: 'ipv4' }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      const isIpDecorator = propertyDecl.getDecorator('IsIP');
      expect(isIpDecorator).toBeDefined();
      expect(isIpDecorator!.getText()).toContain("'4'");
    });

    it('should add @IsIP with version 6 for ipv6 format', () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        'export class Server {}'
      );
      const classDecl = sourceFile.getClass('Server')!;
      const propertyDecl = classDecl.addProperty({
        name: 'ipv6Address',
        type: 'string',
      });

      const schema = IRHelpers.createSchema('Server');
      const propertyDef = createPropertyWithOptions(
        'ipv6Address',
        IRHelpers.createTypeReference('primitive', 'string'),
        { required: true, format: 'ipv6' }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      const isIpDecorator = propertyDecl.getDecorator('IsIP');
      expect(isIpDecorator).toBeDefined();
      expect(isIpDecorator!.getText()).toContain("'6'");
    });

    it('should add @IsInt for int32 format', () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        'export class Data {}'
      );
      const classDecl = sourceFile.getClass('Data')!;
      const propertyDecl = classDecl.addProperty({
        name: 'count',
        type: 'number',
      });

      const schema = IRHelpers.createSchema('Data');
      const propertyDef = createPropertyWithOptions(
        'count',
        IRHelpers.createTypeReference('primitive', 'number'),
        { required: true, format: 'int32' }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      expect(propertyDecl.getDecorator('IsInt')).toBeDefined();
    });

    it('should add @IsInt for int64 format', () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        'export class Data {}'
      );
      const classDecl = sourceFile.getClass('Data')!;
      const propertyDecl = classDecl.addProperty({
        name: 'bigCount',
        type: 'number',
      });

      const schema = IRHelpers.createSchema('Data');
      const propertyDef = createPropertyWithOptions(
        'bigCount',
        IRHelpers.createTypeReference('primitive', 'number'),
        { required: true, format: 'int64' }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      expect(propertyDecl.getDecorator('IsInt')).toBeDefined();
    });
  });

  describe('decorateProperty - constraint validators', () => {
    it('should add @Min and @Max for numeric constraints', () => {
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
      const propertyDef = createPropertyWithOptions(
        'age',
        IRHelpers.createTypeReference('primitive', 'number'),
        {
          required: true,
          constraints: {
            minimum: 0,
            maximum: 120,
          },
        }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      const minDecorator = propertyDecl.getDecorator('Min');
      const maxDecorator = propertyDecl.getDecorator('Max');

      expect(minDecorator).toBeDefined();
      expect(minDecorator!.getText()).toContain('Min(0)');
      expect(maxDecorator).toBeDefined();
      expect(maxDecorator!.getText()).toContain('Max(120)');
    });

    it('should add @MinLength and @MaxLength for string constraints', () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        'export class User {}'
      );
      const classDecl = sourceFile.getClass('User')!;
      const propertyDecl = classDecl.addProperty({
        name: 'username',
        type: 'string',
      });

      const schema = IRHelpers.createSchema('User');
      const propertyDef = createPropertyWithOptions(
        'username',
        IRHelpers.createTypeReference('primitive', 'string'),
        {
          required: true,
          constraints: {
            minLength: 3,
            maxLength: 20,
          },
        }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      const minLengthDecorator = propertyDecl.getDecorator('MinLength');
      const maxLengthDecorator = propertyDecl.getDecorator('MaxLength');

      expect(minLengthDecorator).toBeDefined();
      expect(minLengthDecorator!.getText()).toContain('MinLength(3)');
      expect(maxLengthDecorator).toBeDefined();
      expect(maxLengthDecorator!.getText()).toContain('MaxLength(20)');
    });

    it('should add @Matches for pattern constraint', () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        'export class User {}'
      );
      const classDecl = sourceFile.getClass('User')!;
      const propertyDecl = classDecl.addProperty({
        name: 'code',
        type: 'string',
      });

      const schema = IRHelpers.createSchema('User');
      const propertyDef = createPropertyWithOptions(
        'code',
        IRHelpers.createTypeReference('primitive', 'string'),
        {
          required: true,
          constraints: {
            pattern: '^[A-Z]{3}$',
          },
        }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      const matchesDecorator = propertyDecl.getDecorator('Matches');
      expect(matchesDecorator).toBeDefined();
      expect(matchesDecorator!.getText()).toContain('/^[A-Z]{3}$/');
    });

    it('should handle backslashes in pattern', () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        'export class User {}'
      );
      const classDecl = sourceFile.getClass('User')!;
      const propertyDecl = classDecl.addProperty({
        name: 'path',
        type: 'string',
      });

      const schema = IRHelpers.createSchema('User');
      const propertyDef = createPropertyWithOptions(
        'path',
        IRHelpers.createTypeReference('primitive', 'string'),
        {
          required: true,
          constraints: {
            pattern: '\\w+\\d+',
          },
        }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      const matchesDecorator = propertyDecl.getDecorator('Matches');
      expect(matchesDecorator).toBeDefined();
      // The decorator should contain the pattern with backslashes preserved in the regex literal
      expect(matchesDecorator!.getText()).toContain('\\w+\\d+');
    });

    it('should handle patterns containing forward slashes (URI pattern)', () => {
      const sourceFile = project.createSourceFile(
        'test-uri.ts',
        'export class Resource {}'
      );
      const classDecl = sourceFile.getClass('Resource')!;
      const propertyDecl = classDecl.addProperty({
        name: 'uri',
        type: 'string',
      });

      const schema = IRHelpers.createSchema('Resource');
      // This is the actual URI pattern from gateway-api that causes the issue
      const uriPattern = '^(([^:/?#]+):)(//([^/?#]*))([^?#]*)(\\?([^#]*))?(#(.*))?';
      const propertyDef = createPropertyWithOptions(
        'uri',
        IRHelpers.createTypeReference('primitive', 'string'),
        {
          required: true,
          constraints: {
            pattern: uriPattern,
          },
        }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      const matchesDecorator = propertyDecl.getDecorator('Matches');
      expect(matchesDecorator).toBeDefined();

      // Get the full generated code and verify it's valid TypeScript
      const generatedCode = sourceFile.getFullText();

      // The code should be parseable - create a new project to verify
      const verifyProject = new Project({ useInMemoryFileSystem: true });
      // This should not throw - if it does, the generated code is invalid
      expect(() => {
        verifyProject.createSourceFile('verify.ts', generatedCode);
      }).not.toThrow();

      // Should use new RegExp() for patterns with forward slashes
      expect(generatedCode).toContain('new RegExp');
      // Verify the pattern is preserved
      expect(generatedCode).toContain('//');
    });

    it('should handle patterns with forward slash as regex delimiter', () => {
      const sourceFile = project.createSourceFile(
        'test-k8s.ts',
        'export class Condition {}'
      );
      const classDecl = sourceFile.getClass('Condition')!;
      const propertyDecl = classDecl.addProperty({
        name: 'type',
        type: 'string',
      });

      const schema = IRHelpers.createSchema('Condition');
      // This pattern from gateway-api has '/)?' which breaks regex literals
      const k8sPattern = '^([a-z0-9]([-a-z0-9]*[a-z0-9])?(\\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*/)?(([A-Za-z0-9][-A-Za-z0-9_.]*)?[A-Za-z0-9])$';
      const propertyDef = createPropertyWithOptions(
        'type',
        IRHelpers.createTypeReference('primitive', 'string'),
        {
          required: true,
          constraints: {
            pattern: k8sPattern,
          },
        }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      const matchesDecorator = propertyDecl.getDecorator('Matches');
      expect(matchesDecorator).toBeDefined();

      // Get the full generated code and verify it's valid TypeScript
      const generatedCode = sourceFile.getFullText();

      // The code should be parseable - create a new project to verify
      const verifyProject = new Project({ useInMemoryFileSystem: true });
      expect(() => {
        verifyProject.createSourceFile('verify.ts', generatedCode);
      }).not.toThrow();

      // Should use new RegExp() for patterns with forward slashes
      expect(generatedCode).toContain('new RegExp');
    });

    it('should add @ArrayMinSize for minItems constraint', () => {
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
      const propertyDef = createPropertyWithOptions(
        'tags',
        IRHelpers.createTypeReference('array', 'Array',
          IRHelpers.createTypeReference('primitive', 'string')
        ),
        {
          required: true,
          constraints: {
            minItems: 1,
          },
        }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      const arrayMinSize = propertyDecl.getDecorator('ArrayMinSize');
      expect(arrayMinSize).toBeDefined();
      expect(arrayMinSize!.getText()).toContain('ArrayMinSize(1)');
    });

    it('should add @ArrayMaxSize for maxItems constraint', () => {
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
      const propertyDef = createPropertyWithOptions(
        'tags',
        IRHelpers.createTypeReference('array', 'Array',
          IRHelpers.createTypeReference('primitive', 'string')
        ),
        {
          required: true,
          constraints: {
            maxItems: 10,
          },
        }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      const arrayMaxSize = propertyDecl.getDecorator('ArrayMaxSize');
      expect(arrayMaxSize).toBeDefined();
      expect(arrayMaxSize!.getText()).toContain('ArrayMaxSize(10)');
    });

    it('should add @ArrayUnique for uniqueItems constraint', () => {
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
      const propertyDef = createPropertyWithOptions(
        'tags',
        IRHelpers.createTypeReference('array', 'Array',
          IRHelpers.createTypeReference('primitive', 'string')
        ),
        {
          required: true,
          constraints: {
            uniqueItems: true,
          },
        }
      );

      plugin.decorateProperty(propertyDecl, propertyDef, schema, context);

      expect(propertyDecl.getDecorator('ArrayUnique')).toBeDefined();
    });

    it('should handle all array constraints together', () => {
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
      const propertyDef = createPropertyWithOptions(
        'tags',
        IRHelpers.createTypeReference('array', 'Array',
          IRHelpers.createTypeReference('primitive', 'string')
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

      expect(propertyDecl.getDecorator('ArrayMinSize')).toBeDefined();
      expect(propertyDecl.getDecorator('ArrayMaxSize')).toBeDefined();
      expect(propertyDecl.getDecorator('ArrayUnique')).toBeDefined();
    });
  });

  describe('modifyPackageJson', () => {
    it('should add class-validator and class-transformer to existing dependencies', () => {
      const packageJson: any = {
        name: 'test-package',
        version: '1.0.0',
        dependencies: {
          '@nestjs/swagger': '^7.0.0',
        },
      };

      plugin.modifyPackageJson(packageJson, context);

      expect(packageJson.dependencies['class-validator']).toBe('^0.14.0');
      expect(packageJson.dependencies['class-transformer']).toBe('^0.5.1');
      expect(packageJson.dependencies['@nestjs/swagger']).toBe('^7.0.0');
    });

    it('should create dependencies object if it does not exist', () => {
      const packageJson: any = {
        name: 'test-package',
        version: '1.0.0',
      };

      plugin.modifyPackageJson(packageJson, context);

      expect(packageJson).toHaveProperty('dependencies');
      expect(packageJson.dependencies['class-validator']).toBe('^0.14.0');
      expect(packageJson.dependencies['class-transformer']).toBe('^0.5.1');
    });
  });
});
