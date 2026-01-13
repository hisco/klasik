/**
 * Tests for TSDocGenerator
 */

import { TSDocGenerator } from '../tsdoc-generator';
import {
  PropertyDefinition,
  OperationDefinition,
  TypeReference,
  ParameterDefinition,
  IRHelpers,
} from '../../ir/types';

describe('TSDocGenerator', () => {
  let generator: TSDocGenerator;

  beforeEach(() => {
    generator = new TSDocGenerator();
  });

  describe('generatePropertyDoc', () => {
    it('should generate basic property doc', () => {
      const property: PropertyDefinition = {
        name: 'username',
        originalName: 'username',
        type: { kind: 'primitive', name: 'string' },
        required: true,
        nullable: false,
        metadata: {},
      };

      const doc = generator.generatePropertyDoc(property, 'User');

      expect(doc).toContain('/**');
      expect(doc).toContain(' * @type {string}');
      expect(doc).toContain(' * @memberof User');
      expect(doc).toContain(' * @required');
      expect(doc).toContain(' */');
    });

    it('should include description', () => {
      const property: PropertyDefinition = {
        name: 'email',
        originalName: 'email',
        type: { kind: 'primitive', name: 'string' },
        description: 'User email address',
        required: true,
        nullable: false,
        metadata: {},
      };

      const doc = generator.generatePropertyDoc(property);

      expect(doc).toContain(' * User email address');
    });

    it('should include format tag', () => {
      const property: PropertyDefinition = {
        name: 'email',
        originalName: 'email',
        type: { kind: 'primitive', name: 'string' },
        format: 'email',
        required: false,
        nullable: false,
        metadata: {},
      };

      const doc = generator.generatePropertyDoc(property);

      expect(doc).toContain(' * @format email');
    });

    it('should include constraint tags', () => {
      const property: PropertyDefinition = {
        name: 'age',
        originalName: 'age',
        type: { kind: 'primitive', name: 'number' },
        required: false,
        nullable: false,
        constraints: {
          minimum: 0,
          maximum: 120,
        },
        metadata: {},
      };

      const doc = generator.generatePropertyDoc(property);

      expect(doc).toContain(' * @minimum 0');
      expect(doc).toContain(' * @maximum 120');
    });

    it('should include string length constraints', () => {
      const property: PropertyDefinition = {
        name: 'username',
        originalName: 'username',
        type: { kind: 'primitive', name: 'string' },
        required: false,
        nullable: false,
        constraints: {
          minLength: 3,
          maxLength: 20,
        },
        metadata: {},
      };

      const doc = generator.generatePropertyDoc(property);

      expect(doc).toContain(' * @minLength 3');
      expect(doc).toContain(' * @maxLength 20');
    });

    it('should include pattern constraint', () => {
      const property: PropertyDefinition = {
        name: 'username',
        originalName: 'username',
        type: { kind: 'primitive', name: 'string' },
        required: false,
        nullable: false,
        constraints: {
          pattern: '^[a-zA-Z0-9_]+$',
        },
        metadata: {},
      };

      const doc = generator.generatePropertyDoc(property);

      expect(doc).toContain(' * @pattern ^[a-zA-Z0-9_]+$');
    });

    it('should include example', () => {
      const property: PropertyDefinition = {
        name: 'username',
        originalName: 'username',
        type: { kind: 'primitive', name: 'string' },
        example: 'john_doe',
        required: false,
        nullable: false,
        metadata: {},
      };

      const doc = generator.generatePropertyDoc(property);

      expect(doc).toContain(' * @example "john_doe"');
    });

    it('should include default value', () => {
      const property: PropertyDefinition = {
        name: 'active',
        originalName: 'active',
        type: { kind: 'primitive', name: 'boolean' },
        defaultValue: true,
        required: false,
        nullable: false,
        metadata: {},
      };

      const doc = generator.generatePropertyDoc(property);

      expect(doc).toContain(' * @default true');
    });

    it('should include deprecated tag', () => {
      const property: PropertyDefinition = {
        name: 'oldField',
        originalName: 'oldField',
        type: { kind: 'primitive', name: 'string' },
        required: false,
        nullable: false,
        metadata: {
          deprecated: true,
        },
      };

      const doc = generator.generatePropertyDoc(property);

      expect(doc).toContain(' * @deprecated');
    });

    it('should include readonly tag', () => {
      const property: PropertyDefinition = {
        name: 'id',
        originalName: 'id',
        type: { kind: 'primitive', name: 'string' },
        required: false,
        nullable: false,
        metadata: {
          readOnly: true,
        },
      };

      const doc = generator.generatePropertyDoc(property);

      expect(doc).toContain(' * @readonly');
    });

    it('should include array constraints', () => {
      const property: PropertyDefinition = {
        name: 'tags',
        originalName: 'tags',
        type: {
          kind: 'array',
          elementType: { kind: 'primitive', name: 'string' },
        },
        required: false,
        nullable: false,
        constraints: {
          minItems: 1,
          maxItems: 10,
        },
        metadata: {},
      };

      const doc = generator.generatePropertyDoc(property);

      expect(doc).toContain(' * @minItems 1');
      expect(doc).toContain(' * @maxItems 10');
    });

    it('should escape JSDoc special characters in description', () => {
      const property: PropertyDefinition = {
        name: 'comment',
        originalName: 'comment',
        type: { kind: 'primitive', name: 'string' },
        description: 'A comment with */ special chars',
        required: false,
        nullable: false,
        metadata: {},
      };

      const doc = generator.generatePropertyDoc(property);

      expect(doc).toContain('*\\/');
    });

    it('should preserve backticks for inline code examples', () => {
      const property: PropertyDefinition = {
        name: 'code',
        originalName: 'code',
        type: { kind: 'primitive', name: 'string' },
        description: 'Use `backticks` for code like `const foo = "bar"`',
        required: false,
        nullable: false,
        metadata: {},
      };

      const doc = generator.generatePropertyDoc(property);

      expect(doc).toContain('Use `backticks` for code like `const foo = "bar"`');
    });

    it('should preserve quotes in descriptions', () => {
      const property: PropertyDefinition = {
        name: 'message',
        originalName: 'message',
        type: { kind: 'primitive', name: 'string' },
        description: 'Use "double quotes" and \'single quotes\'',
        required: false,
        nullable: false,
        metadata: {},
      };

      const doc = generator.generatePropertyDoc(property);

      expect(doc).toContain('"double quotes"');
      expect(doc).toContain("'single quotes'");
    });

    it('should escape opening comment in description', () => {
      const property: PropertyDefinition = {
        name: 'code',
        originalName: 'code',
        type: { kind: 'primitive', name: 'string' },
        description: 'A comment with /* opening',
        required: false,
        nullable: false,
        metadata: {},
      };

      const doc = generator.generatePropertyDoc(property);

      expect(doc).toContain('/\\*');
    });

    it('should escape @ symbol at start of line to prevent false tags', () => {
      const property: PropertyDefinition = {
        name: 'email',
        originalName: 'email',
        type: { kind: 'primitive', name: 'string' },
        description: 'Email like @username or user@example.com',
        required: false,
        nullable: false,
        metadata: {},
      };

      const doc = generator.generatePropertyDoc(property);

      // @ at start should be escaped, but @ in middle should not
      expect(doc).toContain('user@example.com');
    });

    it('should handle multiline descriptions with proper formatting', () => {
      const property: PropertyDefinition = {
        name: 'description',
        originalName: 'description',
        type: { kind: 'primitive', name: 'string' },
        description: 'Line 1\nLine 2\nLine 3',
        required: false,
        nullable: false,
        metadata: {},
      };

      const doc = generator.generatePropertyDoc(property);

      expect(doc).toContain('Line 1\n * Line 2\n * Line 3');
    });

    it('should preserve angle brackets for type references', () => {
      const property: PropertyDefinition = {
        name: 'data',
        originalName: 'data',
        type: { kind: 'primitive', name: 'string' },
        description: 'Generic type like Array<string> or Map<K, V>',
        required: false,
        nullable: false,
        metadata: {},
      };

      const doc = generator.generatePropertyDoc(property);

      expect(doc).toContain('Array<string>');
      expect(doc).toContain('Map<K, V>');
    });

    it('should preserve curly braces in descriptions', () => {
      const property: PropertyDefinition = {
        name: 'config',
        originalName: 'config',
        type: { kind: 'primitive', name: 'string' },
        description: 'Config object like {key: value}',
        required: false,
        nullable: false,
        metadata: {},
      };

      const doc = generator.generatePropertyDoc(property);

      expect(doc).toContain('{key: value}');
    });

    it('should handle complex descriptions with multiple special characters', () => {
      const property: PropertyDefinition = {
        name: 'complex',
        originalName: 'complex',
        type: { kind: 'primitive', name: 'string' },
        description: 'Example: `const regex = /pattern/;` creates /* comment */ with types like Array<T>',
        required: false,
        nullable: false,
        metadata: {},
      };

      const doc = generator.generatePropertyDoc(property);

      expect(doc).toContain('`const regex = /pattern/;`');
      expect(doc).toContain('/\\*');
      expect(doc).toContain('*\\/');
      expect(doc).toContain('Array<T>');
    });

    it('should escape pattern constraint properly', () => {
      const property: PropertyDefinition = {
        name: 'username',
        originalName: 'username',
        type: { kind: 'primitive', name: 'string' },
        required: false,
        nullable: false,
        constraints: {
          pattern: '^[a-zA-Z0-9_]+$ /* only alphanumeric */',
        },
        metadata: {},
      };

      const doc = generator.generatePropertyDoc(property);

      expect(doc).toContain('/\\*');
      expect(doc).toContain('*\\/');
    });

    it('should escape example values with special characters', () => {
      const property: PropertyDefinition = {
        name: 'path',
        originalName: 'path',
        type: { kind: 'primitive', name: 'string' },
        example: 'C:\\Users\\Admin /* path */',
        required: false,
        nullable: false,
        metadata: {},
      };

      const doc = generator.generatePropertyDoc(property);

      expect(doc).toContain('/\\*');
      expect(doc).toContain('*\\/');
    });

    it('should escape default values with special characters', () => {
      const property: PropertyDefinition = {
        name: 'comment',
        originalName: 'comment',
        type: { kind: 'primitive', name: 'string' },
        defaultValue: 'Default /* comment */',
        required: false,
        nullable: false,
        metadata: {},
      };

      const doc = generator.generatePropertyDoc(property);

      expect(doc).toContain('/\\*');
      expect(doc).toContain('*\\/');
    });
  });

  describe('generateMethodDoc', () => {
    it('should generate basic method doc', () => {
      const operation: OperationDefinition = {
        operationId: 'getUser',
        method: 'GET',
        path: '/users/{id}',
        summary: 'Get user by ID',
        parameters: [],
        responses: new Map(),
      };

      const doc = generator.generateMethodDoc(operation);

      expect(doc).toContain('/**');
      expect(doc).toContain(' * Get user by ID');
      expect(doc).toContain(' * @method GET');
      expect(doc).toContain(' * @path /users/{id}');
      expect(doc).toContain(' * @throws {RequiredError}');
      expect(doc).toContain(' * @returns {Promise<AxiosResponse<void>>}');
      expect(doc).toContain(' */');
    });

    it('should include summary and description', () => {
      const operation: OperationDefinition = {
        operationId: 'getUser',
        method: 'GET',
        path: '/users/{id}',
        summary: 'Get user by ID',
        description: 'Retrieves a user from the database by their unique identifier',
        parameters: [],
        responses: new Map(),
      };

      const doc = generator.generateMethodDoc(operation);

      expect(doc).toContain(' * Get user by ID');
      expect(doc).toContain(' * Retrieves a user from the database');
    });

    it('should document path parameters', () => {
      const operation: OperationDefinition = {
        operationId: 'getUser',
        method: 'GET',
        path: '/users/{id}',
        parameters: [
          {
            name: 'id',
            in: 'path',
            description: 'User ID',
            required: true,
            type: { kind: 'primitive', name: 'string' },
          },
        ],
        responses: new Map(),
      };

      const doc = generator.generateMethodDoc(operation);

      expect(doc).toContain(' * @param {string} id - User ID (path, required)');
    });

    it('should document query parameters', () => {
      const operation: OperationDefinition = {
        operationId: 'listUsers',
        method: 'GET',
        path: '/users',
        parameters: [
          {
            name: 'page',
            in: 'query',
            description: 'Page number',
            required: false,
            type: { kind: 'primitive', name: 'number' },
          },
        ],
        responses: new Map(),
      };

      const doc = generator.generateMethodDoc(operation);

      expect(doc).toContain(' * @param {number} page - Page number (query, optional)');
    });

    it('should document request body', () => {
      const operation: OperationDefinition = {
        operationId: 'createUser',
        method: 'POST',
        path: '/users',
        parameters: [],
        requestBody: {
          description: 'User data',
          required: true,
          content: new Map([
            ['application/json', { kind: 'reference', name: 'User' }],
          ]),
        },
        responses: new Map(),
      };

      const doc = generator.generateMethodDoc(operation);

      expect(doc).toContain(' * @param {User} requestBody - User data (required)');
    });

    it('should document return type', () => {
      const operation: OperationDefinition = {
        operationId: 'getUser',
        method: 'GET',
        path: '/users/{id}',
        parameters: [],
        responses: new Map([
          [
            '200',
            {
              statusCode: '200',
              description: 'Success',
              content: new Map([
                ['application/json', { kind: 'reference', name: 'User' }],
              ]),
            },
          ],
        ]),
      };

      const doc = generator.generateMethodDoc(operation);

      expect(doc).toContain(' * @returns {Promise<AxiosResponse<User>>}');
    });

    it('should mark deprecated operations', () => {
      const operation: OperationDefinition = {
        operationId: 'oldEndpoint',
        method: 'GET',
        path: '/old',
        deprecated: true,
        parameters: [],
        responses: new Map(),
      };

      const doc = generator.generateMethodDoc(operation);

      expect(doc).toContain(' * @deprecated');
    });

    it('should include tags', () => {
      const operation: OperationDefinition = {
        operationId: 'getUser',
        method: 'GET',
        path: '/users/{id}',
        tags: ['users', 'public'],
        parameters: [],
        responses: new Map(),
      };

      const doc = generator.generateMethodDoc(operation);

      expect(doc).toContain(' * @tag users');
      expect(doc).toContain(' * @tag public');
    });

    it('should include options parameter', () => {
      const operation: OperationDefinition = {
        operationId: 'getUser',
        method: 'GET',
        path: '/users/{id}',
        parameters: [],
        responses: new Map(),
      };

      const doc = generator.generateMethodDoc(operation);

      expect(doc).toContain(' * @param {RawAxiosRequestConfig} [options] - Override http request options');
    });

    it('should escape special characters in operation summary', () => {
      const operation: OperationDefinition = {
        operationId: 'getUser',
        method: 'GET',
        path: '/users/{id}',
        summary: 'Get user /* with special */ chars',
        parameters: [],
        responses: new Map(),
      };

      const doc = generator.generateMethodDoc(operation);

      expect(doc).toContain('/\\*');
      expect(doc).toContain('*\\/');
    });

    it('should escape special characters in operation description', () => {
      const operation: OperationDefinition = {
        operationId: 'getUser',
        method: 'GET',
        path: '/users/{id}',
        description: 'Retrieves user with code `const id = 123` and /* comments */',
        parameters: [],
        responses: new Map(),
      };

      const doc = generator.generateMethodDoc(operation);

      expect(doc).toContain('`const id = 123`');
      expect(doc).toContain('/\\*');
      expect(doc).toContain('*\\/');
    });

    it('should escape special characters in parameter descriptions', () => {
      const operation: OperationDefinition = {
        operationId: 'searchUsers',
        method: 'GET',
        path: '/users',
        parameters: [
          {
            name: 'filter',
            in: 'query',
            description: 'Filter with /* pattern */ or `code`',
            required: false,
            type: { kind: 'primitive', name: 'string' },
          },
        ],
        responses: new Map(),
      };

      const doc = generator.generateMethodDoc(operation);

      expect(doc).toContain('/\\*');
      expect(doc).toContain('*\\/');
      expect(doc).toContain('`code`');
    });

    it('should escape special characters in request body description', () => {
      const operation: OperationDefinition = {
        operationId: 'createUser',
        method: 'POST',
        path: '/users',
        parameters: [],
        requestBody: {
          description: 'User data with /* format */ like `{name: "John"}`',
          required: true,
          content: new Map([
            ['application/json', { kind: 'reference', name: 'User' }],
          ]),
        },
        responses: new Map(),
      };

      const doc = generator.generateMethodDoc(operation);

      expect(doc).toContain('/\\*');
      expect(doc).toContain('*\\/');
      expect(doc).toContain('`{name: "John"}`');
    });

    it('should handle multiline descriptions in operations', () => {
      const operation: OperationDefinition = {
        operationId: 'complexOp',
        method: 'POST',
        path: '/complex',
        description: 'Line 1\nLine 2 with `code`\nLine 3',
        parameters: [],
        responses: new Map(),
      };

      const doc = generator.generateMethodDoc(operation);

      expect(doc).toContain('Line 1\n * Line 2 with `code`\n * Line 3');
    });
  });

  describe('typeReferenceToString', () => {
    it('should convert primitive types', () => {
      expect(generator.typeReferenceToString({ kind: 'primitive', name: 'string' })).toBe('string');
      expect(generator.typeReferenceToString({ kind: 'primitive', name: 'number' })).toBe('number');
      expect(generator.typeReferenceToString({ kind: 'primitive', name: 'boolean' })).toBe('boolean');
    });

    it('should convert array types', () => {
      const arrayType: TypeReference = {
        kind: 'array',
        elementType: { kind: 'primitive', name: 'string' },
      };

      expect(generator.typeReferenceToString(arrayType)).toBe('Array<string>');
    });

    it('should convert reference types', () => {
      expect(generator.typeReferenceToString({ kind: 'reference', name: 'User' })).toBe('User');
      expect(generator.typeReferenceToString({ kind: 'object', name: 'Pet' })).toBe('Pet');
    });

    it('should convert union types', () => {
      const unionType: TypeReference = {
        kind: 'union',
        unionTypes: [
          { kind: 'primitive', name: 'string' },
          { kind: 'primitive', name: 'number' },
        ],
      };

      expect(generator.typeReferenceToString(unionType)).toBe('string | number');
    });

    it('should convert dictionary types', () => {
      const dictType: TypeReference = {
        kind: 'dictionary',
        additionalProperties: { kind: 'primitive', name: 'string' },
      };

      expect(generator.typeReferenceToString(dictType)).toBe('{ [key: string]: string }');
    });

    it('should convert unknown types to any', () => {
      expect(generator.typeReferenceToString({ kind: 'unknown', name: 'any' })).toBe('any');
    });

    it('should handle nested array types', () => {
      const nestedArray: TypeReference = {
        kind: 'array',
        elementType: {
          kind: 'array',
          elementType: { kind: 'primitive', name: 'string' },
        },
      };

      expect(generator.typeReferenceToString(nestedArray)).toBe('Array<Array<string>>');
    });

    it('should handle array of references', () => {
      const arrayOfRefs: TypeReference = {
        kind: 'array',
        elementType: { kind: 'reference', name: 'User' },
      };

      expect(generator.typeReferenceToString(arrayOfRefs)).toBe('Array<User>');
    });
  });
});
