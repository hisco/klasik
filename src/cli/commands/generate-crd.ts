/**
 * Generate-CRD Command
 *
 * Generates TypeScript models from Kubernetes CRDs
 */

import { Command } from 'commander';
import { Generator } from '../../generator/generator';
import { CRDParser } from '../../parsers/crd-parser';
import { CRDToIRConverter } from '../../parsers/crd-to-ir';
import { SpecLoader } from '../../loaders/spec-loader';
import { Logger } from '../utils/logger';
import { SchemaIR, IRHelpers } from '../../ir/types';
import { IRFilter } from '../../ir/ir-filter';
import ora from 'ora';
import {
  outputOption,
  headerOption,
  timeoutOption,
  resolveRefsOption,
  esmOption,
  nestjsSwaggerOption,
  nestjsGraphqlOption,
  classValidatorOption,
  useAjvOption,
  useZodOption,
  templateOption,
  keepSpecOption,
  crdKindCaseOption,
  includeStatusOption,
  includeOption,
  exportStyleOption,
  bareOption,
  cleanOption,
  parseHeaders,
  collectValues,
  parseIncludeValues,
} from '../utils/options';
import * as fs from 'fs';

export interface GenerateCrdOptions {
  url: string[];
  output: string;
  includeStatus?: boolean;
  nestjsSwagger?: boolean;
  nestjsGraphql?: boolean;
  classValidator?: boolean;
  useAjv?: boolean;
  useZod?: boolean;
  esm?: boolean;
  header?: string[];
  resolveRefs?: boolean;
  template?: string;
  keepSpec?: boolean;
  crdKindCase?: 'pascal' | 'snake' | 'kebab';
  exportStyle?: 'namespace' | 'direct' | 'both' | 'none';
  bare?: boolean;
  timeout?: number;
  include?: string[];
  clean?: boolean;
}

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
    // Merge schemas
    for (const [name, schema] of ir.schemas) {
      merged.schemas.set(name, schema);
    }

    // Merge operations
    for (const [id, operation] of ir.operations) {
      merged.operations.set(id, operation);
    }
  }

  return merged;
}

export async function generateCrdAction(options: GenerateCrdOptions): Promise<void> {
  const spinner = ora('Loading CRD specifications...').start();

  try {
    // Clean output directory if requested
    if (options.clean && fs.existsSync(options.output)) {
      spinner.text = 'Cleaning output directory...';
      fs.rmSync(options.output, { recursive: true, force: true });
      Logger.debug(`Cleaned output directory: ${options.output}`);
    }

    // Parse headers
    const headers = options.header ? parseHeaders(options.header) : {};
    Logger.debug(`Headers: ${JSON.stringify(headers)}`);
    Logger.debug(`Loading ${options.url.length} CRD(s)...`);

    // Load all CRDs
    const loader = new SpecLoader();
    const allCrds: any[] = [];

    for (const url of options.url) {
      spinner.text = `Loading CRD from ${url}...`;

      // Try loading as multi-document YAML first
      try {
        const docs = await loader.loadMultiDocument({
          url,
          headers,
          timeout: options.timeout || 30000,
        });

        if (docs.length > 0) {
          Logger.debug(`Loaded ${docs.length} document(s) from ${url}`);
          allCrds.push(...docs);
        }
      } catch {
        // Fall back to single document
        const doc = options.resolveRefs
          ? await loader.loadWithRefs({
              url,
              headers,
              timeout: options.timeout || 30000,
              resolveRefs: true,
              maxDepth: 10,
            })
          : await loader.load({
              url,
              headers,
              timeout: options.timeout || 30000,
            });
        allCrds.push(doc);
        Logger.debug(`Loaded single document from ${url}`);
      }
    }

    Logger.debug(`Total CRDs loaded: ${allCrds.length}`);

    // Parse CRDs
    spinner.text = 'Parsing CRD specifications...';
    const parser = new CRDParser();
    const parsedCrds = parser.parse(allCrds, {
      includeStatus: options.includeStatus,
    });

    Logger.debug(`Parsed ${parsedCrds.length} CRD(s)`);

    // Convert each CRD to IR
    spinner.text = 'Converting CRDs to IR...';
    const irs: SchemaIR[] = [];

    for (const crd of parsedCrds) {
      const converter = new CRDToIRConverter({
        includeStatus: options.includeStatus,
        extractNested: true,
      });
      const ir = converter.convert(crd);
      irs.push(ir);
      Logger.debug(`Converted ${crd.metadata.kind} to IR (${ir.schemas.size} schemas)`);
    }

    // Merge all IRs
    spinner.text = 'Merging schemas...';
    let mergedIR = mergeIRs(irs);
    Logger.debug(`Merged IR: ${mergedIR.schemas.size} schema(s)`);

    // Apply filtering if --include is specified
    if (options.include && options.include.length > 0) {
      spinner.text = 'Filtering schemas...';
      const includeSchemas = parseIncludeValues(options.include);
      const filter = new IRFilter();
      const filterResult = filter.filter(mergedIR, { include: includeSchemas });

      // Warn about missing schemas
      if (filterResult.missingSchemas.length > 0) {
        Logger.warn(`Schemas not found: ${filterResult.missingSchemas.join(', ')}`);
      }

      Logger.debug(
        `Filtered IR: ${filterResult.stats.filteredCount} schema(s) ` +
          `(${filterResult.stats.dependenciesAdded} dependencies added)`
      );

      mergedIR = filterResult.ir;
    }

    // Generate code
    spinner.text = 'Generating TypeScript code...';
    const generator = new Generator({
      outputDir: options.output,
      esm: options.esm,
      nestJsSwagger: options.nestjsSwagger,
      nestJsGraphql: options.nestjsGraphql,
      classValidator: options.classValidator,
      useAjv: options.useAjv,
      useZod: options.useZod,
      crdKindCase: options.crdKindCase,
      exportStyle: options.exportStyle,
      bare: options.bare,
      templateDir: options.template,
      mode: 'models-only',
    });

    await generator.generate(mergedIR);

    spinner.succeed('Generation complete!');
    Logger.success(`\nOutput directory: ${options.output}`);
    Logger.info(`Generated ${mergedIR.schemas.size} model(s) from ${parsedCrds.length} CRD(s)`);
  } catch (error) {
    spinner.fail('Generation failed');
    Logger.error((error as Error).message);
    if (Logger.isDebug()) {
      console.error(error);
    }
    process.exit(1);
  }
}

export const generateCrdCommand = new Command('generate-crd')
  .description('Generate TypeScript models from Kubernetes CRDs')
  .requiredOption('-u, --url <url>', 'CRD URL or file path (repeatable)', collectValues, [])
  .addOption(outputOption('Output directory'))
  .addOption(includeOption())
  .addOption(includeStatusOption())
  .addOption(nestjsSwaggerOption())
  .addOption(nestjsGraphqlOption())
  .addOption(classValidatorOption())
  .addOption(useAjvOption())
  .addOption(useZodOption())
  .addOption(esmOption())
  .addOption(headerOption())
  .addOption(resolveRefsOption())
  .addOption(templateOption())
  .addOption(keepSpecOption())
  .addOption(crdKindCaseOption())
  .addOption(exportStyleOption())
  .addOption(bareOption())
  .addOption(timeoutOption())
  .addOption(cleanOption())
  .action(generateCrdAction);
