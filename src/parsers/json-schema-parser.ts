/**
 * JSON Schema Parser
 *
 * Converts JSON Schema (Draft-04, Draft-07, Draft 2019-09, Draft 2020-12)
 * to our Intermediate Representation (IR)
 *
 * Critical features:
 * - Root schema naming (extract from $ref → CLI option → title → default)
 * - Circular reference protection (processedRefs Set)
 * - Support for both $defs (Draft 2019-09+) and definitions (Draft-04/07)
 * - allOf handling (merge as union)
 * - Draft-04 boolean exclusiveMinimum support
 * - const keyword support (as single-value enum)
 */

import {
  SchemaIR,
  SchemaDefinition,
  PropertyDefinition,
  TypeReference,
  IRHelpers,
  Constraints,
} from '../ir/types';
import { toPascalCase } from '../utils/name-utils';

/**
 * JSON Schema object (simplified, supports multiple drafts)
 */
export interface JsonSchemaObject {
  $schema?: string;
  $id?: string;
  title?: string;
  description?: string;
  type?: string | string[];
  format?: string;
  properties?: Record<string, JsonSchemaObject>;
  required?: string[];
  items?: JsonSchemaObject;
  additionalProperties?: boolean | JsonSchemaObject;
  enum?: any[];
  const?: any;
  allOf?: JsonSchemaObject[];
  oneOf?: JsonSchemaObject[];
  anyOf?: JsonSchemaObject[];
  $ref?: string;
  definitions?: Record<string, JsonSchemaObject>;  // Draft-04/07
  $defs?: Record<string, JsonSchemaObject>;        // Draft 2019-09+
  // Constraints
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: boolean | number;  // boolean in Draft-04, number in later drafts
  exclusiveMaximum?: boolean | number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  multipleOf?: number;
  default?: any;
  examples?: any[];
  // Vendor extensions
  [key: string]: any;
}

/**
 * Parser options
 */
export interface JsonSchemaParserOptions {
  /**
   * Extract $defs/definitions as separate schemas (default: true)
   */
  extractDefinitions?: boolean;

  /**
   * Root schema name (if not present in JSON Schema)
   * Priority: this option → $ref extraction → title field → 'Schema'
   */
  rootSchemaName?: string;

  /**
   * Naming pattern for nested schemas (not currently used)
   */
  nestedNaming?: 'flat' | 'hierarchical';
}

/**
 * JSON Schema to IR Parser
 */
export class JsonSchemaParser {
  private schema!: JsonSchemaObject;
  private ir!: SchemaIR;
  private options!: Required<JsonSchemaParserOptions>;
  private processedRefs = new Set<string>();  // CRITICAL: Prevent circular references

  /**
   * Parse JSON Schema to IR
   */
  parse(schema: JsonSchemaObject, options: JsonSchemaParserOptions = {}): SchemaIR {
    this.schema = schema;
    this.ir = IRHelpers.createSchemaIR();
    this.processedRefs.clear();

    // Set options with defaults
    this.options = {
      extractDefinitions: options.extractDefinitions !== false,
      rootSchemaName: options.rootSchemaName || '',
      nestedNaming: options.nestedNaming || 'flat',
    };

    // Determine root schema name (CRITICAL for kustomization.json pattern)
    const rootName = this.determineRootName();

    // Parse metadata
    this.parseMetadata(rootName);

    // Extract definitions/$ defs first (CRITICAL: support both)
    if (this.options.extractDefinitions) {
      this.extractDefinitions();
    }

    // Parse root schema if it has properties or type (not just a $ref)
    // If root is only a $ref, the definitions extraction will handle it
    if (schema.properties || schema.type) {
      const rootSchema = this.parseSchemaDefinition(rootName, schema);
      this.ir.schemas.set(rootName, rootSchema);
    }

    return this.ir;
  }

  /**
   * Determine root schema name
   * Priority: CLI option → extract from $ref → title → default
   *
   * This is CRITICAL for kustomization.json which has:
   * { "$ref": "#/definitions/Kustomization", "definitions": {...} }
   */
  private determineRootName(): string {
    // Priority 1: CLI option
    if (this.options.rootSchemaName) {
      return this.options.rootSchemaName;
    }

    // Priority 2: Extract from root $ref (e.g., "#/definitions/Kustomization")
    if (this.schema.$ref?.startsWith('#/')) {
      return this.resolveRef(this.schema.$ref);
    }

    // Priority 3: title field
    if (this.schema.title) {
      return toPascalCase(this.schema.title);
    }

    // Priority 4: Default
    return 'Schema';
  }

  /**
   * Parse metadata from JSON Schema
   */
  private parseMetadata(rootName: string): void {
    this.ir.metadata = {
      sourceFormat: 'jsonschema',
      title: rootName,
      description: this.schema.description,
      version: this.extractDraftVersion(),
    };
  }

  /**
   * Extract JSON Schema draft version from $schema URL
   */
  private extractDraftVersion(): string | undefined {
    if (!this.schema.$schema) return undefined;

    const schemaUrl = this.schema.$schema;
    if (schemaUrl.includes('draft-04')) return 'draft-04';
    if (schemaUrl.includes('draft-07')) return 'draft-07';
    if (schemaUrl.includes('2019-09')) return '2019-09';
    if (schemaUrl.includes('2020-12')) return '2020-12';

    return undefined;
  }

  /**
   * Extract definitions (CRITICAL: support both $defs and definitions)
   *
   * - Draft-04/07: uses "definitions"
   * - Draft 2019-09+: uses "$defs"
   */
  private extractDefinitions(): void {
    // Support both $defs (newer) and definitions (older)
    const defs = this.schema.$defs || this.schema.definitions || {};

    for (const [defName, defSchema] of Object.entries(defs)) {
      const schemaName = toPascalCase(defName);
      const schemaDef = this.parseSchemaDefinition(schemaName, defSchema);
      this.ir.schemas.set(schemaName, schemaDef);
    }
  }

  /**
   * Parse a single schema definition
   *
   * CRITICAL: Includes circular reference protection
   */
  private parseSchemaDefinition(name: string, schema: JsonSchemaObject): SchemaDefinition {
    // CRITICAL: Prevent circular references
    if (this.processedRefs.has(name)) {
      return this.ir.schemas.get(name)!;
    }
    this.processedRefs.add(name);

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
  private parseEnumSchema(name: string, schema: JsonSchemaObject): SchemaDefinition {
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
  private parseUnionSchema(name: string, schema: JsonSchemaObject): SchemaDefinition {
    const unionTypes = schema.oneOf || schema.anyOf || [];

    // Treat unions as objects with merged properties
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
  private parseObjectSchema(name: string, schema: JsonSchemaObject): SchemaDefinition {
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
    schema: JsonSchemaObject,
    required: boolean
  ): PropertyDefinition {
    return {
      name,
      originalName: name,
      type: this.parseType(schema),
      description: schema.description,
      required,
      nullable: false,  // JSON Schema doesn't have nullable like OpenAPI
      format: schema.format,
      constraints: this.parseConstraints(schema),
      defaultValue: schema.default,
      example: schema.examples?.[0],  // JSON Schema uses "examples" array
      metadata: {
        vendorExtensions: this.extractVendorExtensions(schema),
      },
    };
  }

  /**
   * Parse type reference from schema
   *
   * Handles:
   * - $ref (references)
   * - allOf (merge as union - proper merging is complex)
   * - oneOf/anyOf (unions)
   * - arrays
   * - dictionaries (additionalProperties)
   * - primitives
   */
  private parseType(schema: JsonSchemaObject): TypeReference {
    // Handle $ref
    if (schema.$ref) {
      return IRHelpers.createReferenceType(this.resolveRef(schema.$ref));
    }

    // Handle allOf (CRITICAL: merge as union for V1)
    // Proper schema merging is complex, treat as union for now
    if (schema.allOf && schema.allOf.length > 0) {
      const types = schema.allOf.map(s => this.parseType(s));
      return IRHelpers.createUnionType(types);
    }

    // Handle oneOf/anyOf as union
    if (schema.oneOf || schema.anyOf) {
      const types = (schema.oneOf || schema.anyOf || []).map(s => this.parseType(s));
      return IRHelpers.createUnionType(types);
    }

    // Handle array
    if (schema.type === 'array') {
      if (schema.items) {
        const elementType = this.parseType(schema.items);
        return IRHelpers.createArrayType(elementType);
      }
      // Array without items type
      return IRHelpers.createArrayType(IRHelpers.createUnknownType());
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
    if (schema.type) {
      const type = Array.isArray(schema.type) ? schema.type[0] : schema.type;

      switch (type) {
        case 'string':
          return IRHelpers.createPrimitiveType('string');
        case 'number':
        case 'integer':
          return IRHelpers.createPrimitiveType('number');
        case 'boolean':
          return IRHelpers.createPrimitiveType('boolean');
        case 'object':
          // Object without properties
          return IRHelpers.createUnknownType();
        case 'null':
          // Null type (treat as unknown for now)
          return IRHelpers.createUnknownType();
        default:
          return IRHelpers.createUnknownType();
      }
    }

    // No type specified
    return IRHelpers.createUnknownType();
  }

  /**
   * Parse validation constraints
   *
   * CRITICAL: Draft-04 uses boolean exclusiveMinimum, later drafts use number
   */
  private parseConstraints(schema: JsonSchemaObject): Constraints | undefined {
    const constraints: Constraints = {};
    let hasConstraints = false;

    // Numeric constraints
    if (schema.minimum !== undefined) {
      constraints.minimum = schema.minimum;
      hasConstraints = true;
    }
    if (schema.maximum !== undefined) {
      constraints.maximum = schema.maximum;
      hasConstraints = true;
    }

    // CRITICAL: Draft-04 uses boolean, later drafts use number
    if (schema.exclusiveMinimum === true) {
      // Draft-04: boolean flag
      constraints.exclusiveMinimum = true;
      hasConstraints = true;
    } else if (typeof schema.exclusiveMinimum === 'number') {
      // Later drafts: number value
      constraints.minimum = schema.exclusiveMinimum;
      constraints.exclusiveMinimum = true;
      hasConstraints = true;
    }

    if (schema.exclusiveMaximum === true) {
      constraints.exclusiveMaximum = true;
      hasConstraints = true;
    } else if (typeof schema.exclusiveMaximum === 'number') {
      constraints.maximum = schema.exclusiveMaximum;
      constraints.exclusiveMaximum = true;
      hasConstraints = true;
    }

    // String constraints
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

    // Array constraints
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

    // Numeric constraints
    if (schema.multipleOf !== undefined) {
      constraints.multipleOf = schema.multipleOf;
      hasConstraints = true;
    }

    // Enum constraints
    if (schema.enum) {
      constraints.enum = schema.enum;
      hasConstraints = true;
    }

    // CRITICAL: const keyword (single-value enum)
    if (schema.const !== undefined) {
      constraints.enum = [schema.const];
      hasConstraints = true;
    }

    return hasConstraints ? constraints : undefined;
  }

  /**
   * Resolve $ref to schema name
   *
   * Handles:
   * - #/definitions/Name (Draft-04/07)
   * - #/$defs/Name (Draft 2019-09+)
   * - # (root reference)
   *
   * External refs not supported in V1
   */
  private resolveRef(ref: string): string {
    // Root reference
    if (ref === '#') {
      return this.determineRootName();
    }

    // Internal reference (#/definitions/Foo or #/$defs/Bar)
    if (ref.startsWith('#/')) {
      const parts = ref.split('/');
      const refName = parts[parts.length - 1];
      return toPascalCase(refName);
    }

    // External references not supported
    throw new Error(`External $ref not supported: ${ref}`);
  }

  /**
   * Extract vendor extensions (x-* properties)
   */
  private extractVendorExtensions(schema: JsonSchemaObject): Record<string, any> {
    const extensions: Record<string, any> = {};

    for (const [key, value] of Object.entries(schema)) {
      if (key.startsWith('x-')) {
        extensions[key] = value;
      }
    }

    return Object.keys(extensions).length > 0 ? extensions : {};
  }
}
