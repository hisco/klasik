/**
 * Export Style Manager
 * - Generates index files with different export styles
 * - Supports: namespace, direct, both, none
 * - Works generically with any directory structure
 */

import * as fs from 'fs';
import * as path from 'path';

export type ExportStyle = 'namespace' | 'direct' | 'both' | 'none';

export interface ExportStyleOptions {
  /** Export style to use */
  style: ExportStyle;
  /** Whether to use ESM (.js extensions) */
  esm: boolean;
  /** Base directory for exports */
  baseDir: string;
  /** Subdirectories to export from (e.g., ['models', 'apis']) */
  subdirs: string[];
}

/**
 * Manages export styles for generated code
 */
export class ExportStyleManager {
  /**
   * Generate index file with specified export style
   * @param options Export style options
   * @returns Generated index file content
   */
  generateIndexFile(options: ExportStyleOptions): string {
    const { style, esm, baseDir, subdirs } = options;

    if (style === 'none') {
      return '// No exports\n';
    }

    const lines: string[] = [];

    for (const subdir of subdirs) {
      const subdirPath = path.join(baseDir, subdir);

      // Check if directory exists
      if (!fs.existsSync(subdirPath)) {
        continue;
      }

      // Get all TypeScript files in the subdirectory
      const files = fs
        .readdirSync(subdirPath)
        .filter((f) => f.endsWith('.ts') && f !== 'index.ts')
        .map((f) => f.replace('.ts', ''));

      if (files.length === 0) {
        continue;
      }

      // Extract class names from files
      const classNames = new Map<string, string[]>();
      for (const file of files) {
        const filePath = path.join(subdirPath, `${file}.ts`);
        const classes = this.extractClassNames(filePath);
        if (classes.length > 0) {
          classNames.set(file, classes);
        }
      }

      // Generate exports based on style
      if (style === 'namespace') {
        lines.push(...this.generateNamespaceExports(subdir, files, esm));
      } else if (style === 'direct') {
        lines.push(...this.generateDirectExports(subdir, classNames, esm));
      } else if (style === 'both') {
        lines.push(...this.generateNamespaceExports(subdir, files, esm));
        lines.push('');
        lines.push(...this.generateDirectExports(subdir, classNames, esm));
      }
    }

    return lines.join('\n') + '\n';
  }

  /**
   * Extract class names from a TypeScript file
   * @param filePath Path to TypeScript file
   * @returns Array of exported class names
   */
  extractClassNames(filePath: string): string[] {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');

      // Match export class declarations
      const classRegex = /export\s+class\s+(\w+)/g;
      const matches = content.matchAll(classRegex);

      const classNames: string[] = [];
      for (const match of matches) {
        classNames.push(match[1]);
      }

      return classNames;
    } catch (error) {
      console.warn(`Failed to extract class names from ${filePath}:`, error);
      return [];
    }
  }

  /**
   * Generate namespace exports
   * Format: export * as models from './models';
   * @param identifier Namespace identifier
   * @param files File names to export
   * @param esm Whether to use ESM .js extensions
   * @returns Array of export lines
   */
  private generateNamespaceExports(
    identifier: string,
    files: string[],
    esm: boolean
  ): string[] {
    const lines: string[] = [];

    for (const file of files) {
      const importPath = this.resolveImportPath(identifier, file, esm);
      // Sanitize identifier (remove special characters)
      const safeId = this.sanitizeIdentifier(file);
      lines.push(`export * as ${safeId} from '${importPath}';`);
    }

    return lines;
  }

  /**
   * Generate direct exports
   * Format: export { ClassName } from './models/file';
   * @param subdir Subdirectory name
   * @param classNames Map of file name -> class names
   * @param esm Whether to use ESM .js extensions
   * @returns Array of export lines
   */
  private generateDirectExports(
    subdir: string,
    classNames: Map<string, string[]>,
    esm: boolean
  ): string[] {
    const lines: string[] = [];

    for (const [file, classes] of classNames) {
      if (classes.length === 0) {
        continue;
      }

      const importPath = this.resolveImportPath(subdir, file, esm);
      const classesStr = classes.join(', ');
      lines.push(`export { ${classesStr} } from '${importPath}';`);
    }

    return lines;
  }

  /**
   * Resolve import path for a file
   * @param subdir Subdirectory name
   * @param file File name (without extension)
   * @param esm Whether to use ESM .js extensions
   * @returns Import path
   */
  private resolveImportPath(subdir: string, file: string, esm: boolean): string {
    const extension = esm ? '.js' : '';
    return `./${subdir}/${file}${extension}`;
  }

  /**
   * Sanitize identifier to be a valid JavaScript identifier
   * @param str String to sanitize
   * @returns Sanitized identifier
   */
  private sanitizeIdentifier(str: string): string {
    return str
      .replace(/[^a-zA-Z0-9_$]/g, '_')
      .replace(/^([0-9])/, '_$1'); // Can't start with number
  }

  /**
   * Generate index file and write to disk
   * @param options Export style options
   * @param outputPath Output file path (e.g., './generated/index.ts')
   */
  writeIndexFile(options: ExportStyleOptions, outputPath: string): void {
    const content = this.generateIndexFile(options);
    fs.writeFileSync(outputPath, content, 'utf-8');
  }
}
