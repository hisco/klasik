/**
 * Generic CRD (CustomResourceDefinition) Parser
 * - Parses Kubernetes CRDs
 * - Validates CRD structure dynamically
 * - Extracts metadata, versions, and schemas
 * - No hardcoded assumptions about specific CRDs
 * - Works with any valid CRD
 */

export interface CRDMetadata {
  /** CRD name (e.g., "applications.argoproj.io") */
  name: string;
  /** Group (e.g., "argoproj.io") */
  group: string;
  /** Kind (e.g., "Application") */
  kind: string;
  /** Singular name (e.g., "application") */
  singular?: string;
  /** Plural name (e.g., "applications") */
  plural?: string;
  /** Short names (e.g., ["app", "apps"]) */
  shortNames?: string[];
  /** Categories (e.g., ["all"]) */
  categories?: string[];
}

export interface CRDVersion {
  /** Version name (e.g., "v1alpha1", "v1") */
  name: string;
  /** Whether this version is served by the API server */
  served: boolean;
  /** Whether this version is the storage version */
  storage: boolean;
  /** OpenAPI v3 schema for this version */
  schema?: any;
  /** Additional printer columns */
  additionalPrinterColumns?: any[];
  /** Subresources (status, scale) */
  subresources?: {
    status?: {};
    scale?: any;
  };
}

export interface ParsedCRD {
  /** API version of the CRD itself (e.g., "apiextensions.k8s.io/v1") */
  apiVersion: string;
  /** Kind (always "CustomResourceDefinition") */
  kind: string;
  /** CRD metadata */
  metadata: CRDMetadata;
  /** Spec version (e.g., "v1", "v1beta1") */
  specVersion: string;
  /** All versions defined in this CRD */
  versions: CRDVersion[];
  /** Storage version name */
  storageVersion: string;
  /** Map of version name → OpenAPI v3 schema */
  schemas: Map<string, any>;
  /** Whether this CRD has a status subresource */
  hasStatus: boolean;
}

export interface CRDParserOptions {
  /** Include status subresource in generated models (default: true) */
  includeStatus?: boolean;
  /** Strict validation mode (default: false) */
  strict?: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Generic CRD parser
 * Validates and extracts information from Kubernetes CRDs
 */
export class CRDParser {
  /**
   * Parse CRD(s) from content (single document or multi-document YAML)
   * @param content String content or parsed object(s)
   * @param options Parser options
   * @returns Array of parsed CRDs
   */
  parse(content: string | any | any[], options: CRDParserOptions = {}): ParsedCRD[] {
    // Normalize input to array
    const crds = Array.isArray(content) ? content : [content];

    const result: ParsedCRD[] = [];

    for (const crd of crds) {
      // Validate
      const validation = this.validateCRD(crd, options.strict || false);
      if (!validation.valid) {
        if (options.strict) {
          throw new Error(
            `Invalid CRD: ${validation.errors.join(', ')}`
          );
        }
        // Skip invalid CRDs in non-strict mode
        continue;
      }

      // Parse
      const parsed = this.parseSingleCRD(crd, options);
      result.push(parsed);
    }

    return result;
  }

  /**
   * Validate CRD structure dynamically
   * @param crd CRD object to validate
   * @param strict Strict mode (throw on missing optional fields)
   * @returns Validation result
   */
  validateCRD(crd: any, strict: boolean = false): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if object
    if (!crd || typeof crd !== 'object') {
      errors.push('CRD must be an object');
      return { valid: false, errors, warnings };
    }

    // Check kind
    if (crd.kind !== 'CustomResourceDefinition') {
      errors.push(`Expected kind "CustomResourceDefinition", got "${crd.kind}"`);
    }

    // Check apiVersion
    if (!crd.apiVersion || typeof crd.apiVersion !== 'string') {
      errors.push('Missing or invalid apiVersion');
    } else if (!crd.apiVersion.includes('apiextensions.k8s.io')) {
      warnings.push(`Unexpected apiVersion: ${crd.apiVersion}`);
    }

    // Check metadata
    if (!crd.metadata || typeof crd.metadata !== 'object') {
      errors.push('Missing or invalid metadata');
    } else {
      if (!crd.metadata.name || typeof crd.metadata.name !== 'string') {
        errors.push('Missing or invalid metadata.name');
      }
    }

    // Check spec
    if (!crd.spec || typeof crd.spec !== 'object') {
      errors.push('Missing or invalid spec');
    } else {
      // Check group
      if (!crd.spec.group || typeof crd.spec.group !== 'string') {
        errors.push('Missing or invalid spec.group');
      }

      // Check names
      if (!crd.spec.names || typeof crd.spec.names !== 'object') {
        errors.push('Missing or invalid spec.names');
      } else {
        if (!crd.spec.names.kind || typeof crd.spec.names.kind !== 'string') {
          errors.push('Missing or invalid spec.names.kind');
        }
        if (!crd.spec.names.plural || typeof crd.spec.names.plural !== 'string') {
          errors.push('Missing or invalid spec.names.plural');
        }
      }

      // Check versions (must have at least one)
      if (!Array.isArray(crd.spec.versions) || crd.spec.versions.length === 0) {
        errors.push('Missing or empty spec.versions');
      } else {
        // Validate each version
        for (let i = 0; i < crd.spec.versions.length; i++) {
          const version = crd.spec.versions[i];
          if (!version.name || typeof version.name !== 'string') {
            errors.push(`Version ${i}: missing or invalid name`);
          }
          if (typeof version.served !== 'boolean') {
            warnings.push(`Version ${i} (${version.name}): missing or invalid served flag`);
          }
          if (typeof version.storage !== 'boolean') {
            warnings.push(`Version ${i} (${version.name}): missing or invalid storage flag`);
          }
        }

        // Check that exactly one version has storage: true
        const storageVersions = crd.spec.versions.filter((v: any) => v.storage === true);
        if (storageVersions.length === 0) {
          errors.push('No version marked as storage version');
        } else if (storageVersions.length > 1) {
          errors.push('Multiple versions marked as storage version');
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Parse a single CRD
   * @param crd CRD object
   * @param options Parser options
   * @returns Parsed CRD
   */
  private parseSingleCRD(crd: any, options: CRDParserOptions): ParsedCRD {
    // Extract metadata
    const metadata = this.extractMetadata(crd);

    // Determine spec version (v1 vs v1beta1)
    const specVersion = this.getSpecVersion(crd);

    // Extract versions
    const versions = this.extractVersions(crd, specVersion);

    // Find storage version
    const storageVersion = this.findStorageVersion(crd);

    // Extract schemas for each version
    const schemas = new Map<string, any>();
    for (const version of versions) {
      if (version.schema) {
        schemas.set(version.name, version.schema);
      }
    }

    // Check for status subresource
    const hasStatus = this.hasStatusSubresource(crd);

    return {
      apiVersion: crd.apiVersion,
      kind: crd.kind,
      metadata,
      specVersion,
      versions,
      storageVersion,
      schemas,
      hasStatus,
    };
  }

  /**
   * Extract metadata from CRD
   * @param crd CRD object
   * @returns CRD metadata
   */
  extractMetadata(crd: any): CRDMetadata {
    const spec = crd.spec;
    const names = spec.names;

    return {
      name: crd.metadata.name,
      group: spec.group,
      kind: names.kind,
      singular: names.singular,
      plural: names.plural,
      shortNames: names.shortNames,
      categories: names.categories,
    };
  }

  /**
   * Get CRD spec version (v1 or v1beta1)
   * @param crd CRD object
   * @returns Spec version
   */
  private getSpecVersion(crd: any): string {
    const apiVersion = crd.apiVersion;
    if (apiVersion.includes('/v1beta1')) {
      return 'v1beta1';
    }
    return 'v1';
  }

  /**
   * Extract versions from CRD
   * @param crd CRD object
   * @param specVersion CRD spec version (v1 or v1beta1)
   * @returns Array of versions
   */
  private extractVersions(crd: any, specVersion: string): CRDVersion[] {
    const spec = crd.spec;
    const versions: CRDVersion[] = [];

    // v1: spec.versions[]
    // v1beta1: spec.versions[] or spec.version (single version)
    if (Array.isArray(spec.versions)) {
      for (const version of spec.versions) {
        versions.push(this.extractVersion(version, specVersion));
      }
    } else if (specVersion === 'v1beta1' && spec.version) {
      // v1beta1 single version mode
      versions.push({
        name: spec.version,
        served: true,
        storage: true,
        schema: this.extractSchema(spec, specVersion),
        subresources: spec.subresources,
      });
    }

    return versions;
  }

  /**
   * Extract a single version
   * @param version Version object from CRD
   * @param specVersion CRD spec version
   * @returns Parsed version
   */
  private extractVersion(version: any, specVersion: string): CRDVersion {
    return {
      name: version.name,
      served: version.served !== false, // Default to true
      storage: version.storage === true,
      schema: this.extractSchema(version, specVersion),
      additionalPrinterColumns: version.additionalPrinterColumns,
      subresources: version.subresources,
    };
  }

  /**
   * Extract OpenAPI schema from version or spec
   * @param obj Version or spec object
   * @param specVersion CRD spec version
   * @returns OpenAPI v3 schema or undefined
   */
  private extractSchema(obj: any, specVersion: string): any | undefined {
    // v1: version.schema.openAPIV3Schema
    // v1beta1: version.schema.openAPIV3Schema or spec.validation.openAPIV3Schema
    if (obj.schema?.openAPIV3Schema) {
      return obj.schema.openAPIV3Schema;
    }

    // v1beta1 fallback
    if (specVersion === 'v1beta1' && obj.validation?.openAPIV3Schema) {
      return obj.validation.openAPIV3Schema;
    }

    return undefined;
  }

  /**
   * Find storage version name
   * @param crd CRD object
   * @returns Storage version name
   */
  findStorageVersion(crd: any): string {
    const spec = crd.spec;

    if (Array.isArray(spec.versions)) {
      const storageVersion = spec.versions.find((v: any) => v.storage === true);
      return storageVersion?.name || spec.versions[0]?.name || 'v1';
    }

    // v1beta1 single version
    return spec.version || 'v1';
  }

  /**
   * Check if CRD has status subresource
   * @param crd CRD object
   * @param versionName Optional version name to check (checks all if not specified)
   * @returns True if any version has status subresource
   */
  hasStatusSubresource(crd: any, versionName?: string): boolean {
    const spec = crd.spec;

    // Check specific version
    if (versionName && Array.isArray(spec.versions)) {
      const version = spec.versions.find((v: any) => v.name === versionName);
      if (version) {
        return version.subresources?.status !== undefined;
      }
      return false;
    }

    // Check all versions
    if (Array.isArray(spec.versions)) {
      return spec.versions.some((v: any) => v.subresources?.status !== undefined);
    }

    // v1beta1 single version
    return spec.subresources?.status !== undefined;
  }
}
