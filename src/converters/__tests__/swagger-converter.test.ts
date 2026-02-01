/**
 * Unit tests for SwaggerConverter
 */

import { SwaggerConverter, SwaggerConversionError } from '../swagger-converter';

describe('SwaggerConverter', () => {
  let converter: SwaggerConverter;

  beforeEach(() => {
    converter = new SwaggerConverter();
  });

  describe('isSwagger2', () => {
    it('should return true for Swagger 2.0 spec', () => {
      const spec = { swagger: '2.0', info: { title: 'Test', version: '1.0' } };
      expect(SwaggerConverter.isSwagger2(spec)).toBe(true);
    });

    it('should return false for OpenAPI 3.0 spec', () => {
      const spec = { openapi: '3.0.0', info: { title: 'Test', version: '1.0' } };
      expect(SwaggerConverter.isSwagger2(spec)).toBe(false);
    });

    it('should return false for OpenAPI 3.1 spec', () => {
      const spec = { openapi: '3.1.0', info: { title: 'Test', version: '1.0' } };
      expect(SwaggerConverter.isSwagger2(spec)).toBe(false);
    });

    it('should return false for null', () => {
      expect(SwaggerConverter.isSwagger2(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(SwaggerConverter.isSwagger2(undefined)).toBe(false);
    });

    it('should return false for empty object', () => {
      expect(SwaggerConverter.isSwagger2({})).toBe(false);
    });

    it('should return false for wrong swagger version', () => {
      const spec = { swagger: '1.0' };
      expect(SwaggerConverter.isSwagger2(spec)).toBe(false);
    });
  });

  describe('isOpenAPI3', () => {
    it('should return true for OpenAPI 3.0 spec', () => {
      const spec = { openapi: '3.0.0' };
      expect(SwaggerConverter.isOpenAPI3(spec)).toBe(true);
    });

    it('should return true for OpenAPI 3.0.3 spec', () => {
      const spec = { openapi: '3.0.3' };
      expect(SwaggerConverter.isOpenAPI3(spec)).toBe(true);
    });

    it('should return true for OpenAPI 3.1.0 spec', () => {
      const spec = { openapi: '3.1.0' };
      expect(SwaggerConverter.isOpenAPI3(spec)).toBe(true);
    });

    it('should return false for Swagger 2.0', () => {
      const spec = { swagger: '2.0' };
      expect(SwaggerConverter.isOpenAPI3(spec)).toBe(false);
    });

    it('should return false for null', () => {
      expect(SwaggerConverter.isOpenAPI3(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(SwaggerConverter.isOpenAPI3(undefined)).toBe(false);
    });
  });

  describe('convert', () => {
    it('should convert a minimal Swagger 2.0 spec to OpenAPI 3.0', async () => {
      const swagger = {
        swagger: '2.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {},
      };

      const result = (await converter.convert(swagger)) as Record<string, unknown>;

      expect(result.openapi).toMatch(/^3\./);
      expect((result.info as Record<string, unknown>).title).toBe('Test API');
      expect((result.info as Record<string, unknown>).version).toBe('1.0.0');
    });

    it('should convert Swagger 2.0 definitions to components.schemas', async () => {
      const swagger = {
        swagger: '2.0',
        info: { title: 'Test', version: '1.0' },
        paths: {},
        definitions: {
          User: {
            type: 'object',
            properties: {
              id: { type: 'integer' },
              name: { type: 'string' },
            },
          },
        },
      };

      const result = (await converter.convert(swagger)) as Record<string, unknown>;
      const components = result.components as Record<string, unknown>;
      const schemas = components?.schemas as Record<string, unknown>;

      expect(schemas?.User).toBeDefined();
      const user = schemas.User as Record<string, unknown>;
      const properties = user.properties as Record<string, unknown>;
      expect((properties.id as Record<string, unknown>).type).toBe('integer');
      expect((properties.name as Record<string, unknown>).type).toBe('string');
    });

    it('should convert Swagger 2.0 body parameters to requestBody', async () => {
      const swagger = {
        swagger: '2.0',
        info: { title: 'Test', version: '1.0' },
        paths: {
          '/users': {
            post: {
              operationId: 'createUser',
              parameters: [
                {
                  name: 'body',
                  in: 'body',
                  schema: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                    },
                  },
                },
              ],
              responses: { '200': { description: 'OK' } },
            },
          },
        },
      };

      const result = (await converter.convert(swagger)) as Record<string, unknown>;
      const paths = result.paths as Record<string, unknown>;
      const usersPath = paths['/users'] as Record<string, unknown>;
      const post = usersPath.post as Record<string, unknown>;

      expect(post.requestBody).toBeDefined();
    });

    it('should convert host/basePath/schemes to servers', async () => {
      const swagger = {
        swagger: '2.0',
        info: { title: 'Test', version: '1.0' },
        host: 'api.example.com',
        basePath: '/v1',
        schemes: ['https'],
        paths: {},
      };

      const result = (await converter.convert(swagger)) as Record<string, unknown>;
      const servers = result.servers as Array<Record<string, unknown>>;

      expect(servers).toBeDefined();
      expect(servers.length).toBeGreaterThan(0);
      expect(servers[0].url).toBe('https://api.example.com/v1');
    });

    it('should convert securityDefinitions to components.securitySchemes', async () => {
      const swagger = {
        swagger: '2.0',
        info: { title: 'Test', version: '1.0' },
        paths: {},
        securityDefinitions: {
          api_key: {
            type: 'apiKey',
            name: 'api_key',
            in: 'header',
          },
        },
      };

      const result = (await converter.convert(swagger)) as Record<string, unknown>;
      const components = result.components as Record<string, unknown>;
      const securitySchemes = components?.securitySchemes as Record<string, unknown>;

      expect(securitySchemes?.api_key).toBeDefined();
    });

    it('should throw SwaggerConversionError for non-Swagger spec', async () => {
      const openapi = { openapi: '3.0.0', info: { title: 'Test', version: '1.0' } };

      await expect(converter.convert(openapi)).rejects.toThrow(SwaggerConversionError);
      await expect(converter.convert(openapi)).rejects.toThrow(
        'Spec is not a valid Swagger 2.0 document'
      );
    });

    it('should throw SwaggerConversionError for empty object', async () => {
      await expect(converter.convert({})).rejects.toThrow(SwaggerConversionError);
    });

    it('should handle Swagger 2.0 with query parameters', async () => {
      const swagger = {
        swagger: '2.0',
        info: { title: 'Test', version: '1.0' },
        paths: {
          '/users': {
            get: {
              operationId: 'getUsers',
              parameters: [
                {
                  name: 'limit',
                  in: 'query',
                  type: 'integer',
                  required: false,
                },
              ],
              responses: { '200': { description: 'OK' } },
            },
          },
        },
      };

      const result = (await converter.convert(swagger)) as Record<string, unknown>;
      const paths = result.paths as Record<string, unknown>;
      const usersPath = paths['/users'] as Record<string, unknown>;
      const get = usersPath.get as Record<string, unknown>;
      const parameters = get.parameters as Array<Record<string, unknown>>;

      expect(parameters).toBeDefined();
      expect(parameters.length).toBe(1);
      expect(parameters[0].name).toBe('limit');
    });

    it('should handle Swagger 2.0 with path parameters', async () => {
      const swagger = {
        swagger: '2.0',
        info: { title: 'Test', version: '1.0' },
        paths: {
          '/users/{id}': {
            get: {
              operationId: 'getUser',
              parameters: [
                {
                  name: 'id',
                  in: 'path',
                  type: 'string',
                  required: true,
                },
              ],
              responses: { '200': { description: 'OK' } },
            },
          },
        },
      };

      const result = (await converter.convert(swagger)) as Record<string, unknown>;
      const paths = result.paths as Record<string, unknown>;

      expect(paths['/users/{id}']).toBeDefined();
    });

    it('should handle Swagger 2.0 with enum values', async () => {
      const swagger = {
        swagger: '2.0',
        info: { title: 'Test', version: '1.0' },
        paths: {},
        definitions: {
          Status: {
            type: 'string',
            enum: ['active', 'inactive', 'pending'],
          },
        },
      };

      const result = (await converter.convert(swagger)) as Record<string, unknown>;
      const components = result.components as Record<string, unknown>;
      const schemas = components?.schemas as Record<string, unknown>;
      const status = schemas?.Status as Record<string, unknown>;

      expect(status?.enum).toEqual(['active', 'inactive', 'pending']);
    });
  });

  describe('convertIfNeeded', () => {
    it('should convert Swagger 2.0 and return wasConverted=true', async () => {
      const swagger = {
        swagger: '2.0',
        info: { title: 'Test', version: '1.0' },
        paths: {},
      };

      const result = await converter.convertIfNeeded(swagger);

      expect(result.wasConverted).toBe(true);
      expect(
        ((result.spec as Record<string, unknown>).openapi as string).startsWith('3.')
      ).toBe(true);
    });

    it('should return OpenAPI 3.0 as-is with wasConverted=false', async () => {
      const openapi = {
        openapi: '3.0.0',
        info: { title: 'Test', version: '1.0' },
        paths: {},
      };

      const result = await converter.convertIfNeeded(openapi);

      expect(result.wasConverted).toBe(false);
      expect(result.spec).toBe(openapi);
    });

    it('should return unknown spec as-is with wasConverted=false', async () => {
      const unknown = { something: 'else' };

      const result = await converter.convertIfNeeded(unknown);

      expect(result.wasConverted).toBe(false);
      expect(result.spec).toBe(unknown);
    });
  });
});
