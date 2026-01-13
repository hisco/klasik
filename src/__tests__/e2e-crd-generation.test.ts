/**
 * End-to-end test for CRD code generation with full decorator support
 *
 * This test validates the complete pipeline:
 * 1. Fetches ArgoCD CRDs from GitHub URLs
 * 2. Generates TypeScript with all decorators
 * 3. Persists output to test-output/e2e-crd-generation/ (gitignored)
 * 4. Installs dependencies
 * 5. Imports generated classes
 * 6. Validates with class-transformer's plainToInstance
 * 7. Verifies attributeTypeMap exists
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { CRDParser } from '../parsers/crd-parser';
import { CRDToIRConverter } from '../parsers/crd-to-ir';
import { Generator } from '../generator/generator';
import { SpecLoader } from '../loaders/spec-loader';
import { ensureCleanDirectory } from './test-helpers/cleanup-utils';

const TEST_OUTPUT_DIR = path.join(__dirname, '../../test-output/e2e-crd-generation');
const MODELS_DIR = path.join(TEST_OUTPUT_DIR, 'models');

// ArgoCD CRD URLs
const APPLICATION_CRD_URL = 'https://raw.githubusercontent.com/argoproj/argo-cd/master/manifests/crds/application-crd.yaml';
const APPPROJECT_CRD_URL = 'https://raw.githubusercontent.com/argoproj/argo-cd/master/manifests/crds/appproject-crd.yaml';

describe('E2E: CRD Code Generation with Full Decorators', () => {
  beforeAll(async () => {
    // Clean and create test output directory using robust cleanup
    await ensureCleanDirectory(TEST_OUTPUT_DIR);
  });

  // Keep output for manual inspection - no afterAll cleanup

  it('should generate, install deps, and validate ArgoCD CRD classes with plainToInstance', async () => {
    console.log('\n🚀 Starting E2E CRD generation test...\n');

    // Step 1: Load CRDs from URLs
    console.log('📥 Loading CRDs from GitHub URLs...');
    const loader = new SpecLoader();

    let applicationCrd: any;
    let appProjectCrd: any;

    try {
      applicationCrd = await loader.load({ url: APPLICATION_CRD_URL });
      appProjectCrd = await loader.load({ url: APPPROJECT_CRD_URL });
      console.log('✅ CRDs loaded successfully');
    } catch (error) {
      console.warn('⚠️  Failed to load CRDs from URLs:', error);
      console.log('⏭️  Skipping test due to network issues');
      return; // Skip test if URLs are unreachable
    }

    // Step 2: Parse CRDs
    console.log('📋 Parsing CRDs...');
    const parser = new CRDParser();
    const parsedCrds = [
      ...parser.parse(applicationCrd, { includeStatus: true }),
      ...parser.parse(appProjectCrd, { includeStatus: true }),
    ];
    expect(parsedCrds.length).toBe(2);
    console.log(`✅ Parsed ${parsedCrds.length} CRDs`);

    // Step 3: Convert to IR
    console.log('🔄 Converting to IR...');
    const converter = new CRDToIRConverter({
      includeStatus: true,
      extractNested: true,
    });
    const ir = converter.convert(parsedCrds);
    expect(ir.schemas.size).toBeGreaterThan(0);
    console.log(`✅ Generated IR with ${ir.schemas.size} schemas`);

    // Step 4: Generate Code
    console.log('⚙️  Generating TypeScript code...');
    const generator = new Generator({
      outputDir: TEST_OUTPUT_DIR,
      nestJsSwagger: true,
      classValidator: true,
      esm: false,
      crdKindCase: 'kebab',
      exportStyle: 'both',
    });
    await generator.generate(ir);
    console.log('✅ Code generation completed');

    // Step 5: Verify file structure
    console.log('📁 Verifying file structure...');
    expect(fs.existsSync(MODELS_DIR)).toBe(true);
    expect(fs.existsSync(path.join(TEST_OUTPUT_DIR, 'package.json'))).toBe(true);
    expect(fs.existsSync(path.join(TEST_OUTPUT_DIR, 'tsconfig.json'))).toBe(true);
    console.log('✅ File structure verified');

    // Step 6: Verify file naming (kebab-case from Kind)
    console.log('📝 Verifying file naming...');
    const applicationFile = path.join(MODELS_DIR, 'application.ts');
    const appProjectFile = path.join(MODELS_DIR, 'app-project.ts');
    expect(fs.existsSync(applicationFile)).toBe(true);
    expect(fs.existsSync(appProjectFile)).toBe(true);
    console.log('✅ File naming verified (kebab-case from Kind)');

    // Step 7: Verify decorators in generated files
    console.log('🎨 Verifying decorators in generated files...');
    const appContent = fs.readFileSync(applicationFile, 'utf-8');

    // Check imports
    expect(appContent).toContain('from "@nestjs/swagger"');
    expect(appContent).toContain('from "class-validator"');
    expect(appContent).toContain('from "class-transformer"');

    // Check decorators
    expect(appContent).toContain('@ApiProperty');
    expect(appContent).toContain('type: String');
    expect(appContent).toContain('@IsString');
    expect(appContent).toContain('@IsOptional');
    expect(appContent).toContain('@Expose()');

    // Check attributeTypeMap
    expect(appContent).toContain('attributeTypeMap');
    expect(appContent).toContain('public static readonly attributeTypeMap');

    console.log('✅ Decorators verified');

    // Step 8: Verify package.json dependencies
    console.log('📦 Verifying package.json dependencies...');
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(TEST_OUTPUT_DIR, 'package.json'), 'utf-8')
    );
    expect(packageJson.dependencies['@nestjs/swagger']).toBeDefined();
    expect(packageJson.dependencies['class-validator']).toBeDefined();
    expect(packageJson.dependencies['class-transformer']).toBeDefined();
    expect(packageJson.dependencies['reflect-metadata']).toBeDefined();
    console.log('✅ package.json dependencies verified');

    // Step 9: Verify export style (both)
    console.log('📤 Verifying export style...');
    const indexPath = path.join(MODELS_DIR, 'index.ts');
    expect(fs.existsSync(indexPath)).toBe(true);
    const indexContent = fs.readFileSync(indexPath, 'utf-8');

    // Should have namespace exports: export * as application from './application';
    expect(indexContent).toMatch(/export \* as \w+ from/);

    // Should have direct exports: export { Application } from './application';
    expect(indexContent).toMatch(/export \{ \w+ \} from/);
    console.log('✅ Export style "both" verified');

    // Step 10: Install dependencies
    console.log('📦 Installing dependencies...');
    try {
      execSync('npm install --silent', {
        cwd: TEST_OUTPUT_DIR,
        stdio: 'pipe',
      });
      console.log('✅ Dependencies installed');
    } catch (error) {
      console.error('Failed to install dependencies:', error);
      throw error;
    }

    // Step 11: Compile TypeScript
    console.log('🔨 Compiling TypeScript...');
    try {
      execSync('npx tsc', {
        cwd: TEST_OUTPUT_DIR,
        stdio: 'inherit',
      });
      console.log('✅ TypeScript compiled successfully');
    } catch (error) {
      console.error('❌ TypeScript compilation failed:', error);
      throw error;
    }

    // Step 12: Import and test plainToInstance
    console.log('🔍 Testing plainToInstance...');
    const distDir = path.join(TEST_OUTPUT_DIR, 'dist');

    // Verify dist directory exists
    expect(fs.existsSync(distDir)).toBe(true);

    // Import Application class from compiled JavaScript
    const applicationJsPath = path.join(distDir, 'application.js');
    expect(fs.existsSync(applicationJsPath)).toBe(true);

    const ApplicationModule = require(applicationJsPath);
    const Application = ApplicationModule.Application;
    expect(Application).toBeDefined();
    console.log('✅ Application class imported successfully');

    // Import plainToInstance from installed class-transformer
    const classTransformerPath = path.join(TEST_OUTPUT_DIR, 'node_modules/class-transformer');
    const { plainToInstance } = require(classTransformerPath);

    // Test data
    const testData = {
      apiVersion: 'argoproj.io/v1alpha1',
      kind: 'Application',
      metadata: {
        name: 'test-app',
        namespace: 'argocd',
      },
      spec: {
        project: 'default',
        source: {
          repoURL: 'https://github.com/example/repo',
          path: 'manifests',
          targetRevision: 'main',
        },
        destination: {
          server: 'https://kubernetes.default.svc',
          namespace: 'default',
        },
      },
    };

    // Transform plain object to class instance
    const instance = plainToInstance(Application, testData);

    // Verify transformation
    expect(instance).toBeInstanceOf(Application);
    expect(instance.apiVersion).toBe('argoproj.io/v1alpha1');
    expect(instance.kind).toBe('Application');
    expect(instance.metadata.name).toBe('test-app');
    console.log('✅ plainToInstance transformation successful');

    // Step 13: Verify attributeTypeMap
    console.log('🗺️  Verifying attributeTypeMap...');
    expect(Application.attributeTypeMap).toBeDefined();
    expect(Array.isArray(Application.attributeTypeMap)).toBe(true);
    expect(Application.attributeTypeMap.length).toBeGreaterThan(0);

    const entry = Application.attributeTypeMap.find((e: any) => e.name === 'apiVersion');
    expect(entry).toBeDefined();
    expect(entry.type).toBe('string');
    expect(entry.baseName).toBe('apiVersion');
    console.log('✅ attributeTypeMap verified');

    console.log('\n✨ All E2E tests passed! ✨');
    console.log(`📁 Output persisted at: ${TEST_OUTPUT_DIR}`);
  }, 120000); // 2 minute timeout for network requests and npm install
});
