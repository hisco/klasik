/**
 * Response Transformer
 *
 * Transforms axios responses to class instances using class-transformer.
 * Supports error handling callbacks and validation.
 */

import { plainToInstance, ClassConstructor } from 'class-transformer';
import { validate, ValidationError as ClassValidatorError } from 'class-validator';
import { AxiosResponse } from 'axios';
import { Configuration } from '../config/configuration';

/**
 * Options for response transformation
 */
export interface TransformOptions {
  /**
   * Enable automatic type conversion (default: true)
   */
  enableImplicitConversion?: boolean;

  /**
   * Exclude extraneous properties not defined in the class (default: false)
   */
  excludeExtraneousValues?: boolean;

  /**
   * Enable validation after transformation (requires class-validator decorators)
   */
  validate?: boolean;

  /**
   * Additional class-transformer options
   */
  classTransformerOptions?: any;
}

/**
 * Transform a plain object to a class instance
 *
 * @param modelClass The target class constructor
 * @param data The plain object data
 * @param config Optional configuration with error callback
 * @param options Optional transformation options
 * @returns Instance of the model class
 */
export function transformToInstance<T>(
  modelClass: ClassConstructor<T>,
  data: any,
  config?: Configuration,
  options: TransformOptions = {}
): T {
  try {
    const {
      enableImplicitConversion = true,
      excludeExtraneousValues = false,
      classTransformerOptions = {},
    } = options;

    // Use plainToInstance from class-transformer
    const instance = plainToInstance(modelClass, data, {
      enableImplicitConversion,
      excludeExtraneousValues,
      ...classTransformerOptions,
    }) as T;

    return instance;
  } catch (error) {
    // Call error callback if provided
    if (config?.onTransformationError) {
      config.onTransformationError(error as Error, modelClass, data);
    }

    // Re-throw the error
    throw new TransformationError(
      `Failed to transform data to ${modelClass.name}`,
      modelClass,
      data,
      error as Error
    );
  }
}

/**
 * Transform an array of plain objects to class instances
 *
 * @param modelClass The target class constructor
 * @param dataArray Array of plain objects
 * @param config Optional configuration with error callback
 * @param options Optional transformation options
 * @returns Array of model class instances
 */
export function transformToInstanceArray<T>(
  modelClass: ClassConstructor<T>,
  dataArray: any[],
  config?: Configuration,
  options: TransformOptions = {}
): T[] {
  try {
    if (!Array.isArray(dataArray)) {
      throw new Error('Data must be an array');
    }

    return dataArray.map(item => transformToInstance(modelClass, item, config, options));
  } catch (error) {
    // Call error callback if provided
    if (config?.onTransformationError) {
      config.onTransformationError(error as Error, modelClass, dataArray);
    }

    // Re-throw the error
    throw new TransformationError(
      `Failed to transform array to ${modelClass.name}[]`,
      modelClass,
      dataArray,
      error as Error
    );
  }
}

/**
 * Transform an axios response to a class instance
 *
 * @param modelClass The target class constructor
 * @param response Axios response object
 * @param config Optional configuration with error callback
 * @param options Optional transformation options
 * @returns Instance of the model class
 */
export function transformResponse<T>(
  modelClass: ClassConstructor<T>,
  response: AxiosResponse,
  config?: Configuration,
  options: TransformOptions = {}
): T {
  return transformToInstance(modelClass, response.data, config, options);
}

/**
 * Transform an axios response to an array of class instances
 *
 * @param modelClass The target class constructor
 * @param response Axios response object with array data
 * @param config Optional configuration with error callback
 * @param options Optional transformation options
 * @returns Array of model class instances
 */
export function transformResponseArray<T>(
  modelClass: ClassConstructor<T>,
  response: AxiosResponse,
  config?: Configuration,
  options: TransformOptions = {}
): T[] {
  return transformToInstanceArray(modelClass, response.data, config, options);
}

/**
 * Transform response based on whether data is array or single object
 *
 * @param modelClass The target class constructor
 * @param response Axios response object
 * @param config Optional configuration with error callback
 * @param options Optional transformation options
 * @returns Instance or array of instances
 */
export function transformResponseAuto<T>(
  modelClass: ClassConstructor<T>,
  response: AxiosResponse,
  config?: Configuration,
  options: TransformOptions = {}
): T | T[] {
  const data = response.data;

  if (Array.isArray(data)) {
    return transformToInstanceArray(modelClass, data, config, options);
  } else {
    return transformToInstance(modelClass, data, config, options);
  }
}

/**
 * Custom error class for transformation errors
 */
export class TransformationError extends Error {
  constructor(
    message: string,
    public readonly modelClass: ClassConstructor<any>,
    public readonly data: any,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'TransformationError';

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, TransformationError);
    }
  }
}

/**
 * Custom error class for validation errors
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly modelClass: ClassConstructor<any>,
    public readonly instance: any,
    public readonly validationErrors: ClassValidatorError[]
  ) {
    super(message);
    this.name = 'ValidationError';

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ValidationError);
    }
  }
}

/**
 * Custom error for non-instance request bodies
 */
export class RequestNotInstanceError extends Error {
  constructor(
    message: string,
    public readonly expectedClass: ClassConstructor<any>,
    public readonly receivedValue: any
  ) {
    super(message);
    this.name = 'RequestNotInstanceError';

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, RequestNotInstanceError);
    }
  }
}

/**
 * Validate a class instance using class-validator
 *
 * @param modelClass The class constructor
 * @param instance The instance to validate
 * @param config Optional configuration with error callback
 * @returns The validated instance
 * @throws ValidationError if validation fails and no callback is provided
 */
export async function validateInstance<T>(
  modelClass: ClassConstructor<T>,
  instance: T,
  config?: Configuration
): Promise<T> {
  try {
    const errors = await validate(instance as object);

    if (errors.length > 0) {
      // Call error callback if provided
      if (config?.onResponseValidationError) {
        config.onResponseValidationError(errors, modelClass, instance);
        // Return instance even with errors when callback is provided
        return instance;
      }

      // Throw ValidationError if no callback
      throw new ValidationError(
        `Validation failed for ${modelClass.name}: ${errors.length} error(s)`,
        modelClass,
        instance,
        errors
      );
    }

    return instance;
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }

    // Unexpected error during validation
    if (config?.onResponseValidationError) {
      config.onResponseValidationError([error as any], modelClass, instance);
      return instance;
    }

    throw error;
  }
}

/**
 * Validate an array of class instances
 *
 * @param modelClass The class constructor
 * @param instances Array of instances to validate
 * @param config Optional configuration with error callback
 * @returns The validated instances
 */
export async function validateInstanceArray<T>(
  modelClass: ClassConstructor<T>,
  instances: T[],
  config?: Configuration
): Promise<T[]> {
  // Validate each instance
  const validated = await Promise.all(
    instances.map(instance => validateInstance(modelClass, instance, config))
  );

  return validated;
}

/**
 * Validate request body (check instance + validate)
 *
 * @param modelClass The class constructor
 * @param requestBody The request body to validate
 * @param config Optional configuration with error callback
 * @returns The validated request body
 * @throws RequestNotInstanceError if not an instance
 * @throws ValidationError if validation fails and no callback is provided
 */
export async function validateRequestBody<T>(
  modelClass: ClassConstructor<T>,
  requestBody: any,
  config?: Configuration
): Promise<T> {
  // Check if requestBody is instance of modelClass
  if (!(requestBody instanceof modelClass)) {
    const error = new RequestNotInstanceError(
      `Request body must be an instance of ${modelClass.name}`,
      modelClass,
      requestBody
    );

    if (config?.onRequestValidationError) {
      config.onRequestValidationError([error as any], modelClass, requestBody);
      return requestBody as T;
    }

    throw error;
  }

  // Now validate the instance
  try {
    const errors = await validate(requestBody as object);

    if (errors.length > 0) {
      if (config?.onRequestValidationError) {
        config.onRequestValidationError(errors, modelClass, requestBody);
        return requestBody;
      }

      throw new ValidationError(
        `Request validation failed for ${modelClass.name}: ${errors.length} error(s)`,
        modelClass,
        requestBody,
        errors
      );
    }

    return requestBody;
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }

    if (config?.onRequestValidationError) {
      config.onRequestValidationError([error as any], modelClass, requestBody);
      return requestBody;
    }

    throw error;
  }
}

/**
 * Response transformer factory
 * Creates a transformer bound to a specific configuration
 */
export class ResponseTransformer {
  constructor(private config?: Configuration) {}

  /**
   * Transform response to instance
   */
  transformResponse<T>(
    modelClass: ClassConstructor<T>,
    response: AxiosResponse,
    options?: TransformOptions
  ): T {
    return transformResponse(modelClass, response, this.config, options);
  }

  /**
   * Transform response to instance array
   */
  transformResponseArray<T>(
    modelClass: ClassConstructor<T>,
    response: AxiosResponse,
    options?: TransformOptions
  ): T[] {
    return transformResponseArray(modelClass, response, this.config, options);
  }

  /**
   * Auto-detect and transform response
   */
  transformResponseAuto<T>(
    modelClass: ClassConstructor<T>,
    response: AxiosResponse,
    options?: TransformOptions
  ): T | T[] {
    return transformResponseAuto(modelClass, response, this.config, options);
  }

  /**
   * Transform plain object to instance
   */
  transformToInstance<T>(
    modelClass: ClassConstructor<T>,
    data: any,
    options?: TransformOptions
  ): T {
    return transformToInstance(modelClass, data, this.config, options);
  }

  /**
   * Transform array to instance array
   */
  transformToInstanceArray<T>(
    modelClass: ClassConstructor<T>,
    dataArray: any[],
    options?: TransformOptions
  ): T[] {
    return transformToInstanceArray(modelClass, dataArray, this.config, options);
  }

  /**
   * Validate instance (response validation)
   */
  async validateInstance<T>(modelClass: ClassConstructor<T>, instance: T): Promise<T> {
    return validateInstance(modelClass, instance, this.config);
  }

  /**
   * Validate instance array (response validation)
   */
  async validateInstanceArray<T>(modelClass: ClassConstructor<T>, instances: T[]): Promise<T[]> {
    return validateInstanceArray(modelClass, instances, this.config);
  }

  /**
   * Validate request body (request validation)
   */
  async validateRequestBody<T>(modelClass: ClassConstructor<T>, requestBody: any): Promise<T> {
    return validateRequestBody(modelClass, requestBody, this.config);
  }
}
