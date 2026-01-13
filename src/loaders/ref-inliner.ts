/**
 * RefInliner - Inlines external $ref references into a spec
 *
 * Takes a spec and a Map of resolved refs (from RefResolver)
 * and returns a new spec with all external refs replaced by their content.
 *
 * Features:
 * - Preserves internal refs (starting with #)
 * - Handles fragments (#/components/schemas/User)
 * - Handles nested refs (ref within ref)
 * - Deep clones to avoid mutations
 * - Recursively traverses spec object
 */

import { RefResolver } from './ref-resolver';

export interface RefInlinerOptions {
  /** Base URL of the main spec (for error messages) */
  baseUrl?: string;
}

export class RefInlinerError extends Error {
  constructor(
    message: string,
    public readonly ref: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'RefInlinerError';
  }
}

/**
 * Inlines external $ref references into a spec
 * Works recursively to handle refs within refs
 */
export class RefInliner {
  private resolvedRefs: Map<string, any>;
  private refResolver: RefResolver;
  private baseUrl?: string;

  constructor() {
    this.resolvedRefs = new Map();
    this.refResolver = new RefResolver();
  }

  /**
   * Inline all external $ref in a spec
   * @param spec The spec object containing $ref
   * @param resolvedRefs Map of ref URL → resolved content (from RefResolver)
   * @param options Inlining options
   * @returns New spec with external refs inlined
   */
  inline(
    spec: any,
    resolvedRefs: Map<string, any>,
    options: RefInlinerOptions = {}
  ): any {
    this.resolvedRefs = resolvedRefs;
    this.baseUrl = options.baseUrl;

    // Deep clone to avoid mutating original spec
    const cloned = this.deepClone(spec);

    // Recursively inline refs
    return this.inlineRefs(cloned);
  }

  /**
   * Deep clone an object using JSON serialization
   * @param obj Object to clone
   * @returns Cloned object
   */
  private deepClone(obj: any): any {
    return JSON.parse(JSON.stringify(obj));
  }

  /**
   * Recursively inline refs in an object
   * @param obj Object to process
   * @returns Object with refs inlined
   */
  private inlineRefs(obj: any): any {
    // Base cases: null, undefined, primitives
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj !== 'object') {
      return obj;
    }

    // Check if this object has a $ref property
    if (typeof obj.$ref === 'string') {
      const ref = obj.$ref;

      // Preserve internal refs (starting with #)
      if (ref.startsWith('#')) {
        return obj;
      }

      // Resolve and inline external ref
      return this.resolveAndInline(ref);
    }

    // Handle arrays
    if (Array.isArray(obj)) {
      return obj.map((item) => this.inlineRefs(item));
    }

    // Handle objects - recurse into properties
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = this.inlineRefs(value);
    }

    return result;
  }

  /**
   * Resolve a ref and inline its content (recursively)
   * @param ref The $ref string
   * @returns Inlined content
   */
  private resolveAndInline(ref: string): any {
    // Split ref into file part and fragment part
    const [filePart, fragment] = ref.split('#');

    // Try to get resolved content
    // RefResolver stores content with the original ref as key
    let content = this.resolvedRefs.get(ref);

    // If not found with full ref, try finding by file part
    // This handles cases where multiple refs point to same file with different fragments
    if (!content && filePart) {
      // Look for any key that starts with the file part
      for (const [key, value] of this.resolvedRefs.entries()) {
        const [keyFilePart] = key.split('#');
        if (keyFilePart === filePart) {
          content = value;
          break;
        }
      }
    }

    // If still not found, throw error
    if (!content) {
      throw new RefInlinerError(
        `Cannot inline ref "${ref}": not found in resolved refs`,
        ref
      );
    }

    // If there's a fragment, resolve it within the document
    if (fragment) {
      try {
        content = this.refResolver.resolveFragment(ref, content);
      } catch (error) {
        throw new RefInlinerError(
          `Cannot resolve fragment in ref "${ref}": ${(error as Error).message}`,
          ref,
          error as Error
        );
      }
    }

    // Clone content to avoid mutations
    content = this.deepClone(content);

    // Recursively inline any refs within this content
    return this.inlineRefs(content);
  }

  /**
   * Check if a ref is external (doesn't start with #)
   * @param ref The $ref string
   * @returns True if external
   */
  isExternalRef(ref: string): boolean {
    return !ref.startsWith('#');
  }

  /**
   * Get the resolved content for a ref (for debugging)
   * @param ref The $ref string
   * @returns Resolved content or undefined if not found
   */
  getResolvedRef(ref: string): any | undefined {
    return this.resolvedRefs.get(ref);
  }
}
