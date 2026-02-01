/**
 * Zod Validator Plugin
 *
 * Generates Zod validation schemas as separate .zod.ts files
 * alongside the generated class models.
 */

import * as path from 'path';
import * as fs from 'fs';
import { GeneratorPlugin } from './plugin-interface';
import {
  SchemaDefinition,
  PropertyDefinition,
  TypeReference,
  Constraints,
  SchemaIR,
} from '../ir/types';
import { GenerationContext } from '../builders/class-builder';
import { toKebabCase } from '../utils/name-utils';

/**
 * Plugin that generates Zod validation schemas
 *
 * Generates:
 * - {model}.zod.ts files with Zod schema definitions
 * - Type exports using z.infer<typeof schema>
 */
export class ZodValidatorPlugin implements GeneratorPlugin {
  name = 'zod-validator';
  priority = 85; // Same priority as AjvValidator

  /**
   * Generate .zod.ts files after model generation
   */
  afterGeneration(context: GenerationContext, ir: SchemaIR): void {
    const modelsDir = context.options.bare
      ? context.options.outputDir
      : path.join(context.options.outputDir, 'models');

    // Ensure models directory exists
    if (!fs.existsSync(modelsDir)) {
      fs.mkdirSync(modelsDir, { recursive: true });
    }

    // Generate Zod file for each schema
    for (const [_name, schema] of ir.schemas) {
      this.generateZodFile(schema, context, modelsDir, ir);
    }

    // Update index.ts to include Zod exports
    this.updateIndexFile(ir, context, modelsDir);
  }

  /**
   * Add zod dependency to package.json
   */
  modifyPackageJson(packageJson: any, _context: GenerationContext): void {
    if (!packageJson.dependencies) {
      packageJson.dependencies = {};
    }
    packageJson.dependencies['zod'] = '^3.23.0';
  }

  /**
   * Generate a .zod.ts file for a schema
   */
  private generateZodFile(
    schema: SchemaDefinition,
    context: GenerationContext,
    modelsDir: string,
    ir: SchemaIR
  ): void {
    const fileName = this.getSchemaFileName(schema, context) + '.zod.ts';
    const filePath = path.join(modelsDir, fileName);

    // Collect imports needed
    const imports = this.collectImports(schema, context, ir);

    // Build the Zod schema
    const zodSchema = this.buildZodSchema(schema);

    // Generate file content
    const lines: string[] = [];

    // Import zod
    lines.push("import { z } from 'zod';");

    // Import referenced schemas
    if (imports.length > 0) {
      lines.push('');
      for (const imp of imports) {
        const importPath = context.options.esm
          ? `./${imp.fileName}.zod.js`
          : `./${imp.fileName}.zod`;
        lines.push(`import { ${imp.schemaName}Schema } from '${importPath}';`);
      }
    }

    lines.push('');

    // Add JSDoc for schema
    if (schema.description) {
      lines.push('/**');
      lines.push(` * ${schema.description.replace(/\n/g, '\n * ')}`);
      lines.push(' */');
    }

    // Export the schema
    lines.push(`export const ${schema.name}Schema = ${zodSchema};`);
    lines.push('');

    // Export the inferred type
    lines.push(`export type ${schema.name} = z.infer<typeof ${schema.name}Schema>;`);
    lines.push('');

    // Write file
    fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
  }

  /**
   * Build the Zod schema string from a SchemaDefinition
   */
  private buildZodSchema(schema: SchemaDefinition): string {
    // Handle enum schemas
    if (schema.type === 'enum' && schema.enumValues && schema.enumValues.length > 0) {
      const enumValues = schema.enumValues
        .map(v => typeof v === 'string' ? `'${this.escapeString(v)}'` : String(v))
        .join(', ');
      return `z.enum([${enumValues}])`;
    }

    // Build object schema
    const properties: string[] = [];

    for (const [_propName, propDef] of schema.properties) {
      const propSchema = this.buildPropertySchema(propDef);
      properties.push(`  ${propDef.name}: ${propSchema}`);
    }

    if (properties.length === 0) {
      return 'z.object({})';
    }

    return `z.object({\n${properties.join(',\n')},\n})`;
  }

  /**
   * Build a Zod schema for a property
   */
  private buildPropertySchema(propDef: PropertyDefinition): string {
    let schema = this.buildTypeSchema(propDef.type, propDef.constraints);

    // Add format-specific validations
    schema = this.applyFormatValidations(schema, propDef.format, propDef.type);

    // Add constraint validations
    schema = this.applyConstraintValidations(schema, propDef.constraints, propDef.type);

    // Add description if present
    if (propDef.description) {
      schema += `.describe('${this.escapeString(propDef.description)}')`;
    }

    // Handle nullable
    if (propDef.nullable && propDef.required) {
      schema += '.nullable()';
    } else if (propDef.nullable && !propDef.required) {
      schema += '.nullish()';
    } else if (!propDef.required) {
      schema += '.optional()';
    }

    return schema;
  }

  /**
   * Build Zod schema for a type
   */
  private buildTypeSchema(type: TypeReference, constraints?: Constraints): string {
    switch (type.kind) {
      case 'primitive':
        return this.buildPrimitiveSchema(type.name!, constraints);

      case 'array':
        if (!type.elementType) {
          return 'z.array(z.unknown())';
        }
        const elementSchema = this.buildTypeSchema(type.elementType);
        return `z.array(${elementSchema})`;

      case 'reference':
      case 'object':
        if (type.name) {
          return `${type.name}Schema`;
        }
        return 'z.object({})';

      case 'union':
        if (!type.unionTypes || type.unionTypes.length === 0) {
          return 'z.unknown()';
        }
        if (type.unionTypes.length === 1) {
          return this.buildTypeSchema(type.unionTypes[0]);
        }
        const unionSchemas = type.unionTypes.map(t => this.buildTypeSchema(t));
        return `z.union([${unionSchemas.join(', ')}])`;

      case 'dictionary':
        const valueSchema = type.additionalProperties
          ? this.buildTypeSchema(type.additionalProperties)
          : 'z.unknown()';
        return `z.record(z.string(), ${valueSchema})`;

      case 'unknown':
      default:
        return 'z.unknown()';
    }
  }

  /**
   * Build Zod schema for primitive types
   */
  private buildPrimitiveSchema(name: string, constraints?: Constraints): string {
    // Check for enum first
    if (constraints?.enum && constraints.enum.length > 0) {
      const enumValues = constraints.enum
        .map(v => typeof v === 'string' ? `'${this.escapeString(v)}'` : String(v))
        .join(', ');
      return `z.enum([${enumValues}])`;
    }

    switch (name) {
      case 'string':
        return 'z.string()';
      case 'number':
        return 'z.number()';
      case 'integer':
        return 'z.number().int()';
      case 'boolean':
        return 'z.boolean()';
      default:
        return 'z.string()';
    }
  }

  /**
   * Apply format-specific validations
   */
  private applyFormatValidations(
    schema: string,
    format: string | undefined,
    type: TypeReference
  ): string {
    if (!format) return schema;

    // Only apply to string types
    if (type.kind !== 'primitive' || type.name !== 'string') {
      return schema;
    }

    switch (format) {
      case 'email':
        return schema + '.email()';
      case 'url':
      case 'uri':
        return schema + '.url()';
      case 'uuid':
        return schema + '.uuid()';
      case 'date-time':
        return schema + '.datetime()';
      case 'date':
        return schema + '.date()';
      case 'ipv4':
        return schema + ".ip({ version: 'v4' })";
      case 'ipv6':
        return schema + ".ip({ version: 'v6' })";
      case 'cuid':
        return schema + '.cuid()';
      case 'cuid2':
        return schema + '.cuid2()';
      case 'ulid':
        return schema + '.ulid()';
      default:
        return schema;
    }
  }

  /**
   * Apply constraint validations
   */
  private applyConstraintValidations(
    schema: string,
    constraints: Constraints | undefined,
    type: TypeReference
  ): string {
    if (!constraints) return schema;

    // Skip if enum was already applied
    if (constraints.enum && constraints.enum.length > 0) {
      return schema;
    }

    let result = schema;

    // String constraints
    if (type.kind === 'primitive' && type.name === 'string') {
      if (constraints.minLength !== undefined) {
        result += `.min(${constraints.minLength})`;
      }
      if (constraints.maxLength !== undefined) {
        result += `.max(${constraints.maxLength})`;
      }
      if (constraints.pattern) {
        result += `.regex(/${this.escapeRegex(constraints.pattern)}/)`;
      }
    }

    // Numeric constraints
    if (type.kind === 'primitive' && (type.name === 'number' || type.name === 'integer')) {
      if (constraints.minimum !== undefined) {
        if (constraints.exclusiveMinimum) {
          result += `.gt(${constraints.minimum})`;
        } else {
          result += `.min(${constraints.minimum})`;
        }
      }
      if (constraints.maximum !== undefined) {
        if (constraints.exclusiveMaximum) {
          result += `.lt(${constraints.maximum})`;
        } else {
          result += `.max(${constraints.maximum})`;
        }
      }
      if (constraints.multipleOf !== undefined) {
        result += `.multipleOf(${constraints.multipleOf})`;
      }
    }

    // Array constraints
    if (type.kind === 'array') {
      if (constraints.minItems !== undefined) {
        result += `.min(${constraints.minItems})`;
      }
      if (constraints.maxItems !== undefined) {
        result += `.max(${constraints.maxItems})`;
      }
    }

    return result;
  }

  /**
   * Collect imports needed for a schema
   */
  private collectImports(
    schema: SchemaDefinition,
    context: GenerationContext,
    ir: SchemaIR
  ): Array<{ schemaName: string; fileName: string }> {
    const imports: Array<{ schemaName: string; fileName: string }> = [];
    const importedNames = new Set<string>();

    for (const [_propName, propDef] of schema.properties) {
      this.collectTypeImports(propDef.type, importedNames, ir);
    }

    // Remove self-reference
    importedNames.delete(schema.name);

    // Build import entries
    for (const name of importedNames) {
      const referencedSchema = ir.schemas.get(name);
      if (referencedSchema) {
        imports.push({
          schemaName: name,
          fileName: this.getSchemaFileName(referencedSchema, context),
        });
      }
    }

    return imports.sort((a, b) => a.schemaName.localeCompare(b.schemaName));
  }

  /**
   * Recursively collect type names that need to be imported
   */
  private collectTypeImports(
    type: TypeReference,
    collected: Set<string>,
    ir: SchemaIR
  ): void {
    if (!type) return;

    switch (type.kind) {
      case 'reference':
      case 'object':
        if (type.name && ir.schemas.has(type.name)) {
          collected.add(type.name);
        }
        break;

      case 'array':
        if (type.elementType) {
          this.collectTypeImports(type.elementType, collected, ir);
        }
        break;

      case 'union':
        if (type.unionTypes) {
          for (const t of type.unionTypes) {
            this.collectTypeImports(t, collected, ir);
          }
        }
        break;

      case 'dictionary':
        if (type.additionalProperties) {
          this.collectTypeImports(type.additionalProperties, collected, ir);
        }
        break;
    }
  }

  /**
   * Update index.ts to include Zod exports
   */
  private updateIndexFile(
    ir: SchemaIR,
    context: GenerationContext,
    modelsDir: string
  ): void {
    // Create a separate index.zod.ts file
    const indexPath = path.join(modelsDir, 'index.zod.ts');
    const lines: string[] = [];

    // Sort schemas alphabetically
    const schemas = Array.from(ir.schemas.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    // Export all Zod schemas
    for (const schema of schemas) {
      const fileName = this.getSchemaFileName(schema, context);
      const importPath = context.options.esm
        ? `./${fileName}.zod.js`
        : `./${fileName}.zod`;
      lines.push(`export * from '${importPath}';`);
    }

    fs.writeFileSync(indexPath, lines.join('\n') + '\n', 'utf-8');
  }

  /**
   * Get the file name for a schema (without extension)
   */
  private getSchemaFileName(
    schema: SchemaDefinition,
    context: GenerationContext
  ): string {
    if (context.options.crdKindCase && schema.metadata.kind) {
      return this.applyCaseTransform(schema.metadata.kind, context.options.crdKindCase);
    }
    return toKebabCase(schema.name);
  }

  /**
   * Apply case transformation
   */
  private applyCaseTransform(
    name: string,
    caseType: 'kebab' | 'snake' | 'pascal' | 'camel' | 'none'
  ): string {
    switch (caseType) {
      case 'kebab':
        return toKebabCase(name);
      case 'snake':
        return name.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
      case 'pascal':
        return name.charAt(0).toUpperCase() + name.slice(1);
      case 'camel':
        return name.charAt(0).toLowerCase() + name.slice(1);
      case 'none':
      default:
        return name;
    }
  }

  /**
   * Escape a string for use in generated code
   */
  private escapeString(str: string): string {
    return str
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r');
  }

  /**
   * Escape a regex pattern for use in generated code
   */
  private escapeRegex(pattern: string): string {
    // Escape forward slashes for regex literal
    return pattern.replace(/\//g, '\\/');
  }
}
