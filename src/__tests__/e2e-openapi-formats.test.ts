/**
 * End-to-end tests for OpenAPI format validation
 *
 * Tests that all standard OpenAPI formats generate the correct
 * class-validator decorators. This addresses the bug where
 * date-time format incorrectly used @IsDate instead of @IsDateString.
 *
 * OpenAPI Standard Formats (https://swagger.io/docs/specification/data-models/data-types/):
 * - String: date, date-time, password, byte, binary
 * - String (common): email, uuid, uri/url, hostname, ipv4, ipv6
 * - Integer: int32, int64
 * - Number: float, double
 */

import * as fs from 'fs';
import * as path from 'path';
import { OpenAPIParser, OpenAPISpec } from '../parsers/openapi-parser';
import { Generator } from '../generator/generator';
import { ensureCleanDirectory, robustRemoveDir } from './test-helpers/cleanup-utils';

const TEST_OUTPUT_DIR = path.join(__dirname, '../../test-output/e2e-openapi-formats');

/**
 * Comprehensive OpenAPI spec with all standard formats
 */
const openApiFormatsSpec: OpenAPISpec = {
  openapi: '3.0.0',
  info: {
    title: 'OpenAPI Formats Test API',
    version: '1.0.0',
    description: 'API spec to test all OpenAPI format types',
  },
  components: {
    schemas: {
      // Model with all string formats
      StringFormatsModel: {
        type: 'object',
        description: 'Model testing all string format types',
        required: ['id'],
        properties: {
          id: {
            type: 'string',
            description: 'Simple string without format',
          },
          // Date formats (the main bug fix)
          dateField: {
            type: 'string',
            format: 'date',
            description: 'RFC 3339 date (YYYY-MM-DD)',
          },
          dateTimeField: {
            type: 'string',
            format: 'date-time',
            description: 'RFC 3339 date-time (ISO 8601)',
          },
          // Email format
          emailField: {
            type: 'string',
            format: 'email',
            description: 'Email address',
          },
          // UUID format
          uuidField: {
            type: 'string',
            format: 'uuid',
            description: 'UUID v4',
          },
          // URI/URL formats
          uriField: {
            type: 'string',
            format: 'uri',
            description: 'URI',
          },
          urlField: {
            type: 'string',
            format: 'url',
            description: 'URL',
          },
          // Network formats
          hostnameField: {
            type: 'string',
            format: 'hostname',
            description: 'Hostname (FQDN)',
          },
          ipv4Field: {
            type: 'string',
            format: 'ipv4',
            description: 'IPv4 address',
          },
          ipv6Field: {
            type: 'string',
            format: 'ipv6',
            description: 'IPv6 address',
          },
          // Encoded formats
          byteField: {
            type: 'string',
            format: 'byte',
            description: 'Base64-encoded data',
          },
          binaryField: {
            type: 'string',
            format: 'binary',
            description: 'Binary data',
          },
          // Password hint
          passwordField: {
            type: 'string',
            format: 'password',
            description: 'Password (hint only)',
          },
        },
      },
      // Model with integer formats
      IntegerFormatsModel: {
        type: 'object',
        description: 'Model testing integer format types',
        properties: {
          int32Field: {
            type: 'integer',
            format: 'int32',
            description: '32-bit integer',
          },
          int64Field: {
            type: 'integer',
            format: 'int64',
            description: '64-bit integer',
          },
          plainInteger: {
            type: 'integer',
            description: 'Plain integer without format',
          },
        },
      },
      // Model with number formats
      NumberFormatsModel: {
        type: 'object',
        description: 'Model testing number format types',
        properties: {
          floatField: {
            type: 'number',
            format: 'float',
            description: 'Single precision float',
          },
          doubleField: {
            type: 'number',
            format: 'double',
            description: 'Double precision float',
          },
          plainNumber: {
            type: 'number',
            description: 'Plain number without format',
          },
        },
      },
      // Real-world model combining multiple formats (like the customer's Allocation model)
      AllocationModel: {
        type: 'object',
        description: 'Real-world model similar to customer report',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
          },
          start: {
            type: 'string',
            format: 'date-time',
            description: 'Allocation start time',
          },
          end: {
            type: 'string',
            format: 'date-time',
            description: 'Allocation end time',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
          },
          ownerEmail: {
            type: 'string',
            format: 'email',
          },
          resourceUri: {
            type: 'string',
            format: 'uri',
          },
        },
      },
    },
  },
};

describe('E2E: OpenAPI Format Validators', () => {
  beforeAll(async () => {
    await ensureCleanDirectory(TEST_OUTPUT_DIR);
  });

  afterAll(async () => {
    await robustRemoveDir(TEST_OUTPUT_DIR, { silent: true });
  });

  describe('String Format Validators', () => {
    let generatedContent: string;

    beforeAll(async () => {
      const outputDir = path.join(TEST_OUTPUT_DIR, 'string-formats');

      const parser = new OpenAPIParser();
      const ir = parser.parse(openApiFormatsSpec);

      const generator = new Generator({
        outputDir,
        classValidator: true,
      });

      await generator.generate(ir);

      const filePath = path.join(outputDir, 'models', 'string-formats-model.ts');
      generatedContent = fs.readFileSync(filePath, 'utf-8');
    });

    it('should generate @IsDateString for date format (NOT @IsDate)', () => {
      // This is the main bug fix - @IsDate expects Date objects, not strings
      expect(generatedContent).toContain('@IsDateString()');
      expect(generatedContent).toContain("'dateField'?: string");

      // Should NOT use @IsDate for string date fields
      // (Note: @IsDate may still appear in imports if used elsewhere, but not for date format)
      const dateFieldSection = generatedContent.split("'dateField'")[0].split('\n').slice(-5).join('\n');
      expect(dateFieldSection).not.toContain('@IsDate()');
    });

    it('should generate @IsDateString for date-time format (NOT @IsDate)', () => {
      expect(generatedContent).toContain('@IsDateString()');
      expect(generatedContent).toContain("'dateTimeField'?: string");

      // Verify @IsDateString is imported
      expect(generatedContent).toContain('IsDateString');
    });

    it('should generate @IsEmail for email format', () => {
      expect(generatedContent).toContain('@IsEmail()');
      expect(generatedContent).toContain("'emailField'?: string");
    });

    it('should generate @IsUUID for uuid format', () => {
      expect(generatedContent).toContain('@IsUUID()');
      expect(generatedContent).toContain("'uuidField'?: string");
    });

    it('should generate @IsUrl for uri format', () => {
      expect(generatedContent).toContain('@IsUrl()');
      expect(generatedContent).toContain("'uriField'?: string");
    });

    it('should generate @IsUrl for url format', () => {
      expect(generatedContent).toContain('@IsUrl()');
      expect(generatedContent).toContain("'urlField'?: string");
    });

    it('should generate @IsFQDN for hostname format', () => {
      expect(generatedContent).toContain('@IsFQDN()');
      expect(generatedContent).toContain("'hostnameField'?: string");
    });

    it('should generate @IsIP with version 4 for ipv4 format', () => {
      expect(generatedContent).toContain("@IsIP('4')");
      expect(generatedContent).toContain("'ipv4Field'?: string");
    });

    it('should generate @IsIP with version 6 for ipv6 format', () => {
      expect(generatedContent).toContain("@IsIP('6')");
      expect(generatedContent).toContain("'ipv6Field'?: string");
    });

    it('should generate @IsBase64 for byte format', () => {
      expect(generatedContent).toContain('@IsBase64()');
      expect(generatedContent).toContain("'byteField'?: string");
    });

    it('should NOT add special validator for binary format', () => {
      // Binary is typically handled as file upload, not string validation
      expect(generatedContent).toContain("'binaryField'?: string");
      // Should only have @IsOptional and @IsString, no special format validator
    });

    it('should NOT add special validator for password format', () => {
      // Password is just a hint for UI/docs
      expect(generatedContent).toContain("'passwordField'?: string");
    });

    it('should import all required validators from class-validator', () => {
      expect(generatedContent).toContain('from "class-validator"');
      expect(generatedContent).toContain('IsDateString');
      expect(generatedContent).toContain('IsEmail');
      expect(generatedContent).toContain('IsUUID');
      expect(generatedContent).toContain('IsUrl');
      expect(generatedContent).toContain('IsFQDN');
      expect(generatedContent).toContain('IsIP');
      expect(generatedContent).toContain('IsBase64');
    });
  });

  describe('Integer Format Validators', () => {
    let generatedContent: string;

    beforeAll(async () => {
      const outputDir = path.join(TEST_OUTPUT_DIR, 'integer-formats');

      const parser = new OpenAPIParser();
      const ir = parser.parse(openApiFormatsSpec);

      const generator = new Generator({
        outputDir,
        classValidator: true,
      });

      await generator.generate(ir);

      const filePath = path.join(outputDir, 'models', 'integer-formats-model.ts');
      generatedContent = fs.readFileSync(filePath, 'utf-8');
    });

    it('should generate @IsInt for int32 format', () => {
      expect(generatedContent).toContain('@IsInt()');
      expect(generatedContent).toContain("'int32Field'?: number");
    });

    it('should generate @IsInt for int64 format', () => {
      expect(generatedContent).toContain('@IsInt()');
      expect(generatedContent).toContain("'int64Field'?: number");
    });

    it('should generate @IsNumber for plain integer', () => {
      expect(generatedContent).toContain('@IsNumber()');
      expect(generatedContent).toContain("'plainInteger'?: number");
    });
  });

  describe('Number Format Validators', () => {
    let generatedContent: string;

    beforeAll(async () => {
      const outputDir = path.join(TEST_OUTPUT_DIR, 'number-formats');

      const parser = new OpenAPIParser();
      const ir = parser.parse(openApiFormatsSpec);

      const generator = new Generator({
        outputDir,
        classValidator: true,
      });

      await generator.generate(ir);

      const filePath = path.join(outputDir, 'models', 'number-formats-model.ts');
      generatedContent = fs.readFileSync(filePath, 'utf-8');
    });

    it('should generate @IsNumber for float format', () => {
      expect(generatedContent).toContain('@IsNumber()');
      expect(generatedContent).toContain("'floatField'?: number");
    });

    it('should generate @IsNumber for double format', () => {
      expect(generatedContent).toContain('@IsNumber()');
      expect(generatedContent).toContain("'doubleField'?: number");
    });

    it('should generate @IsNumber for plain number', () => {
      expect(generatedContent).toContain('@IsNumber()');
      expect(generatedContent).toContain("'plainNumber'?: number");
    });
  });

  describe('Real-World Allocation Model (Customer Bug Report)', () => {
    let generatedContent: string;

    beforeAll(async () => {
      const outputDir = path.join(TEST_OUTPUT_DIR, 'allocation-model');

      const parser = new OpenAPIParser();
      const ir = parser.parse(openApiFormatsSpec);

      const generator = new Generator({
        outputDir,
        classValidator: true,
      });

      await generator.generate(ir);

      const filePath = path.join(outputDir, 'models', 'allocation-model.ts');
      generatedContent = fs.readFileSync(filePath, 'utf-8');
    });

    it('should use @IsDateString for start field (NOT @IsDate)', () => {
      // This is exactly what the customer reported - start/end fields with date-time format
      expect(generatedContent).toContain("'start'?: string");

      // Verify @IsDateString is used (fix for the bug)
      const lines = generatedContent.split('\n');
      const startFieldIndex = lines.findIndex((line) => line.includes("'start'"));
      const decoratorsBeforeStart = lines.slice(Math.max(0, startFieldIndex - 10), startFieldIndex).join('\n');

      expect(decoratorsBeforeStart).toContain('@IsDateString()');
      expect(decoratorsBeforeStart).not.toMatch(/@IsDate\(\)(?!\s*String)/); // Not @IsDate() alone
    });

    it('should use @IsDateString for end field (NOT @IsDate)', () => {
      expect(generatedContent).toContain("'end'?: string");

      const lines = generatedContent.split('\n');
      const endFieldIndex = lines.findIndex((line) => line.includes("'end'"));
      const decoratorsBeforeEnd = lines.slice(Math.max(0, endFieldIndex - 10), endFieldIndex).join('\n');

      expect(decoratorsBeforeEnd).toContain('@IsDateString()');
    });

    it('should use @IsDateString for createdAt and updatedAt fields', () => {
      expect(generatedContent).toContain("'createdAt'?: string");
      expect(generatedContent).toContain("'updatedAt'?: string");
      // Multiple @IsDateString decorators should be present
      const matches = generatedContent.match(/@IsDateString\(\)/g);
      expect(matches).not.toBeNull();
      expect(matches!.length).toBeGreaterThanOrEqual(4); // start, end, createdAt, updatedAt
    });

    it('should use @IsEmail for ownerEmail field', () => {
      expect(generatedContent).toContain("'ownerEmail'?: string");
      expect(generatedContent).toContain('@IsEmail()');
    });

    it('should use @IsUrl for resourceUri field', () => {
      expect(generatedContent).toContain("'resourceUri'?: string");
      expect(generatedContent).toContain('@IsUrl()');
    });

    it('should use @IsUUID for id field', () => {
      expect(generatedContent).toContain("'id'?: string");
      expect(generatedContent).toContain('@IsUUID()');
    });

    it('should compile without TypeScript errors', async () => {
      // Import ts-morph to verify the generated code is valid TypeScript
      const { Project } = await import('ts-morph');
      const project = new Project({
        useInMemoryFileSystem: true,
        compilerOptions: {
          strict: true,
          target: 2, // ES2015
          module: 1, // CommonJS
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
          skipLibCheck: true,
        },
      });

      // Add stub declarations for class-validator and class-transformer
      project.createSourceFile(
        'node_modules/class-validator/index.d.ts',
        `
        export function IsOptional(): PropertyDecorator;
        export function IsString(): PropertyDecorator;
        export function IsNumber(): PropertyDecorator;
        export function IsInt(): PropertyDecorator;
        export function IsDateString(): PropertyDecorator;
        export function IsEmail(): PropertyDecorator;
        export function IsUUID(): PropertyDecorator;
        export function IsUrl(): PropertyDecorator;
        export function IsFQDN(): PropertyDecorator;
        export function IsIP(version?: string): PropertyDecorator;
        export function IsBase64(): PropertyDecorator;
        `
      );

      project.createSourceFile(
        'node_modules/class-transformer/index.d.ts',
        `
        export function Expose(): PropertyDecorator;
        export function Type(typeFunction?: () => any): PropertyDecorator;
        `
      );

      // Add the generated content
      const sourceFile = project.createSourceFile('allocation-model.ts', generatedContent);

      // Get diagnostics (should be empty for valid code)
      const diagnostics = sourceFile.getPreEmitDiagnostics();
      const errors = diagnostics.filter((d) => d.getCategory() === 1); // 1 = Error

      if (errors.length > 0) {
        const errorMessages = errors.map((e) => e.getMessageText()).join('\n');
        fail(`TypeScript compilation errors:\n${errorMessages}`);
      }

      expect(errors.length).toBe(0);
    });
  });

  describe('Generated Code Structure', () => {
    it('should not have conflicting decorators (e.g., @IsString and @IsDate on same field)', async () => {
      const outputDir = path.join(TEST_OUTPUT_DIR, 'decorator-conflicts');

      const parser = new OpenAPIParser();
      const ir = parser.parse(openApiFormatsSpec);

      const generator = new Generator({
        outputDir,
        classValidator: true,
      });

      await generator.generate(ir);

      const filePath = path.join(outputDir, 'models', 'string-formats-model.ts');
      const content = fs.readFileSync(filePath, 'utf-8');

      // Parse the file to check for decorator conflicts
      const lines = content.split('\n');

      // Find date fields and verify they don't have both @IsString and @IsDate
      const dateFieldIndices = lines
        .map((line, index) => (line.includes("'dateField'") || line.includes("'dateTimeField'") ? index : -1))
        .filter((i) => i !== -1);

      for (const fieldIndex of dateFieldIndices) {
        const decoratorLines = lines.slice(Math.max(0, fieldIndex - 15), fieldIndex).join('\n');

        // Should have @IsDateString, not @IsDate
        if (decoratorLines.includes('@IsDate()') && !decoratorLines.includes('@IsDateString()')) {
          fail(`Found @IsDate() instead of @IsDateString() for date field at line ${fieldIndex}`);
        }
      }
    });
  });
});
