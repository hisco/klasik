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

        // Add validation for arrays of objects or enums
        if (type.elementType &&
            (type.elementType.kind === 'reference' || type.elementType.kind === 'object')) {
          if (type.elementType.name && context.enumSchemaNames?.has(type.elementType.name)) {
            // Arrays of enums: use @IsEnum(EnumType, { each: true })
            context.importManager.addImport('class-validator', 'IsEnum');
            property.addDecorator({
              name: 'IsEnum',
              arguments: [type.elementType.name, '{ each: true }'],
            });
          } else {
            // Arrays of objects: use @ValidateNested({ each: true })
            context.importManager.addImport('class-validator', 'ValidateNested');
            property.addDecorator({
              name: 'ValidateNested',
              arguments: ['{ each: true }'],
            });
          }
        }
        break;

      case 'reference':
      case 'object':
        // For enum references, use @IsEnum() instead of @ValidateNested()
        if (type.name && context.enumSchemaNames?.has(type.name)) {
          context.importManager.addImport('class-validator', 'IsEnum');
          property.addDecorator({ name: 'IsEnum', arguments: [type.name] });
        } else {
          // For nested objects
          context.importManager.addImport('class-validator', 'ValidateNested');
          property.addDecorator({ name: 'ValidateNested', arguments: [] });
        }
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
   *
   * Maps OpenAPI format values to appropriate class-validator decorators.
   * See: https://swagger.io/docs/specification/data-models/data-types/
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
      // String formats
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

      // Date formats - use IsDateString/IsISO8601 for string types (OpenAPI date-time is always a string)
      case 'date':
      case 'date-time':
        context.importManager.addImport('class-validator', 'IsDateString');
        property.addDecorator({ name: 'IsDateString', arguments: [] });
        break;

      // Binary/encoded formats
      case 'byte':
        // Base64-encoded string
        context.importManager.addImport('class-validator', 'IsBase64');
        property.addDecorator({ name: 'IsBase64', arguments: [] });
        break;

      case 'binary':
        // Binary data - no specific string validator needed
        // This is typically handled as file upload, not validated as string
        break;

      // Network formats
      case 'hostname':
        context.importManager.addImport('class-validator', 'IsFQDN');
        property.addDecorator({ name: 'IsFQDN', arguments: [] });
        break;

      case 'ipv4':
        context.importManager.addImport('class-validator', 'IsIP');
        property.addDecorator({ name: 'IsIP', arguments: ["'4'"] });
        break;

      case 'ipv6':
        context.importManager.addImport('class-validator', 'IsIP');
        property.addDecorator({ name: 'IsIP', arguments: ["'6'"] });
        break;

      // Integer formats (for number types)
      case 'int32':
      case 'int64':
        context.importManager.addImport('class-validator', 'IsInt');
        property.addDecorator({ name: 'IsInt', arguments: [] });
        break;

      // Float formats - @IsNumber is already added by type validator
      case 'float':
      case 'double':
        // No additional decorator needed - @IsNumber covers this
        break;

      // Password hint - no validation beyond string type
      case 'password':
        // Just a hint for UI/docs, no special validation
        break;
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
