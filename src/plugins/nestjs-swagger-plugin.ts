/**
 * NestJS Swagger Plugin
 *
 * Adds @ApiProperty decorators from @nestjs/swagger
 * Properly handles types, descriptions, constraints, and examples
 */

import { PropertyDeclaration, SourceFile } from 'ts-morph';
import { GeneratorPlugin } from './plugin-interface';
import {
  SchemaDefinition,
  PropertyDefinition,
  TypeReference,
  SchemaIR,
} from '../ir/types';
import { GenerationContext } from '../builders/class-builder';

export class NestJSSwaggerPlugin implements GeneratorPlugin {
  name = 'nestjs-swagger';
  priority = 100; // Medium-high priority

  /**
   * Add @nestjs/swagger imports before generation
   */
  beforeGeneration(context: GenerationContext, ir: SchemaIR): void {
    context.importManager.addImport('@nestjs/swagger', 'ApiProperty');
  }

  /**
   * Decorate property with @ApiProperty()
   */
  decorateProperty(
    property: PropertyDeclaration,
    propertyDef: PropertyDefinition,
    schema: SchemaDefinition,
    context: GenerationContext
  ): void {
    const options = this.buildApiPropertyOptions(propertyDef, schema, context);
    const optionsStr = this.buildOptionsString(options);

    property.addDecorator({
      name: 'ApiProperty',
      arguments: [optionsStr],
    });
  }

  /**
   * Add @ApiExtraModels for enum types so Swagger discovers them
   */
  decorateEnum(
    sourceFile: SourceFile,
    schema: SchemaDefinition,
    context: GenerationContext
  ): void {
    // No Swagger-specific decoration needed for enum files
    // Enum values are handled at the property level via { enum: EnumName }
  }

  /**
   * Add @nestjs/swagger to package.json
   */
  modifyPackageJson(packageJson: any, context: GenerationContext): void {
    if (!packageJson.dependencies) {
      packageJson.dependencies = {};
    }

    packageJson.dependencies['@nestjs/swagger'] = '^7.0.0';
  }

  /**
   * Build @ApiProperty options object
   */
  private buildApiPropertyOptions(
    propertyDef: PropertyDefinition,
    schema: SchemaDefinition,
    context?: GenerationContext
  ): Record<string, any> {
    const options: Record<string, any> = {};

    // Check if this property references an enum schema
    const enumRefName = this.getEnumReferenceName(propertyDef.type, context?.enumSchemaNames);
    if (enumRefName) {
      // Use enum: EnumName for enum references (not type: () => EnumName)
      options.enum = enumRefName;
    } else if (propertyDef.type.kind === 'array' && propertyDef.type.elementType) {
      // Check for arrays of enums
      const arrayEnumName = this.getEnumReferenceName(propertyDef.type.elementType, context?.enumSchemaNames);
      if (arrayEnumName) {
        options.enum = arrayEnumName;
        options.isArray = true;
      } else {
        const swaggerType = this.getSwaggerType(propertyDef.type);
        if (swaggerType) {
          options.type = swaggerType;
        }
      }
    } else {
      // Type - use constructor reference (String, Number, Boolean, not 'string', 'number', 'boolean')
      const swaggerType = this.getSwaggerType(propertyDef.type);
      if (swaggerType) {
        options.type = swaggerType;
      }
    }

    // Description
    if (propertyDef.description) {
      options.description = this.escapeForTemplate(propertyDef.description);
    }

    // Required
    options.required = propertyDef.required;

    // Nullable
    if (propertyDef.nullable) {
      options.nullable = true;
    }

    // Format
    if (propertyDef.format) {
      options.format = propertyDef.format;
    }

    // Example
    if (propertyDef.example !== undefined) {
      options.example = propertyDef.example;
    }

    // Deprecated
    if (propertyDef.metadata.deprecated) {
      options.deprecated = true;
    }

    // Constraints
    if (propertyDef.constraints) {
      const { constraints } = propertyDef;

      if (constraints.minimum !== undefined) {
        options.minimum = constraints.minimum;
      }
      if (constraints.maximum !== undefined) {
        options.maximum = constraints.maximum;
      }
      if (constraints.minLength !== undefined) {
        options.minLength = constraints.minLength;
      }
      if (constraints.maxLength !== undefined) {
        options.maxLength = constraints.maxLength;
      }
      if (constraints.pattern) {
        options.pattern = constraints.pattern;
      }
      if (constraints.minItems !== undefined) {
        options.minItems = constraints.minItems;
      }
      if (constraints.maxItems !== undefined) {
        options.maxItems = constraints.maxItems;
      }
      if (constraints.uniqueItems !== undefined) {
        options.uniqueItems = constraints.uniqueItems;
      }
      if (constraints.enum && constraints.enum.length > 0) {
        options.enum = constraints.enum;
      }
    }

    return options;
  }

  /**
   * Get the enum type name if a type references an enum schema
   * Returns the enum name for direct references, null otherwise
   */
  private getEnumReferenceName(type: TypeReference, enumSchemaNames?: Set<string>): string | null {
    if (!enumSchemaNames) return null;

    if ((type.kind === 'reference' || type.kind === 'object') && type.name && enumSchemaNames.has(type.name)) {
      return type.name;
    }

    return null;
  }

  /**
   * Get Swagger-compatible type for @ApiProperty
   *
   * NestJS Swagger requires constructor references (String, Number, Boolean)
   * not string literals ('string', 'number', 'boolean')
   */
  private getSwaggerType(type: TypeReference): string | undefined {
    switch (type.kind) {
      case 'primitive':
        // Use constructor reference: String, Number, Boolean
        switch (type.name) {
          case 'string':
            return 'String';
          case 'number':
            return 'Number';
          case 'boolean':
            return 'Boolean';
          default:
            return 'String';
        }

      case 'array':
        if (!type.elementType) {
          return '[Object]';
        }

        // For arrays of primitives: [String], [Number], [Boolean]
        if (type.elementType.kind === 'primitive') {
          const primitiveType = this.getSwaggerType(type.elementType);
          return `[${primitiveType}]`;
        }

        // For arrays of objects: [ClassName]
        if (type.elementType.kind === 'reference' || type.elementType.kind === 'object') {
          return `[${type.elementType.name}]`;
        }

        return '[Object]';

      case 'reference':
      case 'object':
        // Use arrow function for class references: () => ClassName
        return `() => ${type.name}`;

      case 'dictionary':
      case 'union':
      case 'unknown':
      default:
        // Generic object type
        return 'Object';
    }
  }

  /**
   * Build the options string for @ApiProperty({ ... })
   */
  private buildOptionsString(options: Record<string, any>): string {
    const entries: string[] = [];

    for (const [key, value] of Object.entries(options)) {
      let valueStr: string;

      if (typeof value === 'string') {
        // Check if it's a function reference (starts with '()' or is a constructor)
        if (value.startsWith('()') || value === 'String' || value === 'Number' ||
            value === 'Boolean' || value === 'Object' || value.startsWith('[')) {
          // Don't quote function references or constructor names
          valueStr = value;
        } else if (key === 'enum' && /^[A-Z]/.test(value)) {
          // Enum type reference - output as bare identifier
          valueStr = value;
        } else {
          // Quote strings and use template literal for proper escaping
          valueStr = `\`${value}\``;
        }
      } else if (Array.isArray(value)) {
        valueStr = JSON.stringify(value);
      } else if (typeof value === 'object' && value !== null) {
        valueStr = JSON.stringify(value);
      } else {
        // Numbers, booleans, null
        valueStr = JSON.stringify(value);
      }

      entries.push(`${key}: ${valueStr}`);
    }

    return `{\n        ${entries.join(',\n        ')}\n    }`;
  }

  /**
   * Escape special characters for template literals
   * Handles backticks, backslashes, and other special chars
   */
  private escapeForTemplate(text: string): string {
    return text
      .replace(/\\/g, '\\\\')  // Escape backslashes first
      .replace(/`/g, '\\`')    // Escape backticks
      .replace(/\$/g, '\\$');  // Escape dollar signs (template interpolation)
  }
}
