/**
 * Tests for IR Renamer
 */

import { IRRenamer, renameSchemas, RenameMapping, RenameCollisionError } from '../ir-renamer';
import { SchemaIR, IRHelpers, TypeReference } from '../../ir/types';

describe('IRRenamer', () => {
  describe('basic renaming', () => {
    it('should rename schema with exact match', () => {
      const schema = IRHelpers.createSchema('inline_response_200');

      const ir: SchemaIR = {
        schemas: new Map([['inline_response_200', schema]]),
        operations: new Map(),
        metadata: { sourceFormat: 'openapi' },
      };

      const mappings: RenameMapping[] = [
        { pattern: 'inline_response_200', replacement: 'AllocationResponse' },
      ];

      const renamer = new IRRenamer();
      const result = renamer.rename(ir, { mappings });

      expect(result.ir.schemas.size).toBe(1);
      expect(result.ir.schemas.has('AllocationResponse')).toBe(true);
      expect(result.ir.schemas.has('inline_response_200')).toBe(false);
      expect(result.ir.schemas.get('AllocationResponse')?.name).toBe('AllocationResponse');
      expect(result.stats.schemasRenamed).toBe(1);
      expect(result.renamedSchemas.get('inline_response_200')).toBe('AllocationResponse');
    });

    it('should rename schemas with partial match', () => {
      const schema1 = IRHelpers.createSchema('inline_response_200');
      const schema2 = IRHelpers.createSchema('inline_response_200Data');
      const schema3 = IRHelpers.createSchema('inline_response_200DataItem');

      const ir: SchemaIR = {
        schemas: new Map([
          ['inline_response_200', schema1],
          ['inline_response_200Data', schema2],
          ['inline_response_200DataItem', schema3],
        ]),
        operations: new Map(),
        metadata: { sourceFormat: 'openapi' },
      };

      const mappings: RenameMapping[] = [
        { pattern: 'inline_response_200', replacement: 'Allocation' },
      ];

      const renamer = new IRRenamer();
      const result = renamer.rename(ir, { mappings });

      expect(result.ir.schemas.size).toBe(3);
      expect(result.ir.schemas.has('Allocation')).toBe(true);
      expect(result.ir.schemas.has('AllocationData')).toBe(true);
      expect(result.ir.schemas.has('AllocationDataItem')).toBe(true);
      expect(result.stats.schemasRenamed).toBe(3);
    });

    it('should not rename when pattern does not match', () => {
      const schema = IRHelpers.createSchema('User');

      const ir: SchemaIR = {
        schemas: new Map([['User', schema]]),
        operations: new Map(),
        metadata: { sourceFormat: 'openapi' },
      };

      const mappings: RenameMapping[] = [
        { pattern: 'inline_response', replacement: 'Response' },
      ];

      const renamer = new IRRenamer();
      const result = renamer.rename(ir, { mappings });

      expect(result.ir.schemas.size).toBe(1);
      expect(result.ir.schemas.has('User')).toBe(true);
      expect(result.stats.schemasRenamed).toBe(0);
    });

    it('should apply multiple mappings in order', () => {
      const schema = IRHelpers.createSchema('inline_response_200');

      const ir: SchemaIR = {
        schemas: new Map([['inline_response_200', schema]]),
        operations: new Map(),
        metadata: { sourceFormat: 'openapi' },
      };

      const mappings: RenameMapping[] = [
        { pattern: 'inline_response_', replacement: 'Api' },
        { pattern: '200', replacement: 'Success' },
      ];

      const renamer = new IRRenamer();
      const result = renamer.rename(ir, { mappings });

      expect(result.ir.schemas.has('ApiSuccess')).toBe(true);
      expect(result.stats.schemasRenamed).toBe(1);
    });

    it('should handle case-insensitive matching by default', () => {
      const schema = IRHelpers.createSchema('InlineResponse200');

      const ir: SchemaIR = {
        schemas: new Map([['InlineResponse200', schema]]),
        operations: new Map(),
        metadata: { sourceFormat: 'openapi' },
      };

      const mappings: RenameMapping[] = [
        { pattern: 'inlineresponse', replacement: 'Api' },
      ];

      const renamer = new IRRenamer();
      const result = renamer.rename(ir, { mappings });

      expect(result.ir.schemas.has('Api200')).toBe(true);
    });

    it('should support case-sensitive matching when enabled', () => {
      const schema = IRHelpers.createSchema('InlineResponse200');

      const ir: SchemaIR = {
        schemas: new Map([['InlineResponse200', schema]]),
        operations: new Map(),
        metadata: { sourceFormat: 'openapi' },
      };

      const mappings: RenameMapping[] = [
        { pattern: 'inlineresponse', replacement: 'Api' },
      ];

      const renamer = new IRRenamer();
      const result = renamer.rename(ir, { mappings, caseSensitive: true });

      // Should NOT match because case doesn't match
      expect(result.ir.schemas.has('InlineResponse200')).toBe(true);
      expect(result.stats.schemasRenamed).toBe(0);
    });
  });

  describe('type reference updates', () => {
    it('should update reference type in property', () => {
      const dataSchema = IRHelpers.createSchema('inline_response_200Data');

      const responseSchema = IRHelpers.createSchema('inline_response_200');
      const dataProp = IRHelpers.createProperty('data', IRHelpers.createReferenceType('inline_response_200Data'));
      responseSchema.properties.set('data', dataProp);

      const ir: SchemaIR = {
        schemas: new Map([
          ['inline_response_200', responseSchema],
          ['inline_response_200Data', dataSchema],
        ]),
        operations: new Map(),
        metadata: { sourceFormat: 'openapi' },
      };

      const mappings: RenameMapping[] = [
        { pattern: 'inline_response_200', replacement: 'Allocation' },
      ];

      const result = renameSchemas(ir, mappings);

      const renamedResponse = result.ir.schemas.get('Allocation');
      expect(renamedResponse).toBeDefined();
      const dataProperty = renamedResponse?.properties.get('data');
      expect(dataProperty?.type.name).toBe('AllocationData');
      expect(result.stats.referencesUpdated).toBeGreaterThan(0);
    });

    it('should update array element type reference', () => {
      const itemSchema = IRHelpers.createSchema('inline_response_200Item');

      const responseSchema = IRHelpers.createSchema('inline_response_200');
      const itemsType: TypeReference = {
        kind: 'array',
        elementType: IRHelpers.createReferenceType('inline_response_200Item'),
      };
      const itemsProp = IRHelpers.createProperty('items', itemsType);
      responseSchema.properties.set('items', itemsProp);

      const ir: SchemaIR = {
        schemas: new Map([
          ['inline_response_200', responseSchema],
          ['inline_response_200Item', itemSchema],
        ]),
        operations: new Map(),
        metadata: { sourceFormat: 'openapi' },
      };

      const mappings: RenameMapping[] = [
        { pattern: 'inline_response_200', replacement: 'Allocation' },
      ];

      const result = renameSchemas(ir, mappings);

      const renamedResponse = result.ir.schemas.get('Allocation');
      const itemsProperty = renamedResponse?.properties.get('items');
      expect(itemsProperty?.type.kind).toBe('array');
      expect(itemsProperty?.type.elementType?.name).toBe('AllocationItem');
    });

    it('should update union type references', () => {
      const successSchema = IRHelpers.createSchema('inline_response_200Success');
      const errorSchema = IRHelpers.createSchema('inline_response_200Error');

      const responseSchema = IRHelpers.createSchema('inline_response_200');
      const unionType: TypeReference = {
        kind: 'union',
        unionTypes: [
          IRHelpers.createReferenceType('inline_response_200Success'),
          IRHelpers.createReferenceType('inline_response_200Error'),
        ],
      };
      const resultProp = IRHelpers.createProperty('result', unionType);
      responseSchema.properties.set('result', resultProp);

      const ir: SchemaIR = {
        schemas: new Map([
          ['inline_response_200', responseSchema],
          ['inline_response_200Success', successSchema],
          ['inline_response_200Error', errorSchema],
        ]),
        operations: new Map(),
        metadata: { sourceFormat: 'openapi' },
      };

      const mappings: RenameMapping[] = [
        { pattern: 'inline_response_200', replacement: 'Allocation' },
      ];

      const result = renameSchemas(ir, mappings);

      const renamedResponse = result.ir.schemas.get('Allocation');
      const resultProperty = renamedResponse?.properties.get('result');
      expect(resultProperty?.type.kind).toBe('union');
      expect(resultProperty?.type.unionTypes?.[0].name).toBe('AllocationSuccess');
      expect(resultProperty?.type.unionTypes?.[1].name).toBe('AllocationError');
    });

    it('should update dictionary value type reference', () => {
      const itemSchema = IRHelpers.createSchema('inline_response_200Item');

      const responseSchema = IRHelpers.createSchema('inline_response_200');
      const dictType: TypeReference = {
        kind: 'dictionary',
        additionalProperties: IRHelpers.createReferenceType('inline_response_200Item'),
      };
      const mapProp = IRHelpers.createProperty('itemsMap', dictType);
      responseSchema.properties.set('itemsMap', mapProp);

      const ir: SchemaIR = {
        schemas: new Map([
          ['inline_response_200', responseSchema],
          ['inline_response_200Item', itemSchema],
        ]),
        operations: new Map(),
        metadata: { sourceFormat: 'openapi' },
      };

      const mappings: RenameMapping[] = [
        { pattern: 'inline_response_200', replacement: 'Allocation' },
      ];

      const result = renameSchemas(ir, mappings);

      const renamedResponse = result.ir.schemas.get('Allocation');
      const mapProperty = renamedResponse?.properties.get('itemsMap');
      expect(mapProperty?.type.kind).toBe('dictionary');
      expect(mapProperty?.type.additionalProperties?.name).toBe('AllocationItem');
    });

    it('should update deeply nested type references', () => {
      const deepSchema = IRHelpers.createSchema('inline_response_200Deep');

      const responseSchema = IRHelpers.createSchema('inline_response_200');
      // Array of dictionaries of references
      const nestedType: TypeReference = {
        kind: 'array',
        elementType: {
          kind: 'dictionary',
          additionalProperties: IRHelpers.createReferenceType('inline_response_200Deep'),
        },
      };
      const nestedProp = IRHelpers.createProperty('nested', nestedType);
      responseSchema.properties.set('nested', nestedProp);

      const ir: SchemaIR = {
        schemas: new Map([
          ['inline_response_200', responseSchema],
          ['inline_response_200Deep', deepSchema],
        ]),
        operations: new Map(),
        metadata: { sourceFormat: 'openapi' },
      };

      const mappings: RenameMapping[] = [
        { pattern: 'inline_response_200', replacement: 'Allocation' },
      ];

      const result = renameSchemas(ir, mappings);

      const renamedResponse = result.ir.schemas.get('Allocation');
      const nestedProperty = renamedResponse?.properties.get('nested');
      expect(nestedProperty?.type.kind).toBe('array');
      expect(nestedProperty?.type.elementType?.kind).toBe('dictionary');
      expect(nestedProperty?.type.elementType?.additionalProperties?.name).toBe('AllocationDeep');
    });
  });

  describe('operation reference updates', () => {
    it('should update parameter type references', () => {
      const requestSchema = IRHelpers.createSchema('inline_response_200Request');

      const ir: SchemaIR = {
        schemas: new Map([['inline_response_200Request', requestSchema]]),
        operations: new Map([
          ['createAllocation', {
            operationId: 'createAllocation',
            method: 'POST',
            path: '/allocations',
            parameters: [
              {
                name: 'request',
                in: 'query',
                required: true,
                type: IRHelpers.createReferenceType('inline_response_200Request'),
              },
            ],
            responses: new Map(),
          }],
        ]),
        metadata: { sourceFormat: 'openapi' },
      };

      const mappings: RenameMapping[] = [
        { pattern: 'inline_response_200', replacement: 'Allocation' },
      ];

      const result = renameSchemas(ir, mappings);

      const operation = result.ir.operations.get('createAllocation');
      expect(operation?.parameters[0].type.name).toBe('AllocationRequest');
    });

    it('should update request body type references', () => {
      const bodySchema = IRHelpers.createSchema('inline_response_200Body');

      const ir: SchemaIR = {
        schemas: new Map([['inline_response_200Body', bodySchema]]),
        operations: new Map([
          ['createAllocation', {
            operationId: 'createAllocation',
            method: 'POST',
            path: '/allocations',
            parameters: [],
            requestBody: {
              required: true,
              content: new Map([
                ['application/json', IRHelpers.createReferenceType('inline_response_200Body')],
              ]),
            },
            responses: new Map(),
          }],
        ]),
        metadata: { sourceFormat: 'openapi' },
      };

      const mappings: RenameMapping[] = [
        { pattern: 'inline_response_200', replacement: 'Allocation' },
      ];

      const result = renameSchemas(ir, mappings);

      const operation = result.ir.operations.get('createAllocation');
      const bodyType = operation?.requestBody?.content.get('application/json');
      expect(bodyType?.name).toBe('AllocationBody');
    });

    it('should update response type references', () => {
      const responseSchema = IRHelpers.createSchema('inline_response_200');

      const ir: SchemaIR = {
        schemas: new Map([['inline_response_200', responseSchema]]),
        operations: new Map([
          ['getAllocation', {
            operationId: 'getAllocation',
            method: 'GET',
            path: '/allocations',
            parameters: [],
            responses: new Map([
              ['200', {
                statusCode: '200',
                description: 'Success',
                content: new Map([
                  ['application/json', IRHelpers.createReferenceType('inline_response_200')],
                ]),
              }],
            ]),
          }],
        ]),
        metadata: { sourceFormat: 'openapi' },
      };

      const mappings: RenameMapping[] = [
        { pattern: 'inline_response_200', replacement: 'AllocationResponse' },
      ];

      const result = renameSchemas(ir, mappings);

      const operation = result.ir.operations.get('getAllocation');
      const response = operation?.responses.get('200');
      const responseType = response?.content?.get('application/json');
      expect(responseType?.name).toBe('AllocationResponse');
    });
  });

  describe('edge cases', () => {
    it('should handle empty IR', () => {
      const ir: SchemaIR = {
        schemas: new Map(),
        operations: new Map(),
        metadata: { sourceFormat: 'openapi' },
      };

      const mappings: RenameMapping[] = [
        { pattern: 'test', replacement: 'Test' },
      ];

      const renamer = new IRRenamer();
      const result = renamer.rename(ir, { mappings });

      expect(result.ir.schemas.size).toBe(0);
      expect(result.stats.schemasRenamed).toBe(0);
      expect(result.stats.referencesUpdated).toBe(0);
    });

    it('should handle empty mappings', () => {
      const schema = IRHelpers.createSchema('User');

      const ir: SchemaIR = {
        schemas: new Map([['User', schema]]),
        operations: new Map(),
        metadata: { sourceFormat: 'openapi' },
      };

      const renamer = new IRRenamer();
      const result = renamer.rename(ir, { mappings: [] });

      expect(result.ir.schemas.size).toBe(1);
      expect(result.ir.schemas.has('User')).toBe(true);
      expect(result.stats.schemasRenamed).toBe(0);
    });

    it('should preserve schema properties after rename', () => {
      const schema = IRHelpers.createSchema('inline_response_200');
      schema.description = 'A response object';
      schema.required.add('data');
      const dataProp = IRHelpers.createProperty('data', IRHelpers.createPrimitiveType('string'));
      dataProp.description = 'The data';
      schema.properties.set('data', dataProp);

      const ir: SchemaIR = {
        schemas: new Map([['inline_response_200', schema]]),
        operations: new Map(),
        metadata: { sourceFormat: 'openapi' },
      };

      const mappings: RenameMapping[] = [
        { pattern: 'inline_response_200', replacement: 'AllocationResponse' },
      ];

      const result = renameSchemas(ir, mappings);

      const renamedSchema = result.ir.schemas.get('AllocationResponse');
      expect(renamedSchema?.description).toBe('A response object');
      expect(renamedSchema?.required.has('data')).toBe(true);
      expect(renamedSchema?.properties.get('data')?.description).toBe('The data');
    });

    it('should ensure renamed schema names are valid PascalCase', () => {
      const schema = IRHelpers.createSchema('inline_response_200');

      const ir: SchemaIR = {
        schemas: new Map([['inline_response_200', schema]]),
        operations: new Map(),
        metadata: { sourceFormat: 'openapi' },
      };

      // Replacement has lowercase start
      const mappings: RenameMapping[] = [
        { pattern: 'inline_response_200', replacement: 'allocationResponse' },
      ];

      const result = renameSchemas(ir, mappings);

      // Should be converted to PascalCase
      expect(result.ir.schemas.has('AllocationResponse')).toBe(true);
    });
  });

  describe('convenience function', () => {
    it('should work with renameSchemas convenience function', () => {
      const schema = IRHelpers.createSchema('inline_response_200');

      const ir: SchemaIR = {
        schemas: new Map([['inline_response_200', schema]]),
        operations: new Map(),
        metadata: { sourceFormat: 'openapi' },
      };

      const mappings: RenameMapping[] = [
        { pattern: 'inline_response_200', replacement: 'AllocationResponse' },
      ];

      const result = renameSchemas(ir, mappings);

      expect(result.ir.schemas.has('AllocationResponse')).toBe(true);
      expect(result.stats.schemasRenamed).toBe(1);
    });
  });

  describe('name collision detection', () => {
    it('should throw RenameCollisionError when multiple schemas rename to same name', () => {
      const schema1 = IRHelpers.createSchema('inline_response_200');
      const schema2 = IRHelpers.createSchema('inline_response_201');

      const ir: SchemaIR = {
        schemas: new Map([
          ['inline_response_200', schema1],
          ['inline_response_201', schema2],
        ]),
        operations: new Map(),
        metadata: { sourceFormat: 'openapi' },
      };

      // Both schemas will rename to "AllocationResponse" due to partial match
      const mappings: RenameMapping[] = [
        { pattern: 'inline_response_200', replacement: 'AllocationResponse' },
        { pattern: 'inline_response_201', replacement: 'AllocationResponse' },
      ];

      const renamer = new IRRenamer();
      expect(() => renamer.rename(ir, { mappings })).toThrow(RenameCollisionError);
    });

    it('should include collision details in error message', () => {
      const schema1 = IRHelpers.createSchema('SchemaA');
      const schema2 = IRHelpers.createSchema('SchemaB');

      const ir: SchemaIR = {
        schemas: new Map([
          ['SchemaA', schema1],
          ['SchemaB', schema2],
        ]),
        operations: new Map(),
        metadata: { sourceFormat: 'openapi' },
      };

      const mappings: RenameMapping[] = [
        { pattern: 'SchemaA', replacement: 'Target' },
        { pattern: 'SchemaB', replacement: 'Target' },
      ];

      const renamer = new IRRenamer();
      try {
        renamer.rename(ir, { mappings });
        throw new Error('Expected RenameCollisionError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(RenameCollisionError);
        const collisionError = error as RenameCollisionError;
        expect(collisionError.collisions).toHaveLength(1);
        expect(collisionError.collisions[0].targetName).toBe('Target');
        expect(collisionError.collisions[0].originalNames).toContain('SchemaA');
        expect(collisionError.collisions[0].originalNames).toContain('SchemaB');
        expect(collisionError.message).toContain('SchemaA');
        expect(collisionError.message).toContain('SchemaB');
        expect(collisionError.message).toContain('Target');
      }
    });

    it('should detect multiple collision groups', () => {
      const ir: SchemaIR = {
        schemas: new Map([
          ['A1', IRHelpers.createSchema('A1')],
          ['A2', IRHelpers.createSchema('A2')],
          ['B1', IRHelpers.createSchema('B1')],
          ['B2', IRHelpers.createSchema('B2')],
        ]),
        operations: new Map(),
        metadata: { sourceFormat: 'openapi' },
      };

      const mappings: RenameMapping[] = [
        { pattern: 'A1', replacement: 'GroupA' },
        { pattern: 'A2', replacement: 'GroupA' },
        { pattern: 'B1', replacement: 'GroupB' },
        { pattern: 'B2', replacement: 'GroupB' },
      ];

      const renamer = new IRRenamer();
      try {
        renamer.rename(ir, { mappings });
        throw new Error('Expected RenameCollisionError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(RenameCollisionError);
        const collisionError = error as RenameCollisionError;
        expect(collisionError.collisions).toHaveLength(2);
      }
    });

    it('should not throw when schemas rename to different names', () => {
      const schema1 = IRHelpers.createSchema('inline_response_200');
      const schema2 = IRHelpers.createSchema('inline_response_201');

      const ir: SchemaIR = {
        schemas: new Map([
          ['inline_response_200', schema1],
          ['inline_response_201', schema2],
        ]),
        operations: new Map(),
        metadata: { sourceFormat: 'openapi' },
      };

      const mappings: RenameMapping[] = [
        { pattern: 'inline_response_200', replacement: 'AllocationResponse' },
        { pattern: 'inline_response_201', replacement: 'ErrorResponse' },
      ];

      const renamer = new IRRenamer();
      expect(() => renamer.rename(ir, { mappings })).not.toThrow();
    });
  });

  describe('immutability (no mutation of input IR)', () => {
    it('should not mutate original schema names', () => {
      const schema = IRHelpers.createSchema('inline_response_200');
      const originalName = schema.name;

      const ir: SchemaIR = {
        schemas: new Map([['inline_response_200', schema]]),
        operations: new Map(),
        metadata: { sourceFormat: 'openapi' },
      };

      const mappings: RenameMapping[] = [
        { pattern: 'inline_response_200', replacement: 'AllocationResponse' },
      ];

      renameSchemas(ir, mappings);

      // Original schema should be unchanged
      expect(schema.name).toBe(originalName);
      expect(ir.schemas.get('inline_response_200')?.name).toBe(originalName);
    });

    it('should not mutate original operation type references', () => {
      const responseSchema = IRHelpers.createSchema('inline_response_200');
      const originalType = IRHelpers.createReferenceType('inline_response_200');
      const originalTypeName = originalType.name;

      const ir: SchemaIR = {
        schemas: new Map([['inline_response_200', responseSchema]]),
        operations: new Map([
          ['getAllocation', {
            operationId: 'getAllocation',
            method: 'GET',
            path: '/allocations',
            parameters: [],
            responses: new Map([
              ['200', {
                statusCode: '200',
                description: 'Success',
                content: new Map([
                  ['application/json', originalType],
                ]),
              }],
            ]),
          }],
        ]),
        metadata: { sourceFormat: 'openapi' },
      };

      const mappings: RenameMapping[] = [
        { pattern: 'inline_response_200', replacement: 'AllocationResponse' },
      ];

      const result = renameSchemas(ir, mappings);

      // Original type reference should be unchanged
      expect(originalType.name).toBe(originalTypeName);
      const originalOperation = ir.operations.get('getAllocation');
      const originalResponseType = originalOperation?.responses.get('200')?.content?.get('application/json');
      expect(originalResponseType?.name).toBe(originalTypeName);

      // Result should have new type reference
      const newOperation = result.ir.operations.get('getAllocation');
      const newResponseType = newOperation?.responses.get('200')?.content?.get('application/json');
      expect(newResponseType?.name).toBe('AllocationResponse');
    });

    it('should not mutate original parameter type references', () => {
      const requestSchema = IRHelpers.createSchema('inline_response_200Request');
      const originalType = IRHelpers.createReferenceType('inline_response_200Request');
      const originalTypeName = originalType.name;

      const ir: SchemaIR = {
        schemas: new Map([['inline_response_200Request', requestSchema]]),
        operations: new Map([
          ['createAllocation', {
            operationId: 'createAllocation',
            method: 'POST',
            path: '/allocations',
            parameters: [
              {
                name: 'request',
                in: 'query',
                required: true,
                type: originalType,
              },
            ],
            responses: new Map(),
          }],
        ]),
        metadata: { sourceFormat: 'openapi' },
      };

      const mappings: RenameMapping[] = [
        { pattern: 'inline_response_200', replacement: 'Allocation' },
      ];

      const result = renameSchemas(ir, mappings);

      // Original type reference should be unchanged
      expect(originalType.name).toBe(originalTypeName);
      const originalOperation = ir.operations.get('createAllocation');
      expect(originalOperation?.parameters[0].type.name).toBe(originalTypeName);

      // Result should have new type reference
      const newOperation = result.ir.operations.get('createAllocation');
      expect(newOperation?.parameters[0].type.name).toBe('AllocationRequest');
    });

    it('should not mutate original request body type references', () => {
      const bodySchema = IRHelpers.createSchema('inline_response_200Body');
      const originalType = IRHelpers.createReferenceType('inline_response_200Body');
      const originalTypeName = originalType.name;

      const ir: SchemaIR = {
        schemas: new Map([['inline_response_200Body', bodySchema]]),
        operations: new Map([
          ['createAllocation', {
            operationId: 'createAllocation',
            method: 'POST',
            path: '/allocations',
            parameters: [],
            requestBody: {
              required: true,
              content: new Map([
                ['application/json', originalType],
              ]),
            },
            responses: new Map(),
          }],
        ]),
        metadata: { sourceFormat: 'openapi' },
      };

      const mappings: RenameMapping[] = [
        { pattern: 'inline_response_200', replacement: 'Allocation' },
      ];

      const result = renameSchemas(ir, mappings);

      // Original type reference should be unchanged
      expect(originalType.name).toBe(originalTypeName);
      const originalOperation = ir.operations.get('createAllocation');
      expect(originalOperation?.requestBody?.content.get('application/json')?.name).toBe(originalTypeName);

      // Result should have new type reference
      const newOperation = result.ir.operations.get('createAllocation');
      expect(newOperation?.requestBody?.content.get('application/json')?.name).toBe('AllocationBody');
    });

    it('should return independent IR that can be modified without affecting original', () => {
      const schema = IRHelpers.createSchema('inline_response_200');

      const ir: SchemaIR = {
        schemas: new Map([['inline_response_200', schema]]),
        operations: new Map(),
        metadata: { sourceFormat: 'openapi', title: 'Original' },
      };

      const mappings: RenameMapping[] = [
        { pattern: 'inline_response_200', replacement: 'AllocationResponse' },
      ];

      const result = renameSchemas(ir, mappings);

      // Modify result
      result.ir.metadata.title = 'Modified';
      result.ir.schemas.get('AllocationResponse')!.description = 'Modified description';

      // Original should be unchanged
      expect(ir.metadata.title).toBe('Original');
      expect(ir.schemas.get('inline_response_200')?.description).toBeUndefined();
    });
  });
});
