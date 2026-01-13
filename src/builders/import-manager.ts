/**
 * Import Manager
 *
 * Manages imports for generated TypeScript files
 * Handles deduplication, sorting, and ESM extensions
 */

import { SourceFile } from 'ts-morph';

export interface ImportManagerOptions {
  /**
   * Whether to add .js extensions for ESM compatibility
   */
  esm?: boolean;
}

/**
 * Manages imports for a single file
 */
export class ImportManager {
  private imports = new Map<string, Set<string>>();
  private options: ImportManagerOptions;

  constructor(options: ImportManagerOptions = {}) {
    this.options = options;
  }

  /**
   * Add a named import
   */
  addImport(modulePath: string, ...namedImports: string[]): void {
    if (!this.imports.has(modulePath)) {
      this.imports.set(modulePath, new Set());
    }

    const existing = this.imports.get(modulePath)!;
    namedImports.forEach(imp => existing.add(imp));
  }

  /**
   * Add multiple imports from different modules
   */
  addImports(imports: Record<string, string[]>): void {
    for (const [modulePath, names] of Object.entries(imports)) {
      this.addImport(modulePath, ...names);
    }
  }

  /**
   * Check if a module has been imported
   */
  hasImport(modulePath: string): boolean {
    return this.imports.has(modulePath);
  }

  /**
   * Check if a specific named import exists
   */
  hasNamedImport(modulePath: string, namedImport: string): boolean {
    return this.imports.get(modulePath)?.has(namedImport) || false;
  }

  /**
   * Get all named imports for a module
   */
  getNamedImports(modulePath: string): string[] {
    return Array.from(this.imports.get(modulePath) || []);
  }

  /**
   * Apply imports to a source file
   */
  applyToSourceFile(sourceFile: SourceFile): void {
    // Sort module paths: external first, then relative
    const sortedModules = Array.from(this.imports.entries()).sort(([a], [b]) => {
      const aIsRelative = a.startsWith('.');
      const bIsRelative = b.startsWith('.');

      // External modules come first
      if (!aIsRelative && bIsRelative) return -1;
      if (aIsRelative && !bIsRelative) return 1;

      // Within same category, sort alphabetically
      return a.localeCompare(b);
    });

    for (const [modulePath, namedImportsSet] of sortedModules) {
      const namedImports = Array.from(namedImportsSet).sort();
      const importPath = this.resolveImportPath(modulePath);

      sourceFile.addImportDeclaration({
        moduleSpecifier: importPath,
        namedImports,
      });
    }
  }

  /**
   * Resolve import path (add .js extension if ESM)
   */
  private resolveImportPath(modulePath: string): string {
    if (!this.options.esm) {
      return modulePath;
    }

    // Only add .js to relative imports
    if (modulePath.startsWith('.')) {
      // Don't add if already has extension
      if (modulePath.endsWith('.js') || modulePath.endsWith('.ts')) {
        return modulePath;
      }
      return `${modulePath}.js`;
    }

    return modulePath;
  }

  /**
   * Clear all imports
   */
  clear(): void {
    this.imports.clear();
  }

  /**
   * Get all imports as a record
   */
  toRecord(): Record<string, string[]> {
    const record: Record<string, string[]> = {};
    for (const [modulePath, namedImportsSet] of this.imports.entries()) {
      record[modulePath] = Array.from(namedImportsSet).sort();
    }
    return record;
  }

  /**
   * Clone this import manager
   */
  clone(): ImportManager {
    const cloned = new ImportManager(this.options);
    for (const [modulePath, namedImportsSet] of this.imports.entries()) {
      cloned.imports.set(modulePath, new Set(namedImportsSet));
    }
    return cloned;
  }
}
