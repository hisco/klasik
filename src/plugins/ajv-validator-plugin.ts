import { ClassDeclaration, Scope } from 'ts-morph';
import { GeneratorPlugin } from './plugin-interface';
import { SchemaDefinition, PropertyDefinition, TypeReference, Constraints } from '../ir/types';
import { GenerationContext } from '../builders/class-builder';

/**
 * Plugin that adds Ajv JSON Schema validation methods to generated classes
 *
 * Adds:
 * - static getSchema(): Returns JSON Schema Draft 2020-12
 * - static validateWithJsonSchema(data): Validates using Ajv
 * - Private Ajv instance (singleton per class)
 */
export class AjvValidatorPlugin implements GeneratorPlugin {
  name = 'ajv-validator';
  priority = 85; // After ClassValidator (90), before lower-priority plugins

  /**
   * No-op: Imports are added per-class in decorateClass
   */
  beforeGeneration(_context: GenerationContext, _ir: any): void {
    // Imports added in decorateClass
  }

  /**
   * Add static validation methods to each class
   */
  decorateClass(
    classDecl: ClassDeclaration,
    schema: SchemaDefinition,
    context: GenerationContext
  ): void {
    // 1. Convert IR SchemaDefinition → JSON Schema Draft 2020-12
    const jsonSchema = this.convertSchemaToJsonSchema(schema);

    // 2. Add static getSchema() method
    classDecl.addMethod({
      name: 'getSchema',
      isStatic: true,
      returnType: 'object',
      statements: `return ${JSON.stringify(jsonSchema, null, 2)};`,
      docs: [{
        description: [
          `Get JSON Schema for ${schema.name}`,
          '@returns JSON Schema Draft 2020-12'
        ].join('\n')
      }]
    });

    // 3. Add private static _ajvInstance field
    classDecl.addProperty({
      name: '_ajvInstance',
      isStatic: true,
      scope: Scope.Private,
      type: 'Ajv | null',
      initializer: 'null',
    });

    // 4. Add private static _compiledValidator field for caching
    classDecl.addProperty({
      name: '_compiledValidator',
      isStatic: true,
      scope: Scope.Private,
      type: 'any',
      initializer: 'null',
    });

    // 5. Add private static getAjvInstance() method
    classDecl.addMethod({
      name: 'getAjvInstance',
      isStatic: true,
      scope: Scope.Private,
      returnType: 'Ajv',
      statements: [
        'if (!this._ajvInstance) {',
        '  this._ajvInstance = new Ajv({ allErrors: true, strict: false });',
        '  addFormats(this._ajvInstance);',
        '}',
        'return this._ajvInstance;'
      ].join('\n'),
      docs: [{
        description: `Get or create Ajv instance for ${schema.name}`
      }]
    });

    // 6. Add private static getCompiledValidator() method
    classDecl.addMethod({
      name: 'getCompiledValidator',
      isStatic: true,
      scope: Scope.Private,
      returnType: 'any',
      statements: [
        'if (!this._compiledValidator) {',
        '  const ajv = this.getAjvInstance();',
        '  const schema = this.getSchema();',
        '  this._compiledValidator = ajv.compile(schema);',
        '}',
        'return this._compiledValidator;'
      ].join('\n'),
      docs: [{
        description: `Get or create compiled validator for ${schema.name} (cached for performance)`
      }]
    });

    // 7. Add static validateWithJsonSchema() method
    classDecl.addMethod({
      name: 'validateWithJsonSchema',
      isStatic: true,
      parameters: [{ name: 'data', type: 'unknown' }],
      returnType: '{ valid: boolean; errors: any[] }',
      statements: [
        'const validate = this.getCompiledValidator();',
        'const valid = validate(data);',
        '',
        '// Collect errors',
        'const allErrors: any[] = validate.errors || [];',
        '',
        '// Recursively validate nested objects that have validateWithJsonSchema method',
        'if (valid && typeof data === "object" && data !== null) {',
        '  for (const [key, value] of Object.entries(data)) {',
        '    if (value && typeof value === "object") {',
        '      // Check if the value\'s constructor has validateWithJsonSchema',
        '      const constructor = (value as any).constructor;',
        '      if (constructor && typeof constructor.validateWithJsonSchema === "function") {',
        '        const nestedResult = constructor.validateWithJsonSchema(value);',
        '        if (!nestedResult.valid) {',
        '          allErrors.push(...nestedResult.errors.map((e: any) => ({',
        '            ...e,',
        '            instancePath: `/${key}${e.instancePath || ""}`',
        '          })));',
        '        }',
        '      }',
        '    }',
        '  }',
        '}',
        '',
        'return { valid: allErrors.length === 0, errors: allErrors };'
      ].join('\n'),
      docs: [{
        description: [
          'Validate data against JSON Schema with recursive nested validation',
          '@param data - Data to validate',
          '@returns Validation result with errors if any'
        ].join('\n')
      }]
    });

    // 8. Add imports
    context.importManager.addImport('ajv', 'Ajv');
    context.importManager.addImport('ajv-formats', 'addFormats');
  }

  /**
   * Add ajv dependencies to package.json
   */
  modifyPackageJson(packageJson: any, _context: GenerationContext): void {
    if (!packageJson.dependencies) {
      packageJson.dependencies = {};
    }
    packageJson.dependencies['ajv'] = '^8.12.0';
    packageJson.dependencies['ajv-formats'] = '^2.1.1';
  }

  /**
   * Convert IR SchemaDefinition to JSON Schema Draft 2020-12
   */
  private convertSchemaToJsonSchema(schema: SchemaDefinition): object {
    const jsonSchema: any = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      properties: {},
      additionalProperties: false,
    };

    // Add description
    if (schema.description) {
      jsonSchema.description = schema.description;
    }

    // Convert properties
    const required: string[] = [];
    for (const [_propName, propDef] of schema.properties) {
      const propSchema: any = this.convertTypeToJsonSchema(propDef.type);

      // Add format
      if (propDef.format) {
        propSchema.format = propDef.format;
      }

      // Add description
      if (propDef.description) {
        propSchema.description = propDef.description;
      }

      // Add constraints
      Object.assign(propSchema, this.convertConstraints(propDef.constraints));

      // Add default value
      if (propDef.defaultValue !== undefined) {
        propSchema.default = propDef.defaultValue;
      }

      // Handle nullable
      if (propDef.nullable && propSchema.type) {
        if (Array.isArray(propSchema.type)) {
          if (!propSchema.type.includes('null')) {
            propSchema.type.push('null');
          }
        } else {
          propSchema.type = [propSchema.type, 'null'];
        }
      }

      jsonSchema.properties[propDef.originalName] = propSchema;

      // Track required fields
      if (propDef.required) {
        required.push(propDef.originalName);
      }
    }

    // Add required array if not empty
    if (required.length > 0) {
      jsonSchema.required = required;
    }

    // Handle enum schemas
    if (schema.type === 'enum' && schema.enumValues && schema.enumValues.length > 0) {
      return {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        enum: schema.enumValues,
        description: schema.description
      };
    }

    return jsonSchema;
  }

  /**
   * Convert IR TypeReference to JSON Schema type
   */
  private convertTypeToJsonSchema(type: TypeReference): any {
    switch (type.kind) {
      case 'primitive':
        return { type: this.mapPrimitiveType(type.name!) };

      case 'array':
        const items = type.elementType
          ? this.convertTypeToJsonSchema(type.elementType)
          : {};
        return { type: 'array', items };

      case 'reference':
      case 'object':
        // For now, use generic object type
        // In the future, we could inline nested schemas or build a definitions section
        // For complete validation, nested objects should be validated separately
        return { type: 'object' };

      case 'union':
        const anyOf = (type.unionTypes || []).map(t =>
          this.convertTypeToJsonSchema(t)
        );
        return anyOf.length > 0 ? { anyOf } : {};

      case 'dictionary':
        const additionalProps = type.additionalProperties
          ? this.convertTypeToJsonSchema(type.additionalProperties)
          : {};
        return {
          type: 'object',
          additionalProperties: additionalProps
        };

      case 'unknown':
      default:
        return {}; // Accepts any type
    }
  }

  /**
   * Map TypeScript primitive types to JSON Schema types
   */
  private mapPrimitiveType(name: string): string {
    switch (name) {
      case 'string':
        return 'string';
      case 'number':
        return 'number';
      case 'boolean':
        return 'boolean';
      case 'integer':
        return 'integer';
      default:
        return 'string';
    }
  }

  /**
   * Convert IR Constraints to JSON Schema validation keywords
   */
  private convertConstraints(constraints: Constraints | undefined): any {
    if (!constraints) {
      return {};
    }

    const result: any = {};

    // Numeric constraints
    if (constraints.minimum !== undefined) {
      if (constraints.exclusiveMinimum) {
        result.exclusiveMinimum = constraints.minimum;
      } else {
        result.minimum = constraints.minimum;
      }
    }

    if (constraints.maximum !== undefined) {
      if (constraints.exclusiveMaximum) {
        result.exclusiveMaximum = constraints.maximum;
      } else {
        result.maximum = constraints.maximum;
      }
    }

    if (constraints.multipleOf !== undefined) {
      result.multipleOf = constraints.multipleOf;
    }

    // String constraints
    if (constraints.minLength !== undefined) {
      result.minLength = constraints.minLength;
    }

    if (constraints.maxLength !== undefined) {
      result.maxLength = constraints.maxLength;
    }

    if (constraints.pattern) {
      result.pattern = constraints.pattern;
    }

    // Array constraints
    if (constraints.minItems !== undefined) {
      result.minItems = constraints.minItems;
    }

    if (constraints.maxItems !== undefined) {
      result.maxItems = constraints.maxItems;
    }

    if (constraints.uniqueItems) {
      result.uniqueItems = true;
    }

    // Enum
    if (constraints.enum && constraints.enum.length > 0) {
      result.enum = constraints.enum;
    }

    return result;
  }
}
