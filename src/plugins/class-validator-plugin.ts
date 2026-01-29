/**
 * Class Validator Plugin
 *
 * Adds class-validator decorators for runtime validation
 * (@IsString, @IsNumber, @IsOptional, @Min, @Max, etc.)
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

export class ClassValidatorPlugin implements GeneratorPlugin {
  name = 'class-validator';
  priority = 90; // Medium priority, after NestJS but before ESM

  /**
   * Note: We don't add imports upfront anymore. Instead, we add them
   * as decorators are used in decorateProperty(). This prevents unused imports.
   */

  /**
   * Decorate property with validation decorators
   */
  decorateProperty(
    property: PropertyDeclaration,
    propertyDef: PropertyDefinition,
    schema: SchemaDefinition,
    context: GenerationContext
  ): void {
    // @IsOptional() for optional properties
    if (!propertyDef.required) {
      context.importManager.addImport('class-validator', 'IsOptional');
      property.addDecorator({
        name: 'IsOptional',
        arguments: [],
      });
    }

    // Type validation decorators
    this.addTypeValidators(property, propertyDef, context);

    // Format-based validators (email, url, uuid, etc.)
    this.addFormatValidators(property, propertyDef, context);

    // Constraint validators (min, max, length, pattern, etc.)
    this.addConstraintValidators(property, propertyDef, context);
  }

  /**
   * Add class-validator to package.json
   */
  modifyPackageJson(packageJson: any, context: GenerationContext): void {
    if (!packageJson.dependencies) {
      packageJson.dependencies = {};
    }

    packageJson.dependencies['class-validator'] = '^0.14.0';
    packageJson.dependencies['class-transformer'] = '^0.5.1';
  }

  /**
   * Add type validation decorators based on property type
   */
  private addTypeValidators(
    property: PropertyDeclaration,
    propertyDef: PropertyDefinition,
    context: GenerationContext
  ): void {
    const type = propertyDef.type;

    switch (type.kind) {
      case 'primitive':
        this.addPrimitiveValidator(property, type.name!, context);
        break;

      case 'array':
        context.importManager.addImport('class-validator', 'IsArray');
        property.addDecorator({ name: 'IsArray', arguments: [] });

        // Add @ValidateNested({ each: true }) for arrays of objects
        if (type.elementType &&
            (type.elementType.kind === 'reference' || type.elementType.kind === 'object')) {
          context.importManager.addImport('class-validator', 'ValidateNested');
          property.addDecorator({
            name: 'ValidateNested',
            arguments: ['{ each: true }'],
          });

          // Also need @Type() which is added by ClassTransformerPlugin
        }
        break;

      case 'reference':
      case 'object':
        // For nested objects
        context.importManager.addImport('class-validator', 'ValidateNested');
        property.addDecorator({ name: 'ValidateNested', arguments: [] });
        break;

      case 'dictionary':
        // Dictionaries are just objects
        context.importManager.addImport('class-validator', 'IsObject');
        property.addDecorator({ name: 'IsObject', arguments: [] });
        break;

      case 'union':
        // For unions, we can't add specific type validators
        // Just mark as optional if needed (already done above)
        break;

      case 'unknown':
      default:
        // No specific validator
        break;
    }
  }

  /**
   * Add primitive type validators
   */
  private addPrimitiveValidator(
    property: PropertyDeclaration,
    typeName: string,
    context: GenerationContext
  ): void {
    switch (typeName) {
      case 'string':
        context.importManager.addImport('class-validator', 'IsString');
        property.addDecorator({ name: 'IsString', arguments: [] });
        break;

      case 'number':
        context.importManager.addImport('class-validator', 'IsNumber');
        property.addDecorator({ name: 'IsNumber', arguments: [] });
        break;

      case 'boolean':
        context.importManager.addImport('class-validator', 'IsBoolean');
        property.addDecorator({ name: 'IsBoolean', arguments: [] });
        break;
    }
  }

  /**
   * Add format-based validators (email, url, uuid, etc.)
   */
  private addFormatValidators(
    property: PropertyDeclaration,
    propertyDef: PropertyDefinition,
    context: GenerationContext
  ): void {
    if (!propertyDef.format) {
      return;
    }

    switch (propertyDef.format.toLowerCase()) {
      case 'email':
        context.importManager.addImport('class-validator', 'IsEmail');
        property.addDecorator({ name: 'IsEmail', arguments: [] });
        break;

      case 'uri':
      case 'url':
        context.importManager.addImport('class-validator', 'IsUrl');
        property.addDecorator({ name: 'IsUrl', arguments: [] });
        break;

      case 'uuid':
        context.importManager.addImport('class-validator', 'IsUUID');
        property.addDecorator({ name: 'IsUUID', arguments: [] });
        break;

      case 'date':
      case 'date-time':
        context.importManager.addImport('class-validator', 'IsDate');
        property.addDecorator({ name: 'IsDate', arguments: [] });
        break;

      // Other formats could be added here
    }
  }

  /**
   * Add constraint validators (min, max, length, pattern, etc.)
   */
  private addConstraintValidators(
    property: PropertyDeclaration,
    propertyDef: PropertyDefinition,
    context: GenerationContext
  ): void {
    const constraints = propertyDef.constraints;
    if (!constraints) {
      return;
    }

    // Numeric constraints
    if (constraints.minimum !== undefined) {
      context.importManager.addImport('class-validator', 'Min');
      property.addDecorator({
        name: 'Min',
        arguments: [constraints.minimum.toString()],
      });
    }

    if (constraints.maximum !== undefined) {
      context.importManager.addImport('class-validator', 'Max');
      property.addDecorator({
        name: 'Max',
        arguments: [constraints.maximum.toString()],
      });
    }

    // String length constraints
    if (constraints.minLength !== undefined) {
      context.importManager.addImport('class-validator', 'MinLength');
      property.addDecorator({
        name: 'MinLength',
        arguments: [constraints.minLength.toString()],
      });
    }

    if (constraints.maxLength !== undefined) {
      context.importManager.addImport('class-validator', 'MaxLength');
      property.addDecorator({
        name: 'MaxLength',
        arguments: [constraints.maxLength.toString()],
      });
    }

    // Pattern (regex) constraint
    if (constraints.pattern) {
      context.importManager.addImport('class-validator', 'Matches');

      // Check if pattern contains '/' which would need escaping in regex literal
      // Using new RegExp() is safer as it avoids:
      // 1. '/' being interpreted as regex delimiter
      // 2. '//' being interpreted as a comment
      if (constraints.pattern.includes('/')) {
        // Use new RegExp() constructor to avoid delimiter issues
        // Escape backslashes for string literal and escape single quotes
        const escapedPattern = constraints.pattern
          .replace(/\\/g, '\\\\')
          .replace(/'/g, "\\'");
        property.addDecorator({
          name: 'Matches',
          arguments: [`new RegExp('${escapedPattern}')`],
        });
      } else {
        // Use regex literal for simple patterns without '/'
        const pattern = constraints.pattern.replace(/'/g, "\\'");
        property.addDecorator({
          name: 'Matches',
          arguments: [`/${pattern}/`],
        });
      }
    }

    // Array constraints
    if (constraints.minItems !== undefined) {
      context.importManager.addImport('class-validator', 'ArrayMinSize');
      property.addDecorator({
        name: 'ArrayMinSize',
        arguments: [constraints.minItems.toString()],
      });
    }

    if (constraints.maxItems !== undefined) {
      context.importManager.addImport('class-validator', 'ArrayMaxSize');
      property.addDecorator({
        name: 'ArrayMaxSize',
        arguments: [constraints.maxItems.toString()],
      });
    }

    if (constraints.uniqueItems) {
      context.importManager.addImport('class-validator', 'ArrayUnique');
      property.addDecorator({
        name: 'ArrayUnique',
        arguments: [],
      });
    }
  }
}
