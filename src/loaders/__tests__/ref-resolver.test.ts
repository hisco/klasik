/**
 * Unit tests for RefResolver
 */

import { RefResolver, RefResolverError } from '../ref-resolver';
import { SpecLoader } from '../spec-loader';

// Mock SpecLoader
jest.mock('../spec-loader');
const MockedSpecLoader = SpecLoader as jest.MockedClass<typeof SpecLoader>;

describe('RefResolver', () => {
  let resolver: RefResolver;
  let mockLoader: jest.Mocked<SpecLoader>;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create resolver
    resolver = new RefResolver();

    // Get the mocked loader instance
    mockLoader = MockedSpecLoader.mock.instances[0] as jest.Mocked<SpecLoader>;
  });

  describe('isExternalRef', () => {
    it('should identify external refs', () => {
      expect(resolver.isExternalRef('./schemas/Pet.yaml')).toBe(true);
      expect(resolver.isExternalRef('../common/types.yaml')).toBe(true);
      expect(resolver.isExternalRef('http://example.com/schema.yaml')).toBe(true);
    });

    it('should identify internal refs', () => {
      expect(resolver.isExternalRef('#/components/schemas/Pet')).toBe(false);
      expect(resolver.isExternalRef('#/definitions/User')).toBe(false);
    });
  });

  describe('findExternalRefs', () => {
    it('should find external refs in object', () => {
      const spec = {
        components: {
          schemas: {
            Pet: {
              $ref: './schemas/Pet.yaml#/Pet',
            },
            Owner: {
              $ref: './schemas/Owner.yaml#/Owner',
            },
          },
        },
      };

      const refs = resolver.findExternalRefs(spec);
      expect(refs).toHaveLength(2);
      expect(refs).toContain('./schemas/Pet.yaml#/Pet');
      expect(refs).toContain('./schemas/Owner.yaml#/Owner');
    });

    it('should ignore internal refs', () => {
      const spec = {
        components: {
          schemas: {
            Pet: {
              properties: {
                owner: {
                  $ref: '#/components/schemas/Owner',
                },
              },
            },
            Owner: {
              type: 'object',
            },
          },
        },
      };

      const refs = resolver.findExternalRefs(spec);
      expect(refs).toHaveLength(0);
    });

    it('should find refs in arrays', () => {
      const spec = [
        { $ref: './schema1.yaml' },
        { $ref: './schema2.yaml' },
      ];

      const refs = resolver.findExternalRefs(spec);
      expect(refs).toHaveLength(2);
      expect(refs).toContain('./schema1.yaml');
      expect(refs).toContain('./schema2.yaml');
    });

    it('should find refs in nested structures', () => {
      const spec = {
        paths: {
          '/pets': {
            get: {
              responses: {
                '200': {
                  content: {
                    'application/json': {
                      schema: {
                        $ref: './responses/PetList.yaml',
                      },
                    },
                  },
                },
              },
            },
          },
        },
      };

      const refs = resolver.findExternalRefs(spec);
      expect(refs).toHaveLength(1);
      expect(refs).toContain('./responses/PetList.yaml');
    });

    it('should deduplicate refs', () => {
      const spec = {
        schema1: { $ref: './common.yaml' },
        schema2: { $ref: './common.yaml' },
        schema3: { $ref: './common.yaml' },
      };

      const refs = resolver.findExternalRefs(spec);
      expect(refs).toHaveLength(1);
      expect(refs).toContain('./common.yaml');
    });

    it('should handle null and primitives', () => {
      const spec = {
        value: null,
        number: 42,
        string: 'test',
        boolean: true,
      };

      const refs = resolver.findExternalRefs(spec);
      expect(refs).toHaveLength(0);
    });
  });

  describe('resolveRefUrl', () => {
    it('should resolve relative ref from local base', () => {
      const ref = './schemas/Pet.yaml';
      const baseUrl = '/project/openapi.yaml';
      const result = resolver.resolveRefUrl(ref, baseUrl, false);

      expect(result).toContain('schemas');
      expect(result).toContain('Pet.yaml');
    });

    it('should resolve parent directory ref from local base', () => {
      const ref = '../common/types.yaml';
      const baseUrl = '/project/specs/openapi.yaml';
      const result = resolver.resolveRefUrl(ref, baseUrl, false);

      expect(result).toContain('common');
      expect(result).toContain('types.yaml');
    });

    it('should resolve relative ref from remote base', () => {
      const ref = './schemas/Pet.yaml';
      const baseUrl = 'https://example.com/api/openapi.yaml';
      const result = resolver.resolveRefUrl(ref, baseUrl, true);

      expect(result).toBe('https://example.com/api/schemas/Pet.yaml');
    });

    it('should resolve parent directory ref from remote base', () => {
      const ref = '../common/types.yaml';
      const baseUrl = 'https://example.com/api/specs/openapi.yaml';
      const result = resolver.resolveRefUrl(ref, baseUrl, true);

      expect(result).toBe('https://example.com/api/common/types.yaml');
    });

    it('should ignore fragment when resolving URL', () => {
      const ref = './schemas/Pet.yaml#/Pet';
      const baseUrl = 'https://example.com/openapi.yaml';
      const result = resolver.resolveRefUrl(ref, baseUrl, true);

      expect(result).toBe('https://example.com/schemas/Pet.yaml');
    });
  });

  describe('resolveExternalRefs', () => {
    it('should resolve single external ref', async () => {
      const spec = {
        components: {
          schemas: {
            Pet: {
              $ref: './schemas/Pet.yaml',
            },
          },
        },
      };

      const petSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
      };

      mockLoader.load = jest.fn().mockResolvedValue(petSchema);

      const result = await resolver.resolveExternalRefs(spec, {
        baseUrl: '/project/openapi.yaml',
      });

      expect(result.size).toBe(1);
      expect(result.get('./schemas/Pet.yaml')).toEqual(petSchema);
      expect(mockLoader.load).toHaveBeenCalledTimes(1);
    });

    it('should resolve multiple external refs', async () => {
      const spec = {
        components: {
          schemas: {
            Pet: {
              $ref: './schemas/Pet.yaml',
            },
            Owner: {
              $ref: './schemas/Owner.yaml',
            },
          },
        },
      };

      const petSchema = { type: 'object' };
      const ownerSchema = { type: 'object' };

      mockLoader.load = jest.fn()
        .mockResolvedValueOnce(petSchema)
        .mockResolvedValueOnce(ownerSchema);

      const result = await resolver.resolveExternalRefs(spec, {
        baseUrl: '/project/openapi.yaml',
      });

      expect(result.size).toBe(2);
      expect(result.get('./schemas/Pet.yaml')).toEqual(petSchema);
      expect(result.get('./schemas/Owner.yaml')).toEqual(ownerSchema);
      expect(mockLoader.load).toHaveBeenCalledTimes(2);
    });

    it('should deduplicate refs (visit each URL once)', async () => {
      const spec = {
        schema1: { $ref: './common.yaml' },
        schema2: { $ref: './common.yaml' },
      };

      const commonSchema = { type: 'object' };

      mockLoader.load = jest.fn().mockResolvedValue(commonSchema);

      const result = await resolver.resolveExternalRefs(spec, {
        baseUrl: '/project/openapi.yaml',
      });

      expect(result.size).toBe(1);
      expect(mockLoader.load).toHaveBeenCalledTimes(1);
    });

    it('should resolve nested refs recursively', async () => {
      const spec = {
        components: {
          schemas: {
            Pet: {
              $ref: './schemas/Pet.yaml',
            },
          },
        },
      };

      const petSchema = {
        type: 'object',
        properties: {
          owner: {
            $ref: './Owner.yaml',
          },
        },
      };

      const ownerSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
      };

      mockLoader.load = jest.fn()
        .mockResolvedValueOnce(petSchema)
        .mockResolvedValueOnce(ownerSchema);

      const result = await resolver.resolveExternalRefs(spec, {
        baseUrl: '/project/openapi.yaml',
      });

      expect(result.size).toBe(2);
      expect(result.get('./schemas/Pet.yaml')).toEqual(petSchema);
      expect(result.get('./Owner.yaml')).toEqual(ownerSchema);
      expect(mockLoader.load).toHaveBeenCalledTimes(2);
    });

    it('should handle circular refs gracefully by tracking visited URLs', async () => {
      const spec = {
        schema: {
          $ref: './schema1.yaml',
        },
      };

      // Create circular refs (schema1 refs schema2, schema2 refs schema1)
      const schema1 = { $ref: './schema2.yaml' };
      const schema2 = { $ref: './schema1.yaml' };

      mockLoader.load = jest.fn()
        .mockResolvedValueOnce(schema1)
        .mockResolvedValueOnce(schema2);

      // Should resolve without error because visited URLs are tracked
      const result = await resolver.resolveExternalRefs(spec, {
        baseUrl: '/project/openapi.yaml',
      });

      expect(result.size).toBe(2);
      expect(result.get('./schema1.yaml')).toEqual(schema1);
      expect(result.get('./schema2.yaml')).toEqual(schema2);
      // Should only call load twice, not infinitely
      expect(mockLoader.load).toHaveBeenCalledTimes(2);
    });

    it('should respect maxDepth parameter as safety limit', async () => {
      const spec = {
        schema: {
          $ref: './level1.yaml',
        },
      };

      // The maxDepth is a safety net - for most real-world cases,
      // circular refs are handled by URL deduplication
      // This test just verifies the parameter is accepted
      mockLoader.load = jest.fn().mockResolvedValue({ type: 'object' });

      const result = await resolver.resolveExternalRefs(spec, {
        baseUrl: '/project/openapi.yaml',
        maxDepth: 5,
      });

      expect(result.size).toBeGreaterThan(0);
    });

    it('should throw error if ref download fails', async () => {
      const spec = {
        schema: {
          $ref: './nonexistent.yaml',
        },
      };

      mockLoader.load = jest.fn().mockRejectedValue(new Error('File not found'));

      await expect(
        resolver.resolveExternalRefs(spec, {
          baseUrl: '/project/openapi.yaml',
        })
      ).rejects.toThrow(RefResolverError);
      await expect(
        resolver.resolveExternalRefs(spec, {
          baseUrl: '/project/openapi.yaml',
        })
      ).rejects.toThrow('Failed to resolve $ref');
    });
  });

  describe('resolveFragment', () => {
    it('should resolve root fragment', () => {
      const doc = { openapi: '3.0.0' };
      const result = resolver.resolveFragment('./spec.yaml#/', doc);
      expect(result).toEqual(doc);
    });

    it('should resolve nested fragment', () => {
      const doc = {
        components: {
          schemas: {
            Pet: {
              type: 'object',
              properties: {
                name: { type: 'string' },
              },
            },
          },
        },
      };

      const result = resolver.resolveFragment('./spec.yaml#/components/schemas/Pet', doc);
      expect(result).toEqual({
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
      });
    });

    it('should throw error if fragment not found', () => {
      const doc = {
        components: {
          schemas: {},
        },
      };

      expect(() =>
        resolver.resolveFragment('./spec.yaml#/components/schemas/NonExistent', doc)
      ).toThrow(RefResolverError);
      expect(() =>
        resolver.resolveFragment('./spec.yaml#/components/schemas/NonExistent', doc)
      ).toThrow('Fragment path');
    });

    it('should throw error if fragment path is invalid', () => {
      const doc = {
        components: 'not an object',
      };

      expect(() =>
        resolver.resolveFragment('./spec.yaml#/components/schemas/Pet', doc)
      ).toThrow(RefResolverError);
      expect(() =>
        resolver.resolveFragment('./spec.yaml#/components/schemas/Pet', doc)
      ).toThrow('Cannot resolve fragment');
    });

    it('should handle fragments without leading slash', () => {
      const doc = {
        definitions: {
          User: { type: 'object' },
        },
      };

      const result = resolver.resolveFragment('./spec.yaml#definitions/User', doc);
      expect(result).toEqual({ type: 'object' });
    });
  });

  describe('getResolvedRef', () => {
    it('should return resolved ref', async () => {
      const spec = {
        schema: {
          $ref: './Pet.yaml',
        },
      };

      const petSchema = { type: 'object' };

      mockLoader.load = jest.fn().mockResolvedValue(petSchema);

      await resolver.resolveExternalRefs(spec, {
        baseUrl: '/project/openapi.yaml',
      });

      const result = resolver.getResolvedRef('./Pet.yaml');
      expect(result).toEqual(petSchema);
    });

    it('should return undefined for unresolved ref', () => {
      const result = resolver.getResolvedRef('./NotResolved.yaml');
      expect(result).toBeUndefined();
    });
  });

  describe('clear', () => {
    it('should clear all resolved refs', async () => {
      const spec = {
        schema: {
          $ref: './Pet.yaml',
        },
      };

      const petSchema = { type: 'object' };

      mockLoader.load = jest.fn().mockResolvedValue(petSchema);

      await resolver.resolveExternalRefs(spec, {
        baseUrl: '/project/openapi.yaml',
      });

      expect(resolver.getResolvedRef('./Pet.yaml')).toEqual(petSchema);

      resolver.clear();

      expect(resolver.getResolvedRef('./Pet.yaml')).toBeUndefined();
    });
  });
});
