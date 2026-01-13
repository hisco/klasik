import { ApiProperty } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";
import { IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength, ValidateNested } from "class-validator";
import { Owner } from "./owner.js";

/** A pet in the store */
export class Pet {
  /** Pet ID */
  @Expose()
  @ApiProperty({
    type: String,
    description: `Pet ID`,
    required: true,
    format: `uuid`
  })
  @IsString()
  @IsUUID()
  'id': string;
  /** Pet name */
  @Expose()
  @ApiProperty({
    type: String,
    description: `Pet name`,
    required: true,
    minLength: 1,
    maxLength: 50
  })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  'name': string;
  /** Type of animal */
  @Expose()
  @ApiProperty({
    type: String,
    description: `Type of animal`,
    required: true,
    enum: ["dog", "cat", "bird", "fish"]
  })
  @IsString()
  'species': string;
  /** Pet age in years */
  @Expose()
  @ApiProperty({
    type: Number,
    description: `Pet age in years`,
    required: false,
    minimum: 0,
    maximum: 30
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(30)
  'age'?: number;
  @Expose()
  @Type(() => Owner)
  @ApiProperty({
    type: () => Owner,
    required: false
  })
  @IsOptional()
  @ValidateNested()
  'owner'?: Owner;
  public static readonly attributeTypeMap: Array<{ name: string, baseName: string, type: string, format: string, description?: string, vendorExtensions?: any, modelClass?: any }> = [
    {
      "name": "id",
      "baseName": "id",
      "type": "string",
      "format": "uuid",
      "description": "Pet ID",
      "vendorExtensions": {}
    },
    {
      "name": "name",
      "baseName": "name",
      "type": "string",
      "format": "",
      "description": "Pet name",
      "vendorExtensions": {}
    },
    {
      "name": "species",
      "baseName": "species",
      "type": "string",
      "format": "",
      "description": "Type of animal",
      "vendorExtensions": {}
    },
    {
      "name": "age",
      "baseName": "age",
      "type": "number",
      "format": "",
      "description": "Pet age in years",
      "vendorExtensions": {}
    },
    {
      "name": "owner",
      "baseName": "owner",
      "type": "Owner",
      "format": "",
      "vendorExtensions": {},
      "modelClass": "Owner"
    }
  ];
}
