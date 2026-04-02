/**
 * Parameter Style Builder
 *
 * Utility class for handling different API method parameter styles.
 * Supports object-flat and positional parameter styles.
 */

import { OperationDefinition, ParameterDefinition, TypeReference } from '../ir/types';
import { toCamelCase, toPascalCase } from '../utils/name-utils';
import { GeneratorOptions } from '../builders/class-builder';

/**
 * Information about a parameter collision
 */
export interface CollisionInfo {
  /** The camelCase name causing collision */
  name: string;
  /** Original parameter name */
  originalName: string;
  /** Parameter location */
  location: 'path' | 'query' | 'header' | 'cookie';
  /** Parameter type */
  type: TypeReference;
  /** Is required? */
  required: boolean;
}

/**
 * Collision detection report
 */
export interface CollisionReport {
  /** Whether collisions were found */
  hasCollisions: boolean;
  /** Collision errors (blocking) */
  errors: string[];
  /** Map of parameter names to their info */
  parameterMap: Map<string, CollisionInfo>;
}

/**
 * Parameter style builder for generating method signatures and interfaces
 */
export class ParameterStyleBuilder {
  private options: GeneratorOptions;

  constructor(options: GeneratorOptions) {
    this.options = options;
  }

  /**
   * Detect parameter name collisions for object-flat style
   *
   * In object-flat style, all parameters go into a single object,
   * so we need to ensure no two parameters have the same name after camelCase conversion.
   *
   * @param operation - The operation to check
   * @returns Collision report with errors if collisions found
   */
  detectCollisions(operation: OperationDefinition): CollisionReport {
    const seen = new Map<string, CollisionInfo>();
    const errors: string[] = [];

    // Check all parameters
    for (const param of operation.parameters) {
      const camelName = toCamelCase(param.name);

      if (seen.has(camelName)) {
        const existing = seen.get(camelName)!;

        // Collision found - always error
        errors.push(
          `Parameter name collision in operation '${operation.operationId}':\n` +
          `  - '${existing.originalName}' (${existing.location} parameter, type: ${this.typeToString(existing.type)})\n` +
          `  - '${param.name}' (${param.in} parameter, type: ${this.typeToString(param.type)})\n` +
          `Both parameters normalize to '${camelName}'.\n\n` +
          `Solutions:\n` +
          `  1. Rename one parameter in your OpenAPI spec\n` +
          `  2. Use --parameter-style positional to preserve original behavior`
        );
      } else {
        seen.set(camelName, {
          name: camelName,
          originalName: param.name,
          location: param.in,
          type: param.type,
          required: param.required,
        });
      }
    }

    return {
      hasCollisions: errors.length > 0,
      errors,
      parameterMap: seen,
    };
  }

  /**
   * Generate parameter interface for object-flat style
   *
   * Creates a TypeScript interface for the params object.
   * Note: requestBody is NOT included in this interface - it's a separate parameter.
   *
   * @param operation - The operation to generate interface for
   * @returns TypeScript interface code
   */
  generateParameterInterface(operation: OperationDefinition): string {
    const interfaceName = `${toPascalCase(operation.operationId)}Params`;
    const lines: string[] = [];

    // Add JSDoc
    lines.push(`/**`);
    lines.push(` * Parameters for ${operation.operationId} operation`);
    if (operation.summary) {
      lines.push(` * ${operation.summary}`);
    }
    lines.push(` */`);

    // Interface declaration
    lines.push(`export interface ${interfaceName} {`);

    // Add each parameter (excluding requestBody - it's separate!)
    for (const param of operation.parameters) {
      const paramName = toCamelCase(param.name);
      const typeStr = this.typeReferenceToString(param.type);
      const optional = !param.required ? '?' : '';

      // Add param comment
      if (param.description) {
        lines.push(`  /** ${param.description} */`);
      }
      lines.push(`  ${paramName}${optional}: ${typeStr};`);
    }

    lines.push(`}`);
    lines.push(''); // Empty line after interface

    return lines.join('\n');
  }

  /**
   * Generate parameter extraction code for method body
   *
   * For object-flat style, this generates destructuring code.
   * For positional style, no extraction is needed.
   *
   * @param operation - The operation
   * @param style - The parameter style
   * @returns Array of code lines
   */
  generateParameterExtraction(operation: OperationDefinition, style: 'positional' | 'object-flat'): string[] {
    const lines: string[] = [];

    if (style === 'positional') {
      // No extraction needed - parameters are already named correctly
      return lines;
    }

    // object-flat style
    if (operation.parameters.length > 0) {
      // Generate destructuring
      // Use `params || {}` to handle optional params when all parameters are optional
      const paramNames = operation.parameters.map(p => toCamelCase(p.name));
      lines.push(`const { ${paramNames.join(', ')} } = params || {};`);
      lines.push(''); // Empty line after extraction
    }

    // Note: requestBody is NOT extracted from params - it's a separate parameter

    return lines;
  }

  /**
   * Convert a TypeReference to a TypeScript type string
   *
   * @param type - The type reference
   * @returns TypeScript type string
   */
  private typeReferenceToString(type: TypeReference): string {
    switch (type.kind) {
      case 'primitive':
        return type.name || 'any';

      case 'array':
        if (!type.elementType) return 'any[]';
        return `Array<${this.typeReferenceToString(type.elementType)}>`;

      case 'reference':
      case 'object':
        return type.name || 'any';

      case 'union':
        if (!type.unionTypes || type.unionTypes.length === 0) return 'any';
        return type.unionTypes.map(t => this.typeReferenceToString(t)).join(' | ');

      case 'dictionary':
        if (!type.additionalProperties) return 'Record<string, any>';
        return `Record<string, ${this.typeReferenceToString(type.additionalProperties)}>`;

      case 'unknown':
      default:
        return 'any';
    }
  }

  /**
   * Convert a TypeReference to a string for error messages
   *
   * @param type - The type reference
   * @returns Human-readable type string
   */
  private typeToString(type: TypeReference): string {
    return this.typeReferenceToString(type);
  }
}
