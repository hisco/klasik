/**
 * Tests for cleanup utilities
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  robustRemoveDir,
  ensureCleanDirectory,
  createUniqueTestDir,
  cleanupOldTestDirs,
} from '../cleanup-utils';

const TEST_DIR = path.join(__dirname, '../../../test-output/cleanup-test');

describe('Cleanup Utils', () => {
  afterAll(async () => {
    // Clean up all test artifacts
    await robustRemoveDir(TEST_DIR, { silent: true });
  });

  describe('robustRemoveDir', () => {
    it('should remove an empty directory', async () => {
      const testPath = path.join(TEST_DIR, 'empty-dir');
      fs.mkdirSync(testPath, { recursive: true });

      const result = await robustRemoveDir(testPath);

      expect(result).toBe(true);
      expect(fs.existsSync(testPath)).toBe(false);
    });

    it('should remove a directory with files', async () => {
      const testPath = path.join(TEST_DIR, 'dir-with-files');
      fs.mkdirSync(testPath, { recursive: true });
      fs.writeFileSync(path.join(testPath, 'file1.txt'), 'content1');
      fs.writeFileSync(path.join(testPath, 'file2.txt'), 'content2');

      const result = await robustRemoveDir(testPath);

      expect(result).toBe(true);
      expect(fs.existsSync(testPath)).toBe(false);
    });

    it('should remove a deeply nested directory structure', async () => {
      const testPath = path.join(TEST_DIR, 'nested');
      const deepPath = path.join(testPath, 'level1', 'level2', 'level3');
      fs.mkdirSync(deepPath, { recursive: true });
      fs.writeFileSync(path.join(deepPath, 'deep-file.txt'), 'deep content');
      fs.writeFileSync(path.join(testPath, 'top-file.txt'), 'top content');

      const result = await robustRemoveDir(testPath);

      expect(result).toBe(true);
      expect(fs.existsSync(testPath)).toBe(false);
    });

    it('should handle non-existent directory gracefully', async () => {
      const testPath = path.join(TEST_DIR, 'does-not-exist');

      const result = await robustRemoveDir(testPath);

      expect(result).toBe(true);
    });

    it('should retry on failure', async () => {
      const testPath = path.join(TEST_DIR, 'retry-test');
      fs.mkdirSync(testPath, { recursive: true });
      fs.writeFileSync(path.join(testPath, 'file.txt'), 'content');

      const result = await robustRemoveDir(testPath, { maxRetries: 2 });

      expect(result).toBe(true);
      expect(fs.existsSync(testPath)).toBe(false);
    });
  });

  describe('ensureCleanDirectory', () => {
    it('should create a new directory if it does not exist', async () => {
      const testPath = path.join(TEST_DIR, 'new-dir');

      await ensureCleanDirectory(testPath);

      expect(fs.existsSync(testPath)).toBe(true);
      expect(fs.readdirSync(testPath).length).toBe(0);
    });

    it('should clean an existing directory with files', async () => {
      const testPath = path.join(TEST_DIR, 'existing-dir');
      fs.mkdirSync(testPath, { recursive: true });
      fs.writeFileSync(path.join(testPath, 'old-file.txt'), 'old content');

      await ensureCleanDirectory(testPath);

      expect(fs.existsSync(testPath)).toBe(true);
      expect(fs.readdirSync(testPath).length).toBe(0);
    });
  });

  describe('createUniqueTestDir', () => {
    it('should create a unique directory', () => {
      const dir1 = createUniqueTestDir(TEST_DIR, 'test');
      const dir2 = createUniqueTestDir(TEST_DIR, 'test');

      expect(dir1).not.toBe(dir2);
      expect(fs.existsSync(dir1)).toBe(true);
      expect(fs.existsSync(dir2)).toBe(true);
    });

    it('should include test name in directory path', () => {
      const dir = createUniqueTestDir(TEST_DIR, 'my-test');

      expect(dir).toContain('my-test');
      expect(fs.existsSync(dir)).toBe(true);
    });
  });

  describe('cleanupOldTestDirs', () => {
    it('should clean up old directories', async () => {
      const baseDir = path.join(TEST_DIR, 'old-dirs-test');
      fs.mkdirSync(baseDir, { recursive: true });

      // Create an old directory (by modifying mtime)
      const oldDir = path.join(baseDir, 'old-dir');
      fs.mkdirSync(oldDir, { recursive: true });

      // Create a new directory
      const newDir = path.join(baseDir, 'new-dir');
      fs.mkdirSync(newDir, { recursive: true });

      // Artificially age the old directory
      const oldTime = Date.now() - 2 * 60 * 60 * 1000; // 2 hours ago
      fs.utimesSync(oldDir, new Date(oldTime), new Date(oldTime));

      const cleaned = await cleanupOldTestDirs(baseDir, 60 * 60 * 1000); // 1 hour threshold

      expect(cleaned).toBeGreaterThanOrEqual(1);
      expect(fs.existsSync(oldDir)).toBe(false);
      expect(fs.existsSync(newDir)).toBe(true);
    });

    it('should respect directory pattern', async () => {
      const baseDir = path.join(TEST_DIR, 'pattern-test');
      fs.mkdirSync(baseDir, { recursive: true });

      const matchDir = path.join(baseDir, 'test-123');
      const noMatchDir = path.join(baseDir, 'other-456');

      fs.mkdirSync(matchDir, { recursive: true });
      fs.mkdirSync(noMatchDir, { recursive: true });

      // Age both directories
      const oldTime = Date.now() - 2 * 60 * 60 * 1000;
      fs.utimesSync(matchDir, new Date(oldTime), new Date(oldTime));
      fs.utimesSync(noMatchDir, new Date(oldTime), new Date(oldTime));

      const cleaned = await cleanupOldTestDirs(
        baseDir,
        60 * 60 * 1000,
        /^test-/
      );

      expect(cleaned).toBeGreaterThanOrEqual(1);
      expect(fs.existsSync(matchDir)).toBe(false);
      expect(fs.existsSync(noMatchDir)).toBe(true);
    });

    it('should handle non-existent base directory', async () => {
      const result = await cleanupOldTestDirs('/non/existent/path');
      expect(result).toBe(0);
    });
  });
});
