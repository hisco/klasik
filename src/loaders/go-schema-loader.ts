/**
 * Go Schema Loader
 *
 * Calls the Go tool to generate JSON Schema from Go structs using reflection
 */

import { spawn, execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

export interface GoSchemaLoaderOptions {
  /** Go type path (e.g., "helm.sh/helm/v3/pkg/chart.Metadata") */
  typePath: string;
  /** Path to go-schema-gen binary (default: bundled) */
  goToolPath?: string;
  /** Allow additional properties in generated schema */
  allowAdditionalProperties?: boolean;
  /** Generate expanded definitions instead of $ref */
  expandedDefinitions?: boolean;
}

export class GoSchemaLoaderError extends Error {
  constructor(
    message: string,
    public readonly typePath: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'GoSchemaLoaderError';
  }
}

export class GoSchemaLoader {
  private buildAttempted = false;

  /**
   * Default path to bundled go-schema-gen tool
   */
  private getDefaultGoToolPath(): string {
    // Resolve path relative to this package
    return path.join(__dirname, '../../dist/bin/go-schema-gen');
  }

  /**
   * Get path to Go tool source directory
   */
  private getGoToolSourcePath(): string {
    return path.join(__dirname, '../../tools/go-schema-gen');
  }

  /**
   * Check if Go is installed
   */
  private isGoInstalled(): boolean {
    try {
      execSync('go version', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Build the Go tool automatically
   */
  private async buildGoTool(): Promise<void> {
    if (this.buildAttempted) {
      return; // Don't try twice
    }
    this.buildAttempted = true;

    if (!this.isGoInstalled()) {
      throw new Error(
        'Go is not installed. Please install Go from https://go.dev/dl/ to use Go struct generation.'
      );
    }

    const sourcePath = this.getGoToolSourcePath();
    const toolPath = this.getDefaultGoToolPath();

    // Ensure source directory exists
    if (!fs.existsSync(sourcePath)) {
      throw new Error(
        `Go tool source not found at ${sourcePath}. ` +
        `This may indicate an incomplete installation.`
      );
    }

    console.log('Building Go schema generator (first time only)...');

    try {
      // Create output directory
      const binDir = path.dirname(toolPath);
      if (!fs.existsSync(binDir)) {
        fs.mkdirSync(binDir, { recursive: true });
      }

      // Run go mod tidy to install dependencies
      console.log('Installing Go dependencies...');
      execSync('go mod tidy', {
        cwd: sourcePath,
        stdio: 'inherit'
      });

      // Build the binary
      console.log('Compiling Go tool...');
      execSync(`go build -o "${toolPath}" .`, {
        cwd: sourcePath,
        stdio: 'inherit'
      });

      console.log('✓ Go tool built successfully');
    } catch (error) {
      throw new Error(
        `Failed to build Go tool: ${(error as Error).message}\n` +
        `Please try manually: cd ${sourcePath} && ./build.sh`
      );
    }
  }

  /**
   * Load JSON Schema from Go struct using reflection
   * @param options Loading options
   * @returns JSON Schema object
   */
  async load(options: GoSchemaLoaderOptions): Promise<any> {
    const { typePath, goToolPath, allowAdditionalProperties, expandedDefinitions } = options;

    // Resolve Go tool path
    const toolPath = goToolPath || this.getDefaultGoToolPath();

    // Check if tool exists, if not try to build it
    if (!fs.existsSync(toolPath)) {
      try {
        await this.buildGoTool();
      } catch (error) {
        throw new GoSchemaLoaderError(
          `Go schema generator not found and auto-build failed.\n` +
          `Error: ${(error as Error).message}\n\n` +
          `Manual build: cd tools/go-schema-gen && ./build.sh`,
          typePath,
          error as Error
        );
      }

      // Check again after build
      if (!fs.existsSync(toolPath)) {
        throw new GoSchemaLoaderError(
          `Go schema generator not found at ${toolPath} even after build attempt.`,
          typePath
        );
      }
    }

    try {
      // Build arguments
      const args = ['--type', typePath];
      if (allowAdditionalProperties) {
        args.push('--allow-additional');
      }
      if (expandedDefinitions) {
        args.push('--expanded');
      }

      // Execute Go tool
      const output = await this.executeGoTool(toolPath, args);

      // Parse JSON output
      try {
        return JSON.parse(output);
      } catch (error) {
        throw new GoSchemaLoaderError(
          `Failed to parse JSON Schema output: ${(error as Error).message}`,
          typePath,
          error as Error
        );
      }
    } catch (error) {
      if (error instanceof GoSchemaLoaderError) {
        throw error;
      }
      throw new GoSchemaLoaderError(
        `Failed to generate schema for ${typePath}: ${(error as Error).message}`,
        typePath,
        error as Error
      );
    }
  }

  /**
   * Execute Go tool and return stdout
   */
  private executeGoTool(toolPath: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';

      const process = spawn(toolPath, args, {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('error', (error) => {
        reject(new Error(`Failed to spawn Go tool: ${error.message}`));
      });

      process.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Go tool exited with code ${code}: ${stderr}`));
        } else {
          resolve(stdout);
        }
      });
    });
  }

  /**
   * Load multiple Go types and return their schemas
   * @param typePaths Array of Go type paths
   * @param options Loading options (applied to all types)
   * @returns Array of type path and schema pairs
   */
  async loadMultiple(
    typePaths: string[],
    options: Omit<GoSchemaLoaderOptions, 'typePath'>
  ): Promise<Array<{ typePath: string; schema: any }>> {
    const results = await Promise.all(
      typePaths.map(async (typePath) => ({
        typePath,
        schema: await this.load({ ...options, typePath })
      }))
    );
    return results;
  }
}
