/**
 * Configuration for generated API clients
 */
export interface ConfigurationParameters {
  basePath?: string;
  headers?: Record<string, string>;
  timeout?: number;
  enableResponseTransformation?: boolean;
  onTransformationError?: (error: Error, modelClass: any, data: any) => void;

  // Response validation
  enableResponseValidation?: boolean;
  onResponseValidationError?: (errors: any[], modelClass: any, instance: any) => void;

  // Request validation
  enableRequestValidation?: boolean;
  onRequestValidationError?: (errors: any[], modelClass: any, instance: any) => void;
}

/**
 * Configuration class for API client
 */
export class Configuration {
  basePath: string;
  headers: Record<string, string>;
  timeout: number;
  enableResponseTransformation: boolean;
  onTransformationError?: (error: Error, modelClass: any, data: any) => void;

  // Response validation
  enableResponseValidation: boolean;
  onResponseValidationError?: (errors: any[], modelClass: any, instance: any) => void;

  // Request validation
  enableRequestValidation: boolean;
  onRequestValidationError?: (errors: any[], modelClass: any, instance: any) => void;

  constructor(params: ConfigurationParameters = {}) {
    this.basePath = params.basePath || '';
    this.headers = params.headers || {};
    this.timeout = params.timeout || 30000;
    this.enableResponseTransformation = params.enableResponseTransformation ?? true;
    this.onTransformationError = params.onTransformationError;

    // Response validation
    this.enableResponseValidation = params.enableResponseValidation ?? false;
    this.onResponseValidationError = params.onResponseValidationError;

    // Request validation
    this.enableRequestValidation = params.enableRequestValidation ?? false;
    this.onRequestValidationError = params.onRequestValidationError;
  }

  /**
   * Merge headers with existing headers
   */
  mergeHeaders(additionalHeaders: Record<string, string>): Record<string, string> {
    return {
      ...this.headers,
      ...additionalHeaders,
    };
  }

  /**
   * Clone configuration with overrides
   */
  clone(overrides: ConfigurationParameters = {}): Configuration {
    return new Configuration({
      basePath: overrides.basePath ?? this.basePath,
      headers: overrides.headers ? this.mergeHeaders(overrides.headers) : { ...this.headers },
      timeout: overrides.timeout ?? this.timeout,
      enableResponseTransformation: overrides.enableResponseTransformation ?? this.enableResponseTransformation,
      onTransformationError: overrides.onTransformationError ?? this.onTransformationError,
      enableResponseValidation: overrides.enableResponseValidation ?? this.enableResponseValidation,
      onResponseValidationError: overrides.onResponseValidationError ?? this.onResponseValidationError,
      enableRequestValidation: overrides.enableRequestValidation ?? this.enableRequestValidation,
      onRequestValidationError: overrides.onRequestValidationError ?? this.onRequestValidationError,
    });
  }
}
