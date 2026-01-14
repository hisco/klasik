/**
 * Generate Command
 *
 * Generates TypeScript client from OpenAPI specification
 */

import { Command } from 'commander';
import { Generator } from '../../generator/generator';
import { OpenAPIParser } from '../../parsers/openapi-parser';
import { SpecLoader } from '../../loaders/spec-loader';
import { Logger } from '../utils/logger';
import ora from 'ora';
import {
  urlOption,
  outputOption,
  headerOption,
  timeoutOption,
  esmOption,
  nestjsSwaggerOption,
  classValidatorOption,
  useAjvOption,
  templateOption,
  keepSpecOption,
  resolveRefsOption,
  exportStyleOption,
  skipJsExtensionsOption,
  bareOption,
  parseHeaders,
  collectValues,
} from '../utils/options';

export interface GenerateOptions {
  url: string;
  output: string;
  mode?: 'full' | 'models-only';
  header?: string[];
  resolveRefs?: boolean;
  esm?: boolean;
  nestjsSwagger?: boolean;
  classValidator?: boolean;
  useAjv?: boolean;
  template?: string;
  keepSpec?: boolean;
  timeout?: number;
  exportStyle?: 'namespace' | 'direct' | 'both' | 'none';
  skipJsExtensions?: boolean;
  bare?: boolean;
}

export async function generateAction(options: GenerateOptions): Promise<void> {
  const spinner = ora('Loading OpenAPI specification...').start();

  try {
    // Validate bare mode
    if (options.bare && options.mode !== 'models-only') {
      spinner.fail('Generation failed');
      Logger.error('--bare flag can only be used with --mode models-only');
      process.exit(1);
    }

    if (options.bare && options.exportStyle) {
      Logger.warn('--export-style is ignored when using --bare flag');
    }

    // Parse headers
    const headers = options.header ? parseHeaders(options.header) : {};
    Logger.debug(`Headers: ${JSON.stringify(headers)}`);

    // Load spec
    spinner.text = 'Loading OpenAPI specification...';
    const loader = new SpecLoader();
    const spec = options.resolveRefs
      ? await loader.loadWithRefs({
          url: options.url,
          headers,
          timeout: options.timeout || 30000,
          keepSpec: options.keepSpec,
          specDir: `${options.output}/.specs`,
          resolveRefs: true,
          maxDepth: 10,
        })
      : await loader.load({
          url: options.url,
          headers,
          timeout: options.timeout || 30000,
          keepSpec: options.keepSpec,
          specDir: `${options.output}/.specs`,
        });

    Logger.debug(`Loaded spec from ${options.url}`);

    // Parse OpenAPI
    spinner.text = 'Parsing OpenAPI specification...';
    const parser = new OpenAPIParser();
    const ir = parser.parse(spec, {
      includeOperations: options.mode === 'full',
    });

    Logger.debug(`Parsed ${ir.schemas.size} schema(s), ${ir.operations.size} operation(s)`);

    // Generate code
    spinner.text = 'Generating TypeScript code...';
    const generator = new Generator({
      outputDir: options.output,
      esm: options.esm && !options.skipJsExtensions,
      nestJsSwagger: options.nestjsSwagger,
      classValidator: options.classValidator,
      useAjv: options.useAjv,
      exportStyle: options.exportStyle,
      bare: options.bare,
      mode: options.mode,
      templateDir: options.template,
    });

    await generator.generate(ir);

    spinner.succeed('Generation complete!');
    Logger.success(`\nOutput directory: ${options.output}`);
    Logger.info(`Generated ${ir.schemas.size} model(s)`);
    if (options.mode === 'full' && ir.operations.size > 0) {
      Logger.info(`Generated ${ir.operations.size} API operation(s)`);
    }
  } catch (error) {
    spinner.fail('Generation failed');
    Logger.error((error as Error).message);
    if (Logger.isDebug()) {
      console.error(error);
    }
    process.exit(1);
  }
}

export const generateCommand = new Command('generate')
  .description('Generate TypeScript client from OpenAPI specification')
  .addOption(urlOption('OpenAPI spec URL or file path'))
  .addOption(outputOption('Output directory'))
  .option('-m, --mode <mode>', 'Generation mode: full or models-only', 'full')
  .addOption(headerOption())
  .addOption(resolveRefsOption())
  .addOption(esmOption())
  .addOption(nestjsSwaggerOption())
  .addOption(classValidatorOption())
  .addOption(useAjvOption())
  .addOption(templateOption())
  .addOption(keepSpecOption())
  .addOption(timeoutOption())
  .addOption(exportStyleOption())
  .addOption(bareOption())
  .addOption(skipJsExtensionsOption())
  .action(generateAction);
