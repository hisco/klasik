/**
 * IR Filter
 *
 * Filters SchemaIR to include only specified schemas and their transitive dependencies.
 */

import { SchemaIR, SchemaDefinition, TypeReference, IRHelpers } from './types';

export interface FilterOptions {
  /** Schema names to include (will also include all their dependencies) */
  include: string[];
  /** Whether to warn about missing schemas (default: true) */
  warnOnMissing?: boolean;
}

export interface FilterResult {
  /** Filtered IR */
  ir: SchemaIR;
  /** Schemas that were included */
  includedSchemas: Set<string>;
  /** Schemas that were specified but not found */
  missingSchemas: string[];
  /** Statistics */
  stats: {
    originalCount: number;
    filteredCount: number;
    dependenciesAdded: number;
  };
}

/**
 * Filter a SchemaIR to include only specified schemas and their dependencies
 */
export class IRFilter {
  /**
   * Filter IR to include only specified schemas and their transitive dependencies
   */
  filter(ir: SchemaIR, options: FilterOptions): FilterResult {
    const { include } = options;

    // Track included schemas and missing ones
    const includedSchemas = new Set<string>();
    const missingSchemas: string[] = [];

    // First, validate that all specified schemas exist
    for (const schemaName of include) {
      if (ir.schemas.has(schemaName)) {
        includedSchemas.add(schemaName);
      } else {
        missingSchemas.push(schemaName);
      }
    }

    // Collect all transitive dependencies
    const visited = new Set<string>();
    for (const schemaName of includedSchemas) {
      this.collectDependencies(ir, schemaName, visited);
    }

    // Add all dependencies to included set
    for (const dep of visited) {
      includedSchemas.add(dep);
    }

    // Create filtered IR
    const filteredIR = this.createFilteredIR(ir, includedSchemas);

    // Calculate how many dependencies were added (total - originally specified that exist)
    const specifiedAndFound = include.filter((s) => ir.schemas.has(s)).length;

    return {
      ir: filteredIR,
      includedSchemas,
      missingSchemas,
      stats: {
        originalCount: ir.schemas.size,
        filteredCount: filteredIR.schemas.size,
        dependenciesAdded: visited.size - specifiedAndFound,
      },
    };
  }

  /**
   * Recursively collect all dependencies of a schema
   */
  private collectDependencies(ir: SchemaIR, schemaName: string, visited: Set<string>): void {
    // Prevent infinite loops (circular references)
    if (visited.has(schemaName)) {
      return;
    }
    visited.add(schemaName);

    const schema = ir.schemas.get(schemaName);
    if (!schema) {
      return;
    }

    // Collect dependencies from all properties
    for (const [_, property] of schema.properties) {
      this.collectTypeReferences(ir, property.type, visited);
    }
  }

  /**
   * Recursively collect schema references from a TypeReference
   */
  private collectTypeReferences(ir: SchemaIR, type: TypeReference, visited: Set<string>): void {
    switch (type.kind) {
      case 'reference':
      case 'object':
        if (type.name && ir.schemas.has(type.name)) {
          this.collectDependencies(ir, type.name, visited);
        }
        break;

      case 'array':
        if (type.elementType) {
          this.collectTypeReferences(ir, type.elementType, visited);
        }
        break;

      case 'union':
        if (type.unionTypes) {
          for (const unionType of type.unionTypes) {
            this.collectTypeReferences(ir, unionType, visited);
          }
        }
        break;

      case 'dictionary':
        if (type.additionalProperties) {
          this.collectTypeReferences(ir, type.additionalProperties, visited);
        }
        break;
    }
  }

  /**
   * Create a new IR containing only the specified schemas
   */
  private createFilteredIR(ir: SchemaIR, includedSchemas: Set<string>): SchemaIR {
    const filtered: SchemaIR = {
      schemas: new Map(),
      operations: new Map(),
      metadata: { ...ir.metadata },
    };

    for (const schemaName of includedSchemas) {
      const schema = ir.schemas.get(schemaName);
      if (schema) {
        filtered.schemas.set(schemaName, schema);
      }
    }

    return filtered;
  }
}

/**
 * Convenience function to filter an IR
 */
export function filterIR(ir: SchemaIR, include: string[]): FilterResult {
  const filter = new IRFilter();
  return filter.filter(ir, { include });
}
