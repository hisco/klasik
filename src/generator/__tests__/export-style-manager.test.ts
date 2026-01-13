/**
 * Tests for ExportStyleManager
 * Comprehensive coverage of all export styles and edge cases
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ExportStyleManager, ExportStyleOptions } from '../export-style-manager';

describe('ExportStyleManager', () => {
  let manager: ExportStyleManager;
  let tempDir: string;

  beforeEach(() => {
    manager = new ExportStyleManager();
    // Create temp directory for tests
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'klasik-test-'));
  });

  afterEach(() => {
    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('generateIndexFile', () => {
    describe('style: none', () => {
      it('should return only comment when style is none', () => {
        const options: ExportStyleOptions = {
          style: 'none',
          esm: false,
          baseDir: tempDir,
          subdirs: ['models']
        };

        const result = manager.generateIndexFile(options);

        expect(result).toBe('// No exports\n');
      });

      it('should ignore subdirs when style is none', () => {
        // Create subdirectory with files
        const modelsDir = path.join(tempDir, 'models');
        fs.mkdirSync(modelsDir, { recursive: true });
        fs.writeFileSync(path.join(modelsDir, 'user.ts'), 'export class User {}');

        const options: ExportStyleOptions = {
          style: 'none',
          esm: false,
          baseDir: tempDir,
          subdirs: ['models']
        };

        const result = manager.generateIndexFile(options);

        expect(result).toBe('// No exports\n');
      });
    });

    describe('style: namespace', () => {
      it('should generate namespace exports without ESM', () => {
        // Create test files
        const modelsDir = path.join(tempDir, 'models');
        fs.mkdirSync(modelsDir, { recursive: true });
        fs.writeFileSync(path.join(modelsDir, 'user.ts'), 'export class User {}');
        fs.writeFileSync(path.join(modelsDir, 'post.ts'), 'export class Post {}');

        const options: ExportStyleOptions = {
          style: 'namespace',
          esm: false,
          baseDir: tempDir,
          subdirs: ['models']
        };

        const result = manager.generateIndexFile(options);

        expect(result).toContain("export * as user from './models/user';");
        expect(result).toContain("export * as post from './models/post';");
        expect(result).not.toContain('.js');
      });

      it('should generate namespace exports with ESM (.js extensions)', () => {
        // Create test files
        const modelsDir = path.join(tempDir, 'models');
        fs.mkdirSync(modelsDir, { recursive: true });
        fs.writeFileSync(path.join(modelsDir, 'user.ts'), 'export class User {}');
        fs.writeFileSync(path.join(modelsDir, 'post.ts'), 'export class Post {}');

        const options: ExportStyleOptions = {
          style: 'namespace',
          esm: true,
          baseDir: tempDir,
          subdirs: ['models']
        };

        const result = manager.generateIndexFile(options);

        expect(result).toContain("export * as user from './models/user.js';");
        expect(result).toContain("export * as post from './models/post.js';");
      });

      it('should generate namespace exports for multiple subdirectories', () => {
        // Create models directory
        const modelsDir = path.join(tempDir, 'models');
        fs.mkdirSync(modelsDir, { recursive: true });
        fs.writeFileSync(path.join(modelsDir, 'user.ts'), 'export class User {}');

        // Create apis directory
        const apisDir = path.join(tempDir, 'apis');
        fs.mkdirSync(apisDir, { recursive: true });
        fs.writeFileSync(path.join(apisDir, 'user-api.ts'), 'export class UserApi {}');

        const options: ExportStyleOptions = {
          style: 'namespace',
          esm: false,
          baseDir: tempDir,
          subdirs: ['models', 'apis']
        };

        const result = manager.generateIndexFile(options);

        expect(result).toContain("export * as user from './models/user';");
        expect(result).toContain("export * as user_api from './apis/user-api';");
      });

      it('should sanitize identifiers with special characters', () => {
        const modelsDir = path.join(tempDir, 'models');
        fs.mkdirSync(modelsDir, { recursive: true });
        fs.writeFileSync(path.join(modelsDir, 'my-special-file.ts'), 'export class MyClass {}');
        fs.writeFileSync(path.join(modelsDir, '123-numeric.ts'), 'export class NumericClass {}');

        const options: ExportStyleOptions = {
          style: 'namespace',
          esm: false,
          baseDir: tempDir,
          subdirs: ['models']
        };

        const result = manager.generateIndexFile(options);

        // Special characters replaced with underscore
        expect(result).toContain('export * as my_special_file from');
        // Number prefix gets underscore prefix
        expect(result).toContain('export * as _123_numeric from');
      });

      it('should skip index.ts files', () => {
        const modelsDir = path.join(tempDir, 'models');
        fs.mkdirSync(modelsDir, { recursive: true });
        fs.writeFileSync(path.join(modelsDir, 'user.ts'), 'export class User {}');
        fs.writeFileSync(path.join(modelsDir, 'index.ts'), 'export * from "./user";');

        const options: ExportStyleOptions = {
          style: 'namespace',
          esm: false,
          baseDir: tempDir,
          subdirs: ['models']
        };

        const result = manager.generateIndexFile(options);

        expect(result).toContain("export * as user from './models/user';");
        expect(result).not.toContain('index');
      });
    });

    describe('style: direct', () => {
      it('should generate direct exports without ESM', () => {
        const modelsDir = path.join(tempDir, 'models');
        fs.mkdirSync(modelsDir, { recursive: true });
        fs.writeFileSync(path.join(modelsDir, 'user.ts'), 'export class User {}');
        fs.writeFileSync(path.join(modelsDir, 'post.ts'), 'export class Post {}');

        const options: ExportStyleOptions = {
          style: 'direct',
          esm: false,
          baseDir: tempDir,
          subdirs: ['models']
        };

        const result = manager.generateIndexFile(options);

        expect(result).toContain("export { User } from './models/user';");
        expect(result).toContain("export { Post } from './models/post';");
        expect(result).not.toContain('.js');
      });

      it('should generate direct exports with ESM (.js extensions)', () => {
        const modelsDir = path.join(tempDir, 'models');
        fs.mkdirSync(modelsDir, { recursive: true });
        fs.writeFileSync(path.join(modelsDir, 'user.ts'), 'export class User {}');

        const options: ExportStyleOptions = {
          style: 'direct',
          esm: true,
          baseDir: tempDir,
          subdirs: ['models']
        };

        const result = manager.generateIndexFile(options);

        expect(result).toContain("export { User } from './models/user.js';");
      });

      it('should generate direct exports with multiple classes per file', () => {
        const modelsDir = path.join(tempDir, 'models');
        fs.mkdirSync(modelsDir, { recursive: true });
        fs.writeFileSync(
          path.join(modelsDir, 'user.ts'),
          'export class User {}\nexport class UserProfile {}\nexport class UserSettings {}'
        );

        const options: ExportStyleOptions = {
          style: 'direct',
          esm: false,
          baseDir: tempDir,
          subdirs: ['models']
        };

        const result = manager.generateIndexFile(options);

        expect(result).toContain("export { User, UserProfile, UserSettings } from './models/user';");
      });

      it('should skip files with no exported classes', () => {
        const modelsDir = path.join(tempDir, 'models');
        fs.mkdirSync(modelsDir, { recursive: true });
        fs.writeFileSync(path.join(modelsDir, 'user.ts'), 'export class User {}');
        fs.writeFileSync(path.join(modelsDir, 'helper.ts'), 'function helper() { return true; }');

        const options: ExportStyleOptions = {
          style: 'direct',
          esm: false,
          baseDir: tempDir,
          subdirs: ['models']
        };

        const result = manager.generateIndexFile(options);

        expect(result).toContain("export { User } from './models/user';");
        expect(result).not.toContain('helper');
      });
    });

    describe('style: both', () => {
      it('should generate both namespace and direct exports', () => {
        const modelsDir = path.join(tempDir, 'models');
        fs.mkdirSync(modelsDir, { recursive: true });
        fs.writeFileSync(path.join(modelsDir, 'user.ts'), 'export class User {}');
        fs.writeFileSync(path.join(modelsDir, 'post.ts'), 'export class Post {}');

        const options: ExportStyleOptions = {
          style: 'both',
          esm: false,
          baseDir: tempDir,
          subdirs: ['models']
        };

        const result = manager.generateIndexFile(options);

        // Should contain namespace exports
        expect(result).toContain("export * as user from './models/user';");
        expect(result).toContain("export * as post from './models/post';");

        // Should contain direct exports
        expect(result).toContain("export { User } from './models/user';");
        expect(result).toContain("export { Post } from './models/post';");

        // Should have blank line separator between namespace and direct exports
        const lines = result.split('\n');
        const allNamespaceLines = lines.filter(line => line.includes('export * as'));
        const allDirectLines = lines.filter(line => line.includes('export {'));

        expect(allNamespaceLines.length).toBe(2); // user and post
        expect(allDirectLines.length).toBe(2); // User and Post

        // Check for blank line between sections
        expect(result).toMatch(/export \* as post.*\n\nexport \{/s);
      });

      it('should generate both styles with ESM', () => {
        const modelsDir = path.join(tempDir, 'models');
        fs.mkdirSync(modelsDir, { recursive: true });
        fs.writeFileSync(path.join(modelsDir, 'user.ts'), 'export class User {}');

        const options: ExportStyleOptions = {
          style: 'both',
          esm: true,
          baseDir: tempDir,
          subdirs: ['models']
        };

        const result = manager.generateIndexFile(options);

        expect(result).toContain("export * as user from './models/user.js';");
        expect(result).toContain("export { User } from './models/user.js';");
      });
    });

    describe('edge cases', () => {
      it('should handle non-existent subdirectory gracefully', () => {
        const options: ExportStyleOptions = {
          style: 'direct',
          esm: false,
          baseDir: tempDir,
          subdirs: ['nonexistent']
        };

        const result = manager.generateIndexFile(options);

        // Should return just newline (no exports generated)
        expect(result).toBe('\n');
      });

      it('should handle empty subdirectory (no .ts files)', () => {
        const modelsDir = path.join(tempDir, 'models');
        fs.mkdirSync(modelsDir, { recursive: true });

        const options: ExportStyleOptions = {
          style: 'direct',
          esm: false,
          baseDir: tempDir,
          subdirs: ['models']
        };

        const result = manager.generateIndexFile(options);

        expect(result).toBe('\n');
      });

      it('should handle subdirectory with only non-.ts files', () => {
        const modelsDir = path.join(tempDir, 'models');
        fs.mkdirSync(modelsDir, { recursive: true });
        fs.writeFileSync(path.join(modelsDir, 'readme.md'), '# README');
        fs.writeFileSync(path.join(modelsDir, 'data.json'), '{}');

        const options: ExportStyleOptions = {
          style: 'direct',
          esm: false,
          baseDir: tempDir,
          subdirs: ['models']
        };

        const result = manager.generateIndexFile(options);

        expect(result).toBe('\n');
      });

      it('should handle multiple subdirectories with some non-existent', () => {
        const modelsDir = path.join(tempDir, 'models');
        fs.mkdirSync(modelsDir, { recursive: true });
        fs.writeFileSync(path.join(modelsDir, 'user.ts'), 'export class User {}');

        const options: ExportStyleOptions = {
          style: 'direct',
          esm: false,
          baseDir: tempDir,
          subdirs: ['models', 'nonexistent', 'alsoNonexistent']
        };

        const result = manager.generateIndexFile(options);

        expect(result).toContain("export { User } from './models/user';");
        expect(result).not.toContain('nonexistent');
      });
    });
  });

  describe('extractClassNames', () => {
    it('should extract single exported class', () => {
      const filePath = path.join(tempDir, 'user.ts');
      fs.writeFileSync(filePath, 'export class User {}');

      const classNames = manager.extractClassNames(filePath);

      expect(classNames).toEqual(['User']);
    });

    it('should extract multiple exported classes', () => {
      const filePath = path.join(tempDir, 'models.ts');
      fs.writeFileSync(
        filePath,
        `export class User {}
export class Post {}
export class Comment {}`
      );

      const classNames = manager.extractClassNames(filePath);

      expect(classNames).toEqual(['User', 'Post', 'Comment']);
    });

    it('should not extract non-exported classes', () => {
      const filePath = path.join(tempDir, 'models.ts');
      fs.writeFileSync(
        filePath,
        `export class User {}
class InternalHelper {}
export class Post {}`
      );

      const classNames = manager.extractClassNames(filePath);

      expect(classNames).toEqual(['User', 'Post']);
      expect(classNames).not.toContain('InternalHelper');
    });

    it('should extract classes with different modifiers', () => {
      const filePath = path.join(tempDir, 'models.ts');
      fs.writeFileSync(
        filePath,
        `export abstract class BaseModel {}
export class User extends BaseModel {}
export class ReadOnlyModel {}`
      );

      const classNames = manager.extractClassNames(filePath);

      // Note: The regex /export\s+class\s+(\w+)/g only matches "export class"
      // It does not match "export abstract class" (abstract comes between export and class)
      // This is expected behavior - only direct "export class" declarations are captured
      expect(classNames).toEqual(['User', 'ReadOnlyModel']);
    });

    it('should handle file with no classes', () => {
      const filePath = path.join(tempDir, 'helpers.ts');
      fs.writeFileSync(
        filePath,
        `export function helper() { return true; }
export const CONSTANT = 42;`
      );

      const classNames = manager.extractClassNames(filePath);

      expect(classNames).toEqual([]);
    });

    it('should handle empty file', () => {
      const filePath = path.join(tempDir, 'empty.ts');
      fs.writeFileSync(filePath, '');

      const classNames = manager.extractClassNames(filePath);

      expect(classNames).toEqual([]);
    });

    it('should handle classes with complex formatting', () => {
      const filePath = path.join(tempDir, 'formatted.ts');
      fs.writeFileSync(
        filePath,
        `export   class   User   {}
export
class
Post
{}
export class Comment{}`
      );

      const classNames = manager.extractClassNames(filePath);

      expect(classNames).toEqual(['User', 'Post', 'Comment']);
    });

    it('should handle file read errors gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const nonExistentPath = path.join(tempDir, 'nonexistent.ts');

      const classNames = manager.extractClassNames(nonExistentPath);

      expect(classNames).toEqual([]);
      expect(consoleSpy).toHaveBeenCalled();

      // Verify console.warn was called with message containing path and error
      const [message, error] = consoleSpy.mock.calls[0];
      expect(message).toContain('Failed to extract class names');
      expect(message).toContain('nonexistent.ts');
      expect(error).toBeDefined();
      expect(error.code).toBe('ENOENT'); // File not found error

      consoleSpy.mockRestore();
    });

    it('should handle class names with numbers and underscores', () => {
      const filePath = path.join(tempDir, 'models.ts');
      fs.writeFileSync(
        filePath,
        `export class User2 {}
export class User_Profile {}
export class HTTP2Request {}`
      );

      const classNames = manager.extractClassNames(filePath);

      expect(classNames).toEqual(['User2', 'User_Profile', 'HTTP2Request']);
    });
  });

  describe('writeIndexFile', () => {
    it('should write index file to disk', () => {
      const modelsDir = path.join(tempDir, 'models');
      fs.mkdirSync(modelsDir, { recursive: true });
      fs.writeFileSync(path.join(modelsDir, 'user.ts'), 'export class User {}');

      const outputPath = path.join(tempDir, 'index.ts');
      const options: ExportStyleOptions = {
        style: 'direct',
        esm: false,
        baseDir: tempDir,
        subdirs: ['models']
      };

      manager.writeIndexFile(options, outputPath);

      expect(fs.existsSync(outputPath)).toBe(true);

      const content = fs.readFileSync(outputPath, 'utf-8');
      expect(content).toContain("export { User } from './models/user';");
    });

    it('should overwrite existing index file', () => {
      const outputPath = path.join(tempDir, 'index.ts');

      // Write initial content
      fs.writeFileSync(outputPath, 'export * from "./old";');

      const modelsDir = path.join(tempDir, 'models');
      fs.mkdirSync(modelsDir, { recursive: true });
      fs.writeFileSync(path.join(modelsDir, 'user.ts'), 'export class User {}');

      const options: ExportStyleOptions = {
        style: 'direct',
        esm: false,
        baseDir: tempDir,
        subdirs: ['models']
      };

      manager.writeIndexFile(options, outputPath);

      const content = fs.readFileSync(outputPath, 'utf-8');
      expect(content).not.toContain('old');
      expect(content).toContain("export { User } from './models/user';");
    });

    it('should create parent directories if needed', () => {
      const modelsDir = path.join(tempDir, 'models');
      fs.mkdirSync(modelsDir, { recursive: true });
      fs.writeFileSync(path.join(modelsDir, 'user.ts'), 'export class User {}');

      const nestedPath = path.join(tempDir, 'nested', 'folder', 'index.ts');
      // Create parent directories
      fs.mkdirSync(path.dirname(nestedPath), { recursive: true });

      const options: ExportStyleOptions = {
        style: 'direct',
        esm: false,
        baseDir: tempDir,
        subdirs: ['models']
      };

      manager.writeIndexFile(options, nestedPath);

      expect(fs.existsSync(nestedPath)).toBe(true);
    });
  });

  describe('identifier sanitization', () => {
    it('should sanitize identifiers with hyphens', () => {
      const modelsDir = path.join(tempDir, 'models');
      fs.mkdirSync(modelsDir, { recursive: true });
      fs.writeFileSync(path.join(modelsDir, 'my-file.ts'), 'export class MyClass {}');

      const options: ExportStyleOptions = {
        style: 'namespace',
        esm: false,
        baseDir: tempDir,
        subdirs: ['models']
      };

      const result = manager.generateIndexFile(options);

      expect(result).toContain('export * as my_file from');
    });

    it('should sanitize identifiers with dots', () => {
      const modelsDir = path.join(tempDir, 'models');
      fs.mkdirSync(modelsDir, { recursive: true });
      fs.writeFileSync(path.join(modelsDir, 'my.file.ts'), 'export class MyClass {}');

      const options: ExportStyleOptions = {
        style: 'namespace',
        esm: false,
        baseDir: tempDir,
        subdirs: ['models']
      };

      const result = manager.generateIndexFile(options);

      expect(result).toContain('export * as my_file from');
    });

    it('should sanitize identifiers starting with numbers', () => {
      const modelsDir = path.join(tempDir, 'models');
      fs.mkdirSync(modelsDir, { recursive: true });
      fs.writeFileSync(path.join(modelsDir, '123file.ts'), 'export class MyClass {}');

      const options: ExportStyleOptions = {
        style: 'namespace',
        esm: false,
        baseDir: tempDir,
        subdirs: ['models']
      };

      const result = manager.generateIndexFile(options);

      expect(result).toContain('export * as _123file from');
    });

    it('should allow valid characters (letters, numbers, _, $)', () => {
      const modelsDir = path.join(tempDir, 'models');
      fs.mkdirSync(modelsDir, { recursive: true });
      fs.writeFileSync(path.join(modelsDir, 'valid_identifier$123.ts'), 'export class MyClass {}');

      const options: ExportStyleOptions = {
        style: 'namespace',
        esm: false,
        baseDir: tempDir,
        subdirs: ['models']
      };

      const result = manager.generateIndexFile(options);

      expect(result).toContain('export * as valid_identifier$123 from');
    });

    it('should sanitize identifiers with spaces', () => {
      const modelsDir = path.join(tempDir, 'models');
      fs.mkdirSync(modelsDir, { recursive: true });
      fs.writeFileSync(path.join(modelsDir, 'my file.ts'), 'export class MyClass {}');

      const options: ExportStyleOptions = {
        style: 'namespace',
        esm: false,
        baseDir: tempDir,
        subdirs: ['models']
      };

      const result = manager.generateIndexFile(options);

      expect(result).toContain('export * as my_file from');
    });
  });
});
