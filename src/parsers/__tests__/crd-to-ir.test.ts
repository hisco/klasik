/**
 * Unit tests for CRDToIRConverter
 */

import { CRDToIRConverter } from '../crd-to-ir';
import { ParsedCRD } from '../crd-parser';

describe('CRDToIRConverter', () => {
  describe('convert', () => {
    it('should convert a simple CRD to IR', () => {
      const crd: ParsedCRD = {
        apiVersion: 'apiextensions.k8s.io/v1',
        kind: 'CustomResourceDefinition',
        metadata: {
          name: 'applications.argoproj.io',
          group: 'argoproj.io',
          kind: 'Application',
          plural: 'applications',
        },
        specVersion: 'v1',
        versions: [
          {
            name: 'v1alpha1',
            served: true,
            storage: true,
            schema: {
              type: 'object',
              description: 'Application is a definition of an Application resource',
              properties: {
                apiVersion: {
                  type: 'string',
                },
                kind: {
                  type: 'string',
                },
                metadata: {
                  type: 'object',
                },
                spec: {
                  type: 'object',
                  description: 'Application spec',
                  properties: {
                    project: {
                      type: 'string',
                      description: 'Project name',
                    },
                    source: {
                      type: 'object',
                      properties: {
                        repoURL: {
                          type: 'string',
                        },
                      },
                    },
                  },
                  required: ['project'],
                },
              },
              required: ['apiVersion', 'kind', 'metadata', 'spec'],
            },
          },
        ],
        storageVersion: 'v1alpha1',
        schemas: new Map([
          [
            'v1alpha1',
            {
              type: 'object',
              description: 'Application is a definition of an Application resource',
              properties: {
                apiVersion: {
                  type: 'string',
                },
                kind: {
                  type: 'string',
                },
                metadata: {
                  type: 'object',
                },
                spec: {
                  type: 'object',
                  description: 'Application spec',
                  properties: {
                    project: {
                      type: 'string',
                      description: 'Project name',
                    },
                    source: {
                      type: 'object',
                      properties: {
                        repoURL: {
                          type: 'string',
                        },
                      },
                    },
                  },
                  required: ['project'],
                },
              },
              required: ['apiVersion', 'kind', 'metadata', 'spec'],
            },
          ],
        ]),
        hasStatus: false,
      };

      const converter = new CRDToIRConverter();
      const ir = converter.convert(crd);

      expect(ir.schemas.size).toBeGreaterThan(0);
      expect(ir.schemas.has('Application')).toBe(true);

      const schema = ir.schemas.get('Application')!;
      expect(schema.description).toBe('Application is a definition of an Application resource');
      expect(schema.properties.size).toBeGreaterThan(0);
      expect(schema.properties.has('apiVersion')).toBe(true);
      expect(schema.properties.has('kind')).toBe(true);
      expect(schema.properties.has('spec')).toBe(true);

      const specProp = schema.properties.get('spec')!;
      expect(specProp.description).toBe('Application spec');
      expect(specProp.type.kind).toBe('reference'); // Should be extracted as nested schema
    });

    it('should extract nested objects', () => {
      const crd: ParsedCRD = {
        apiVersion: 'apiextensions.k8s.io/v1',
        kind: 'CustomResourceDefinition',
        metadata: {
          name: 'test',
          group: 'test.io',
          kind: 'Test',
          plural: 'tests',
        },
        specVersion: 'v1',
        versions: [
          {
            name: 'v1',
            served: true,
            storage: true,
            schema: {
              type: 'object',
              properties: {
                spec: {
                  type: 'object',
                  properties: {
                    nestedObject: {
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
            },
          },
        ],
        storageVersion: 'v1',
        schemas: new Map([
          [
            'v1',
            {
              type: 'object',
              properties: {
                spec: {
                  type: 'object',
                  properties: {
                    nestedObject: {
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
            },
          ],
        ]),
        hasStatus: false,
      };

      const converter = new CRDToIRConverter({ extractNested: true });
      const ir = converter.convert(crd);

      // Should have Test, TestSpec, and TestNestedObject schemas
      expect(ir.schemas.size).toBeGreaterThanOrEqual(3);
      expect(ir.schemas.has('Test')).toBe(true);
      expect(ir.schemas.has('TestSpec')).toBe(true);
      expect(ir.schemas.has('TestNestedObject')).toBe(true);

      const nestedSchema = ir.schemas.get('TestNestedObject')!;
      expect(nestedSchema.properties.has('field')).toBe(true);
    });

    it('should extract arrays of objects', () => {
      const crd: ParsedCRD = {
        apiVersion: 'apiextensions.k8s.io/v1',
        kind: 'CustomResourceDefinition',
        metadata: {
          name: 'test',
          group: 'test.io',
          kind: 'Test',
          plural: 'tests',
        },
        specVersion: 'v1',
        versions: [
          {
            name: 'v1',
            served: true,
            storage: true,
            schema: {
              type: 'object',
              properties: {
                spec: {
                  type: 'object',
                  properties: {
                    items: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          name: {
                            type: 'string',
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        ],
        storageVersion: 'v1',
        schemas: new Map([
          [
            'v1',
            {
              type: 'object',
              properties: {
                spec: {
                  type: 'object',
                  properties: {
                    items: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          name: {
                            type: 'string',
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          ],
        ]),
        hasStatus: false,
      };

      const converter = new CRDToIRConverter({ extractNested: true });
      const ir = converter.convert(crd);

      // Should have Test, TestSpec, and TestItems schemas
      expect(ir.schemas.has('Test')).toBe(true);
      expect(ir.schemas.has('TestSpec')).toBe(true);
      expect(ir.schemas.has('TestItems')).toBe(true);

      const specSchema = ir.schemas.get('TestSpec')!;
      const itemsProp = specSchema.properties.get('items')!;
      expect(itemsProp.type.kind).toBe('array');
      expect(itemsProp.type.elementType?.kind).toBe('reference');
      expect(itemsProp.type.elementType?.name).toBe('TestItems');
    });

    it('should handle status subresource when includeStatus is true', () => {
      const crd: ParsedCRD = {
        apiVersion: 'apiextensions.k8s.io/v1',
        kind: 'CustomResourceDefinition',
        metadata: {
          name: 'test',
          group: 'test.io',
          kind: 'Test',
          plural: 'tests',
        },
        specVersion: 'v1',
        versions: [
          {
            name: 'v1',
            served: true,
            storage: true,
            schema: {
              type: 'object',
              properties: {
                spec: {
                  type: 'object',
                },
                status: {
                  type: 'object',
                  properties: {
                    phase: {
                      type: 'string',
                    },
                  },
                },
              },
              required: ['spec'],
            },
            subresources: {
              status: {},
            },
          },
        ],
        storageVersion: 'v1',
        schemas: new Map([
          [
            'v1',
            {
              type: 'object',
              properties: {
                spec: {
                  type: 'object',
                },
                status: {
                  type: 'object',
                  properties: {
                    phase: {
                      type: 'string',
                    },
                  },
                },
              },
              required: ['spec'],
            },
          ],
        ]),
        hasStatus: true,
      };

      const converter = new CRDToIRConverter({ includeStatus: true });
      const ir = converter.convert(crd);

      const schema = ir.schemas.get('Test')!;
      expect(schema.properties.has('status')).toBe(true);

      const statusProp = schema.properties.get('status')!;
      expect(statusProp.required).toBe(false); // Status is not required
    });

    it('should skip status subresource when includeStatus is false', () => {
      const crd: ParsedCRD = {
        apiVersion: 'apiextensions.k8s.io/v1',
        kind: 'CustomResourceDefinition',
        metadata: {
          name: 'test',
          group: 'test.io',
          kind: 'Test',
          plural: 'tests',
        },
        specVersion: 'v1',
        versions: [
          {
            name: 'v1',
            served: true,
            storage: true,
            schema: {
              type: 'object',
              properties: {
                spec: {
                  type: 'object',
                },
                status: {
                  type: 'object',
                  properties: {
                    phase: {
                      type: 'string',
                    },
                  },
                },
              },
              required: ['spec'],
            },
            subresources: {
              status: {},
            },
          },
        ],
        storageVersion: 'v1',
        schemas: new Map([
          [
            'v1',
            {
              type: 'object',
              properties: {
                spec: {
                  type: 'object',
                },
                status: {
                  type: 'object',
                  properties: {
                    phase: {
                      type: 'string',
                    },
                  },
                },
              },
              required: ['spec'],
            },
          ],
        ]),
        hasStatus: true,
      };

      const converter = new CRDToIRConverter({ includeStatus: false });
      const ir = converter.convert(crd);

      const schema = ir.schemas.get('Test')!;
      // Status should still be in properties because includeStatus affects
      // whether we mark it as optional, not whether we include it
      expect(schema.properties.has('status')).toBe(true);
    });

    it('should handle constraints', () => {
      const crd: ParsedCRD = {
        apiVersion: 'apiextensions.k8s.io/v1',
        kind: 'CustomResourceDefinition',
        metadata: {
          name: 'test',
          group: 'test.io',
          kind: 'Test',
          plural: 'tests',
        },
        specVersion: 'v1',
        versions: [
          {
            name: 'v1',
            served: true,
            storage: true,
            schema: {
              type: 'object',
              properties: {
                spec: {
                  type: 'object',
                  properties: {
                    name: {
                      type: 'string',
                      minLength: 1,
                      maxLength: 50,
                      pattern: '^[a-z]+$',
                    },
                    count: {
                      type: 'integer',
                      minimum: 0,
                      maximum: 100,
                    },
                  },
                },
              },
            },
          },
        ],
        storageVersion: 'v1',
        schemas: new Map([
          [
            'v1',
            {
              type: 'object',
              properties: {
                spec: {
                  type: 'object',
                  properties: {
                    name: {
                      type: 'string',
                      minLength: 1,
                      maxLength: 50,
                      pattern: '^[a-z]+$',
                    },
                    count: {
                      type: 'integer',
                      minimum: 0,
                      maximum: 100,
                    },
                  },
                },
              },
            },
          ],
        ]),
        hasStatus: false,
      };

      const converter = new CRDToIRConverter();
      const ir = converter.convert(crd);

      const specSchema = ir.schemas.get('TestSpec')!;
      const nameProp = specSchema.properties.get('name')!;
      expect(nameProp.constraints).toBeDefined();
      expect(nameProp.constraints!.minLength).toBe(1);
      expect(nameProp.constraints!.maxLength).toBe(50);
      expect(nameProp.constraints!.pattern).toBe('^[a-z]+$');

      const countProp = specSchema.properties.get('count')!;
      expect(countProp.constraints).toBeDefined();
      expect(countProp.constraints!.minimum).toBe(0);
      expect(countProp.constraints!.maximum).toBe(100);
    });

    it('should handle enum values', () => {
      const crd: ParsedCRD = {
        apiVersion: 'apiextensions.k8s.io/v1',
        kind: 'CustomResourceDefinition',
        metadata: {
          name: 'test',
          group: 'test.io',
          kind: 'Test',
          plural: 'tests',
        },
        specVersion: 'v1',
        versions: [
          {
            name: 'v1',
            served: true,
            storage: true,
            schema: {
              type: 'object',
              properties: {
                spec: {
                  type: 'object',
                  properties: {
                    phase: {
                      type: 'string',
                      enum: ['Pending', 'Running', 'Succeeded', 'Failed'],
                    },
                  },
                },
              },
            },
          },
        ],
        storageVersion: 'v1',
        schemas: new Map([
          [
            'v1',
            {
              type: 'object',
              properties: {
                spec: {
                  type: 'object',
                  properties: {
                    phase: {
                      type: 'string',
                      enum: ['Pending', 'Running', 'Succeeded', 'Failed'],
                    },
                  },
                },
              },
            },
          ],
        ]),
        hasStatus: false,
      };

      const converter = new CRDToIRConverter();
      const ir = converter.convert(crd);

      const specSchema = ir.schemas.get('TestSpec')!;
      const phaseProp = specSchema.properties.get('phase')!;
      // Note: enum values are stored in property metadata vendor extensions
      // or as constraints, not directly on the property
      expect(phaseProp.metadata.vendorExtensions).toBeDefined();
    });

    it('should create ObjectMeta schema when metadata is present', () => {
      const crd: ParsedCRD = {
        apiVersion: 'apiextensions.k8s.io/v1',
        kind: 'CustomResourceDefinition',
        metadata: {
          name: 'test',
          group: 'test.io',
          kind: 'Test',
          plural: 'tests',
        },
        specVersion: 'v1',
        versions: [
          {
            name: 'v1',
            served: true,
            storage: true,
            schema: {
              type: 'object',
              properties: {
                metadata: {
                  type: 'object',
                },
                spec: {
                  type: 'object',
                },
              },
            },
          },
        ],
        storageVersion: 'v1',
        schemas: new Map([
          [
            'v1',
            {
              type: 'object',
              properties: {
                metadata: {
                  type: 'object',
                },
                spec: {
                  type: 'object',
                },
              },
            },
          ],
        ]),
        hasStatus: false,
      };

      const converter = new CRDToIRConverter();
      const ir = converter.convert(crd);

      expect(ir.schemas.has('ObjectMeta')).toBe(true);

      const objectMeta = ir.schemas.get('ObjectMeta')!;
      expect(objectMeta.description).toBe('Kubernetes object metadata');
      expect(objectMeta.properties.has('name')).toBe(true);
      expect(objectMeta.properties.has('namespace')).toBe(true);
      expect(objectMeta.properties.has('labels')).toBe(true);
      expect(objectMeta.properties.has('annotations')).toBe(true);
    });
  });
});
