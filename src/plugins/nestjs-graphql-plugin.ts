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

  /** Track generated union type names per source file to avoid duplicates */
  private generatedUnionsByFile = new Map<string, Set<string>>();

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
    // Check for union types that need special handling
    const unionResult = this.handleUnionFieldType(property, propertyDef, schema, context);
    if (unionResult) {
      return; // Union was handled (either createUnionType or GraphQLJSON fallback)
    }

    const fieldType = this.getGraphQLFieldType(propertyDef.type, propertyDef.format);
    if (!fieldType) {
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
   * Handle union type fields — returns true if the union was handled
   */
  private handleUnionFieldType(
    property: PropertyDeclaration,
    propertyDef: PropertyDefinition,
    schema: SchemaDefinition,
    context: GenerationContext
  ): boolean {
    // Unwrap array to find union inside
    const type = propertyDef.type;
    const isArray = type.kind === 'array';
    const innerType = isArray ? type.elementType : type;

    if (!innerType || innerType.kind !== 'union' || !innerType.unionTypes || innerType.unionTypes.length === 0) {
      return false;
    }

    // Get member names — only handle unions of references
    const memberNames = innerType.unionTypes
      .map(t => t.name)
      .filter((n): n is string => !!n);

    if (memberNames.length === 0) {
      return false;
    }

    const sourceFile = property.getSourceFile();

    if (innerType.discriminator?.propertyName) {
      // Strategy 1: Discriminated union → createUnionType
      const unionName = this.buildUnionName(memberNames);
      const unionVarName = unionName + 'Union';

      const filePath = sourceFile.getFilePath();
      if (!this.generatedUnionsByFile.has(filePath)) {
        this.generatedUnionsByFile.set(filePath, new Set());
      }
      const fileUnions = this.generatedUnionsByFile.get(filePath)!;

      if (!fileUnions.has(unionVarName)) {
        fileUnions.add(unionVarName);

        context.importManager.addImport('@nestjs/graphql', 'createUnionType');

        // Build resolveType mapping
        const disc = innerType.discriminator;
        const mappingEntries: string[] = [];
        if (disc.mapping) {
          for (const [key, schemaName] of Object.entries(disc.mapping)) {
            mappingEntries.push(`    '${key}': ${schemaName}`);
          }
        } else {
          // No explicit mapping — use schema names as discriminator values (per OpenAPI spec)
          for (const name of memberNames) {
            mappingEntries.push(`    '${name}': ${name}`);
          }
        }

        const unionDecl = `\nexport const ${unionVarName} = createUnionType({
  name: '${unionName}',
  types: () => [${memberNames.join(', ')}] as const,
  resolveType: (value: any) => {
    const typeMap: Record<string, Function> = {
${mappingEntries.join(',\n')}
    };
    return typeMap[value.${disc.propertyName}] ?? null;
  },
});\n`;

        sourceFile.addStatements(unionDecl);
      }

      // Add @Field with union type
      const fieldType = isArray ? `[${unionVarName}]` : unionVarName;
      const options = this.buildFieldOptions(propertyDef);
      const optionsStr = options ? `, ${this.buildOptionsString(options)}` : '';
      property.addDecorator({
        name: 'Field',
        arguments: [`() => ${fieldType}${optionsStr}`],
      });
    } else {
      // Strategy 2: No discriminator → GraphQLJSON fallback + warning
      const memberStr = memberNames.join(', ');
      console.warn(
        `⚠ ${schema.name}.${propertyDef.name}: oneOf/anyOf without discriminator — falling back to GraphQLJSON.\n` +
        `  Tip: add a discriminator to your OpenAPI spec for a fully typed GraphQL union.`
      );

      context.importManager.addImport('graphql-scalars', 'GraphQLJSON');

      const fieldType = isArray ? '[GraphQLJSON]' : 'GraphQLJSON';

      // Add description hint about the union members
      const options = this.buildFieldOptions(propertyDef);
      if (!options) {
        const descHint = `Union type — see ${memberStr}`;
        property.addDecorator({
          name: 'Field',
          arguments: [`() => ${fieldType}, { description: \`${this.escapeForTemplate(descHint)}\` }`],
        });
      } else {
        if (!options.description) {
          options.description = this.escapeForTemplate(`Union type — see ${memberStr}`);
        }
        const optionsStr = this.buildOptionsString(options);
        property.addDecorator({
          name: 'Field',
          arguments: [`() => ${fieldType}, ${optionsStr}`],
        });
      }
    }

    return true;
  }

  /**
   * Build a union type name from member names.
   * ≤3 members: TypeAOrTypeB or TypeAOrTypeBOrTypeC
   * >3 members: TypeAOrTypeBOrMore3Union
   */
  private buildUnionName(memberNames: string[]): string {
    if (memberNames.length <= 3) {
      return memberNames.join('Or');
    }
    return `${memberNames[0]}Or${memberNames[1]}OrMore${memberNames.length}`;
  }

  /**
   * Add @nestjs/graphql to package.json
   */
  modifyPackageJson(packageJson: any, context: GenerationContext): void {
    if (!packageJson.dependencies) {
      packageJson.dependencies = {};
    }

    packageJson.dependencies['@nestjs/graphql'] = '^12.0.0';
    packageJson.dependencies['graphql-scalars'] = '^1.22.0';
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
          return '[GraphQLJSON]';
        }
        const elementType = this.getGraphQLFieldType(type.elementType);
        if (!elementType) {
          return null;
        }
        return `[${elementType}]`;

      case 'reference':
        return type.name || 'GraphQLJSON';

      case 'object':
        // Named object types use their class name; untyped objects use GraphQLJSON
        return type.name || 'GraphQLJSON';

      case 'dictionary':
        // Dictionaries are opaque JSON objects in GraphQL
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
    if (type.discriminator?.mapping) {
      const updatedMapping: Record<string, string> = {};
      for (const [key, value] of Object.entries(type.discriminator.mapping)) {
        updatedMapping[key] = renames.get(value) || value;
      }
      type.discriminator.mapping = updatedMapping;
    }
    if (type.additionalProperties) {
      this.updateTypeRefs(type.additionalProperties, renames);
    }
  }
}
