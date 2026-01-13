import { Option } from 'commander';
import {
  urlOption,
  outputOption,
  headerOption,
  timeoutOption,
  esmOption,
  nestjsSwaggerOption,
  classValidatorOption,
  templateOption,
  keepSpecOption,
  resolveRefsOption,
  exportStyleOption,
  skipJsExtensionsOption,
  crdKindCaseOption,
  includeStatusOption,
  parseHeaders,
  collectValues,
  validateTimeout,
} from '../options';

describe('Options', () => {
  describe('urlOption', () => {
    it('should create required URL option', () => {
      const option = urlOption('OpenAPI spec URL');

      expect(option).toBeInstanceOf(Option);
      expect(option.flags).toContain('-u, --url <url>');
      expect(option.mandatory).toBe(true);
    });

    it('should create optional URL option', () => {
      const option = urlOption('OpenAPI spec URL', false);

      expect(option).toBeInstanceOf(Option);
      expect(option.mandatory).toBe(false);
    });
  });

  describe('outputOption', () => {
    it('should create required output option', () => {
      const option = outputOption('Output directory');

      expect(option).toBeInstanceOf(Option);
      expect(option.flags).toContain('-o, --output <path>');
      expect(option.mandatory).toBe(true);
    });

    it('should create optional output option', () => {
      const option = outputOption('Output directory', false);

      expect(option).toBeInstanceOf(Option);
      expect(option.mandatory).toBe(false);
    });
  });

  describe('headerOption', () => {
    it('should create header option', () => {
      const option = headerOption();

      expect(option).toBeInstanceOf(Option);
      expect(option.flags).toContain('--header <header>');
    });
  });

  describe('timeoutOption', () => {
    it('should create timeout option with default value', () => {
      const option = timeoutOption();

      expect(option).toBeInstanceOf(Option);
      expect(option.flags).toContain('--timeout <ms>');
      expect(option.defaultValue).toBe(30000);
    });

    it('should have argParser defined', () => {
      const option = timeoutOption();

      expect(option.argParser).toBeDefined();
      expect(typeof option.argParser).toBe('function');
    });
  });

  describe('esmOption', () => {
    it('should create ESM option with default false', () => {
      const option = esmOption();

      expect(option).toBeInstanceOf(Option);
      expect(option.flags).toContain('--esm');
      expect(option.defaultValue).toBe(false);
    });
  });

  describe('nestjsSwaggerOption', () => {
    it('should create NestJS Swagger option with default false', () => {
      const option = nestjsSwaggerOption();

      expect(option).toBeInstanceOf(Option);
      expect(option.flags).toContain('--nestjs-swagger');
      expect(option.defaultValue).toBe(false);
    });
  });

  describe('classValidatorOption', () => {
    it('should create class validator option with default false', () => {
      const option = classValidatorOption();

      expect(option).toBeInstanceOf(Option);
      expect(option.flags).toContain('--class-validator');
      expect(option.defaultValue).toBe(false);
    });
  });

  describe('templateOption', () => {
    it('should create template option', () => {
      const option = templateOption();

      expect(option).toBeInstanceOf(Option);
      expect(option.flags).toContain('--template <dir>');
    });
  });

  describe('keepSpecOption', () => {
    it('should create keep spec option with default false', () => {
      const option = keepSpecOption();

      expect(option).toBeInstanceOf(Option);
      expect(option.flags).toContain('--keep-spec');
      expect(option.defaultValue).toBe(false);
    });
  });

  describe('resolveRefsOption', () => {
    it('should create resolve refs option with default false', () => {
      const option = resolveRefsOption();

      expect(option).toBeInstanceOf(Option);
      expect(option.flags).toContain('--resolve-refs');
      expect(option.defaultValue).toBe(false);
    });
  });

  describe('exportStyleOption', () => {
    it('should create export style option with choices', () => {
      const option = exportStyleOption();

      expect(option).toBeInstanceOf(Option);
      expect(option.flags).toContain('--export-style <style>');
      expect(option.defaultValue).toBe('namespace');
    });
  });

  describe('skipJsExtensionsOption', () => {
    it('should create skip JS extensions option with default false', () => {
      const option = skipJsExtensionsOption();

      expect(option).toBeInstanceOf(Option);
      expect(option.flags).toContain('--skip-js-extensions');
      expect(option.defaultValue).toBe(false);
    });
  });

  describe('crdKindCaseOption', () => {
    it('should create CRD kind case option with choices', () => {
      const option = crdKindCaseOption();

      expect(option).toBeInstanceOf(Option);
      expect(option.flags).toContain('--crd-kind-case <format>');
      expect(option.defaultValue).toBe('pascal');
    });
  });

  describe('includeStatusOption', () => {
    it('should create include status option with default false', () => {
      const option = includeStatusOption();

      expect(option).toBeInstanceOf(Option);
      expect(option.flags).toContain('--include-status');
      expect(option.defaultValue).toBe(false);
    });
  });

  describe('parseHeaders', () => {
    it('should parse single header', () => {
      const headers = parseHeaders(['Authorization: Bearer token123']);

      expect(headers).toEqual({
        Authorization: 'Bearer token123',
      });
    });

    it('should parse multiple headers', () => {
      const headers = parseHeaders([
        'Authorization: Bearer token123',
        'Content-Type: application/json',
        'X-Custom-Header: custom-value',
      ]);

      expect(headers).toEqual({
        Authorization: 'Bearer token123',
        'Content-Type': 'application/json',
        'X-Custom-Header': 'custom-value',
      });
    });

    it('should trim whitespace from keys and values', () => {
      const headers = parseHeaders([
        '  Authorization  :  Bearer token123  ',
        'Content-Type:application/json',
      ]);

      expect(headers).toEqual({
        Authorization: 'Bearer token123',
        'Content-Type': 'application/json',
      });
    });

    it('should handle empty array', () => {
      const headers = parseHeaders([]);

      expect(headers).toEqual({});
    });

    it('should handle header value with colon', () => {
      const headers = parseHeaders([
        'Authorization: Bearer: token:123',
      ]);

      expect(headers).toEqual({
        Authorization: 'Bearer: token:123',
      });
    });

    it('should handle empty value', () => {
      const headers = parseHeaders(['X-Empty:']);

      expect(headers).toEqual({
        'X-Empty': '',
      });
    });

    it('should throw error for missing colon', () => {
      expect(() => parseHeaders(['InvalidHeader'])).toThrow(
        'Invalid header format: "InvalidHeader". Expected format: "Key: Value"'
      );
    });

    it('should throw error for empty key', () => {
      expect(() => parseHeaders([': value'])).toThrow(
        'Invalid header format: ": value". Header key cannot be empty'
      );

      expect(() => parseHeaders(['  : value'])).toThrow(
        'Header key cannot be empty'
      );
    });

    it('should handle mixed valid and special cases', () => {
      const headers = parseHeaders([
        'Authorization: Bearer token',
        'X-Api-Key: key123',
        'Accept: application/json',
      ]);

      expect(headers).toEqual({
        Authorization: 'Bearer token',
        'X-Api-Key': 'key123',
        Accept: 'application/json',
      });
    });
  });

  describe('collectValues', () => {
    it('should collect single value', () => {
      const result = collectValues('value1', []);

      expect(result).toEqual(['value1']);
    });

    it('should collect multiple values', () => {
      let result = collectValues('value1', []);
      result = collectValues('value2', result);
      result = collectValues('value3', result);

      expect(result).toEqual(['value1', 'value2', 'value3']);
    });

    it('should not mutate original array', () => {
      const original: string[] = [];
      const result = collectValues('value1', original);

      expect(original).toEqual([]);
      expect(result).toEqual(['value1']);
      expect(result).not.toBe(original);
    });

    it('should handle duplicate values', () => {
      let result = collectValues('value1', []);
      result = collectValues('value1', result);

      expect(result).toEqual(['value1', 'value1']);
    });
  });

  describe('validateTimeout', () => {
    it('should parse valid timeout', () => {
      expect(validateTimeout('30000')).toBe(30000);
      expect(validateTimeout('1000')).toBe(1000);
      expect(validateTimeout('60000')).toBe(60000);
    });

    it('should throw error for non-numeric value', () => {
      expect(() => validateTimeout('invalid')).toThrow(
        'Invalid timeout value: "invalid". Must be a number'
      );
      expect(() => validateTimeout('abc')).toThrow('Must be a number');
      expect(() => validateTimeout('')).toThrow('Must be a number');
    });

    it('should throw error for zero', () => {
      expect(() => validateTimeout('0')).toThrow(
        'Invalid timeout value: 0. Must be greater than 0'
      );
    });

    it('should throw error for negative values', () => {
      expect(() => validateTimeout('-1')).toThrow(
        'Invalid timeout value: -1. Must be greater than 0'
      );
      expect(() => validateTimeout('-1000')).toThrow('Must be greater than 0');
    });

    it('should throw error for values exceeding maximum', () => {
      expect(() => validateTimeout('700000')).toThrow(
        'Invalid timeout value: 700000. Maximum allowed is 600000ms (10 minutes)'
      );
    });

    it('should accept maximum allowed value', () => {
      expect(validateTimeout('600000')).toBe(600000);
    });

    it('should accept value just below maximum', () => {
      expect(validateTimeout('599999')).toBe(599999);
    });

    it('should accept minimum positive value', () => {
      expect(validateTimeout('1')).toBe(1);
    });
  });
});
