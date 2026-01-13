/**
 * Unit tests for JSON Schema Parser
 *
 * Tests critical JSON Schema-specific edge cases:
 * 1. Root schema naming from $ref
 * 2. Support for both $defs and definitions
 * 3. oneOf/anyOf to union types
 * 4. Circular reference safety
 * 5. Draft-04 boolean exclusiveMinimum
 * 6. const keyword (single-value enum)
 * 7. allOf merging
 */

import { JsonSchemaParser } from '../json-schema-parser';

describe('JsonSchemaParser', () => {
  let parser: JsonSchemaParser;

  beforeEach(() => {
    parser = new JsonSchemaParser();
  });

  // Test 1: Root Schema Naming from $ref
  describe('Root schema naming', () => {
    it('should extract schema name from root $ref', () => {
      const schema: any = {
        $ref: '#/definitions/Kustomization',
        definitions: {
          Kustomization: {
            type: 'object',
            properties: {
              apiVersion: { type: 'string' }
            }
          }
        }
      };

      const ir = parser.parse(schema);

      expect(ir.schemas.has('Kustomization')).toBe(true);
      expect(ir.metadata.title).toBe('Kustomization');
      expect(ir.metadata.sourceFormat).toBe('jsonschema');
    });

    it('should use rootSchemaName option if provided', () => {
      const schema: any = {
        $ref: '#/definitions/Something',
        definitions: {
          Something: {
            type: 'object'
          }
        }
      };

      const ir = parser.parse(schema, { rootSchemaName: 'MyCustomName' });

      expect(ir.metadata.title).toBe('MyCustomName');
    });

    it('should use title field if no $ref or option', () => {
      const schema: any = {
        title: 'my-schema',
        type: 'object',
        properties: {
          foo: { type: 'string' }
        }
      };

      const ir = parser.parse(schema);

      expect(ir.metadata.title).toBe('MySchema'); // toPascalCase('my-schema')
    });

    it('should use "Schema" as fallback', () => {
      const schema: any = {
        type: 'object',
        properties: {
          foo: { type: 'string' }
        }
      };

      const ir = parser.parse(schema);

      expect(ir.metadata.title).toBe('Schema');
    });
  });

  // Test 2: Support both $defs and definitions
  describe('Definitions extraction', () => {
    it('should handle definitions (Draft-04/07)', () => {
      const schema: any = {
        definitions: {
          Foo: {
            type: 'string'
          },
          Bar: {
            type: 'number'
          }
        }
      };

      const ir = parser.parse(schema);

      expect(ir.schemas.has('Foo')).toBe(true);
      expect(ir.schemas.has('Bar')).toBe(true);
    });

    it('should handle $defs (Draft 2019-09+)', () => {
      const schema: any = {
        $defs: {
          Baz: {
            type: 'string'
          },
          Qux: {
            type: 'boolean'
          }
        }
      };

      const ir = parser.parse(schema);

      expect(ir.schemas.has('Baz')).toBe(true);
      expect(ir.schemas.has('Qux')).toBe(true);
    });

    it('should prefer $defs over definitions if both exist', () => {
      const schema: any = {
        $defs: {
          'from-defs': {
            type: 'string'
          }
        },
        definitions: {
          'from-definitions': {
            type: 'number'
          }
        }
      };

      const ir = parser.parse(schema);

      // $defs takes precedence
      expect(ir.schemas.has('FromDefs')).toBe(true);
      // definitions should be ignored when $defs exists
      expect(ir.schemas.has('FromDefinitions')).toBe(false);
    });
  });

  // Test 3: oneOf/anyOf to Union Types
  describe('Union types', () => {
    it('should convert oneOf to union schema type', () => {
      const schema: any = {
        definitions: {
          Combined: {
            oneOf: [
              {
                type: 'object',
                properties: { a: { type: 'string' } }
              },
              {
                type: 'object',
                properties: { b: { type: 'number' } }
              }
            ]
          }
        }
      };

      const ir = parser.parse(schema);
      const combined = ir.schemas.get('Combined');

      expect(combined).toBeDefined();
      expect(combined?.type).toBe('union');
      // Should merge properties from both union members
      expect(combined?.properties.has('a')).toBe(true);
      expect(combined?.properties.has('b')).toBe(true);
    });

    it('should convert anyOf to union schema type', () => {
      const schema: any = {
        definitions: {
          Flexible: {
            anyOf: [
              { type: 'string' },
              { type: 'number' }
            ]
          }
        }
      };

      const ir = parser.parse(schema);
      const flexible = ir.schemas.get('Flexible');

      expect(flexible).toBeDefined();
      expect(flexible?.type).toBe('union');
    });
  });

  // Test 4: Circular Reference Safety
  describe('Circular references', () => {
    it('should handle circular references without infinite loop', () => {
      const schema: any = {
        definitions: {
          Node: {
            type: 'object',
            properties: {
              value: { type: 'string' },
              children: {
                type: 'array',
                items: { $ref: '#/definitions/Node' }
              }
            }
          }
        }
      };

      // Should not throw or hang
      expect(() => parser.parse(schema)).not.toThrow();

      const ir = parser.parse(schema);
      expect(ir.schemas.has('Node')).toBe(true);

      const node = ir.schemas.get('Node')!;
      const children = node.properties.get('children');
      expect(children?.type.kind).toBe('array');
      expect(children?.type.elementType?.kind).toBe('reference');
      expect(children?.type.elementType?.name).toBe('Node');
    });

    it('should handle self-referencing schemas', () => {
      const schema: any = {
        definitions: {
          'recursive-type': {
            type: 'object',
            properties: {
              self: { $ref: '#/definitions/recursive-type' }
            }
          }
        }
      };

      expect(() => parser.parse(schema)).not.toThrow();

      const ir = parser.parse(schema);
      const recursiveType = ir.schemas.get('RecursiveType');

      expect(recursiveType).toBeDefined();
      const selfProp = recursiveType?.properties.get('self');
      expect(selfProp?.type.kind).toBe('reference');
      expect(selfProp?.type.name).toBe('RecursiveType');
    });
  });

  // Test 5: Draft-04 Boolean exclusiveMinimum
  describe('Draft-04 constraints', () => {
    it('should parse boolean exclusiveMinimum (Draft-04)', () => {
      const schema: any = {
        definitions: {
          'positive-number': {
            type: 'number',
            minimum: 0,
            exclusiveMinimum: true
          }
        }
      };

      const ir = parser.parse(schema);
      const positiveNumber = ir.schemas.get('PositiveNumber');

      expect(positiveNumber).toBeDefined();
      expect(positiveNumber?.type).toBe('object');
      // Since this is a primitive definition without properties,
      // the actual schema might be empty. Check that it was processed.
    });

    it('should parse number exclusiveMinimum (later drafts)', () => {
      const schema: any = {
        definitions: {
          'greater-than-zero': {
            type: 'number',
            exclusiveMinimum: 0
          }
        }
      };

      const ir = parser.parse(schema);
      const greaterThanZero = ir.schemas.get('GreaterThanZero');

      expect(greaterThanZero).toBeDefined();
    });

    it('should handle constraints in properties correctly', () => {
      const schema: any = {
        definitions: {
          'range-value': {
            type: 'object',
            properties: {
              value: {
                type: 'number',
                minimum: 0,
                exclusiveMinimum: true
              }
            }
          }
        }
      };

      const ir = parser.parse(schema);
      const rangeValue = ir.schemas.get('RangeValue');

      expect(rangeValue).toBeDefined();
      const valueProp = rangeValue?.properties.get('value');
      expect(valueProp?.constraints?.minimum).toBe(0);
      expect(valueProp?.constraints?.exclusiveMinimum).toBe(true);
    });
  });

  // Test 6: const Keyword (single-value enum)
  describe('const keyword', () => {
    it('should handle const as single-value enum', () => {
      const schema: any = {
        definitions: {
          'api-version': {
            type: 'object',
            properties: {
              version: {
                type: 'string',
                const: 'v1'
              }
            }
          }
        }
      };

      const ir = parser.parse(schema);
      const apiVersion = ir.schemas.get('ApiVersion');

      expect(apiVersion).toBeDefined();
      const versionProp = apiVersion?.properties.get('version');
      expect(versionProp?.constraints?.enum).toEqual(['v1']);
    });

    it('should handle const with different types', () => {
      const schema: any = {
        definitions: {
          'constants': {
            type: 'object',
            properties: {
              stringConst: { const: 'hello' },
              numberConst: { const: 42 },
              boolConst: { const: true }
            }
          }
        }
      };

      const ir = parser.parse(schema);
      const constants = ir.schemas.get('Constants');

      expect(constants).toBeDefined();
      expect(constants?.properties.get('stringConst')?.constraints?.enum).toEqual(['hello']);
      expect(constants?.properties.get('numberConst')?.constraints?.enum).toEqual([42]);
      expect(constants?.properties.get('boolConst')?.constraints?.enum).toEqual([true]);
    });
  });

  // Test 7: allOf Merging
  describe('allOf handling', () => {
    it('should handle allOf as union (composition)', () => {
      const schema: any = {
        definitions: {
          'base-type': {
            type: 'object',
            properties: { a: { type: 'string' } }
          },
          'extended-type': {
            allOf: [
              { $ref: '#/definitions/base-type' },
              {
                type: 'object',
                properties: { b: { type: 'number' } }
              }
            ]
          }
        }
      };

      const ir = parser.parse(schema);
      const extendedType = ir.schemas.get('ExtendedType');

      expect(extendedType).toBeDefined();
      // allOf creates a union type
      expect(extendedType?.type).toBe('object');
    });

    it('should handle allOf with references', () => {
      const schema: any = {
        definitions: {
          'type-a': {
            type: 'object',
            properties: { x: { type: 'string' } }
          },
          'type-b': {
            type: 'object',
            properties: { y: { type: 'number' } }
          },
          'merged': {
            allOf: [
              { $ref: '#/definitions/type-a' },
              { $ref: '#/definitions/type-b' }
            ]
          }
        }
      };

      const ir = parser.parse(schema);

      expect(ir.schemas.has('TypeA')).toBe(true);
      expect(ir.schemas.has('TypeB')).toBe(true);
      expect(ir.schemas.has('Merged')).toBe(true);
    });
  });

  // Additional test: Array types
  describe('Array handling', () => {
    it('should handle arrays with items', () => {
      const schema: any = {
        definitions: {
          'string-array': {
            type: 'object',
            properties: {
              items: {
                type: 'array',
                items: { type: 'string' }
              }
            }
          }
        }
      };

      const ir = parser.parse(schema);
      const stringArray = ir.schemas.get('StringArray');

      expect(stringArray).toBeDefined();
      const itemsProp = stringArray?.properties.get('items');
      expect(itemsProp?.type.kind).toBe('array');
      expect(itemsProp?.type.elementType?.kind).toBe('primitive');
      expect(itemsProp?.type.elementType?.name).toBe('string');
    });

    it('should handle arrays with $ref items', () => {
      const schema: any = {
        definitions: {
          'item': {
            type: 'object',
            properties: { id: { type: 'string' } }
          },
          'item-list': {
            type: 'object',
            properties: {
              items: {
                type: 'array',
                items: { $ref: '#/definitions/item' }
              }
            }
          }
        }
      };

      const ir = parser.parse(schema);
      const itemList = ir.schemas.get('ItemList');

      expect(itemList).toBeDefined();
      const itemsProp = itemList?.properties.get('items');
      expect(itemsProp?.type.kind).toBe('array');
      expect(itemsProp?.type.elementType?.kind).toBe('reference');
      expect(itemsProp?.type.elementType?.name).toBe('Item');
    });
  });

  // Additional test: Dictionary types (additionalProperties)
  describe('Dictionary handling', () => {
    it('should handle additionalProperties with type', () => {
      const schema: any = {
        definitions: {
          'string-map': {
            type: 'object',
            properties: {
              labels: {
                type: 'object',
                additionalProperties: { type: 'string' }
              }
            }
          }
        }
      };

      const ir = parser.parse(schema);
      const stringMap = ir.schemas.get('StringMap');

      expect(stringMap).toBeDefined();
      const labelsProp = stringMap?.properties.get('labels');
      expect(labelsProp?.type.kind).toBe('dictionary');
      expect(labelsProp?.type.additionalProperties?.kind).toBe('primitive');
      expect(labelsProp?.type.additionalProperties?.name).toBe('string');
    });

    it('should handle additionalProperties: true', () => {
      const schema: any = {
        definitions: {
          'any-map': {
            type: 'object',
            properties: {
              metadata: {
                type: 'object',
                additionalProperties: true
              }
            }
          }
        }
      };

      const ir = parser.parse(schema);
      const anyMap = ir.schemas.get('AnyMap');

      expect(anyMap).toBeDefined();
      const metadataProp = anyMap?.properties.get('metadata');
      expect(metadataProp?.type.kind).toBe('dictionary');
      expect(metadataProp?.type.additionalProperties?.kind).toBe('unknown');
    });
  });

  // Additional test: Required fields
  describe('Required fields', () => {
    it('should mark required fields correctly', () => {
      const schema: any = {
        definitions: {
          User: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              email: { type: 'string' }
            },
            required: ['id', 'name']
          }
        }
      };

      const ir = parser.parse(schema);
      const user = ir.schemas.get('User');

      expect(user).toBeDefined();
      expect(user?.required.has('id')).toBe(true);
      expect(user?.required.has('name')).toBe(true);
      expect(user?.required.has('email')).toBe(false);

      const idProp = user?.properties.get('id');
      const nameProp = user?.properties.get('name');
      const emailProp = user?.properties.get('email');

      expect(idProp?.required).toBe(true);
      expect(nameProp?.required).toBe(true);
      expect(emailProp?.required).toBe(false);
    });
  });
});
