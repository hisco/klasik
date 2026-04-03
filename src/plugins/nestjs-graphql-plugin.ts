/**
 * NestJS GraphQL Plugin
 *
 * Adds @ObjectType() and @Field() decorators from @nestjs/graphql
 * Properly handles types, descriptions, nullability, and deprecation
 */

import { ClassDeclaration, PropertyDeclaration, SourceFile } from 'ts-morph';
import { GeneratorPlugin } from './plugin-interface';
import {
  SchemaDefinition,
  PropertyDefinition,
  TypeReference,
  SchemaIR,
} from '../ir/types';
import { GenerationContext } from '../builders/class-builder';
import { IRRenamer } from '../utils/ir-renamer';

/** GraphQL built-in scalar type names that cannot be used as ObjectType names */
const GRAPHQL_BUILT_IN_SCALARS = new Set(['Boolean', 'Int', 'Float', 'String', 'ID']);

export class NestJSGraphQLPlugin implements GeneratorPlugin {
  name = 'nestjs-graphql';
  priority = 100;

  /**
   * Add @nestjs/graphql imports and auto-rename schemas that conflict with
   * GraphQL built-in scalar types (Boolean, Int, Float, String, ID).
   */
  beforeGeneration(context: GenerationContext, ir: SchemaIR): void {
    context.importManager.addImport('@nestjs/graphql', 'ObjectType');
    context.importManager.addImport('@nestjs/graphql', 'Field');

    // Auto-rename schemas that collide with GraphQL built-in scalars
    this.autoRenameConflictingSchemas(ir);
  }

  /**
   * Decorate class with @ObjectType()
   */
  decorateClass(
    classDecl: ClassDeclaration,
    schema: SchemaDefinition,
    context: GenerationContext
  ): void {
    // Skip enums and unions - only decorate object types
    if (schema.type !== 'object') {
      return;
    }

    const args: string[] = [];
    if (schema.description) {
      const escaped = this.escapeForTemplate(schema.description);
      args.push(`{ description: \`${escaped}\` }`);
    }

    classDecl.addDecorator({
      name: 'ObjectType',
      arguments: args,
    });
  }

  /**
   * Decorate property with @Field(() => Type, { options })
   */
  decorateProperty(
    property: PropertyDeclaration,
    propertyDef: PropertyDefinition,
    schema: SchemaDefinition,
    context: GenerationContext
  ): void {
    const fieldType = this.getGraphQLFieldType(propertyDef.type, propertyDef.format);
    if (!fieldType) {
      // Skip types that can't be represented in GraphQL (dictionary, union, unknown)
      return;
    }

    // Add type-specific imports
    this.addTypeImports(fieldType, context);

    // Build options
    const options = this.buildFieldOptions(propertyDef);
    const optionsStr = options ? `, ${this.buildOptionsString(options)}` : '';

    property.addDecorator({
      name: 'Field',
      arguments: [`() => ${fieldType}${optionsStr}`],
    });
  }

  /**
   * Register enum types with NestJS GraphQL
   */
  decorateEnum(
    sourceFile: SourceFile,
    schema: SchemaDefinition,
    context: GenerationContext
  ): void {
    context.importManager.addImport('@nestjs/graphql', 'registerEnumType');

    let optionsStr = `{ name: '${schema.name}'`;
    if (schema.description) {
      optionsStr += `, description: \`${this.escapeForTemplate(schema.description)}\``;
    }
    optionsStr += ' }';

    sourceFile.addStatements(`\nregisterEnumType(${schema.name}, ${optionsStr});`);
  }

  /**
   * Add @nestjs/graphql to package.json
   */
  modifyPackageJson(packageJson: any, context: GenerationContext): void {
    if (!packageJson.dependencies) {
      packageJson.dependencies = {};
    }

    packageJson.dependencies['@nestjs/graphql'] = '^12.0.0';
  }

  /**
   * Get GraphQL field type string
   * Returns null for types that should be skipped
   */
  private getGraphQLFieldType(type: TypeReference, format?: string): string | null {
    switch (type.kind) {
      case 'primitive':
        return this.getPrimitiveGraphQLType(type.name, format);

      case 'array':
        if (!type.elementType) {
          return '[String]';
        }
        const elementType = this.getGraphQLFieldType(type.elementType);
        if (!elementType) {
          return null;
        }
        return `[${elementType}]`;

      case 'reference':
      case 'object':
        return type.name || 'String';

      case 'dictionary':
      case 'union':
      case 'unknown':
      default:
        return null;
    }
  }

  /**
   * Map primitive types to GraphQL scalar types
   */
  private getPrimitiveGraphQLType(name?: string, format?: string): string {
    switch (name) {
      case 'string':
        if (format === 'uuid') {
          return 'ID';
        }
        return 'String';
      case 'number':
        if (format === 'int32' || format === 'int64') {
          return 'Int';
        }
        return 'Float';
      case 'boolean':
        return 'Boolean';
      default:
        return 'String';
    }
  }

  /**
   * Add imports for GraphQL scalar types that need explicit imports.
   * Uses word-boundary matching to avoid false positives with class names
   * like "Interview" or "IDCard".
   */
  private addTypeImports(fieldType: string, context: GenerationContext): void {
    if (/\bInt\b/.test(fieldType)) {
      context.importManager.addImport('@nestjs/graphql', 'Int');
    }
    if (/\bFloat\b/.test(fieldType)) {
      context.importManager.addImport('@nestjs/graphql', 'Float');
    }
    if (/\bID\b/.test(fieldType)) {
      context.importManager.addImport('@nestjs/graphql', 'ID');
    }
  }

  /**
   * Build @Field options object
   */
  private buildFieldOptions(propertyDef: PropertyDefinition): Record<string, any> | null {
    const options: Record<string, any> = {};

    // Nullable - when not required or explicitly nullable
    if (!propertyDef.required || propertyDef.nullable) {
      options.nullable = true;
    }

    // Description
    if (propertyDef.description) {
      options.description = this.escapeForTemplate(propertyDef.description);
    }

    // Deprecated
    if (propertyDef.metadata.deprecated) {
      options.deprecationReason = 'Deprecated';
    }

    if (Object.keys(options).length === 0) {
      return null;
    }

    return options;
  }

  /**
   * Build the options string for @Field decorator
   */
  private buildOptionsString(options: Record<string, any>): string {
    const entries: string[] = [];

    for (const [key, value] of Object.entries(options)) {
      let valueStr: string;

      if (typeof value === 'string') {
        valueStr = `\`${value}\``;
      } else {
        valueStr = JSON.stringify(value);
      }

      entries.push(`${key}: ${valueStr}`);
    }

    return `{ ${entries.join(', ')} }`;
  }

  /**
   * Escape special characters for template literals
   */
  private escapeForTemplate(text: string): string {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/`/g, '\\`')
      .replace(/\$/g, '\\$');
  }

  /**
   * Auto-rename schemas whose names exactly match GraphQL built-in scalar types.
   * Appends "Model" suffix (e.g., Boolean → BooleanModel).
   * Mutates the IR in-place so all downstream generation uses the safe names.
   *
   * Uses exact matching — schemas like "NullableBoolean" or "StringMap" are NOT renamed.
   */
  private autoRenameConflictingSchemas(ir: SchemaIR): void {
    // Find exact matches only
    const renames = new Map<string, string>();
    for (const name of ir.schemas.keys()) {
      if (GRAPHQL_BUILT_IN_SCALARS.has(name)) {
        renames.set(name, `${name}Model`);
      }
    }

    if (renames.size === 0) return;

    // Rebuild schemas map with renamed keys and updated schema names
    const entries = Array.from(ir.schemas.entries());
    ir.schemas.clear();
    for (const [originalName, schema] of entries) {
      const newName = renames.get(originalName);
      if (newName) {
        schema.name = newName;
      }
      ir.schemas.set(newName || originalName, schema);
    }

    // Update all type references across schemas
    for (const schema of ir.schemas.values()) {
      for (const prop of schema.properties.values()) {
        this.updateTypeRefs(prop.type, renames);
      }
    }

    // Update all type references across operations
    for (const op of ir.operations.values()) {
      for (const param of op.parameters) {
        this.updateTypeRefs(param.type, renames);
      }
      if (op.requestBody?.content) {
        for (const type of op.requestBody.content.values()) {
          this.updateTypeRefs(type, renames);
        }
      }
      for (const response of op.responses.values()) {
        if (response.content) {
          for (const type of response.content.values()) {
            this.updateTypeRefs(type, renames);
          }
        }
      }
    }

    const renamed = Array.from(renames.entries())
      .map(([from, to]) => `${from} → ${to}`)
      .join(', ');
    console.log(`NestJS GraphQL: auto-renamed ${renames.size} schema(s) conflicting with built-in scalars: ${renamed}`);
  }

  /**
   * Recursively update type reference names based on rename map
   */
  private updateTypeRefs(type: TypeReference, renames: Map<string, string>): void {
    if (!type) return;

    if ((type.kind === 'reference' || type.kind === 'object') && type.name && renames.has(type.name)) {
      type.name = renames.get(type.name)!;
    }
    if (type.elementType) {
      this.updateTypeRefs(type.elementType, renames);
    }
    if (type.unionTypes) {
      for (const t of type.unionTypes) {
        this.updateTypeRefs(t, renames);
      }
    }
    if (type.additionalProperties) {
      this.updateTypeRefs(type.additionalProperties, renames);
    }
  }
}
