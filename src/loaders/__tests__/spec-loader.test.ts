/**
 * Unit tests for SpecLoader
 */

import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { SpecLoader, SpecLoaderError } from '../spec-loader';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock fs
jest.mock('fs');
const mockedFs = fs as jest.Mocked<typeof fs>;

describe('SpecLoader', () => {
  let loader: SpecLoader;

  beforeEach(() => {
    loader = new SpecLoader();
    jest.clearAllMocks();
  });

  describe('isLocalFile', () => {
    it('should identify file:// URIs as local', () => {
      expect(loader.isLocalFile('file:///path/to/spec.yaml')).toBe(true);
    });

    it('should identify http:// URLs as remote', () => {
      expect(loader.isLocalFile('http://example.com/spec.yaml')).toBe(false);
    });

    it('should identify https:// URLs as remote', () => {
      expect(loader.isLocalFile('https://example.com/spec.yaml')).toBe(false);
    });

    it('should identify relative paths as local', () => {
      expect(loader.isLocalFile('./spec.yaml')).toBe(true);
      expect(loader.isLocalFile('../spec.yaml')).toBe(true);
    });

    it('should identify absolute paths as local', () => {
      expect(loader.isLocalFile('/path/to/spec.yaml')).toBe(true);
    });
  });

  describe('detectFormat', () => {
    it('should detect JSON format for objects', () => {
      const content = '{"openapi": "3.0.0"}';
      expect(loader.detectFormat(content)).toBe('json');
    });

    it('should detect JSON format for arrays', () => {
      const content = '[{"kind": "CustomResourceDefinition"}]';
      expect(loader.detectFormat(content)).toBe('json');
    });

    it('should detect YAML format for document markers', () => {
      const content = '---\nopenapi: 3.0.0';
      expect(loader.detectFormat(content)).toBe('yaml');
    });

    it('should detect YAML format for apiVersion', () => {
      const content = 'apiVersion: v1\nkind: Pod';
      expect(loader.detectFormat(content)).toBe('yaml');
    });

    it('should detect YAML format for openapi', () => {
      const content = 'openapi: 3.0.0\ninfo:\n  title: API';
      expect(loader.detectFormat(content)).toBe('yaml');
    });

    it('should default to YAML for ambiguous content', () => {
      const content = 'some: value\nother: thing';
      expect(loader.detectFormat(content)).toBe('yaml');
    });

    it('should handle YAML when JSON parsing fails', () => {
      const content = '{invalid json}';
      expect(loader.detectFormat(content)).toBe('yaml');
    });
  });

  describe('parseContent', () => {
    it('should parse JSON content', () => {
      const content = '{"openapi": "3.0.0", "info": {"title": "API"}}';
      const result = loader.parseContent(content, 'json');
      expect(result).toEqual({
        openapi: '3.0.0',
        info: { title: 'API' },
      });
    });

    it('should parse YAML content', () => {
      const content = 'openapi: 3.0.0\ninfo:\n  title: API';
      const result = loader.parseContent(content, 'yaml');
      expect(result).toEqual({
        openapi: '3.0.0',
        info: { title: 'API' },
      });
    });

    it('should throw error for invalid JSON', () => {
      const content = '{invalid json}';
      expect(() => loader.parseContent(content, 'json')).toThrow();
    });

    it('should throw error for invalid YAML', () => {
      const content = 'invalid:\n  yaml:\n- missing indent';
      expect(() => loader.parseContent(content, 'yaml')).toThrow();
    });
  });

  describe('loadLocalFile', () => {
    it('should read file from absolute path', () => {
      const filePath = '/absolute/path/spec.yaml';
      const content = 'openapi: 3.0.0';

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(content);

      const result = loader.loadLocalFile(filePath);
      expect(result).toBe(content);
      expect(mockedFs.readFileSync).toHaveBeenCalledWith(filePath, 'utf-8');
    });

    it('should strip file:// protocol', () => {
      const filePath = 'file:///absolute/path/spec.yaml';
      const expectedPath = '/absolute/path/spec.yaml';
      const content = 'openapi: 3.0.0';

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(content);

      const result = loader.loadLocalFile(filePath);
      expect(result).toBe(content);
      expect(mockedFs.readFileSync).toHaveBeenCalledWith(expectedPath, 'utf-8');
    });

    it('should throw error if file does not exist', () => {
      const filePath = '/nonexistent/spec.yaml';

      mockedFs.existsSync.mockReturnValue(false);

      expect(() => loader.loadLocalFile(filePath)).toThrow(SpecLoaderError);
      expect(() => loader.loadLocalFile(filePath)).toThrow('File not found');
    });

    it('should throw error if file read fails', () => {
      const filePath = '/path/spec.yaml';

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      expect(() => loader.loadLocalFile(filePath)).toThrow(SpecLoaderError);
      expect(() => loader.loadLocalFile(filePath)).toThrow('Failed to read file');
    });
  });

  describe('loadRemoteFile', () => {
    it('should fetch from remote URL', async () => {
      const url = 'https://example.com/spec.yaml';
      const content = 'openapi: 3.0.0';

      mockedAxios.get.mockResolvedValue({ data: content });

      const result = await loader.loadRemoteFile(url, { url });
      expect(result).toBe(content);
      expect(mockedAxios.get).toHaveBeenCalledWith(url, expect.objectContaining({
        timeout: 30000,
        responseType: 'text',
      }));
    });

    it('should use custom timeout', async () => {
      const url = 'https://example.com/spec.yaml';
      const content = 'openapi: 3.0.0';

      mockedAxios.get.mockResolvedValue({ data: content });

      await loader.loadRemoteFile(url, { url, timeout: 5000 });
      expect(mockedAxios.get).toHaveBeenCalledWith(url, expect.objectContaining({
        timeout: 5000,
      }));
    });

    it('should use custom headers', async () => {
      const url = 'https://example.com/spec.yaml';
      const content = 'openapi: 3.0.0';
      const headers = { Authorization: 'Bearer token' };

      mockedAxios.get.mockResolvedValue({ data: content });

      await loader.loadRemoteFile(url, { url, headers });
      expect(mockedAxios.get).toHaveBeenCalledWith(url, expect.objectContaining({
        headers,
      }));
    });

    it('should throw error on HTTP error', async () => {
      const url = 'https://example.com/spec.yaml';

      mockedAxios.get.mockRejectedValue({
        isAxiosError: true,
        response: {
          status: 404,
          statusText: 'Not Found',
        },
      });
      mockedAxios.isAxiosError.mockReturnValue(true);

      await expect(loader.loadRemoteFile(url, { url })).rejects.toThrow(SpecLoaderError);
      await expect(loader.loadRemoteFile(url, { url })).rejects.toThrow('HTTP 404');
    });

    it('should throw error on network error', async () => {
      const url = 'https://example.com/spec.yaml';

      mockedAxios.get.mockRejectedValue({
        isAxiosError: true,
        message: 'Network error',
      });
      mockedAxios.isAxiosError.mockReturnValue(true);

      await expect(loader.loadRemoteFile(url, { url })).rejects.toThrow(SpecLoaderError);
      await expect(loader.loadRemoteFile(url, { url })).rejects.toThrow('Network error');
    });
  });

  describe('load', () => {
    it('should load and parse local JSON file', async () => {
      const filePath = './spec.json';
      const content = '{"openapi": "3.0.0"}';

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(content);

      const result = await loader.load({ url: filePath });
      expect(result).toEqual({ openapi: '3.0.0' });
    });

    it('should load and parse local YAML file', async () => {
      const filePath = './spec.yaml';
      const content = 'openapi: 3.0.0';

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(content);

      const result = await loader.load({ url: filePath });
      expect(result).toEqual({ openapi: '3.0.0' });
    });

    it('should load and parse remote JSON file', async () => {
      const url = 'https://example.com/spec.json';
      const content = '{"openapi": "3.0.0"}';

      mockedAxios.get.mockResolvedValue({ data: content });

      const result = await loader.load({ url });
      expect(result).toEqual({ openapi: '3.0.0' });
    });

    it('should load and parse remote YAML file', async () => {
      const url = 'https://example.com/spec.yaml';
      const content = 'openapi: 3.0.0';

      mockedAxios.get.mockResolvedValue({ data: content });

      const result = await loader.load({ url });
      expect(result).toEqual({ openapi: '3.0.0' });
    });

    it('should respect explicit format option', async () => {
      const filePath = './spec.yaml';
      const content = '{"openapi": "3.0.0"}';

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(content);

      const result = await loader.load({ url: filePath, format: 'json' });
      expect(result).toEqual({ openapi: '3.0.0' });
    });

    it('should throw SpecLoaderError on failure', async () => {
      const filePath = './nonexistent.yaml';

      mockedFs.existsSync.mockReturnValue(false);

      await expect(loader.load({ url: filePath })).rejects.toThrow(SpecLoaderError);
    });
  });

  describe('loadMultiDocument', () => {
    it('should load multiple YAML documents from local file', async () => {
      const filePath = './crds.yaml';
      const content = `---
apiVersion: v1
kind: CRD1
---
apiVersion: v1
kind: CRD2`;

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(content);

      const result = await loader.loadMultiDocument({ url: filePath });
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ apiVersion: 'v1', kind: 'CRD1' });
      expect(result[1]).toEqual({ apiVersion: 'v1', kind: 'CRD2' });
    });

    it('should load multiple YAML documents from remote URL', async () => {
      const url = 'https://example.com/crds.yaml';
      const content = `---
apiVersion: v1
kind: CRD1
---
apiVersion: v1
kind: CRD2`;

      mockedAxios.get.mockResolvedValue({ data: content });

      const result = await loader.loadMultiDocument({ url });
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ apiVersion: 'v1', kind: 'CRD1' });
      expect(result[1]).toEqual({ apiVersion: 'v1', kind: 'CRD2' });
    });

    it('should filter out null documents', async () => {
      const filePath = './crds.yaml';
      const content = `---
apiVersion: v1
kind: CRD1
---
---
apiVersion: v1
kind: CRD2`;

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(content);

      const result = await loader.loadMultiDocument({ url: filePath });
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ apiVersion: 'v1', kind: 'CRD1' });
      expect(result[1]).toEqual({ apiVersion: 'v1', kind: 'CRD2' });
    });

    it('should throw SpecLoaderError on failure', async () => {
      const filePath = './nonexistent.yaml';

      mockedFs.existsSync.mockReturnValue(false);

      await expect(loader.loadMultiDocument({ url: filePath })).rejects.toThrow(SpecLoaderError);
    });
  });

  describe('loadWithRefs', () => {
    it('should load spec without resolving refs when resolveRefs=false', async () => {
      const filePath = './spec.yaml';
      const content = `openapi: 3.0.0
components:
  schemas:
    Pet:
      $ref: './schemas/Pet.yaml'`;

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(content);

      const result = await loader.loadWithRefs({
        url: filePath,
        resolveRefs: false,
      });

      // Refs should NOT be resolved
      expect(result.components.schemas.Pet).toEqual({
        $ref: './schemas/Pet.yaml',
      });
    });

    it('should load spec and resolve external refs when resolveRefs=true', async () => {
      const mainSpecPath = './main.yaml';
      const mainContent = `openapi: 3.0.0
components:
  schemas:
    Pet:
      $ref: './schemas/Pet.yaml'`;

      const petContent = `type: object
properties:
  name:
    type: string`;

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockImplementation((path: any) => {
        if (path.includes('main.yaml')) {
          return mainContent;
        }
        if (path.includes('Pet.yaml')) {
          return petContent;
        }
        return '';
      });

      const result = await loader.loadWithRefs({
        url: mainSpecPath,
        resolveRefs: true,
      });

      // Refs should be resolved and inlined
      expect(result.components.schemas.Pet).toEqual({
        type: 'object',
        properties: {
          name: {
            type: 'string',
          },
        },
      });
    });

    it('should resolve refs by default', async () => {
      const mainSpecPath = './main.yaml';
      const mainContent = `openapi: 3.0.0
components:
  schemas:
    Pet:
      $ref: './schemas/Pet.yaml'`;

      const petContent = `type: object
properties:
  name:
    type: string`;

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockImplementation((path: any) => {
        if (path.includes('main.yaml')) {
          return mainContent;
        }
        if (path.includes('Pet.yaml')) {
          return petContent;
        }
        return '';
      });

      // Not specifying resolveRefs - should default to true
      const result = await loader.loadWithRefs({
        url: mainSpecPath,
      });

      // Refs should be resolved
      expect(result.components.schemas.Pet).toEqual({
        type: 'object',
        properties: {
          name: {
            type: 'string',
          },
        },
      });
    });

    it('should pass auth headers to ref resolution', async () => {
      const url = 'https://example.com/spec.yaml';
      const mainContent = `openapi: 3.0.0
components:
  schemas:
    Pet:
      $ref: 'https://example.com/schemas/Pet.yaml'`;

      const petContent = `type: object
properties:
  name:
    type: string`;

      mockedAxios.get.mockImplementation((url: string) => {
        if (url.includes('spec.yaml')) {
          return Promise.resolve({ data: mainContent });
        }
        if (url.includes('Pet.yaml')) {
          return Promise.resolve({ data: petContent });
        }
        return Promise.reject(new Error('Not found'));
      });

      const headers = { Authorization: 'Bearer token' };

      await loader.loadWithRefs({
        url,
        resolveRefs: true,
        headers,
      });

      // Check that headers were passed to all requests
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ headers })
      );
    });

    it('should pass timeout to ref resolution', async () => {
      const url = 'https://example.com/spec.yaml';
      const mainContent = `openapi: 3.0.0
components:
  schemas:
    Pet:
      $ref: 'https://example.com/schemas/Pet.yaml'`;

      const petContent = `type: object`;

      mockedAxios.get.mockImplementation((url: string) => {
        if (url.includes('spec.yaml')) {
          return Promise.resolve({ data: mainContent });
        }
        if (url.includes('Pet.yaml')) {
          return Promise.resolve({ data: petContent });
        }
        return Promise.reject(new Error('Not found'));
      });

      await loader.loadWithRefs({
        url,
        resolveRefs: true,
        timeout: 5000,
      });

      // Check that timeout was passed to all requests
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ timeout: 5000 })
      );
    });

    it('should respect maxDepth option', async () => {
      const mainSpecPath = './main.yaml';
      const mainContent = `openapi: 3.0.0
components:
  schemas:
    Pet:
      $ref: './schemas/Pet.yaml'`;

      const petContent = `type: object
properties:
  owner:
    $ref: './User.yaml'`;

      const userContent = `type: object
properties:
  name:
    type: string`;

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockImplementation((path: any) => {
        if (path.includes('main.yaml')) {
          return mainContent;
        }
        if (path.includes('Pet.yaml')) {
          return petContent;
        }
        if (path.includes('User.yaml')) {
          return userContent;
        }
        return '';
      });

      const result = await loader.loadWithRefs({
        url: mainSpecPath,
        resolveRefs: true,
        maxDepth: 10,
      });

      // Nested refs should be resolved
      expect(result.components.schemas.Pet.properties.owner).toEqual({
        type: 'object',
        properties: {
          name: {
            type: 'string',
          },
        },
      });
    });

    it('should throw SpecLoaderError on failure', async () => {
      const filePath = './nonexistent.yaml';

      mockedFs.existsSync.mockReturnValue(false);

      await expect(
        loader.loadWithRefs({
          url: filePath,
          resolveRefs: true,
        })
      ).rejects.toThrow(SpecLoaderError);
    });

    it('should preserve internal refs', async () => {
      const mainSpecPath = './main.yaml';
      const mainContent = `openapi: 3.0.0
components:
  schemas:
    Pet:
      type: object
      properties:
        owner:
          $ref: '#/components/schemas/User'
    User:
      type: object
      properties:
        name:
          type: string`;

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(mainContent);

      const result = await loader.loadWithRefs({
        url: mainSpecPath,
        resolveRefs: true,
      });

      // Internal refs should be preserved
      expect(result.components.schemas.Pet.properties.owner).toEqual({
        $ref: '#/components/schemas/User',
      });
    });

    it('should handle mixed internal and external refs', async () => {
      const mainSpecPath = './main.yaml';
      const mainContent = `openapi: 3.0.0
components:
  schemas:
    Pet:
      $ref: './schemas/Pet.yaml'
    User:
      type: object
      properties:
        pet:
          $ref: '#/components/schemas/Pet'`;

      const petContent = `type: object
properties:
  name:
    type: string`;

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockImplementation((path: any) => {
        if (path.includes('main.yaml')) {
          return mainContent;
        }
        if (path.includes('Pet.yaml')) {
          return petContent;
        }
        return '';
      });

      const result = await loader.loadWithRefs({
        url: mainSpecPath,
        resolveRefs: true,
      });

      // External ref should be inlined
      expect(result.components.schemas.Pet).toEqual({
        type: 'object',
        properties: {
          name: {
            type: 'string',
          },
        },
      });

      // Internal ref should be preserved
      expect(result.components.schemas.User.properties.pet).toEqual({
        $ref: '#/components/schemas/Pet',
      });
    });
  });
});
