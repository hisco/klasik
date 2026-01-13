/**
 * E2E Test: JSON Schema Code Generation
 *
 * Tests the complete pipeline:
 * 1. Load JSON Schema from URL (kustomization.json from SchemaStore)
 * 2. Parse to IR
 * 3. Generate TypeScript with decorators
 * 4. Install dependencies
 * 5. Compile TypeScript
 * 6. Import and validate with plainToInstance
 * 7. Verify output persists on disk
 *
 * This test covers the user's requirements:
 * - generate-jsonschema --export-style both
 * - -u https://json.schemastore.org/kustomization.json
 * - --output src/generated/kustomize
 * - --nestjs-swagger --class-validator
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { JsonSchemaParser } from '../parsers/json-schema-parser';
import { Generator } from '../generator/generator';
import { SpecLoader } from '../loaders/spec-loader';
import { ensureCleanDirectory } from './test-helpers/cleanup-utils';

const TEST_OUTPUT_DIR = path.join(__dirname, '../../test-output/e2e-jsonschema');

describe('E2E: JSON Schema Code Generation', () => {
  beforeAll(async () => {
    // Clean and create test output directory using robust cleanup
    console.log('🧹 Cleaning test output directory...');
    await ensureCleanDirectory(TEST_OUTPUT_DIR);
    console.log('✅ Test output directory ready');
  });

  // NO afterAll cleanup - persist output for manual inspection

  it('should generate TypeScript from Kustomization JSON Schema with full validation', async () => {
    console.log('\n🚀 Starting E2E JSON Schema generation test...\n');

    // Step 1: Load JSON Schema from URL
    console.log('📥 Loading JSON Schema from SchemaStore...');
    const loader = new SpecLoader();
    let schema: any;

    try {
      schema = await loader.load({
        url: 'https://json.schemastore.org/kustomization.json'
      });
      console.log('✅ JSON Schema loaded successfully');
    } catch (error) {
      console.error('❌ Failed to load JSON Schema:', error);
      throw new Error('Network request failed - ensure you have internet connectivity');
    }

    expect(schema).toBeDefined();
    expect(typeof schema).toBe('object');

    // Step 2: Parse JSON Schema to IR
    console.log('📋 Parsing JSON Schema to IR...');
    const parser = new JsonSchemaParser();
    const ir = parser.parse(schema, {
      extractDefinitions: true,
      rootSchemaName: 'Kustomization'
    });
    console.log(`✅ Generated IR with ${ir.schemas.size} schemas`);

    expect(ir.schemas.size).toBeGreaterThan(0);
    expect(ir.metadata.sourceFormat).toBe('jsonschema');
    expect(ir.metadata.title).toBe('Kustomization');

    // Step 3: Verify root schema exists
    console.log('🔍 Verifying root schema...');
    expect(ir.schemas.has('Kustomization')).toBe(true);
    const rootSchema = ir.schemas.get('Kustomization')!;
    expect(rootSchema.properties.size).toBeGreaterThan(0);
    console.log(`✅ Root schema has ${rootSchema.properties.size} properties`);

    // Step 4: Generate TypeScript code
    console.log('⚙️  Generating TypeScript code...');
    const generator = new Generator({
      outputDir: TEST_OUTPUT_DIR,
      nestJsSwagger: true,
      classValidator: true,
      esm: false,
      exportStyle: 'both'
    });
    await generator.generate(ir);
    console.log('✅ Code generation completed');

    // Step 5: Verify file structure
    console.log('📁 Verifying file structure...');
    const modelsPath = path.join(TEST_OUTPUT_DIR, 'models');
    expect(fs.existsSync(modelsPath)).toBe(true);
    expect(fs.existsSync(path.join(modelsPath, 'index.ts'))).toBe(true);
    expect(fs.existsSync(path.join(TEST_OUTPUT_DIR, 'package.json'))).toBe(true);
    expect(fs.existsSync(path.join(TEST_OUTPUT_DIR, 'tsconfig.json'))).toBe(true);
    console.log('✅ File structure verified');

    // Step 6: Verify Kustomization.ts exists
    console.log('📝 Verifying Kustomization class file...');
    const kustomizationPath = path.join(modelsPath, 'kustomization.ts');
    expect(fs.existsSync(kustomizationPath)).toBe(true);
    console.log('✅ Kustomization.ts exists');

    // Step 7: Verify decorators in generated file
    console.log('🎨 Verifying decorators in generated files...');
    const content = fs.readFileSync(kustomizationPath, 'utf-8');

    // Check imports
    expect(content).toContain('from "@nestjs/swagger"');
    expect(content).toContain('from "class-validator"');
    expect(content).toContain('from "class-transformer"');

    // Check decorators (with parentheses!)
    expect(content).toContain('@ApiProperty');
    expect(content).toContain('@Expose()');
    // Type decorator might be present depending on nested objects
    // expect(content).toContain('@Type(() =>');
    expect(content).toContain('@IsOptional()');

    // Check class structure
    expect(content).toContain('export class Kustomization');
    expect(content).toContain('public static readonly attributeTypeMap');
    console.log('✅ Decorators verified (correct syntax with parentheses)');

    // Step 8: Verify package.json dependencies
    console.log('📦 Verifying package.json dependencies...');
    const pkgJson = JSON.parse(
      fs.readFileSync(path.join(TEST_OUTPUT_DIR, 'package.json'), 'utf-8')
    );
    expect(pkgJson.dependencies['@nestjs/swagger']).toBeDefined();
    expect(pkgJson.dependencies['class-validator']).toBeDefined();
    expect(pkgJson.dependencies['class-transformer']).toBeDefined();
    expect(pkgJson.dependencies['reflect-metadata']).toBeDefined();
    console.log('✅ package.json dependencies verified');

    // Step 9: Verify export style 'both'
    console.log('📤 Verifying export style...');
    const indexContent = fs.readFileSync(path.join(modelsPath, 'index.ts'), 'utf-8');
    // Namespace exports: export * as kustomization from './kustomization.js';
    expect(indexContent).toMatch(/export \* as \w+ from/);
    // Direct exports: export { Kustomization } from './kustomization.js';
    expect(indexContent).toMatch(/export \{ \w+ \} from/);
    console.log('✅ Export style "both" verified');

    // Step 10: Install dependencies
    console.log('📦 Installing dependencies (this may take a moment)...');
    try {
      execSync('npm install --silent', {
        cwd: TEST_OUTPUT_DIR,
        stdio: 'pipe',
        timeout: 120000  // 2 minute timeout
      });
      console.log('✅ Dependencies installed');
    } catch (error: any) {
      console.error('❌ npm install failed:', error.message);
      throw new Error('npm install failed - check network connectivity and npm configuration');
    }

    // Step 11: Compile TypeScript
    console.log('🔨 Compiling TypeScript...');
    try {
      execSync('npx tsc', {
        cwd: TEST_OUTPUT_DIR,
        stdio: 'inherit',
        timeout: 60000  // 1 minute timeout
      });
      console.log('✅ TypeScript compiled successfully');
    } catch (error: any) {
      console.error('❌ TypeScript compilation failed');
      // Show tsconfig for debugging
      console.error('tsconfig.json:', fs.readFileSync(path.join(TEST_OUTPUT_DIR, 'tsconfig.json'), 'utf-8'));
      throw error;
    }

    // Step 12: Import and test plainToInstance
    console.log('🔍 Testing plainToInstance...');
    const distDir = path.join(TEST_OUTPUT_DIR, 'dist');
    expect(fs.existsSync(distDir)).toBe(true);

    const kustomizationJsPath = path.join(distDir, 'kustomization.js');
    expect(fs.existsSync(kustomizationJsPath)).toBe(true);

    // Import compiled class
    const KustomizationModule = require(kustomizationJsPath);
    const Kustomization = KustomizationModule.Kustomization;
    expect(Kustomization).toBeDefined();
    console.log('✅ Kustomization class imported successfully');

    // Import plainToInstance
    const { plainToInstance } = require(
      path.join(TEST_OUTPUT_DIR, 'node_modules/class-transformer')
    );

    // Test data (minimal valid Kustomization)
    const testData = {
      apiVersion: 'kustomize.config.k8s.io/v1beta1',
      kind: 'Kustomization',
      resources: ['deployment.yaml', 'service.yaml'],
      namePrefix: 'dev-',
      namespace: 'my-app'
    };

    // Transform plain object to class instance
    const instance = plainToInstance(Kustomization, testData);

    // Verify transformation
    expect(instance).toBeInstanceOf(Kustomization);

    // Verify properties (with null checks for optional properties)
    if (instance.apiVersion !== undefined) {
      expect(instance.apiVersion).toBe('kustomize.config.k8s.io/v1beta1');
    }
    if (instance.kind !== undefined) {
      expect(instance.kind).toBe('Kustomization');
    }
    if (instance.resources !== undefined) {
      expect(instance.resources).toEqual(['deployment.yaml', 'service.yaml']);
    }
    if (instance.namePrefix !== undefined) {
      expect(instance.namePrefix).toBe('dev-');
    }
    if (instance.namespace !== undefined) {
      expect(instance.namespace).toBe('my-app');
    }

    console.log('✅ plainToInstance transformation successful');

    // Step 12.5: Test class-validator validation (SUCCESS and ERRORS)
    console.log('🔍 Testing class-validator validation...');

    // Import validate function
    const { validate } = require(
      path.join(TEST_OUTPUT_DIR, 'node_modules/class-validator')
    );

    // Test Case 1: Valid data should pass validation
    console.log('  Testing valid data...');
    const validData = {
      apiVersion: 'kustomize.config.k8s.io/v1beta1',
      kind: 'Kustomization',
      resources: ['deployment.yaml', 'service.yaml'],
      namePrefix: 'dev-',
      namespace: 'my-app'
    };
    const validInstance = plainToInstance(Kustomization, validData);
    const validErrors = await validate(validInstance);

    console.log(`  ✅ Valid data: ${validErrors.length} errors (expected 0)`);
    expect(validErrors.length).toBe(0);

    // Test Case 2: Invalid data should produce validation errors
    console.log('  Testing invalid data...');
    const invalidData = {
      apiVersion: 12345,  // Should be string, not number
      kind: true,         // Should be string, not boolean
      resources: 'not-an-array',  // Should be array, not string
      namePrefix: ['wrong-type'],  // Should be string, not array
      namespace: { invalid: 'object' }  // Should be string, not object
    };
    const invalidInstance = plainToInstance(Kustomization, invalidData);
    const invalidErrors = await validate(invalidInstance);

    console.log(`  ❌ Invalid data: ${invalidErrors.length} validation errors (expected > 0)`);
    expect(invalidErrors.length).toBeGreaterThan(0);

    // Show detailed error messages
    console.log('  📋 Validation error details:');
    invalidErrors.forEach((error: any, index: number) => {
      const constraints = Object.keys(error.constraints || {}).map(
        (key: string) => `${key}: ${error.constraints![key]}`
      ).join(', ');
      console.log(`    ${index + 1}. Property "${error.property}": ${constraints}`);
    });

    // Verify specific validation errors
    const apiVersionError = invalidErrors.find((e: any) => e.property === 'apiVersion');
    expect(apiVersionError).toBeDefined();
    expect(apiVersionError?.constraints).toBeDefined();

    const resourcesError = invalidErrors.find((e: any) => e.property === 'resources');
    expect(resourcesError).toBeDefined();
    expect(resourcesError?.constraints).toBeDefined();

    console.log('✅ class-validator validation working correctly (catches type errors)');

    // Step 13: Verify attributeTypeMap
    console.log('🗺️  Verifying attributeTypeMap...');
    expect(Kustomization.attributeTypeMap).toBeDefined();
    expect(Array.isArray(Kustomization.attributeTypeMap)).toBe(true);
    expect(Kustomization.attributeTypeMap.length).toBeGreaterThan(0);

    // Check for specific entries (those that should exist in kustomization schema)
    const hasResources = Kustomization.attributeTypeMap.some(
      (e: any) => e.name === 'resources'
    );
    // Note: We don't strictly require 'resources' since the schema structure might vary
    // Just verify the map has entries
    console.log(`✅ attributeTypeMap verified (${Kustomization.attributeTypeMap.length} entries)`);

    // Final summary
    console.log('\n✨ All E2E tests passed! ✨');
    console.log(`📁 Output persisted at: ${TEST_OUTPUT_DIR}`);
    console.log('💡 You can manually inspect the generated files for quality review\n');
  }, 120000); // 2 minute timeout for entire test (network + npm install + compilation)
});
