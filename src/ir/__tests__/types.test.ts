import { IRHelpers, TypeReference, SchemaIR } from '../types';

describe('IRHelpers', () => {
  describe('createSchemaIR', () => {
    it('should create an empty SchemaIR', () => {
      const ir = IRHelpers.createSchemaIR();

      expect(ir.schemas).toBeInstanceOf(Map);
      expect(ir.schemas.size).toBe(0);
      expect(ir.operations).toBeInstanceOf(Map);
      expect(ir.operations.size).toBe(0);
      expect(ir.metadata.sourceFormat).toBe('openapi');
    });
  });

  describe('createPrimitiveType', () => {
    it('should create a string type', () => {
      const type = IRHelpers.createPrimitiveType('string');

      expect(type.kind).toBe('primitive');
      expect(type.name).toBe('string');
    });

    it('should create a number type', () => {
      const type = IRHelpers.createPrimitiveType('number');

      expect(type.kind).toBe('primitive');
      expect(type.name).toBe('number');
    });

    it('should create a boolean type', () => {
      const type = IRHelpers.createPrimitiveType('boolean');

      expect(type.kind).toBe('primitive');
      expect(type.name).toBe('boolean');
    });
  });

  describe('createArrayType', () => {
    it('should create an array of strings', () => {
      const elementType = IRHelpers.createPrimitiveType('string');
      const arrayType = IRHelpers.createArrayType(elementType);

      expect(arrayType.kind).toBe('array');
      expect(arrayType.elementType).toEqual(elementType);
    });

    it('should create a nested array', () => {
      const stringType = IRHelpers.createPrimitiveType('string');
      const innerArray = IRHelpers.createArrayType(stringType);
      const outerArray = IRHelpers.createArrayType(innerArray);

      expect(outerArray.kind).toBe('array');
      expect(outerArray.elementType?.kind).toBe('array');
      expect(outerArray.elementType?.elementType?.kind).toBe('primitive');
    });
  });

  describe('createReferenceType', () => {
    it('should create a reference type', () => {
      const type = IRHelpers.createReferenceType('User');

      expect(type.kind).toBe('reference');
      expect(type.name).toBe('User');
    });
  });

  describe('createUnionType', () => {
    it('should create a union of primitives', () => {
      const stringType = IRHelpers.createPrimitiveType('string');
      const numberType = IRHelpers.createPrimitiveType('number');
      const unionType = IRHelpers.createUnionType([stringType, numberType]);

      expect(unionType.kind).toBe('union');
      expect(unionType.unionTypes).toHaveLength(2);
      expect(unionType.unionTypes?.[0]).toEqual(stringType);
      expect(unionType.unionTypes?.[1]).toEqual(numberType);
    });

    it('should create a union with reference types', () => {
      const userType = IRHelpers.createReferenceType('User');
      const adminType = IRHelpers.createReferenceType('Admin');
      const unionType = IRHelpers.createUnionType([userType, adminType]);

      expect(unionType.kind).toBe('union');
      expect(unionType.unionTypes).toHaveLength(2);
    });
  });

  describe('createDictionaryType', () => {
    it('should create a dictionary with string values', () => {
      const valueType = IRHelpers.createPrimitiveType('string');
      const dictType = IRHelpers.createDictionaryType(valueType);

      expect(dictType.kind).toBe('dictionary');
      expect(dictType.additionalProperties).toEqual(valueType);
    });

    it('should create a dictionary with object values', () => {
      const valueType = IRHelpers.createReferenceType('Config');
      const dictType = IRHelpers.createDictionaryType(valueType);

      expect(dictType.kind).toBe('dictionary');
      expect(dictType.additionalProperties?.kind).toBe('reference');
      expect(dictType.additionalProperties?.name).toBe('Config');
    });
  });

  describe('createUnknownType', () => {
    it('should create an unknown type', () => {
      const type = IRHelpers.createUnknownType();

      expect(type.kind).toBe('unknown');
      expect(type.name).toBe('unknown');
    });
  });
});
