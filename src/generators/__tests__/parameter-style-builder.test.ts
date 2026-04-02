/**
 * Unit Tests for ParameterStyleBuilder
 *
 * Tests collision detection, interface generation, and parameter extraction
 */

import { ParameterStyleBuilder } from '../parameter-style-builder';
import { OperationDefinition, ParameterDefinition } from '../../ir/types';
import { GeneratorOptions } from '../../builders/class-builder';

describe('ParameterStyleBuilder', () => {
  let builder: ParameterStyleBuilder;
  const mockOptions: GeneratorOptions = {
    outputDir: '/tmp/test',
    mode: 'full',
  };

  beforeEach(() => {
    builder = new ParameterStyleBuilder(mockOptions);
  });

  describe('detectCollisions', () => {
    it('should detect no collisions when parameter names are unique', () => {
      const operation: OperationDefinition = {
        operationId: 'testOp',
        method: 'GET',
        path: '/test',
        parameters: [
          {
            name: 'userId',
            in: 'query',
            required: true,
            type: { kind: 'primitive', name: 'string' },
          },
          {
            name: 'limit',
            in: 'query',
            required: false,
            type: { kind: 'primitive', name: 'number' },
          },
        ],
        tags: [],
        responses: new Map(),
      };

      const report = builder.detectCollisions(operation);

      expect(report.hasCollisions).toBe(false);
      expect(report.errors).toHaveLength(0);
      expect(report.parameterMap.size).toBe(2);
      expect(report.parameterMap.has('userId')).toBe(true);
      expect(report.parameterMap.has('limit')).toBe(true);
    });

    it('should detect collision when two parameters normalize to same name', () => {
      const operation: OperationDefinition = {
        operationId: 'testOp',
        method: 'GET',
        path: '/test',
        parameters: [
          {
            name: 'user_id',
            in: 'query',
            required: true,
            type: { kind: 'primitive', name: 'string' },
          },
          {
            name: 'userId',
            in: 'header',
            required: false,
            type: { kind: 'primitive', name: 'string' },
          },
        ],
        tags: [],
        responses: new Map(),
      };

      const report = builder.detectCollisions(operation);

      expect(report.hasCollisions).toBe(true);
      expect(report.errors).toHaveLength(1);
      expect(report.errors[0]).toContain('collision');
      expect(report.errors[0]).toContain('user_id');
      expect(report.errors[0]).toContain('userId');
      expect(report.errors[0]).toContain('testOp');
    });

    it('should provide helpful error message with solutions', () => {
      const operation: OperationDefinition = {
        operationId: 'getUser',
        method: 'GET',
        path: '/users',
        parameters: [
          {
            name: 'api-key',
            in: 'header',
            required: true,
            type: { kind: 'primitive', name: 'string' },
          },
          {
            name: 'apiKey',
            in: 'query',
            required: false,
            type: { kind: 'primitive', name: 'string' },
          },
        ],
        tags: [],
        responses: new Map(),
      };

      const report = builder.detectCollisions(operation);

      expect(report.hasCollisions).toBe(true);
      expect(report.errors[0]).toContain('Solutions');
      expect(report.errors[0]).toContain('Rename one parameter in your OpenAPI spec');
      expect(report.errors[0]).toContain('--parameter-style positional');
    });

    it('should detect multiple collisions', () => {
      const operation: OperationDefinition = {
        operationId: 'testOp',
        method: 'GET',
        path: '/test',
        parameters: [
          {
            name: 'user_id',
            in: 'query',
            required: true,
            type: { kind: 'primitive', name: 'string' },
          },
          {
            name: 'userId',
            in: 'header',
            required: false,
            type: { kind: 'primitive', name: 'string' },
          },
          {
            name: 'order_id',
            in: 'query',
            required: true,
            type: { kind: 'primitive', name: 'string' },
          },
          {
            name: 'orderId',
            in: 'path',
            required: true,
            type: { kind: 'primitive', name: 'string' },
          },
        ],
        tags: [],
        responses: new Map(),
      };

      const report = builder.detectCollisions(operation);

      expect(report.hasCollisions).toBe(true);
      expect(report.errors.length).toBeGreaterThanOrEqual(1); // At least one error per collision
    });

    it('should handle empty parameters list', () => {
      const operation: OperationDefinition = {
        operationId: 'testOp',
        method: 'GET',
        path: '/test',
        parameters: [],
        tags: [],
        responses: new Map(),
      };

      const report = builder.detectCollisions(operation);

      expect(report.hasCollisions).toBe(false);
      expect(report.errors).toHaveLength(0);
      expect(report.parameterMap.size).toBe(0);
    });
  });

  describe('generateParameterInterface', () => {
    it('should generate interface with all parameters', () => {
      const operation: OperationDefinition = {
        operationId: 'getUser',
        method: 'GET',
        path: '/users/{id}',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            type: { kind: 'primitive', name: 'string' },
            description: 'User ID',
          },
          {
            name: 'include',
            in: 'query',
            required: false,
            type: { kind: 'primitive', name: 'string' },
            description: 'Fields to include',
          },
        ],
        tags: [],
        summary: 'Get a user by ID',
        responses: new Map(),
      };

      const interfaceCode = builder.generateParameterInterface(operation);

      expect(interfaceCode).toContain('export interface GetUserParams');
      expect(interfaceCode).toContain('id: string');
      expect(interfaceCode).toContain('include?: string');
      expect(interfaceCode).toContain('/** User ID */');
      expect(interfaceCode).toContain('/** Fields to include */');
      expect(interfaceCode).toContain('Get a user by ID');
    });

    it('should handle parameters without descriptions', () => {
      const operation: OperationDefinition = {
        operationId: 'listItems',
        method: 'GET',
        path: '/items',
        parameters: [
          {
            name: 'limit',
            in: 'query',
            required: false,
            type: { kind: 'primitive', name: 'number' },
          },
        ],
        tags: [],
        responses: new Map(),
      };

      const interfaceCode = builder.generateParameterInterface(operation);

      expect(interfaceCode).toContain('export interface ListItemsParams');
      expect(interfaceCode).toContain('limit?: number');
      expect(interfaceCode).not.toContain('/** */');
    });

    it('should transform parameter names to camelCase', () => {
      const operation: OperationDefinition = {
        operationId: 'getData',
        method: 'GET',
        path: '/data',
        parameters: [
          {
            name: 'user_id',
            in: 'query',
            required: true,
            type: { kind: 'primitive', name: 'string' },
          },
          {
            name: 'created-at',
            in: 'query',
            required: false,
            type: { kind: 'primitive', name: 'string' },
          },
        ],
        tags: [],
        responses: new Map(),
      };

      const interfaceCode = builder.generateParameterInterface(operation);

      expect(interfaceCode).toContain('userId: string');
      expect(interfaceCode).toContain('createdAt?: string');
    });

    it('should handle complex types', () => {
      const operation: OperationDefinition = {
        operationId: 'searchItems',
        method: 'GET',
        path: '/items',
        parameters: [
          {
            name: 'tags',
            in: 'query',
            required: false,
            type: {
              kind: 'array',
              elementType: { kind: 'primitive', name: 'string' },
            },
          },
          {
            name: 'metadata',
            in: 'query',
            required: false,
            type: {
              kind: 'dictionary',
              additionalProperties: { kind: 'primitive', name: 'any' },
            },
          },
        ],
        tags: [],
        responses: new Map(),
      };

      const interfaceCode = builder.generateParameterInterface(operation);

      expect(interfaceCode).toContain('tags?: Array<string>');
      expect(interfaceCode).toContain('metadata?: Record<string, any>');
    });
  });

  describe('generateParameterExtraction', () => {
    it('should generate destructuring for object-flat style', () => {
      const operation: OperationDefinition = {
        operationId: 'getUser',
        method: 'GET',
        path: '/users/{id}',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            type: { kind: 'primitive', name: 'string' },
          },
          {
            name: 'include',
            in: 'query',
            required: false,
            type: { kind: 'primitive', name: 'string' },
          },
        ],
        tags: [],
        responses: new Map(),
      };

      const lines = builder.generateParameterExtraction(operation, 'object-flat');

      expect(lines).toHaveLength(2); // Destructuring + empty line
      expect(lines[0]).toBe('const { id, include } = params || {};');
      expect(lines[1]).toBe('');
    });

    it('should return empty array for positional style', () => {
      const operation: OperationDefinition = {
        operationId: 'getUser',
        method: 'GET',
        path: '/users/{id}',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            type: { kind: 'primitive', name: 'string' },
          },
        ],
        tags: [],
        responses: new Map(),
      };

      const lines = builder.generateParameterExtraction(operation, 'positional');

      expect(lines).toHaveLength(0);
    });

    it('should return empty array when no parameters', () => {
      const operation: OperationDefinition = {
        operationId: 'healthCheck',
        method: 'GET',
        path: '/health',
        parameters: [],
        tags: [],
        responses: new Map(),
      };

      const lines = builder.generateParameterExtraction(operation, 'object-flat');

      expect(lines).toHaveLength(0);
    });

    it('should use params || {} for optional params handling', () => {
      const operation: OperationDefinition = {
        operationId: 'listItems',
        method: 'GET',
        path: '/items',
        parameters: [
          {
            name: 'status',
            in: 'query',
            required: false,
            type: { kind: 'primitive', name: 'string' },
          },
        ],
        tags: [],
        responses: new Map(),
      };

      const lines = builder.generateParameterExtraction(operation, 'object-flat');

      expect(lines[0]).toContain('params || {}');
    });
  });

  describe('Type Conversion', () => {
    it('should handle primitive types', () => {
      const operation: OperationDefinition = {
        operationId: 'test',
        method: 'GET',
        path: '/test',
        parameters: [
          {
            name: 'stringParam',
            in: 'query',
            required: true,
            type: { kind: 'primitive', name: 'string' },
          },
          {
            name: 'numberParam',
            in: 'query',
            required: true,
            type: { kind: 'primitive', name: 'number' },
          },
          {
            name: 'boolParam',
            in: 'query',
            required: true,
            type: { kind: 'primitive', name: 'boolean' },
          },
        ],
        tags: [],
        responses: new Map(),
      };

      const interfaceCode = builder.generateParameterInterface(operation);

      expect(interfaceCode).toContain('stringParam: string');
      expect(interfaceCode).toContain('numberParam: number');
      expect(interfaceCode).toContain('boolParam: boolean');
    });

    it('should handle array types', () => {
      const operation: OperationDefinition = {
        operationId: 'test',
        method: 'GET',
        path: '/test',
        parameters: [
          {
            name: 'items',
            in: 'query',
            required: true,
            type: {
              kind: 'array',
              elementType: { kind: 'primitive', name: 'string' },
            },
          },
        ],
        tags: [],
        responses: new Map(),
      };

      const interfaceCode = builder.generateParameterInterface(operation);

      expect(interfaceCode).toContain('items: Array<string>');
    });

    it('should handle union types', () => {
      const operation: OperationDefinition = {
        operationId: 'test',
        method: 'GET',
        path: '/test',
        parameters: [
          {
            name: 'status',
            in: 'query',
            required: true,
            type: {
              kind: 'union',
              unionTypes: [
                { kind: 'primitive', name: 'string' },
                { kind: 'primitive', name: 'number' },
              ],
            },
          },
        ],
        tags: [],
        responses: new Map(),
      };

      const interfaceCode = builder.generateParameterInterface(operation);

      expect(interfaceCode).toContain('status: string | number');
    });

    it('should handle reference types', () => {
      const operation: OperationDefinition = {
        operationId: 'test',
        method: 'GET',
        path: '/test',
        parameters: [
          {
            name: 'user',
            in: 'query',
            required: true,
            type: { kind: 'reference', name: 'User' },
          },
        ],
        tags: [],
        responses: new Map(),
      };

      const interfaceCode = builder.generateParameterInterface(operation);

      expect(interfaceCode).toContain('user: User');
    });

    it('should handle unknown types as any', () => {
      const operation: OperationDefinition = {
        operationId: 'test',
        method: 'GET',
        path: '/test',
        parameters: [
          {
            name: 'unknown',
            in: 'query',
            required: true,
            type: { kind: 'unknown' },
          },
        ],
        tags: [],
        responses: new Map(),
      };

      const interfaceCode = builder.generateParameterInterface(operation);

      expect(interfaceCode).toContain('unknown: any');
    });
  });

  describe('Edge Cases', () => {
    it('should handle operation with only requestBody (no params)', () => {
      const operation: OperationDefinition = {
        operationId: 'createItem',
        method: 'POST',
        path: '/items',
        parameters: [],
        requestBody: {
          required: true,
          content: new Map([
            [
              'application/json',
              { kind: 'reference', name: 'Item' } as any,
            ],
          ]),
        },
        tags: [],
        responses: new Map(),
      };

      const interfaceCode = builder.generateParameterInterface(operation);
      const extractionLines = builder.generateParameterExtraction(operation, 'object-flat');

      // Should generate empty interface for body-only operations (even if not used)
      expect(interfaceCode).toContain('export interface CreateItemParams');
      expect(interfaceCode).toContain('{');
      expect(interfaceCode).toContain('}');
      // Should not generate extraction for operations with no params
      expect(extractionLines).toHaveLength(0);
    });

    it('should handle very long parameter names', () => {
      const operation: OperationDefinition = {
        operationId: 'test',
        method: 'GET',
        path: '/test',
        parameters: [
          {
            name: 'veryLongParameterNameThatExceedsNormalLimits',
            in: 'query',
            required: true,
            type: { kind: 'primitive', name: 'string' },
          },
        ],
        tags: [],
        responses: new Map(),
      };

      const interfaceCode = builder.generateParameterInterface(operation);

      expect(interfaceCode).toContain('veryLongParameterNameThatExceedsNormalLimits: string');
    });

    it('should handle parameter names with numbers', () => {
      const operation: OperationDefinition = {
        operationId: 'test',
        method: 'GET',
        path: '/test',
        parameters: [
          {
            name: 'param1',
            in: 'query',
            required: true,
            type: { kind: 'primitive', name: 'string' },
          },
          {
            name: 'param2',
            in: 'query',
            required: true,
            type: { kind: 'primitive', name: 'string' },
          },
        ],
        tags: [],
        responses: new Map(),
      };

      const interfaceCode = builder.generateParameterInterface(operation);

      expect(interfaceCode).toContain('param1: string');
      expect(interfaceCode).toContain('param2: string');
    });
  });
});
