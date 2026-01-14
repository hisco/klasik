import { Ajv } from "ajv";
import { addFormats } from "ajv-formats";
import { Expose } from "class-transformer";

export class simple_test {
  /**
   * Get JSON Schema for simple_test
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
        "price": {
          "type": "number",
          "minimum": 0
        },
        "inStock": {
          "type": "boolean"
        }
      },
      "additionalProperties": false,
      "required": [
        "name",
        "price"
      ]
    };
  }

  private static _ajvInstance: Ajv | null = null;
  private static _compiledValidator: any = null;

  /** Get or create Ajv instance for simple_test */
  private static getAjvInstance(): Ajv {
    if (!this._ajvInstance) {
      this._ajvInstance = new Ajv({ allErrors: true, strict: false });
      addFormats(this._ajvInstance);
    }
    return this._ajvInstance;
  }

  /** Get or create compiled validator for simple_test (cached for performance) */
  private static getCompiledValidator(): any {
    if (!this._compiledValidator) {
      const ajv = this.getAjvInstance();
      const schema = this.getSchema();
      this._compiledValidator = ajv.compile(schema);
    }
    return this._compiledValidator;
  }

  /**
   * Validate data against JSON Schema with recursive nested validation
   * @param data - Data to validate
   * @returns Validation result with errors if any
   */
  static validateWithJsonSchema(data: unknown): { valid: boolean; errors: any[] } {
    const validate = this.getCompiledValidator();
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
   * @memberof simple_test
   * @required
   * @minLength 1
   */
  @Expose()
  'name': string;
  /**
   * @type {number}
   * @memberof simple_test
   * @required
   * @minimum 0
   */
  @Expose()
  'price': number;
  /**
   * @type {boolean}
   * @memberof simple_test
   */
  @Expose()
  'inStock'?: boolean;
  /**
   * Metadata for serialization and deserialization
   *
   * Maps property names to their types and formats for runtime transformation.
   * Used by class-transformer and validation frameworks.
   *
   * @static
   * @readonly
   * @memberof simple_test
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
      "name": "price",
      "baseName": "price",
      "type": "number",
      "format": "",
      "vendorExtensions": {}
    },
    {
      "name": "inStock",
      "baseName": "inStock",
      "type": "boolean",
      "format": "",
      "vendorExtensions": {}
    }
  ];
}
