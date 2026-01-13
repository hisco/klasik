import { ApiProperty } from "@nestjs/swagger";
import { Expose } from "class-transformer";
import { IsEmail, IsOptional, IsString, IsUUID, Matches, MinLength } from "class-validator";

/** Pet owner information */
export class Owner {
  @Expose()
  @ApiProperty({
    type: String,
    required: true,
    format: `uuid`
  })
  @IsString()
  @IsUUID()
  'id': string;
  @Expose()
  @ApiProperty({
    type: String,
    required: true,
    minLength: 1
  })
  @IsString()
  @MinLength(1)
  'name': string;
  @Expose()
  @ApiProperty({
    type: String,
    required: true,
    format: `email`
  })
  @IsString()
  @IsEmail()
  'email': string;
  @Expose()
  @ApiProperty({
    type: String,
    required: false,
    pattern: `^\+?[1-9]\d{1,14}$`
  })
  @IsOptional()
  @IsString()
  @Matches(/^\\+?[1-9]\\d{1,14}$/)
  'phone'?: string;
  public static readonly attributeTypeMap: Array<{ name: string, baseName: string, type: string, format: string, description?: string, vendorExtensions?: any, modelClass?: any }> = [
    {
      "name": "id",
      "baseName": "id",
      "type": "string",
      "format": "uuid",
      "vendorExtensions": {}
    },
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
      "name": "phone",
      "baseName": "phone",
      "type": "string",
      "format": "",
      "vendorExtensions": {}
    }
  ];
}
