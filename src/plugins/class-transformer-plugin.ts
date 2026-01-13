/**
 * ClassTransformer Plugin
 *
 * Adds class-transformer decorators (@Expose, @Type) to properties
 * This is a base plugin that should always be enabled
 */

import { PropertyDeclaration } from 'ts-morph';
import { GeneratorPlugin } from './plugin-interface';
import {
  SchemaDefinition,
  PropertyDefinition,
  TypeReference,
  SchemaIR,
} from '../ir/types';
import { GenerationContext } from '../builders/class-builder';

export class ClassTransformerPlugin implements GeneratorPlugin {
  name = 'class-transformer';
  priority = 200; // High priority - base decorators

  /**
   * Add class-transformer imports before generation
   * Note: We only add 'Expose' here since it's always used.
   * 'Type' is added conditionally in decorateProperty().
   */
  beforeGeneration(context: GenerationContext, ir: SchemaIR): void {
    context.importManager.addImport('class-transformer', 'Expose');
  }

  /**
   * Decorate property with @Expose() and @Type() decorators
   */
  decorateProperty(
    property: PropertyDeclaration,
    propertyDef: PropertyDefinition,
    schema: SchemaDefinition,
    context: GenerationContext
  ): void {
    // Always add @Expose()
    property.addDecorator({
      name: 'Expose',
      arguments: [],
    });

    // Add @Type() for complex types
    const typeDecorator = this.getTypeDecorator(propertyDef.type);
    if (typeDecorator) {
      context.importManager.addImport('class-transformer', 'Type');
      property.addDecorator({
        name: 'Type',
        arguments: [typeDecorator],
      });
    }
  }

  /**
   * Add class-transformer to package.json dependencies
   */
  modifyPackageJson(packageJson: any, context: GenerationContext): void {
    if (!packageJson.dependencies) {
      packageJson.dependencies = {};
    }

    packageJson.dependencies['class-transformer'] = '^0.5.1';
    packageJson.dependencies['reflect-metadata'] = '^0.2.2';
  }

  /**
   * Get @Type() decorator argument for a type
   * Returns undefined if no @Type() decorator is needed
   */
  private getTypeDecorator(type: TypeReference): string | undefined {
    switch (type.kind) {
      case 'reference':
      case 'object':
        // @Type(() => ClassName)
        if (type.name) {
          return `() => ${type.name}`;
        }
        return undefined;

      case 'array':
        if (!type.elementType) {
          return undefined;
        }
        // For arrays of complex types: @Type(() => ClassName)
        if (type.elementType.kind === 'reference' || type.elementType.kind === 'object') {
          return `() => ${type.elementType.name}`;
        }
        // For arrays of primitives, no @Type() needed
        return undefined;

      case 'dictionary':
        // For dictionaries with complex values
        if (type.additionalProperties &&
            (type.additionalProperties.kind === 'reference' ||
             type.additionalProperties.kind === 'object') &&
            type.additionalProperties.name) {
          return `() => ${type.additionalProperties.name}`;
        }
        return undefined;

      case 'union':
        // For unions, we don't add @Type() decorators
        // This would require more complex handling
        return undefined;

      case 'primitive':
      case 'unknown':
      default:
        return undefined;
    }
  }
}
