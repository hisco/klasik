/**
 * Generate Command Tests
 */

import { generateCommand, generateAction, GenerateOptions } from '../generate';
import { SpecLoader } from '../../../loaders/spec-loader';
import { OpenAPIParser } from '../../../parsers/openapi-parser';
import { Generator } from '../../../generator/generator';
import { IRHelpers } from '../../../ir/types';

// Mock dependencies
jest.mock('../../../loaders/spec-loader');
jest.mock('../../../parsers/openapi-parser');
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

describe('Generate Command', () => {
  let mockSpecLoader: jest.Mocked<SpecLoader>;
  let mockParser: jest.Mocked<OpenAPIParser>;
  let mockGenerator: jest.Mocked<Generator>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mocks
    mockSpecLoader = new SpecLoader() as jest.Mocked<SpecLoader>;
    mockParser = new OpenAPIParser() as jest.Mocked<OpenAPIParser>;
    mockGenerator = new Generator({} as any) as jest.Mocked<Generator>;

    (SpecLoader as jest.Mock).mockImplementation(() => mockSpecLoader);
    (OpenAPIParser as jest.Mock).mockImplementation(() => mockParser);
    (Generator as jest.Mock).mockImplementation(() => mockGenerator);

    // Default mock implementations
    mockSpecLoader.load = jest.fn().mockResolvedValue({
      openapi: '3.0.0',
      info: { title: 'Test API', version: '1.0.0' },
      paths: {},
    });

    mockSpecLoader.loadWithRefs = jest.fn().mockResolvedValue({
      openapi: '3.0.0',
      info: { title: 'Test API', version: '1.0.0' },
      paths: {},
    });

    const mockIR = IRHelpers.createSchemaIR();
    mockParser.parse = jest.fn().mockReturnValue(mockIR);
    mockGenerator.generate = jest.fn().mockResolvedValue(undefined);
  });

  describe('command definition', () => {
    it('should have correct name', () => {
      expect(generateCommand.name()).toBe('generate');
    });

    it('should have description', () => {
      expect(generateCommand.description()).toContain('OpenAPI');
    });

    it('should have required url option', () => {
      const urlOption = generateCommand.options.find(opt => opt.long === '--url');
      expect(urlOption).toBeDefined();
      expect(urlOption?.required).toBe(true);
    });

    it('should have required output option', () => {
      const outputOption = generateCommand.options.find(opt => opt.long === '--output');
      expect(outputOption).toBeDefined();
      expect(outputOption?.required).toBe(true);
    });

    it('should have optional mode option', () => {
      const modeOption = generateCommand.options.find(opt => opt.long === '--mode');
      expect(modeOption).toBeDefined();
    });

    it('should have all flag options', () => {
      const flagNames = [
        '--header',
        '--resolve-refs',
        '--esm',
        '--nestjs-swagger',
        '--class-validator',
        '--template',
        '--keep-spec',
        '--timeout',
        '--export-style',
        '--skip-js-extensions',
      ];

      for (const flagName of flagNames) {
        const option = generateCommand.options.find(opt => opt.long === flagName);
        expect(option).toBeDefined();
      }
    });
  });

  describe('action execution', () => {
    it('should load spec with correct options', async () => {
      const options: GenerateOptions = {
        url: 'https://example.com/spec.json',
        output: './output',
      };

      await generateAction(options);

      expect(mockSpecLoader.load).toHaveBeenCalledWith({
        url: 'https://example.com/spec.json',
        headers: {},
        timeout: 30000,
        keepSpec: undefined,
        specDir: './output/.specs',
      });
    });

    it('should parse headers correctly', async () => {
      const options: GenerateOptions = {
        url: 'https://example.com/spec.json',
        output: './output',
        header: ['Authorization: Bearer token', 'X-Custom: value'],
      };

      await generateAction(options);

      expect(mockSpecLoader.load).toHaveBeenCalledWith({
        url: 'https://example.com/spec.json',
        headers: {
          Authorization: 'Bearer token',
          'X-Custom': 'value',
        },
        timeout: 30000,
        keepSpec: undefined,
        specDir: './output/.specs',
      });
    });

    it('should pass timeout option', async () => {
      const options: GenerateOptions = {
        url: 'https://example.com/spec.json',
        output: './output',
        timeout: 60000,
      };

      await generateAction(options);

      expect(mockSpecLoader.load).toHaveBeenCalledWith({
        url: 'https://example.com/spec.json',
        headers: {},
        timeout: 60000,
        keepSpec: undefined,
        specDir: './output/.specs',
      });
    });

    it('should parse OpenAPI spec with includeOperations for full mode', async () => {
      const options: GenerateOptions = {
        url: 'https://example.com/spec.json',
        output: './output',
        mode: 'full',
      };

      await generateAction(options);

      expect(mockParser.parse).toHaveBeenCalledWith(
        expect.any(Object),
        { includeOperations: true }
      );
    });

    it('should parse OpenAPI spec with includeOperations false for models-only mode', async () => {
      const options: GenerateOptions = {
        url: 'https://example.com/spec.json',
        output: './output',
        mode: 'models-only',
      };

      await generateAction(options);

      expect(mockParser.parse).toHaveBeenCalledWith(
        expect.any(Object),
        { includeOperations: false }
      );
    });

    it('should create generator with correct options', async () => {
      const options: GenerateOptions = {
        url: 'https://example.com/spec.json',
        output: './output',
        esm: true,
        nestjsSwagger: true,
        classValidator: true,
        exportStyle: 'direct',
      };

      await generateAction(options);

      expect(Generator).toHaveBeenCalledWith({
        outputDir: './output',
        esm: true,
        nestJsSwagger: true,
        classValidator: true,
        exportStyle: 'direct',
        mode: undefined,
        templateDir: undefined,
      });
    });

    it('should handle skip-js-extensions flag', async () => {
      const options: GenerateOptions = {
        url: 'https://example.com/spec.json',
        output: './output',
        esm: true,
        skipJsExtensions: true,
      };

      await generateAction(options);

      expect(Generator).toHaveBeenCalledWith(
        expect.objectContaining({
          esm: false, // Should be false when skip-js-extensions is true
        })
      );
    });

    it('should call generator.generate with IR', async () => {
      const mockIR = IRHelpers.createSchemaIR();
      mockParser.parse = jest.fn().mockReturnValue(mockIR);

      const options: GenerateOptions = {
        url: 'https://example.com/spec.json',
        output: './output',
      };

      await generateAction(options);

      expect(mockGenerator.generate).toHaveBeenCalledWith(mockIR);
    });

    it('should handle errors gracefully', async () => {
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      mockSpecLoader.load = jest.fn().mockRejectedValue(new Error('Load failed'));

      const options: GenerateOptions = {
        url: 'https://example.com/spec.json',
        output: './output',
      };

      await expect(generateAction(options)).rejects.toThrow('process.exit called');

      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
    });

    it('should handle all plugin flags together', async () => {
      const options: GenerateOptions = {
        url: 'https://example.com/spec.json',
        output: './output',
        classValidator: true,
        nestjsSwagger: true,
        esm: true,
      };

      await generateAction(options);

      expect(Generator).toHaveBeenCalledWith(
        expect.objectContaining({
          classValidator: true,
          nestJsSwagger: true,
          esm: true,
        })
      );
    });

    it('should handle custom template directory', async () => {
      const options: GenerateOptions = {
        url: 'https://example.com/spec.json',
        output: './output',
        template: './custom-templates',
      };

      await generateAction(options);

      expect(Generator).toHaveBeenCalledWith(
        expect.objectContaining({
          templateDir: './custom-templates',
        })
      );
    });

    it('should handle keep-spec flag', async () => {
      const options: GenerateOptions = {
        url: 'https://example.com/spec.json',
        output: './output',
        keepSpec: true,
      };

      await generateAction(options);

      expect(mockSpecLoader.load).toHaveBeenCalledWith(
        expect.objectContaining({
          keepSpec: true,
        })
      );
    });

    it('should handle resolve-refs flag', async () => {
      const options: GenerateOptions = {
        url: 'https://example.com/spec.json',
        output: './output',
        resolveRefs: true,
      };

      await generateAction(options);

      expect(mockSpecLoader.loadWithRefs).toHaveBeenCalledWith({
        url: 'https://example.com/spec.json',
        headers: {},
        timeout: 30000,
        keepSpec: undefined,
        specDir: './output/.specs',
        resolveRefs: true,
        maxDepth: 10,
      });
    });

    it('should handle export-style options', async () => {
      const options: GenerateOptions = {
        url: 'https://example.com/spec.json',
        output: './output',
        exportStyle: 'both',
      };

      await generateAction(options);

      expect(Generator).toHaveBeenCalledWith(
        expect.objectContaining({
          exportStyle: 'both',
        })
      );
    });

    it('should handle mode=full with operations', async () => {
      const mockIR = IRHelpers.createSchemaIR();
      mockIR.operations.set('getUser', {} as any);
      mockParser.parse = jest.fn().mockReturnValue(mockIR);

      const options: GenerateOptions = {
        url: 'https://example.com/spec.json',
        output: './output',
        mode: 'full',
      };

      await generateAction(options);

      expect(mockParser.parse).toHaveBeenCalledWith(
        expect.any(Object),
        { includeOperations: true }
      );
    });

    it('should handle parser errors', async () => {
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      mockParser.parse = jest.fn().mockImplementation(() => {
        throw new Error('Invalid OpenAPI spec');
      });

      const options: GenerateOptions = {
        url: 'https://example.com/spec.json',
        output: './output',
      };

      await expect(generateAction(options)).rejects.toThrow('process.exit called');

      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
    });

    it('should handle generator errors', async () => {
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      mockGenerator.generate = jest.fn().mockRejectedValue(new Error('Generation failed'));

      const options: GenerateOptions = {
        url: 'https://example.com/spec.json',
        output: './output',
      };

      await expect(generateAction(options)).rejects.toThrow('process.exit called');

      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
    });

    it('should handle network timeout errors', async () => {
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      const timeoutError = new Error('Network timeout');
      (timeoutError as any).code = 'ETIMEDOUT';
      mockSpecLoader.load = jest.fn().mockRejectedValue(timeoutError);

      const options: GenerateOptions = {
        url: 'https://example.com/spec.json',
        output: './output',
      };

      await expect(generateAction(options)).rejects.toThrow('process.exit called');

      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
    });

    it('should handle 404 errors', async () => {
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      const notFoundError = new Error('Not found');
      (notFoundError as any).response = { status: 404 };
      mockSpecLoader.load = jest.fn().mockRejectedValue(notFoundError);

      const options: GenerateOptions = {
        url: 'https://example.com/spec.json',
        output: './output',
      };

      await expect(generateAction(options)).rejects.toThrow('process.exit called');

      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
    });

    it('should use default timeout when not specified', async () => {
      const options: GenerateOptions = {
        url: 'https://example.com/spec.json',
        output: './output',
      };

      await generateAction(options);

      expect(mockSpecLoader.load).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 30000,
        })
      );
    });

    it('should handle invalid header format', async () => {
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      const options: GenerateOptions = {
        url: 'https://example.com/spec.json',
        output: './output',
        header: ['InvalidHeader'],
      };

      await expect(generateAction(options)).rejects.toThrow('process.exit called');

      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
    });

    it('should handle empty headers array', async () => {
      const options: GenerateOptions = {
        url: 'https://example.com/spec.json',
        output: './output',
        header: [],
      };

      await generateAction(options);

      expect(mockSpecLoader.load).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: {},
        })
      );
    });

    it('should create generator with mode from options', async () => {
      const options: GenerateOptions = {
        url: 'https://example.com/spec.json',
        output: './output',
        mode: 'models-only',
      };

      await generateAction(options);

      expect(Generator).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'models-only',
        })
      );
    });
  });
});
