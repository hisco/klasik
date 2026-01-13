/**
 * Tests for ClassBuilder
 * Professional test suite using structural assertions and type checking
 */

import { Project, PropertyDeclaration, SyntaxKind } from 'ts-morph';
import { ClassBuilder, GenerationContext, GeneratorOptions } from '../class-builder';
import { ImportManager } from '../import-manager';
import {
  SchemaDefinition,
  PropertyDefinition,
  TypeReference,
  IRHelpers,
} from '../../ir/types';

describe('ClassBuilder', () => {
  let project: Project;
  let importManager: ImportManager;
  let context: GenerationContext;
  let options: GeneratorOptions;

  beforeEach(() => {
    project = new Project({ useInMemoryFileSystem: true });
    importManager = new ImportManager({ esm: false });
    options = {
      outputDir: '/test/output',
      esm: false,
    };
    context = {
      project,
      importManager,
      options,
    };
  });

  describe('constructor', () => {
    it('should create source file with correct name', () => {
      const builder = new ClassBuilder(context, 'user.ts', 'User');
      const sourceFile = builder.getSourceFile();

      expect(sourceFile.getBaseName()).toBe('user.ts');
    });

    it('should create exported class with correct name', () => {
      const builder = new ClassBuilder(context, 'user.ts', 'User');
      const classDecl = builder.getClassDeclaration();

      expect(classDecl.getName()).toBe('User');
      expect(classDecl.isExported()).toBe(true);
    });
  });

  describe('addClassDoc', () => {
    it('should add JSDoc comment to class', () => {
      const builder = new ClassBuilder(context, 'user.ts', 'User');
      builder.addClassDoc('User model representing a system user');

      const classDecl = builder.getClassDeclaration();
      const jsDocs = classDecl.getJsDocs();

      expect(jsDocs).toHaveLength(1);
      expect(jsDocs[0].getDescription()).toContain('User model representing a system user');
    });

    it('should escape comment delimiters in JSDoc', () => {
      const builder = new ClassBuilder(context, 'user.ts', 'User');
      builder.addClassDoc('User model with /* comment */ end');

      const classDecl = builder.getClassDeclaration();
      const jsDocs = classDecl.getJsDocs();
      const description = jsDocs[0].getDescription();

      expect(description).toContain('/\\*');
      expect(description).toContain('*\\/');
    });

    it('should preserve backticks for inline code in class doc', () => {
      const builder = new ClassBuilder(context, 'user.ts', 'User');
      builder.addClassDoc('User model with `code` examples like `const x = 1`');

      const classDecl = builder.getClassDeclaration();
      const jsDocs = classDecl.getJsDocs();
      const description = jsDocs[0].getDescription();

      expect(description).toContain('`code`');
      expect(description).toContain('`const x = 1`');
    });

    it('should preserve quotes in class doc', () => {
      const builder = new ClassBuilder(context, 'user.ts', 'User');
      builder.addClassDoc('Use "double" and \'single\' quotes');

      const classDecl = builder.getClassDeclaration();
      const jsDocs = classDecl.getJsDocs();
      const description = jsDocs[0].getDescription();

      expect(description).toContain('"double"');
      expect(description).toContain("'single'");
    });

    it('should handle multiline class descriptions', () => {
      const builder = new ClassBuilder(context, 'user.ts', 'User');
      builder.addClassDoc('Line 1\nLine 2\nLine 3');

      const classDecl = builder.getClassDeclaration();
      const jsDocs = classDecl.getJsDocs();
      const description = jsDocs[0].getDescription();

      expect(description).toContain('Line 1\n * Line 2\n * Line 3');
    });

    it('should return builder for method chaining', () => {
      const builder = new ClassBuilder(context, 'user.ts', 'User');
      const result = builder.addClassDoc('Description');

      expect(result).toBe(builder);
    });

    it('should skip empty description', () => {
      const builder = new ClassBuilder(context, 'user.ts', 'User');
      builder.addClassDoc('');

      const classDecl = builder.getClassDeclaration();
      expect(classDecl.getJsDocs()).toHaveLength(0);
    });
  });

  describe('addProperty', () => {
    it('should add required property without question token', () => {
      const builder = new ClassBuilder(context, 'user.ts', 'User');
      const prop = IRHelpers.createProperty(
        'name',
        IRHelpers.createTypeReference('primitive', 'string')
      );
      prop.required = true;

      const propertyDecl = builder.addProperty(prop);

      expect(propertyDecl.getName()).toBe("'name'");
      expect(propertyDecl.hasQuestionToken()).toBe(false);
      expect(propertyDecl.getType().isString()).toBe(true);
    });

    it('should add optional property with question token', () => {
      const builder = new ClassBuilder(context, 'user.ts', 'User');
      const prop = IRHelpers.createProperty(
        'email',
        IRHelpers.createTypeReference('primitive', 'string')
      );
      prop.required = false;

      const propertyDecl = builder.addProperty(prop);

      expect(propertyDecl.hasQuestionToken()).toBe(true);
    });

    it('should add property with JSDoc description', () => {
      const builder = new ClassBuilder(context, 'user.ts', 'User');
      const prop = IRHelpers.createProperty(
        'name',
        IRHelpers.createTypeReference('primitive', 'string')
      );
      prop.description = 'User full name';

      const propertyDecl = builder.addProperty(prop);
      const jsDocs = propertyDecl.getJsDocs();

      expect(jsDocs).toHaveLength(1);
      // TSDocGenerator adds rich metadata, so description contains more than just the text
      expect(jsDocs[0].getDescription()).toContain('User full name');
    });

    it('should handle string primitive type', () => {
      const builder = new ClassBuilder(context, 'user.ts', 'User');
      const prop = IRHelpers.createProperty(
        'name',
        IRHelpers.createTypeReference('primitive', 'string')
      );

      const propertyDecl = builder.addProperty(prop);
      const type = propertyDecl.getType();

      expect(type.isString()).toBe(true);
      expect(type.getText()).toBe('string');
    });

    it('should handle number primitive type', () => {
      const builder = new ClassBuilder(context, 'user.ts', 'User');
      const prop = IRHelpers.createProperty(
        'age',
        IRHelpers.createTypeReference('primitive', 'number')
      );

      const propertyDecl = builder.addProperty(prop);
      const type = propertyDecl.getType();

      expect(type.isNumber()).toBe(true);
      expect(type.getText()).toBe('number');
    });

    it('should handle boolean primitive type', () => {
      const builder = new ClassBuilder(context, 'user.ts', 'User');
      const prop = IRHelpers.createProperty(
        'active',
        IRHelpers.createTypeReference('primitive', 'boolean')
      );

      const propertyDecl = builder.addProperty(prop);
      const type = propertyDecl.getType();

      expect(type.isBoolean()).toBe(true);
      expect(type.getText()).toBe('boolean');
    });

    it('should handle array type with string elements', () => {
      const builder = new ClassBuilder(context, 'user.ts', 'User');
      const prop = IRHelpers.createProperty(
        'tags',
        IRHelpers.createTypeReference(
          'array',
          undefined,
          IRHelpers.createTypeReference('primitive', 'string')
        )
      );

      const propertyDecl = builder.addProperty(prop);
      const typeNode = propertyDecl.getTypeNode();

      expect(typeNode?.getKind()).toBe(SyntaxKind.TypeReference);
      expect(typeNode?.getText()).toBe('Array<string>');
    });

    it('should handle array without elementType', () => {
      const builder = new ClassBuilder(context, 'user.ts', 'User');
      const prop = IRHelpers.createProperty(
        'items',
        IRHelpers.createTypeReference('array')
      );

      const propertyDecl = builder.addProperty(prop);

      expect(propertyDecl.getTypeNode()?.getText()).toBe('Array<unknown>');
    });

    it('should handle reference type', () => {
      const builder = new ClassBuilder(context, 'user.ts', 'User');
      const prop = IRHelpers.createProperty(
        'profile',
        IRHelpers.createTypeReference('reference', 'UserProfile')
      );

      const propertyDecl = builder.addProperty(prop);

      expect(propertyDecl.getTypeNode()?.getText()).toBe('UserProfile');
    });

    it('should handle object type', () => {
      const builder = new ClassBuilder(context, 'user.ts', 'User');
      const prop = IRHelpers.createProperty(
        'metadata',
        IRHelpers.createTypeReference('object', 'ObjectMeta')
      );

      const propertyDecl = builder.addProperty(prop);

      expect(propertyDecl.getTypeNode()?.getText()).toBe('ObjectMeta');
    });

    it('should handle dictionary type with string values', () => {
      const builder = new ClassBuilder(context, 'user.ts', 'User');
      const prop = IRHelpers.createProperty(
        'labels',
        IRHelpers.createTypeReference(
          'dictionary',
          undefined,
          undefined,
          IRHelpers.createTypeReference('primitive', 'string')
        )
      );

      const propertyDecl = builder.addProperty(prop);
      const typeNode = propertyDecl.getTypeNode();

      expect(typeNode?.getKind()).toBe(SyntaxKind.TypeLiteral);
      expect(typeNode?.getText()).toBe('{ [key: string]: string }');
    });

    it('should handle dictionary without additionalProperties', () => {
      const builder = new ClassBuilder(context, 'user.ts', 'User');
      const prop = IRHelpers.createProperty(
        'metadata',
        IRHelpers.createTypeReference('dictionary')
      );

      const propertyDecl = builder.addProperty(prop);

      expect(propertyDecl.getTypeNode()?.getText()).toBe('{ [key: string]: unknown }');
    });

    it('should handle union type', () => {
      const builder = new ClassBuilder(context, 'user.ts', 'User');
      const prop = IRHelpers.createProperty(
        'value',
        IRHelpers.createTypeReference(
          'union',
          undefined,
          undefined,
          undefined,
          [
            IRHelpers.createTypeReference('primitive', 'string'),
            IRHelpers.createTypeReference('primitive', 'number'),
          ]
        )
      );

      const propertyDecl = builder.addProperty(prop);
      const typeNode = propertyDecl.getTypeNode();

      expect(typeNode?.getKind()).toBe(SyntaxKind.UnionType);
      expect(typeNode?.getText()).toBe('string | number');
    });

    it('should handle union without types', () => {
      const builder = new ClassBuilder(context, 'user.ts', 'User');
      const prop = IRHelpers.createProperty(
        'value',
        IRHelpers.createTypeReference('union')
      );

      const propertyDecl = builder.addProperty(prop);

      expect(propertyDecl.getTypeNode()?.getText()).toBe('unknown');
    });

    it('should handle unknown type', () => {
      const builder = new ClassBuilder(context, 'user.ts', 'User');
      const prop = IRHelpers.createProperty(
        'data',
        IRHelpers.createTypeReference('unknown')
      );

      const propertyDecl = builder.addProperty(prop);

      expect(propertyDecl.getType().getText()).toBe('unknown');
    });

    it('should handle nested array types', () => {
      const builder = new ClassBuilder(context, 'user.ts', 'User');
      const prop = IRHelpers.createProperty(
        'matrix',
        IRHelpers.createTypeReference(
          'array',
          undefined,
          IRHelpers.createTypeReference(
            'array',
            undefined,
            IRHelpers.createTypeReference('primitive', 'number')
          )
        )
      );

      const propertyDecl = builder.addProperty(prop);

      expect(propertyDecl.getTypeNode()?.getText()).toBe('Array<Array<number>>');
    });

    it('should handle reference without name', () => {
      const builder = new ClassBuilder(context, 'user.ts', 'User');
      const prop = IRHelpers.createProperty(
        'data',
        IRHelpers.createTypeReference('reference')
      );

      const propertyDecl = builder.addProperty(prop);

      expect(propertyDecl.getType().getText()).toBe('unknown');
    });
  });

  describe('addAttributeTypeMap', () => {
    it('should create static readonly property', () => {
      const builder = new ClassBuilder(context, 'user.ts', 'User');
      const schema = IRHelpers.createSchema('User');

      const nameProp = IRHelpers.createProperty(
        'name',
        IRHelpers.createTypeReference('primitive', 'string')
      );
      nameProp.originalName = 'name';
      schema.properties.set('name', nameProp);

      builder.addAttributeTypeMap(schema);

      const classDecl = builder.getClassDeclaration();
      const staticProp = classDecl.getProperty('attributeTypeMap');

      expect(staticProp).toBeDefined();
      expect(staticProp?.isStatic()).toBe(true);
      expect(staticProp?.isReadonly()).toBe(true);
    });

    it('should include property metadata', () => {
      const builder = new ClassBuilder(context, 'user.ts', 'User');
      const schema = IRHelpers.createSchema('User');

      const nameProp = IRHelpers.createProperty(
        'name',
        IRHelpers.createTypeReference('primitive', 'string')
      );
      nameProp.description = 'User name';
      nameProp.format = 'text';
      nameProp.originalName = 'name';
      nameProp.metadata.vendorExtensions = { 'x-custom': 'value' };
      schema.properties.set('name', nameProp);

      builder.addAttributeTypeMap(schema);

      const sourceFile = builder.getSourceFile();
      const text = sourceFile.getText();

      // Verify structure without brittle string matching
      expect(text).toContain('attributeTypeMap');
      expect(text).toContain('"name"');
      expect(text).toContain('"baseName"');
      expect(text).toContain('"type"');
      expect(text).toContain('"format"');
      expect(text).toContain('"description"');
      expect(text).toContain('"vendorExtensions"');
    });

    it('should add modelClass for reference types', () => {
      const builder = new ClassBuilder(context, 'user.ts', 'User');
      const schema = IRHelpers.createSchema('User');

      const profileProp = IRHelpers.createProperty(
        'profile',
        IRHelpers.createTypeReference('reference', 'UserProfile')
      );
      profileProp.originalName = 'profile';
      schema.properties.set('profile', profileProp);

      builder.addAttributeTypeMap(schema);

      const sourceFile = builder.getSourceFile();
      const text = sourceFile.getText();

      expect(text).toContain('"modelClass"');
      expect(text).toContain('UserProfile');
    });

    it('should add modelClass for object types', () => {
      const builder = new ClassBuilder(context, 'user.ts', 'User');
      const schema = IRHelpers.createSchema('User');

      const metadataProp = IRHelpers.createProperty(
        'metadata',
        IRHelpers.createTypeReference('object', 'ObjectMeta')
      );
      metadataProp.originalName = 'metadata';
      schema.properties.set('metadata', metadataProp);

      builder.addAttributeTypeMap(schema);

      const sourceFile = builder.getSourceFile();
      const text = sourceFile.getText();

      expect(text).toContain('"modelClass"');
      expect(text).toContain('ObjectMeta');
    });

    it('should handle array of references', () => {
      const builder = new ClassBuilder(context, 'user.ts', 'User');
      const schema = IRHelpers.createSchema('User');

      const itemsProp = IRHelpers.createProperty(
        'items',
        IRHelpers.createTypeReference(
          'array',
          undefined,
          IRHelpers.createTypeReference('reference', 'Item')
        )
      );
      itemsProp.originalName = 'items';
      schema.properties.set('items', itemsProp);

      builder.addAttributeTypeMap(schema);

      const sourceFile = builder.getSourceFile();
      const text = sourceFile.getText();

      // Array type is correctly captured in attributeTypeMap
      expect(text).toContain('"type": "Array<Item>"');
      expect(text).toContain('Item');
    });

    it('should map dictionary type to object', () => {
      const builder = new ClassBuilder(context, 'user.ts', 'User');
      const schema = IRHelpers.createSchema('User');

      const labelsProp = IRHelpers.createProperty(
        'labels',
        IRHelpers.createTypeReference(
          'dictionary',
          undefined,
          undefined,
          IRHelpers.createTypeReference('primitive', 'string')
        )
      );
      labelsProp.originalName = 'labels';
      schema.properties.set('labels', labelsProp);

      builder.addAttributeTypeMap(schema);

      const sourceFile = builder.getSourceFile();
      const text = sourceFile.getText();

      expect(text).toContain('"type": "object"');
    });

    it('should map union type to object', () => {
      const builder = new ClassBuilder(context, 'user.ts', 'User');
      const schema = IRHelpers.createSchema('User');

      const valueProp = IRHelpers.createProperty(
        'value',
        IRHelpers.createTypeReference(
          'union',
          undefined,
          undefined,
          undefined,
          [
            IRHelpers.createTypeReference('primitive', 'string'),
            IRHelpers.createTypeReference('primitive', 'number'),
          ]
        )
      );
      valueProp.originalName = 'value';
      schema.properties.set('value', valueProp);

      builder.addAttributeTypeMap(schema);

      const sourceFile = builder.getSourceFile();
      const text = sourceFile.getText();

      expect(text).toContain('"type": "object"');
    });

    it('should use empty string for missing format', () => {
      const builder = new ClassBuilder(context, 'user.ts', 'User');
      const schema = IRHelpers.createSchema('User');

      const nameProp = IRHelpers.createProperty(
        'name',
        IRHelpers.createTypeReference('primitive', 'string')
      );
      nameProp.originalName = 'name';
      schema.properties.set('name', nameProp);

      builder.addAttributeTypeMap(schema);

      const sourceFile = builder.getSourceFile();
      const text = sourceFile.getText();

      expect(text).toContain('"format": ""');
    });

    it('should handle empty vendor extensions', () => {
      const builder = new ClassBuilder(context, 'user.ts', 'User');
      const schema = IRHelpers.createSchema('User');

      const nameProp = IRHelpers.createProperty(
        'name',
        IRHelpers.createTypeReference('primitive', 'string')
      );
      nameProp.originalName = 'name';
      nameProp.metadata.vendorExtensions = {};
      schema.properties.set('name', nameProp);

      builder.addAttributeTypeMap(schema);

      const sourceFile = builder.getSourceFile();
      const text = sourceFile.getText();

      expect(text).toContain('"vendorExtensions": {}');
    });

    it('should return builder for method chaining', () => {
      const builder = new ClassBuilder(context, 'user.ts', 'User');
      const schema = IRHelpers.createSchema('User');

      const result = builder.addAttributeTypeMap(schema);

      expect(result).toBe(builder);
    });
  });

  describe('applyImports', () => {
    it('should apply imports to source file', () => {
      const builder = new ClassBuilder(context, 'user.ts', 'User');
      importManager.addImport('class-transformer', 'Expose');

      builder.applyImports();

      const sourceFile = builder.getSourceFile();
      const imports = sourceFile.getImportDeclarations();

      expect(imports.length).toBeGreaterThan(0);
      const classTransformerImport = imports.find(
        imp => imp.getModuleSpecifierValue() === 'class-transformer'
      );
      expect(classTransformerImport).toBeDefined();
      expect(classTransformerImport?.getNamedImports().map(n => n.getName())).toContain('Expose');
    });

    it('should return builder for method chaining', () => {
      const builder = new ClassBuilder(context, 'user.ts', 'User');
      const result = builder.applyImports();

      expect(result).toBe(builder);
    });
  });

  describe('format', () => {
    it('should format source file with proper indentation', () => {
      const builder = new ClassBuilder(context, 'user.ts', 'User');
      const prop = IRHelpers.createProperty(
        'name',
        IRHelpers.createTypeReference('primitive', 'string')
      );
      builder.addProperty(prop);
      builder.format();

      const sourceFile = builder.getSourceFile();
      const text = sourceFile.getText();

      // Verify formatted output has proper structure
      expect(text).toContain('export class User');
      expect(text).toContain("'name'");
      // Check indentation exists (properties should be indented)
      expect(text).toMatch(/\s+'name'/);
    });

    it('should return builder for method chaining', () => {
      const builder = new ClassBuilder(context, 'user.ts', 'User');
      const result = builder.format();

      expect(result).toBe(builder);
    });
  });

  describe('build', () => {
    it('should return the source file', () => {
      const builder = new ClassBuilder(context, 'user.ts', 'User');
      const sourceFile = builder.build();

      expect(sourceFile).toBe(builder.getSourceFile());
      expect(sourceFile.getBaseName()).toBe('user.ts');
    });
  });

  describe('method chaining', () => {
    it('should support full method chain', () => {
      const builder = new ClassBuilder(context, 'user.ts', 'User');
      const schema = IRHelpers.createSchema('User');

      const nameProp = IRHelpers.createProperty(
        'name',
        IRHelpers.createTypeReference('primitive', 'string')
      );
      nameProp.originalName = 'name';
      schema.properties.set('name', nameProp);

      builder.addProperty(nameProp);

      const sourceFile = builder
        .addAttributeTypeMap(schema)
        .applyImports()
        .format()
        .build();

      const text = sourceFile.getText();
      expect(text).toContain("'name'");
      expect(text).toContain('attributeTypeMap');
      expect(text).toContain('export class User');
    });
  });

  describe('edge cases', () => {
    it('should handle property without description', () => {
      const builder = new ClassBuilder(context, 'user.ts', 'User');
      const prop = IRHelpers.createProperty(
        'name',
        IRHelpers.createTypeReference('primitive', 'string')
      );
      // No description set

      const propertyDecl = builder.addProperty(prop);

      // TSDocGenerator now generates rich JSDoc even without description (includes @type, etc.)
      expect(propertyDecl.getJsDocs().length).toBeGreaterThan(0);
      const fullComment = propertyDecl.getJsDocs()[0].getText();
      expect(fullComment).toContain('@type');
    });

    it('should escape JSDoc special characters', () => {
      const builder = new ClassBuilder(context, 'user.ts', 'User');
      builder.addClassDoc('Example: /* comment */ and // inline');

      const classDecl = builder.getClassDeclaration();
      const jsDocs = classDecl.getJsDocs();
      const description = jsDocs[0].getDescription();

      expect(description).toContain('\\*');
      expect(description).toContain('\\/');
    });

    it('should handle multiple properties', () => {
      const builder = new ClassBuilder(context, 'user.ts', 'User');

      const nameProp = IRHelpers.createProperty(
        'name',
        IRHelpers.createTypeReference('primitive', 'string')
      );
      const ageProp = IRHelpers.createProperty(
        'age',
        IRHelpers.createTypeReference('primitive', 'number')
      );
      const activeProp = IRHelpers.createProperty(
        'active',
        IRHelpers.createTypeReference('primitive', 'boolean')
      );

      builder.addProperty(nameProp);
      builder.addProperty(ageProp);
      builder.addProperty(activeProp);

      const classDecl = builder.getClassDeclaration();
      const properties = classDecl.getProperties();

      expect(properties).toHaveLength(3);
      expect(properties[0].getName()).toBe("'name'");
      expect(properties[1].getName()).toBe("'age'");
      expect(properties[2].getName()).toBe("'active'");
    });
  });
});
