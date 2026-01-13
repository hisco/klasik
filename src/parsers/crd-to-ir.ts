/**
 * CRD to IR Converter
 * - Converts Kubernetes CRD schemas to our IR format
 * - Extracts nested objects generically
 * - Handles status subresource
 * - No hardcoded assumptions about CRD structure
 */

import {
  SchemaIR,
  SchemaDefinition,
  PropertyDefinition,
  TypeReference,
  IRHelpers,
} from '../ir/types';
import { ParsedCRD, CRDParserOptions } from './crd-parser';
import { toPascalCase } from '../utils/name-utils';

export interface CRDToIROptions extends CRDParserOptions {
  /** Extract nested objects as separate schemas (default: true) */
  extractNested?: boolean;
  /** Naming pattern for nested schemas: "{parent}{property}" (default) */
  nestedNaming?: 'flat' | 'hierarchical';
}

/**
 * Converts CRD schemas to IR
 */
export class CRDToIRConverter {
  private ir: SchemaIR;
  private options: Required<CRDToIROptions>;
  private visitedSchemas: Set<string>;

  constructor(options: CRDToIROptions = {}) {
    this.ir = IRHelpers.createSchemaIR();
    this.options = {
      includeStatus: options.includeStatus !== false,
      strict: options.strict || false,
      extractNested: options.extractNested !== false,
      nestedNaming: options.nestedNaming || 'flat',
    };
    this.visitedSchemas = new Set();
  }

  /**
   * Convert parsed CRD(s) to IR
   * @param crds Parsed CRD(s)
   * @returns Schema IR
   */
  convert(crds: ParsedCRD | ParsedCRD[]): SchemaIR {
    const crdArray = Array.isArray(crds) ? crds : [crds];

    for (const crd of crdArray) {
      this.convertCRD(crd);
    }

    return this.ir;
  }

  /**
   * Convert a single CRD to IR
   * @param crd Parsed CRD
   */
  private convertCRD(crd: ParsedCRD): void {
    // Convert each version's schema
    for (const [versionName, schema] of crd.schemas) {
      // Main CR schema
      const mainSchemaName = this.getSchemaName(crd.metadata.kind, versionName);
      this.convertSchema(schema, mainSchemaName, crd, true); // true = top-level schema

      // If schema has ObjectMeta, create it
      if (schema.properties?.metadata) {
        this.createObjectMetaSchema();
      }
    }
  }

  /**
   * Get schema name for a CRD version
   * @param kind CRD kind
   * @param version Version name
   * @returns Schema name
   */
  private getSchemaName(kind: string, version: string): string {
    // For storage version or if only one version, use just the kind
    // For other versions, append version (e.g., "ApplicationV1Alpha1")
    return toPascalCase(kind);
  }

  /**
   * Convert OpenAPI v3 schema to IR schema
   * @param schema OpenAPI v3 schema
   * @param name Schema name
   * @param crd Parent CRD (for context)
   * @param isTopLevel Whether this is the top-level CRD schema (default: false)
   */
  private convertSchema(
    schema: any,
    name: string,
    crd: ParsedCRD,
    isTopLevel: boolean = false
  ): SchemaDefinition {
    // Skip if already processed
    if (this.visitedSchemas.has(name)) {
      return this.ir.schemas.get(name)!;
    }
    this.visitedSchemas.add(name);

    // Create schema definition
    const schemaDef = IRHelpers.createSchema(name);
    schemaDef.description = schema.description;

    // Store original Kind for file naming (only for top-level schemas)
    if (isTopLevel) {
      schemaDef.metadata.kind = crd.metadata.kind;
    }

    // Extract properties
    if (schema.properties && typeof schema.properties === 'object') {
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        const property = this.convertProperty(
          propName,
          propSchema as any,
          name,
          crd
        );
        schemaDef.properties.set(propName, property);
      }
    }

    // Extract required fields
    if (Array.isArray(schema.required)) {
      for (const requiredField of schema.required) {
        schemaDef.required.add(requiredField);
        // Also mark the property itself as required
        const prop = schemaDef.properties.get(requiredField);
        if (prop) {
          prop.required = true;
        }
      }
    }

    // Handle status subresource
    if (
      this.options.includeStatus &&
      crd.hasStatus &&
      schema.properties?.status
    ) {
      // Status is already included in properties above
      // Mark it as optional if not in required list
      if (!schemaDef.required.has('status')) {
        const statusProp = schemaDef.properties.get('status');
        if (statusProp) {
          statusProp.required = false;
        }
      }
    }

    // Store in IR
    this.ir.schemas.set(name, schemaDef);

    // Extract nested objects if enabled
    if (this.options.extractNested) {
      this.extractNestedSchemas(schema, name, crd);
    }

    return schemaDef;
  }

  /**
   * Convert a property definition
   * @param name Property name
   * @param propSchema OpenAPI property schema
   * @param parentName Parent schema name
   * @param crd Parent CRD
   * @returns Property definition
   */
  private convertProperty(
    name: string,
    propSchema: any,
    parentName: string,
    crd: ParsedCRD
  ): PropertyDefinition {
    const property = IRHelpers.createProperty(name, this.convertType(propSchema));
    property.description = propSchema.description;
    property.format = propSchema.format;
    property.example = propSchema.example;

    // Extract constraints (constraints is initialized by createProperty)
    if (propSchema.minimum !== undefined) {
      property.constraints!.minimum = propSchema.minimum;
    }
    if (propSchema.maximum !== undefined) {
      property.constraints!.maximum = propSchema.maximum;
    }
    if (propSchema.minLength !== undefined) {
      property.constraints!.minLength = propSchema.minLength;
    }
    if (propSchema.maxLength !== undefined) {
      property.constraints!.maxLength = propSchema.maxLength;
    }
    if (propSchema.pattern !== undefined) {
      property.constraints!.pattern = propSchema.pattern;
    }
    if (propSchema.minItems !== undefined) {
      property.constraints!.minItems = propSchema.minItems;
    }
    if (propSchema.maxItems !== undefined) {
      property.constraints!.maxItems = propSchema.maxItems;
    }
    if (propSchema.uniqueItems !== undefined) {
      property.constraints!.uniqueItems = propSchema.uniqueItems;
    }

    // Extract enum values (store in constraints for compatibility with plugins)
    if (Array.isArray(propSchema.enum) && propSchema.enum.length > 0) {
      property.constraints!.enum = propSchema.enum;
    }

    // Extract vendor extensions (x-*)
    property.metadata.vendorExtensions = this.extractVendorExtensions(propSchema);

    return property;
  }

  /**
   * Convert OpenAPI type to IR TypeReference
   * @param schema OpenAPI schema
   * @returns TypeReference
   */
  private convertType(schema: any): TypeReference {
    // Handle $ref
    if (schema.$ref) {
      const refName = this.resolveRef(schema.$ref);
      return IRHelpers.createTypeReference('reference', refName);
    }

    // Handle array
    if (schema.type === 'array') {
      const elementType = schema.items
        ? this.convertType(schema.items)
        : IRHelpers.createTypeReference('unknown');
      return IRHelpers.createTypeReference('array', undefined, elementType);
    }

    // Handle object with properties
    if (schema.type === 'object' && schema.properties) {
      // This will be extracted as a nested schema if extractNested is true
      // For now, return object type
      return IRHelpers.createTypeReference('object');
    }

    // Handle object with additionalProperties (dictionary/map)
    if (schema.type === 'object' && schema.additionalProperties) {
      const valueType =
        typeof schema.additionalProperties === 'object'
          ? this.convertType(schema.additionalProperties)
          : IRHelpers.createTypeReference('unknown');
      return IRHelpers.createTypeReference('dictionary', undefined, undefined, valueType);
    }

    // Handle oneOf/anyOf (union)
    if (schema.oneOf || schema.anyOf) {
      const schemas = schema.oneOf || schema.anyOf;
      const unionTypes = schemas.map((s: any) => this.convertType(s));
      return IRHelpers.createTypeReference('union', undefined, undefined, undefined, unionTypes);
    }

    // Handle primitive types
    if (schema.type) {
      switch (schema.type) {
        case 'string':
          return IRHelpers.createTypeReference('primitive', 'string');
        case 'number':
        case 'integer':
          return IRHelpers.createTypeReference('primitive', 'number');
        case 'boolean':
          return IRHelpers.createTypeReference('primitive', 'boolean');
        case 'object':
          return IRHelpers.createTypeReference('object');
        default:
          return IRHelpers.createTypeReference('unknown');
      }
    }

    // No type specified
    return IRHelpers.createTypeReference('unknown');
  }

  /**
   * Resolve a $ref to a schema name
   * @param ref $ref string (e.g., "#/definitions/io.k8s.apimachinery.pkg.apis.meta.v1.ObjectMeta")
   * @returns Schema name
   */
  private resolveRef(ref: string): string {
    // Extract last part of ref
    const parts = ref.split('/');
    const lastPart = parts[parts.length - 1];

    // Convert to PascalCase
    return toPascalCase(lastPart);
  }

  /**
   * Extract nested object schemas
   * @param schema Parent schema
   * @param baseName Base name for nested schemas
   * @param crd Parent CRD
   */
  private extractNestedSchemas(schema: any, baseName: string, crd: ParsedCRD): void {
    if (!schema.properties || typeof schema.properties !== 'object') {
      return;
    }

    for (const [propName, propSchema] of Object.entries(schema.properties)) {
      const prop = propSchema as any;

      // Check if this is an object with properties (nested schema)
      if (prop.type === 'object' && prop.properties) {
        const nestedName = this.getNestedSchemaName(baseName, propName);

        // Convert nested schema
        this.convertSchema(prop, nestedName, crd);

        // Update parent property to reference nested schema
        const parentSchema = this.ir.schemas.get(baseName);
        if (parentSchema) {
          const parentProp = parentSchema.properties.get(propName);
          if (parentProp) {
            parentProp.type = IRHelpers.createTypeReference('reference', nestedName);
          }
        }
      }

      // Check if this is an array of objects
      if (
        prop.type === 'array' &&
        prop.items?.type === 'object' &&
        prop.items?.properties
      ) {
        const nestedName = this.getNestedSchemaName(baseName, propName);

        // Convert nested schema
        this.convertSchema(prop.items, nestedName, crd);

        // Update parent property to reference nested schema
        const parentSchema = this.ir.schemas.get(baseName);
        if (parentSchema) {
          const parentProp = parentSchema.properties.get(propName);
          if (parentProp) {
            parentProp.type = IRHelpers.createTypeReference(
              'array',
              undefined,
              IRHelpers.createTypeReference('reference', nestedName)
            );
          }
        }
      }

      // Recurse into nested objects
      if (prop.type === 'object' && prop.properties) {
        const nestedName = this.getNestedSchemaName(baseName, propName);
        this.extractNestedSchemas(prop, nestedName, crd);
      }
    }
  }

  /**
   * Get name for nested schema
   * @param parentName Parent schema name
   * @param propName Property name
   * @returns Nested schema name
   */
  private getNestedSchemaName(parentName: string, propName: string): string {
    // Remove common suffixes from parent name
    const cleanParent = parentName.replace(/(Spec|Status|Config|Settings)$/, '');

    // Capitalize property name (handle camelCase properly)
    // If already PascalCase/camelCase, just capitalize first letter
    const capitalizedProp = propName.charAt(0).toUpperCase() + propName.slice(1);

    // Combine
    return `${cleanParent}${capitalizedProp}`;
  }

  /**
   * Extract vendor extensions (x-* properties)
   * @param schema Schema object
   * @returns Vendor extensions
   */
  private extractVendorExtensions(schema: any): Record<string, any> {
    const extensions: Record<string, any> = {};

    for (const [key, value] of Object.entries(schema)) {
      if (key.startsWith('x-')) {
        extensions[key] = value;
      }
    }

    return extensions;
  }

  /**
   * Create ObjectMeta schema
   * Kubernetes ObjectMeta is a common type used in metadata
   */
  private createObjectMetaSchema(): void {
    const name = 'ObjectMeta';

    // Skip if already created
    if (this.ir.schemas.has(name)) {
      return;
    }

    const schema = IRHelpers.createSchema(name);
    schema.description = 'Kubernetes object metadata';

    // Common ObjectMeta fields
    const fields: Array<[string, string, string]> = [
      ['name', 'string', 'Name of the resource'],
      ['namespace', 'string', 'Namespace of the resource'],
      ['uid', 'string', 'UID of the resource'],
      ['resourceVersion', 'string', 'Resource version'],
      ['generation', 'number', 'Generation number'],
      ['creationTimestamp', 'string', 'Creation timestamp'],
      ['deletionTimestamp', 'string', 'Deletion timestamp'],
      ['labels', 'object', 'Labels'],
      ['annotations', 'object', 'Annotations'],
    ];

    for (const [propName, type, description] of fields) {
      const typeRef =
        type === 'object'
          ? IRHelpers.createTypeReference('dictionary', undefined, undefined, IRHelpers.createTypeReference('primitive', 'string'))
          : IRHelpers.createTypeReference('primitive', type as any);

      const prop = IRHelpers.createProperty(propName, typeRef);
      prop.description = description;
      prop.required = false;

      schema.properties.set(propName, prop);
    }

    this.ir.schemas.set(name, schema);
  }
}
