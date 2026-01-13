/**
 * CLI E2E Tests
 *
 * Tests actual command execution with real file I/O
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { robustRemoveDir } from './test-helpers/cleanup-utils';

const execAsync = promisify(exec);

describe('CLI E2E Tests', () => {
  let tempDir: string;
  let testSpecPath: string;
  let testCrdPath: string;
  let testJsonSchemaPath: string;

  beforeAll(() => {
    // Create temp directory
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'klasik-cli-e2e-'));

    // Create test OpenAPI spec
    testSpecPath = path.join(tempDir, 'test-spec.json');
    fs.writeFileSync(
      testSpecPath,
      JSON.stringify({
        openapi: '3.0.0',
        info: {
          title: 'Test API',
          version: '1.0.0',
        },
        paths: {},
        components: {
          schemas: {
            User: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
              },
              required: ['id', 'name'],
            },
          },
        },
      })
    );

    // Create test CRD
    testCrdPath = path.join(tempDir, 'test-crd.yaml');
    fs.writeFileSync(
      testCrdPath,
      `apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: applications.argoproj.io
spec:
  group: argoproj.io
  names:
    kind: Application
    plural: applications
    singular: application
  scope: Namespaced
  versions:
    - name: v1alpha1
      served: true
      storage: true
      schema:
        openAPIV3Schema:
          type: object
          properties:
            spec:
              type: object
              properties:
                source:
                  type: object
                  properties:
                    repoURL:
                      type: string
                  required:
                    - repoURL
`
    );

    // Create test JSON Schema
    testJsonSchemaPath = path.join(tempDir, 'test-schema.json');
    fs.writeFileSync(
      testJsonSchemaPath,
      JSON.stringify({
        $schema: 'http://json-schema.org/draft-07/schema#',
        title: 'Product',
        type: 'object',
        properties: {
          id: { type: 'number' },
          name: { type: 'string' },
          price: { type: 'number' },
        },
        required: ['id', 'name', 'price'],
      })
    );
  });

  afterAll(async () => {
    // Clean up temp directory using robust cleanup
    if (tempDir && fs.existsSync(tempDir)) {
      await robustRemoveDir(tempDir, { silent: true });
    }
  });

  describe('klasik --help', () => {
    it('should display help information', async () => {
      const { stdout } = await execAsync('node dist/cli/index.js --help');

      expect(stdout).toContain('klasik');
      expect(stdout).toContain('generate');
      expect(stdout).toContain('download');
      expect(stdout).toContain('generate-crd');
      expect(stdout).toContain('generate-jsonschema');
    });
  });

  describe('klasik generate', () => {
    it('should generate TypeScript models from OpenAPI spec', async () => {
      const outputDir = path.join(tempDir, 'output-generate');

      const { stdout } = await execAsync(
        `node dist/cli/index.js generate --url ${testSpecPath} --output ${outputDir}`
      );

      expect(stdout).toContain('complete');

      // Verify output files
      expect(fs.existsSync(path.join(outputDir, 'models'))).toBe(true);
      expect(fs.existsSync(path.join(outputDir, 'models', 'index.ts'))).toBe(true);
      expect(fs.existsSync(path.join(outputDir, 'models', 'user.ts'))).toBe(true);
      expect(fs.existsSync(path.join(outputDir, 'package.json'))).toBe(true);
      expect(fs.existsSync(path.join(outputDir, 'tsconfig.json'))).toBe(true);

      // Verify User model content
      const userContent = fs.readFileSync(path.join(outputDir, 'models', 'user.ts'), 'utf-8');
      expect(userContent).toContain('export class User');
      expect(userContent).toContain('id');
      expect(userContent).toContain('name');
    });

    it('should support --esm flag', async () => {
      const outputDir = path.join(tempDir, 'output-esm');

      await execAsync(
        `node dist/cli/index.js generate --url ${testSpecPath} --output ${outputDir} --esm`
      );

      const packageJson = JSON.parse(
        fs.readFileSync(path.join(outputDir, 'package.json'), 'utf-8')
      );

      expect(packageJson.type).toBe('module');
    });

    it('should handle errors gracefully', async () => {
      try {
        await execAsync(
          'node dist/cli/index.js generate --url https://invalid-url-that-does-not-exist.com/spec.json --output /tmp/output'
        );
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.code).toBe(1);
      }
    });
  });

  describe('klasik download', () => {
    it('should download spec to file', async () => {
      const outputFile = path.join(tempDir, 'downloaded-spec.json');

      const { stdout } = await execAsync(
        `node dist/cli/index.js download --url ${testSpecPath} --output ${outputFile}`
      );

      expect(stdout).toContain('Saved to');

      // Verify output file
      expect(fs.existsSync(outputFile)).toBe(true);

      const content = JSON.parse(fs.readFileSync(outputFile, 'utf-8'));
      expect(content.openapi).toBe('3.0.0');
      expect(content.info.title).toBe('Test API');
    });
  });

  describe('klasik generate-crd', () => {
    it('should generate TypeScript models from CRD', async () => {
      const outputDir = path.join(tempDir, 'output-crd');

      const { stdout } = await execAsync(
        `node dist/cli/index.js generate-crd --url ${testCrdPath} --output ${outputDir}`
      );

      expect(stdout).toContain('complete');

      // Verify output files
      expect(fs.existsSync(path.join(outputDir, 'models'))).toBe(true);
      expect(fs.existsSync(path.join(outputDir, 'models', 'index.ts'))).toBe(true);

      // Should have Application model
      const files = fs.readdirSync(path.join(outputDir, 'models'));
      const hasApplicationModel = files.some(
        (f) => f.toLowerCase().includes('application') && f.endsWith('.ts')
      );
      expect(hasApplicationModel).toBe(true);
    });

    it('should support multiple CRD URLs', async () => {
      const outputDir = path.join(tempDir, 'output-crd-multi');

      await execAsync(
        `node dist/cli/index.js generate-crd --url ${testCrdPath} --url ${testCrdPath} --output ${outputDir}`
      );

      expect(fs.existsSync(path.join(outputDir, 'models'))).toBe(true);
    });
  });

  describe('klasik generate-jsonschema', () => {
    it('should generate TypeScript models from JSON Schema', async () => {
      const outputDir = path.join(tempDir, 'output-jsonschema');

      const { stdout } = await execAsync(
        `node dist/cli/index.js generate-jsonschema --url ${testJsonSchemaPath} --output ${outputDir}`
      );

      expect(stdout).toContain('complete');

      // Verify output files
      expect(fs.existsSync(path.join(outputDir, 'models'))).toBe(true);
      expect(fs.existsSync(path.join(outputDir, 'models', 'index.ts'))).toBe(true);

      // Should have a model file (could be Product, test_schema, etc)
      const files = fs.readdirSync(path.join(outputDir, 'models'));
      const modelFiles = files.filter((f) => f.endsWith('.ts') && f !== 'index.ts');
      expect(modelFiles.length).toBeGreaterThan(0);
    });

    it('should support multiple JSON Schema URLs', async () => {
      const outputDir = path.join(tempDir, 'output-jsonschema-multi');

      await execAsync(
        `node dist/cli/index.js generate-jsonschema --url ${testJsonSchemaPath} --url ${testJsonSchemaPath} --output ${outputDir}`
      );

      expect(fs.existsSync(path.join(outputDir, 'models'))).toBe(true);
    });
  });

  describe('command validation', () => {
    it('should require url parameter for generate', async () => {
      try {
        await execAsync('node dist/cli/index.js generate --output /tmp/output');
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toContain('required');
      }
    });

    it('should require output parameter for generate', async () => {
      try {
        await execAsync(`node dist/cli/index.js generate --url ${testSpecPath}`);
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toContain('required');
      }
    });
  });
});
