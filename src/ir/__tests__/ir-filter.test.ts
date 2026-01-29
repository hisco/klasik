/**
 * IR Filter Tests
 */

import { IRFilter, filterIR } from '../ir-filter';
import { SchemaIR, IRHelpers } from '../types';

describe('IRFilter', () => {
  let filter: IRFilter;

  beforeEach(() => {
    filter = new IRFilter();
  });

  /**
   * Create a test IR with the following structure:
   * Gateway -> GatewaySpec -> BackendRef
   * HTTPRoute (independent)
   */
  function createTestIR(): SchemaIR {
    const ir = IRHelpers.createSchemaIR();

    // Gateway -> GatewaySpec -> BackendRef
    const gateway = IRHelpers.createSchema('Gateway');
    gateway.properties.set(
      'spec',
      IRHelpers.createProperty('spec', IRHelpers.createReferenceType('GatewaySpec'))
    );
    ir.schemas.set('Gateway', gateway);

    const gatewaySpec = IRHelpers.createSchema('GatewaySpec');
    gatewaySpec.properties.set(
      'backends',
      IRHelpers.createProperty(
        'backends',
        IRHelpers.createArrayType(IRHelpers.createReferenceType('BackendRef'))
      )
    );
    ir.schemas.set('GatewaySpec', gatewaySpec);

    const backendRef = IRHelpers.createSchema('BackendRef');
    backendRef.properties.set(
      'name',
      IRHelpers.createProperty('name', IRHelpers.createPrimitiveType('string'))
    );
    ir.schemas.set('BackendRef', backendRef);

    // HTTPRoute (independent schema)
    const httpRoute = IRHelpers.createSchema('HTTPRoute');
    httpRoute.properties.set(
      'name',
      IRHelpers.createProperty('name', IRHelpers.createPrimitiveType('string'))
    );
    ir.schemas.set('HTTPRoute', httpRoute);

    return ir;
  }

  describe('basic filtering', () => {
    it('should include specified schema and its dependencies', () => {
      const ir = createTestIR();
      const result = filter.filter(ir, { include: ['Gateway'] });

      expect(result.includedSchemas.has('Gateway')).toBe(true);
      expect(result.includedSchemas.has('GatewaySpec')).toBe(true);
      expect(result.includedSchemas.has('BackendRef')).toBe(true);
      expect(result.includedSchemas.has('HTTPRoute')).toBe(false);
      expect(result.ir.schemas.size).toBe(3);
    });

    it('should exclude schemas not in dependency tree', () => {
      const ir = createTestIR();
      const result = filter.filter(ir, { include: ['HTTPRoute'] });

      expect(result.includedSchemas.has('HTTPRoute')).toBe(true);
      expect(result.includedSchemas.has('Gateway')).toBe(false);
      expect(result.includedSchemas.has('GatewaySpec')).toBe(false);
      expect(result.includedSchemas.has('BackendRef')).toBe(false);
      expect(result.ir.schemas.size).toBe(1);
    });

    it('should include multiple specified schemas and their dependencies', () => {
      const ir = createTestIR();
      const result = filter.filter(ir, { include: ['Gateway', 'HTTPRoute'] });

      expect(result.includedSchemas.has('Gateway')).toBe(true);
      expect(result.includedSchemas.has('GatewaySpec')).toBe(true);
      expect(result.includedSchemas.has('BackendRef')).toBe(true);
      expect(result.includedSchemas.has('HTTPRoute')).toBe(true);
      expect(result.ir.schemas.size).toBe(4);
    });

    it('should report missing schemas', () => {
      const ir = createTestIR();
      const result = filter.filter(ir, { include: ['NonExistent'] });

      expect(result.missingSchemas).toContain('NonExistent');
      expect(result.ir.schemas.size).toBe(0);
    });

    it('should report partial missing schemas', () => {
      const ir = createTestIR();
      const result = filter.filter(ir, { include: ['Gateway', 'NonExistent'] });

      expect(result.missingSchemas).toContain('NonExistent');
      expect(result.includedSchemas.has('Gateway')).toBe(true);
      expect(result.ir.schemas.size).toBe(3);
    });
  });

  describe('circular references', () => {
    it('should handle circular references without infinite loops', () => {
      const ir = IRHelpers.createSchemaIR();

      // A -> B -> A (circular)
      const schemaA = IRHelpers.createSchema('A');
      schemaA.properties.set(
        'b',
        IRHelpers.createProperty('b', IRHelpers.createReferenceType('B'))
      );
      ir.schemas.set('A', schemaA);

      const schemaB = IRHelpers.createSchema('B');
      schemaB.properties.set(
        'a',
        IRHelpers.createProperty('a', IRHelpers.createReferenceType('A'))
      );
      ir.schemas.set('B', schemaB);

      const result = filter.filter(ir, { include: ['A'] });

      expect(result.includedSchemas.has('A')).toBe(true);
      expect(result.includedSchemas.has('B')).toBe(true);
      expect(result.ir.schemas.size).toBe(2);
    });

    it('should handle self-referencing schemas', () => {
      const ir = IRHelpers.createSchemaIR();

      // Node -> Node (self-reference)
      const node = IRHelpers.createSchema('Node');
      node.properties.set(
        'children',
        IRHelpers.createProperty(
          'children',
          IRHelpers.createArrayType(IRHelpers.createReferenceType('Node'))
        )
      );
      ir.schemas.set('Node', node);

      const result = filter.filter(ir, { include: ['Node'] });

      expect(result.includedSchemas.has('Node')).toBe(true);
      expect(result.ir.schemas.size).toBe(1);
    });
  });

  describe('complex type references', () => {
    it('should traverse array element types', () => {
      const ir = IRHelpers.createSchemaIR();

      const parent = IRHelpers.createSchema('Parent');
      parent.properties.set(
        'items',
        IRHelpers.createProperty(
          'items',
          IRHelpers.createArrayType(IRHelpers.createReferenceType('Child'))
        )
      );
      ir.schemas.set('Parent', parent);

      const child = IRHelpers.createSchema('Child');
      child.properties.set(
        'name',
        IRHelpers.createProperty('name', IRHelpers.createPrimitiveType('string'))
      );
      ir.schemas.set('Child', child);

      const result = filter.filter(ir, { include: ['Parent'] });

      expect(result.includedSchemas.has('Parent')).toBe(true);
      expect(result.includedSchemas.has('Child')).toBe(true);
      expect(result.ir.schemas.size).toBe(2);
    });

    it('should traverse union types', () => {
      const ir = IRHelpers.createSchemaIR();

      const parent = IRHelpers.createSchema('Parent');
      parent.properties.set(
        'value',
        IRHelpers.createProperty(
          'value',
          IRHelpers.createUnionType([
            IRHelpers.createReferenceType('TypeA'),
            IRHelpers.createReferenceType('TypeB'),
          ])
        )
      );
      ir.schemas.set('Parent', parent);

      ir.schemas.set('TypeA', IRHelpers.createSchema('TypeA'));
      ir.schemas.set('TypeB', IRHelpers.createSchema('TypeB'));

      const result = filter.filter(ir, { include: ['Parent'] });

      expect(result.includedSchemas.has('Parent')).toBe(true);
      expect(result.includedSchemas.has('TypeA')).toBe(true);
      expect(result.includedSchemas.has('TypeB')).toBe(true);
      expect(result.ir.schemas.size).toBe(3);
    });

    it('should traverse dictionary value types', () => {
      const ir = IRHelpers.createSchemaIR();

      const parent = IRHelpers.createSchema('Parent');
      parent.properties.set(
        'map',
        IRHelpers.createProperty(
          'map',
          IRHelpers.createDictionaryType(IRHelpers.createReferenceType('Value'))
        )
      );
      ir.schemas.set('Parent', parent);

      ir.schemas.set('Value', IRHelpers.createSchema('Value'));

      const result = filter.filter(ir, { include: ['Parent'] });

      expect(result.includedSchemas.has('Parent')).toBe(true);
      expect(result.includedSchemas.has('Value')).toBe(true);
      expect(result.ir.schemas.size).toBe(2);
    });

    it('should traverse nested arrays of references', () => {
      const ir = IRHelpers.createSchemaIR();

      const parent = IRHelpers.createSchema('Parent');
      parent.properties.set(
        'matrix',
        IRHelpers.createProperty(
          'matrix',
          IRHelpers.createArrayType(
            IRHelpers.createArrayType(IRHelpers.createReferenceType('Cell'))
          )
        )
      );
      ir.schemas.set('Parent', parent);

      ir.schemas.set('Cell', IRHelpers.createSchema('Cell'));

      const result = filter.filter(ir, { include: ['Parent'] });

      expect(result.includedSchemas.has('Parent')).toBe(true);
      expect(result.includedSchemas.has('Cell')).toBe(true);
      expect(result.ir.schemas.size).toBe(2);
    });
  });

  describe('statistics', () => {
    it('should report correct statistics', () => {
      const ir = createTestIR();
      const result = filter.filter(ir, { include: ['Gateway'] });

      expect(result.stats.originalCount).toBe(4);
      expect(result.stats.filteredCount).toBe(3);
      expect(result.stats.dependenciesAdded).toBe(2); // GatewaySpec and BackendRef
    });

    it('should report zero dependencies for leaf schema', () => {
      const ir = createTestIR();
      const result = filter.filter(ir, { include: ['HTTPRoute'] });

      expect(result.stats.originalCount).toBe(4);
      expect(result.stats.filteredCount).toBe(1);
      expect(result.stats.dependenciesAdded).toBe(0);
    });

    it('should report correct stats for multiple includes', () => {
      const ir = createTestIR();
      const result = filter.filter(ir, { include: ['Gateway', 'HTTPRoute'] });

      expect(result.stats.originalCount).toBe(4);
      expect(result.stats.filteredCount).toBe(4);
      // 2 explicitly included, 2 dependencies (GatewaySpec, BackendRef)
      expect(result.stats.dependenciesAdded).toBe(2);
    });
  });

  describe('convenience function', () => {
    it('should work with filterIR convenience function', () => {
      const ir = createTestIR();
      const result = filterIR(ir, ['Gateway']);

      expect(result.includedSchemas.has('Gateway')).toBe(true);
      expect(result.includedSchemas.has('GatewaySpec')).toBe(true);
      expect(result.includedSchemas.has('BackendRef')).toBe(true);
      expect(result.ir.schemas.size).toBe(3);
    });
  });

  describe('metadata preservation', () => {
    it('should preserve IR metadata in filtered result', () => {
      const ir = createTestIR();
      ir.metadata.title = 'Test API';
      ir.metadata.version = '1.0.0';
      ir.metadata.sourceFormat = 'crd';

      const result = filter.filter(ir, { include: ['Gateway'] });

      expect(result.ir.metadata.title).toBe('Test API');
      expect(result.ir.metadata.version).toBe('1.0.0');
      expect(result.ir.metadata.sourceFormat).toBe('crd');
    });
  });
});
