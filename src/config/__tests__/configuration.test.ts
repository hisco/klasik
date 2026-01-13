import { Configuration, ConfigurationParameters } from '../configuration';

describe('Configuration', () => {
  describe('constructor', () => {
    it('should create configuration with default values', () => {
      const config = new Configuration();

      expect(config.basePath).toBe('');
      expect(config.headers).toEqual({});
      expect(config.timeout).toBe(30000);
      expect(config.enableResponseTransformation).toBe(true);
      expect(config.onTransformationError).toBeUndefined();
    });

    it('should create configuration with custom values', () => {
      const errorHandler = jest.fn();
      const params: ConfigurationParameters = {
        basePath: 'https://api.example.com',
        headers: { Authorization: 'Bearer token123' },
        timeout: 60000,
        enableResponseTransformation: false,
        onTransformationError: errorHandler,
      };

      const config = new Configuration(params);

      expect(config.basePath).toBe('https://api.example.com');
      expect(config.headers).toEqual({ Authorization: 'Bearer token123' });
      expect(config.timeout).toBe(60000);
      expect(config.enableResponseTransformation).toBe(false);
      expect(config.onTransformationError).toBe(errorHandler);
    });

    it('should handle partial configuration parameters', () => {
      const config = new Configuration({
        basePath: 'https://api.example.com',
        headers: { 'X-Custom': 'value' },
      });

      expect(config.basePath).toBe('https://api.example.com');
      expect(config.headers).toEqual({ 'X-Custom': 'value' });
      expect(config.timeout).toBe(30000);
      expect(config.enableResponseTransformation).toBe(true);
    });

    it('should handle enableResponseTransformation explicitly set to false', () => {
      const config = new Configuration({
        enableResponseTransformation: false,
      });

      expect(config.enableResponseTransformation).toBe(false);
    });
  });

  describe('mergeHeaders', () => {
    it('should merge additional headers with existing headers', () => {
      const config = new Configuration({
        headers: {
          Authorization: 'Bearer token123',
          'X-Custom': 'existing',
        },
      });

      const merged = config.mergeHeaders({
        'X-Another': 'new',
        'Content-Type': 'application/json',
      });

      expect(merged).toEqual({
        Authorization: 'Bearer token123',
        'X-Custom': 'existing',
        'X-Another': 'new',
        'Content-Type': 'application/json',
      });
    });

    it('should override existing headers with same key', () => {
      const config = new Configuration({
        headers: {
          Authorization: 'Bearer old-token',
          'X-Custom': 'value',
        },
      });

      const merged = config.mergeHeaders({
        Authorization: 'Bearer new-token',
      });

      expect(merged).toEqual({
        Authorization: 'Bearer new-token',
        'X-Custom': 'value',
      });
    });

    it('should return copy when merging empty headers', () => {
      const config = new Configuration({
        headers: { Authorization: 'Bearer token' },
      });

      const merged = config.mergeHeaders({});

      expect(merged).toEqual({ Authorization: 'Bearer token' });
      expect(merged).not.toBe(config.headers);
    });

    it('should work with empty initial headers', () => {
      const config = new Configuration();

      const merged = config.mergeHeaders({
        'X-Custom': 'value',
      });

      expect(merged).toEqual({ 'X-Custom': 'value' });
    });
  });

  describe('clone', () => {
    it('should clone configuration without overrides', () => {
      const errorHandler = jest.fn();
      const original = new Configuration({
        basePath: 'https://api.example.com',
        headers: { Authorization: 'Bearer token' },
        timeout: 60000,
        enableResponseTransformation: false,
        onTransformationError: errorHandler,
      });

      const cloned = original.clone();

      expect(cloned).toBeInstanceOf(Configuration);
      expect(cloned.basePath).toBe(original.basePath);
      expect(cloned.headers).toEqual(original.headers);
      expect(cloned.headers).not.toBe(original.headers); // Should be a copy
      expect(cloned.timeout).toBe(original.timeout);
      expect(cloned.enableResponseTransformation).toBe(original.enableResponseTransformation);
      expect(cloned.onTransformationError).toBe(original.onTransformationError);
    });

    it('should clone with basePath override', () => {
      const original = new Configuration({
        basePath: 'https://api.example.com',
        headers: { Authorization: 'Bearer token' },
      });

      const cloned = original.clone({
        basePath: 'https://api.different.com',
      });

      expect(cloned.basePath).toBe('https://api.different.com');
      expect(cloned.headers).toEqual(original.headers);
    });

    it('should clone with headers override and merge', () => {
      const original = new Configuration({
        headers: {
          Authorization: 'Bearer token',
          'X-Custom': 'value',
        },
      });

      const cloned = original.clone({
        headers: { 'X-Another': 'new' },
      });

      expect(cloned.headers).toEqual({
        Authorization: 'Bearer token',
        'X-Custom': 'value',
        'X-Another': 'new',
      });
    });

    it('should clone with timeout override', () => {
      const original = new Configuration({ timeout: 30000 });

      const cloned = original.clone({ timeout: 90000 });

      expect(cloned.timeout).toBe(90000);
      expect(original.timeout).toBe(30000);
    });

    it('should clone with enableResponseTransformation override', () => {
      const original = new Configuration({
        enableResponseTransformation: true,
      });

      const cloned = original.clone({
        enableResponseTransformation: false,
      });

      expect(cloned.enableResponseTransformation).toBe(false);
      expect(original.enableResponseTransformation).toBe(true);
    });

    it('should clone with onTransformationError override', () => {
      const originalHandler = jest.fn();
      const newHandler = jest.fn();

      const original = new Configuration({
        onTransformationError: originalHandler,
      });

      const cloned = original.clone({
        onTransformationError: newHandler,
      });

      expect(cloned.onTransformationError).toBe(newHandler);
      expect(original.onTransformationError).toBe(originalHandler);
    });

    it('should clone with multiple overrides', () => {
      const original = new Configuration({
        basePath: 'https://api.example.com',
        headers: { Authorization: 'Bearer old' },
        timeout: 30000,
        enableResponseTransformation: true,
      });

      const cloned = original.clone({
        basePath: 'https://api.new.com',
        headers: { 'X-Custom': 'value' },
        timeout: 60000,
      });

      expect(cloned.basePath).toBe('https://api.new.com');
      expect(cloned.headers).toEqual({
        Authorization: 'Bearer old',
        'X-Custom': 'value',
      });
      expect(cloned.timeout).toBe(60000);
      expect(cloned.enableResponseTransformation).toBe(true);
    });

    it('should not mutate original configuration when cloning', () => {
      const original = new Configuration({
        basePath: 'https://api.example.com',
        headers: { Authorization: 'Bearer token' },
        timeout: 30000,
      });

      const cloned = original.clone({
        basePath: 'https://api.new.com',
        headers: { 'X-Custom': 'value' },
        timeout: 60000,
      });

      // Original should remain unchanged
      expect(original.basePath).toBe('https://api.example.com');
      expect(original.headers).toEqual({ Authorization: 'Bearer token' });
      expect(original.timeout).toBe(30000);

      // Cloned should have new values
      expect(cloned.basePath).toBe('https://api.new.com');
      expect(cloned.headers).toEqual({
        Authorization: 'Bearer token',
        'X-Custom': 'value',
      });
      expect(cloned.timeout).toBe(60000);
    });
  });
});
