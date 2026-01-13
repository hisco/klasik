/**
 * Generate-JSONSchema Command Tests
 */

import { generateJsonSchemaCommand, generateJsonSchemaAction, GenerateJsonSchemaOptions } from '../generate-jsonschema';
import { SpecLoader } from '../../../loaders/spec-loader';
import { JsonSchemaParser } from '../../../parsers/json-schema-parser';
import { Generator } from '../../../generator/generator';
import { IRHelpers } from '../../../ir/types';

// Mock dependencies
jest.mock('../../../loaders/spec-loader');
jest.mock('../../../parsers/json-schema-parser');
jest.mock('../../../generator/generator');
jest.mock('ora', () => {
  return jest.fn(() => ({
    start: jest.fn().mockReturnThis(),
    succeed: jest.fn().mockReturnThis(),
    fail: jest.fn().mockReturnThis(),
    text: '',
  }));
});

// Mock console methods to reduce test noise
beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation();
  jest.spyOn(console, 'error').mockImplementation();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Generate-JSONSchema Command', () => {
  let mockSpecLoader: jest.Mocked<SpecLoader>;
  let mockParser: jest.Mocked<JsonSchemaParser>;
  let mockGenerator: jest.Mocked<Generator>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mocks
    mockSpecLoader = new SpecLoader() as jest.Mocked<SpecLoader>;
    mockParser = new JsonSchemaParser() as jest.Mocked<JsonSchemaParser>;
    mockGenerator = new Generator({} as any) as jest.Mocked<Generator>;

    (SpecLoader as jest.Mock).mockImplementation(() => mockSpecLoader);
    (JsonSchemaParser as jest.Mock).mockImplementation(() => mockParser);
    (Generator as jest.Mock).mockImplementation(() => mockGenerator);

    // Default mock implementations
    mockSpecLoader.load = jest.fn().mockResolvedValue({
      $schema: 'http://json-schema.org/draft-07/schema#',
      title: 'User',
      type: 'object',
      properties: {},
    });

    mockSpecLoader.loadWithRefs = jest.fn().mockResolvedValue({
      $schema: 'http://json-schema.org/draft-07/schema#',
      title: 'User',
      type: 'object',
      properties: {},
    });

    const mockIR = IRHelpers.createSchemaIR();
    mockParser.parse = jest.fn().mockReturnValue(mockIR);
    mockGenerator.generate = jest.fn().mockResolvedValue(undefined);
  });

  describe('command definition', () => {
    it('should have correct name', () => {
      expect(generateJsonSchemaCommand.name()).toBe('generate-jsonschema');
    });

    it('should have description', () => {
      expect(generateJsonSchemaCommand.description()).toContain('JSON Schema');
    });

    it('should have required url option (repeatable)', () => {
      const urlOption = generateJsonSchemaCommand.options.find(opt => opt.long === '--url');
      expect(urlOption).toBeDefined();
      expect(urlOption?.required).toBe(true);
    });

    it('should have required output option', () => {
      const outputOption = generateJsonSchemaCommand.options.find(opt => opt.long === '--output');
      expect(outputOption).toBeDefined();
      expect(outputOption?.required).toBe(true);
    });

    it('should have all options', () => {
      const optionNames = [
        '--nestjs-swagger',
        '--class-validator',
        '--esm',
        '--header',
        '--template',
        '--keep-spec',
        '--timeout',
      ];

      for (const optionName of optionNames) {
        const option = generateJsonSchemaCommand.options.find(opt => opt.long === optionName);
        expect(option).toBeDefined();
      }
    });
  });

  describe('action execution', () => {
    it('should load single JSON Schema', async () => {
      const options: GenerateJsonSchemaOptions = {
        url: ['https://example.com/user.json'],
        output: './output',
      };

      await generateJsonSchemaAction(options);

      expect(mockSpecLoader.load).toHaveBeenCalledWith({
        url: 'https://example.com/user.json',
        headers: {},
        timeout: 30000,
      });
    });

    it('should load multiple JSON Schemas', async () => {
      const options: GenerateJsonSchemaOptions = {
        url: ['https://example.com/user.json', 'https://example.com/product.json'],
        output: './output',
      };

      await generateJsonSchemaAction(options);

      expect(mockSpecLoader.load).toHaveBeenCalledTimes(2);
    });

    it('should parse headers correctly', async () => {
      const options: GenerateJsonSchemaOptions = {
        url: ['https://example.com/schema.json'],
        output: './output',
        header: ['Authorization: Bearer token', 'X-Custom: value'],
      };

      await generateJsonSchemaAction(options);

      expect(mockSpecLoader.load).toHaveBeenCalledWith({
        url: 'https://example.com/schema.json',
        headers: {
          Authorization: 'Bearer token',
          'X-Custom': 'value',
        },
        timeout: 30000,
      });
    });

    it('should pass custom timeout', async () => {
      const options: GenerateJsonSchemaOptions = {
        url: ['https://example.com/schema.json'],
        output: './output',
        timeout: 60000,
      };

      await generateJsonSchemaAction(options);

      expect(mockSpecLoader.load).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 60000,
        })
      );
    });

    it('should extract schema name from URL', async () => {
      const options: GenerateJsonSchemaOptions = {
        url: ['https://example.com/schemas/user.json'],
        output: './output',
      };

      await generateJsonSchemaAction(options);

      expect(mockParser.parse).toHaveBeenCalledWith(
        expect.any(Object),
        {
          extractDefinitions: true,
          rootSchemaName: 'user',
        }
      );
    });

    it('should extract schema name from file path with dots and hyphens', async () => {
      const options: GenerateJsonSchemaOptions = {
        url: ['./schemas/product.schema.json'],
        output: './output',
      };

      await generateJsonSchemaAction(options);

      expect(mockParser.parse).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          rootSchemaName: 'product_schema',
        })
      );
    });

    it('should create generator with correct options', async () => {
      const options: GenerateJsonSchemaOptions = {
        url: ['https://example.com/schema.json'],
        output: './output',
        esm: true,
        nestjsSwagger: true,
        classValidator: true,
        template: './templates',
      };

      await generateJsonSchemaAction(options);

      expect(Generator).toHaveBeenCalledWith({
        outputDir: './output',
        esm: true,
        nestJsSwagger: true,
        classValidator: true,
        templateDir: './templates',
        mode: 'models-only',
      });
    });

    it('should merge multiple IRs from multiple schemas', async () => {
      const mockIR1 = IRHelpers.createSchemaIR();
      mockIR1.schemas.set('Schema1', {} as any);
      const mockIR2 = IRHelpers.createSchemaIR();
      mockIR2.schemas.set('Schema2', {} as any);

      let callCount = 0;
      mockParser.parse = jest.fn().mockImplementation(() => {
        return callCount++ === 0 ? mockIR1 : mockIR2;
      });

      const options: GenerateJsonSchemaOptions = {
        url: ['https://example.com/schema1.json', 'https://example.com/schema2.json'],
        output: './output',
      };

      await generateJsonSchemaAction(options);

      expect(mockParser.parse).toHaveBeenCalledTimes(2);
      expect(mockGenerator.generate).toHaveBeenCalled();
    });

    it('should use loadWithRefs when resolveRefs is enabled', async () => {
      const options: GenerateJsonSchemaOptions = {
        url: ['https://example.com/schema.json'],
        output: './output',
        resolveRefs: true,
      };

      await generateJsonSchemaAction(options);

      expect(mockSpecLoader.loadWithRefs).toHaveBeenCalledWith({
        url: 'https://example.com/schema.json',
        headers: {},
        timeout: 30000,
        resolveRefs: true,
        maxDepth: 10,
      });
    });

    it('should handle loading errors gracefully', async () => {
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      mockSpecLoader.load = jest.fn().mockRejectedValue(new Error('Network error'));

      const options: GenerateJsonSchemaOptions = {
        url: ['https://example.com/schema.json'],
        output: './output',
      };

      await expect(generateJsonSchemaAction(options)).rejects.toThrow('process.exit called');

      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
    });

    it('should handle parsing errors gracefully', async () => {
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      mockParser.parse = jest.fn().mockImplementation(() => {
        throw new Error('Invalid JSON Schema');
      });

      const options: GenerateJsonSchemaOptions = {
        url: ['https://example.com/schema.json'],
        output: './output',
      };

      await expect(generateJsonSchemaAction(options)).rejects.toThrow('process.exit called');

      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
    });

    it('should handle generator errors', async () => {
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      mockGenerator.generate = jest.fn().mockRejectedValue(new Error('Generation failed'));

      const options: GenerateJsonSchemaOptions = {
        url: ['https://example.com/schema.json'],
        output: './output',
      };

      await expect(generateJsonSchemaAction(options)).rejects.toThrow('process.exit called');

      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
    });

    it('should handle invalid header format', async () => {
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      const options: GenerateJsonSchemaOptions = {
        url: ['https://example.com/schema.json'],
        output: './output',
        header: ['InvalidHeader'],
      };

      await expect(generateJsonSchemaAction(options)).rejects.toThrow('process.exit called');

      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
    });

    it('should handle all plugin flags together', async () => {
      const options: GenerateJsonSchemaOptions = {
        url: ['https://example.com/schema.json'],
        output: './output',
        classValidator: true,
        nestjsSwagger: true,
        esm: true,
      };

      await generateJsonSchemaAction(options);

      expect(Generator).toHaveBeenCalledWith(
        expect.objectContaining({
          classValidator: true,
          nestJsSwagger: true,
          esm: true,
        })
      );
    });

    it('should use default timeout when not specified', async () => {
      const options: GenerateJsonSchemaOptions = {
        url: ['https://example.com/schema.json'],
        output: './output',
      };

      await generateJsonSchemaAction(options);

      expect(mockSpecLoader.load).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 30000,
        })
      );
    });

    it('should set mode to models-only', async () => {
      const options: GenerateJsonSchemaOptions = {
        url: ['https://example.com/schema.json'],
        output: './output',
      };

      await generateJsonSchemaAction(options);

      expect(Generator).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'models-only',
        })
      );
    });
  });
});
