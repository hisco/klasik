import { Option } from 'commander';

/**
 * Shared CLI option builders
 */

/**
 * URL option builder
 */
export function urlOption(description: string, required = true): Option {
  const option = new Option('-u, --url <url>', description);
  if (required) {
    option.makeOptionMandatory();
  }
  return option;
}

/**
 * Output option builder
 */
export function outputOption(description: string, required = true): Option {
  const option = new Option('-o, --output <path>', description);
  if (required) {
    option.makeOptionMandatory();
  }
  return option;
}

/**
 * Header option builder (repeatable)
 */
export function headerOption(): Option {
  return new Option('--header <header>', 'Custom header in format "Key: Value" (repeatable)');
}

/**
 * Timeout option builder
 */
export function timeoutOption(): Option {
  return new Option('--timeout <ms>', 'Request timeout in milliseconds')
    .default(30000)
    .argParser((value: string) => {
      const parsed = parseInt(value, 10);
      if (isNaN(parsed) || parsed <= 0) {
        throw new Error('Timeout must be a positive number');
      }
      return parsed;
    });
}

/**
 * ESM option builder
 */
export function esmOption(): Option {
  return new Option('--esm', 'Add .js extensions for ESM compatibility').default(false);
}

/**
 * NestJS Swagger option builder
 */
export function nestjsSwaggerOption(): Option {
  return new Option('--nestjs-swagger', 'Add @ApiProperty decorators for NestJS').default(false);
}

/**
 * Class Validator option builder
 */
export function classValidatorOption(): Option {
  return new Option('--class-validator', 'Add class-validator decorators').default(false);
}

/**
 * Template directory option builder
 */
export function templateOption(): Option {
  return new Option('--template <dir>', 'Custom template directory');
}

/**
 * Keep spec option builder
 */
export function keepSpecOption(): Option {
  return new Option('--keep-spec', 'Keep downloaded spec file(s)').default(false);
}

/**
 * Resolve refs option builder
 */
export function resolveRefsOption(): Option {
  return new Option('--resolve-refs', 'Resolve external $ref files').default(false);
}

/**
 * Export style option builder
 */
export function exportStyleOption(): Option {
  return new Option('--export-style <style>', 'Export style: namespace, direct, both, none')
    .choices(['namespace', 'direct', 'both', 'none'])
    .default('namespace');
}

/**
 * Skip JS extensions option builder
 */
export function skipJsExtensionsOption(): Option {
  return new Option('--skip-js-extensions', 'Skip adding .js extensions (for bundlers)').default(false);
}

/**
 * Bare mode option builder
 */
export function bareOption(): Option {
  return new Option('--bare', 'Generate models directly in output directory (models-only mode)').default(false);
}

/**
 * CRD kind case option builder
 */
export function crdKindCaseOption(): Option {
  return new Option('--crd-kind-case <format>', 'Folder naming format for CRD kinds')
    .choices(['pascal', 'snake', 'kebab'])
    .default('pascal');
}

/**
 * Include status option builder (for CRDs)
 */
export function includeStatusOption(): Option {
  return new Option('--include-status', 'Generate status schemas for CRDs').default(false);
}

/**
 * Parse headers from string array
 * Format: "Key: Value"
 */
export function parseHeaders(headers: string[]): Record<string, string> {
  const result: Record<string, string> = {};

  for (const header of headers) {
    const colonIndex = header.indexOf(':');

    if (colonIndex === -1) {
      throw new Error(`Invalid header format: "${header}". Expected format: "Key: Value"`);
    }

    const key = header.substring(0, colonIndex).trim();
    const value = header.substring(colonIndex + 1).trim();

    if (!key) {
      throw new Error(`Invalid header format: "${header}". Header key cannot be empty`);
    }

    result[key] = value;
  }

  return result;
}

/**
 * Collect values for repeatable options
 */
export function collectValues(value: string, previous: string[]): string[] {
  return previous.concat([value]);
}

/**
 * Validate timeout value
 */
export function validateTimeout(value: string): number {
  const parsed = parseInt(value, 10);

  if (isNaN(parsed)) {
    throw new Error(`Invalid timeout value: "${value}". Must be a number`);
  }

  if (parsed <= 0) {
    throw new Error(`Invalid timeout value: ${parsed}. Must be greater than 0`);
  }

  if (parsed > 600000) {
    throw new Error(`Invalid timeout value: ${parsed}. Maximum allowed is 600000ms (10 minutes)`);
  }

  return parsed;
}
