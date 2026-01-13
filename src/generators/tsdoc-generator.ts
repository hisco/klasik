/**
 * TSDoc Generator
 *
 * Generates rich JSDoc comments for properties and methods with comprehensive metadata
 */

import {
  PropertyDefinition,
  OperationDefinition,
  TypeReference,
  ParameterDefinition,
  RequestBodyDefinition,
} from '../ir/types';

/**
 * Generates TSDoc/JSDoc comments with rich metadata
 */
export class TSDocGenerator {
  /**
   * Generate rich JSDoc for a property
   */
  generatePropertyDoc(property: PropertyDefinition, className?: string): string {
    const lines: string[] = [];

    lines.push('/**');

    // Description
    if (property.description) {
      lines.push(` * ${this.escapeJSDoc(property.description)}`);
      lines.push(' *');
    }

    // Type tag
    const typeName = this.typeReferenceToString(property.type);
    lines.push(` * @type {${typeName}}`);

    if (className) {
      lines.push(` * @memberof ${className}`);
    }

    // Required tag
    if (property.required) {
      lines.push(' * @required');
    }

    // Format tag
    if (property.format) {
      lines.push(` * @format ${property.format}`);
    }

    // Constraints
    if (property.constraints) {
      const c = property.constraints;
      if (c.minimum !== undefined) lines.push(` * @minimum ${c.minimum}`);
      if (c.maximum !== undefined) lines.push(` * @maximum ${c.maximum}`);
      if (c.minLength !== undefined) lines.push(` * @minLength ${c.minLength}`);
      if (c.maxLength !== undefined) lines.push(` * @maxLength ${c.maxLength}`);
      if (c.pattern) lines.push(` * @pattern ${this.escapeJSDoc(c.pattern)}`);
      if (c.minItems !== undefined) lines.push(` * @minItems ${c.minItems}`);
      if (c.maxItems !== undefined) lines.push(` * @maxItems ${c.maxItems}`);
      if (c.multipleOf !== undefined) lines.push(` * @multipleOf ${c.multipleOf}`);
    }

    // Example
    if (property.example !== undefined) {
      const exampleStr = typeof property.example === 'string'
        ? `"${this.escapeJSDoc(property.example)}"`
        : JSON.stringify(property.example);
      lines.push(` * @example ${exampleStr}`);
    }

    // Default value
    if (property.defaultValue !== undefined) {
      const defaultStr = typeof property.defaultValue === 'string'
        ? `"${this.escapeJSDoc(property.defaultValue)}"`
        : JSON.stringify(property.defaultValue);
      lines.push(` * @default ${defaultStr}`);
    }

    // Deprecated
    if (property.metadata.deprecated) {
      lines.push(' * @deprecated');
    }

    // ReadOnly/WriteOnly
    if (property.metadata.readOnly) {
      lines.push(' * @readonly');
    }
    if (property.metadata.writeOnly) {
      lines.push(' * @writeonly');
    }

    lines.push(' */');

    return lines.join('\n');
  }

  /**
   * Generate rich JSDoc for an API method
   */
  generateMethodDoc(operation: OperationDefinition): string {
    const lines: string[] = [];

    lines.push('/**');

    // Summary
    if (operation.summary) {
      lines.push(` * ${this.escapeJSDoc(operation.summary)}`);
    }

    // Description
    if (operation.description) {
      if (operation.summary) {
        lines.push(' *');
      }
      lines.push(` * ${this.escapeJSDoc(operation.description)}`);
    }

    lines.push(' *');

    // HTTP Method tag
    lines.push(` * @method ${operation.method}`);
    lines.push(` * @path ${operation.path}`);

    lines.push(' *');

    // Parameters
    for (const param of operation.parameters) {
      const requiredStr = param.required ? 'required' : 'optional';
      const typeStr = this.typeReferenceToString(param.type);
      const descStr = param.description ? ` - ${this.escapeJSDoc(param.description)}` : '';
      lines.push(` * @param {${typeStr}} ${param.name}${descStr} (${param.in}, ${requiredStr})`);
    }

    // Request body
    if (operation.requestBody) {
      const bodyType = this.getRequestBodyType(operation.requestBody);
      const requiredStr = operation.requestBody.required ? 'required' : 'optional';
      const descStr = operation.requestBody.description ? ` - ${this.escapeJSDoc(operation.requestBody.description)}` : '';
      lines.push(` * @param {${bodyType}} requestBody${descStr} (${requiredStr})`);
    }

    // Options param
    lines.push(' * @param {RawAxiosRequestConfig} [options] - Override http request options');

    lines.push(' *');

    // Throws
    lines.push(' * @throws {RequiredError} - When required parameters are missing');

    // Returns
    const returnType = this.getReturnType(operation);
    lines.push(` * @returns {Promise<AxiosResponse<${returnType}>>} - Axios response with data`);

    // Deprecated
    if (operation.deprecated) {
      lines.push(' *');
      lines.push(' * @deprecated');
    }

    // Tags
    if (operation.tags && operation.tags.length > 0) {
      lines.push(' *');
      operation.tags.forEach(tag => {
        lines.push(` * @tag ${tag}`);
      });
    }

    lines.push(' */');

    return lines.join('\n');
  }

  /**
   * Convert TypeReference to string representation
   */
  typeReferenceToString(type: TypeReference): string {
    switch (type.kind) {
      case 'primitive':
        return type.name || 'any';

      case 'array':
        if (type.elementType) {
          return `Array<${this.typeReferenceToString(type.elementType)}>`;
        }
        return 'Array<any>';

      case 'reference':
      case 'object':
        return type.name || 'object';

      case 'union':
        if (type.unionTypes && type.unionTypes.length > 0) {
          return type.unionTypes
            .map(t => this.typeReferenceToString(t))
            .join(' | ');
        }
        return 'any';

      case 'dictionary':
        if (type.additionalProperties) {
          const valueType = this.typeReferenceToString(type.additionalProperties);
          return `{ [key: string]: ${valueType} }`;
        }
        return '{ [key: string]: any }';

      case 'unknown':
      default:
        return 'any';
    }
  }

  /**
   * Get request body type string
   */
  private getRequestBodyType(requestBody: RequestBodyDefinition): string {
    if (requestBody.content.size === 0) {
      return 'any';
    }

    // Get first content type (typically application/json)
    const firstType = requestBody.content.values().next().value as TypeReference;
    return this.typeReferenceToString(firstType);
  }

  /**
   * Get return type string for operation
   */
  private getReturnType(operation: OperationDefinition): string {
    // Look for successful response (2xx)
    const successResponse = operation.responses.get('200') ||
                           operation.responses.get('201') ||
                           operation.responses.get('default');

    if (!successResponse || !successResponse.content || successResponse.content.size === 0) {
      return 'void';
    }

    // Get first content type (typically application/json)
    const firstType = successResponse.content.values().next().value as TypeReference;
    return this.typeReferenceToString(firstType);
  }

  /**
   * Escape JSDoc special characters
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
  private escapeJSDoc(text: string): string {
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
