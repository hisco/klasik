/**
 * E2E Test: OpenCost Swagger Generation
 *
 * Tests generation from the OpenCost API OpenAPI 3.0 spec
 * https://github.com/opencost/opencost/blob/develop/docs/swagger.json
 *
 * This test verifies:
 * 1. CLI can fetch and parse a real-world OpenAPI 3.0 spec from GitHub
 * 2. Models are generated correctly for nested response schemas
 * 3. Generated TypeScript compiles without errors
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { OpenAPIParser } from '../parsers/openapi-parser';
import { Generator } from '../generator/generator';
import { SpecLoader } from '../loaders/spec-loader';
import { ensureCleanDirectory } from './test-helpers/cleanup-utils';

const TEST_OUTPUT_DIR = path.join(__dirname, '../../test-output/e2e-opencost');
const SWAGGER_URL = 'https://raw.githubusercontent.com/opencost/opencost/develop/docs/swagger.json';

describe('E2E: OpenCost Swagger Generation', () => {
  let specContent: any;

  beforeAll(async () => {
    // Clean and create test output directory using robust cleanup
    console.log('\n🧹 Cleaning test output directory...');
    await ensureCleanDirectory(TEST_OUTPUT_DIR);
    console.log('✅ Test output directory ready\n');
  });

  // Keep output for manual inspection - no afterAll cleanup

  it('should fetch and parse OpenCost swagger.json from GitHub', async () => {
    console.log('📥 Fetching OpenCost swagger.json from GitHub...');

    const loader = new SpecLoader();
    const spec = await loader.load({
      url: SWAGGER_URL,
      timeout: 30000
    });

    expect(spec).toBeDefined();
    expect(spec.openapi).toBeDefined();
    expect(spec.openapi).toMatch(/^3\.0/);
    expect(spec.info).toBeDefined();
    expect(spec.info.title).toBe('OpenCost API');

    specContent = spec;

    console.log('✅ Swagger spec loaded successfully');
    console.log(`   OpenAPI version: ${spec.openapi}`);
    console.log(`   API title: ${spec.info.title}`);
    console.log(`   API version: ${spec.info.version}`);
  }, 60000);

  it('should identify schemas in the OpenCost spec', async () => {
    console.log('\n🔍 Analyzing OpenCost spec structure...\n');

    expect(specContent).toBeDefined();

    // Check paths
    const paths = Object.keys(specContent.paths || {});
    console.log(`   Paths defined: ${paths.length}`);
    for (const p of paths) {
      console.log(`      - ${p}`);
    }

    // Check components/schemas
    const schemas = specContent.components?.schemas || {};
    const schemaNames = Object.keys(schemas);
    console.log(`\n   Component schemas: ${schemaNames.length}`);
    for (const name of schemaNames) {
      console.log(`      - ${name}`);
    }

    // OpenCost spec should have at least one endpoint and some schemas
    expect(paths.length).toBeGreaterThan(0);
  });

  it('should generate TypeScript models from OpenCost swagger', async () => {
    console.log('\n🔧 Generating TypeScript models...\n');

    // Load spec
    const loader = new SpecLoader();
    const spec = await loader.load({ url: SWAGGER_URL, timeout: 30000 });

    // Parse to IR
    console.log('   Parsing spec to IR...');
    const parser = new OpenAPIParser();
    const ir = parser.parse(spec);

    console.log(`   ✓ Parsed ${ir.schemas.size} schema(s) to IR`);

    // Generate code
    console.log('   Generating TypeScript code...');
    const generator = new Generator({
      outputDir: TEST_OUTPUT_DIR,
      nestJsSwagger: true,
      classValidator: true,
      esm: false,
      exportStyle: 'namespace'
    });

    await generator.generate(ir);

    console.log('   ✓ TypeScript generation complete\n');

    // Verify output structure
    const modelsPath = path.join(TEST_OUTPUT_DIR, 'models');
    expect(fs.existsSync(modelsPath)).toBe(true);
    expect(fs.existsSync(path.join(modelsPath, 'index.ts'))).toBe(true);
    expect(fs.existsSync(path.join(TEST_OUTPUT_DIR, 'package.json'))).toBe(true);
    expect(fs.existsSync(path.join(TEST_OUTPUT_DIR, 'tsconfig.json'))).toBe(true);

    console.log('✅ Output structure verified');
    console.log(`   Output directory: ${TEST_OUTPUT_DIR}`);
  }, 120000);

  it('should generate model files for OpenCost response schema', async () => {
    console.log('\n📋 Checking generated model files...\n');

    const modelsPath = path.join(TEST_OUTPUT_DIR, 'models');

    // List all generated files
    const files = fs.readdirSync(modelsPath).filter(f => f.endsWith('.ts'));
    console.log(`   Generated ${files.length} TypeScript files:`);
    for (const file of files) {
      console.log(`      - ${file}`);
    }

    // The OpenCost spec has inline_response_200 schema with nested types
    // We should have at least some model files
    expect(files.length).toBeGreaterThan(0);

    // Check index.ts has exports
    const indexContent = fs.readFileSync(path.join(modelsPath, 'index.ts'), 'utf-8');
    expect(indexContent.length).toBeGreaterThan(0);

    // Verify model files have proper class structure
    for (const file of files) {
      if (file === 'index.ts') continue;

      const content = fs.readFileSync(path.join(modelsPath, file), 'utf-8');

      // Should have class export
      expect(content).toContain('export class');

      // Should have class-transformer import
      expect(content).toContain('from "class-transformer"');

      console.log(`   ✓ ${file} - Valid model structure`);
    }
  });

  it('should document known limitation: inline object schemas not extracted', async () => {
    console.log('\n⚠️  KNOWN LIMITATION: Inline Object Schema Extraction\n');

    const modelsPath = path.join(TEST_OUTPUT_DIR, 'models');
    const responseModel = fs.readFileSync(
      path.join(modelsPath, 'inline_response_200.ts'),
      'utf-8'
    );

    // The OpenCost swagger has rich nested types in the response:
    // - data[].opencost, data[].kube-system, data[].prometheus (allocation objects)
    // - Each allocation has 30+ properties (cpuCost, ramCost, gpuCost, etc.)
    // - Nested window and properties objects
    //
    // Currently, the parser collapses all inline objects to Array<unknown>

    const hasUnknownArray = responseModel.includes('Array<unknown>');
    const hasProperAllocationModel = responseModel.includes('cpuCoreHours') ||
                                      responseModel.includes('ramCost') ||
                                      responseModel.includes('totalCost');

    console.log('   OpenCost swagger defines rich nested types:');
    console.log('   - data[].opencost (allocation with 30+ cost metrics)');
    console.log('   - data[].kube-system (allocation with 30+ cost metrics)');
    console.log('   - data[].prometheus (allocation with 30+ cost metrics)');
    console.log('   - Nested window {start, end} objects');
    console.log('   - Nested properties {cluster, namespace, pod, ...} objects');
    console.log('');

    if (hasUnknownArray && !hasProperAllocationModel) {
      console.log('   ❌ LIMITATION CONFIRMED:');
      console.log('   - data property is typed as Array<unknown>');
      console.log('   - Inline allocation objects are NOT extracted as models');
      console.log('   - Type information for 30+ cost metrics is LOST');
      console.log('');
      console.log('   ROOT CAUSE: openapi-parser.ts:361-363');
      console.log('   Objects without $ref are converted to unknown type');
      console.log('');
      console.log('   IMPACT: Users must manually define types for allocation data');
    } else {
      console.log('   ✅ Inline schemas are now being extracted properly!');
    }

    // This test documents the limitation - it passes either way
    // but logs the current state
    expect(true).toBe(true);
  });

  it('should generate valid package.json with all required dependencies', async () => {
    const packageJsonPath = path.join(TEST_OUTPUT_DIR, 'package.json');
    expect(fs.existsSync(packageJsonPath)).toBe(true);

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

    // Check for required dependencies
    expect(packageJson.dependencies).toBeDefined();
    expect(packageJson.dependencies['class-transformer']).toBeDefined();
    expect(packageJson.dependencies['reflect-metadata']).toBeDefined();
    expect(packageJson.dependencies['@nestjs/swagger']).toBeDefined();
    expect(packageJson.dependencies['class-validator']).toBeDefined();

    console.log('\n✅ package.json validated with all dependencies');
  });

  it('should compile generated TypeScript without errors', async () => {
    console.log('\n🔨 Installing dependencies and compiling TypeScript...\n');

    try {
      // Install dependencies
      console.log('   Installing npm dependencies...');
      execSync('npm install --silent', {
        cwd: TEST_OUTPUT_DIR,
        stdio: 'pipe',
        timeout: 120000
      });
      console.log('   ✓ Dependencies installed\n');

      // Compile TypeScript
      console.log('   Compiling TypeScript...');
      const compileResult = execSync('npx tsc --noEmit 2>&1', {
        cwd: TEST_OUTPUT_DIR,
        encoding: 'utf-8',
        timeout: 60000
      });

      // Check for compilation errors
      const hasFatalErrors = compileResult.includes('error TS');

      if (!hasFatalErrors) {
        console.log('   ✅ Compilation succeeded without errors\n');
      } else {
        console.log('   ❌ Compilation failed with errors:');
        console.log(compileResult);
      }

      expect(hasFatalErrors).toBe(false);
    } catch (error: any) {
      // If tsc exits with non-zero, it throws
      const output = error.stdout || error.stderr || error.message;
      console.log('\n   ❌ TypeScript compilation failed');
      console.log('   Error output:');
      console.log(output);

      // Check if it's actual TS errors or just process exit
      if (output && output.includes('error TS')) {
        throw new Error(`TypeScript compilation errors:\n${output}`);
      }
      throw error;
    }
  }, 180000);

  it('should work via CLI command', async () => {
    console.log('\n🖥️  Testing CLI generation...\n');

    const cliOutputDir = path.join(TEST_OUTPUT_DIR, 'cli-output');
    await ensureCleanDirectory(cliOutputDir);

    try {
      const result = execSync(
        `node dist/cli/index.js generate --url "${SWAGGER_URL}" --output "${cliOutputDir}" --nestjs-swagger --class-validator`,
        {
          encoding: 'utf-8',
          timeout: 60000,
          cwd: path.join(__dirname, '../..')
        }
      );

      console.log('   CLI output:', result);

      // Verify output was created
      expect(fs.existsSync(path.join(cliOutputDir, 'models'))).toBe(true);
      expect(fs.existsSync(path.join(cliOutputDir, 'models', 'index.ts'))).toBe(true);
      expect(fs.existsSync(path.join(cliOutputDir, 'package.json'))).toBe(true);

      console.log('   ✅ CLI generation successful');
    } catch (error: any) {
      console.log('   CLI error:', error.message);
      throw error;
    }
  }, 120000);
});
