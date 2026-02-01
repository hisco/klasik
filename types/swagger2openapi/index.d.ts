/**
 * Type declarations for swagger2openapi
 */

declare module 'swagger2openapi' {
  export interface ConvertOptions {
    /** Apply automatic fixes during conversion */
    patch?: boolean;
    /** Only warn on errors instead of throwing */
    warnOnly?: boolean;
    /** Return the result directly without validation */
    direct?: boolean;
    /** Resolve external references */
    resolve?: boolean;
    /** Source URL for resolving relative refs */
    source?: string;
    /** Base path for resolving relative refs */
    origin?: string;
  }

  export interface ConvertResult {
    /** The converted OpenAPI 3.0 specification */
    openapi: unknown;
  }

  /**
   * Convert a Swagger 2.0 object to OpenAPI 3.0
   * @param swagger The Swagger 2.0 specification object
   * @param options Conversion options
   * @returns Promise resolving to the conversion result
   */
  export function convertObj(
    swagger: unknown,
    options?: ConvertOptions
  ): Promise<ConvertResult>;

  /**
   * Convert a Swagger 2.0 file to OpenAPI 3.0
   * @param filename Path to the Swagger 2.0 file
   * @param options Conversion options
   * @returns Promise resolving to the conversion result
   */
  export function convertFile(
    filename: string,
    options?: ConvertOptions
  ): Promise<ConvertResult>;

  /**
   * Convert a Swagger 2.0 URL to OpenAPI 3.0
   * @param url URL to the Swagger 2.0 specification
   * @param options Conversion options
   * @returns Promise resolving to the conversion result
   */
  export function convertUrl(
    url: string,
    options?: ConvertOptions
  ): Promise<ConvertResult>;

  /**
   * Convert a Swagger 2.0 string to OpenAPI 3.0
   * @param str String containing the Swagger 2.0 specification
   * @param options Conversion options
   * @returns Promise resolving to the conversion result
   */
  export function convertStr(
    str: string,
    options?: ConvertOptions
  ): Promise<ConvertResult>;
}
