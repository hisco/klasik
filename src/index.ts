/**
 * Klasik - TypeScript Code Generator
 *
 * Public API exports
 */

// Core generator
export { Generator } from './generator/generator';
export { GeneratorOptions, GenerationContext } from './builders/class-builder';

// IR types
export * from './ir/types';

// Parsers
export { OpenAPIParser, OpenAPISpec, OpenAPIParserOptions } from './parsers/openapi-parser';
export { CRDParser, ParsedCRD, CRDParserOptions } from './parsers/crd-parser';
export { CRDToIRConverter, CRDToIROptions } from './parsers/crd-to-ir';
export { JsonSchemaParser, JsonSchemaParserOptions } from './parsers/json-schema-parser';

// Loaders
export { SpecLoader, SpecLoaderOptions, LoadWithRefsOptions } from './loaders/spec-loader';
export { RefResolver, RefResolverOptions, RefResolverError } from './loaders/ref-resolver';
export { RefInliner, RefInlinerOptions, RefInlinerError } from './loaders/ref-inliner';

// Builders
export { ClassBuilder } from './builders/class-builder';
export { ImportManager } from './builders/import-manager';

// Plugin system
export {
  GeneratorPlugin,
  PluginRegistry,
  PluginRunner,
} from './plugins/plugin-interface';

// Built-in plugins
export { ClassTransformerPlugin } from './plugins/class-transformer-plugin';
export { NestJSSwaggerPlugin } from './plugins/nestjs-swagger-plugin';
export { ClassValidatorPlugin } from './plugins/class-validator-plugin';

// Utils
export * from './utils/name-utils';

// Configuration
export { Configuration, ConfigurationParameters } from './config/configuration';
