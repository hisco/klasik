/**
 * E2E test for CRD schema filtering feature
 *
 * This test validates the --include filtering functionality:
 * 1. Fetches Gateway API CRDs (contains Gateway, HTTPRoute, GRPCRoute, etc.)
 * 2. Filters to only Gateway and its dependencies
 * 3. Verifies that only the specified schema and its dependencies are generated
 * 4. Verifies that unrelated schemas (HTTPRoute) are NOT generated
 */

import * as fs from 'fs';
import * as path from 'path';
import { CRDParser } from '../parsers/crd-parser';
import { CRDToIRConverter } from '../parsers/crd-to-ir';
import { IRFilter } from '../ir/ir-filter';
import { Generator } from '../generator/generator';
import { SpecLoader } from '../loaders/spec-loader';
import { SchemaIR, IRHelpers } from '../ir/types';
import { ensureCleanDirectory } from './test-helpers/cleanup-utils';

const TEST_OUTPUT_DIR = path.join(__dirname, '../../test-output/e2e-crd-filtering');

// Gateway API CRD URL
const GATEWAY_API_URL =
  'https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.2.0/standard-install.yaml';

describe('E2E: CRD Schema Filtering', () => {
  beforeAll(async () => {
    await ensureCleanDirectory(TEST_OUTPUT_DIR);
  });

  // Keep output for manual inspection - no afterAll cleanup

  it('should generate only specified schema and its dependencies', async () => {
    console.log('\n🚀 Starting E2E CRD filtering test...\n');

    // Step 1: Load Gateway API CRDs
    console.log('📥 Loading Gateway API CRDs...');
    const loader = new SpecLoader();

    let crdDocs: any[];

    try {
      crdDocs = await loader.loadMultiDocument({ url: GATEWAY_API_URL, timeout: 60000 });
      console.log(`✅ Loaded ${crdDocs.length} documents from Gateway API`);
    } catch (error) {
      console.warn('⚠️  Failed to load CRDs from URL:', error);
      console.log('⏭️  Skipping test due to network issues');
      return;
    }

    // Step 2: Parse CRDs
    console.log('📋 Parsing CRDs...');
    const parser = new CRDParser();
    const parsedCrds = parser.parse(crdDocs, { includeStatus: false });
    console.log(`✅ Parsed ${parsedCrds.length} CRDs`);

    // List all CRD kinds
    const crdKinds = parsedCrds.map((crd) => crd.metadata.kind);
    console.log(`   CRD kinds: ${crdKinds.join(', ')}`);

    // Expect multiple CRDs (Gateway, HTTPRoute, GRPCRoute, etc.)
    expect(parsedCrds.length).toBeGreaterThan(1);

    // Step 3: Convert to IR
    console.log('🔄 Converting to IR...');
    const irs: SchemaIR[] = [];
    for (const crd of parsedCrds) {
      const converter = new CRDToIRConverter({
        includeStatus: false,
        extractNested: true,
      });
      const ir = converter.convert(crd);
      irs.push(ir);
    }

    // Merge all IRs
    const fullIR = mergeIRs(irs);
    console.log(`✅ Full IR has ${fullIR.schemas.size} schemas`);

    // List some schema names
    const schemaNames = Array.from(fullIR.schemas.keys());
    console.log(`   Sample schemas: ${schemaNames.slice(0, 10).join(', ')}...`);

    // Step 4: Filter to Gateway only
    console.log('🔍 Filtering to Gateway and dependencies...');
    const filter = new IRFilter();
    const filterResult = filter.filter(fullIR, { include: ['Gateway'] });

    console.log(`✅ Filtered IR has ${filterResult.ir.schemas.size} schemas`);
    console.log(`   Included: ${Array.from(filterResult.includedSchemas).join(', ')}`);
    console.log(`   Dependencies added: ${filterResult.stats.dependenciesAdded}`);

    // Verify filtering worked
    expect(filterResult.ir.schemas.size).toBeLessThan(fullIR.schemas.size);
    expect(filterResult.includedSchemas.has('Gateway')).toBe(true);

    // HTTPRoute should NOT be included (it's a separate resource)
    expect(filterResult.includedSchemas.has('HTTPRoute')).toBe(false);

    // Step 5: Generate code from filtered IR
    console.log('⚙️  Generating TypeScript code...');
    const generator = new Generator({
      outputDir: TEST_OUTPUT_DIR,
      bare: true,
    });
    await generator.generate(filterResult.ir);
    console.log('✅ Code generation completed');

    // Step 6: Verify only filtered schemas were generated
    console.log('📁 Verifying generated files...');
    const generatedFiles = fs
      .readdirSync(TEST_OUTPUT_DIR)
      .filter((f) => f.endsWith('.ts') && f !== 'index.ts');

    console.log(`   Generated files: ${generatedFiles.join(', ')}`);

    // Gateway should be generated
    expect(generatedFiles.some((f) => f.toLowerCase().includes('gateway'))).toBe(true);

    // HTTPRoute should NOT be generated
    expect(generatedFiles.some((f) => f.toLowerCase().includes('http-route'))).toBe(false);
    expect(generatedFiles.some((f) => f.toLowerCase().includes('httproute'))).toBe(false);

    // Number of generated files should match filtered schema count
    // (accounting for index.ts which we filtered out)
    expect(generatedFiles.length).toBe(filterResult.ir.schemas.size);

    console.log('\n✨ CRD filtering test passed! ✨');
    console.log(`📁 Output persisted at: ${TEST_OUTPUT_DIR}`);
  }, 120000);

  it('should support filtering multiple parent schemas', async () => {
    const testDir = path.join(TEST_OUTPUT_DIR, 'multi-include');
    await ensureCleanDirectory(testDir);

    console.log('\n🚀 Testing multiple schema filtering...\n');

    // Step 1: Load Gateway API CRDs
    const loader = new SpecLoader();

    let crdDocs: any[];

    try {
      crdDocs = await loader.loadMultiDocument({ url: GATEWAY_API_URL, timeout: 60000 });
    } catch (error) {
      console.warn('⚠️  Skipping test due to network issues');
      return;
    }

    // Step 2: Parse and convert
    const parser = new CRDParser();
    const parsedCrds = parser.parse(crdDocs, { includeStatus: false });

    const irs: SchemaIR[] = [];
    for (const crd of parsedCrds) {
      const converter = new CRDToIRConverter({
        includeStatus: false,
        extractNested: true,
      });
      irs.push(converter.convert(crd));
    }

    const fullIR = mergeIRs(irs);

    // Step 3: Filter to Gateway AND GatewayClass
    const filter = new IRFilter();
    const filterResult = filter.filter(fullIR, { include: ['Gateway', 'GatewayClass'] });

    console.log(`✅ Filtered to Gateway + GatewayClass: ${filterResult.ir.schemas.size} schemas`);

    // Both should be included
    expect(filterResult.includedSchemas.has('Gateway')).toBe(true);
    expect(filterResult.includedSchemas.has('GatewayClass')).toBe(true);

    // HTTPRoute should still NOT be included
    expect(filterResult.includedSchemas.has('HTTPRoute')).toBe(false);

    // Step 4: Generate and verify
    const generator = new Generator({
      outputDir: testDir,
      bare: true,
    });
    await generator.generate(filterResult.ir);

    const generatedFiles = fs
      .readdirSync(testDir)
      .filter((f) => f.endsWith('.ts') && f !== 'index.ts');

    // Both Gateway and GatewayClass files should exist
    expect(generatedFiles.some((f) => f.toLowerCase().includes('gateway'))).toBe(true);
    expect(generatedFiles.some((f) => f.toLowerCase().includes('gateway-class'))).toBe(true);

    console.log('✨ Multiple schema filtering test passed!');
  }, 120000);

  it('should warn about missing schemas', async () => {
    console.log('\n🚀 Testing missing schema warning...\n');

    // Create a simple IR
    const ir = IRHelpers.createSchemaIR();
    ir.schemas.set('ExistingSchema', IRHelpers.createSchema('ExistingSchema'));

    // Filter with a non-existent schema
    const filter = new IRFilter();
    const filterResult = filter.filter(ir, { include: ['ExistingSchema', 'NonExistent'] });

    // Should report missing schema
    expect(filterResult.missingSchemas).toContain('NonExistent');
    expect(filterResult.missingSchemas.length).toBe(1);

    // Should still include the existing schema
    expect(filterResult.includedSchemas.has('ExistingSchema')).toBe(true);
    expect(filterResult.ir.schemas.size).toBe(1);

    console.log('✨ Missing schema warning test passed!');
  });
});

/**
 * Merge multiple SchemaIRs into one
 */
function mergeIRs(irs: SchemaIR[]): SchemaIR {
  if (irs.length === 0) {
    return IRHelpers.createSchemaIR();
  }

  if (irs.length === 1) {
    return irs[0];
  }

  const merged = IRHelpers.createSchemaIR();
  merged.metadata.sourceFormat = 'crd';

  for (const ir of irs) {
    for (const [name, schema] of ir.schemas) {
      merged.schemas.set(name, schema);
    }
    for (const [id, operation] of ir.operations) {
      merged.operations.set(id, operation);
    }
  }

  return merged;
}
