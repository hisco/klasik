/**
 * Generate-Go Command
 *
 * Generates TypeScript models from Go structs using reflection
 */

import { Command } from 'commander';
import { Generator } from '../../generator/generator';
import { JsonSchemaParser } from '../../parsers/json-schema-parser';
import { GoSchemaLoader } from '../../loaders/go-schema-loader';
import { Logger } from '../utils/logger';
import { SchemaIR, IRHelpers } from '../../ir/types';
import ora from 'ora';
import {
  outputOption,
  esmOption,
  nestjsSwaggerOption,
  classValidatorOption,
  useAjvOption,
  templateOption,
  exportStyleOption,
  bareOption,
  collectValues,
} from '../utils/options';

export interface GenerateGoOptions {
  type: string[];
  output: string;
  nestjsSwagger?: boolean;
  classValidator?: boolean;
  useAjv?: boolean;
  esm?: boolean;
  template?: string;
  exportStyle?: 'namespace' | 'direct' | 'both' | 'none';
  bare?: boolean;
  goToolPath?: string;
  allowAdditionalProperties?: boolean;
}

/**
 * Extract struct name from Go type path
 * Example: "helm.sh/helm/v3/pkg/chart.Metadata" -> "Metadata"
 */
function extractStructName(typePath: string): string {
  const parts = typePath.split('.');
  return parts[parts.length - 1];
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
  merged.metadata.sourceFormat = 'jsonschema'; // Go schemas become JSON Schema

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

export async function generateGoAction(options: GenerateGoOptions): Promise<void> {
  const spinner = ora('Loading Go types...').start();

  try {
    Logger.debug(`Loading ${options.type.length} Go type(s)...`);

    // Load all Go types as JSON Schemas
    const loader = new GoSchemaLoader();
    const schemas: Array<{ typePath: string; schema: any }> = [];

    for (const typePath of options.type) {
      spinner.text = `Generating JSON Schema for ${typePath}...`;

      const schema = await loader.load({
        typePath,
        goToolPath: options.goToolPath,
        allowAdditionalProperties: options.allowAdditionalProperties,
      });

      schemas.push({ typePath, schema });
      Logger.debug(`Generated JSON Schema for ${typePath}`);
    }

    Logger.debug(`Total schemas generated: ${schemas.length}`);

    // Parse each JSON Schema to IR
    spinner.text = 'Parsing JSON Schemas to IR...';
    const parser = new JsonSchemaParser();
    const irs: SchemaIR[] = [];

    for (const { typePath, schema } of schemas) {
      // Extract struct name from type path
      const schemaName = extractStructName(typePath);

      const ir = parser.parse(schema, {
        extractDefinitions: true,
        rootSchemaName: schemaName,
      });

      irs.push(ir);
      Logger.debug(`Parsed ${typePath} (${ir.schemas.size} schemas)`);
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
    Logger.info(`Generated ${mergedIR.schemas.size} model(s) from ${schemas.length} Go type(s)`);
  } catch (error) {
    spinner.fail('Generation failed');
    Logger.error((error as Error).message);
    if (Logger.isDebug()) {
      console.error(error);
    }
    process.exit(1);
  }
}

export const generateGoCommand = new Command('generate-go')
  .description('Generate TypeScript models from Go structs using reflection')
  .requiredOption('-t, --type <type>', 'Go type path (package.Type) (repeatable)', collectValues, [])
  .addOption(outputOption('Output directory'))
  .addOption(nestjsSwaggerOption())
  .addOption(classValidatorOption())
  .addOption(useAjvOption())
  .addOption(esmOption())
  .addOption(templateOption())
  .addOption(exportStyleOption())
  .addOption(bareOption())
  .option('--go-tool-path <path>', 'Path to go-schema-gen binary (default: bundled)')
  .option('--allow-additional-properties', 'Allow additional properties in JSON Schema')
  .action(generateGoAction);
