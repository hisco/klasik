/**
 * Generic external $ref resolver
 * - Finds all external $ref in a spec
 * - Downloads referenced files
 * - Resolves relative paths correctly
 * - Deduplicates downloads
 * - Works with any spec format (OpenAPI, CRD, JSON Schema)
 */

import * as path from 'path';
import { SpecLoader, SpecLoaderOptions } from './spec-loader';

export interface RefResolverOptions {
  /** Base URL or file path of the main spec (for resolving relative refs) */
  baseUrl: string;
  /** Options to pass to SpecLoader for downloading refs */
  loaderOptions?: Partial<SpecLoaderOptions>;
  /** Maximum depth for nested $ref resolution (default: 10) */
  maxDepth?: number;
}

export class RefResolverError extends Error {
  constructor(
    message: string,
    public readonly ref: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'RefResolverError';
  }
}

/**
 * Resolves external $ref references in specs
 * Generic implementation - works with any spec structure
 */
export class RefResolver {
  private specLoader: SpecLoader;
  private resolvedRefs: Map<string, any>;
  private visitedUrls: Set<string>;

  constructor() {
    this.specLoader = new SpecLoader();
    this.resolvedRefs = new Map();
    this.visitedUrls = new Set();
  }

  /**
   * Resolve all external $ref in a spec
   * @param spec The spec object to scan for $ref
   * @param options Resolution options
   * @returns Map of ref URL → resolved content
   */
  async resolveExternalRefs(
    spec: any,
    options: RefResolverOptions
  ): Promise<Map<string, any>> {
    const { baseUrl, maxDepth = 10 } = options;

    // Reset state
    this.resolvedRefs = new Map();
    this.visitedUrls = new Set();

    // Find all external refs
    const externalRefs = this.findExternalRefs(spec);

    // Resolve each ref
    for (const ref of externalRefs) {
      await this.resolveRef(ref, baseUrl, options, 0, maxDepth);
    }

    return this.resolvedRefs;
  }

  /**
   * Find all external $ref in an object (recursive)
   * @param obj Object to scan
   * @returns Array of external ref URLs
   */
  findExternalRefs(obj: any): string[] {
    const refs: string[] = [];

    const visit = (current: any): void => {
      if (current === null || typeof current !== 'object') {
        return;
      }

      // Check if this object has a $ref property
      if (typeof current.$ref === 'string') {
        const ref = current.$ref;
        // External ref: doesn't start with #
        if (!ref.startsWith('#')) {
          refs.push(ref);
        }
      }

      // Recurse into arrays
      if (Array.isArray(current)) {
        current.forEach(visit);
      } else {
        // Recurse into object properties
        Object.values(current).forEach(visit);
      }
    };

    visit(obj);

    // Deduplicate
    return Array.from(new Set(refs));
  }

  /**
   * Check if a $ref is external (doesn't start with #)
   * @param ref The $ref string
   * @returns True if external
   */
  isExternalRef(ref: string): boolean {
    return !ref.startsWith('#');
  }

  /**
   * Resolve a ref URL relative to base URL
   * @param ref The $ref string (e.g., "./schemas/Pet.yaml#/Pet")
   * @param baseUrl Base URL of the current document
   * @param isRemote Whether baseUrl is a remote URL
   * @returns Absolute URL to download
   */
  resolveRefUrl(ref: string, baseUrl: string, isRemote: boolean): string {
    // Split ref into file part and fragment part
    const [filePart, fragmentPart] = ref.split('#');

    if (isRemote) {
      // Remote base URL - use URL resolution
      const baseUrlObj = new URL(baseUrl);
      const resolvedUrl = new URL(filePart, baseUrlObj);
      return resolvedUrl.toString();
    } else {
      // Local file - use path resolution
      const baseDir = path.dirname(baseUrl);
      const resolvedPath = path.resolve(baseDir, filePart);
      return resolvedPath;
    }
  }

  /**
   * Download and parse a referenced file
   * @param ref The original $ref string
   * @param baseUrl Base URL for resolution
   * @param options Resolution options
   * @param depth Current recursion depth
   * @param maxDepth Maximum recursion depth
   */
  private async resolveRef(
    ref: string,
    baseUrl: string,
    options: RefResolverOptions,
    depth: number,
    maxDepth: number
  ): Promise<void> {
    // Check depth limit
    if (depth >= maxDepth) {
      throw new RefResolverError(
        `Maximum resolution depth (${maxDepth}) exceeded`,
        ref
      );
    }

    // Split ref into file and fragment
    const [filePart] = ref.split('#');

    // Determine if base is remote
    const isRemote =
      baseUrl.startsWith('http://') || baseUrl.startsWith('https://');

    // Resolve to absolute URL
    const resolvedUrl = this.resolveRefUrl(ref, baseUrl, isRemote);

    // Skip if already visited
    if (this.visitedUrls.has(resolvedUrl)) {
      return;
    }
    this.visitedUrls.add(resolvedUrl);

    try {
      // Download the referenced file
      const content = await this.specLoader.load({
        url: resolvedUrl,
        ...options.loaderOptions,
      });

      // Store resolved content
      this.resolvedRefs.set(ref, content);

      // Find nested external refs in this file
      const nestedRefs = this.findExternalRefs(content);

      // Recursively resolve nested refs
      for (const nestedRef of nestedRefs) {
        await this.resolveRef(
          nestedRef,
          resolvedUrl, // Use this file as new base
          options,
          depth + 1,
          maxDepth
        );
      }
    } catch (error) {
      throw new RefResolverError(
        `Failed to resolve $ref "${ref}": ${(error as Error).message}`,
        ref,
        error as Error
      );
    }
  }

  /**
   * Get the resolved content for a ref
   * @param ref The $ref string
   * @returns Resolved content or undefined if not found
   */
  getResolvedRef(ref: string): any | undefined {
    return this.resolvedRefs.get(ref);
  }

  /**
   * Extract the fragment from a $ref and resolve it within a document
   * @param ref The $ref string (e.g., "./schemas.yaml#/components/schemas/Pet")
   * @param document The resolved document
   * @returns The referenced object within the document
   */
  resolveFragment(ref: string, document: any): any {
    const [, fragment] = ref.split('#');

    if (!fragment || fragment === '/') {
      return document;
    }

    // Split fragment into parts (e.g., "/components/schemas/Pet" -> ["components", "schemas", "Pet"])
    const parts = fragment
      .split('/')
      .filter((part) => part.length > 0);

    // Navigate through the document
    let current = document;
    for (const part of parts) {
      if (current === null || typeof current !== 'object') {
        throw new RefResolverError(
          `Cannot resolve fragment ${fragment} in document`,
          ref
        );
      }
      current = current[part];
      if (current === undefined) {
        throw new RefResolverError(
          `Fragment path ${fragment} not found in document`,
          ref
        );
      }
    }

    return current;
  }

  /**
   * Clear all resolved refs (useful for testing or memory cleanup)
   */
  clear(): void {
    this.resolvedRefs.clear();
    this.visitedUrls.clear();
  }
}
