/**
 * OpenAPI 3.0 Parser
 *
 * Converts OpenAPI specifications to our Intermediate Representation (IR)
 */

import {
  SchemaIR,
  SchemaDefinition,
  PropertyDefinition,
  TypeReference,
  IRHelpers,
  Constraints,
  OperationDefinition,
  HttpMethod,
  ParameterDefinition,
  RequestBodyDefinition,
  ResponseDefinition,
} from '../ir/types';

/**
 * OpenAPI 3.0 schema object (simplified)
 */
export interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  servers?: Array<{ url: string }>;
  paths?: Record<string, PathItem>;
  components?: {
    schemas?: Record<string, SchemaObject>;
    securitySchemes?: Record<string, any>;
  };
}

export interface PathItem {
  get?: OperationObject;
  post?: OperationObject;
  put?: OperationObject;
  delete?: OperationObject;
  patch?: OperationObject;
  head?: OperationObject;
  options?: OperationObject;
}

export interface OperationObject {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: ParameterObject[];
  requestBody?: RequestBodyObject;
  responses: Record<string, ResponseObject>;
  deprecated?: boolean;
  security?: Array<Record<string, string[]>>;
}

export interface ParameterObject {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  description?: string;
  required?: boolean;
  schema?: SchemaObject;
  example?: any;
}

export interface RequestBodyObject {
  description?: string;
  required?: boolean;
  content: Record<string, { schema?: SchemaObject }>;
}

export interface ResponseObject {
  description?: string;
  content?: Record<string, { schema?: SchemaObject }>;
}

export interface SchemaObject {
  type?: string;
  format?: string;
  description?: string;
  properties?: Record<string, SchemaObject>;
  required?: string[];
  items?: SchemaObject;
  enum?: any[];
  allOf?: SchemaObject[];
  oneOf?: SchemaObject[];
  anyOf?: SchemaObject[];
  $ref?: string;
  additionalProperties?: boolean | SchemaObject;
  nullable?: boolean;
  readOnly?: boolean;
  writeOnly?: boolean;
  deprecated?: boolean;
  default?: any;
  example?: any;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: boolean;
  exclusiveMaximum?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  multipleOf?: number;
  // Vendor extensions (x-*)
  [key: string]: any;
}

/**
 * Parser options
 */
export interface OpenAPIParserOptions {
  /**
   * Whether to generate API operations (full mode) or just models
   */
  includeOperations?: boolean;

  /**
   * Custom name transformations
   */
  nameTransform?: (name: string) => string;
}

/**
 * OpenAPI to IR Parser
 */
export class OpenAPIParser {
  private spec!: OpenAPISpec;
  private ir!: SchemaIR;
  private processedRefs = new Set<string>();

  /**
   * Parse an OpenAPI spec into IR
   */
  parse(spec: OpenAPISpec, options: OpenAPIParserOptions = {}): SchemaIR {
    this.spec = spec;
    this.ir = IRHelpers.createSchemaIR();
    this.processedRefs.clear();

    // Parse metadata
    this.parseMetadata();

    // Parse schemas
    if (spec.components?.schemas) {
      this.parseSchemas(spec.components.schemas);
    }

    // Parse operations if requested
    if (options.includeOperations && spec.paths) {
      this.parseOperations(spec.paths);
    }

    return this.ir;
  }

  /**
   * Parse metadata from OpenAPI info
   */
  private parseMetadata(): void {
    this.ir.metadata = {
      sourceFormat: 'openapi',
      title: this.spec.info.title,
      version: this.spec.info.version,
      description: this.spec.info.description,
      servers: this.spec.servers?.map(s => s.url),
    };
  }

  /**
   * Parse all schema definitions
   */
  private parseSchemas(schemas: Record<string, SchemaObject>): void {
    for (const [name, schema] of Object.entries(schemas)) {
      const schemaDef = this.parseSchemaDefinition(name, schema);
      this.ir.schemas.set(name, schemaDef);
    }
  }

  /**
   * Parse a single schema definition
   */
  private parseSchemaDefinition(name: string, schema: SchemaObject): SchemaDefinition {
    // Handle enum schemas
    if (schema.enum) {
      return this.parseEnumSchema(name, schema);
    }

    // Handle union schemas (oneOf, anyOf)
    if (schema.oneOf || schema.anyOf) {
      return this.parseUnionSchema(name, schema);
    }

    // Handle object schemas
    return this.parseObjectSchema(name, schema);
  }

  /**
   * Parse enum schema
   */
  private parseEnumSchema(name: string, schema: SchemaObject): SchemaDefinition {
    return {
      name,
      originalName: name,
      description: schema.description,
      properties: new Map(),
      required: new Set(),
      type: 'enum',
      enumValues: schema.enum,
      metadata: {
        vendorExtensions: this.extractVendorExtensions(schema),
      },
    };
  }

  /**
   * Parse union schema (oneOf, anyOf)
   */
  private parseUnionSchema(name: string, schema: SchemaObject): SchemaDefinition {
    const unionTypes = schema.oneOf || schema.anyOf || [];

    // For now, treat unions as objects with merged properties
    // This is a simplification - in reality we might want to handle this differently
    const mergedProperties = new Map<string, PropertyDefinition>();

    for (const unionType of unionTypes) {
      if (unionType.properties) {
        for (const [propName, propSchema] of Object.entries(unionType.properties)) {
          if (!mergedProperties.has(propName)) {
            const propDef = this.parseProperty(propName, propSchema, false);
            mergedProperties.set(propName, propDef);
          }
        }
      }
    }

    return {
      name,
      originalName: name,
      description: schema.description,
      properties: mergedProperties,
      required: new Set(schema.required || []),
      type: 'union',
      metadata: {
        vendorExtensions: this.extractVendorExtensions(schema),
      },
    };
  }

  /**
   * Parse object schema
   */
  private parseObjectSchema(name: string, schema: SchemaObject): SchemaDefinition {
    const properties = new Map<string, PropertyDefinition>();
    const required = new Set(schema.required || []);

    // Parse properties
    if (schema.properties) {
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        const isRequired = required.has(propName);
        const propDef = this.parseProperty(propName, propSchema, isRequired);
        properties.set(propName, propDef);
      }
    }

    return {
      name,
      originalName: name,
      description: schema.description,
      properties,
      required,
      type: 'object',
      metadata: {
        vendorExtensions: this.extractVendorExtensions(schema),
      },
    };
  }

  /**
   * Parse a property
   */
  private parseProperty(
    name: string,
    schema: SchemaObject,
    required: boolean
  ): PropertyDefinition {
    return {
      name,
      originalName: name,
      type: this.parseType(schema),
      description: schema.description,
      required,
      nullable: schema.nullable || false,
      format: schema.format,
      constraints: this.parseConstraints(schema),
      defaultValue: schema.default,
      example: schema.example,
      metadata: {
        deprecated: schema.deprecated,
        readOnly: schema.readOnly,
        writeOnly: schema.writeOnly,
        vendorExtensions: this.extractVendorExtensions(schema),
      },
    };
  }

  /**
   * Parse type reference from schema
   */
  private parseType(schema: SchemaObject): TypeReference {
    // Handle $ref
    if (schema.$ref) {
      const refName = this.extractRefName(schema.$ref);
      return IRHelpers.createReferenceType(refName);
    }

    // Handle allOf (treat as reference to first type for now)
    if (schema.allOf && schema.allOf.length > 0) {
      return this.parseType(schema.allOf[0]);
    }

    // Handle oneOf/anyOf as union
    if (schema.oneOf || schema.anyOf) {
      const types = (schema.oneOf || schema.anyOf || []).map(s => this.parseType(s));
      return IRHelpers.createUnionType(types);
    }

    // Handle array
    if (schema.type === 'array' && schema.items) {
      const elementType = this.parseType(schema.items);
      return IRHelpers.createArrayType(elementType);
    }

    // Handle object with additionalProperties (dictionary)
    if (schema.type === 'object' && schema.additionalProperties) {
      if (typeof schema.additionalProperties === 'object') {
        const valueType = this.parseType(schema.additionalProperties);
        return IRHelpers.createDictionaryType(valueType);
      }
      // additionalProperties: true means any value
      return IRHelpers.createDictionaryType(IRHelpers.createUnknownType());
    }

    // Handle primitives
    if (schema.type === 'string') {
      return IRHelpers.createPrimitiveType('string');
    }
    if (schema.type === 'number' || schema.type === 'integer') {
      return IRHelpers.createPrimitiveType('number');
    }
    if (schema.type === 'boolean') {
      return IRHelpers.createPrimitiveType('boolean');
    }

    // Handle object without properties (generic object)
    if (schema.type === 'object') {
      return IRHelpers.createUnknownType();
    }

    // Fallback
    return IRHelpers.createUnknownType();
  }

  /**
   * Parse validation constraints
   */
  private parseConstraints(schema: SchemaObject): Constraints | undefined {
    const constraints: Constraints = {};
    let hasConstraints = false;

    if (schema.minimum !== undefined) {
      constraints.minimum = schema.minimum;
      hasConstraints = true;
    }
    if (schema.maximum !== undefined) {
      constraints.maximum = schema.maximum;
      hasConstraints = true;
    }
    if (schema.exclusiveMinimum !== undefined) {
      constraints.exclusiveMinimum = schema.exclusiveMinimum;
      hasConstraints = true;
    }
    if (schema.exclusiveMaximum !== undefined) {
      constraints.exclusiveMaximum = schema.exclusiveMaximum;
      hasConstraints = true;
    }
    if (schema.minLength !== undefined) {
      constraints.minLength = schema.minLength;
      hasConstraints = true;
    }
    if (schema.maxLength !== undefined) {
      constraints.maxLength = schema.maxLength;
      hasConstraints = true;
    }
    if (schema.pattern) {
      constraints.pattern = schema.pattern;
      hasConstraints = true;
    }
    if (schema.minItems !== undefined) {
      constraints.minItems = schema.minItems;
      hasConstraints = true;
    }
    if (schema.maxItems !== undefined) {
      constraints.maxItems = schema.maxItems;
      hasConstraints = true;
    }
    if (schema.uniqueItems !== undefined) {
      constraints.uniqueItems = schema.uniqueItems;
      hasConstraints = true;
    }
    if (schema.multipleOf !== undefined) {
      constraints.multipleOf = schema.multipleOf;
      hasConstraints = true;
    }
    if (schema.enum) {
      constraints.enum = schema.enum;
      hasConstraints = true;
    }

    return hasConstraints ? constraints : undefined;
  }

  /**
   * Parse operations from paths
   */
  private parseOperations(paths: Record<string, PathItem>): void {
    for (const [path, pathItem] of Object.entries(paths)) {
      const methods: Array<[HttpMethod, OperationObject]> = [
        ['GET', pathItem.get],
        ['POST', pathItem.post],
        ['PUT', pathItem.put],
        ['DELETE', pathItem.delete],
        ['PATCH', pathItem.patch],
        ['HEAD', pathItem.head],
        ['OPTIONS', pathItem.options],
      ].filter(([_, op]) => op !== undefined) as Array<[HttpMethod, OperationObject]>;

      for (const [method, operation] of methods) {
        const operationDef = this.parseOperation(method, path, operation);
        const operationId = operationDef.operationId;
        this.ir.operations.set(operationId, operationDef);
      }
    }
  }

  /**
   * Parse a single operation
   */
  private parseOperation(
    method: HttpMethod,
    path: string,
    operation: OperationObject
  ): OperationDefinition {
    const operationId = operation.operationId || `${method.toLowerCase()}${path.replace(/[^a-zA-Z0-9]/g, '')}`;

    return {
      operationId,
      method,
      path,
      summary: operation.summary,
      description: operation.description,
      parameters: (operation.parameters || []).map(p => this.parseParameter(p)),
      requestBody: operation.requestBody ? this.parseRequestBody(operation.requestBody) : undefined,
      responses: new Map(
        Object.entries(operation.responses).map(([code, resp]) => [
          code,
          this.parseResponse(code, resp),
        ])
      ),
      tags: operation.tags,
      deprecated: operation.deprecated,
      security: operation.security?.map(sec =>
        Object.entries(sec).map(([name, scopes]) => ({ name, scopes }))
      ).flat(),
    };
  }

  /**
   * Parse parameter
   */
  private parseParameter(param: ParameterObject): ParameterDefinition {
    return {
      name: param.name,
      in: param.in,
      description: param.description,
      required: param.required || param.in === 'path',
      type: param.schema ? this.parseType(param.schema) : IRHelpers.createUnknownType(),
      example: param.example,
    };
  }

  /**
   * Parse request body
   */
  private parseRequestBody(body: RequestBodyObject): RequestBodyDefinition {
    const content = new Map<string, TypeReference>();

    if (body.content) {
      for (const [contentType, mediaType] of Object.entries(body.content)) {
        if (mediaType.schema) {
          content.set(contentType, this.parseType(mediaType.schema));
        }
      }
    }

    return {
      description: body.description,
      required: body.required || false,
      content,
    };
  }

  /**
   * Parse response
   */
  private parseResponse(statusCode: string, response: ResponseObject): ResponseDefinition {
    const content = new Map<string, TypeReference>();

    if (response.content) {
      for (const [contentType, mediaType] of Object.entries(response.content)) {
        if (mediaType.schema) {
          content.set(contentType, this.parseType(mediaType.schema));
        }
      }
    }

    return {
      statusCode,
      description: response.description,
      content: content.size > 0 ? content : undefined,
    };
  }

  /**
   * Extract reference name from $ref
   */
  private extractRefName(ref: string): string {
    // Handle #/components/schemas/Name format
    const parts = ref.split('/');
    return parts[parts.length - 1];
  }

  /**
   * Extract vendor extensions (x-* properties)
   */
  private extractVendorExtensions(schema: SchemaObject): Record<string, any> {
    const extensions: Record<string, any> = {};

    for (const [key, value] of Object.entries(schema)) {
      if (key.startsWith('x-')) {
        extensions[key] = value;
      }
    }

    return Object.keys(extensions).length > 0 ? extensions : {};
  }
}
