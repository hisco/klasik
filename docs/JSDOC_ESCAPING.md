# JSDoc Escaping Strategy

This document describes the JSDoc/TSDoc escaping strategy used in Klasik to prevent malformed comments in generated code.

## Overview

JSDoc comments in generated TypeScript code need careful handling of special characters to avoid breaking the comment syntax while preserving readability and functionality.

## Escaping Rules

### Characters That Are Escaped

1. **Comment Delimiters**
   - `*/` → `*\/` - Closing comment delimiter (prevents premature comment termination)
   - `/*` → `/\*` - Opening comment delimiter (prevents nested comment issues)

2. **At Symbol (Context-Aware)**
   - `@` at start of line or after whitespace → `\@` - Prevents false JSDoc tags
   - `@` in middle of text (e.g., `user@example.com`) → Preserved

3. **Newlines**
   - `\n` → `\n * ` - Adds proper JSDoc line prefix for multiline comments

### Characters That Are Preserved

These characters are intentionally **not escaped** because they're essential for JSDoc functionality and readability:

1. **Backticks** (`)
   - Used for inline code examples: `` `const foo = "bar"` ``
   - Preserved for markdown-style code formatting

2. **Quotes** (`"` and `'`)
   - Used in descriptions and examples
   - No escaping needed within JSDoc comments

3. **Angle Brackets** (`<` and `>`)
   - Used for generic type references: `Array<string>`, `Map<K, V>`
   - Essential for TypeScript type documentation

4. **Curly Braces** (`{` and `}`)
   - Used in JSDoc type annotations: `@type {string}`
   - Used in object descriptions: `{key: value}`

5. **Slashes** (`/`)
   - Only escaped when part of comment delimiters (`/*` or `*/`)
   - Regular slashes preserved for paths and regex patterns

6. **Asterisks** (`*`)
   - Only escaped when part of comment delimiters (`*/`)
   - Regular asterisks preserved for emphasis

## Implementation

### Files

The escaping logic is implemented in two files:

1. **`src/generators/tsdoc-generator.ts`**
   - `escapeJSDoc()` method
   - Used for property docs, method docs, parameter docs

2. **`src/builders/class-builder.ts`**
   - `escapeJsDocText()` method
   - Used for class descriptions

Both implementations use the **same escaping logic** to ensure consistency.

### Code Example

```typescript
/**
 * Escape JSDoc special characters
 *
 * Handles special characters that could break JSDoc syntax:
 * - Comment delimiters: */ and /*
 * - Newlines: adds proper JSDoc line prefix
 *
 * Characters preserved for JSDoc functionality:
 * - Backticks (`) for inline code
 * - Angle brackets (<>) for type references
 * - Curly braces ({}) for @type tags
 * - @ symbol (context-aware escaping)
 */
private escapeJSDoc(text: string): string {
  if (!text) return text;

  return text
    // Escape closing comment delimiter (MUST be first to avoid double-escaping)
    .replace(/\*\//g, '*\\/')
    // Escape opening comment delimiter
    .replace(/\/\*/g, '/\\*')
    // Escape @ at start of line to prevent false JSDoc tags
    // Only escape @ when it's at the start of a line or after whitespace
    .replace(/(^|\n)\s*@/g, '$1\\@')
    // Handle newlines by adding JSDoc line prefix
    .replace(/\n/g, '\n * ');
}
```

## Examples

### Example 1: Comment Delimiters

**Input:**
```javascript
description: "This function /* does something */ important"
```

**Output:**
```javascript
/**
 * This function /\* does something *\/ important
 */
```

### Example 2: Inline Code with Backticks

**Input:**
```javascript
description: "Use `const foo = "bar"` for constants"
```

**Output:**
```javascript
/**
 * Use `const foo = "bar"` for constants
 */
```

### Example 3: Type References

**Input:**
```javascript
description: "Returns Array<User> or Map<string, User>"
```

**Output:**
```javascript
/**
 * Returns Array<User> or Map<string, User>
 */
```

### Example 4: Email Addresses

**Input:**
```javascript
description: "Email like @username or user@example.com"
```

**Output:**
```javascript
/**
 * Email like \@username or user@example.com
 */
```
(Note: `@username` at start is escaped, but `user@example.com` is preserved)

### Example 5: Multiline Descriptions

**Input:**
```javascript
description: "Line 1\nLine 2 with `code`\nLine 3"
```

**Output:**
```javascript
/**
 * Line 1
 * Line 2 with `code`
 * Line 3
 */
```

### Example 6: Complex Example

**Input:**
```javascript
description: "Example: `const regex = /pattern/;` creates /* comment */ with types like Array<T>"
```

**Output:**
```javascript
/**
 * Example: `const regex = /pattern/;` creates /\* comment *\/ with types like Array<T>
 */
```

## Design Rationale

### Why Not Escape Everything?

We could escape all special characters, but this would harm readability:

❌ **Over-Escaping Approach:**
```javascript
/**
 * Use \`backticks\` for code like Array\<string\> with \{key: value\}
 */
```

✅ **Our Approach:**
```javascript
/**
 * Use `backticks` for code like Array<string> with {key: value}
 */
```

### Escape Order Matters

The order of replacements is critical:

1. **`*/` must be escaped FIRST** - Otherwise, escaping `/*` could create `*\/` which might be further processed
2. **`/*` escaping** - After closing delimiter is safe
3. **`@` escaping** - Context-aware, only at line start
4. **Newlines** - Last, adds JSDoc line prefix

### Context-Aware Escaping

The `@` symbol is only escaped when it could be mistaken for a JSDoc tag:

- `@param` at line start → escaped to `\@param`
- `user@example.com` in text → preserved
- `@username` at start → escaped to `\@username`

## Testing

Comprehensive test coverage ensures the escaping works correctly:

### Test Files

1. **`src/generators/__tests__/tsdoc-generator.test.ts`**
   - 45 tests covering all property and method doc scenarios
   - Tests for all special characters and edge cases

2. **`src/builders/__tests__/class-builder.test.ts`**
   - 45 tests covering class-level documentation
   - Tests for escaping in class descriptions

### Test Coverage

- ✅ Comment delimiters (`/*` and `*/`)
- ✅ Backticks for inline code
- ✅ Single and double quotes
- ✅ Angle brackets for types
- ✅ Curly braces
- ✅ At symbols (@)
- ✅ Multiline descriptions
- ✅ Complex combinations
- ✅ Pattern constraints
- ✅ Example values
- ✅ Default values
- ✅ Parameter descriptions
- ✅ Request body descriptions

## Maintenance

When modifying the escaping logic:

1. **Update both files** - `tsdoc-generator.ts` and `class-builder.ts` must use identical logic
2. **Update tests** - Add test cases for new scenarios
3. **Verify generated code** - Run generation and inspect output
4. **Check TypeScript compilation** - Ensure generated code compiles without errors
5. **Update this document** - Keep documentation in sync with implementation

## Related Issues

This implementation addresses the following concerns:

- Prevents malformed JSDoc comments that break TypeScript compilation
- Maintains readability of generated documentation
- Preserves JSDoc functionality (tags, types, inline code)
- Handles edge cases like nested structures and multiline text
- Consistent behavior across all generated code (models, APIs, properties)

## References

- [TSDoc Specification](https://tsdoc.org/)
- [JSDoc Documentation](https://jsdoc.app/)
- [TypeScript JSDoc Reference](https://www.typescriptlang.org/docs/handbook/jsdoc-supported-types.html)
