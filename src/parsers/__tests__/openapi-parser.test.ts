import { OpenAPIParser, OpenAPISpec } from '../openapi-parser';

describe('OpenAPIParser', () => {
  let parser: OpenAPIParser;

  beforeEach(() => {
    parser = new OpenAPIParser();
  });

  describe('basic schema parsing', () => {
    it('should parse a simple object schema', () => {
      const spec: OpenAPISpec = {
        openapi: '3.0.0',
        info: {
          title: 'Test API',
          version: '1.0.0',
        },
        components: {
          schemas: {
            User: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                },
                name: {
                  type: 'string',
                },
                age: {
                  type: 'number',
                },
              },
              required: ['id', 'name'],
            },
          },
        },
      };

      const ir = parser.parse(spec);

      expect(ir.schemas.size).toBe(1);
      expect(ir.schemas.has('User')).toBe(true);

      const userSchema = ir.schemas.get('User')!;
      expect(userSchema.name).toBe('User');
      expect(userSchema.type).toBe('object');
      expect(userSchema.properties.size).toBe(3);

      // Check id property
      const idProp = userSchema.properties.get('id')!;
      expect(idProp.name).toBe('id');
      expect(idProp.type.kind).toBe('primitive');
      expect(idProp.type.name).toBe('string');
      expect(idProp.required).toBe(true);

      // Check name property
      const nameProp = userSchema.properties.get('name')!;
      expect(nameProp.required).toBe(true);

      // Check age property
      const ageProp = userSchema.properties.get('age')!;
      expect(ageProp.type.kind).toBe('primitive');
      expect(ageProp.type.name).toBe('number');
      expect(ageProp.required).toBe(false);
    });

    it('should parse schema with array properties', () => {
      const spec: OpenAPISpec = {
        openapi: '3.0.0',
        info: { title: 'Test', version: '1.0.0' },
        components: {
          schemas: {
            Team: {
              type: 'object',
              properties: {
                members: {
                  type: 'array',
                  items: {
                    type: 'string',
                  },
                },
              },
            },
          },
        },
      };

      const ir = parser.parse(spec);
      const teamSchema = ir.schemas.get('Team')!;
      const membersProp = teamSchema.properties.get('members')!;

      expect(membersProp.type.kind).toBe('array');
      expect(membersProp.type.elementType?.kind).toBe('primitive');
      expect(membersProp.type.elementType?.name).toBe('string');
    });

    it('should parse schema with $ref references', () => {
      const spec: OpenAPISpec = {
        openapi: '3.0.0',
        info: { title: 'Test', version: '1.0.0' },
        components: {
          schemas: {
            User: {
              type: 'object',
              properties: {
                id: { type: 'string' },
              },
            },
            Post: {
              type: 'object',
              properties: {
                author: {
                  $ref: '#/components/schemas/User',
                },
              },
            },
          },
        },
      };

      const ir = parser.parse(spec);
      const postSchema = ir.schemas.get('Post')!;
      const authorProp = postSchema.properties.get('author')!;

      expect(authorProp.type.kind).toBe('reference');
      expect(authorProp.type.name).toBe('User');
    });
  });

  describe('constraint parsing', () => {
    it('should parse string constraints', () => {
      const spec: OpenAPISpec = {
        openapi: '3.0.0',
        info: { title: 'Test', version: '1.0.0' },
        components: {
          schemas: {
            ValidatedString: {
              type: 'object',
              properties: {
                username: {
                  type: 'string',
                  minLength: 3,
                  maxLength: 20,
                  pattern: '^[a-zA-Z0-9]+$',
                },
              },
            },
          },
        },
      };

      const ir = parser.parse(spec);
      const schema = ir.schemas.get('ValidatedString')!;
      const prop = schema.properties.get('username')!;

      expect(prop.constraints).toBeDefined();
      expect(prop.constraints?.minLength).toBe(3);
      expect(prop.constraints?.maxLength).toBe(20);
      expect(prop.constraints?.pattern).toBe('^[a-zA-Z0-9]+$');
    });

    it('should parse number constraints', () => {
      const spec: OpenAPISpec = {
        openapi: '3.0.0',
        info: { title: 'Test', version: '1.0.0' },
        components: {
          schemas: {
            ValidatedNumber: {
              type: 'object',
              properties: {
                age: {
                  type: 'number',
                  minimum: 0,
                  maximum: 120,
                },
              },
            },
          },
        },
      };

      const ir = parser.parse(spec);
      const schema = ir.schemas.get('ValidatedNumber')!;
      const prop = schema.properties.get('age')!;

      expect(prop.constraints?.minimum).toBe(0);
      expect(prop.constraints?.maximum).toBe(120);
    });
  });

  describe('format handling', () => {
    it('should preserve format hints', () => {
      const spec: OpenAPISpec = {
        openapi: '3.0.0',
        info: { title: 'Test', version: '1.0.0' },
        components: {
          schemas: {
            Contact: {
              type: 'object',
              properties: {
                email: {
                  type: 'string',
                  format: 'email',
                },
                website: {
                  type: 'string',
                  format: 'uri',
                },
              },
            },
          },
        },
      };

      const ir = parser.parse(spec);
      const schema = ir.schemas.get('Contact')!;

      const emailProp = schema.properties.get('email')!;
      expect(emailProp.format).toBe('email');

      const websiteProp = schema.properties.get('website')!;
      expect(websiteProp.format).toBe('uri');
    });
  });

  describe('metadata parsing', () => {
    it('should parse global metadata', () => {
      const spec: OpenAPISpec = {
        openapi: '3.0.0',
        info: {
          title: 'My API',
          version: '2.0.0',
          description: 'A test API',
        },
        servers: [
          { url: 'https://api.example.com' },
        ],
        components: {
          schemas: {},
        },
      };

      const ir = parser.parse(spec);

      expect(ir.metadata.title).toBe('My API');
      expect(ir.metadata.version).toBe('2.0.0');
      expect(ir.metadata.description).toBe('A test API');
      expect(ir.metadata.servers).toEqual(['https://api.example.com']);
    });

    it('should parse vendor extensions', () => {
      const spec: OpenAPISpec = {
        openapi: '3.0.0',
        info: { title: 'Test', version: '1.0.0' },
        components: {
          schemas: {
            User: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  'x-custom': 'value',
                  'x-another': 123,
                },
              },
              'x-kubernetes-group': 'apps',
            },
          },
        },
      };

      const ir = parser.parse(spec);
      const schema = ir.schemas.get('User')!;

      expect(schema.metadata.vendorExtensions).toBeDefined();
      expect(schema.metadata.vendorExtensions?.['x-kubernetes-group']).toBe('apps');

      const nameProp = schema.properties.get('name')!;
      expect(nameProp.metadata.vendorExtensions?.['x-custom']).toBe('value');
      expect(nameProp.metadata.vendorExtensions?.['x-another']).toBe(123);
    });
  });

  describe('enum schema parsing', () => {
    it('should parse enum schema with string values', () => {
      const spec: OpenAPISpec = {
        openapi: '3.0.0',
        info: { title: 'Test', version: '1.0.0' },
        components: {
          schemas: {
            Status: {
              type: 'string',
              enum: ['active', 'inactive', 'pending'],
              description: 'User status',
            },
          },
        },
      };

      const ir = parser.parse(spec);
      const schema = ir.schemas.get('Status')!;

      expect(schema.type).toBe('enum');
      expect(schema.enumValues).toEqual(['active', 'inactive', 'pending']);
      expect(schema.description).toBe('User status');
    });

    it('should parse enum schema with numeric values', () => {
      const spec: OpenAPISpec = {
        openapi: '3.0.0',
        info: { title: 'Test', version: '1.0.0' },
        components: {
          schemas: {
            Priority: {
              type: 'number',
              enum: [1, 2, 3, 4, 5],
              description: 'Priority level',
            },
          },
        },
      };

      const ir = parser.parse(spec);
      const schema = ir.schemas.get('Priority')!;

      expect(schema.type).toBe('enum');
      expect(schema.enumValues).toEqual([1, 2, 3, 4, 5]);
    });

    it('should parse enum with mixed values', () => {
      const spec: OpenAPISpec = {
        openapi: '3.0.0',
        info: { title: 'Test', version: '1.0.0' },
        components: {
          schemas: {
            MixedEnum: {
              enum: ['value1', 2, 'value3', null],
            },
          },
        },
      };

      const ir = parser.parse(spec);
      const schema = ir.schemas.get('MixedEnum')!;

      expect(schema.type).toBe('enum');
      expect(schema.enumValues).toEqual(['value1', 2, 'value3', null]);
    });
  });

  describe('union schema parsing (oneOf/anyOf)', () => {
    it('should parse oneOf schema', () => {
      const spec: OpenAPISpec = {
        openapi: '3.0.0',
        info: { title: 'Test', version: '1.0.0' },
        components: {
          schemas: {
            Pet: {
              oneOf: [
                {
                  type: 'object',
                  properties: {
                    meow: { type: 'string' },
                  },
                },
                {
                  type: 'object',
                  properties: {
                    bark: { type: 'string' },
                  },
                },
              ],
            },
          },
        },
      };

      const ir = parser.parse(spec);
      const petSchema = ir.schemas.get('Pet')!;

      expect(petSchema.type).toBe('union');
      // Union merges properties from all types
      expect(petSchema.properties.has('meow')).toBe(true);
      expect(petSchema.properties.has('bark')).toBe(true);
    });

    it('should parse anyOf schema', () => {
      const spec: OpenAPISpec = {
        openapi: '3.0.0',
        info: { title: 'Test', version: '1.0.0' },
        components: {
          schemas: {
            MultiType: {
              anyOf: [
                {
                  type: 'object',
                  properties: {
                    stringField: { type: 'string' },
                  },
                },
                {
                  type: 'object',
                  properties: {
                    numberField: { type: 'number' },
                  },
                },
              ],
            },
          },
        },
      };

      const ir = parser.parse(spec);
      const schema = ir.schemas.get('MultiType')!;

      expect(schema.type).toBe('union');
      expect(schema.properties.has('stringField')).toBe(true);
      expect(schema.properties.has('numberField')).toBe(true);
    });
  });

  describe('operation parsing', () => {
    it('should parse GET operation with path parameters', () => {
      const spec: OpenAPISpec = {
        openapi: '3.0.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: {
          '/users/{id}': {
            get: {
              operationId: 'getUser',
              summary: 'Get user by ID',
              parameters: [
                {
                  name: 'id',
                  in: 'path' as const,
                  required: true,
                  schema: { type: 'string' },
                },
              ],
              responses: {
                '200': {
                  description: 'Success',
                },
              },
            },
          },
        },
      };

      const ir = parser.parse(spec, { includeOperations: true });

      expect(ir.operations.size).toBe(1);
      expect(ir.operations.has('getUser')).toBe(true);

      const operation = ir.operations.get('getUser')!;
      expect(operation.method).toBe('GET');
      expect(operation.path).toBe('/users/{id}');
      expect(operation.summary).toBe('Get user by ID');
      expect(operation.parameters.length).toBe(1);
      expect(operation.parameters[0].name).toBe('id');
      expect(operation.parameters[0].in).toBe('path');
      expect(operation.parameters[0].required).toBe(true);
    });

    it('should parse POST operation with request body', () => {
      const spec: OpenAPISpec = {
        openapi: '3.0.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: {
          '/users': {
            post: {
              operationId: 'createUser',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                      },
                    },
                  },
                },
              },
              responses: {
                '201': {
                  description: 'Created',
                },
              },
            },
          },
        },
      };

      const ir = parser.parse(spec, { includeOperations: true });

      const operation = ir.operations.get('createUser')!;
      expect(operation.method).toBe('POST');
      expect(operation.requestBody).toBeDefined();
      expect(operation.requestBody?.required).toBe(true);
      expect(operation.requestBody?.content.size).toBe(1);
      expect(operation.requestBody?.content.has('application/json')).toBe(true);
    });

    it('should parse multiple HTTP methods on same path', () => {
      const spec: OpenAPISpec = {
        openapi: '3.0.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: {
          '/users': {
            get: {
              operationId: 'listUsers',
              responses: { '200': { description: 'OK' } },
            },
            post: {
              operationId: 'createUser',
              responses: { '201': { description: 'Created' } },
            },
            delete: {
              operationId: 'deleteAllUsers',
              responses: { '204': { description: 'No Content' } },
            },
          },
        },
      };

      const ir = parser.parse(spec, { includeOperations: true });

      expect(ir.operations.size).toBe(3);
      expect(ir.operations.has('listUsers')).toBe(true);
      expect(ir.operations.has('createUser')).toBe(true);
      expect(ir.operations.has('deleteAllUsers')).toBe(true);
    });

    it('should generate operationId when not provided', () => {
      const spec: OpenAPISpec = {
        openapi: '3.0.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: {
          '/health': {
            get: {
              // No operationId
              responses: { '200': { description: 'OK' } },
            },
          },
        },
      };

      const ir = parser.parse(spec, { includeOperations: true });

      expect(ir.operations.size).toBe(1);
      // Generated operationId should be like "gethealth"
      const [operationId] = ir.operations.keys();
      expect(operationId).toMatch(/get/i);
      expect(operationId).toMatch(/health/i);
    });

    it('should parse query parameters', () => {
      const spec: OpenAPISpec = {
        openapi: '3.0.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: {
          '/users': {
            get: {
              operationId: 'searchUsers',
              parameters: [
                {
                  name: 'q',
                  in: 'query' as const,
                  description: 'Search query',
                  required: false,
                  schema: { type: 'string' },
                },
                {
                  name: 'limit',
                  in: 'query' as const,
                  schema: { type: 'number' },
                },
              ],
              responses: { '200': { description: 'OK' } },
            },
          },
        },
      };

      const ir = parser.parse(spec, { includeOperations: true });

      const operation = ir.operations.get('searchUsers')!;
      expect(operation.parameters.length).toBe(2);
      expect(operation.parameters[0].in).toBe('query');
      expect(operation.parameters[0].required).toBe(false);
      expect(operation.parameters[1].in).toBe('query');
    });

    it('should parse multiple response status codes', () => {
      const spec: OpenAPISpec = {
        openapi: '3.0.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: {
          '/users/{id}': {
            get: {
              operationId: 'getUser',
              parameters: [
                { name: 'id', in: 'path' as const, required: true, schema: { type: 'string' } },
              ],
              responses: {
                '200': { description: 'Success' },
                '404': { description: 'Not Found' },
                '500': { description: 'Server Error' },
              },
            },
          },
        },
      };

      const ir = parser.parse(spec, { includeOperations: true });

      const operation = ir.operations.get('getUser')!;
      expect(operation.responses.size).toBe(3);
      expect(operation.responses.has('200')).toBe(true);
      expect(operation.responses.has('404')).toBe(true);
      expect(operation.responses.has('500')).toBe(true);
    });

    it('should parse operation tags', () => {
      const spec: OpenAPISpec = {
        openapi: '3.0.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: {
          '/users': {
            get: {
              operationId: 'listUsers',
              tags: ['users', 'public'],
              responses: { '200': { description: 'OK' } },
            },
          },
        },
      };

      const ir = parser.parse(spec, { includeOperations: true });

      const operation = ir.operations.get('listUsers')!;
      expect(operation.tags).toEqual(['users', 'public']);
    });

    it('should handle deprecated operations', () => {
      const spec: OpenAPISpec = {
        openapi: '3.0.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: {
          '/legacy': {
            get: {
              operationId: 'legacyEndpoint',
              deprecated: true,
              responses: { '200': { description: 'OK' } },
            },
          },
        },
      };

      const ir = parser.parse(spec, { includeOperations: true });

      const operation = ir.operations.get('legacyEndpoint')!;
      expect(operation.deprecated).toBe(true);
    });

    it('should parse PUT operation', () => {
      const spec: OpenAPISpec = {
        openapi: '3.0.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: {
          '/users/{id}': {
            put: {
              operationId: 'updateUser',
              parameters: [
                { name: 'id', in: 'path' as const, required: true, schema: { type: 'string' } },
              ],
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: { type: 'object' },
                  },
                },
              },
              responses: { '200': { description: 'Updated' } },
            },
          },
        },
      };

      const ir = parser.parse(spec, { includeOperations: true });

      const operation = ir.operations.get('updateUser')!;
      expect(operation.method).toBe('PUT');
      expect(operation.requestBody?.required).toBe(true);
    });

    it('should parse PATCH operation', () => {
      const spec: OpenAPISpec = {
        openapi: '3.0.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: {
          '/users/{id}': {
            patch: {
              operationId: 'patchUser',
              responses: { '200': { description: 'Patched' } },
            },
          },
        },
      };

      const ir = parser.parse(spec, { includeOperations: true });

      const operation = ir.operations.get('patchUser')!;
      expect(operation.method).toBe('PATCH');
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle schema without type field', () => {
      const spec: OpenAPISpec = {
        openapi: '3.0.0',
        info: { title: 'Test', version: '1.0.0' },
        components: {
          schemas: {
            NoType: {
              properties: {
                name: { type: 'string' },
              },
            },
          },
        },
      };

      const ir = parser.parse(spec);

      // Should treat as object by default
      const schema = ir.schemas.get('NoType')!;
      expect(schema).toBeDefined();
      expect(schema.type).toBe('object');
    });

    it('should handle exclusiveMinimum and exclusiveMaximum', () => {
      const spec: OpenAPISpec = {
        openapi: '3.0.0',
        info: { title: 'Test', version: '1.0.0' },
        components: {
          schemas: {
            RangedNumber: {
              type: 'object',
              properties: {
                value: {
                  type: 'number',
                  minimum: 0,
                  exclusiveMinimum: true,
                  maximum: 100,
                  exclusiveMaximum: true,
                },
              },
            },
          },
        },
      };

      const ir = parser.parse(spec);
      const schema = ir.schemas.get('RangedNumber')!;
      const valueProp = schema.properties.get('value')!;

      expect(valueProp.constraints?.minimum).toBe(0);
      expect(valueProp.constraints?.maximum).toBe(100);
      expect(valueProp.constraints?.exclusiveMinimum).toBe(true);
      expect(valueProp.constraints?.exclusiveMaximum).toBe(true);
    });

    it('should parse multipleOf constraint', () => {
      const spec: OpenAPISpec = {
        openapi: '3.0.0',
        info: { title: 'Test', version: '1.0.0' },
        components: {
          schemas: {
            MultipleNumber: {
              type: 'object',
              properties: {
                value: {
                  type: 'number',
                  multipleOf: 5,
                },
              },
            },
          },
        },
      };

      const ir = parser.parse(spec);
      const schema = ir.schemas.get('MultipleNumber')!;
      const valueProp = schema.properties.get('value')!;

      expect(valueProp.constraints?.multipleOf).toBe(5);
    });

    it('should handle array constraints', () => {
      const spec: OpenAPISpec = {
        openapi: '3.0.0',
        info: { title: 'Test', version: '1.0.0' },
        components: {
          schemas: {
            ConstrainedArray: {
              type: 'object',
              properties: {
                items: {
                  type: 'array',
                  items: { type: 'string' },
                  minItems: 1,
                  maxItems: 10,
                  uniqueItems: true,
                },
              },
            },
          },
        },
      };

      const ir = parser.parse(spec);
      const schema = ir.schemas.get('ConstrainedArray')!;
      const itemsProp = schema.properties.get('items')!;

      expect(itemsProp.constraints?.minItems).toBe(1);
      expect(itemsProp.constraints?.maxItems).toBe(10);
      expect(itemsProp.constraints?.uniqueItems).toBe(true);
    });

    it('should handle empty paths when includeOperations is true', () => {
      const spec: OpenAPISpec = {
        openapi: '3.0.0',
        info: { title: 'Test', version: '1.0.0' },
      };

      const ir = parser.parse(spec, { includeOperations: true });

      expect(ir.operations.size).toBe(0);
    });

    it('should handle operations=false by default', () => {
      const spec: OpenAPISpec = {
        openapi: '3.0.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: {
          '/users': {
            get: {
              operationId: 'listUsers',
              responses: { '200': { description: 'OK' } },
            },
          },
        },
      };

      const ir = parser.parse(spec); // No includeOperations option

      expect(ir.operations.size).toBe(0);
    });
  });
});
