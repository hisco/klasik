/**
 * Robust directory cleanup utilities for tests
 *
 * Handles edge cases like:
 * - macOS Spotlight indexing (mdworker processes)
 * - Files locked by other processes
 * - Race conditions during cleanup
 * - Nested directory structures
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

export interface CleanupOptions {
  /**
   * Maximum number of retry attempts
   * @default 3
   */
  maxRetries?: number;

  /**
   * Delay in milliseconds between retries
   * @default 100
   */
  retryDelayMs?: number;

  /**
   * Use system rm -rf as fallback on Unix-like systems
   * @default true
   */
  useFallbackRm?: boolean;

  /**
   * Suppress cleanup warnings and errors
   * @default false
   */
  silent?: boolean;
}

/**
 * Wait for a specified number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Recursively remove all files in a directory, then remove the directory
 * This approach is more reliable than rmSync for deeply nested structures
 */
function recursiveRemove(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    return;
  }

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      recursiveRemove(fullPath);
    } else {
      try {
        fs.unlinkSync(fullPath);
      } catch (error) {
        // If we can't delete a file, try to make it writable first
        try {
          fs.chmodSync(fullPath, 0o666);
          fs.unlinkSync(fullPath);
        } catch {
          // Ignore - we'll catch this in the parent call
        }
      }
    }
  }

  // Now remove the empty directory
  try {
    fs.rmdirSync(dirPath);
  } catch (error) {
    // Directory might not be empty due to race conditions
    // This will be caught by the retry logic
  }
}

/**
 * Robustly remove a directory with retry logic and multiple strategies
 *
 * @param dirPath - Path to the directory to remove
 * @param options - Cleanup options
 * @returns true if successful, false otherwise
 */
export async function robustRemoveDir(
  dirPath: string,
  options: CleanupOptions = {}
): Promise<boolean> {
  const {
    maxRetries = 3,
    retryDelayMs = 100,
    useFallbackRm = true,
    silent = false,
  } = options;

  if (!fs.existsSync(dirPath)) {
    return true;
  }

  // Strategy 1: Try fs.rmSync with maxRetries option (Node 14.14+)
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      fs.rmSync(dirPath, {
        recursive: true,
        force: true,
        maxRetries: 3,
        retryDelay: 100,
      });
      return true;
    } catch (error: any) {
      if (!silent && attempt === 0) {
        console.log(`⚠️  Initial cleanup attempt failed: ${error.code || error.message}`);
      }

      if (attempt < maxRetries - 1) {
        await sleep(retryDelayMs * (attempt + 1)); // Exponential backoff
      }
    }
  }

  // Strategy 2: Try manual recursive deletion
  if (!silent) {
    console.log('📁 Trying manual recursive deletion...');
  }

  try {
    recursiveRemove(dirPath);
    if (!fs.existsSync(dirPath)) {
      return true;
    }
  } catch (error: any) {
    if (!silent) {
      console.log(`⚠️  Manual recursive deletion failed: ${error.code || error.message}`);
    }
  }

  // Strategy 3: Use system rm -rf on Unix-like systems
  if (useFallbackRm && (process.platform === 'darwin' || process.platform === 'linux')) {
    if (!silent) {
      console.log('🔧 Using system rm -rf as fallback...');
    }

    try {
      execSync(`rm -rf "${dirPath}"`, { stdio: 'pipe' });

      // Verify it's gone
      await sleep(50); // Brief wait for filesystem sync
      if (!fs.existsSync(dirPath)) {
        if (!silent) {
          console.log('✅ Fallback cleanup succeeded');
        }
        return true;
      }
    } catch (error: any) {
      if (!silent) {
        console.log(`⚠️  Fallback rm -rf failed: ${error.message}`);
      }
    }
  }

  // If we get here, cleanup failed
  if (!silent) {
    console.warn(`❌ Failed to clean up directory: ${dirPath}`);
    console.warn('   This may cause test failures. Consider running: rm -rf test-output');
  }

  return false;
}

/**
 * Ensure a directory exists and is clean
 *
 * @param dirPath - Path to the directory
 * @param options - Cleanup options
 */
export async function ensureCleanDirectory(
  dirPath: string,
  options: CleanupOptions = {}
): Promise<void> {
  await robustRemoveDir(dirPath, options);
  fs.mkdirSync(dirPath, { recursive: true });
}

/**
 * Create a unique test directory to avoid conflicts
 *
 * @param baseDir - Base directory for test outputs
 * @param testName - Name of the test
 * @returns Path to the unique directory
 */
export function createUniqueTestDir(baseDir: string, testName: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  const uniqueDir = path.join(baseDir, `${testName}-${timestamp}-${random}`);
  fs.mkdirSync(uniqueDir, { recursive: true });
  return uniqueDir;
}

/**
 * Clean up test directories older than a specified age
 * Useful for cleaning up orphaned test directories from failed runs
 *
 * @param baseDir - Base directory containing test outputs
 * @param maxAgeMs - Maximum age in milliseconds (default: 1 hour)
 * @param pattern - Pattern to match directory names (default: all)
 */
export async function cleanupOldTestDirs(
  baseDir: string,
  maxAgeMs: number = 60 * 60 * 1000,
  pattern?: RegExp
): Promise<number> {
  if (!fs.existsSync(baseDir)) {
    return 0;
  }

  let cleaned = 0;
  const now = Date.now();
  const entries = fs.readdirSync(baseDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    if (pattern && !pattern.test(entry.name)) {
      continue;
    }

    const dirPath = path.join(baseDir, entry.name);

    try {
      const stats = fs.statSync(dirPath);
      const age = now - stats.mtimeMs;

      if (age > maxAgeMs) {
        const success = await robustRemoveDir(dirPath, { silent: true });
        if (success) {
          cleaned++;
        }
      }
    } catch {
      // Ignore errors for individual directories
    }
  }

  return cleaned;
}
