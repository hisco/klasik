/**
 * Tests for name utility functions
 * Comprehensive coverage of all case transformations and edge cases
 */

import {
  toKebabCase,
  toSnakeCase,
  toPascalCase,
  toCamelCase,
  sanitizeIdentifier,
  makeUnique
} from '../name-utils';

describe('name-utils', () => {
  describe('toKebabCase', () => {
    it('should convert PascalCase to kebab-case', () => {
      expect(toKebabCase('UserProfile')).toBe('user-profile');
      expect(toKebabCase('AppProject')).toBe('app-project');
      expect(toKebabCase('MyClass')).toBe('my-class');
    });

    it('should convert camelCase to kebab-case', () => {
      expect(toKebabCase('userProfile')).toBe('user-profile');
      expect(toKebabCase('appProject')).toBe('app-project');
      expect(toKebabCase('myClass')).toBe('my-class');
    });

    it('should handle consecutive capital letters', () => {
      expect(toKebabCase('XMLHttpRequest')).toBe('xml-http-request');
      expect(toKebabCase('HTTPSConnection')).toBe('https-connection');
      expect(toKebabCase('XMLParser')).toBe('xml-parser');
      expect(toKebabCase('IOError')).toBe('io-error');
    });

    it('should handle single word', () => {
      expect(toKebabCase('User')).toBe('user');
      expect(toKebabCase('user')).toBe('user');
      expect(toKebabCase('POST')).toBe('post');
    });

    it('should handle empty string', () => {
      expect(toKebabCase('')).toBe('');
    });

    it('should handle strings with numbers', () => {
      expect(toKebabCase('User2Profile')).toBe('user2-profile');
      expect(toKebabCase('HTTP2Request')).toBe('http2-request');
      expect(toKebabCase('base64Encode')).toBe('base64-encode');
      expect(toKebabCase('v1Alpha1')).toBe('v1-alpha1');
    });

    it('should handle strings that are already kebab-case', () => {
      expect(toKebabCase('already-kebab-case')).toBe('already-kebab-case');
      expect(toKebabCase('my-file-name')).toBe('my-file-name');
    });

    it('should handle single character', () => {
      expect(toKebabCase('A')).toBe('a');
      expect(toKebabCase('x')).toBe('x');
    });

    it('should handle mixed case with numbers in middle', () => {
      expect(toKebabCase('Base64Encoder')).toBe('base64-encoder');
      expect(toKebabCase('MD5Hash')).toBe('md5-hash');
    });
  });

  describe('toSnakeCase', () => {
    it('should convert PascalCase to snake_case', () => {
      expect(toSnakeCase('UserProfile')).toBe('user_profile');
      expect(toSnakeCase('AppProject')).toBe('app_project');
      expect(toSnakeCase('MyClass')).toBe('my_class');
    });

    it('should convert camelCase to snake_case', () => {
      expect(toSnakeCase('userProfile')).toBe('user_profile');
      expect(toSnakeCase('appProject')).toBe('app_project');
      expect(toSnakeCase('myClass')).toBe('my_class');
    });

    it('should handle consecutive capital letters', () => {
      expect(toSnakeCase('XMLHttpRequest')).toBe('xml_http_request');
      expect(toSnakeCase('HTTPSConnection')).toBe('https_connection');
      expect(toSnakeCase('XMLParser')).toBe('xml_parser');
      expect(toSnakeCase('IOError')).toBe('io_error');
    });

    it('should handle single word', () => {
      expect(toSnakeCase('User')).toBe('user');
      expect(toSnakeCase('user')).toBe('user');
      expect(toSnakeCase('POST')).toBe('post');
    });

    it('should handle empty string', () => {
      expect(toSnakeCase('')).toBe('');
    });

    it('should handle strings with numbers', () => {
      expect(toSnakeCase('User2Profile')).toBe('user2_profile');
      expect(toSnakeCase('HTTP2Request')).toBe('http2_request');
      expect(toSnakeCase('base64Encode')).toBe('base64_encode');
    });

    it('should handle strings that are already snake_case', () => {
      expect(toSnakeCase('already_snake_case')).toBe('already_snake_case');
      expect(toSnakeCase('my_var_name')).toBe('my_var_name');
    });
  });

  describe('toPascalCase', () => {
    it('should convert kebab-case to PascalCase', () => {
      expect(toPascalCase('user-profile')).toBe('UserProfile');
      expect(toPascalCase('app-project')).toBe('AppProject');
      expect(toPascalCase('my-class')).toBe('MyClass');
    });

    it('should convert snake_case to PascalCase', () => {
      expect(toPascalCase('user_profile')).toBe('UserProfile');
      expect(toPascalCase('app_project')).toBe('AppProject');
      expect(toPascalCase('my_class')).toBe('MyClass');
    });

    it('should handle single word', () => {
      expect(toPascalCase('user')).toBe('User');
      expect(toPascalCase('post')).toBe('Post');
    });

    it('should handle empty string', () => {
      expect(toPascalCase('')).toBe('');
    });

    it('should handle multiple delimiters', () => {
      expect(toPascalCase('user-profile_name')).toBe('UserProfileName');
      expect(toPascalCase('my-complex_identifier-here')).toBe('MyComplexIdentifierHere');
    });

    it('should handle already PascalCase', () => {
      // When already PascalCase, it will lowercase everything except first letter
      // because split on [-_] treats it as one word
      expect(toPascalCase('UserProfile')).toBe('Userprofile');
      expect(toPascalCase('MyClass')).toBe('Myclass');
    });

    it('should handle consecutive delimiters', () => {
      expect(toPascalCase('user--profile')).toBe('UserProfile');
      expect(toPascalCase('app__project')).toBe('AppProject');
      expect(toPascalCase('my---class')).toBe('MyClass');
    });

    it('should handle delimiters at start and end', () => {
      expect(toPascalCase('-user-profile-')).toBe('UserProfile');
      expect(toPascalCase('_app_project_')).toBe('AppProject');
    });

    it('should handle strings with numbers', () => {
      expect(toPascalCase('user-2-profile')).toBe('User2Profile');
      expect(toPascalCase('http-2-request')).toBe('Http2Request');
    });

    it('should handle single character words', () => {
      expect(toPascalCase('a-b-c')).toBe('ABC');
      expect(toPascalCase('x_y_z')).toBe('XYZ');
    });

    it('should handle all uppercase input', () => {
      expect(toPascalCase('USER-PROFILE')).toBe('UserProfile');
      expect(toPascalCase('HTTP_REQUEST')).toBe('HttpRequest');
    });

    it('should handle mixed case input', () => {
      expect(toPascalCase('User-Profile')).toBe('UserProfile');
      expect(toPascalCase('myApp-Config')).toBe('MyappConfig');
    });
  });

  describe('toCamelCase', () => {
    it('should convert kebab-case to camelCase', () => {
      expect(toCamelCase('user-profile')).toBe('userProfile');
      expect(toCamelCase('app-project')).toBe('appProject');
      expect(toCamelCase('my-class')).toBe('myClass');
    });

    it('should convert snake_case to camelCase', () => {
      expect(toCamelCase('user_profile')).toBe('userProfile');
      expect(toCamelCase('app_project')).toBe('appProject');
      expect(toCamelCase('my_class')).toBe('myClass');
    });

    it('should handle single word', () => {
      expect(toCamelCase('user')).toBe('user');
      expect(toCamelCase('post')).toBe('post');
    });

    it('should handle empty string', () => {
      expect(toCamelCase('')).toBe('');
    });

    it('should handle multiple delimiters', () => {
      expect(toCamelCase('user-profile_name')).toBe('userProfileName');
      expect(toCamelCase('my-complex_identifier-here')).toBe('myComplexIdentifierHere');
    });

    it('should handle strings with numbers', () => {
      expect(toCamelCase('user-2-profile')).toBe('user2Profile');
      expect(toCamelCase('http-2-request')).toBe('http2Request');
    });

    it('should handle single character words', () => {
      expect(toCamelCase('a-b-c')).toBe('aBC');
      expect(toCamelCase('x_y_z')).toBe('xYZ');
    });

    it('should handle already camelCase', () => {
      // When already camelCase, split on [-_] treats as one word
      expect(toCamelCase('userProfile')).toBe('userprofile');
      expect(toCamelCase('myClass')).toBe('myclass');
    });
  });

  describe('sanitizeIdentifier', () => {
    it('should replace invalid characters with underscore', () => {
      expect(sanitizeIdentifier('my-file')).toBe('my_file');
      expect(sanitizeIdentifier('my.file')).toBe('my_file');
      expect(sanitizeIdentifier('my@file')).toBe('my_file');
      expect(sanitizeIdentifier('my file')).toBe('my_file');
      expect(sanitizeIdentifier('my#file')).toBe('my_file');
      expect(sanitizeIdentifier('my%file')).toBe('my_file');
    });

    it('should handle identifier starting with number', () => {
      expect(sanitizeIdentifier('123file')).toBe('_123file');
      expect(sanitizeIdentifier('456')).toBe('_456');
      expect(sanitizeIdentifier('7abc')).toBe('_7abc');
    });

    it('should allow valid characters (letters, numbers, _, $)', () => {
      expect(sanitizeIdentifier('valid_identifier$123')).toBe('valid_identifier$123');
      expect(sanitizeIdentifier('myVar123')).toBe('myVar123');
      expect(sanitizeIdentifier('$jQuery')).toBe('$jQuery');
      expect(sanitizeIdentifier('_private')).toBe('_private');
    });

    it('should handle empty string', () => {
      expect(sanitizeIdentifier('')).toBe('');
    });

    it('should handle unicode characters', () => {
      // user-名前: 'user' + '-' (→'_') + '名' (→'_') + '前' (→'_') = 'user___'
      expect(sanitizeIdentifier('user-名前')).toBe('user___');
      // café: 'caf' + 'é' (→'_')
      expect(sanitizeIdentifier('café')).toBe('caf_');
      // Ñoño: 'Ñ' (→'_', then '_ $1' if starts with number, but not number) + 'o' + 'ñ' (→'_') + 'o'
      // Actually: 'Ñ' (→'_') + 'o' + 'ñ' (→'_') + 'o' = '_o_o'
      expect(sanitizeIdentifier('Ñoño')).toBe('_o_o');
    });

    it('should handle multiple special characters in a row', () => {
      expect(sanitizeIdentifier('my---file')).toBe('my___file');
      expect(sanitizeIdentifier('test...name')).toBe('test___name');
      // weird@#$%name: '@'→'_', '#'→'_', '$' stays, '%'→'_' = 'weird__$_name'
      // Note: $ is a valid identifier character in JavaScript
      expect(sanitizeIdentifier('weird@#$%name')).toBe('weird__$_name');
    });

    it('should handle identifier with only numbers', () => {
      expect(sanitizeIdentifier('123456')).toBe('_123456');
      expect(sanitizeIdentifier('0')).toBe('_0');
    });

    it('should handle mixed valid and invalid characters', () => {
      expect(sanitizeIdentifier('my-valid_name$123')).toBe('my_valid_name$123');
      expect(sanitizeIdentifier('test.config.json')).toBe('test_config_json');
    });

    it('should handle dollar signs', () => {
      expect(sanitizeIdentifier('$variable')).toBe('$variable');
      expect(sanitizeIdentifier('my$var')).toBe('my$var');
      expect(sanitizeIdentifier('$$')).toBe('$$');
    });

    it('should handle underscores at start', () => {
      expect(sanitizeIdentifier('_private')).toBe('_private');
      expect(sanitizeIdentifier('__proto__')).toBe('__proto__');
    });
  });

  describe('makeUnique', () => {
    it('should return name as-is if not in set', () => {
      const existingNames = new Set(['User', 'Post']);
      expect(makeUnique('Product', existingNames)).toBe('Product');
      expect(makeUnique('Comment', existingNames)).toBe('Comment');
    });

    it('should append 2 for first collision', () => {
      const existingNames = new Set(['User']);
      expect(makeUnique('User', existingNames)).toBe('User2');
    });

    it('should increment number for multiple collisions', () => {
      const existingNames = new Set(['User', 'User2', 'User3']);
      expect(makeUnique('User', existingNames)).toBe('User4');
    });

    it('should handle large numbers', () => {
      const existingNames = new Set([
        'User', 'User2', 'User3', 'User4', 'User5',
        'User6', 'User7', 'User8', 'User9', 'User10',
        'User11', 'User12', 'User13', 'User14', 'User15'
      ]);
      expect(makeUnique('User', existingNames)).toBe('User16');
    });

    it('should work with empty set', () => {
      const existingNames = new Set<string>();
      expect(makeUnique('User', existingNames)).toBe('User');
      expect(makeUnique('Post', existingNames)).toBe('Post');
    });

    it('should handle gaps in numbering', () => {
      // Even if User3 is missing, it starts from User2 and increments
      const existingNames = new Set(['User', 'User2', 'User4', 'User5']);
      expect(makeUnique('User', existingNames)).toBe('User3');
    });

    it('should handle names that naturally end with numbers', () => {
      const existingNames = new Set(['User1']);
      expect(makeUnique('User1', existingNames)).toBe('User12');
    });

    it('should handle single collision', () => {
      const existingNames = new Set(['Model']);
      const result1 = makeUnique('Model', existingNames);
      expect(result1).toBe('Model2');

      // Add result to set and try again
      existingNames.add(result1);
      const result2 = makeUnique('Model', existingNames);
      expect(result2).toBe('Model3');
    });

    it('should handle different names in set', () => {
      const existingNames = new Set(['User', 'Post', 'Comment', 'Product']);
      expect(makeUnique('Article', existingNames)).toBe('Article');
    });

    it('should be case-sensitive', () => {
      const existingNames = new Set(['user']);
      expect(makeUnique('User', existingNames)).toBe('User');
      expect(makeUnique('user', existingNames)).toBe('user2');
    });

    it('should handle very large collision count', () => {
      const existingNames = new Set<string>();
      for (let i = 1; i <= 100; i++) {
        if (i === 1) {
          existingNames.add('Model');
        } else {
          existingNames.add(`Model${i}`);
        }
      }
      expect(makeUnique('Model', existingNames)).toBe('Model101');
    });

    it('should handle empty string name', () => {
      const existingNames = new Set(['']);
      expect(makeUnique('', existingNames)).toBe('2');
    });

    it('should handle name with special characters', () => {
      const existingNames = new Set(['My-Model']);
      expect(makeUnique('My-Model', existingNames)).toBe('My-Model2');
    });
  });
});
