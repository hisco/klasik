/**
 * IR Merger
 *
 * Merges multiple SchemaIR instances into a single unified IR.
 * Handles name conflicts, merges schemas, operations, and metadata.
 */

import { SchemaIR, SchemaDefinition, OperationDefinition, GlobalMetadata } from '../ir/types';
import { makeUnique } from './name-utils';

/**
 * Options for merging IRs
 */
export interface MergeOptions {
  /**
   * How to handle name conflicts
   * - 'rename': Rename conflicting schemas using makeUnique (default)
   * - 'skip': Skip duplicate schemas
   * - 'overwrite': Overwrite with newer definition
   */
  conflictResolution?: 'rename' | 'skip' | 'overwrite';

  /**
   * Prefix to add to schemas from each IR
   * Maps from IR index to prefix string
   */
  prefixes?: string[];
}

/**
 * Result of merging multiple IRs
 */
export interface MergeResult {
  /** Merged IR */
  ir: SchemaIR;

  /** Map of original schema names to renamed names */
  renamedSchemas: Map<string, string>;

  /** Statistics about the merge */
  stats: {
    totalSchemas: number;
    totalOperations: number;
    conflicts: number;
    skipped: number;
  };
}

/**
 * Merge multiple SchemaIRs into a single IR
 */
export class IRMerger {
  /**
   * Merge multiple IRs into one
   *
   * @param irs Array of SchemaIRs to merge
   * @param options Merge options
   * @returns Merge result with merged IR and statistics
   */
  merge(irs: SchemaIR[], options: MergeOptions = {}): MergeResult {
    const {
      conflictResolution = 'rename',
      prefixes = [],
    } = options;

    // Initialize result
    const mergedIR: SchemaIR = {
      schemas: new Map(),
      operations: new Map(),
      metadata: this.mergeMetadata(irs),
    };

    const renamedSchemas = new Map<string, string>();
    const stats = {
      totalSchemas: 0,
      totalOperations: 0,
      conflicts: 0,
      skipped: 0,
    };

    // Track existing names for conflict detection
    const existingNames = new Set<string>();

    // Merge schemas from each IR
    for (let i = 0; i < irs.length; i++) {
      const ir = irs[i];
      const prefix = prefixes[i] || '';

      for (const [originalName, schema] of ir.schemas) {
        const prefixedName = prefix ? `${prefix}${schema.name}` : schema.name;
        let finalName = prefixedName;

        // Handle name conflict
        if (existingNames.has(prefixedName)) {
          stats.conflicts++;

          switch (conflictResolution) {
            case 'rename':
              finalName = makeUnique(prefixedName, existingNames);
              renamedSchemas.set(originalName, finalName);
              break;

            case 'skip':
              stats.skipped++;
              continue;

            case 'overwrite':
              // Overwrite existing schema
              break;
          }
        }

        // Clone schema with new name
        const mergedSchema: SchemaDefinition = {
          ...schema,
          name: finalName,
          originalName: schema.originalName,
        };

        // Update type references if schema was renamed
        if (finalName !== schema.name) {
          this.updateTypeReferences(mergedSchema, schema.name, finalName);
        }

        mergedIR.schemas.set(finalName, mergedSchema);
        existingNames.add(finalName);
        stats.totalSchemas++;
      }

      // Merge operations
      for (const [opId, operation] of ir.operations) {
        const prefixedOpId = prefix ? `${prefix}_${opId}` : opId;
        let finalOpId = prefixedOpId;

        // Handle operation ID conflicts
        if (mergedIR.operations.has(prefixedOpId)) {
          stats.conflicts++;

          switch (conflictResolution) {
            case 'rename':
              finalOpId = makeUnique(prefixedOpId, new Set(mergedIR.operations.keys()));
              break;

            case 'skip':
              stats.skipped++;
              continue;

            case 'overwrite':
              // Overwrite existing operation
              break;
          }
        }

        // Clone operation with updated references
        const mergedOperation: OperationDefinition = {
          ...operation,
          operationId: finalOpId,
        };

        mergedIR.operations.set(finalOpId, mergedOperation);
        stats.totalOperations++;
      }
    }

    return {
      ir: mergedIR,
      renamedSchemas,
      stats,
    };
  }

  /**
   * Merge metadata from multiple IRs
   * Combines titles, descriptions, servers, etc.
   */
  private mergeMetadata(irs: SchemaIR[]): GlobalMetadata {
    if (irs.length === 0) {
      return {
        sourceFormat: 'openapi',
      };
    }

    // Use first IR as base
    const base = irs[0].metadata;

    // Merge titles
    const titles = irs
      .map(ir => ir.metadata.title)
      .filter(Boolean);

    // Merge descriptions
    const descriptions = irs
      .map(ir => ir.metadata.description)
      .filter(Boolean);

    // Merge servers
    const allServers = new Set<string>();
    for (const ir of irs) {
      if (ir.metadata.servers) {
        ir.metadata.servers.forEach(s => allServers.add(s));
      }
    }

    // Merge vendor extensions
    const vendorExtensions: Record<string, any> = {};
    for (const ir of irs) {
      if (ir.metadata.vendorExtensions) {
        Object.assign(vendorExtensions, ir.metadata.vendorExtensions);
      }
    }

    return {
      title: titles.length > 0 ? titles.join(' + ') : base.title,
      version: base.version,
      description: descriptions.length > 0 ? descriptions.join('\n\n') : base.description,
      servers: Array.from(allServers),
      sourceFormat: base.sourceFormat,
      vendorExtensions: Object.keys(vendorExtensions).length > 0 ? vendorExtensions : undefined,
    };
  }

  /**
   * Update type references in a schema when it's renamed
   * This handles circular references and nested types
   */
  private updateTypeReferences(schema: SchemaDefinition, oldName: string, newName: string): void {
    for (const [_, property] of schema.properties) {
      this.updateTypeReference(property.type, oldName, newName);
    }
  }

  /**
   * Recursively update type references
   */
  private updateTypeReference(type: any, oldName: string, newName: string): void {
    if (!type) return;

    switch (type.kind) {
      case 'reference':
      case 'object':
        if (type.name === oldName) {
          type.name = newName;
        }
        break;

      case 'array':
        if (type.elementType) {
          this.updateTypeReference(type.elementType, oldName, newName);
        }
        break;

      case 'union':
        if (type.unionTypes) {
          type.unionTypes.forEach((t: any) => this.updateTypeReference(t, oldName, newName));
        }
        break;

      case 'dictionary':
        if (type.additionalProperties) {
          this.updateTypeReference(type.additionalProperties, oldName, newName);
        }
        break;
    }
  }
}

/**
 * Convenience function to merge two IRs
 */
export function mergeTwoIRs(ir1: SchemaIR, ir2: SchemaIR, options?: MergeOptions): MergeResult {
  const merger = new IRMerger();
  return merger.merge([ir1, ir2], options);
}

/**
 * Convenience function to merge multiple IRs
 */
export function mergeMultipleIRs(irs: SchemaIR[], options?: MergeOptions): MergeResult {
  const merger = new IRMerger();
  return merger.merge(irs, options);
}
