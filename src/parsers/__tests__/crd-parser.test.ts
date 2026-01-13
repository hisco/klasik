/**
 * Unit tests for CRDParser
 */

import { CRDParser } from '../crd-parser';

describe('CRDParser', () => {
  let parser: CRDParser;

  beforeEach(() => {
    parser = new CRDParser();
  });

  describe('validateCRD', () => {
    it('should validate a valid v1 CRD', () => {
      const crd = {
        apiVersion: 'apiextensions.k8s.io/v1',
        kind: 'CustomResourceDefinition',
        metadata: {
          name: 'applications.argoproj.io',
        },
        spec: {
          group: 'argoproj.io',
          names: {
            kind: 'Application',
            plural: 'applications',
          },
          versions: [
            {
              name: 'v1alpha1',
              served: true,
              storage: true,
            },
          ],
        },
      };

      const result = parser.validateCRD(crd);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid kind', () => {
      const crd = {
        apiVersion: 'apiextensions.k8s.io/v1',
        kind: 'WrongKind',
        metadata: {
          name: 'test',
        },
        spec: {
          group: 'test.io',
          names: {
            kind: 'Test',
            plural: 'tests',
          },
          versions: [{ name: 'v1', served: true, storage: true }],
        },
      };

      const result = parser.validateCRD(crd);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Expected kind "CustomResourceDefinition", got "WrongKind"');
    });

    it('should reject missing metadata', () => {
      const crd = {
        apiVersion: 'apiextensions.k8s.io/v1',
        kind: 'CustomResourceDefinition',
        spec: {
          group: 'test.io',
          names: {
            kind: 'Test',
            plural: 'tests',
          },
          versions: [{ name: 'v1', served: true, storage: true }],
        },
      };

      const result = parser.validateCRD(crd);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing or invalid metadata');
    });

    it('should reject missing spec', () => {
      const crd = {
        apiVersion: 'apiextensions.k8s.io/v1',
        kind: 'CustomResourceDefinition',
        metadata: {
          name: 'test',
        },
      };

      const result = parser.validateCRD(crd);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing or invalid spec');
    });

    it('should reject missing group', () => {
      const crd = {
        apiVersion: 'apiextensions.k8s.io/v1',
        kind: 'CustomResourceDefinition',
        metadata: {
          name: 'test',
        },
        spec: {
          names: {
            kind: 'Test',
            plural: 'tests',
          },
          versions: [{ name: 'v1', served: true, storage: true }],
        },
      };

      const result = parser.validateCRD(crd);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing or invalid spec.group');
    });

    it('should reject missing names', () => {
      const crd = {
        apiVersion: 'apiextensions.k8s.io/v1',
        kind: 'CustomResourceDefinition',
        metadata: {
          name: 'test',
        },
        spec: {
          group: 'test.io',
          versions: [{ name: 'v1', served: true, storage: true }],
        },
      };

      const result = parser.validateCRD(crd);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing or invalid spec.names');
    });

    it('should reject empty versions array', () => {
      const crd = {
        apiVersion: 'apiextensions.k8s.io/v1',
        kind: 'CustomResourceDefinition',
        metadata: {
          name: 'test',
        },
        spec: {
          group: 'test.io',
          names: {
            kind: 'Test',
            plural: 'tests',
          },
          versions: [],
        },
      };

      const result = parser.validateCRD(crd);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing or empty spec.versions');
    });

    it('should reject multiple storage versions', () => {
      const crd = {
        apiVersion: 'apiextensions.k8s.io/v1',
        kind: 'CustomResourceDefinition',
        metadata: {
          name: 'test',
        },
        spec: {
          group: 'test.io',
          names: {
            kind: 'Test',
            plural: 'tests',
          },
          versions: [
            { name: 'v1', served: true, storage: true },
            { name: 'v2', served: true, storage: true },
          ],
        },
      };

      const result = parser.validateCRD(crd);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Multiple versions marked as storage version');
    });

    it('should reject no storage version', () => {
      const crd = {
        apiVersion: 'apiextensions.k8s.io/v1',
        kind: 'CustomResourceDefinition',
        metadata: {
          name: 'test',
        },
        spec: {
          group: 'test.io',
          names: {
            kind: 'Test',
            plural: 'tests',
          },
          versions: [
            { name: 'v1', served: true, storage: false },
            { name: 'v2', served: true, storage: false },
          ],
        },
      };

      const result = parser.validateCRD(crd);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('No version marked as storage version');
    });
  });

  describe('parse', () => {
    it('should parse a simple v1 CRD', () => {
      const crd = {
        apiVersion: 'apiextensions.k8s.io/v1',
        kind: 'CustomResourceDefinition',
        metadata: {
          name: 'applications.argoproj.io',
        },
        spec: {
          group: 'argoproj.io',
          names: {
            kind: 'Application',
            plural: 'applications',
            singular: 'application',
            shortNames: ['app', 'apps'],
          },
          versions: [
            {
              name: 'v1alpha1',
              served: true,
              storage: true,
              schema: {
                openAPIV3Schema: {
                  type: 'object',
                  properties: {
                    spec: {
                      type: 'object',
                      properties: {
                        project: {
                          type: 'string',
                        },
                      },
                    },
                  },
                },
              },
            },
          ],
        },
      };

      const result = parser.parse(crd);
      expect(result).toHaveLength(1);

      const parsed = result[0];
      expect(parsed.apiVersion).toBe('apiextensions.k8s.io/v1');
      expect(parsed.kind).toBe('CustomResourceDefinition');
      expect(parsed.metadata.name).toBe('applications.argoproj.io');
      expect(parsed.metadata.group).toBe('argoproj.io');
      expect(parsed.metadata.kind).toBe('Application');
      expect(parsed.metadata.plural).toBe('applications');
      expect(parsed.metadata.singular).toBe('application');
      expect(parsed.metadata.shortNames).toEqual(['app', 'apps']);
      expect(parsed.versions).toHaveLength(1);
      expect(parsed.versions[0].name).toBe('v1alpha1');
      expect(parsed.versions[0].served).toBe(true);
      expect(parsed.versions[0].storage).toBe(true);
      expect(parsed.storageVersion).toBe('v1alpha1');
      expect(parsed.schemas.size).toBe(1);
      expect(parsed.schemas.has('v1alpha1')).toBe(true);
    });

    it('should parse multiple CRDs from array', () => {
      const crds = [
        {
          apiVersion: 'apiextensions.k8s.io/v1',
          kind: 'CustomResourceDefinition',
          metadata: {
            name: 'applications.argoproj.io',
          },
          spec: {
            group: 'argoproj.io',
            names: {
              kind: 'Application',
              plural: 'applications',
            },
            versions: [
              {
                name: 'v1alpha1',
                served: true,
                storage: true,
              },
            ],
          },
        },
        {
          apiVersion: 'apiextensions.k8s.io/v1',
          kind: 'CustomResourceDefinition',
          metadata: {
            name: 'appprojects.argoproj.io',
          },
          spec: {
            group: 'argoproj.io',
            names: {
              kind: 'AppProject',
              plural: 'appprojects',
            },
            versions: [
              {
                name: 'v1alpha1',
                served: true,
                storage: true,
              },
            ],
          },
        },
      ];

      const result = parser.parse(crds);
      expect(result).toHaveLength(2);
      expect(result[0].metadata.kind).toBe('Application');
      expect(result[1].metadata.kind).toBe('AppProject');
    });

    it('should skip invalid CRDs in non-strict mode', () => {
      const crds = [
        {
          apiVersion: 'apiextensions.k8s.io/v1',
          kind: 'CustomResourceDefinition',
          metadata: {
            name: 'valid.example.com',
          },
          spec: {
            group: 'example.com',
            names: {
              kind: 'Valid',
              plural: 'valids',
            },
            versions: [
              {
                name: 'v1',
                served: true,
                storage: true,
              },
            ],
          },
        },
        {
          apiVersion: 'apiextensions.k8s.io/v1',
          kind: 'CustomResourceDefinition',
          // Missing metadata - invalid
          spec: {
            group: 'example.com',
            names: {
              kind: 'Invalid',
              plural: 'invalids',
            },
            versions: [
              {
                name: 'v1',
                served: true,
                storage: true,
              },
            ],
          },
        },
      ];

      const result = parser.parse(crds);
      expect(result).toHaveLength(1);
      expect(result[0].metadata.kind).toBe('Valid');
    });

    it('should throw error for invalid CRD in strict mode', () => {
      const crd = {
        apiVersion: 'apiextensions.k8s.io/v1',
        kind: 'CustomResourceDefinition',
        // Missing spec - invalid
        metadata: {
          name: 'invalid',
        },
      };

      expect(() => parser.parse(crd, { strict: true })).toThrow('Invalid CRD');
    });
  });

  describe('hasStatusSubresource', () => {
    it('should detect status subresource in v1 CRD', () => {
      const crd = {
        apiVersion: 'apiextensions.k8s.io/v1',
        kind: 'CustomResourceDefinition',
        metadata: {
          name: 'test',
        },
        spec: {
          group: 'test.io',
          names: {
            kind: 'Test',
            plural: 'tests',
          },
          versions: [
            {
              name: 'v1',
              served: true,
              storage: true,
              subresources: {
                status: {},
              },
            },
          ],
        },
      };

      expect(parser.hasStatusSubresource(crd)).toBe(true);
    });

    it('should detect no status subresource', () => {
      const crd = {
        apiVersion: 'apiextensions.k8s.io/v1',
        kind: 'CustomResourceDefinition',
        metadata: {
          name: 'test',
        },
        spec: {
          group: 'test.io',
          names: {
            kind: 'Test',
            plural: 'tests',
          },
          versions: [
            {
              name: 'v1',
              served: true,
              storage: true,
            },
          ],
        },
      };

      expect(parser.hasStatusSubresource(crd)).toBe(false);
    });

    it('should detect status in specific version', () => {
      const crd = {
        apiVersion: 'apiextensions.k8s.io/v1',
        kind: 'CustomResourceDefinition',
        metadata: {
          name: 'test',
        },
        spec: {
          group: 'test.io',
          names: {
            kind: 'Test',
            plural: 'tests',
          },
          versions: [
            {
              name: 'v1',
              served: true,
              storage: false,
              subresources: {
                status: {},
              },
            },
            {
              name: 'v2',
              served: true,
              storage: true,
            },
          ],
        },
      };

      expect(parser.hasStatusSubresource(crd, 'v1')).toBe(true);
      expect(parser.hasStatusSubresource(crd, 'v2')).toBe(false);
    });
  });

  describe('findStorageVersion', () => {
    it('should find storage version', () => {
      const crd = {
        apiVersion: 'apiextensions.k8s.io/v1',
        kind: 'CustomResourceDefinition',
        metadata: {
          name: 'test',
        },
        spec: {
          group: 'test.io',
          names: {
            kind: 'Test',
            plural: 'tests',
          },
          versions: [
            {
              name: 'v1alpha1',
              served: true,
              storage: false,
            },
            {
              name: 'v1',
              served: true,
              storage: true,
            },
          ],
        },
      };

      expect(parser.findStorageVersion(crd)).toBe('v1');
    });

    it('should default to first version if none marked as storage', () => {
      const crd = {
        apiVersion: 'apiextensions.k8s.io/v1',
        kind: 'CustomResourceDefinition',
        metadata: {
          name: 'test',
        },
        spec: {
          group: 'test.io',
          names: {
            kind: 'Test',
            plural: 'tests',
          },
          versions: [
            {
              name: 'v1alpha1',
              served: true,
              storage: false,
            },
          ],
        },
      };

      expect(parser.findStorageVersion(crd)).toBe('v1alpha1');
    });
  });

  describe('validateCRD - additional coverage', () => {
    it('should reject null CRD', () => {
      const result = parser.validateCRD(null);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('CRD must be an object');
    });

    it('should reject non-object CRD', () => {
      const result = parser.validateCRD('not an object' as any);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('CRD must be an object');
    });

    it('should reject missing apiVersion', () => {
      const crd = {
        kind: 'CustomResourceDefinition',
        metadata: {
          name: 'test',
        },
        spec: {
          group: 'test.io',
          names: {
            kind: 'Test',
            plural: 'tests',
          },
          versions: [{ name: 'v1', served: true, storage: true }],
        },
      };

      const result = parser.validateCRD(crd);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing or invalid apiVersion');
    });

    it('should warn on unexpected apiVersion', () => {
      const crd = {
        apiVersion: 'custom.io/v1',
        kind: 'CustomResourceDefinition',
        metadata: {
          name: 'test',
        },
        spec: {
          group: 'test.io',
          names: {
            kind: 'Test',
            plural: 'tests',
          },
          versions: [{ name: 'v1', served: true, storage: true }],
        },
      };

      const result = parser.validateCRD(crd);
      expect(result.warnings).toContain('Unexpected apiVersion: custom.io/v1');
    });

    it('should reject missing metadata.name', () => {
      const crd = {
        apiVersion: 'apiextensions.k8s.io/v1',
        kind: 'CustomResourceDefinition',
        metadata: {},
        spec: {
          group: 'test.io',
          names: {
            kind: 'Test',
            plural: 'tests',
          },
          versions: [{ name: 'v1', served: true, storage: true }],
        },
      };

      const result = parser.validateCRD(crd);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing or invalid metadata.name');
    });

    it('should reject missing spec.names.kind', () => {
      const crd = {
        apiVersion: 'apiextensions.k8s.io/v1',
        kind: 'CustomResourceDefinition',
        metadata: {
          name: 'test',
        },
        spec: {
          group: 'test.io',
          names: {
            plural: 'tests',
          },
          versions: [{ name: 'v1', served: true, storage: true }],
        },
      };

      const result = parser.validateCRD(crd);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing or invalid spec.names.kind');
    });

    it('should reject missing spec.names.plural', () => {
      const crd = {
        apiVersion: 'apiextensions.k8s.io/v1',
        kind: 'CustomResourceDefinition',
        metadata: {
          name: 'test',
        },
        spec: {
          group: 'test.io',
          names: {
            kind: 'Test',
          },
          versions: [{ name: 'v1', served: true, storage: true }],
        },
      };

      const result = parser.validateCRD(crd);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing or invalid spec.names.plural');
    });

    it('should reject version with missing name', () => {
      const crd = {
        apiVersion: 'apiextensions.k8s.io/v1',
        kind: 'CustomResourceDefinition',
        metadata: {
          name: 'test',
        },
        spec: {
          group: 'test.io',
          names: {
            kind: 'Test',
            plural: 'tests',
          },
          versions: [{ served: true, storage: true }],
        },
      };

      const result = parser.validateCRD(crd);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Version 0: missing or invalid name');
    });

    it('should warn on version with missing served flag', () => {
      const crd = {
        apiVersion: 'apiextensions.k8s.io/v1',
        kind: 'CustomResourceDefinition',
        metadata: {
          name: 'test',
        },
        spec: {
          group: 'test.io',
          names: {
            kind: 'Test',
            plural: 'tests',
          },
          versions: [{ name: 'v1', storage: true }],
        },
      };

      const result = parser.validateCRD(crd);
      expect(result.warnings).toContain('Version 0 (v1): missing or invalid served flag');
    });

    it('should warn on version with missing storage flag', () => {
      const crd = {
        apiVersion: 'apiextensions.k8s.io/v1',
        kind: 'CustomResourceDefinition',
        metadata: {
          name: 'test',
        },
        spec: {
          group: 'test.io',
          names: {
            kind: 'Test',
            plural: 'tests',
          },
          versions: [{ name: 'v1', served: true }],
        },
      };

      const result = parser.validateCRD(crd);
      expect(result.warnings).toContain('Version 0 (v1): missing or invalid storage flag');
    });
  });

  describe('v1beta1 support', () => {
    it('should detect v1beta1 spec version', () => {
      const crd = {
        apiVersion: 'apiextensions.k8s.io/v1beta1',
        kind: 'CustomResourceDefinition',
        metadata: {
          name: 'tests.example.com',
        },
        spec: {
          group: 'example.com',
          names: {
            kind: 'Test',
            plural: 'tests',
          },
          versions: [{
            name: 'v1alpha1',
            served: true,
            storage: true,
          }],
        },
      };

      const result = parser.parse(crd);
      expect(result).toHaveLength(1);
      expect(result[0].specVersion).toBe('v1beta1');
    });

    it('should parse v1beta1 CRD with versions array', () => {
      const crd = {
        apiVersion: 'apiextensions.k8s.io/v1beta1',
        kind: 'CustomResourceDefinition',
        metadata: {
          name: 'tests.example.com',
        },
        spec: {
          group: 'example.com',
          names: {
            kind: 'Test',
            plural: 'tests',
          },
          versions: [{
            name: 'v1alpha1',
            served: true,
            storage: true,
            schema: {
              openAPIV3Schema: {
                type: 'object',
                properties: {
                  spec: {
                    type: 'object',
                    properties: {
                      field: {
                        type: 'string',
                      },
                    },
                  },
                },
              },
            },
          }],
        },
      };

      const result = parser.parse(crd);
      expect(result).toHaveLength(1);
      expect(result[0].versions).toHaveLength(1);
      expect(result[0].versions[0].name).toBe('v1alpha1');
      expect(result[0].versions[0].schema).toBeDefined();
    });

    it('should detect status subresource in v1beta1 CRD with single version', () => {
      const crd = {
        apiVersion: 'apiextensions.k8s.io/v1beta1',
        kind: 'CustomResourceDefinition',
        metadata: {
          name: 'tests.example.com',
        },
        spec: {
          group: 'example.com',
          names: {
            kind: 'Test',
            plural: 'tests',
          },
          version: 'v1alpha1',
          subresources: {
            status: {},
          },
        },
      };

      expect(parser.hasStatusSubresource(crd)).toBe(true);
    });

    it('should detect no status subresource in v1beta1 CRD', () => {
      const crd = {
        apiVersion: 'apiextensions.k8s.io/v1beta1',
        kind: 'CustomResourceDefinition',
        metadata: {
          name: 'tests.example.com',
        },
        spec: {
          group: 'example.com',
          names: {
            kind: 'Test',
            plural: 'tests',
          },
          version: 'v1alpha1',
        },
      };

      expect(parser.hasStatusSubresource(crd)).toBe(false);
    });
  });

});
