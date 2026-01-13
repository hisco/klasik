/**
 * Generic spec loader - loads specs from URLs, files, or file:// URIs
 * Works with any format (OpenAPI, CRD, JSON Schema)
 * Auto-detects JSON vs YAML
 */

import * as fs from 'fs';
import * as path from 'path';
import axios, { AxiosRequestConfig } from 'axios';
import * as yaml from 'js-yaml';
import { RefResolver } from './ref-resolver';
import { RefInliner } from './ref-inliner';

export interface SpecLoaderOptions {
  /** URL, file path, or file:// URI */
  url: string;
  /** Optional HTTP headers for remote requests */
  headers?: Record<string, string>;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Format to parse as ('json', 'yaml', or 'auto' to auto-detect) */
  format?: 'json' | 'yaml' | 'auto';
  /** Save downloaded spec to file */
  keepSpec?: boolean;
  /** Directory to save spec files (default: .specs) */
  specDir?: string;
}

export interface LoadWithRefsOptions extends SpecLoaderOptions {
  /** Whether to resolve and inline external $ref (default: true) */
  resolveRefs?: boolean;
  /** Maximum depth for nested $ref resolution (default: 10) */
  maxDepth?: number;
}

export class SpecLoaderError extends Error {
  constructor(
    message: string,
    public readonly url: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'SpecLoaderError';
  }
}

/**
 * Generic spec loader that works with any spec format
 * - Loads from URLs (http/https)
 * - Loads from local files (relative/absolute paths, file:// URIs)
 * - Auto-detects JSON vs YAML
 * - No assumptions about spec structure
 */
export class SpecLoader {
  /**
   * Load a spec from URL or file path
   * @param options Loading options
   * @returns Parsed spec (any structure)
   */
  async load(options: SpecLoaderOptions): Promise<any> {
    const { url, format = 'auto', keepSpec = false, specDir = '.specs' } = options;

    try {
      // Determine if local or remote
      const isLocal = this.isLocalFile(url);

      // Load content
      const content = isLocal
        ? this.loadLocalFile(url)
        : await this.loadRemoteFile(url, options);

      // Save spec if requested (only for remote files)
      if (keepSpec && !isLocal) {
        this.saveSpec(content, url, specDir);
      }

      // Detect format if auto
      const actualFormat = format === 'auto' ? this.detectFormat(content) : format;

      // Parse and return
      return this.parseContent(content, actualFormat);
    } catch (error) {
      if (error instanceof SpecLoaderError) {
        throw error;
      }
      throw new SpecLoaderError(
        `Failed to load spec from ${url}: ${(error as Error).message}`,
        url,
        error as Error
      );
    }
  }

  /**
   * Check if URL is a local file
   * @param url URL to check
   * @returns True if local file, false if remote
   */
  isLocalFile(url: string): boolean {
    // file:// protocol
    if (url.startsWith('file://')) {
      return true;
    }

    // http/https protocol
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return false;
    }

    // Relative or absolute path (no protocol)
    return true;
  }

  /**
   * Load content from local file
   * @param filePath File path (can be file:// URI, relative, or absolute)
   * @returns File content as string
   */
  loadLocalFile(filePath: string): string {
    try {
      // Strip file:// protocol if present
      let actualPath = filePath;
      if (filePath.startsWith('file://')) {
        actualPath = filePath.substring('file://'.length);
      }

      // Resolve relative paths
      const resolvedPath = path.isAbsolute(actualPath)
        ? actualPath
        : path.resolve(process.cwd(), actualPath);

      // Check if file exists
      if (!fs.existsSync(resolvedPath)) {
        throw new SpecLoaderError(
          `File not found: ${resolvedPath}`,
          filePath
        );
      }

      // Read file
      return fs.readFileSync(resolvedPath, 'utf-8');
    } catch (error) {
      if (error instanceof SpecLoaderError) {
        throw error;
      }
      throw new SpecLoaderError(
        `Failed to read file ${filePath}: ${(error as Error).message}`,
        filePath,
        error as Error
      );
    }
  }

  /**
   * Load content from remote URL
   * @param url Remote URL (http/https)
   * @param options Loading options
   * @returns Response content as string
   */
  async loadRemoteFile(
    url: string,
    options: SpecLoaderOptions
  ): Promise<string> {
    try {
      const config: AxiosRequestConfig = {
        timeout: options.timeout || 30000,
        headers: options.headers || {},
        responseType: 'text',
      };

      const response = await axios.get(url, config);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message = error.response
          ? `HTTP ${error.response.status}: ${error.response.statusText}`
          : error.message;
        throw new SpecLoaderError(
          `Failed to fetch ${url}: ${message}`,
          url,
          error
        );
      }
      throw new SpecLoaderError(
        `Failed to fetch ${url}: ${(error as Error).message}`,
        url,
        error as Error
      );
    }
  }

  /**
   * Auto-detect format (JSON or YAML)
   * @param content File content
   * @returns Detected format
   */
  detectFormat(content: string): 'json' | 'yaml' {
    // Trim whitespace
    const trimmed = content.trim();

    // Try JSON first (fast parse)
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        JSON.parse(trimmed);
        return 'json';
      } catch {
        // Not valid JSON, assume YAML
        return 'yaml';
      }
    }

    // If starts with YAML document marker or contains common YAML patterns
    if (
      trimmed.startsWith('---') ||
      trimmed.startsWith('apiVersion:') ||
      trimmed.startsWith('openapi:') ||
      /^[a-zA-Z_][a-zA-Z0-9_]*:\s/.test(trimmed)
    ) {
      return 'yaml';
    }

    // Default to YAML (more forgiving parser)
    return 'yaml';
  }

  /**
   * Parse content as JSON or YAML
   * @param content Raw content
   * @param format Format to parse as
   * @returns Parsed object
   */
  parseContent(content: string, format: 'json' | 'yaml'): any {
    try {
      if (format === 'json') {
        return JSON.parse(content);
      } else {
        // YAML parser (single document)
        return yaml.load(content, { json: true });
      }
    } catch (error) {
      throw new Error(
        `Failed to parse content as ${format}: ${(error as Error).message}`
      );
    }
  }

  /**
   * Load and parse multiple YAML documents from a file
   * Useful for CRD files that contain multiple documents
   * @param options Loading options
   * @returns Array of parsed documents
   */
  async loadMultiDocument(options: SpecLoaderOptions): Promise<any[]> {
    const { url } = options;

    try {
      // Determine if local or remote
      const isLocal = this.isLocalFile(url);

      // Load content
      const content = isLocal
        ? this.loadLocalFile(url)
        : await this.loadRemoteFile(url, options);

      // Parse as multi-document YAML
      const documents = yaml.loadAll(content, undefined, { json: true });

      // Filter out null/undefined documents
      return documents.filter((doc) => doc != null);
    } catch (error) {
      if (error instanceof SpecLoaderError) {
        throw error;
      }
      throw new SpecLoaderError(
        `Failed to load multi-document YAML from ${url}: ${(error as Error).message}`,
        url,
        error as Error
      );
    }
  }

  /**
   * Save spec content to file
   * @param content Spec content
   * @param url Original URL
   * @param specDir Directory to save specs
   */
  private saveSpec(content: string, url: string, specDir: string): void {
    try {
      // Create spec directory if it doesn't exist
      if (!fs.existsSync(specDir)) {
        fs.mkdirSync(specDir, { recursive: true });
      }

      // Generate filename from URL
      const fileName = this.generateSpecFileName(url, content);
      const filePath = path.join(specDir, fileName);

      // Write file
      fs.writeFileSync(filePath, content, 'utf-8');

      console.log(`Saved spec to ${filePath}`);
    } catch (error) {
      // Don't fail the entire operation if we can't save the spec
      console.warn(`Warning: Failed to save spec: ${(error as Error).message}`);
    }
  }

  /**
   * Generate a filename for a spec based on its URL
   * @param url Original URL
   * @param content Spec content (to detect format)
   * @returns Generated filename
   */
  private generateSpecFileName(url: string, content: string): string {
    // Try to extract a meaningful name from URL
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;

    // Get the last part of the path
    let baseName = pathname.split('/').filter(Boolean).pop() || 'spec';

    // Remove extension if present
    baseName = baseName.replace(/\.(json|yaml|yml)$/, '');

    // Sanitize filename
    baseName = baseName.replace(/[^a-zA-Z0-9_-]/g, '_');

    // Detect format and add appropriate extension
    const format = this.detectFormat(content);
    const extension = format === 'json' ? 'json' : 'yaml';

    // Add timestamp to ensure uniqueness
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);

    return `${baseName}_${timestamp}.${extension}`;
  }

  /**
   * Load a spec and optionally resolve and inline external $ref
   * @param options Loading options with ref resolution settings
   * @returns Parsed spec (with refs inlined if resolveRefs=true)
   */
  async loadWithRefs(options: LoadWithRefsOptions): Promise<any> {
    const { url, resolveRefs = true, maxDepth = 10, ...loaderOptions } = options;

    // If not resolving refs, just use regular load
    if (!resolveRefs) {
      return this.load({ url, ...loaderOptions });
    }

    try {
      // Step 1: Load the main spec
      const spec = await this.load({ url, ...loaderOptions });

      // Step 2: Resolve all external refs
      const refResolver = new RefResolver();
      const resolvedRefs = await refResolver.resolveExternalRefs(spec, {
        baseUrl: url,
        maxDepth,
        loaderOptions: {
          headers: loaderOptions.headers,
          timeout: loaderOptions.timeout,
          format: loaderOptions.format,
        },
      });

      // Step 3: Inline refs into main spec
      const refInliner = new RefInliner();
      const inlinedSpec = refInliner.inline(spec, resolvedRefs, {
        baseUrl: url,
      });

      return inlinedSpec;
    } catch (error) {
      if (error instanceof SpecLoaderError) {
        throw error;
      }
      throw new SpecLoaderError(
        `Failed to load spec with refs from ${url}: ${(error as Error).message}`,
        url,
        error as Error
      );
    }
  }
}
