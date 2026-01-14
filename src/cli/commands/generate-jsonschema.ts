/**
 * Generate-JSONSchema Command
 *
 * Generates TypeScript models from JSON Schema files
 */

import { Command } from 'commander';
import { Generator } from '../../generator/generator';
import { JsonSchemaParser } from '../../parsers/json-schema-parser';
import { SpecLoader } from '../../loaders/spec-loader';
import { Logger } from '../utils/logger';
import { SchemaIR, IRHelpers } from '../../ir/types';
import ora from 'ora';
import * as path from 'path';
import {
  outputOption,
  headerOption,
  timeoutOption,
  resolveRefsOption,
  esmOption,
  nestjsSwaggerOption,
  classValidatorOption,
  useAjvOption,
  templateOption,
  keepSpecOption,
  exportStyleOption,
  bareOption,
  parseHeaders,
  collectValues,
} from '../utils/options';

export interface GenerateJsonSchemaOptions {
  url: string[];
  output: string;
  nestjsSwagger?: boolean;
  classValidator?: boolean;
  useAjv?: boolean;
  esm?: boolean;
  header?: string[];
  resolveRefs?: boolean;
  template?: string;
  keepSpec?: boolean;
  exportStyle?: 'namespace' | 'direct' | 'both' | 'none';
  bare?: boolean;
  timeout?: number;
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
  merged.metadata.sourceFormat = 'jsonschema';

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

/**
 * Extract schema name from URL
 * Example: https://example.com/schemas/user.json -> User
 * Example: ./schemas/test-schema.json -> TestSchema
 */
function extractSchemaNameFromUrl(url: string): string | undefined {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    let fileName = path.basename(pathname, path.extname(pathname));
    // Remove dots and hyphens
    fileName = fileName.replace(/[.-]/g, '_');
    return fileName;
  } catch {
    // Not a valid URL, try file path
    let fileName = path.basename(url, path.extname(url));
    // Remove dots and hyphens
    fileName = fileName.replace(/[.-]/g, '_');
    return fileName;
  }
}

export async function generateJsonSchemaAction(options: GenerateJsonSchemaOptions): Promise<void> {
  const spinner = ora('Loading JSON Schema specifications...').start();

  try {
    // Parse headers
    const headers = options.header ? parseHeaders(options.header) : {};
    Logger.debug(`Headers: ${JSON.stringify(headers)}`);
    Logger.debug(`Loading ${options.url.length} JSON Schema(s)...`);

    // Load all JSON Schemas
    const loader = new SpecLoader();
    const schemas: Array<{ schema: any; url: string }> = [];

    for (const url of options.url) {
      spinner.text = `Loading JSON Schema from ${url}...`;

      const schema = options.resolveRefs
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

      schemas.push({ schema, url });
      Logger.debug(`Loaded JSON Schema from ${url}`);
    }

    Logger.debug(`Total JSON Schemas loaded: ${schemas.length}`);

    // Parse each JSON Schema to IR
    spinner.text = 'Parsing JSON Schemas...';
    const parser = new JsonSchemaParser();
    const irs: SchemaIR[] = [];

    for (const { schema, url } of schemas) {
      // Extract schema name from URL if not present in schema
      const schemaName = extractSchemaNameFromUrl(url);

      const ir = parser.parse(schema, {
        extractDefinitions: true,
        rootSchemaName: schemaName,
      });

      irs.push(ir);
      Logger.debug(`Parsed JSON Schema from ${url} (${ir.schemas.size} schemas)`);
    }

    // Merge all IRs
    spinner.text = 'Merging schemas...';
    const mergedIR = mergeIRs(irs);
    Logger.debug(`Merged IR: ${mergedIR.schemas.size} schema(s)`);

    // Generate code
    spinner.text = 'Generating TypeScript code...';
    const generator = new Generator({
      outputDir: options.output,
      esm: options.esm,
      nestJsSwagger: options.nestjsSwagger,
      classValidator: options.classValidator,
      useAjv: options.useAjv,
      exportStyle: options.exportStyle,
      bare: options.bare,
      templateDir: options.template,
      mode: 'models-only',
    });

    await generator.generate(mergedIR);

    spinner.succeed('Generation complete!');
    Logger.success(`\nOutput directory: ${options.output}`);
    Logger.info(`Generated ${mergedIR.schemas.size} model(s) from ${schemas.length} JSON Schema(s)`);
  } catch (error) {
    spinner.fail('Generation failed');
    Logger.error((error as Error).message);
    if (Logger.isDebug()) {
      console.error(error);
    }
    process.exit(1);
  }
}

export const generateJsonSchemaCommand = new Command('generate-jsonschema')
  .description('Generate TypeScript models from JSON Schema files')
  .requiredOption('-u, --url <url>', 'JSON Schema URL or file path (repeatable)', collectValues, [])
  .addOption(outputOption('Output directory'))
  .addOption(nestjsSwaggerOption())
  .addOption(classValidatorOption())
  .addOption(useAjvOption())
  .addOption(esmOption())
  .addOption(headerOption())
  .addOption(resolveRefsOption())
  .addOption(templateOption())
  .addOption(keepSpecOption())
  .addOption(exportStyleOption())
  .addOption(bareOption())
  .addOption(timeoutOption())
  .action(generateJsonSchemaAction);
