# Klasik Architecture

This document provides technical implementation details for developers who want to understand, modify, or contribute to Klasik.

## Table of Contents

- [Overview](#overview)
- [Why ts-morph?](#why-ts-morph)
- [Why Plugin Architecture?](#why-plugin-architecture)
- [Why Intermediate Representation (IR)?](#why-intermediate-representation-ir)
- [Architecture Components](#architecture-components)
- [Code Generation Pipeline](#code-generation-pipeline)
- [Plugin System](#plugin-system)
- [Testing Strategy](#testing-strategy)
- [Development Guide](#development-guide)

## Overview

- **Type Safety**: Generated code is parsed and validated as TypeScript AST
- **Maintainability**: AST manipulation is more robust than string concatenation
- **Extensibility**: Plugin architecture allows easy feature additions
- **Format Agnostic**: Unified IR handles OpenAPI, CRDs, and JSON Schema

## Why ts-morph?

### Problem with String-Based Generation

The original Klasik used template strings and manual code construction:

```typescript
// Original Klasik v1 approach
let code = `export class ${className} {\n`;
code += `  ${propertyName}: ${propertyType};\n`;
code += `}\n`;
```

**Issues:**
- ❌ No syntax validation until runtime
- ❌ Hard to maintain complex structures (decorators, imports, etc.)
- ❌ String escaping complexity
- ❌ Difficult to refactor or modify generated code
- ❌ No IDE support for template content

### Solution: AST-Based Generation

Klasik uses ts-morph to build proper TypeScript Abstract Syntax Trees:

```typescript
// Klasik approach
const classDeclaration = sourceFile.addClass({
  name: className,
  isExported: true
});

classDeclaration.addProperty({
  name: propertyName,
  type: propertyType,
  decorators: [
    { name: 'Expose', arguments: [] },
    { name: 'ApiProperty', arguments: ['{ type: String }'] }
  ]
});
```

**Benefits:**
- ✅ TypeScript-validated AST construction
- ✅ Automatic formatting and indentation
- ✅ Type-safe API for code manipulation
- ✅ Built-in import management
- ✅ Easier to test and maintain
- ✅ IDE autocomplete and type checking

### Performance Considerations

While AST manipulation is slightly slower than string concatenation, the benefits far outweigh the cost:

- **Correctness**: Generated code is always syntactically valid
- **Maintainability**: Changes to generation logic are easier and safer
- **Debugging**: AST nodes can be inspected and validated
- **Testing**: Unit tests can verify AST structure without running TypeScript compiler

## Why Plugin Architecture?

### Problem with Monolithic Code Generation

Original Klasik had all generation logic in a single large module:
- Hard to add new features without breaking existing code
- Difficult to test individual features in isolation
- No way to selectively enable/disable features
- Code duplication across different generators

### Solution: Hook-Based Plugin System

Klasik uses a priority-ordered hook system:

```typescript
interface Plugin {
  name: string;
  priority: number;

  hooks: {
    beforeGeneration?(context: GenerationContext): void;
    onSchemaLoad?(schema: SchemaIR): void;
    onClassGeneration?(classNode: ClassDeclaration, schema: ObjectSchema): void;
    onPropertyGeneration?(property: PropertyDeclaration, field: Field): void;
    afterGeneration?(context: GenerationContext): void;
  };
}
```

**Benefits:**
- ✅ **Modularity**: Each feature is a self-contained plugin
- ✅ **Testability**: Plugins can be tested independently
- ✅ **Extensibility**: Add new features without modifying core
- ✅ **Flexibility**: Users can enable/disable features via CLI flags
- ✅ **Priority Control**: Plugins execute in defined order

### Plugin Examples

**1. NestJS Swagger Plugin**
```typescript
class NestJSSwaggerPlugin implements Plugin {
  name = 'nestjs-swagger';
  priority = 100;

  hooks = {
    onPropertyGeneration(property, field) {
      property.addDecorator({
        name: 'ApiProperty',
        arguments: [`{ type: ${field.type}, required: ${field.required} }`]
      });
    }
  };
}
```

**2. Class Validator Plugin**
```typescript
class ClassValidatorPlugin implements Plugin {
  name = 'class-validator';
  priority = 90;

  hooks = {
    onPropertyGeneration(property, field) {
      if (field.required) {
        property.addDecorator({ name: 'IsNotEmpty' });
      }
      if (field.type === 'string') {
        property.addDecorator({ name: 'IsString' });
      }
    }
  };
}
```

**3. ESM Plugin**
```typescript
class ESMPlugin implements Plugin {
  name = 'esm';
  priority = 200; // Runs after others

  hooks = {
    afterGeneration(context) {
      // Add .js extensions to all imports
      for (const sourceFile of context.project.getSourceFiles()) {
        for (const importDecl of sourceFile.getImportDeclarations()) {
          const moduleSpecifier = importDecl.getModuleSpecifierValue();
          if (moduleSpecifier.startsWith('./') && !moduleSpecifier.endsWith('.js')) {
            importDecl.setModuleSpecifier(moduleSpecifier + '.js');
          }
        }
      }
    }
  };
}
```

### Plugin Priority System

Plugins execute in priority order (lower numbers first):

1. **Core plugins** (priority 0-50): Base class-transformer decorators
2. **Feature plugins** (priority 50-150): NestJS, class-validator
3. **Transform plugins** (priority 150-200): ESM, custom templates
4. **Finalization plugins** (priority 200+): Formatting, validation

## Why Intermediate Representation (IR)?

### Problem with Format-Specific Generators

Without IR, each input format needs its own generator:

```
OpenAPI → OpenAPI Generator → TypeScript
CRD → CRD Generator → TypeScript
JSON Schema → JSON Schema Generator → TypeScript
```

This leads to:
- ❌ Code duplication across generators
- ❌ Inconsistent output for similar schemas
- ❌ Hard to add new input formats
- ❌ Difficult to maintain shared features

### Solution: Unified IR Layer

Klasik uses a unified Intermediate Representation:

```
OpenAPI ──┐
          ├──→ SchemaIR ──→ TypeScript Generator ──→ TypeScript
CRD ──────┤
          │
JSON Schema ─┘
```

**IR Structure:**

```typescript
interface SchemaIR {
  schemas: Map<string, ObjectSchema>;
  metadata: {
    sourceFormat: 'openapi' | 'crd' | 'jsonschema';
    version: string;
  };
}

interface ObjectSchema {
  name: string;
  description?: string;
  fields: Field[];
  required: string[];
}

interface Field {
  name: string;
  type: string;
  description?: string;
  required: boolean;
  array?: boolean;
  enum?: string[];
  format?: string;
}
```

**Benefits:**
- ✅ **Single Source of Truth**: One generator for all formats
- ✅ **Consistency**: Same TypeScript output for equivalent schemas
- ✅ **Extensibility**: Add new formats by implementing IR converter
- ✅ **Testability**: Test converters and generator separately
- ✅ **Optimization**: Transform IR before generation (deduplication, normalization)

### IR Conversion Flow

**OpenAPI to IR:**
```typescript
OpenAPILoader.load(spec)
  → OpenAPIConverter.toIR(spec)
  → SchemaIR
```

**CRD to IR:**
```typescript
CRDLoader.load(yaml)
  → CRDConverter.toIR(crd)
  → SchemaIR
  → mergeIRs() // Deduplication for multiple CRDs
```

**JSON Schema to IR:**
```typescript
JSONSchemaLoader.load(schema)
  → JSONSchemaConverter.toIR(schema)
  → SchemaIR
```

## Architecture Components

### 1. Loaders (`src/loaders/`)

Responsible for fetching and parsing input specifications:

- **SpecLoader**: Fetches from URL or file, detects format (JSON/YAML)
- **CRDLoader**: Loads Kubernetes CRDs, handles multi-document YAML
- **JSONSchemaLoader**: Loads JSON Schema files

**Key Features:**
- HTTP/HTTPS support with custom headers
- File system support
- Automatic format detection
- External reference resolution (`--resolve-refs`)

### 2. Converters (`src/converters/`)

Transform input specifications to IR:

- **OpenAPIConverter**: OpenAPI 3.0 → SchemaIR
- **CRDConverter**: Kubernetes CRD → SchemaIR
- **JSONSchemaConverter**: JSON Schema → SchemaIR

**Responsibilities:**
- Schema traversal and extraction
- Type mapping (OpenAPI types → TypeScript types)
- Reference resolution
- Metadata extraction

### 3. Intermediate Representation (`src/ir/`)

Core data structures:

- **SchemaIR**: Top-level container
- **ObjectSchema**: Class/interface representation
- **Field**: Property representation
- **IRHelpers**: Utility functions for IR manipulation

### 4. Generator (`src/generator/`)

Produces TypeScript code from IR:

- **ClassGenerator**: Creates class declarations
- **PropertyGenerator**: Creates property declarations with decorators
- **ImportGenerator**: Manages import statements
- **ExportGenerator**: Creates barrel exports (index.ts)

**Uses ts-morph for:**
- AST construction
- Import management
- Formatting and pretty-printing
- Type-safe code generation

### 5. Plugins (`src/plugins/`)

Feature extensions:

- **CorePlugin**: Base class-transformer decorators (@Expose, @Type)
- **NestJSSwaggerPlugin**: @ApiProperty decorators (--nestjs-swagger)
- **ClassValidatorPlugin**: Validation decorators (--class-validator)
- **ESMPlugin**: .js extension injection (--esm)

### 6. CLI (`src/cli/`)

Command-line interface:

- **generate**: OpenAPI → TypeScript
- **download**: Download spec without generation
- **generate-crd**: Kubernetes CRD → TypeScript
- **generate-jsonschema**: JSON Schema → TypeScript

## Code Generation Pipeline

### Full Pipeline Flow

```
1. INPUT
   ├─ User runs CLI command
   ├─ Parse CLI arguments
   └─ Initialize configuration

2. LOADING
   ├─ SpecLoader fetches specification
   ├─ Detect format (JSON/YAML)
   ├─ Parse with js-yaml or JSON.parse()
   └─ Resolve external $refs if --resolve-refs

3. CONVERSION
   ├─ Select converter based on input format
   ├─ Convert to SchemaIR
   ├─ Merge IRs if multiple inputs (CRDs)
   └─ Normalize and deduplicate

4. PLUGIN INITIALIZATION
   ├─ Load enabled plugins based on CLI flags
   ├─ Sort by priority
   └─ Call beforeGeneration hooks

5. GENERATION
   ├─ Create ts-morph Project
   ├─ For each schema in IR:
   │   ├─ Create SourceFile
   │   ├─ Call onSchemaLoad hooks
   │   ├─ Generate class declaration
   │   ├─ Call onClassGeneration hooks
   │   ├─ For each field:
   │   │   ├─ Generate property
   │   │   └─ Call onPropertyGeneration hooks
   │   └─ Add imports
   ├─ Generate index.ts (barrel exports)
   └─ Call afterGeneration hooks

6. OUTPUT
   ├─ Format all files (prettier via ts-morph)
   ├─ Write to disk
   └─ Report statistics
```

### Example: Generating a Simple Class

**Input OpenAPI Schema:**
```yaml
components:
  schemas:
    User:
      type: object
      required:
        - id
        - email
      properties:
        id:
          type: string
          format: uuid
        email:
          type: string
          format: email
        name:
          type: string
```

**Step 1: Convert to IR**
```typescript
{
  name: 'User',
  fields: [
    { name: 'id', type: 'string', required: true, format: 'uuid' },
    { name: 'email', type: 'string', required: true, format: 'email' },
    { name: 'name', type: 'string', required: false }
  ],
  required: ['id', 'email']
}
```

**Step 2: Generate AST**
```typescript
const classDecl = sourceFile.addClass({
  name: 'User',
  isExported: true
});

// Core plugin adds @Expose
classDecl.addProperty({
  name: 'id',
  type: 'string',
  decorators: [{ name: 'Expose' }, { name: 'IsUUID' }]
});
```

**Step 3: Output TypeScript**
```typescript
import { Expose } from 'class-transformer';
import { IsUUID, IsEmail, IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class User {
  @Expose()
  @ApiProperty({ type: String, format: 'uuid', required: true })
  @IsUUID()
  id: string;

  @Expose()
  @ApiProperty({ type: String, format: 'email', required: true })
  @IsEmail()
  email: string;

  @Expose()
  @ApiProperty({ type: String, required: false })
  @IsOptional()
  @IsString()
  name?: string;
}
```

## Plugin System

### Creating a Custom Plugin

```typescript
import { Plugin, GenerationContext, ObjectSchema, Field } from 'klasik';
import { ClassDeclaration, PropertyDeclaration } from 'ts-morph';

export class CustomPlugin implements Plugin {
  name = 'my-custom-plugin';
  priority = 100;

  hooks = {
    // Called once before generation starts
    beforeGeneration(context: GenerationContext): void {
      console.log(`Generating ${context.schemas.size} schemas`);
    },

    // Called for each schema
    onSchemaLoad(schema: ObjectSchema): void {
      // Modify schema before generation
      schema.fields.forEach(field => {
        if (field.name.startsWith('_')) {
          field.name = field.name.slice(1); // Remove leading underscore
        }
      });
    },

    // Called when class is created
    onClassGeneration(classNode: ClassDeclaration, schema: ObjectSchema): void {
      // Add class-level decorators or JSDoc
      classNode.addJsDoc({
        description: schema.description || `Generated class for ${schema.name}`
      });
    },

    // Called for each property
    onPropertyGeneration(property: PropertyDeclaration, field: Field): void {
      // Add custom decorators based on field metadata
      if (field.format === 'date-time') {
        property.addDecorator({
          name: 'Transform',
          arguments: ['({ value }) => new Date(value)', { isDecoratorFactory: true }]
        });
      }
    },

    // Called after all generation is complete
    afterGeneration(context: GenerationContext): void {
      // Post-process all files
      for (const sourceFile of context.project.getSourceFiles()) {
        // Add file-level comments, organize imports, etc.
      }
    }
  };
}
```

### Plugin Registration

Plugins are registered in the generator configuration:

```typescript
const generator = new TypeScriptGenerator({
  plugins: [
    new CorePlugin(),
    new ClassValidatorPlugin(),
    new NestJSSwaggerPlugin(),
    new CustomPlugin()
  ]
});
```

### Built-in Plugins

| Plugin | Priority | Flag | Purpose |
|--------|----------|------|---------|
| CorePlugin | 10 | (always) | @Expose, @Type decorators |
| ClassValidatorPlugin | 50 | --class-validator | @IsString, @IsNumber, etc. |
| NestJSSwaggerPlugin | 60 | --nestjs-swagger | @ApiProperty decorators |
| ESMPlugin | 200 | --esm | Add .js extensions to imports |

## Testing Strategy

### Test Coverage

Klasik has comprehensive test coverage across all components:

- **Total Tests**: 748 (as of latest build)
- **Test Framework**: Jest
- **Coverage Areas**:
  - Loaders (URL fetching, format detection)
  - Converters (OpenAPI, CRD, JSON Schema → IR)
  - Generator (IR → TypeScript AST)
  - Plugins (decorator generation)
  - CLI (command parsing, execution)
  - Integration (end-to-end generation)

### Test Organization

```
tests/
├── unit/
│   ├── loaders/
│   │   ├── spec-loader.test.ts
│   │   ├── crd-loader.test.ts
│   │   └── jsonschema-loader.test.ts
│   ├── converters/
│   │   ├── openapi-converter.test.ts
│   │   ├── crd-converter.test.ts
│   │   └── jsonschema-converter.test.ts
│   ├── generator/
│   │   ├── class-generator.test.ts
│   │   └── property-generator.test.ts
│   └── plugins/
│       ├── class-validator.test.ts
│       └── nestjs-swagger.test.ts
├── integration/
│   ├── openapi-generation.test.ts
│   ├── crd-generation.test.ts
│   └── jsonschema-generation.test.ts
└── fixtures/
    ├── openapi/
    ├── crds/
    └── jsonschema/
```

### Test Examples

**Unit Test: Type Conversion**
```typescript
describe('OpenAPIConverter', () => {
  it('should convert string type to TypeScript string', () => {
    const field = converter.convertField({
      type: 'string',
      description: 'User name'
    });

    expect(field.type).toBe('string');
  });

  it('should convert array type with items', () => {
    const field = converter.convertField({
      type: 'array',
      items: { type: 'string' }
    });

    expect(field.type).toBe('string');
    expect(field.array).toBe(true);
  });
});
```

**Integration Test: Full Generation**
```typescript
describe('CRD Generation', () => {
  it('should generate TypeScript from ArgoCD Application CRD', async () => {
    const result = await generateFromCRD({
      url: 'fixtures/application-crd.yaml',
      output: 'tmp/output',
      nestjsSwagger: true,
      classValidator: true
    });

    expect(result.filesGenerated).toBeGreaterThan(0);

    const applicationFile = fs.readFileSync('tmp/output/models/application.ts', 'utf-8');
    expect(applicationFile).toContain('export class Application');
    expect(applicationFile).toContain('@ApiProperty');
    expect(applicationFile).toContain('@IsOptional');
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- spec-loader.test.ts

# Run in watch mode
npm test -- --watch
```

## Development Guide

### Project Structure

```
klasik-2/
├── src/
│   ├── cli/              # Command-line interface
│   │   ├── commands/     # CLI command implementations
│   │   └── index.ts      # Main CLI entry point
│   ├── loaders/          # Specification loaders
│   ├── converters/       # Format converters to IR
│   ├── ir/               # Intermediate Representation
│   ├── generator/        # TypeScript code generator
│   ├── plugins/          # Plugin implementations
│   └── utils/            # Shared utilities
├── tests/                # Test suites
├── docs/                 # Additional documentation
└── examples/             # Usage examples

```

### Building from Source

```bash
# Clone repository
git clone https://github.com/your-org/klasik-2.git
cd klasik-2

# Install dependencies
npm install

# Build TypeScript
npm run build

# Run CLI locally
node dist/cli/index.js generate --help

# Run tests
npm test
```

### Making Changes

1. **Add New Feature**:
   - Create plugin in `src/plugins/`
   - Register plugin in generator configuration
   - Add CLI flag if needed
   - Write unit tests
   - Update documentation

2. **Add New Input Format**:
   - Create loader in `src/loaders/`
   - Create converter in `src/converters/`
   - Add CLI command in `src/cli/commands/`
   - Write integration tests
   - Update README with examples

3. **Fix Bug**:
   - Write failing test that reproduces bug
   - Fix the issue
   - Verify test passes
   - Check for regression with full test suite

### Debugging

**Debug Generated Code:**
```typescript
// Enable verbose logging
const generator = new TypeScriptGenerator({ verbose: true });

// Inspect IR before generation
console.log(JSON.stringify(schemaIR, null, 2));

// Inspect AST after generation
const sourceFile = project.getSourceFile('user.ts');
console.log(sourceFile.getFullText());
```

**Debug Plugin Execution:**
```typescript
class DebugPlugin implements Plugin {
  name = 'debug';
  priority = 1; // Run first

  hooks = {
    onPropertyGeneration(property, field) {
      console.log(`Generating property: ${field.name} (${field.type})`);
    }
  };
}
```

### Performance Optimization

**IR Caching:**
```typescript
// Cache converted IR for repeated generation
const irCache = new Map<string, SchemaIR>();

if (irCache.has(specUrl)) {
  schemaIR = irCache.get(specUrl);
} else {
  schemaIR = await converter.toIR(spec);
  irCache.set(specUrl, schemaIR);
}
```

**Parallel Generation:**
```typescript
// Generate multiple files in parallel
const promises = Array.from(schemaIR.schemas.entries()).map(([name, schema]) => {
  return generateClass(schema);
});

await Promise.all(promises);
```

## Design Decisions

### Why Not Use openapi-generator?

The official openapi-generator has limitations:
- Java-based (requires JVM)
- Heavy dependencies
- Difficult to customize
- Inconsistent TypeScript output
- No CRD or JSON Schema support

Klasik provides:
- Pure TypeScript/Node.js (no JVM)
- Lightweight and fast
- Easy plugin system for customization
- Consistent, high-quality output
- Multi-format support

### Why class-transformer?

class-transformer provides:
- Serialization/deserialization with @Type decorators
- Nested object support
- Transform hooks
- Integration with NestJS and other frameworks

Alternative approaches (plain interfaces) lack runtime type information.

### Why Mustache Templates?

Custom templates use Mustache because:
- Simple, logic-less syntax
- Easy to learn
- No arbitrary code execution (security)
- Works with any text format

Users can override default templates for custom output formats.

## Future Enhancements

Potential improvements for future versions:

1. **GraphQL Support**: Add GraphQL schema → TypeScript converter
2. **Zod Integration**: Generate Zod schemas alongside classes
3. **Async API Support**: Support AsyncAPI specifications
4. **Watch Mode**: Regenerate on spec file changes
5. **Incremental Generation**: Only regenerate changed schemas
6. **Source Maps**: Map generated code back to spec locations
7. **Custom Validators**: Plugin API for custom validation decorators
8. **gRPC Support**: Generate from Protocol Buffers

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for:
- Code style guidelines
- Pull request process
- Development workflow
- Release process

## References

- [ts-morph Documentation](https://ts-morph.com/)
- [OpenAPI Specification](https://swagger.io/specification/)
- [Kubernetes CRD Documentation](https://kubernetes.io/docs/tasks/extend-kubernetes/custom-resources/custom-resource-definitions/)
- [JSON Schema Specification](https://json-schema.org/)
- [class-transformer](https://github.com/typestack/class-transformer)
- [class-validator](https://github.com/typestack/class-validator)
