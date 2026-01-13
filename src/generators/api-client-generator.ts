/**
 * API Client Generator
 *
 * Generates full API client with axios integration, grouped by tags
 */

import { Project, SourceFile, ClassDeclaration, MethodDeclaration, Scope, QuoteKind } from 'ts-morph';
import * as fs from 'fs';
import * as path from 'path';
import {
  SchemaIR,
  OperationDefinition,
  ParameterDefinition,
  TypeReference,
  RequestBodyDefinition,
} from '../ir/types';
import { GeneratorOptions } from '../builders/class-builder';
import { toPascalCase, toKebabCase, toCamelCase } from '../utils/name-utils';
import { TSDocGenerator } from './tsdoc-generator';

export interface ApiClientGeneratorOptions extends GeneratorOptions {
  mode?: 'full' | 'models-only';
}

/**
 * Generates API client code from operations
 */
export class ApiClientGenerator {
  private project: Project;
  private options: ApiClientGeneratorOptions;
  private tsDocGenerator: TSDocGenerator;

  constructor(options: ApiClientGeneratorOptions) {
    this.options = options;
    this.project = new Project({
      compilerOptions: {
        target: 99, // ES2020
        module: 99, // ESNext
        declaration: true,
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
      },
      manipulationSettings: {
        quoteKind: QuoteKind.Single,
      },
      useInMemoryFileSystem: false,
    });
    this.tsDocGenerator = new TSDocGenerator();
  }

  /**
   * Generate full API client
   */
  async generateFullClient(ir: SchemaIR): Promise<void> {
    if (ir.operations.size === 0) {
      console.log('No operations found, skipping API client generation');
      return;
    }

    console.log(`Generating API client with ${ir.operations.size} operations...`);

    const apisDir = path.join(this.options.outputDir, 'apis');
    this.ensureDirectory(apisDir);

    // Group operations by tag
    const operationsByTag = this.groupOperationsByTag(ir);

    // Generate API class for each tag
    for (const [tag, operations] of operationsByTag) {
      await this.generateSingleApiClass(tag, operations, apisDir);
    }

    // Generate base API utilities
    await this.generateBaseApi(this.options.outputDir);

    // Generate configuration class
    await this.generateConfiguration(this.options.outputDir);

    // Generate APIs index
    await this.generateApisIndex(operationsByTag, apisDir);

    // Save all files
    await this.project.save();

    console.log('✅ API client generation completed!');
  }

  /**
   * Group operations by tag
   */
  private groupOperationsByTag(ir: SchemaIR): Map<string, OperationDefinition[]> {
    const operationsByTag = new Map<string, OperationDefinition[]>();

    for (const [_, operation] of ir.operations) {
      const tag = operation.tags && operation.tags.length > 0
        ? operation.tags[0]
        : 'default';

      if (!operationsByTag.has(tag)) {
        operationsByTag.set(tag, []);
      }

      operationsByTag.get(tag)!.push(operation);
    }

    return operationsByTag;
  }

  /**
   * Generate a single API class for a tag
   */
  private async generateSingleApiClass(
    tag: string,
    operations: OperationDefinition[],
    apisDir: string
  ): Promise<void> {
    const className = toPascalCase(tag) + 'Api';
    const fileName = toKebabCase(tag) + '-api.ts';
    const filePath = path.join(apisDir, fileName);

    console.log(`Generating ${className}...`);

    const sourceFile = this.project.createSourceFile(filePath, '', { overwrite: true });

    // Add imports
    this.addApiClassImports(sourceFile, operations);

    // Add class
    const classDecl = sourceFile.addClass({
      name: className,
      isExported: true,
      docs: [{
        description: `${className} - API class for ${tag} operations`,
      }],
    });

    // Add protected fields with JSDoc
    classDecl.addProperty({
      name: 'configuration',
      type: 'Configuration',
      scope: Scope.Protected,
      docs: [{
        description: [
          'API client configuration including base path, headers, and transformation settings',
          '',
          '@protected',
          '@type {Configuration}',
        ].join('\n'),
      }],
    });

    classDecl.addProperty({
      name: 'axios',
      type: 'AxiosInstance',
      scope: Scope.Protected,
      docs: [{
        description: [
          'Axios instance for making HTTP requests',
          '',
          '@protected',
          '@type {AxiosInstance}',
        ].join('\n'),
      }],
    });

    // Add constructor with JSDoc
    classDecl.addConstructor({
      parameters: [
        {
          name: 'configuration',
          type: 'Configuration',
        },
        {
          name: 'axios',
          type: 'AxiosInstance',
        },
      ],
      statements: [
        'this.configuration = configuration;',
        'this.axios = axios;',
      ],
      docs: [{
        description: [
          'Create a new API client instance',
          '',
          '@param {Configuration} configuration - API client configuration',
          '@param {AxiosInstance} axios - Axios instance for HTTP requests',
        ].join('\n'),
      }],
    });

    // Add methods for each operation
    for (const operation of operations) {
      this.addApiMethod(classDecl, operation);
    }

    sourceFile.formatText({
      indentSize: 2,
      convertTabsToSpaces: true,
    });
  }

  /**
   * Add imports for API class
   */
  private addApiClassImports(sourceFile: SourceFile, operations: OperationDefinition[]): void {
    // Add axios imports
    sourceFile.addImportDeclaration({
      moduleSpecifier: 'axios',
      namedImports: ['AxiosInstance', 'AxiosResponse', 'RawAxiosRequestConfig'],
    });

    // Add class-transformer import for response transformation
    sourceFile.addImportDeclaration({
      moduleSpecifier: 'class-transformer',
      namedImports: ['plainToInstance'],
    });

    // Add class-validator import for validation
    sourceFile.addImportDeclaration({
      moduleSpecifier: 'class-validator',
      namedImports: ['validate'],
    });

    // Add base imports
    const configPath = this.options.esm ? '../configuration.js' : '../configuration';
    const basePath = this.options.esm ? '../base.js' : '../base';

    sourceFile.addImportDeclaration({
      moduleSpecifier: configPath,
      namedImports: ['Configuration'],
    });

    sourceFile.addImportDeclaration({
      moduleSpecifier: basePath,
      namedImports: ['RequiredError'],
    });

    // Collect model imports
    const modelImports = new Set<string>();
    for (const operation of operations) {
      this.collectModelImports(operation, modelImports);
    }

    // Add model imports
    for (const modelName of modelImports) {
      const modelFileName = toKebabCase(modelName);
      const importPath = this.options.esm
        ? `../models/${modelFileName}.js`
        : `../models/${modelFileName}`;

      sourceFile.addImportDeclaration({
        moduleSpecifier: importPath,
        namedImports: [modelName],
      });
    }
  }

  /**
   * Collect model imports from operation
   */
  private collectModelImports(operation: OperationDefinition, collected: Set<string>): void {
    // From parameters
    for (const param of operation.parameters) {
      this.collectTypeImports(param.type, collected);
    }

    // From request body
    if (operation.requestBody) {
      for (const [_, type] of operation.requestBody.content) {
        this.collectTypeImports(type, collected);
      }
    }

    // From responses
    for (const [_, response] of operation.responses) {
      if (response.content) {
        for (const [_, type] of response.content) {
          this.collectTypeImports(type, collected);
        }
      }
    }
  }

  /**
   * Collect type imports recursively
   */
  private collectTypeImports(type: TypeReference, collected: Set<string>): void {
    switch (type.kind) {
      case 'reference':
      case 'object':
        if (type.name && type.name !== 'object') {
          collected.add(type.name);
        }
        break;

      case 'array':
        if (type.elementType) {
          this.collectTypeImports(type.elementType, collected);
        }
        break;

      case 'union':
        if (type.unionTypes) {
          type.unionTypes.forEach(t => this.collectTypeImports(t, collected));
        }
        break;

      case 'dictionary':
        if (type.additionalProperties) {
          this.collectTypeImports(type.additionalProperties, collected);
        }
        break;
    }
  }

  /**
   * Add API method to class
   */
  private addApiMethod(classDecl: ClassDeclaration, operation: OperationDefinition): void {
    // Use operationId as-is if it's already camelCase, otherwise convert it
    const methodName = this.isAlreadyCamelCase(operation.operationId)
      ? operation.operationId
      : toCamelCase(operation.operationId);

    // Generate method parameters
    const parameters = this.generateMethodParameters(operation);

    // Generate return type
    const returnType = this.generateReturnType(operation);

    // Add JSDoc
    const jsDoc = this.tsDocGenerator.generateMethodDoc(operation);

    // Add method
    const method = classDecl.addMethod({
      name: methodName,
      isAsync: true,
      parameters,
      returnType,
    });

    // Add JSDoc as leading comment
    // Strip /** and */ from the generated JSDoc and pass just the content
    const jsDocContent = jsDoc
      .replace(/^\/\*\*\s*\n?/, '')  // Remove opening /**
      .replace(/\s*\*\/\s*$/, '')     // Remove closing */
      .split('\n')
      .map(line => line.replace(/^\s*\*\s?/, '')) // Remove leading * from each line
      .join('\n');

    method.addJsDoc(jsDocContent);

    // Generate method body
    const body = this.generateMethodBody(operation);
    method.setBodyText(body);
  }

  /**
   * Generate method parameters
   */
  private generateMethodParameters(operation: OperationDefinition): any[] {
    const parameters: any[] = [];

    // Add parameters
    for (const param of operation.parameters) {
      parameters.push({
        name: toCamelCase(param.name),
        type: this.tsDocGenerator.typeReferenceToString(param.type),
        hasQuestionToken: !param.required,
      });
    }

    // Add request body
    if (operation.requestBody) {
      const bodyType = this.getRequestBodyType(operation.requestBody);
      parameters.push({
        name: 'requestBody',
        type: bodyType,
        hasQuestionToken: !operation.requestBody.required,
      });
    }

    // Add options parameter
    parameters.push({
      name: 'options',
      type: 'RawAxiosRequestConfig',
      hasQuestionToken: true,
    });

    return parameters;
  }

  /**
   * Generate return type
   */
  private generateReturnType(operation: OperationDefinition): string {
    const successResponse = operation.responses.get('200') ||
                           operation.responses.get('201') ||
                           operation.responses.get('default');

    if (!successResponse || !successResponse.content || successResponse.content.size === 0) {
      return 'Promise<AxiosResponse<void>>';
    }

    const firstType = successResponse.content.values().next().value as TypeReference;
    const typeStr = this.tsDocGenerator.typeReferenceToString(firstType);

    return `Promise<AxiosResponse<${typeStr}>>`;
  }

  /**
   * Get request body type
   */
  private getRequestBodyType(requestBody: RequestBodyDefinition): string {
    if (requestBody.content.size === 0) {
      return 'any';
    }

    const firstType = requestBody.content.values().next().value as TypeReference;
    return this.tsDocGenerator.typeReferenceToString(firstType);
  }

  /**
   * Get response type information for transformation
   */
  private getResponseTypeInfo(operation: OperationDefinition): {
    hasResponse: boolean;
    isArray: boolean;
    isPrimitive: boolean;
    baseType: string;
    fullType: string;
  } {
    const successResponse = operation.responses.get('200') ||
                           operation.responses.get('201') ||
                           operation.responses.get('default');

    if (!successResponse || !successResponse.content || successResponse.content.size === 0) {
      return {
        hasResponse: false,
        isArray: false,
        isPrimitive: true,
        baseType: 'void',
        fullType: 'void',
      };
    }

    const typeRef = successResponse.content.values().next().value as TypeReference;
    const isArray = typeRef.kind === 'array';
    const baseTypeRef = isArray ? typeRef.elementType! : typeRef;

    // Check if primitive (kind is 'primitive' for string, number, boolean, etc.)
    const isPrimitive = baseTypeRef.kind === 'primitive' ||
                       (baseTypeRef.kind === 'reference' && !baseTypeRef.name) ||
                       (baseTypeRef.name === 'string' || baseTypeRef.name === 'number' ||
                        baseTypeRef.name === 'boolean' || baseTypeRef.name === 'any');

    const baseType = baseTypeRef.kind === 'reference' || baseTypeRef.kind === 'object'
      ? baseTypeRef.name || 'any'
      : this.tsDocGenerator.typeReferenceToString(baseTypeRef);

    const fullType = this.tsDocGenerator.typeReferenceToString(typeRef);

    return {
      hasResponse: true,
      isArray,
      isPrimitive,
      baseType,
      fullType,
    };
  }

  /**
   * Generate method body
   */
  private generateMethodBody(operation: OperationDefinition): string {
    const lines: string[] = [];

    // Validate required parameters
    const requiredParams = operation.parameters.filter(p => p.required);
    if (operation.requestBody?.required) {
      requiredParams.push({
        name: 'requestBody',
        in: 'body' as any,
        required: true,
        type: { kind: 'unknown' as any },
      });
    }

    for (const param of requiredParams) {
      // Don't convert if it's already camelCase (like 'requestBody')
      const paramName = param.name === 'requestBody' ? param.name : toCamelCase(param.name);
      lines.push(`if (${paramName} === null || ${paramName} === undefined) {`);
      lines.push(`  throw new RequiredError('${paramName}', 'Required parameter ${paramName} was null or undefined when calling ${toCamelCase(operation.operationId)}.');`);
      lines.push(`}`);
      lines.push('');
    }

    // Build path
    let pathExpr = `'${operation.path}'`;
    const pathParams = operation.parameters.filter(p => p.in === 'path');
    for (const param of pathParams) {
      const paramName = toCamelCase(param.name);
      pathExpr += `.replace('{${param.name}}', encodeURIComponent(String(${paramName})))`;
    }

    lines.push(`const localVarPath = ${pathExpr};`);
    lines.push(`const localVarUrlObj = new URL(localVarPath, this.configuration.basePath);`);
    lines.push(`const localVarRequestOptions: RawAxiosRequestConfig = { method: '${operation.method}', ...options };`);
    lines.push(`const localVarHeaderParameter = {} as any;`);
    lines.push(`const localVarQueryParameter = {} as any;`);
    lines.push('');

    // Add query parameters
    const queryParams = operation.parameters.filter(p => p.in === 'query');
    if (queryParams.length > 0) {
      for (const param of queryParams) {
        const paramName = toCamelCase(param.name);
        lines.push(`if (${paramName} !== undefined) {`);
        lines.push(`  localVarQueryParameter['${param.name}'] = ${paramName};`);
        lines.push(`}`);
      }
      lines.push('');
    }

    // Add header parameters
    const headerParams = operation.parameters.filter(p => p.in === 'header');
    if (headerParams.length > 0) {
      for (const param of headerParams) {
        const paramName = toCamelCase(param.name);
        lines.push(`if (${paramName} !== undefined && ${paramName} !== null) {`);
        lines.push(`  localVarHeaderParameter['${param.name}'] = String(${paramName});`);
        lines.push(`}`);
      }
      lines.push('');
    }

    // Set content type for request body
    if (operation.requestBody) {
      lines.push(`localVarHeaderParameter['Content-Type'] = 'application/json';`);
      lines.push('');
    }

    // Apply configuration headers
    lines.push(`Object.assign(localVarHeaderParameter, this.configuration.headers);`);
    lines.push('');

    // Set query parameters
    if (queryParams.length > 0) {
      lines.push(`localVarUrlObj.search = new URLSearchParams(localVarQueryParameter).toString();`);
      lines.push('');
    }

    // Set headers and URL
    lines.push(`localVarRequestOptions.headers = localVarHeaderParameter;`);
    lines.push(`localVarRequestOptions.url = localVarUrlObj.toString();`);
    lines.push('');

    // Set request body
    if (operation.requestBody) {
      lines.push(`localVarRequestOptions.data = requestBody;`);
      lines.push('');

      // Add request validation if enabled and requestBody has a type
      const requestBodyType = operation.requestBody ? this.getRequestBodyType(operation.requestBody) : null;
      if (requestBodyType && requestBodyType !== 'any') {
        lines.push(`// Request validation`);
        lines.push(`if (this.configuration.enableRequestValidation === true && requestBody) {`);
        lines.push(`  // Check if requestBody is instance of expected class`);
        lines.push(`  if (!(requestBody instanceof ${requestBodyType})) {`);
        lines.push(`    const error = new Error(\`Request body must be an instance of ${requestBodyType}\`);`);
        lines.push(`    if (this.configuration.onRequestValidationError) {`);
        lines.push(`      this.configuration.onRequestValidationError([error as any], ${requestBodyType}, requestBody);`);
        lines.push(`    } else {`);
        lines.push(`      throw error;`);
        lines.push(`    }`);
        lines.push(`  } else {`);
        lines.push(`    // Validate the instance`);
        lines.push(`    try {`);
        lines.push(`      const errors = await validate(requestBody as object);`);
        lines.push(`      if (errors.length > 0) {`);
        lines.push(`        if (this.configuration.onRequestValidationError) {`);
        lines.push(`          this.configuration.onRequestValidationError(errors, ${requestBodyType}, requestBody);`);
        lines.push(`        } else {`);
        lines.push(`          throw new Error(\`Request validation failed for ${requestBodyType}: \${errors.length} error(s)\`);`);
        lines.push(`        }`);
        lines.push(`      }`);
        lines.push(`    } catch (validationError) {`);
        lines.push(`      if (this.configuration.onRequestValidationError) {`);
        lines.push(`        this.configuration.onRequestValidationError([validationError as any], ${requestBodyType}, requestBody);`);
        lines.push(`      } else {`);
        lines.push(`        throw validationError;`);
        lines.push(`      }`);
        lines.push(`    }`);
        lines.push(`  }`);
        lines.push(`}`);
        lines.push('');
      }
    }

    // Make request with optional response transformation
    const responseInfo = this.getResponseTypeInfo(operation);

    if (!responseInfo.hasResponse || responseInfo.isPrimitive) {
      // No transformation needed for void or primitive types
      lines.push(`return this.axios.request(localVarRequestOptions);`);
    } else {
      // Add transformation logic for non-primitive types
      lines.push(`return this.axios.request(localVarRequestOptions).then(async (response) => {`);
      lines.push(`  // Check if response transformation is enabled (default: true)`);
      lines.push(`  if (this.configuration.enableResponseTransformation !== false) {`);
      lines.push(`    try {`);

      if (responseInfo.isArray) {
        lines.push(`      response.data = plainToInstance(${responseInfo.baseType}, response.data as any[]);`);
      } else {
        lines.push(`      response.data = plainToInstance(${responseInfo.baseType}, response.data);`);
      }

      // Add response validation logic
      lines.push(``);
      lines.push(`      // Response validation`);
      lines.push(`      if (this.configuration.enableResponseValidation === true) {`);
      lines.push(`        try {`);

      if (responseInfo.isArray) {
        lines.push(`          // Validate each instance in array`);
        lines.push(`          const validationPromises = (response.data as any[]).map(async (item) => {`);
        lines.push(`            const errors = await validate(item);`);
        lines.push(`            if (errors.length > 0) {`);
        lines.push(`              if (this.configuration.onResponseValidationError) {`);
        lines.push(`                this.configuration.onResponseValidationError(errors, ${responseInfo.baseType}, item);`);
        lines.push(`              } else {`);
        lines.push(`                throw new Error(\`Validation failed for ${responseInfo.baseType}: \${errors.length} error(s)\`);`);
        lines.push(`              }`);
        lines.push(`            }`);
        lines.push(`            return item;`);
        lines.push(`          });`);
        lines.push(`          await Promise.all(validationPromises);`);
      } else {
        lines.push(`          // Validate single instance`);
        lines.push(`          const errors = await validate(response.data as object);`);
        lines.push(`          if (errors.length > 0) {`);
        lines.push(`            if (this.configuration.onResponseValidationError) {`);
        lines.push(`              this.configuration.onResponseValidationError(errors, ${responseInfo.baseType}, response.data);`);
        lines.push(`            } else {`);
        lines.push(`              throw new Error(\`Validation failed for ${responseInfo.baseType}: \${errors.length} error(s)\`);`);
        lines.push(`            }`);
        lines.push(`          }`);
      }

      lines.push(`        } catch (validationError) {`);
      lines.push(`          // Handle validation errors`);
      lines.push(`          if (this.configuration.onResponseValidationError) {`);
      lines.push(`            this.configuration.onResponseValidationError([validationError as any], ${responseInfo.baseType}, response.data);`);
      lines.push(`          } else {`);
      lines.push(`            throw validationError;`);
      lines.push(`          }`);
      lines.push(`        }`);
      lines.push(`      }`);

      lines.push(`    } catch (error) {`);
      lines.push(`      // Handle transformation errors`);
      lines.push(`      if (this.configuration.onTransformationError) {`);
      lines.push(`        this.configuration.onTransformationError(error as Error, ${responseInfo.baseType}, response.data);`);
      lines.push(`      } else {`);
      lines.push(`        console.error('class-transformer failed to transform response:', error);`);
      lines.push(`        console.error('Returning original response data. To handle this error, provide onTransformationError in Configuration.');`);
      lines.push(`      }`);
      lines.push(`      // Return original data on error (cast for type safety)`);

      if (responseInfo.isArray) {
        lines.push(`      response.data = response.data as any as ${responseInfo.baseType}[];`);
      } else {
        lines.push(`      response.data = response.data as any as ${responseInfo.baseType};`);
      }

      lines.push(`    }`);
      lines.push(`  }`);

      if (responseInfo.isArray) {
        lines.push(`  return response as AxiosResponse<${responseInfo.baseType}[]>;`);
      } else {
        lines.push(`  return response as AxiosResponse<${responseInfo.baseType}>;`);
      }

      lines.push(`});`);
    }

    return lines.join('\n');
  }

  /**
   * Generate base API utilities
   */
  private async generateBaseApi(outputDir: string): Promise<void> {
    const filePath = path.join(outputDir, 'base.ts');
    const sourceFile = this.project.createSourceFile(filePath, '', { overwrite: true });

    sourceFile.addStatements(`/**
 * RequiredError class
 */
export class RequiredError extends Error {
  name: 'RequiredError' = 'RequiredError';

  constructor(public field: string, msg?: string) {
    super(msg);
  }
}

/**
 * Global axios instance
 */
import axios from 'axios';
export const axiosInstance = axios.create();
`);

    sourceFile.formatText({
      indentSize: 2,
      convertTabsToSpaces: true,
    });
  }

  /**
   * Generate Configuration class
   */
  private async generateConfiguration(outputDir: string): Promise<void> {
    const filePath = path.join(outputDir, 'configuration.ts');
    const sourceFile = this.project.createSourceFile(filePath, '', { overwrite: true });

    sourceFile.addStatements(`/**
 * Configuration parameters for API clients
 */
export interface ConfigurationParameters {
  /**
   * Base URL for API requests
   *
   * @type {string}
   * @example 'https://api.example.com'
   */
  basePath?: string;

  /**
   * Custom HTTP headers to include in all requests
   *
   * These headers will be merged with request-specific headers.
   *
   * @type {{ [key: string]: string }}
   * @example { 'Authorization': 'Bearer token123', 'X-API-Key': 'abc123' }
   */
  headers?: { [key: string]: string };

  /**
   * Request timeout in milliseconds
   *
   * @type {number}
   * @default 30000
   * @example 5000
   */
  timeout?: number;

  /**
   * Enable automatic response transformation using plainToInstance
   *
   * When enabled (default), successful API responses are automatically
   * transformed to class instances with proper decorators applied (@Type, @Expose, etc.).
   * This enables runtime type checking and nested object transformation.
   *
   * Set to false if you prefer to work with plain JavaScript objects.
   *
   * @type {boolean}
   * @default true
   */
  enableResponseTransformation?: boolean;

  /**
   * Callback invoked when response transformation fails
   *
   * Use this to implement custom error handling or logging when class-transformer
   * fails to transform a response. If not provided, errors are logged to console
   * and the original response data is returned.
   *
   * @callback onTransformationError
   * @param {Error} error - The transformation error that occurred
   * @param {any} modelClass - The target class for transformation
   * @param {any} data - The original response data that failed to transform
   * @example
   * (error, modelClass, data) => {
   *   console.error(\`Failed to transform to \${modelClass.name}:\`, error);
   *   Sentry.captureException(error);
   * }
   */
  onTransformationError?: (error: Error, modelClass: any, data: any) => void;

  /**
   * Enable automatic response validation using class-validator
   *
   * When enabled, API responses transformed to class instances are automatically
   * validated using class-validator decorators (@IsString, @IsEmail, @Min, etc.).
   * Validation only works if:
   * 1. enableResponseTransformation is true (validation requires class instances)
   * 2. Models were generated with the classValidator plugin enabled
   *
   * If validation fails, the onResponseValidationError callback is invoked (if provided),
   * or a ValidationError is thrown by default.
   *
   * @type {boolean}
   * @default false
   */
  enableResponseValidation?: boolean;

  /**
   * Callback invoked when response validation fails
   *
   * Use this to implement custom error handling or logging when class-validator
   * detects validation errors. If not provided, a ValidationError is thrown.
   *
   * @callback onResponseValidationError
   * @param {any[]} errors - Array of validation errors from class-validator
   * @param {any} modelClass - The class that failed validation
   * @param {any} instance - The class instance that failed validation
   * @example
   * (errors, modelClass, instance) => {
   *   console.error(\`Validation failed for \${modelClass.name}:\`, errors);
   *   Sentry.captureException(new Error('API response validation failed'));
   * }
   */
  onResponseValidationError?: (errors: any[], modelClass: any, instance: any) => void;

  /**
   * Enable automatic request validation using class-validator
   *
   * When enabled, request bodies are validated before being sent to the server:
   * 1. Checks if request body is an instance of the expected class
   * 2. Validates using class-validator decorators
   *
   * Validation only works if models were generated with the classValidator plugin enabled.
   *
   * If validation fails, the onRequestValidationError callback is invoked (if provided),
   * or a ValidationError is thrown by default.
   *
   * @type {boolean}
   * @default false
   */
  enableRequestValidation?: boolean;

  /**
   * Callback invoked when request validation fails
   *
   * Use this to implement custom error handling or logging when class-validator
   * detects validation errors in request bodies. If not provided, a ValidationError is thrown.
   *
   * @callback onRequestValidationError
   * @param {any[]} errors - Array of validation errors from class-validator
   * @param {any} modelClass - The class that failed validation
   * @param {any} instance - The request body instance that failed validation
   * @example
   * (errors, modelClass, instance) => {
   *   console.error(\`Request validation failed for \${modelClass.name}:\`, errors);
   *   // Fix the instance or log the error
   * }
   */
  onRequestValidationError?: (errors: any[], modelClass: any, instance: any) => void;
}

/**
 * Configuration class for API clients
 */
export class Configuration {
  /**
   * Base URL for API requests
   * @type {string}
   */
  basePath: string;

  /**
   * Custom HTTP headers included in all requests
   * @type {{ [key: string]: string }}
   */
  headers: { [key: string]: string };

  /**
   * Request timeout in milliseconds
   * @type {number}
   */
  timeout: number;

  /**
   * Enable automatic response transformation
   * @type {boolean}
   */
  enableResponseTransformation: boolean;

  /**
   * Transformation error callback
   * @type {((error: Error, modelClass: any, data: any) => void) | undefined}
   */
  onTransformationError?: (error: Error, modelClass: any, data: any) => void;

  /**
   * Enable automatic response validation
   * @type {boolean}
   */
  enableResponseValidation: boolean;

  /**
   * Response validation error callback
   * @type {((errors: any[], modelClass: any, instance: any) => void) | undefined}
   */
  onResponseValidationError?: (errors: any[], modelClass: any, instance: any) => void;

  /**
   * Enable automatic request validation
   * @type {boolean}
   */
  enableRequestValidation: boolean;

  /**
   * Request validation error callback
   * @type {((errors: any[], modelClass: any, instance: any) => void) | undefined}
   */
  onRequestValidationError?: (errors: any[], modelClass: any, instance: any) => void;

  /**
   * Create a new Configuration instance
   *
   * @constructor
   * @param {ConfigurationParameters} params - Configuration parameters
   * @param {string} params.basePath - Base URL for API requests (default: '')
   * @param {{ [key: string]: string }} params.headers - Custom HTTP headers (default: {})
   * @param {number} params.timeout - Request timeout in milliseconds (default: 30000)
   * @param {boolean} params.enableResponseTransformation - Enable response transformation (default: true)
   * @param {function} params.onTransformationError - Transformation error callback (default: undefined)
   * @param {boolean} params.enableResponseValidation - Enable response validation (default: false)
   * @param {function} params.onResponseValidationError - Response validation error callback (default: undefined)
   * @param {boolean} params.enableRequestValidation - Enable request validation (default: false)
   * @param {function} params.onRequestValidationError - Request validation error callback (default: undefined)
   *
   * @example
   * const config = new Configuration({
   *   basePath: 'https://api.example.com',
   *   headers: { 'Authorization': 'Bearer token' },
   *   timeout: 5000,
   *   enableResponseTransformation: true,
   *   enableResponseValidation: true,
   *   enableRequestValidation: true
   * });
   */
  constructor(params: ConfigurationParameters = {}) {
    this.basePath = params.basePath || '';
    this.headers = params.headers || {};
    this.timeout = params.timeout || 30000;
    this.enableResponseTransformation = params.enableResponseTransformation ?? true;
    this.onTransformationError = params.onTransformationError;
    this.enableResponseValidation = params.enableResponseValidation ?? false;
    this.onResponseValidationError = params.onResponseValidationError;
    this.enableRequestValidation = params.enableRequestValidation ?? false;
    this.onRequestValidationError = params.onRequestValidationError;
  }
}
`);

    sourceFile.formatText({
      indentSize: 2,
      convertTabsToSpaces: true,
    });
  }

  /**
   * Generate APIs index file
   */
  private async generateApisIndex(
    operationsByTag: Map<string, OperationDefinition[]>,
    apisDir: string
  ): Promise<void> {
    const indexPath = path.join(apisDir, 'index.ts');
    const sourceFile = this.project.createSourceFile(indexPath, '', { overwrite: true });

    // Export each API class
    const tags = Array.from(operationsByTag.keys()).sort();
    for (const tag of tags) {
      const fileName = toKebabCase(tag) + '-api';
      const importPath = this.options.esm ? `./${fileName}.js` : `./${fileName}`;

      sourceFile.addExportDeclaration({
        moduleSpecifier: importPath,
      });
    }

    sourceFile.formatText({
      indentSize: 2,
      convertTabsToSpaces: true,
    });
  }

  /**
   * Ensure directory exists
   */
  private ensureDirectory(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Check if a string is already in camelCase format
   */
  private isAlreadyCamelCase(str: string): boolean {
    // Check if string starts with lowercase and contains no underscores/hyphens
    return /^[a-z][a-zA-Z0-9]*$/.test(str);
  }
}
