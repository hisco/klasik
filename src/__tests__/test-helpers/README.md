# Test Helper Utilities

## Cleanup Utils

Robust directory cleanup utilities designed to handle common issues in test environments.

### Why We Need This

Standard `fs.rmSync()` can fail with `ENOTEMPTY` errors due to:

1. **macOS Spotlight Indexing**: The `mdworker_` process scans files as they're created, holding file handles
2. **Race Conditions**: Files may be created or modified during cleanup
3. **Locked Files**: Other processes may have files open
4. **Nested Structures**: Deep directory trees can cause issues
5. **File System Delays**: File operations aren't always synchronous at the OS level

### Solution Strategy

The `robustRemoveDir` function implements a multi-layered approach:

1. **Strategy 1: fs.rmSync with retry**
   - Uses Node's built-in retry mechanism
   - Exponential backoff between attempts
   - Handles most common cases

2. **Strategy 2: Manual recursive deletion**
   - Deletes files first, then directories
   - Changes permissions if needed
   - More reliable for deeply nested structures

3. **Strategy 3: System rm -rf fallback**
   - Unix-specific fallback
   - Handles locked files more aggressively
   - Last resort when Node methods fail

### Usage

#### Basic Cleanup

```typescript
import { robustRemoveDir, ensureCleanDirectory } from './test-helpers/cleanup-utils';

describe('My Test', () => {
  const testDir = '/path/to/test-output';

  beforeAll(async () => {
    // Clean and recreate directory
    await ensureCleanDirectory(testDir);
  });

  afterAll(async () => {
    // Clean up after tests
    await robustRemoveDir(testDir, { silent: true });
  });
});
```

#### With Options

```typescript
await robustRemoveDir(dirPath, {
  maxRetries: 5,        // Number of retry attempts (default: 3)
  retryDelayMs: 200,    // Delay between retries (default: 100)
  useFallbackRm: true,  // Use system rm -rf on Unix (default: true)
  silent: false,        // Show cleanup warnings (default: false)
});
```

#### Unique Test Directories

Avoid conflicts between concurrent tests:

```typescript
import { createUniqueTestDir } from './test-helpers/cleanup-utils';

const testDir = createUniqueTestDir('/base/path', 'my-test');
// Creates: /base/path/my-test-1234567890-abc123
```

#### Clean Up Old Test Directories

Remove orphaned directories from failed test runs:

```typescript
import { cleanupOldTestDirs } from './test-helpers/cleanup-utils';

// Remove directories older than 1 hour
await cleanupOldTestDirs(
  '/test-output',
  60 * 60 * 1000,  // 1 hour in milliseconds
  /^e2e-/          // Optional: only match directories starting with 'e2e-'
);
```

### Best Practices

1. **Always use async/await**: Cleanup functions are asynchronous
   ```typescript
   // ✅ Good
   beforeAll(async () => {
     await ensureCleanDirectory(testDir);
   });

   // ❌ Bad
   beforeAll(() => {
     ensureCleanDirectory(testDir); // Missing await!
   });
   ```

2. **Use silent: true in afterAll**: Suppress warnings during cleanup
   ```typescript
   afterAll(async () => {
     await robustRemoveDir(testDir, { silent: true });
   });
   ```

3. **Consider unique directories**: For tests that run in parallel
   ```typescript
   const testDir = createUniqueTestDir(baseDir, expect.getState().currentTestName);
   ```

4. **Add to .gitignore**: Always ignore test output directories
   ```
   test-output/
   ```

### Migrating Existing Tests

Replace this pattern:
```typescript
beforeAll(() => {
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
  fs.mkdirSync(testDir, { recursive: true });
});
```

With this:
```typescript
beforeAll(async () => {
  await ensureCleanDirectory(testDir);
});
```

### Troubleshooting

#### Tests still failing with ENOTEMPTY?

1. Check if `beforeAll`/`afterAll` are properly async
2. Increase `maxRetries` option
3. Run cleanup manually: `rm -rf test-output`
4. Check for processes holding files: `lsof +D test-output`

#### Performance concerns?

The retry mechanisms add ~100-300ms overhead in worst cases. For most tests, cleanup is nearly instant.

#### Cleanup too slow?

Use unique directories instead of cleaning:
```typescript
const testDir = createUniqueTestDir(baseDir, 'test-name');
// No cleanup needed!
```

Then periodically clean old directories:
```typescript
// In a global test setup or CI script
await cleanupOldTestDirs('test-output', 24 * 60 * 60 * 1000); // 24 hours
```

### Testing

The cleanup utilities have their own comprehensive test suite:

```bash
npm test -- src/__tests__/test-helpers/__tests__/cleanup-utils.test.ts
```

### Related Issues

- macOS Spotlight indexing: https://github.com/nodejs/node/issues/41444
- fs.rmSync ENOTEMPTY: https://github.com/nodejs/node/issues/38006
- Jest cleanup issues: https://github.com/facebook/jest/issues/11438
