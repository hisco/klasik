/**
 * Class Builder
 *
 * Builds TypeScript classes using ts-morph AST manipulation
 */

import {
  Project,
  SourceFile,
  ClassDeclaration,
  PropertyDeclaration,
  Scope,
  StructureKind,
} from 'ts-morph';
import {
  SchemaDefinition,
  PropertyDefinition,
  TypeReference,
} from '../ir/types';
import { ImportManager } from './import-manager';
import { TSDocGenerator } from '../generators/tsdoc-generator';

/**
 * Generation context passed to builders and plugins
 */
export interface GenerationContext {
  project: Project;
  importManager: ImportManager;
  options: GeneratorOptions;
}

/**
 * Generator options
 */
export interface GeneratorOptions {
  outputDir: string;
  mode?: 'full' | 'models-only';
  esm?: boolean;
  nestJsSwagger?: boolean;
  classValidator?: boolean;
  useAjv?: boolean;
  crdKindCase?: 'kebab' | 'snake' | 'pascal' | 'camel' | 'none';
  exportStyle?: 'namespace' | 'direct' | 'both' | 'none';
  templateDir?: string;
  skipJsExtensions?: boolean;
  bare?: boolean;
  httpClient?: 'axios' | 'fetch';
}

/**
 * Builds a TypeScript class from a schema definition
 */
export class ClassBuilder {
  private sourceFile: SourceFile;
  private classDecl: ClassDeclaration;
  private context: GenerationContext;
  private tsDocGenerator: TSDocGenerator;

  constructor(
    context: GenerationContext,
    fileName: string,
    className: string
  ) {
    this.context = context;
    this.tsDocGenerator = new TSDocGenerator();
    this.sourceFile = context.project.createSourceFile(fileName, '', { overwrite: true });
    this.classDecl = this.sourceFile.addClass({
      name: className,
      isExported: true,
    });
  }

  /**
   * Get the class declaration
   */
  getClassDeclaration(): ClassDeclaration {
    return this.classDecl;
  }

  /**
   * Get the source file
   */
  getSourceFile(): SourceFile {
    return this.sourceFile;
  }

  /**
   * Add JSDoc comment to class
   */
  addClassDoc(description: string): this {
    if (!description) return this;

    this.classDecl.addJsDoc({
      description: this.escapeJsDocText(description),
    });

    return this;
  }

  /**
   * Add a property to the class
   */
  addProperty(propertyDef: PropertyDefinition): PropertyDeclaration {
    const propertyDecl = this.classDecl.addProperty({
      name: `'${propertyDef.name}'`,
      type: this.buildTypeString(propertyDef.type),
      hasQuestionToken: !propertyDef.required,
    });

    // Generate rich JSDoc using TSDocGenerator
    const richJsDoc = this.tsDocGenerator.generatePropertyDoc(
      propertyDef,
      this.classDecl.getName()
    );

    // Parse and apply JSDoc (remove /** and */ wrapper)
    const jsDocContent = richJsDoc
      .replace(/^\/\*\*\s*\n?/, '')    // Remove opening /**
      .replace(/\s*\*\/\s*$/, '')       // Remove closing */
      .split('\n')
      .map(line => line.replace(/^\s*\*\s?/, ''))  // Remove leading * from each line
      .join('\n');

    propertyDecl.addJsDoc(jsDocContent);

    return propertyDecl;
  }

  /**
   * Add attributeTypeMap static property
   */
  addAttributeTypeMap(schema: SchemaDefinition): this {
    const entries = Array.from(schema.properties.values()).map(prop => {
      const entry: any = {
        name: prop.name,
        baseName: prop.originalName,
        type: this.getTypeMapTypeString(prop.type),
        format: prop.format || '',
      };

      if (prop.description) {
        entry.description = prop.description;
      }

      // Add vendorExtensions
      entry.vendorExtensions = prop.metadata.vendorExtensions || {};

      // Add modelClass for complex types
      if (this.isComplexType(prop.type)) {
        entry.modelClass = prop.type.name;
      }

      return entry;
    });

    // Convert to string manually to have proper formatting
    const entriesStr = JSON.stringify(entries, null, 8)
      .split('\n')
      .map(line => '        ' + line)
      .join('\n');

    this.classDecl.addProperty({
      name: 'attributeTypeMap',
      scope: Scope.Public,
      isStatic: true,
      isReadonly: true,
      type: 'Array<{name: string, baseName: string, type: string, format: string, description?: string, vendorExtensions?: any, modelClass?: any}>',
      initializer: entriesStr.trim(),
      docs: [{
        description: [
          'Metadata for serialization and deserialization',
          '',
          'Maps property names to their types and formats for runtime transformation.',
          'Used by class-transformer and validation frameworks.',
          '',
          '@static',
          '@readonly',
          `@memberof ${schema.name}`,
        ].join('\n'),
      }],
    });

    return this;
  }

  /**
   * Apply imports to the source file
   */
  applyImports(): this {
    this.context.importManager.applyToSourceFile(this.sourceFile);
    return this;
  }

  /**
   * Format the source file
   */
  format(): this {
    this.sourceFile.formatText({
      indentSize: 2,
      convertTabsToSpaces: true,
    });
    return this;
  }

  /**
   * Build and return the source file
   */
  build(): SourceFile {
    return this.sourceFile;
  }

  /**
   * Build TypeScript type string from TypeReference
   */
  private buildTypeString(type: TypeReference): string {
    switch (type.kind) {
      case 'primitive':
        return type.name!;

      case 'array':
        if (!type.elementType) {
          return 'Array<unknown>';
        }
        return `Array<${this.buildTypeString(type.elementType)}>`;

      case 'reference':
      case 'object':
        return type.name || 'unknown';

      case 'union':
        if (!type.unionTypes || type.unionTypes.length === 0) {
          return 'unknown';
        }
        return type.unionTypes.map(t => this.buildTypeString(t)).join(' | ');

      case 'dictionary':
        if (!type.additionalProperties) {
          return '{ [key: string]: unknown }';
        }
        const valueType = this.buildTypeString(type.additionalProperties);
        return `{ [key: string]: ${valueType} }`;

      case 'unknown':
      default:
        return 'unknown';
    }
  }

  /**
   * Get type string for attributeTypeMap
   */
  private getTypeMapTypeString(type: TypeReference): string {
    switch (type.kind) {
      case 'primitive':
        return type.name!;

      case 'array':
        if (!type.elementType) {
          return 'Array<unknown>';
        }
        const elementTypeStr = this.getTypeMapTypeString(type.elementType);
        return `Array<${elementTypeStr}>`;

      case 'reference':
      case 'object':
        return type.name || 'object';

      case 'dictionary':
        return 'object';

      case 'union':
        // For attributeTypeMap, we just use 'object' for unions
        return 'object';

      case 'unknown':
      default:
        return 'object';
    }
  }

  /**
   * Check if a type is complex (requires modelClass in attributeTypeMap)
   */
  private isComplexType(type: TypeReference): boolean {
    if (type.kind === 'reference' || type.kind === 'object') {
      return true;
    }

    if (type.kind === 'array' && type.elementType) {
      return this.isComplexType(type.elementType);
    }

    return false;
  }

  /**
   * Escape text for JSDoc comments
   *
   * Handles special characters that could break JSDoc syntax:
   * - Comment delimiters: &#42;/ and /&#42;
   * - Newlines: adds proper JSDoc line prefix
   *
   * Characters preserved for JSDoc functionality:
   * - Backticks (`) for inline code
   * - Angle brackets (<>) for type references
   * - Curly braces ({}) for @type tags
   * - @ symbol (context-aware escaping)
   */
  private escapeJsDocText(text: string): string {
    if (!text) return text;

    return text
      // Escape closing comment delimiter (MUST be first to avoid double-escaping)
      .replace(/\*\//g, '*\\/')
      // Escape opening comment delimiter
      .replace(/\/\*/g, '/\\*')
      // Escape @ at start of line to prevent false JSDoc tags
      // Only escape @ when it's at the start of a line or after whitespace
      .replace(/(^|\n)\s*@/g, '$1\\@')
      // Handle newlines by adding JSDoc line prefix
      .replace(/\n/g, '\n * ');
  }
}
