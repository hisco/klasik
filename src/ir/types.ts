/**
 * Intermediate Representation (IR) types
 *
 * These types represent a unified schema model that all input formats
 * (OpenAPI, CRD, JSON Schema) are converted into before code generation.
 */

/**
 * Root IR structure containing all schemas and operations
 */
export interface SchemaIR {
  /** All schema definitions (models/classes) */
  schemas: Map<string, SchemaDefinition>;

  /** API operations (only for full mode) */
  operations: Map<string, OperationDefinition>;

  /** Global metadata */
  metadata: GlobalMetadata;
}

/**
 * Global metadata about the API/schema
 */
export interface GlobalMetadata {
  /** API title */
  title?: string;

  /** API version */
  version?: string;

  /** API description */
  description?: string;

  /** Base URL/server info */
  servers?: string[];

  /** Original source format */
  sourceFormat: 'openapi' | 'crd' | 'jsonschema';

  /** Additional vendor extensions */
  vendorExtensions?: Record<string, any>;
}

/**
 * A schema definition (class/interface)
 */
export interface SchemaDefinition {
  /** Schema name (e.g., "User", "AppProject") */
  name: string;

  /** Original name from source */
  originalName: string;

  /** Schema description */
  description?: string;

  /** All properties */
  properties: Map<string, PropertyDefinition>;

  /** Required property names */
  required: Set<string>;

  /** Schema type */
  type: SchemaType;

  /** For enum types, the possible values */
  enumValues?: Array<string | number>;

  /** Schema-level metadata */
  metadata: SchemaMetadata;
}

export type SchemaType = 'object' | 'enum' | 'union';

/**
 * Schema-level metadata
 */
export interface SchemaMetadata {
  /** Whether this is a top-level resource */
  isResource?: boolean;

  /** API version (for CRDs) */
  apiVersion?: string;

  /** Kind name (for CRDs) */
  kind?: string;

  /** Vendor extensions from OpenAPI */
  vendorExtensions?: Record<string, any>;

  /** Additional custom metadata */
  custom?: Record<string, any>;
}

/**
 * A property definition (field in a class)
 */
export interface PropertyDefinition {
  /** Property name in generated code (camelCase) */
  name: string;

  /** Original property name from source */
  originalName: string;

  /** Property type */
  type: TypeReference;

  /** Property description */
  description?: string;

  /** Is this property required? */
  required: boolean;

  /** Can this property be null? */
  nullable: boolean;

  /** Format hint (e.g., "email", "date-time", "uuid") */
  format?: string;

  /** Validation constraints */
  constraints?: Constraints;

  /** Default value */
  defaultValue?: any;

  /** Example value */
  example?: any;

  /** Property-level metadata */
  metadata: PropertyMetadata;
}

/**
 * Property-level metadata
 */
export interface PropertyMetadata {
  /** Whether this property is deprecated */
  deprecated?: boolean;

  /** Read-only (from OpenAPI) */
  readOnly?: boolean;

  /** Write-only (from OpenAPI) */
  writeOnly?: boolean;

  /** Vendor extensions */
  vendorExtensions?: Record<string, any>;

  /** Additional custom metadata */
  custom?: Record<string, any>;
}

/**
 * Type reference - represents any TypeScript type
 */
export interface TypeReference {
  /** Kind of type */
  kind: TypeKind;

  /** For primitive and reference types */
  name?: string;

  /** For array types */
  elementType?: TypeReference;

  /** For union types */
  unionTypes?: TypeReference[];

  /** For object/dictionary types with dynamic keys */
  additionalProperties?: TypeReference;
}

export type TypeKind =
  | 'primitive'     // string, number, boolean
  | 'array'         // Array<T>
  | 'object'        // named class reference
  | 'reference'     // reference to another schema
  | 'union'         // A | B
  | 'dictionary'    // { [key: string]: T }
  | 'unknown';      // any/unknown

/**
 * Validation constraints
 */
export interface Constraints {
  /** Minimum value (for numbers) */
  minimum?: number;

  /** Maximum value (for numbers) */
  maximum?: number;

  /** Exclusive minimum */
  exclusiveMinimum?: boolean;

  /** Exclusive maximum */
  exclusiveMaximum?: boolean;

  /** Minimum length (for strings/arrays) */
  minLength?: number;

  /** Maximum length (for strings/arrays) */
  maxLength?: number;

  /** Regex pattern (for strings) */
  pattern?: string;

  /** Enum values (for enums) */
  enum?: any[];

  /** Minimum number of items (for arrays) */
  minItems?: number;

  /** Maximum number of items (for arrays) */
  maxItems?: number;

  /** Unique items (for arrays) */
  uniqueItems?: boolean;

  /** Multiple of (for numbers) */
  multipleOf?: number;
}

/**
 * API operation definition (for full mode)
 */
export interface OperationDefinition {
  /** Unique operation ID */
  operationId: string;

  /** HTTP method */
  method: HttpMethod;

  /** URL path */
  path: string;

  /** Operation summary */
  summary?: string;

  /** Operation description */
  description?: string;

  /** Parameters */
  parameters: ParameterDefinition[];

  /** Request body */
  requestBody?: RequestBodyDefinition;

  /** Responses */
  responses: Map<string, ResponseDefinition>;

  /** Tags for grouping */
  tags?: string[];

  /** Whether operation is deprecated */
  deprecated?: boolean;

  /** Security requirements */
  security?: SecurityRequirement[];
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

/**
 * Parameter definition
 */
export interface ParameterDefinition {
  /** Parameter name */
  name: string;

  /** Parameter location */
  in: 'path' | 'query' | 'header' | 'cookie';

  /** Parameter description */
  description?: string;

  /** Is required? */
  required: boolean;

  /** Parameter type */
  type: TypeReference;

  /** Example value */
  example?: any;
}

/**
 * Request body definition
 */
export interface RequestBodyDefinition {
  /** Description */
  description?: string;

  /** Is required? */
  required: boolean;

  /** Content type to schema mapping */
  content: Map<string, TypeReference>;
}

/**
 * Response definition
 */
export interface ResponseDefinition {
  /** Status code */
  statusCode: string;

  /** Description */
  description?: string;

  /** Content type to schema mapping */
  content?: Map<string, TypeReference>;
}

/**
 * Security requirement
 */
export interface SecurityRequirement {
  /** Security scheme name */
  name: string;

  /** Required scopes */
  scopes: string[];
}

/**
 * Helper functions for creating IR types
 */
export namespace IRHelpers {
  export function createSchemaIR(): SchemaIR {
    return {
      schemas: new Map(),
      operations: new Map(),
      metadata: {
        sourceFormat: 'openapi',
      },
    };
  }

  export function createPrimitiveType(name: 'string' | 'number' | 'boolean'): TypeReference {
    return {
      kind: 'primitive',
      name,
    };
  }

  export function createArrayType(elementType: TypeReference): TypeReference {
    return {
      kind: 'array',
      elementType,
    };
  }

  export function createReferenceType(name: string): TypeReference {
    return {
      kind: 'reference',
      name,
    };
  }

  export function createUnionType(types: TypeReference[]): TypeReference {
    return {
      kind: 'union',
      unionTypes: types,
    };
  }

  export function createDictionaryType(valueType: TypeReference): TypeReference {
    return {
      kind: 'dictionary',
      additionalProperties: valueType,
    };
  }

  export function createUnknownType(): TypeReference {
    return {
      kind: 'unknown',
      name: 'unknown',
    };
  }

  export function createSchema(name: string): SchemaDefinition {
    return {
      name,
      originalName: name,
      properties: new Map(),
      required: new Set(),
      type: 'object',
      metadata: {},
    };
  }

  export function createProperty(name: string, type: TypeReference): PropertyDefinition {
    return {
      name,
      originalName: name,
      type,
      required: false,
      nullable: false,
      constraints: {},
      metadata: {},
    };
  }

  export function createTypeReference(
    kind: TypeReference['kind'],
    name?: string,
    elementType?: TypeReference,
    additionalProperties?: TypeReference,
    unionTypes?: TypeReference[]
  ): TypeReference {
    return {
      kind,
      name,
      elementType,
      additionalProperties,
      unionTypes,
    };
  }
}
