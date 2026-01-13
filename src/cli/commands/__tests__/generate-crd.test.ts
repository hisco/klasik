/**
 * Generate-CRD Command Tests
 */

import { generateCrdCommand, generateCrdAction, GenerateCrdOptions } from '../generate-crd';
import { SpecLoader } from '../../../loaders/spec-loader';
import { CRDParser } from '../../../parsers/crd-parser';
import { CRDToIRConverter } from '../../../parsers/crd-to-ir';
import { Generator } from '../../../generator/generator';
import { IRHelpers } from '../../../ir/types';

// Mock dependencies
jest.mock('../../../loaders/spec-loader');
jest.mock('../../../parsers/crd-parser');
jest.mock('../../../parsers/crd-to-ir');
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

describe('Generate-CRD Command', () => {
  let mockSpecLoader: jest.Mocked<SpecLoader>;
  let mockParser: jest.Mocked<CRDParser>;
  let mockConverter: jest.Mocked<CRDToIRConverter>;
  let mockGenerator: jest.Mocked<Generator>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mocks
    mockSpecLoader = new SpecLoader() as jest.Mocked<SpecLoader>;
    mockParser = new CRDParser() as jest.Mocked<CRDParser>;
    mockConverter = new CRDToIRConverter({}) as jest.Mocked<CRDToIRConverter>;
    mockGenerator = new Generator({} as any) as jest.Mocked<Generator>;

    (SpecLoader as jest.Mock).mockImplementation(() => mockSpecLoader);
    (CRDParser as jest.Mock).mockImplementation(() => mockParser);
    (CRDToIRConverter as jest.Mock).mockImplementation(() => mockConverter);
    (Generator as jest.Mock).mockImplementation(() => mockGenerator);

    // Default mock implementations
    mockSpecLoader.loadMultiDocument = jest.fn().mockResolvedValue([
      {
        apiVersion: 'apiextensions.k8s.io/v1',
        kind: 'CustomResourceDefinition',
        metadata: { name: 'applications.argoproj.io' },
      },
    ]);

    mockSpecLoader.load = jest.fn().mockResolvedValue({
      apiVersion: 'apiextensions.k8s.io/v1',
      kind: 'CustomResourceDefinition',
      metadata: { name: 'applications.argoproj.io' },
    });

    mockSpecLoader.loadWithRefs = jest.fn().mockResolvedValue({
      apiVersion: 'apiextensions.k8s.io/v1',
      kind: 'CustomResourceDefinition',
      metadata: { name: 'applications.argoproj.io' },
    });

    mockParser.parse = jest.fn().mockReturnValue([
      {
        apiVersion: 'apiextensions.k8s.io/v1',
        kind: 'CustomResourceDefinition',
        metadata: {
          name: 'applications.argoproj.io',
          group: 'argoproj.io',
          kind: 'Application',
        },
        schemas: new Map(),
        versions: [],
      },
    ]);

    const mockIR = IRHelpers.createSchemaIR();
    mockConverter.convert = jest.fn().mockReturnValue(mockIR);
    mockGenerator.generate = jest.fn().mockResolvedValue(undefined);
  });

  describe('command definition', () => {
    it('should have correct name', () => {
      expect(generateCrdCommand.name()).toBe('generate-crd');
    });

    it('should have description', () => {
      expect(generateCrdCommand.description()).toContain('CRD');
    });

    it('should have required url option (repeatable)', () => {
      const urlOption = generateCrdCommand.options.find(opt => opt.long === '--url');
      expect(urlOption).toBeDefined();
      expect(urlOption?.required).toBe(true);
    });

    it('should have required output option', () => {
      const outputOption = generateCrdCommand.options.find(opt => opt.long === '--output');
      expect(outputOption).toBeDefined();
      expect(outputOption?.required).toBe(true);
    });

    it('should have all CRD-specific options', () => {
      const optionNames = [
        '--include-status',
        '--crd-kind-case',
        '--nestjs-swagger',
        '--class-validator',
        '--esm',
        '--header',
        '--template',
        '--keep-spec',
        '--timeout',
      ];

      for (const optionName of optionNames) {
        const option = generateCrdCommand.options.find(opt => opt.long === optionName);
        expect(option).toBeDefined();
      }
    });
  });

  describe('action execution', () => {
    it('should load single CRD', async () => {
      const options: GenerateCrdOptions = {
        url: ['https://example.com/crd.yaml'],
        output: './output',
      };

      await generateCrdAction(options);

      expect(mockSpecLoader.loadMultiDocument).toHaveBeenCalledWith({
        url: 'https://example.com/crd.yaml',
        headers: {},
        timeout: 30000,
      });
    });

    it('should load multiple CRDs', async () => {
      const options: GenerateCrdOptions = {
        url: ['https://example.com/crd1.yaml', 'https://example.com/crd2.yaml'],
        output: './output',
      };

      await generateCrdAction(options);

      expect(mockSpecLoader.loadMultiDocument).toHaveBeenCalledTimes(2);
      expect(mockSpecLoader.loadMultiDocument).toHaveBeenCalledWith({
        url: 'https://example.com/crd1.yaml',
        headers: {},
        timeout: 30000,
      });
      expect(mockSpecLoader.loadMultiDocument).toHaveBeenCalledWith({
        url: 'https://example.com/crd2.yaml',
        headers: {},
        timeout: 30000,
      });
    });

    it('should parse headers correctly', async () => {
      const options: GenerateCrdOptions = {
        url: ['https://example.com/crd.yaml'],
        output: './output',
        header: ['Authorization: Bearer token', 'X-Custom: value'],
      };

      await generateCrdAction(options);

      expect(mockSpecLoader.loadMultiDocument).toHaveBeenCalledWith({
        url: 'https://example.com/crd.yaml',
        headers: {
          Authorization: 'Bearer token',
          'X-Custom': 'value',
        },
        timeout: 30000,
      });
    });

    it('should pass timeout option', async () => {
      const options: GenerateCrdOptions = {
        url: ['https://example.com/crd.yaml'],
        output: './output',
        timeout: 60000,
      };

      await generateCrdAction(options);

      expect(mockSpecLoader.loadMultiDocument).toHaveBeenCalledWith({
        url: 'https://example.com/crd.yaml',
        headers: {},
        timeout: 60000,
      });
    });

    it('should parse CRDs with includeStatus option', async () => {
      const options: GenerateCrdOptions = {
        url: ['https://example.com/crd.yaml'],
        output: './output',
        includeStatus: true,
      };

      await generateCrdAction(options);

      expect(mockParser.parse).toHaveBeenCalledWith(
        expect.any(Array),
        { includeStatus: true }
      );
    });

    it('should create converter with includeStatus option', async () => {
      const options: GenerateCrdOptions = {
        url: ['https://example.com/crd.yaml'],
        output: './output',
        includeStatus: true,
      };

      await generateCrdAction(options);

      expect(CRDToIRConverter).toHaveBeenCalledWith({
        includeStatus: true,
        extractNested: true,
      });
    });

    it('should create generator with correct options', async () => {
      const options: GenerateCrdOptions = {
        url: ['https://example.com/crd.yaml'],
        output: './output',
        esm: true,
        nestjsSwagger: true,
        classValidator: true,
        crdKindCase: 'kebab',
      };

      await generateCrdAction(options);

      expect(Generator).toHaveBeenCalledWith({
        outputDir: './output',
        esm: true,
        nestJsSwagger: true,
        classValidator: true,
        crdKindCase: 'kebab',
        templateDir: undefined,
        mode: 'models-only',
      });
    });

    it('should handle crd-kind-case option (snake)', async () => {
      const options: GenerateCrdOptions = {
        url: ['https://example.com/crd.yaml'],
        output: './output',
        crdKindCase: 'snake',
      };

      await generateCrdAction(options);

      expect(Generator).toHaveBeenCalledWith(
        expect.objectContaining({
          crdKindCase: 'snake',
        })
      );
    });

    it('should handle crd-kind-case option (pascal)', async () => {
      const options: GenerateCrdOptions = {
        url: ['https://example.com/crd.yaml'],
        output: './output',
        crdKindCase: 'pascal',
      };

      await generateCrdAction(options);

      expect(Generator).toHaveBeenCalledWith(
        expect.objectContaining({
          crdKindCase: 'pascal',
        })
      );
    });

    it('should handle custom template directory', async () => {
      const options: GenerateCrdOptions = {
        url: ['https://example.com/crd.yaml'],
        output: './output',
        template: './custom-templates',
      };

      await generateCrdAction(options);

      expect(Generator).toHaveBeenCalledWith(
        expect.objectContaining({
          templateDir: './custom-templates',
        })
      );
    });

    it('should merge multiple IRs from multiple CRDs', async () => {
      const mockIR1 = IRHelpers.createSchemaIR();
      mockIR1.schemas.set('Schema1', {} as any);
      const mockIR2 = IRHelpers.createSchemaIR();
      mockIR2.schemas.set('Schema2', {} as any);

      mockParser.parse = jest.fn().mockReturnValue([
        {
          apiVersion: 'apiextensions.k8s.io/v1',
          kind: 'CustomResourceDefinition',
          metadata: { name: 'crd1', group: 'test', kind: 'Kind1' },
          schemas: new Map(),
          versions: [],
        },
        {
          apiVersion: 'apiextensions.k8s.io/v1',
          kind: 'CustomResourceDefinition',
          metadata: { name: 'crd2', group: 'test', kind: 'Kind2' },
          schemas: new Map(),
          versions: [],
        },
      ]);

      let callCount = 0;
      mockConverter.convert = jest.fn().mockImplementation(() => {
        return callCount++ === 0 ? mockIR1 : mockIR2;
      });

      const options: GenerateCrdOptions = {
        url: ['https://example.com/crd.yaml'],
        output: './output',
      };

      await generateCrdAction(options);

      expect(mockConverter.convert).toHaveBeenCalledTimes(2);
      expect(mockGenerator.generate).toHaveBeenCalled();
    });

    it('should handle loading errors gracefully', async () => {
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      mockSpecLoader.loadMultiDocument = jest.fn().mockRejectedValue(new Error('Load failed'));
      mockSpecLoader.load = jest.fn().mockRejectedValue(new Error('Load failed'));

      const options: GenerateCrdOptions = {
        url: ['https://example.com/crd.yaml'],
        output: './output',
      };

      await expect(generateCrdAction(options)).rejects.toThrow('process.exit called');

      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
    });

    it('should fall back to single document load on multi-document failure', async () => {
      mockSpecLoader.loadMultiDocument = jest.fn().mockRejectedValue(new Error('Not multi-doc'));
      mockSpecLoader.load = jest.fn().mockResolvedValue({
        apiVersion: 'apiextensions.k8s.io/v1',
        kind: 'CustomResourceDefinition',
        metadata: { name: 'test.example.com' },
      });

      const options: GenerateCrdOptions = {
        url: ['https://example.com/crd.yaml'],
        output: './output',
      };

      await generateCrdAction(options);

      expect(mockSpecLoader.load).toHaveBeenCalled();
      expect(mockParser.parse).toHaveBeenCalled();
    });

    it('should use loadWithRefs when resolveRefs is enabled (fallback)', async () => {
      mockSpecLoader.loadMultiDocument = jest.fn().mockRejectedValue(new Error('Not multi-doc'));

      const options: GenerateCrdOptions = {
        url: ['https://example.com/crd.yaml'],
        output: './output',
        resolveRefs: true,
      };

      await generateCrdAction(options);

      expect(mockSpecLoader.loadWithRefs).toHaveBeenCalledWith({
        url: 'https://example.com/crd.yaml',
        headers: {},
        timeout: 30000,
        resolveRefs: true,
        maxDepth: 10,
      });
    });

    it('should handle parser errors', async () => {
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      mockParser.parse = jest.fn().mockImplementation(() => {
        throw new Error('Invalid CRD');
      });

      const options: GenerateCrdOptions = {
        url: ['https://example.com/crd.yaml'],
        output: './output',
      };

      await expect(generateCrdAction(options)).rejects.toThrow('process.exit called');

      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
    });

    it('should handle converter errors', async () => {
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      mockConverter.convert = jest.fn().mockImplementation(() => {
        throw new Error('Conversion failed');
      });

      const options: GenerateCrdOptions = {
        url: ['https://example.com/crd.yaml'],
        output: './output',
      };

      await expect(generateCrdAction(options)).rejects.toThrow('process.exit called');

      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
    });

    it('should handle generator errors', async () => {
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      mockGenerator.generate = jest.fn().mockRejectedValue(new Error('Generation failed'));

      const options: GenerateCrdOptions = {
        url: ['https://example.com/crd.yaml'],
        output: './output',
      };

      await expect(generateCrdAction(options)).rejects.toThrow('process.exit called');

      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
    });

    it('should handle invalid header format', async () => {
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      const options: GenerateCrdOptions = {
        url: ['https://example.com/crd.yaml'],
        output: './output',
        header: ['InvalidHeader'],
      };

      await expect(generateCrdAction(options)).rejects.toThrow('process.exit called');

      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
    });

    it('should handle empty headers array', async () => {
      const options: GenerateCrdOptions = {
        url: ['https://example.com/crd.yaml'],
        output: './output',
        header: [],
      };

      await generateCrdAction(options);

      expect(mockSpecLoader.loadMultiDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: {},
        })
      );
    });

    it('should handle all plugin flags together', async () => {
      const options: GenerateCrdOptions = {
        url: ['https://example.com/crd.yaml'],
        output: './output',
        classValidator: true,
        nestjsSwagger: true,
        esm: true,
        includeStatus: true,
      };

      await generateCrdAction(options);

      expect(Generator).toHaveBeenCalledWith(
        expect.objectContaining({
          classValidator: true,
          nestJsSwagger: true,
          esm: true,
        })
      );
    });

    it('should use default timeout when not specified', async () => {
      const options: GenerateCrdOptions = {
        url: ['https://example.com/crd.yaml'],
        output: './output',
      };

      await generateCrdAction(options);

      expect(mockSpecLoader.loadMultiDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 30000,
        })
      );
    });

    it('should load multiple documents from single URL', async () => {
      mockSpecLoader.loadMultiDocument = jest.fn().mockResolvedValue([
        { kind: 'CustomResourceDefinition', metadata: { name: 'crd1' } },
        { kind: 'CustomResourceDefinition', metadata: { name: 'crd2' } },
      ]);

      mockParser.parse = jest.fn().mockReturnValue([
        {
          apiVersion: 'apiextensions.k8s.io/v1',
          kind: 'CustomResourceDefinition',
          metadata: { name: 'crd1', group: 'test', kind: 'Kind1' },
          schemas: new Map(),
          versions: [],
        },
        {
          apiVersion: 'apiextensions.k8s.io/v1',
          kind: 'CustomResourceDefinition',
          metadata: { name: 'crd2', group: 'test', kind: 'Kind2' },
          schemas: new Map(),
          versions: [],
        },
      ]);

      const options: GenerateCrdOptions = {
        url: ['https://example.com/crds.yaml'],
        output: './output',
      };

      await generateCrdAction(options);

      expect(mockSpecLoader.loadMultiDocument).toHaveBeenCalledTimes(1);
      expect(mockParser.parse).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ metadata: { name: 'crd1' } }),
          expect.objectContaining({ metadata: { name: 'crd2' } }),
        ]),
        expect.any(Object)
      );
    });

    it('should set mode to models-only', async () => {
      const options: GenerateCrdOptions = {
        url: ['https://example.com/crd.yaml'],
        output: './output',
      };

      await generateCrdAction(options);

      expect(Generator).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'models-only',
        })
      );
    });
  });
});
