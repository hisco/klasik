import { Ajv } from "ajv";
import { addFormats } from "ajv-formats";
import { Expose } from "class-transformer";

export class test_schema {
  /**
   * Get JSON Schema for test_schema
   * @returns JSON Schema Draft 2020-12
   */
  static getSchema(): object {
    return {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "name": {
          "type": "string",
          "minLength": 1,
          "maxLength": 100
        },
        "email": {
          "type": "string",
          "format": "email"
        },
        "age": {
          "type": "number",
          "minimum": 0,
          "maximum": 150
        }
      },
      "additionalProperties": false,
      "required": [
        "name",
        "email"
      ]
    };
  }

  private static _ajvInstance: Ajv | null = null;

  /** Get or create Ajv instance for test_schema */
  private static getAjvInstance(): Ajv {
    if (!this._ajvInstance) {
      this._ajvInstance = new Ajv({ allErrors: true, strict: false });
      addFormats(this._ajvInstance);
    }
    return this._ajvInstance;
  }

  /**
   * Validate data against JSON Schema
   * @param data - Data to validate
   * @returns Validation result with errors if any
   */
  static validateWithJsonSchema(data: unknown): { valid: boolean; errors: any[] } {
    const ajv = this.getAjvInstance();
    const schema = this.getSchema();
    const validate = ajv.compile(schema);
    const valid = validate(data);
    return { valid, errors: validate.errors || [] };
  }

  /**
   * @type {string}
   * @memberof test_schema
   * @required
   * @minLength 1
   * @maxLength 100
   */
  @Expose()
  'name': string;
  /**
   * @type {string}
   * @memberof test_schema
   * @required
   * @format email
   */
  @Expose()
  'email': string;
  /**
   * @type {number}
   * @memberof test_schema
   * @minimum 0
   * @maximum 150
   */
  @Expose()
  'age'?: number;
  /**
   * Metadata for serialization and deserialization
   *
   * Maps property names to their types and formats for runtime transformation.
   * Used by class-transformer and validation frameworks.
   *
   * @static
   * @readonly
   * @memberof test_schema
   */
  public static readonly attributeTypeMap: Array<{ name: string, baseName: string, type: string, format: string, description?: string, vendorExtensions?: any, modelClass?: any }> = [
    {
      "name": "name",
      "baseName": "name",
      "type": "string",
      "format": "",
      "vendorExtensions": {}
    },
    {
      "name": "email",
      "baseName": "email",
      "type": "string",
      "format": "email",
      "vendorExtensions": {}
    },
    {
      "name": "age",
      "baseName": "age",
      "type": "number",
      "format": "",
      "vendorExtensions": {}
    }
  ];
}
