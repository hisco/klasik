/**
 * Unit tests for RefInliner
 */

import { RefInliner, RefInlinerError } from '../ref-inliner';

describe('RefInliner', () => {
  let inliner: RefInliner;

  beforeEach(() => {
    inliner = new RefInliner();
  });

  describe('isExternalRef', () => {
    it('should identify external refs', () => {
      expect(inliner.isExternalRef('./schemas/Pet.yaml')).toBe(true);
      expect(inliner.isExternalRef('http://example.com/schema.json')).toBe(true);
      expect(inliner.isExternalRef('../common.yaml#/User')).toBe(true);
    });

    it('should identify internal refs', () => {
      expect(inliner.isExternalRef('#/components/schemas/User')).toBe(false);
      expect(inliner.isExternalRef('#/definitions/Pet')).toBe(false);
    });
  });

  describe('inline - single external ref', () => {
    it('should inline a single external ref', () => {
      const spec = {
        components: {
          schemas: {
            Pet: {
              $ref: './schemas/Pet.yaml',
            },
          },
        },
      };

      const resolvedRefs = new Map([
        [
          './schemas/Pet.yaml',
          {
            type: 'object',
            properties: {
              name: { type: 'string' },
              age: { type: 'number' },
            },
          },
        ],
      ]);

      const result = inliner.inline(spec, resolvedRefs);

      expect(result).toEqual({
        components: {
          schemas: {
            Pet: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                age: { type: 'number' },
              },
            },
          },
        },
      });
    });

    it('should preserve internal refs', () => {
      const spec = {
        components: {
          schemas: {
            Pet: {
              type: 'object',
              properties: {
                owner: {
                  $ref: '#/components/schemas/User',
                },
              },
            },
            User: {
              type: 'object',
              properties: {
                name: { type: 'string' },
              },
            },
          },
        },
      };

      const resolvedRefs = new Map();

      const result = inliner.inline(spec, resolvedRefs);

      // Internal ref should be preserved
      expect(result.components.schemas.Pet.properties.owner).toEqual({
        $ref: '#/components/schemas/User',
      });
    });
  });

  describe('inline - multiple refs', () => {
    it('should inline multiple external refs', () => {
      const spec = {
        components: {
          schemas: {
            Pet: { $ref: './schemas/Pet.yaml' },
            User: { $ref: './schemas/User.yaml' },
          },
        },
      };

      const resolvedRefs = new Map([
        [
          './schemas/Pet.yaml',
          {
            type: 'object',
            properties: {
              name: { type: 'string' },
            },
          },
        ],
        [
          './schemas/User.yaml',
          {
            type: 'object',
            properties: {
              email: { type: 'string' },
            },
          },
        ],
      ]);

      const result = inliner.inline(spec, resolvedRefs);

      expect(result).toEqual({
        components: {
          schemas: {
            Pet: {
              type: 'object',
              properties: {
                name: { type: 'string' },
              },
            },
            User: {
              type: 'object',
              properties: {
                email: { type: 'string' },
              },
            },
          },
        },
      });
    });
  });

  describe('inline - nested refs', () => {
    it('should inline nested refs (ref within ref)', () => {
      const spec = {
        components: {
          schemas: {
            Pet: { $ref: './schemas/Pet.yaml' },
          },
        },
      };

      const resolvedRefs = new Map([
        [
          './schemas/Pet.yaml',
          {
            type: 'object',
            properties: {
              owner: { $ref: './schemas/User.yaml' },
            },
          },
        ],
        [
          './schemas/User.yaml',
          {
            type: 'object',
            properties: {
              name: { type: 'string' },
            },
          },
        ],
      ]);

      const result = inliner.inline(spec, resolvedRefs);

      expect(result).toEqual({
        components: {
          schemas: {
            Pet: {
              type: 'object',
              properties: {
                owner: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      });
    });

    it('should handle deeply nested refs', () => {
      const spec = {
        data: { $ref: './level1.yaml' },
      };

      const resolvedRefs = new Map([
        [
          './level1.yaml',
          {
            nested: { $ref: './level2.yaml' },
          },
        ],
        [
          './level2.yaml',
          {
            deepNested: { $ref: './level3.yaml' },
          },
        ],
        [
          './level3.yaml',
          {
            value: 'deep',
          },
        ],
      ]);

      const result = inliner.inline(spec, resolvedRefs);

      expect(result).toEqual({
        data: {
          nested: {
            deepNested: {
              value: 'deep',
            },
          },
        },
      });
    });
  });

  describe('inline - refs in arrays', () => {
    it('should inline refs in arrays', () => {
      const spec = {
        items: [
          { $ref: './schemas/Pet.yaml' },
          { $ref: './schemas/User.yaml' },
          { type: 'string' },
        ],
      };

      const resolvedRefs = new Map([
        ['./schemas/Pet.yaml', { type: 'object', pet: true }],
        ['./schemas/User.yaml', { type: 'object', user: true }],
      ]);

      const result = inliner.inline(spec, resolvedRefs);

      expect(result).toEqual({
        items: [
          { type: 'object', pet: true },
          { type: 'object', user: true },
          { type: 'string' },
        ],
      });
    });

    it('should inline refs in nested arrays', () => {
      const spec = {
        data: {
          items: [
            {
              nested: [{ $ref: './schemas/Pet.yaml' }],
            },
          ],
        },
      };

      const resolvedRefs = new Map([
        ['./schemas/Pet.yaml', { type: 'object', name: 'Fluffy' }],
      ]);

      const result = inliner.inline(spec, resolvedRefs);

      expect(result).toEqual({
        data: {
          items: [
            {
              nested: [{ type: 'object', name: 'Fluffy' }],
            },
          ],
        },
      });
    });
  });

  describe('inline - fragments', () => {
    it('should handle refs with fragments', () => {
      const spec = {
        components: {
          schemas: {
            Pet: { $ref: './schemas.yaml#/definitions/Pet' },
          },
        },
      };

      // Mock RefResolver.resolveFragment by directly providing resolved content
      const resolvedRefs = new Map([
        [
          './schemas.yaml',
          {
            definitions: {
              Pet: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                },
              },
              User: {
                type: 'object',
                properties: {
                  email: { type: 'string' },
                },
              },
            },
          },
        ],
      ]);

      const result = inliner.inline(spec, resolvedRefs);

      // Should inline the Pet definition from the fragment
      expect(result.components.schemas.Pet).toEqual({
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
      });
    });

    it('should handle multiple levels of fragment paths', () => {
      const spec = {
        schema: { $ref: './api.yaml#/components/schemas/User' },
      };

      const resolvedRefs = new Map([
        [
          './api.yaml',
          {
            components: {
              schemas: {
                User: {
                  type: 'object',
                  properties: {
                    id: { type: 'integer' },
                    name: { type: 'string' },
                  },
                },
              },
            },
          },
        ],
      ]);

      const result = inliner.inline(spec, resolvedRefs);

      expect(result.schema).toEqual({
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
        },
      });
    });
  });

  describe('inline - refs in nested objects', () => {
    it('should inline refs in deeply nested objects', () => {
      const spec = {
        level1: {
          level2: {
            level3: {
              schema: { $ref: './schemas/Pet.yaml' },
            },
          },
        },
      };

      const resolvedRefs = new Map([
        ['./schemas/Pet.yaml', { type: 'object', name: 'pet' }],
      ]);

      const result = inliner.inline(spec, resolvedRefs);

      expect(result.level1.level2.level3.schema).toEqual({
        type: 'object',
        name: 'pet',
      });
    });

    it('should handle refs at multiple nesting levels', () => {
      const spec = {
        outer: { $ref: './outer.yaml' },
        middle: {
          inner: { $ref: './inner.yaml' },
        },
      };

      const resolvedRefs = new Map([
        ['./outer.yaml', { type: 'outer' }],
        ['./inner.yaml', { type: 'inner' }],
      ]);

      const result = inliner.inline(spec, resolvedRefs);

      expect(result).toEqual({
        outer: { type: 'outer' },
        middle: {
          inner: { type: 'inner' },
        },
      });
    });
  });

  describe('error handling', () => {
    it('should throw error for missing ref', () => {
      const spec = {
        schema: { $ref: './missing.yaml' },
      };

      const resolvedRefs = new Map();

      expect(() => inliner.inline(spec, resolvedRefs)).toThrow(RefInlinerError);
      expect(() => inliner.inline(spec, resolvedRefs)).toThrow(
        'Cannot inline ref "./missing.yaml": not found in resolved refs'
      );
    });

    it('should throw error for invalid fragment', () => {
      const spec = {
        schema: { $ref: './schemas.yaml#/invalid/path' },
      };

      const resolvedRefs = new Map([
        [
          './schemas.yaml',
          {
            definitions: {
              Pet: { type: 'object' },
            },
          },
        ],
      ]);

      expect(() => inliner.inline(spec, resolvedRefs)).toThrow(RefInlinerError);
      expect(() => inliner.inline(spec, resolvedRefs)).toThrow(/fragment/i);
    });
  });

  describe('deep cloning', () => {
    it('should not mutate original spec', () => {
      const spec = {
        schema: { $ref: './schemas/Pet.yaml' },
      };

      const originalSpec = JSON.parse(JSON.stringify(spec));

      const resolvedRefs = new Map([
        ['./schemas/Pet.yaml', { type: 'object' }],
      ]);

      inliner.inline(spec, resolvedRefs);

      // Original spec should be unchanged
      expect(spec).toEqual(originalSpec);
    });

    it('should not mutate resolved refs', () => {
      const spec = {
        schema: { $ref: './schemas/Pet.yaml' },
      };

      const petSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
      };

      const originalPetSchema = JSON.parse(JSON.stringify(petSchema));

      const resolvedRefs = new Map([['./schemas/Pet.yaml', petSchema]]);

      inliner.inline(spec, resolvedRefs);

      // Resolved ref should be unchanged
      expect(petSchema).toEqual(originalPetSchema);
    });
  });

  describe('edge cases', () => {
    it('should handle null values', () => {
      const spec = {
        value: null,
      };

      const resolvedRefs = new Map();

      const result = inliner.inline(spec, resolvedRefs);

      expect(result).toEqual({ value: null });
    });

    it('should handle undefined values', () => {
      const spec = {
        value: undefined,
      };

      const resolvedRefs = new Map();

      const result = inliner.inline(spec, resolvedRefs);

      // undefined values are not preserved in JSON serialization
      expect(result).toEqual({});
    });

    it('should handle empty objects', () => {
      const spec = {};

      const resolvedRefs = new Map();

      const result = inliner.inline(spec, resolvedRefs);

      expect(result).toEqual({});
    });

    it('should handle empty arrays', () => {
      const spec = {
        items: [],
      };

      const resolvedRefs = new Map();

      const result = inliner.inline(spec, resolvedRefs);

      expect(result).toEqual({ items: [] });
    });

    it('should handle primitive values', () => {
      const spec = {
        string: 'value',
        number: 42,
        boolean: true,
      };

      const resolvedRefs = new Map();

      const result = inliner.inline(spec, resolvedRefs);

      expect(result).toEqual({
        string: 'value',
        number: 42,
        boolean: true,
      });
    });

    it('should handle refs with empty fragments', () => {
      const spec = {
        schema: { $ref: './schemas.yaml#/' },
      };

      const resolvedRefs = new Map([
        [
          './schemas.yaml',
          {
            type: 'object',
            name: 'root',
          },
        ],
      ]);

      const result = inliner.inline(spec, resolvedRefs);

      // Empty fragment should return entire document
      expect(result.schema).toEqual({
        type: 'object',
        name: 'root',
      });
    });
  });

  describe('getResolvedRef', () => {
    it('should return resolved ref content', () => {
      const spec = {
        schema: { $ref: './schemas/Pet.yaml' },
      };

      const petSchema = { type: 'object' };
      const resolvedRefs = new Map([['./schemas/Pet.yaml', petSchema]]);

      inliner.inline(spec, resolvedRefs);

      expect(inliner.getResolvedRef('./schemas/Pet.yaml')).toBe(petSchema);
    });

    it('should return undefined for non-existent ref', () => {
      const spec = {};
      const resolvedRefs = new Map();

      inliner.inline(spec, resolvedRefs);

      expect(inliner.getResolvedRef('./missing.yaml')).toBeUndefined();
    });
  });
});
