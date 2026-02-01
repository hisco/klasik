/**
 * Swagger 2.0 to OpenAPI 3.0 Converter
 *
 * Transparently converts Swagger 2.0 specs to OpenAPI 3.0 format
 * using the swagger2openapi library.
 */

import { convertObj } from 'swagger2openapi';

export class SwaggerConversionError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'SwaggerConversionError';
  }
}

export interface SwaggerConverterOptions {
  /** Apply automatic fixes during conversion (default: true) */
  patch?: boolean;
}

export class SwaggerConverter {
  /**
   * Check if a spec is Swagger 2.0 format
   * @param spec The loaded spec object
   * @returns true if spec has swagger: "2.0" property
   */
  static isSwagger2(spec: unknown): boolean {
    return (
      typeof spec === 'object' &&
      spec !== null &&
      'swagger' in spec &&
      (spec as Record<string, unknown>).swagger === '2.0'
    );
  }

  /**
   * Check if a spec is OpenAPI 3.x format
   * @param spec The loaded spec object
   * @returns true if spec has openapi property starting with "3."
   */
  static isOpenAPI3(spec: unknown): boolean {
    if (typeof spec !== 'object' || spec === null) return false;
    const openapi = (spec as Record<string, unknown>).openapi;
    return typeof openapi === 'string' && openapi.startsWith('3.');
  }

  /**
   * Convert Swagger 2.0 spec to OpenAPI 3.0
   * @param swagger The Swagger 2.0 spec object
   * @param options Conversion options
   * @returns Converted OpenAPI 3.0 spec
   */
  async convert(
    swagger: unknown,
    options: SwaggerConverterOptions = {}
  ): Promise<unknown> {
    const { patch = true } = options;

    if (!SwaggerConverter.isSwagger2(swagger)) {
      throw new SwaggerConversionError(
        'Spec is not a valid Swagger 2.0 document (missing swagger: "2.0" property)'
      );
    }

    try {
      const result = await convertObj(swagger, {
        patch,
        warnOnly: true,
      });

      return result.openapi;
    } catch (error) {
      throw new SwaggerConversionError(
        `Failed to convert Swagger 2.0 to OpenAPI 3.0: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * Convert spec if it's Swagger 2.0, otherwise return as-is
   * @param spec The loaded spec (Swagger 2.0 or OpenAPI 3.0)
   * @param options Conversion options
   * @returns OpenAPI 3.0 spec (converted or original)
   */
  async convertIfNeeded(
    spec: unknown,
    options: SwaggerConverterOptions = {}
  ): Promise<{ spec: unknown; wasConverted: boolean }> {
    if (SwaggerConverter.isSwagger2(spec)) {
      const converted = await this.convert(spec, options);
      return { spec: converted, wasConverted: true };
    }

    return { spec, wasConverted: false };
  }
}
