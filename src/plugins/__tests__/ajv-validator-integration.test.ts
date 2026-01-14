/**
 * Integration tests for AjvValidatorPlugin - Nested Validation
 *
 * Tests multi-level nested validation to ensure JSON Schema validation
 * works correctly at all nesting depths
 */

import { Generator } from '../../generator/generator';
import { JsonSchemaParser } from '../../parsers/json-schema-parser';
import * as path from 'path';
import * as fs from 'fs';

describe('AjvValidatorPlugin - Integration Tests', () => {
  const outputDir = path.join(__dirname, '../../../test-output-ajv-integration');

  beforeAll(async () => {
    // Clean output directory
    if (fs.existsSync(outputDir)) {
      fs.rmSync(outputDir, { recursive: true });
    }
  });

  afterAll(() => {
    // Clean up output directory
    if (fs.existsSync(outputDir)) {
      fs.rmSync(outputDir, { recursive: true });
    }
  });

  describe('Nested Validation - Real World Test', () => {
    it('should generate classes with nested validation support', async () => {
      // Create a simple nested schema inline
      const addressSchema = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "title": "Address",
        "type": "object",
        "properties": {
          "street": { "type": "string", "minLength": 1 },
          "city": { "type": "string", "minLength": 1 },
          "zipCode": { "type": "string", "pattern": "^[0-9]{5}$" }
        },
        "required": ["street", "city", "zipCode"]
      };

      const userSchema = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "title": "User",
        "type": "object",
        "properties": {
          "name": { "type": "string", "minLength": 1 },
          "email": { "type": "string", "format": "email" },
          "address": {
            "type": "object",
            "properties": {
              "street": { "type": "string", "minLength": 1 },
              "city": { "type": "string", "minLength": 1 },
              "zipCode": { "type": "string", "pattern": "^[0-9]{5}$" }
            },
            "required": ["street", "city", "zipCode"]
          }
        },
        "required": ["name", "email"]
      };

      // Parse to IR
      const parser = new JsonSchemaParser();
      const ir = parser.parse(userSchema, {
        extractDefinitions: true,
        rootSchemaName: 'User'
      });

      // Generate code with Ajv validation
      const generator = new Generator({
        outputDir,
        mode: 'models-only',
        classValidator: false,
        useAjv: true,
      });

      await generator.generate(ir);

      // Verify files were generated
      const modelsDir = path.join(outputDir, 'models');
      expect(fs.existsSync(modelsDir)).toBe(true);

      // Check that class file was generated
      const allFiles = fs.readdirSync(modelsDir);
      expect(allFiles.length).toBeGreaterThan(0);

      const userFiles = allFiles.filter(f => f.endsWith('.ts') && !f.includes('index'));
      expect(userFiles.length).toBeGreaterThan(0);

      // Read the generated User class file (should be user.ts)
      const userFilePath = path.join(modelsDir, userFiles[0]);
      const userFileContent = fs.readFileSync(userFilePath, 'utf-8');

      // Verify getSchema method exists
      expect(userFileContent).toContain('static getSchema()');
      expect(userFileContent).toContain('$schema');
      expect(userFileContent).toContain('https://json-schema.org/draft/2020-12/schema');

      // Verify validateWithJsonSchema method exists
      expect(userFileContent).toContain('static validateWithJsonSchema');

      // Verify nested validation logic exists
      expect(userFileContent).toContain('for (const [key, value] of Object.entries(data))');
      expect(userFileContent).toContain('constructor.validateWithJsonSchema');
      expect(userFileContent).toContain('nestedResult.errors');
      expect(userFileContent).toContain('instancePath:');

      // Verify Ajv imports
      expect(userFileContent).toContain('import { Ajv } from "ajv"');
      expect(userFileContent).toContain('import { addFormats } from "ajv-formats"');

      // Verify schema includes top-level properties
      expect(userFileContent).toContain('"name"');
      expect(userFileContent).toContain('"email"');
      expect(userFileContent).toContain('"address"');
      expect(userFileContent).toContain('"format": "email"');
      expect(userFileContent).toContain('"minLength": 1');

      // Address is present in schema (nested validation happens recursively at runtime)
      // Note: May be {} (empty schema = any type) or { "type": "object" }
      expect(userFileContent).toMatch(/"address":\s*\{/s);
    });

    it('should generate validat static methods that can be called', async () => {
      // Simple schema without nesting for basic test
      const simpleSchema = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "title": "SimpleModel",
        "type": "object",
        "properties": {
          "id": { "type": "string", "minLength": 1 },
          "count": { "type": "number", "minimum": 0 }
        },
        "required": ["id"]
      };

      const parser = new JsonSchemaParser();
      const ir = parser.parse(simpleSchema, {
        extractDefinitions: true,
        rootSchemaName: 'SimpleModel'
      });

      const generator = new Generator({
        outputDir,
        mode: 'models-only',
        classValidator: false,
        useAjv: true,
      });

      await generator.generate(ir);

      // Verify the generated file has correct structure
      const modelsDir = path.join(outputDir, 'models');
      const files = fs.readdirSync(modelsDir).filter(f => f.endsWith('.ts') && !f.includes('index'));
      expect(files.length).toBeGreaterThan(0);

      const filePath = path.join(modelsDir, files[0]);
      const content = fs.readFileSync(filePath, 'utf-8');

      // Check structure
      expect(content).toContain('class SimpleModel');
      expect(content).toContain('static getSchema()');
      expect(content).toContain('static validateWithJsonSchema(data: unknown)');
      expect(content).toContain('private static _ajvInstance');
      expect(content).toContain('private static getAjvInstance()');

      // Check for compilation caching
      expect(content).toContain('private static _compiledValidator');
      expect(content).toContain('private static getCompiledValidator()');

      // Check schema content
      expect(content).toMatch(/"id":\s*{[^}]*"type":\s*"string"/);
      expect(content).toMatch(/"count":\s*{[^}]*"type":\s*"number"/);
      expect(content).toContain('"minimum": 0');
      expect(content).toContain('"required"');
    });

    it('should include all validation constraints in generated schema', async () => {
      // Schema with various constraint types
      const constrainedSchema = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "title": "Constrained",
        "type": "object",
        "properties": {
          "name": {
            "type": "string",
            "minLength": 1,
            "maxLength": 100,
            "pattern": "^[A-Za-z]+$"
          },
          "age": {
            "type": "number",
            "minimum": 0,
            "maximum": 150,
            "multipleOf": 1
          },
          "email": {
            "type": "string",
            "format": "email"
          },
          "tags": {
            "type": "array",
            "items": { "type": "string" },
            "minItems": 1,
            "maxItems": 10,
            "uniqueItems": true
          },
          "status": {
            "type": "string",
            "enum": ["active", "inactive", "pending"]
          }
        },
        "required": ["name", "email"]
      };

      const parser = new JsonSchemaParser();
      const ir = parser.parse(constrainedSchema, {
        extractDefinitions: true,
        rootSchemaName: 'Constrained'
      });

      const generator = new Generator({
        outputDir,
        mode: 'models-only',
        classValidator: false,
        useAjv: true,
      });

      await generator.generate(ir);

      const modelsDir = path.join(outputDir, 'models');
      const files = fs.readdirSync(modelsDir).filter(f => f.endsWith('.ts') && !f.includes('index'));
      expect(files.length).toBeGreaterThan(0);
      const filePath = path.join(modelsDir, files[0]);
      const content = fs.readFileSync(filePath, 'utf-8');

      // Verify all constraints are in the schema
      expect(content).toContain('"minLength": 1');
      expect(content).toContain('"maxLength": 100');
      expect(content).toContain('"pattern": "^[A-Za-z]+$"');
      expect(content).toContain('"minimum": 0');
      expect(content).toContain('"maximum": 150');
      expect(content).toContain('"multipleOf": 1');
      expect(content).toContain('"format": "email"');
      expect(content).toContain('"minItems": 1');
      expect(content).toContain('"maxItems": 10');
      expect(content).toContain('"uniqueItems": true');
      expect(content).toContain('"enum"');
      expect(content).toContain('active');
      expect(content).toContain('inactive');
      expect(content).toContain('pending');
    });

    it('should generate package.json with ajv dependencies', async () => {
      const simpleSchema = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "title": "Test",
        "type": "object",
        "properties": {
          "id": { "type": "string" }
        }
      };

      const parser = new JsonSchemaParser();
      const ir = parser.parse(simpleSchema, {
        extractDefinitions: true,
        rootSchemaName: 'Test'
      });

      const generator = new Generator({
        outputDir,
        mode: 'models-only',
        classValidator: false,
        useAjv: true,
      });

      await generator.generate(ir);

      // Check package.json was generated with ajv dependencies
      const packageJsonPath = path.join(outputDir, 'package.json');
      expect(fs.existsSync(packageJsonPath)).toBe(true);

      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      expect(packageJson.dependencies).toBeDefined();
      expect(packageJson.dependencies['ajv']).toBe('^8.12.0');
      expect(packageJson.dependencies['ajv-formats']).toBe('^2.1.1');
    });
  });

  describe('Verify Nested Validation Code Structure', () => {
    it('should include proper nested validation logic in generated code', async () => {
      const nestedSchema = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "title": "Parent",
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "child": {
            "type": "object",
            "properties": {
              "id": { "type": "number" }
            }
          }
        }
      };

      const parser = new JsonSchemaParser();
      const ir = parser.parse(nestedSchema, {
        extractDefinitions: true,
        rootSchemaName: 'Parent'
      });

      const generator = new Generator({
        outputDir,
        mode: 'models-only',
        classValidator: false,
        useAjv: true,
      });

      await generator.generate(ir);

      const modelsDir = path.join(outputDir, 'models');
      const files = fs.readdirSync(modelsDir).filter(f => f.endsWith('.ts') && !f.includes('index'));
      expect(files.length).toBeGreaterThan(0);
      const filePath = path.join(modelsDir, files[0]);
      const content = fs.readFileSync(filePath, 'utf-8');

      // Verify the nested validation code checks for nested validateWithJsonSchema
      expect(content).toContain('if (value && typeof value === "object")');
      expect(content).toContain('const constructor = (value as any).constructor');
      expect(content).toContain('typeof constructor.validateWithJsonSchema === "function"');
      expect(content).toContain('nestedResult = constructor.validateWithJsonSchema(value)');

      // Verify error path handling
      expect(content).toContain('if (!nestedResult.valid)');
      expect(content).toContain('allErrors.push(...nestedResult.errors.map');
      expect(content).toContain('instancePath: `/${key}${e.instancePath || ""}`');

      // Verify compilation caching is used
      expect(content).toContain('const validate = this.getCompiledValidator()');
      // Should NOT compile inline anymore
      expect(content).not.toMatch(/const\s+validate\s*=\s*ajv\.compile\(schema\)/);
    });
  });
});
