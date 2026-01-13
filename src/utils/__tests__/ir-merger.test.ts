/**
 * Tests for IR Merger
 */

import { IRMerger, mergeTwoIRs, mergeMultipleIRs } from '../ir-merger';
import { SchemaIR, IRHelpers } from '../../ir/types';

describe('IRMerger', () => {
  describe('merge two IRs', () => {
    it('should merge two simple IRs without conflicts', () => {
      const ir1: SchemaIR = {
        schemas: new Map([
          ['User', IRHelpers.createSchema('User')],
        ]),
        operations: new Map(),
        metadata: {
          title: 'API 1',
          version: '1.0.0',
          sourceFormat: 'openapi',
        },
      };

      const ir2: SchemaIR = {
        schemas: new Map([
          ['Product', IRHelpers.createSchema('Product')],
        ]),
        operations: new Map(),
        metadata: {
          title: 'API 2',
          version: '1.0.0',
          sourceFormat: 'openapi',
        },
      };

      const merger = new IRMerger();
      const result = merger.merge([ir1, ir2]);

      expect(result.ir.schemas.size).toBe(2);
      expect(result.ir.schemas.has('User')).toBe(true);
      expect(result.ir.schemas.has('Product')).toBe(true);
      expect(result.stats.totalSchemas).toBe(2);
      expect(result.stats.conflicts).toBe(0);
      expect(result.stats.skipped).toBe(0);
    });

    it('should handle name conflicts with rename strategy', () => {
      const ir1: SchemaIR = {
        schemas: new Map([
          ['User', IRHelpers.createSchema('User')],
        ]),
        operations: new Map(),
        metadata: {
          sourceFormat: 'openapi',
        },
      };

      const ir2: SchemaIR = {
        schemas: new Map([
          ['User', IRHelpers.createSchema('User')],
        ]),
        operations: new Map(),
        metadata: {
          sourceFormat: 'openapi',
        },
      };

      const merger = new IRMerger();
      const result = merger.merge([ir1, ir2], { conflictResolution: 'rename' });

      expect(result.ir.schemas.size).toBe(2);
      expect(result.ir.schemas.has('User')).toBe(true);
      expect(result.ir.schemas.has('User2')).toBe(true);
      expect(result.stats.totalSchemas).toBe(2);
      expect(result.stats.conflicts).toBe(1);
      expect(result.renamedSchemas.get('User')).toBe('User2');
    });

    it('should handle name conflicts with skip strategy', () => {
      const ir1: SchemaIR = {
        schemas: new Map([
          ['User', IRHelpers.createSchema('User')],
        ]),
        operations: new Map(),
        metadata: {
          sourceFormat: 'openapi',
        },
      };

      const ir2: SchemaIR = {
        schemas: new Map([
          ['User', IRHelpers.createSchema('User')],
        ]),
        operations: new Map(),
        metadata: {
          sourceFormat: 'openapi',
        },
      };

      const merger = new IRMerger();
      const result = merger.merge([ir1, ir2], { conflictResolution: 'skip' });

      expect(result.ir.schemas.size).toBe(1);
      expect(result.ir.schemas.has('User')).toBe(true);
      expect(result.stats.totalSchemas).toBe(1);
      expect(result.stats.conflicts).toBe(1);
      expect(result.stats.skipped).toBe(1);
    });

    it('should handle name conflicts with overwrite strategy', () => {
      const schema1 = IRHelpers.createSchema('User');
      schema1.description = 'First user';

      const schema2 = IRHelpers.createSchema('User');
      schema2.description = 'Second user';

      const ir1: SchemaIR = {
        schemas: new Map([['User', schema1]]),
        operations: new Map(),
        metadata: {
          sourceFormat: 'openapi',
        },
      };

      const ir2: SchemaIR = {
        schemas: new Map([['User', schema2]]),
        operations: new Map(),
        metadata: {
          sourceFormat: 'openapi',
        },
      };

      const merger = new IRMerger();
      const result = merger.merge([ir1, ir2], { conflictResolution: 'overwrite' });

      expect(result.ir.schemas.size).toBe(1);
      expect(result.ir.schemas.has('User')).toBe(true);
      expect(result.ir.schemas.get('User')?.description).toBe('Second user');
      expect(result.stats.conflicts).toBe(1);
    });
  });

  describe('merge multiple IRs', () => {
    it('should merge three IRs successfully', () => {
      const ir1: SchemaIR = {
        schemas: new Map([
          ['User', IRHelpers.createSchema('User')],
        ]),
        operations: new Map(),
        metadata: {
          sourceFormat: 'openapi',
        },
      };

      const ir2: SchemaIR = {
        schemas: new Map([
          ['Product', IRHelpers.createSchema('Product')],
        ]),
        operations: new Map(),
        metadata: {
          sourceFormat: 'openapi',
        },
      };

      const ir3: SchemaIR = {
        schemas: new Map([
          ['Order', IRHelpers.createSchema('Order')],
        ]),
        operations: new Map(),
        metadata: {
          sourceFormat: 'openapi',
        },
      };

      const merger = new IRMerger();
      const result = merger.merge([ir1, ir2, ir3]);

      expect(result.ir.schemas.size).toBe(3);
      expect(result.ir.schemas.has('User')).toBe(true);
      expect(result.ir.schemas.has('Product')).toBe(true);
      expect(result.ir.schemas.has('Order')).toBe(true);
      expect(result.stats.totalSchemas).toBe(3);
      expect(result.stats.conflicts).toBe(0);
    });

    it('should handle multiple conflicts across three IRs', () => {
      const ir1: SchemaIR = {
        schemas: new Map([
          ['User', IRHelpers.createSchema('User')],
        ]),
        operations: new Map(),
        metadata: {
          sourceFormat: 'openapi',
        },
      };

      const ir2: SchemaIR = {
        schemas: new Map([
          ['User', IRHelpers.createSchema('User')],
        ]),
        operations: new Map(),
        metadata: {
          sourceFormat: 'openapi',
        },
      };

      const ir3: SchemaIR = {
        schemas: new Map([
          ['User', IRHelpers.createSchema('User')],
        ]),
        operations: new Map(),
        metadata: {
          sourceFormat: 'openapi',
        },
      };

      const merger = new IRMerger();
      const result = merger.merge([ir1, ir2, ir3], { conflictResolution: 'rename' });

      expect(result.ir.schemas.size).toBe(3);
      expect(result.ir.schemas.has('User')).toBe(true);
      expect(result.ir.schemas.has('User2')).toBe(true);
      expect(result.ir.schemas.has('User3')).toBe(true);
      expect(result.stats.conflicts).toBe(2);
    });
  });

  describe('merge with prefixes', () => {
    it('should apply prefixes to schema names', () => {
      const ir1: SchemaIR = {
        schemas: new Map([
          ['User', IRHelpers.createSchema('User')],
        ]),
        operations: new Map(),
        metadata: {
          sourceFormat: 'openapi',
        },
      };

      const ir2: SchemaIR = {
        schemas: new Map([
          ['User', IRHelpers.createSchema('User')],
        ]),
        operations: new Map(),
        metadata: {
          sourceFormat: 'openapi',
        },
      };

      const merger = new IRMerger();
      const result = merger.merge([ir1, ir2], { prefixes: ['', 'V2'] });

      expect(result.ir.schemas.size).toBe(2);
      expect(result.ir.schemas.has('User')).toBe(true);
      expect(result.ir.schemas.has('V2User')).toBe(true);
      expect(result.stats.conflicts).toBe(0);
    });
  });

  describe('merge operations', () => {
    it('should merge operations from multiple IRs', () => {
      const ir1: SchemaIR = {
        schemas: new Map(),
        operations: new Map([
          ['getUser', {
            operationId: 'getUser',
            method: 'GET',
            path: '/users/{id}',
            parameters: [],
            responses: new Map(),
          }],
        ]),
        metadata: {
          sourceFormat: 'openapi',
        },
      };

      const ir2: SchemaIR = {
        schemas: new Map(),
        operations: new Map([
          ['getProduct', {
            operationId: 'getProduct',
            method: 'GET',
            path: '/products/{id}',
            parameters: [],
            responses: new Map(),
          }],
        ]),
        metadata: {
          sourceFormat: 'openapi',
        },
      };

      const merger = new IRMerger();
      const result = merger.merge([ir1, ir2]);

      expect(result.ir.operations.size).toBe(2);
      expect(result.ir.operations.has('getUser')).toBe(true);
      expect(result.ir.operations.has('getProduct')).toBe(true);
      expect(result.stats.totalOperations).toBe(2);
    });

    it('should handle operation ID conflicts', () => {
      const ir1: SchemaIR = {
        schemas: new Map(),
        operations: new Map([
          ['getUser', {
            operationId: 'getUser',
            method: 'GET',
            path: '/users/{id}',
            parameters: [],
            responses: new Map(),
          }],
        ]),
        metadata: {
          sourceFormat: 'openapi',
        },
      };

      const ir2: SchemaIR = {
        schemas: new Map(),
        operations: new Map([
          ['getUser', {
            operationId: 'getUser',
            method: 'GET',
            path: '/v2/users/{id}',
            parameters: [],
            responses: new Map(),
          }],
        ]),
        metadata: {
          sourceFormat: 'openapi',
        },
      };

      const merger = new IRMerger();
      const result = merger.merge([ir1, ir2], { conflictResolution: 'rename' });

      expect(result.ir.operations.size).toBe(2);
      expect(result.ir.operations.has('getUser')).toBe(true);
      expect(result.ir.operations.has('getUser2')).toBe(true);
    });
  });

  describe('merge empty IRs', () => {
    it('should handle merging empty IRs', () => {
      const ir1: SchemaIR = {
        schemas: new Map(),
        operations: new Map(),
        metadata: {
          sourceFormat: 'openapi',
        },
      };

      const ir2: SchemaIR = {
        schemas: new Map(),
        operations: new Map(),
        metadata: {
          sourceFormat: 'openapi',
        },
      };

      const merger = new IRMerger();
      const result = merger.merge([ir1, ir2]);

      expect(result.ir.schemas.size).toBe(0);
      expect(result.ir.operations.size).toBe(0);
      expect(result.stats.totalSchemas).toBe(0);
      expect(result.stats.totalOperations).toBe(0);
    });

    it('should handle merging with one empty IR', () => {
      const ir1: SchemaIR = {
        schemas: new Map([
          ['User', IRHelpers.createSchema('User')],
        ]),
        operations: new Map(),
        metadata: {
          sourceFormat: 'openapi',
        },
      };

      const ir2: SchemaIR = {
        schemas: new Map(),
        operations: new Map(),
        metadata: {
          sourceFormat: 'openapi',
        },
      };

      const merger = new IRMerger();
      const result = merger.merge([ir1, ir2]);

      expect(result.ir.schemas.size).toBe(1);
      expect(result.ir.schemas.has('User')).toBe(true);
    });
  });

  describe('merge metadata', () => {
    it('should merge metadata titles', () => {
      const ir1: SchemaIR = {
        schemas: new Map(),
        operations: new Map(),
        metadata: {
          title: 'API 1',
          sourceFormat: 'openapi',
        },
      };

      const ir2: SchemaIR = {
        schemas: new Map(),
        operations: new Map(),
        metadata: {
          title: 'API 2',
          sourceFormat: 'openapi',
        },
      };

      const merger = new IRMerger();
      const result = merger.merge([ir1, ir2]);

      expect(result.ir.metadata.title).toBe('API 1 + API 2');
    });

    it('should merge metadata descriptions', () => {
      const ir1: SchemaIR = {
        schemas: new Map(),
        operations: new Map(),
        metadata: {
          description: 'Description 1',
          sourceFormat: 'openapi',
        },
      };

      const ir2: SchemaIR = {
        schemas: new Map(),
        operations: new Map(),
        metadata: {
          description: 'Description 2',
          sourceFormat: 'openapi',
        },
      };

      const merger = new IRMerger();
      const result = merger.merge([ir1, ir2]);

      expect(result.ir.metadata.description).toBe('Description 1\n\nDescription 2');
    });

    it('should merge metadata servers', () => {
      const ir1: SchemaIR = {
        schemas: new Map(),
        operations: new Map(),
        metadata: {
          servers: ['https://api1.example.com'],
          sourceFormat: 'openapi',
        },
      };

      const ir2: SchemaIR = {
        schemas: new Map(),
        operations: new Map(),
        metadata: {
          servers: ['https://api2.example.com'],
          sourceFormat: 'openapi',
        },
      };

      const merger = new IRMerger();
      const result = merger.merge([ir1, ir2]);

      expect(result.ir.metadata.servers).toHaveLength(2);
      expect(result.ir.metadata.servers).toContain('https://api1.example.com');
      expect(result.ir.metadata.servers).toContain('https://api2.example.com');
    });

    it('should merge vendor extensions', () => {
      const ir1: SchemaIR = {
        schemas: new Map(),
        operations: new Map(),
        metadata: {
          sourceFormat: 'openapi',
          vendorExtensions: {
            'x-custom-1': 'value1',
          },
        },
      };

      const ir2: SchemaIR = {
        schemas: new Map(),
        operations: new Map(),
        metadata: {
          sourceFormat: 'openapi',
          vendorExtensions: {
            'x-custom-2': 'value2',
          },
        },
      };

      const merger = new IRMerger();
      const result = merger.merge([ir1, ir2]);

      expect(result.ir.metadata.vendorExtensions).toEqual({
        'x-custom-1': 'value1',
        'x-custom-2': 'value2',
      });
    });
  });

  describe('convenience functions', () => {
    it('should merge two IRs using mergeTwoIRs', () => {
      const ir1: SchemaIR = {
        schemas: new Map([
          ['User', IRHelpers.createSchema('User')],
        ]),
        operations: new Map(),
        metadata: {
          sourceFormat: 'openapi',
        },
      };

      const ir2: SchemaIR = {
        schemas: new Map([
          ['Product', IRHelpers.createSchema('Product')],
        ]),
        operations: new Map(),
        metadata: {
          sourceFormat: 'openapi',
        },
      };

      const result = mergeTwoIRs(ir1, ir2);

      expect(result.ir.schemas.size).toBe(2);
      expect(result.ir.schemas.has('User')).toBe(true);
      expect(result.ir.schemas.has('Product')).toBe(true);
    });

    it('should merge multiple IRs using mergeMultipleIRs', () => {
      const ir1: SchemaIR = {
        schemas: new Map([
          ['User', IRHelpers.createSchema('User')],
        ]),
        operations: new Map(),
        metadata: {
          sourceFormat: 'openapi',
        },
      };

      const ir2: SchemaIR = {
        schemas: new Map([
          ['Product', IRHelpers.createSchema('Product')],
        ]),
        operations: new Map(),
        metadata: {
          sourceFormat: 'openapi',
        },
      };

      const ir3: SchemaIR = {
        schemas: new Map([
          ['Order', IRHelpers.createSchema('Order')],
        ]),
        operations: new Map(),
        metadata: {
          sourceFormat: 'openapi',
        },
      };

      const result = mergeMultipleIRs([ir1, ir2, ir3]);

      expect(result.ir.schemas.size).toBe(3);
      expect(result.ir.schemas.has('User')).toBe(true);
      expect(result.ir.schemas.has('Product')).toBe(true);
      expect(result.ir.schemas.has('Order')).toBe(true);
    });
  });

  describe('type reference updates', () => {
    it('should update type references when schema is renamed', () => {
      const userSchema = IRHelpers.createSchema('User');
      const addressProp = IRHelpers.createProperty('address', IRHelpers.createReferenceType('Address'));
      userSchema.properties.set('address', addressProp);

      const addressSchema = IRHelpers.createSchema('Address');

      const ir1: SchemaIR = {
        schemas: new Map([
          ['User', userSchema],
          ['Address', addressSchema],
        ]),
        operations: new Map(),
        metadata: {
          sourceFormat: 'openapi',
        },
      };

      const ir2: SchemaIR = {
        schemas: new Map([
          ['Address', IRHelpers.createSchema('Address')],
        ]),
        operations: new Map(),
        metadata: {
          sourceFormat: 'openapi',
        },
      };

      const merger = new IRMerger();
      const result = merger.merge([ir1, ir2], { conflictResolution: 'rename' });

      expect(result.ir.schemas.size).toBe(3);
      expect(result.ir.schemas.has('Address')).toBe(true);
      expect(result.ir.schemas.has('Address2')).toBe(true);
    });
  });
});
