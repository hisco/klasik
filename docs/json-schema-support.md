# JSON Schema Support Matrix

This document outlines which JSON Schema features are supported by Klasik for generating TypeScript models.

## Overview

Klasik provides solid support for common JSON Schema Draft 7 features but lacks support for some advanced patterns like `patternProperties`, `not`, and `dependencies`. This affects complex real-world schemas like GitHub Workflow but works well for most standard schemas.

## Supported Features

### Type System

| Feature | Support | Notes |
|---------|---------|-------|
| **Primitive types** | ✅ Full | `string`, `number`, `integer`, `boolean`, `null` |
| **object** | ✅ Full | With `properties`, `required`, `additionalProperties` |
| **array** | ✅ Full | With `items`, `minItems`, `maxItems`, `uniqueItems` |
| **enum** | ✅ Full | Generates enum or union types |
| **const** | ✅ Full | Draft 6+ single-value enum |
| **nullable** | ✅ Full | TypeScript optional (`?`) or union with `null` |

### Schema Composition

| Feature | Support | Notes |
|---------|---------|-------|
| **oneOf** | ✅ Full | Converted to TypeScript union types |
| **anyOf** | ✅ Full | Converted to TypeScript union types |
| **allOf** | ⚠️ Partial | Merged as union in complex cases; simple cases work well |
| **$ref** (internal) | ✅ Full | References to `#/definitions/*` or `#/$defs/*` |
| **$ref** (external) | ✅ Full | Use `--resolve-refs` flag to resolve external references |
| **definitions** | ✅ Full | Draft 4-7 reusable schemas |
| **$defs** | ✅ Full | Draft 2019-09+ reusable schemas |

### Validation Keywords

| Feature | Support | Generated As | Notes |
|---------|---------|--------------|-------|
| **required** | ✅ Full | Required properties | TypeScript required vs optional |
| **properties** | ✅ Full | Class properties | With decorators |
| **additionalProperties** | ✅ Full | `Record<string, T>` | Object or boolean forms |
| **minLength / maxLength** | ✅ Full | `@MinLength()`, `@MaxLength()` | class-validator |
| **minimum / maximum** | ✅ Full | `@Min()`, `@Max()` | class-validator |
| **exclusiveMinimum / exclusiveMaximum** | ✅ Full | Both boolean (Draft 4) and number forms | |
| **pattern** | ✅ Full | `@Matches()` | Regex validation |
| **minItems / maxItems** | ✅ Full | `@ArrayMinSize()`, `@ArrayMaxSize()` | class-validator |
| **uniqueItems** | ✅ Full | `@ArrayUnique()` | class-validator |
| **multipleOf** | ✅ Full | Constraint metadata | |
| **format** | ✅ Full | `@IsEmail()`, `@IsUrl()`, `@IsUUID()`, etc. | Preserved for validation |

### Object Constraints

| Feature | Support | Notes |
|---------|---------|-------|
| **minProperties / maxProperties** | ⚠️ Metadata | Preserved but not enforced in TypeScript |
| **propertyNames** | ❌ No | Pattern validation of property names |
| **patternProperties** | ❌ No | **CRITICAL GAP** - Pattern-based property matching |
| **dependencies** | ❌ No | Property dependencies not enforced |

### Conditional & Logic

| Feature | Support | Notes |
|---------|---------|-------|
| **if/then/else** | ❌ No | Draft 7+ conditional schemas |
| **not** | ❌ No | Schema negation for mutual exclusivity |
| **dependentSchemas** | ❌ No | Draft 2019-09+ schema-based dependencies |

### Metadata & Annotations

| Feature | Support | Usage |
|---------|---------|-------|
| **title** | ✅ Full | Class name if no explicit name |
| **description** | ✅ Full | JSDoc comments |
| **default** | ✅ Full | Property metadata |
| **examples** | ✅ Full | Property metadata |
| **deprecated** | ⚠️ Metadata | Preserved but not marked as `@deprecated` |
| **readOnly / writeOnly** | ⚠️ Metadata | Preserved but not enforced |
| **$comment** | ⚠️ Metadata | Preserved in schema metadata |
| **Vendor extensions** | ✅ Full | All `x-*` properties preserved |

## Unsupported Features (Critical Gaps)

### 1. patternProperties (CRITICAL)

**Status:** ❌ Not Supported

**What it does:**
```json
{
  "patternProperties": {
    "^[_a-zA-Z][a-zA-Z0-9_-]*$": {
      "type": "object",
      "properties": {
        "name": { "type": "string" }
      }
    }
  }
}
```

**Use cases:**
- Job IDs in GitHub Actions workflows
- Service names in Docker Compose schemas
- Variable names in configuration schemas
- Dynamic property names matching a pattern

**Impact:** HIGH
- Schemas with dynamic property names cannot be properly typed
- Falls back to `Record<string, any>` or `unknown`
- Loss of type safety for the most important parts of many schemas

**Workaround:**
- Current: Falls back to `additionalProperties` behavior
- TypeScript limitation: Can't express pattern-based keys
- Best effort: Could generate `Record<string, Type>` for pattern properties

**Example schemas affected:**
- GitHub Workflow (job definitions)
- Docker Compose (service definitions)
- Kubernetes Custom Resources (arbitrary property names)

---

### 2. not Keyword

**Status:** ❌ Not Supported

**What it does:**
```json
{
  "properties": {
    "branches": { "type": "array" },
    "branches-ignore": { "type": "array" }
  },
  "not": {
    "required": ["branches", "branches-ignore"]
  }
}
```

**Use cases:**
- Mutual exclusivity constraints (A XOR B)
- Forbidden property combinations
- Type constraints by negation

**Impact:** MEDIUM-HIGH
- Both mutually exclusive properties generated as optional
- No enforcement of XOR logic
- Runtime validation may fail for invalid combinations

**Workaround:**
- Option 1: Generate union types for mutually exclusive branches
- Option 2: Add JSDoc comments warning about mutual exclusivity
- Option 3: Custom validation decorators (future)

**Example schemas affected:**
- GitHub Workflow (branches vs branches-ignore)
- Many schemas with exclusive alternatives

---

### 3. dependencies Keyword

**Status:** ❌ Not Supported

**What it does:**
```json
{
  "properties": {
    "run": { "type": "string" },
    "working-directory": { "type": "string" }
  },
  "dependencies": {
    "working-directory": ["run"]
  }
}
```

**Use cases:**
- Conditional property requirements
- Property A requires property B to also be present

**Impact:** MEDIUM
- All properties generated independently
- Conditional requirements not enforced
- May allow invalid object construction

**Workaround:**
- Document in JSDoc comments
- Could generate conditional validation decorators (future)

**Example schemas affected:**
- GitHub Workflow (working-directory depends on run)
- Configuration schemas with related settings

---

### 4. External $ref

**Status:** ✅ Fully Supported (with --resolve-refs flag)

**What it does:**
```json
{
  "$ref": "https://example.com/schemas/user.json"
}
```

**Use cases:**
- Cross-file schema references
- Shared schema libraries
- Remote schema imports
- Local file references

**Usage:**

**CLI:**
```bash
klasik generate --input api.yaml --output ./generated --resolve-refs
```

**Programmatic:**
```typescript
const loader = new SpecLoader();
const spec = await loader.loadWithRefs({
  url: './api.yaml',
  resolveRefs: true,
  maxDepth: 10  // Optional: max recursion depth (default: 10)
});
```

**Supported Formats:**
- ✅ Relative paths: `./schemas/User.yaml`
- ✅ Absolute paths: `/path/to/schema.yaml`
- ✅ Remote URLs: `https://api.example.com/schemas/User.yaml`
- ✅ With fragments: `./schemas/User.yaml#/definitions/User`
- ✅ Nested refs (ref within ref)
- ✅ Circular reference detection

**Advanced Options:**
```bash
# With custom timeout
klasik generate --input api.yaml --output ./out --resolve-refs --timeout 60000

# With authentication headers
klasik generate --input https://api.example.com/spec.yaml \
  --output ./out \
  --resolve-refs \
  --header "Authorization: Bearer TOKEN"
```

**How It Works:**
1. Spec loader discovers all external `$ref` recursively
2. Downloads referenced files (with auth headers if provided)
3. Inlines refs into main spec before parsing
4. Generates code from fully resolved spec

**Impact:** ✅ NONE - Fully transparent
- All external refs are downloaded and inlined automatically
- Generated code has no external dependencies
- Works with all existing features (decorators, validation, etc.)

---

## Draft Support Matrix

| JSON Schema Draft | Basic Support | Advanced Features |
|-------------------|---------------|-------------------|
| **Draft 4** | ✅ Full | ⚠️ Most (missing patternProperties, not, dependencies) |
| **Draft 6** | ✅ Full | ⚠️ Most (adds const, propertyNames - const supported) |
| **Draft 7** | ✅ Full | ⚠️ Most (adds if/then/else - not supported) |
| **Draft 2019-09** | ⚠️ Partial | ❌ Limited (missing unevaluatedProperties, dependentSchemas) |
| **Draft 2020-12** | ⚠️ Partial | ❌ Limited (same gaps as 2019-09) |

## Tested Schemas

### ✅ Working Well

| Schema | Complexity | Notes |
|--------|------------|-------|
| **Kustomization** | Low-Medium | Simple properties, some oneOf/anyOf |
| **ArgoCD Application CRD** | High | 298 models, extensive nesting, works great |
| **Package.json** | Medium | Standard structure, good results |

### ⚠️ Partial Support

| Schema | Complexity | Limitations |
|--------|------------|-------------|
| **GitHub Workflow** | Very High | patternProperties for jobs, not for XOR filters |
| **Docker Compose** | High | patternProperties for services |

## Best Practices

### When Klasik Works Best

1. **Standard object schemas** with fixed property names
2. **CRD-style schemas** with defined properties and nested objects
3. **Configuration schemas** without dynamic property names
4. **Schemas using oneOf/anyOf/allOf** for type unions
5. **Well-defined validation rules** (length, format, patterns)

### Workarounds for Unsupported Features

#### patternProperties
- **Option 1:** Use `additionalProperties` with explicit typing
- **Option 2:** Define a `Record<string, Type>` property manually
- **Option 3:** Pre-process schema to convert patternProperties to explicit properties

#### not Keyword
- **Option 1:** Split into separate schemas with clear names
- **Option 2:** Add JSDoc warnings about mutual exclusivity
- **Option 3:** Validate at runtime with custom validators

#### dependencies
- **Option 1:** Document requirements in JSDoc
- **Option 2:** Add runtime validation in your code
- **Option 3:** Use TypeScript utility types for conditional properties

## Future Enhancements

### Planned (High Priority)

- [ ] **patternProperties** support - Generate `Record<string, Type>` for pattern-based properties
- [ ] **not** keyword support - Generate union types or validation decorators
- [ ] **dependencies** support - Track dependencies in IR and generate validation

### Under Consideration

- [ ] **if/then/else** conditional schemas
- [ ] **dependentSchemas** (Draft 2019-09+)
- [ ] **unevaluatedProperties** (Draft 2019-09+)
- [ ] **propertyNames** pattern validation

### Long Term

- [ ] Full Draft 2019-09 support
- [ ] Full Draft 2020-12 support
- [ ] Custom keyword extensions
- [ ] Plugin system for custom schema features

## Contributing

If you need support for a specific unsupported feature, please:
1. Open an issue with your use case
2. Provide example schemas that demonstrate the need
3. Describe the expected TypeScript output
4. Indicate if you're willing to contribute an implementation

## References

- [JSON Schema Specification](https://json-schema.org/specification.html)
- [JSON Schema Draft 7](https://json-schema.org/draft-07/json-schema-release-notes.html)
- [JSON Schema Draft 2020-12](https://json-schema.org/draft/2020-12/json-schema-core.html)
- [SchemaStore.org](https://www.schemastore.org/) - Collection of JSON schemas for testing
