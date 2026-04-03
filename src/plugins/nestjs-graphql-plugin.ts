/**
 * NestJS GraphQL Plugin
 *
 * Adds @ObjectType() and @Field() decorators from @nestjs/graphql
 * Properly handles types, descriptions, nullability, and deprecation
 */

import { ClassDeclaration, PropertyDeclaration } from 'ts-morph';
import { GeneratorPlugin } from './plugin-interface';
import {
  SchemaDefinition,
  PropertyDefinition,
  TypeReference,
  SchemaIR,
} from '../ir/types';
import { GenerationContext } from '../builders/class-builder';

export class NestJSGraphQLPlugin implements GeneratorPlugin {
  name = 'nestjs-graphql';
  priority = 100;

  /**
   * Add @nestjs/graphql imports before generation
   */
  beforeGeneration(context: GenerationContext, ir: SchemaIR): void {
    context.importManager.addImport('@nestjs/graphql', 'ObjectType');
    context.importManager.addImport('@nestjs/graphql', 'Field');
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
   * Add @nestjs/graphql to package.json
   */
  modifyPackageJson(packageJson: any, context: GenerationContext): void {
    if (!packageJson.dependencies) {
      packageJson.dependencies = {};
    }

    packageJson.dependencies['@nestjs/graphql'] = '^12.0.0';
    packageJson.dependencies['graphql-scalars'] = '^1.23.0';
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
        return type.name || 'GraphQLJSON';

      case 'dictionary':
        return 'GraphQLJSON';

      case 'unknown':
        return 'GraphQLJSON';

      case 'union':
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
    if (/\bGraphQLJSON\b/.test(fieldType)) {
      context.importManager.addImport('graphql-scalars', 'GraphQLJSON');
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
}
