/**
 * Download Command
 *
 * Downloads OpenAPI spec without generating code
 */

import { Command } from 'commander';
import { SpecLoader } from '../../loaders/spec-loader';
import { Logger } from '../utils/logger';
import ora from 'ora';
import * as fs from 'fs';
import * as path from 'path';
import {
  urlOption,
  outputOption,
  headerOption,
  timeoutOption,
  resolveRefsOption,
  parseHeaders,
} from '../utils/options';

export interface DownloadOptions {
  url: string;
  output: string;
  header?: string[];
  resolveRefs?: boolean;
  timeout?: number;
}

export async function downloadAction(options: DownloadOptions): Promise<void> {
  const spinner = ora('Downloading specification...').start();

  try {
    // Parse headers
    const headers = options.header ? parseHeaders(options.header) : {};
    Logger.debug(`Headers: ${JSON.stringify(headers)}`);

    // Load spec
    const loader = new SpecLoader();
    const spec = options.resolveRefs
      ? await loader.loadWithRefs({
          url: options.url,
          headers,
          timeout: options.timeout || 30000,
          resolveRefs: true,
          maxDepth: 10,
        })
      : await loader.load({
          url: options.url,
          headers,
          timeout: options.timeout || 30000,
        });

    Logger.debug(`Downloaded spec from ${options.url}`);

    // Ensure output directory exists
    const outputDir = path.dirname(options.output);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Save to file
    const content = JSON.stringify(spec, null, 2);
    await fs.promises.writeFile(options.output, content, 'utf-8');

    spinner.succeed('Download complete!');
    Logger.success(`\nSaved to: ${options.output}`);
    Logger.info(`Size: ${(content.length / 1024).toFixed(2)} KB`);
  } catch (error) {
    spinner.fail('Download failed');
    Logger.error((error as Error).message);
    if (Logger.isDebug()) {
      console.error(error);
    }
    process.exit(1);
  }
}

export const downloadCommand = new Command('download')
  .description('Download OpenAPI spec without generating code')
  .addOption(urlOption('Remote spec URL'))
  .addOption(outputOption('Output file path'))
  .addOption(headerOption())
  .addOption(resolveRefsOption())
  .addOption(timeoutOption())
  .action(downloadAction);
