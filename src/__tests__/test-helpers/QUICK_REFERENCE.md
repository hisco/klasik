# Cleanup Utils - Quick Reference

## Common Patterns

### Pattern 1: Clean directory before/after tests

```typescript
import { ensureCleanDirectory, robustRemoveDir } from './test-helpers/cleanup-utils';

const TEST_DIR = path.join(__dirname, '../../test-output/my-test');

describe('My Test Suite', () => {
  beforeAll(async () => {
    await ensureCleanDirectory(TEST_DIR);
  });

  afterAll(async () => {
    await robustRemoveDir(TEST_DIR, { silent: true });
  });

  // Your tests here
});
```

### Pattern 2: Temporary directory for each test

```typescript
import { robustRemoveDir } from './test-helpers/cleanup-utils';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('My Test Suite', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'my-test-'));
  });

  afterEach(async () => {
    await robustRemoveDir(tempDir, { silent: true });
  });

  // Your tests here
});
```

### Pattern 3: Unique directory per test run

```typescript
import { createUniqueTestDir, robustRemoveDir } from './test-helpers/cleanup-utils';

describe('My Test Suite', () => {
  let testDir: string;

  beforeAll(() => {
    testDir = createUniqueTestDir('test-output', 'my-test');
  });

  afterAll(async () => {
    await robustRemoveDir(testDir, { silent: true });
  });

  // Your tests here - no conflicts with parallel runs!
});
```

## Function Reference

### ensureCleanDirectory(dirPath, options?)

Removes directory if it exists, then creates it fresh.

```typescript
await ensureCleanDirectory('/path/to/dir', {
  maxRetries: 3,
  retryDelayMs: 100,
  useFallbackRm: true,
  silent: false
});
```

**Use when**: You need a clean directory before tests

### robustRemoveDir(dirPath, options?)

Robustly removes a directory with retry logic.

```typescript
const success = await robustRemoveDir('/path/to/dir', {
  maxRetries: 3,
  retryDelayMs: 100,
  useFallbackRm: true,
  silent: true  // Recommended for afterAll
});
```

**Use when**: You need to clean up after tests

**Returns**: `true` if successful, `false` otherwise

### createUniqueTestDir(baseDir, testName)

Creates a timestamped unique directory.

```typescript
const dir = createUniqueTestDir('test-output', 'api-test');
// Returns: test-output/api-test-1234567890-abc123
```

**Use when**: Running parallel tests or avoiding conflicts

### cleanupOldTestDirs(baseDir, maxAgeMs?, pattern?)

Removes old test directories.

```typescript
const cleaned = await cleanupOldTestDirs(
  'test-output',
  60 * 60 * 1000,  // 1 hour
  /^e2e-/          // Only e2e-* directories
);
```

**Use when**: Cleaning up orphaned test directories from failed runs

**Returns**: Number of directories cleaned

## Options

```typescript
interface CleanupOptions {
  maxRetries?: number;      // Default: 3
  retryDelayMs?: number;    // Default: 100ms
  useFallbackRm?: boolean;  // Default: true (Unix only)
  silent?: boolean;         // Default: false
}
```

## Common Mistakes

❌ **Forgetting async/await**
```typescript
beforeAll(() => {
  ensureCleanDirectory(testDir);  // WRONG - not awaited!
});
```

✅ **Correct**
```typescript
beforeAll(async () => {
  await ensureCleanDirectory(testDir);
});
```

---

❌ **Noisy cleanup in afterAll**
```typescript
afterAll(async () => {
  await robustRemoveDir(testDir);  // Will show warnings
});
```

✅ **Correct**
```typescript
afterAll(async () => {
  await robustRemoveDir(testDir, { silent: true });
});
```

---

❌ **Using sync fs methods**
```typescript
if (fs.existsSync(dir)) {
  fs.rmSync(dir, { recursive: true, force: true });  // Can fail with ENOTEMPTY
}
```

✅ **Correct**
```typescript
await robustRemoveDir(dir);  // Handles ENOTEMPTY errors
```

## Troubleshooting

### "ENOTEMPTY" error persists?

1. Make sure `beforeAll`/`afterAll` are async
2. Check you're awaiting the cleanup calls
3. Try increasing `maxRetries`:
   ```typescript
   await robustRemoveDir(dir, { maxRetries: 5 });
   ```

### Cleanup is slow?

1. Use unique directories instead:
   ```typescript
   const dir = createUniqueTestDir('test-output', 'test');
   // Skip cleanup - let OS handle it or use cleanupOldTestDirs periodically
   ```

2. Run periodic cleanup:
   ```bash
   npm run cleanup-old-tests
   ```

### Need to debug cleanup?

Use `silent: false` to see what's happening:

```typescript
await robustRemoveDir(dir, { silent: false });
// Will show:
// ⚠️  Initial cleanup attempt failed: ENOTEMPTY
// 📁 Trying manual recursive deletion...
// ✅ Fallback cleanup succeeded
```

## Validation

Run the validation script to verify everything works:

```bash
./scripts/validate-cleanup.sh
```

## See Also

- Full documentation: `./README.md`
- Tests: `./__tests__/cleanup-utils.test.ts`
- Summary: `/ENOTEMPTY_FIX_SUMMARY.md`
