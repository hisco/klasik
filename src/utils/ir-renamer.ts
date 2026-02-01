/**
 * IR Renamer
 *
 * Applies schema renames to an IR, updating all references.
 * Supports partial matching for flexible renaming of auto-generated names.
 *
 * Note: This function does NOT mutate the input IR. It creates a deep clone
 * of all modified structures.
 */

import {
  SchemaIR,
  SchemaDefinition,
  TypeReference,
  OperationDefinition,
  ParameterDefinition,
  ResponseDefinition,
} from '../ir/types';
import { toPascalCase } from './name-utils';

/**
 * Error thrown when rename mappings cause name collisions
 */
export class RenameCollisionError extends Error {
  constructor(
    public readonly collisions: Array<{ originalNames: string[]; targetName: string }>
  ) {
    const details = collisions
      .map(c => `  - "${c.originalNames.join('", "')}" all rename to "${c.targetName}"`)
      .join('\n');
    super(`Rename collision detected: multiple schemas would be renamed to the same name:\n${details}`);
    this.name = 'RenameCollisionError';
  }
}

/**
 * Rename mapping configuration
 */
export interface RenameMapping {
  /** Pattern to match (substring match in schema names) */
  pattern: string;
  /** Replacement string */
  replacement: string;
}

/**
 * Options for renaming
 */
export interface RenameOptions {
  /** Rename mappings to apply */
  mappings: RenameMapping[];
  /** Case-sensitive matching (default: false) */
  caseSensitive?: boolean;
}

/**
 * Result of renaming operation
 */
export interface RenameResult {
  /** The modified IR */
  ir: SchemaIR;
  /** Map of old names to new names */
  renamedSchemas: Map<string, string>;
  /** Statistics */
  stats: {
    schemasRenamed: number;
    referencesUpdated: number;
  };
}

/**
 * Rename schemas in an IR based on pattern matching
 */
export class IRRenamer {
  /**
   * Apply rename mappings to an IR.
   * This method does NOT mutate the input IR - it returns a new IR with renamed schemas.
   *
   * @throws {RenameCollisionError} When multiple schemas would be renamed to the same name
   */
  rename(ir: SchemaIR, options: RenameOptions): RenameResult {
    const { mappings, caseSensitive = false } = options;

    const renamedSchemas = new Map<string, string>();
    let referencesUpdated = 0;

    // Phase 1: Determine all renames first (before building schema map)
    const renameMap = new Map<string, string>(); // originalName -> newName
    for (const [originalName] of ir.schemas) {
      const newName = this.applyMappings(originalName, mappings, caseSensitive);
      renameMap.set(originalName, newName);
      if (newName !== originalName) {
        renamedSchemas.set(originalName, newName);
      }
    }

    // Phase 1.5: Detect collisions - check if multiple schemas map to same name
    this.detectCollisions(renameMap);

    // Phase 2: Build new schema map with cloned schemas
    const newSchemaMap = new Map<string, SchemaDefinition>();
    for (const [originalName, schema] of ir.schemas) {
      const newName = renameMap.get(originalName)!;

      // Deep clone schema with new name
      const renamedSchema: SchemaDefinition = {
        ...schema,
        name: newName,
        properties: new Map(schema.properties),
        required: new Set(schema.required),
      };

      newSchemaMap.set(newName, renamedSchema);
    }

    // Phase 3: Update all type references in schemas
    for (const schema of newSchemaMap.values()) {
      referencesUpdated += this.updateSchemaReferences(schema, renamedSchemas);
    }

    // Phase 4: Clone and update operation references (don't mutate original IR)
    const newOperationsMap = this.cloneAndUpdateOperations(ir.operations, renamedSchemas);
    referencesUpdated += newOperationsMap.referencesUpdated;

    // Build result IR
    const resultIR: SchemaIR = {
      schemas: newSchemaMap,
      operations: newOperationsMap.operations,
      metadata: { ...ir.metadata },
    };

    return {
      ir: resultIR,
      renamedSchemas,
      stats: {
        schemasRenamed: renamedSchemas.size,
        referencesUpdated,
      },
    };
  }

  /**
   * Detect if multiple schemas would be renamed to the same name
   * @throws {RenameCollisionError} if collisions are detected
   */
  private detectCollisions(renameMap: Map<string, string>): void {
    // Group original names by their target name
    const targetToOriginals = new Map<string, string[]>();
    for (const [originalName, newName] of renameMap) {
      const originals = targetToOriginals.get(newName) || [];
      originals.push(originalName);
      targetToOriginals.set(newName, originals);
    }

    // Find collisions (target names with multiple originals)
    const collisions: Array<{ originalNames: string[]; targetName: string }> = [];
    for (const [targetName, originalNames] of targetToOriginals) {
      if (originalNames.length > 1) {
        collisions.push({ originalNames, targetName });
      }
    }

    if (collisions.length > 0) {
      throw new RenameCollisionError(collisions);
    }
  }

  /**
   * Clone operations map and update type references
   * This ensures we don't mutate the original IR
   */
  private cloneAndUpdateOperations(
    operations: Map<string, OperationDefinition>,
    renames: Map<string, string>
  ): { operations: Map<string, OperationDefinition>; referencesUpdated: number } {
    const newOperations = new Map<string, OperationDefinition>();
    let referencesUpdated = 0;

    for (const [opId, operation] of operations) {
      // Deep clone the operation
      const clonedOperation = this.cloneOperation(operation);
      referencesUpdated += this.updateOperationReferences(clonedOperation, renames);
      newOperations.set(opId, clonedOperation);
    }

    return { operations: newOperations, referencesUpdated };
  }

  /**
   * Deep clone an operation definition
   */
  private cloneOperation(operation: OperationDefinition): OperationDefinition {
    return {
      ...operation,
      parameters: operation.parameters.map(p => this.cloneParameter(p)),
      requestBody: operation.requestBody
        ? {
            ...operation.requestBody,
            content: new Map(
              Array.from(operation.requestBody.content.entries()).map(([k, v]) => [
                k,
                this.cloneTypeReference(v),
              ])
            ),
          }
        : undefined,
      responses: new Map(
        Array.from(operation.responses.entries()).map(([k, v]) => [k, this.cloneResponse(v)])
      ),
    };
  }

  /**
   * Deep clone a parameter definition
   */
  private cloneParameter(param: ParameterDefinition): ParameterDefinition {
    return {
      ...param,
      type: this.cloneTypeReference(param.type),
    };
  }

  /**
   * Deep clone a response definition
   */
  private cloneResponse(response: ResponseDefinition): ResponseDefinition {
    return {
      ...response,
      content: response.content
        ? new Map(
            Array.from(response.content.entries()).map(([k, v]) => [k, this.cloneTypeReference(v)])
          )
        : undefined,
    };
  }

  /**
   * Deep clone a type reference
   */
  private cloneTypeReference(type: TypeReference): TypeReference {
    if (!type) return type;

    switch (type.kind) {
      case 'array':
        return {
          ...type,
          elementType: type.elementType ? this.cloneTypeReference(type.elementType) : undefined,
        };
      case 'union':
        return {
          ...type,
          unionTypes: type.unionTypes?.map(t => this.cloneTypeReference(t)),
        };
      case 'dictionary':
        return {
          ...type,
          additionalProperties: type.additionalProperties
            ? this.cloneTypeReference(type.additionalProperties)
            : undefined,
        };
      default:
        return { ...type };
    }
  }

  /**
   * Apply mappings to a schema name
   * Supports partial matching (substring replacement)
   */
  private applyMappings(
    name: string,
    mappings: RenameMapping[],
    caseSensitive: boolean
  ): string {
    let result = name;

    for (const { pattern, replacement } of mappings) {
      const nameToMatch = caseSensitive ? result : result.toLowerCase();
      const patternToMatch = caseSensitive ? pattern : pattern.toLowerCase();

      if (nameToMatch.includes(patternToMatch)) {
        // Find actual position in original case string
        const idx = nameToMatch.indexOf(patternToMatch);
        const actualPattern = result.substring(idx, idx + pattern.length);
        result = result.replace(actualPattern, replacement);
      }
    }

    // Ensure result is valid PascalCase class name
    return toPascalCase(result);
  }

  /**
   * Update type references in a schema's properties
   */
  private updateSchemaReferences(
    schema: SchemaDefinition,
    renames: Map<string, string>
  ): number {
    let count = 0;

    for (const property of schema.properties.values()) {
      count += this.updateTypeReference(property.type, renames);
    }

    return count;
  }

  /**
   * Update references in an operation (mutates the operation)
   */
  private updateOperationReferences(
    operation: OperationDefinition,
    renames: Map<string, string>
  ): number {
    let count = 0;

    // Parameters
    for (const param of operation.parameters) {
      count += this.updateTypeReference(param.type, renames);
    }

    // Request body
    if (operation.requestBody?.content) {
      for (const type of operation.requestBody.content.values()) {
        count += this.updateTypeReference(type, renames);
      }
    }

    // Responses
    for (const response of operation.responses.values()) {
      if (response.content) {
        for (const type of response.content.values()) {
          count += this.updateTypeReference(type, renames);
        }
      }
    }

    return count;
  }

  /**
   * Recursively update type references
   */
  private updateTypeReference(
    type: TypeReference,
    renames: Map<string, string>
  ): number {
    if (!type) return 0;

    let count = 0;

    switch (type.kind) {
      case 'reference':
      case 'object':
        if (type.name && renames.has(type.name)) {
          type.name = renames.get(type.name)!;
          count++;
        }
        break;

      case 'array':
        if (type.elementType) {
          count += this.updateTypeReference(type.elementType, renames);
        }
        break;

      case 'union':
        if (type.unionTypes) {
          for (const t of type.unionTypes) {
            count += this.updateTypeReference(t, renames);
          }
        }
        break;

      case 'dictionary':
        if (type.additionalProperties) {
          count += this.updateTypeReference(type.additionalProperties, renames);
        }
        break;
    }

    return count;
  }
}

/**
 * Convenience function for renaming schemas
 */
export function renameSchemas(
  ir: SchemaIR,
  mappings: RenameMapping[]
): RenameResult {
  const renamer = new IRRenamer();
  return renamer.rename(ir, { mappings });
}
