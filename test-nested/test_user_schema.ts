import { Ajv } from "ajv";
import { addFormats } from "ajv-formats";
import { Expose } from "class-transformer";

export class test_user_schema {
  /**
   * Get JSON Schema for test_user_schema
   * @returns JSON Schema Draft 2020-12
   */
  static getSchema(): object {
    return {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "name": {
          "type": "string",
          "minLength": 1
        },
        "email": {
          "type": "string",
          "format": "email"
        },
        "address": {}
      },
      "additionalProperties": false,
      "required": [
        "name",
        "email"
      ]
    };
  }

  private static _ajvInstance: Ajv | null = null;

  /** Get or create Ajv instance for test_user_schema */
  private static getAjvInstance(): Ajv {
    if (!this._ajvInstance) {
      this._ajvInstance = new Ajv({ allErrors: true, strict: false });
      addFormats(this._ajvInstance);
    }
    return this._ajvInstance;
  }

  /**
   * Validate data against JSON Schema with recursive nested validation
   * @param data - Data to validate
   * @returns Validation result with errors if any
   */
  static validateWithJsonSchema(data: unknown): { valid: boolean; errors: any[] } {
    const ajv = this.getAjvInstance();
    const schema = this.getSchema();
    const validate = ajv.compile(schema);
    const valid = validate(data);

    // Collect errors
    const allErrors: any[] = validate.errors || [];

    // Recursively validate nested objects that have validateWithJsonSchema method
    if (valid && typeof data === "object" && data !== null) {
      for (const [key, value] of Object.entries(data)) {
        if (value && typeof value === "object") {
          // Check if the value's constructor has validateWithJsonSchema
          const constructor = (value as any).constructor;
          if (constructor && typeof constructor.validateWithJsonSchema === "function") {
            const nestedResult = constructor.validateWithJsonSchema(value);
            if (!nestedResult.valid) {
              allErrors.push(...nestedResult.errors.map((e: any) => ({
                ...e,
                instancePath: `/${key}${e.instancePath || ""}`
              })));
            }
          }
        }
      }
    }

    return { valid: allErrors.length === 0, errors: allErrors };
  }

  /**
   * @type {string}
   * @memberof test_user_schema
   * @required
   * @minLength 1
   */
  @Expose()
  'name': string;
  /**
   * @type {string}
   * @memberof test_user_schema
   * @required
   * @format email
   */
  @Expose()
  'email': string;
  /**
   * @type {any}
   * @memberof test_user_schema
   */
  @Expose()
  'address'?: unknown;
  /**
   * Metadata for serialization and deserialization
   *
   * Maps property names to their types and formats for runtime transformation.
   * Used by class-transformer and validation frameworks.
   *
   * @static
   * @readonly
   * @memberof test_user_schema
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
      "name": "address",
      "baseName": "address",
      "type": "object",
      "format": "",
      "vendorExtensions": {}
    }
  ];
}
