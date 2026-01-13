/**
 * Download Command Tests
 */

import { downloadCommand, downloadAction, DownloadOptions } from '../download';
import { SpecLoader } from '../../../loaders/spec-loader';
import * as fs from 'fs';

// Mock dependencies
jest.mock('../../../loaders/spec-loader');
jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  return {
    ...actual,
    existsSync: jest.fn(),
    mkdirSync: jest.fn(),
    promises: {
      writeFile: jest.fn(),
    },
  };
});
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

describe('Download Command', () => {
  let mockSpecLoader: jest.Mocked<SpecLoader>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mocks
    mockSpecLoader = new SpecLoader() as jest.Mocked<SpecLoader>;
    (SpecLoader as jest.Mock).mockImplementation(() => mockSpecLoader);

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

    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.mkdirSync as jest.Mock).mockImplementation(() => undefined);
    (fs.promises.writeFile as jest.Mock).mockResolvedValue(undefined);
  });

  describe('command definition', () => {
    it('should have correct name', () => {
      expect(downloadCommand.name()).toBe('download');
    });

    it('should have description', () => {
      expect(downloadCommand.description()).toContain('Download');
    });

    it('should have required url option', () => {
      const urlOption = downloadCommand.options.find(opt => opt.long === '--url');
      expect(urlOption).toBeDefined();
      expect(urlOption?.required).toBe(true);
    });

    it('should have required output option', () => {
      const outputOption = downloadCommand.options.find(opt => opt.long === '--output');
      expect(outputOption).toBeDefined();
      expect(outputOption?.required).toBe(true);
    });

    it('should have optional header option', () => {
      const headerOption = downloadCommand.options.find(opt => opt.long === '--header');
      expect(headerOption).toBeDefined();
    });

    it('should have optional timeout option', () => {
      const timeoutOption = downloadCommand.options.find(opt => opt.long === '--timeout');
      expect(timeoutOption).toBeDefined();
    });

    it('should have optional resolve-refs option', () => {
      const resolveRefsOption = downloadCommand.options.find(opt => opt.long === '--resolve-refs');
      expect(resolveRefsOption).toBeDefined();
    });
  });

  describe('action execution', () => {
    it('should download spec with correct options', async () => {
      const options: DownloadOptions = {
        url: 'https://example.com/spec.json',
        output: './output/spec.json',
      };

      await downloadAction(options);

      expect(mockSpecLoader.load).toHaveBeenCalledWith({
        url: 'https://example.com/spec.json',
        headers: {},
        timeout: 30000,
      });
    });

    it('should parse headers correctly', async () => {
      const options: DownloadOptions = {
        url: 'https://example.com/spec.json',
        output: './output/spec.json',
        header: ['Authorization: Bearer token', 'X-Custom: value'],
      };

      await downloadAction(options);

      expect(mockSpecLoader.load).toHaveBeenCalledWith({
        url: 'https://example.com/spec.json',
        headers: {
          Authorization: 'Bearer token',
          'X-Custom': 'value',
        },
        timeout: 30000,
      });
    });

    it('should pass custom timeout', async () => {
      const options: DownloadOptions = {
        url: 'https://example.com/spec.json',
        output: './output/spec.json',
        timeout: 60000,
      };

      await downloadAction(options);

      expect(mockSpecLoader.load).toHaveBeenCalledWith({
        url: 'https://example.com/spec.json',
        headers: {},
        timeout: 60000,
      });
    });

    it('should use loadWithRefs when resolveRefs is enabled', async () => {
      const options: DownloadOptions = {
        url: 'https://example.com/spec.json',
        output: './output/spec.json',
        resolveRefs: true,
      };

      await downloadAction(options);

      expect(mockSpecLoader.loadWithRefs).toHaveBeenCalledWith({
        url: 'https://example.com/spec.json',
        headers: {},
        timeout: 30000,
        resolveRefs: true,
        maxDepth: 10,
      });
    });

    it('should create output directory if it does not exist', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const options: DownloadOptions = {
        url: 'https://example.com/spec.json',
        output: './new-dir/spec.json',
      };

      await downloadAction(options);

      expect(fs.mkdirSync).toHaveBeenCalledWith('./new-dir', { recursive: true });
    });

    it('should not create directory if it already exists', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      const options: DownloadOptions = {
        url: 'https://example.com/spec.json',
        output: './existing-dir/spec.json',
      };

      await downloadAction(options);

      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });

    it('should write spec to file as JSON', async () => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {},
      };
      mockSpecLoader.load = jest.fn().mockResolvedValue(spec);

      const options: DownloadOptions = {
        url: 'https://example.com/spec.json',
        output: './output/spec.json',
      };

      await downloadAction(options);

      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        './output/spec.json',
        JSON.stringify(spec, null, 2),
        'utf-8'
      );
    });

    it('should handle loading errors gracefully', async () => {
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      mockSpecLoader.load = jest.fn().mockRejectedValue(new Error('Network error'));

      const options: DownloadOptions = {
        url: 'https://example.com/spec.json',
        output: './output/spec.json',
      };

      await expect(downloadAction(options)).rejects.toThrow('process.exit called');

      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
    });

    it('should handle file write errors gracefully', async () => {
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      (fs.promises.writeFile as jest.Mock).mockRejectedValue(new Error('Write failed'));

      const options: DownloadOptions = {
        url: 'https://example.com/spec.json',
        output: './output/spec.json',
      };

      await expect(downloadAction(options)).rejects.toThrow('process.exit called');

      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
    });

    it('should handle invalid header format', async () => {
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      const options: DownloadOptions = {
        url: 'https://example.com/spec.json',
        output: './output/spec.json',
        header: ['InvalidHeader'],
      };

      await expect(downloadAction(options)).rejects.toThrow('process.exit called');

      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
    });

    it('should handle empty headers array', async () => {
      const options: DownloadOptions = {
        url: 'https://example.com/spec.json',
        output: './output/spec.json',
        header: [],
      };

      await downloadAction(options);

      expect(mockSpecLoader.load).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: {},
        })
      );
    });

    it('should use default timeout when not specified', async () => {
      const options: DownloadOptions = {
        url: 'https://example.com/spec.json',
        output: './output/spec.json',
      };

      await downloadAction(options);

      expect(mockSpecLoader.load).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 30000,
        })
      );
    });

    it('should handle directory creation errors', async () => {
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      (fs.existsSync as jest.Mock).mockReturnValue(false);
      (fs.mkdirSync as jest.Mock).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const options: DownloadOptions = {
        url: 'https://example.com/spec.json',
        output: './protected/spec.json',
      };

      await expect(downloadAction(options)).rejects.toThrow('process.exit called');

      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
    });

    it('should handle multiple headers', async () => {
      const options: DownloadOptions = {
        url: 'https://example.com/spec.json',
        output: './output/spec.json',
        header: [
          'Authorization: Bearer token',
          'X-Custom: value1',
          'X-Another: value2',
        ],
      };

      await downloadAction(options);

      expect(mockSpecLoader.load).toHaveBeenCalledWith({
        url: 'https://example.com/spec.json',
        headers: {
          Authorization: 'Bearer token',
          'X-Custom': 'value1',
          'X-Another': 'value2',
        },
        timeout: 30000,
      });
    });

    it('should combine resolveRefs with custom timeout', async () => {
      const options: DownloadOptions = {
        url: 'https://example.com/spec.json',
        output: './output/spec.json',
        resolveRefs: true,
        timeout: 45000,
      };

      await downloadAction(options);

      expect(mockSpecLoader.loadWithRefs).toHaveBeenCalledWith({
        url: 'https://example.com/spec.json',
        headers: {},
        timeout: 45000,
        resolveRefs: true,
        maxDepth: 10,
      });
    });
  });
});
