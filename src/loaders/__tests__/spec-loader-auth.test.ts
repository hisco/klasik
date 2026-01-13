import axios from 'axios';
import { SpecLoader, SpecLoaderError } from '../spec-loader';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('SpecLoader - Authentication', () => {
  let loader: SpecLoader;

  beforeEach(() => {
    loader = new SpecLoader();
    jest.clearAllMocks();
  });

  describe('custom headers', () => {
    it('should pass custom headers to axios', async () => {
      const mockSpec = { openapi: '3.0.0', info: { title: 'Test API' } };
      mockedAxios.get.mockResolvedValue({ data: JSON.stringify(mockSpec) });

      const headers = {
        'Authorization': 'Bearer token123',
        'X-Api-Key': 'key456',
        'X-Custom-Header': 'custom-value',
      };

      await loader.load({
        url: 'https://api.example.com/openapi.json',
        headers,
      });

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.example.com/openapi.json',
        expect.objectContaining({
          headers,
        })
      );
    });

    it('should pass Authorization header for protected API', async () => {
      const mockSpec = { openapi: '3.0.0' };
      mockedAxios.get.mockResolvedValue({ data: JSON.stringify(mockSpec) });

      await loader.load({
        url: 'https://api.example.com/spec.json',
        headers: {
          'Authorization': 'Bearer my-secret-token',
        },
      });

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.example.com/spec.json',
        expect.objectContaining({
          headers: {
            'Authorization': 'Bearer my-secret-token',
          },
        })
      );
    });

    it('should pass multiple custom headers', async () => {
      const mockSpec = { openapi: '3.0.0' };
      mockedAxios.get.mockResolvedValue({ data: JSON.stringify(mockSpec) });

      await loader.load({
        url: 'https://api.example.com/spec.json',
        headers: {
          'Authorization': 'Bearer token',
          'X-Api-Version': '2.0',
          'X-Request-Id': 'req-123',
        },
      });

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.example.com/spec.json',
        expect.objectContaining({
          headers: {
            'Authorization': 'Bearer token',
            'X-Api-Version': '2.0',
            'X-Request-Id': 'req-123',
          },
        })
      );
    });

    it('should work without custom headers', async () => {
      const mockSpec = { openapi: '3.0.0' };
      mockedAxios.get.mockResolvedValue({ data: JSON.stringify(mockSpec) });

      await loader.load({
        url: 'https://api.example.com/spec.json',
      });

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.example.com/spec.json',
        expect.objectContaining({
          headers: {},
        })
      );
    });

    it('should pass empty headers object when not provided', async () => {
      const mockSpec = { openapi: '3.0.0' };
      mockedAxios.get.mockResolvedValue({ data: JSON.stringify(mockSpec) });

      await loader.load({
        url: 'https://api.example.com/spec.json',
        headers: undefined,
      });

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.example.com/spec.json',
        expect.objectContaining({
          headers: {},
        })
      );
    });
  });

  describe('custom timeout', () => {
    it('should use custom timeout value', async () => {
      const mockSpec = { openapi: '3.0.0' };
      mockedAxios.get.mockResolvedValue({ data: JSON.stringify(mockSpec) });

      await loader.load({
        url: 'https://api.example.com/spec.json',
        timeout: 60000,
      });

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.example.com/spec.json',
        expect.objectContaining({
          timeout: 60000,
        })
      );
    });

    it('should use default timeout when not provided', async () => {
      const mockSpec = { openapi: '3.0.0' };
      mockedAxios.get.mockResolvedValue({ data: JSON.stringify(mockSpec) });

      await loader.load({
        url: 'https://api.example.com/spec.json',
      });

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.example.com/spec.json',
        expect.objectContaining({
          timeout: 30000,
        })
      );
    });

    it('should support very short timeout', async () => {
      const mockSpec = { openapi: '3.0.0' };
      mockedAxios.get.mockResolvedValue({ data: JSON.stringify(mockSpec) });

      await loader.load({
        url: 'https://api.example.com/spec.json',
        timeout: 5000,
      });

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.example.com/spec.json',
        expect.objectContaining({
          timeout: 5000,
        })
      );
    });

    it('should support very long timeout', async () => {
      const mockSpec = { openapi: '3.0.0' };
      mockedAxios.get.mockResolvedValue({ data: JSON.stringify(mockSpec) });

      await loader.load({
        url: 'https://api.example.com/spec.json',
        timeout: 120000,
      });

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.example.com/spec.json',
        expect.objectContaining({
          timeout: 120000,
        })
      );
    });
  });

  describe('authentication error handling', () => {
    it('should handle 401 Unauthorized error', async () => {
      mockedAxios.get.mockRejectedValue({
        isAxiosError: true,
        response: {
          status: 401,
          statusText: 'Unauthorized',
        },
        message: 'Request failed with status code 401',
      });
      mockedAxios.isAxiosError.mockReturnValue(true);

      await expect(
        loader.load({
          url: 'https://api.example.com/spec.json',
        })
      ).rejects.toThrow(SpecLoaderError);

      await expect(
        loader.load({
          url: 'https://api.example.com/spec.json',
        })
      ).rejects.toThrow('HTTP 401: Unauthorized');
    });

    it('should handle 403 Forbidden error', async () => {
      mockedAxios.get.mockRejectedValue({
        isAxiosError: true,
        response: {
          status: 403,
          statusText: 'Forbidden',
        },
        message: 'Request failed with status code 403',
      });
      mockedAxios.isAxiosError.mockReturnValue(true);

      await expect(
        loader.load({
          url: 'https://api.example.com/spec.json',
        })
      ).rejects.toThrow(SpecLoaderError);

      await expect(
        loader.load({
          url: 'https://api.example.com/spec.json',
        })
      ).rejects.toThrow('HTTP 403: Forbidden');
    });

    it('should provide helpful error message for missing authentication', async () => {
      mockedAxios.get.mockRejectedValue({
        isAxiosError: true,
        response: {
          status: 401,
          statusText: 'Unauthorized',
        },
        message: 'Request failed with status code 401',
      });
      mockedAxios.isAxiosError.mockReturnValue(true);

      await expect(
        loader.load({
          url: 'https://api.example.com/protected/spec.json',
        })
      ).rejects.toThrow('Failed to fetch https://api.example.com/protected/spec.json: HTTP 401: Unauthorized');
    });

    it('should handle timeout error', async () => {
      mockedAxios.get.mockRejectedValue({
        isAxiosError: true,
        message: 'timeout of 5000ms exceeded',
      });
      mockedAxios.isAxiosError.mockReturnValue(true);

      await expect(
        loader.load({
          url: 'https://api.example.com/spec.json',
          timeout: 5000,
        })
      ).rejects.toThrow('timeout of 5000ms exceeded');
    });

    it('should handle network error', async () => {
      mockedAxios.get.mockRejectedValue({
        isAxiosError: true,
        message: 'Network Error',
      });
      mockedAxios.isAxiosError.mockReturnValue(true);

      await expect(
        loader.load({
          url: 'https://api.example.com/spec.json',
        })
      ).rejects.toThrow('Network Error');
    });
  });

  describe('combined headers and timeout', () => {
    it('should pass both custom headers and timeout', async () => {
      const mockSpec = { openapi: '3.0.0' };
      mockedAxios.get.mockResolvedValue({ data: JSON.stringify(mockSpec) });

      await loader.load({
        url: 'https://api.example.com/spec.json',
        headers: {
          'Authorization': 'Bearer token',
          'X-Api-Key': 'key123',
        },
        timeout: 45000,
      });

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.example.com/spec.json',
        expect.objectContaining({
          headers: {
            'Authorization': 'Bearer token',
            'X-Api-Key': 'key123',
          },
          timeout: 45000,
        })
      );
    });

    it('should include responseType in config', async () => {
      const mockSpec = { openapi: '3.0.0' };
      mockedAxios.get.mockResolvedValue({ data: JSON.stringify(mockSpec) });

      await loader.load({
        url: 'https://api.example.com/spec.json',
        headers: { 'Authorization': 'Bearer token' },
        timeout: 60000,
      });

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.example.com/spec.json',
        expect.objectContaining({
          headers: { 'Authorization': 'Bearer token' },
          timeout: 60000,
          responseType: 'text',
        })
      );
    });
  });

  describe('YAML specs with authentication', () => {
    it('should load YAML spec with authentication headers', async () => {
      const mockYaml = `openapi: 3.0.0
info:
  title: Test API
  version: 1.0.0`;
      mockedAxios.get.mockResolvedValue({ data: mockYaml });

      const result = await loader.load({
        url: 'https://api.example.com/openapi.yaml',
        headers: {
          'Authorization': 'Bearer token',
        },
      });

      expect(result).toEqual({
        openapi: '3.0.0',
        info: {
          title: 'Test API',
          version: '1.0.0',
        },
      });

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.example.com/openapi.yaml',
        expect.objectContaining({
          headers: {
            'Authorization': 'Bearer token',
          },
        })
      );
    });
  });

  describe('multi-document with authentication', () => {
    it('should load multi-document YAML with authentication', async () => {
      const mockYaml = `---
apiVersion: v1
kind: CustomResourceDefinition
metadata:
  name: crd1
---
apiVersion: v1
kind: CustomResourceDefinition
metadata:
  name: crd2`;
      mockedAxios.get.mockResolvedValue({ data: mockYaml });

      const result = await loader.loadMultiDocument({
        url: 'https://api.example.com/crds.yaml',
        headers: {
          'Authorization': 'Bearer token',
        },
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        apiVersion: 'v1',
        kind: 'CustomResourceDefinition',
        metadata: { name: 'crd1' },
      });

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.example.com/crds.yaml',
        expect.objectContaining({
          headers: {
            'Authorization': 'Bearer token',
          },
        })
      );
    });
  });
});
