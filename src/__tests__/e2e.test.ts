/**
 * End-to-end integration tests
 *
 * Tests the full pipeline: OpenAPI -> IR -> Generated Code
 */

import { Project } from 'ts-morph';
import * as fs from 'fs';
import * as path from 'path';
import { OpenAPIParser, OpenAPISpec } from '../parsers/openapi-parser';
import { Generator } from '../generator/generator';
import { ensureCleanDirectory, robustRemoveDir } from './test-helpers/cleanup-utils';

const TEST_OUTPUT_DIR = path.join(__dirname, '../../test-output');

describe('E2E: Full Generation Pipeline', () => {
  beforeAll(async () => {
    // Clean test output directory using robust cleanup
    await ensureCleanDirectory(TEST_OUTPUT_DIR);
  });

  afterAll(async () => {
    // Clean up test output using robust cleanup
    await robustRemoveDir(TEST_OUTPUT_DIR, { silent: true });
  });

  it('should generate a simple model with class-transformer decorators', async () => {
    const spec: OpenAPISpec = {
      openapi: '3.0.0',
      info: {
        title: 'Test API',
        version: '1.0.0',
      },
      components: {
        schemas: {
          User: {
            type: 'object',
            description: 'A user in the system',
            properties: {
              id: {
                type: 'string',
                description: 'User ID',
              },
              name: {
                type: 'string',
                description: 'User name',
              },
              email: {
                type: 'string',
                format: 'email',
                description: 'User email',
              },
              age: {
                type: 'number',
                minimum: 0,
                maximum: 120,
              },
            },
            required: ['id', 'name'],
          },
        },
      },
    };

    const outputDir = path.join(TEST_OUTPUT_DIR, 'simple-model');

    // Parse OpenAPI to IR
    const parser = new OpenAPIParser();
    const ir = parser.parse(spec);

    // Generate code
    const generator = new Generator({ outputDir });
    await generator.generate(ir);

    // Verify generated files exist
    const userFilePath = path.join(outputDir, 'models', 'user.ts');
    expect(fs.existsSync(userFilePath)).toBe(true);

    // Read generated file
    const userFileContent = fs.readFileSync(userFilePath, 'utf-8');

    // Verify it contains expected content
    expect(userFileContent).toContain('export class User');
    expect(userFileContent).toContain('@Expose()');
    expect(userFileContent).toContain("'id': string");
    expect(userFileContent).toContain("'name': string");
    expect(userFileContent).toContain("'email'?: string");
    expect(userFileContent).toContain("'age'?: number");
    expect(userFileContent).toContain('from "class-transformer"');

    // Verify attributeTypeMap
    expect(userFileContent).toContain('attributeTypeMap');
    expect(userFileContent).toContain('"name": "id"');
    expect(userFileContent).toContain('"type": "string"');

    // Generated code structure looks good
    // (Actual compilation would require installing dependencies in test output dir)
  });

  it('should generate model with NestJS Swagger decorators', async () => {
    const spec: OpenAPISpec = {
      openapi: '3.0.0',
      info: {
        title: 'Test API',
        version: '1.0.0',
      },
      components: {
        schemas: {
          Product: {
            type: 'object',
            description: 'A product',
            properties: {
              id: {
                type: 'string',
                description: 'Product ID',
              },
              name: {
                type: 'string',
                description: 'Product name',
                minLength: 1,
                maxLength: 100,
              },
              price: {
                type: 'number',
                description: 'Product price',
                minimum: 0,
              },
            },
            required: ['id', 'name', 'price'],
          },
        },
      },
    };

    const outputDir = path.join(TEST_OUTPUT_DIR, 'nestjs-model');

    // Parse and generate
    const parser = new OpenAPIParser();
    const ir = parser.parse(spec);

    const generator = new Generator({
      outputDir,
      nestJsSwagger: true,
    });
    await generator.generate(ir);

    // Verify generated file
    const productFilePath = path.join(outputDir, 'models', 'product.ts');
    const productFileContent = fs.readFileSync(productFilePath, 'utf-8');

    // Verify @ApiProperty decorators
    expect(productFileContent).toContain('@ApiProperty');
    expect(productFileContent).toContain('type: String');
    expect(productFileContent).toContain('type: Number');
    expect(productFileContent).toContain('required: true');
    expect(productFileContent).toContain('minimum: 0');
    expect(productFileContent).toContain('minLength: 1');
    expect(productFileContent).toContain('maxLength: 100');

    // Verify imports
    expect(productFileContent).toContain('from "@nestjs/swagger"');
    expect(productFileContent).toContain('from "class-transformer"');

    // Verify package.json has @nestjs/swagger
    const packageJsonPath = path.join(outputDir, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    expect(packageJson.dependencies['@nestjs/swagger']).toBeDefined();
  });

  it('should generate model with class-validator decorators', async () => {
    const spec: OpenAPISpec = {
      openapi: '3.0.0',
      info: {
        title: 'Test API',
        version: '1.0.0',
      },
      components: {
        schemas: {
          Contact: {
            type: 'object',
            properties: {
              email: {
                type: 'string',
                format: 'email',
              },
              age: {
                type: 'number',
                minimum: 18,
                maximum: 100,
              },
              website: {
                type: 'string',
                format: 'uri',
              },
            },
            required: ['email'],
          },
        },
      },
    };

    const outputDir = path.join(TEST_OUTPUT_DIR, 'validator-model');

    // Parse and generate
    const parser = new OpenAPIParser();
    const ir = parser.parse(spec);

    const generator = new Generator({
      outputDir,
      classValidator: true,
    });
    await generator.generate(ir);

    // Verify generated file
    const contactFilePath = path.join(outputDir, 'models', 'contact.ts');
    const contactFileContent = fs.readFileSync(contactFilePath, 'utf-8');

    // Verify class-validator decorators
    expect(contactFileContent).toContain('@IsEmail');
    expect(contactFileContent).toContain('@IsNumber');
    expect(contactFileContent).toContain('@Min(18)');
    expect(contactFileContent).toContain('@Max(100)');
    expect(contactFileContent).toContain('@IsUrl');
    expect(contactFileContent).toContain('@IsOptional');

    // Verify imports
    expect(contactFileContent).toContain('import {');
    expect(contactFileContent).toContain('IsEmail');
    expect(contactFileContent).toContain('IsNumber');
    expect(contactFileContent).toContain('Min');
    expect(contactFileContent).toContain('Max');

    // Verify package.json has class-validator
    const packageJsonPath = path.join(outputDir, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    expect(packageJson.dependencies['class-validator']).toBeDefined();
  });

  it('should generate model with nested references', async () => {
    const spec: OpenAPISpec = {
      openapi: '3.0.0',
      info: {
        title: 'Test API',
        version: '1.0.0',
      },
      components: {
        schemas: {
          Address: {
            type: 'object',
            properties: {
              street: { type: 'string' },
              city: { type: 'string' },
            },
          },
          User: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              address: {
                $ref: '#/components/schemas/Address',
              },
            },
          },
        },
      },
    };

    const outputDir = path.join(TEST_OUTPUT_DIR, 'nested-model');

    // Parse and generate
    const parser = new OpenAPIParser();
    const ir = parser.parse(spec);

    const generator = new Generator({ outputDir });
    await generator.generate(ir);

    // Verify User imports Address
    const userFilePath = path.join(outputDir, 'models', 'user.ts');
    const userFileContent = fs.readFileSync(userFilePath, 'utf-8');

    expect(userFileContent).toContain('from "./address"');
    expect(userFileContent).toContain("'address'?: Address");
    expect(userFileContent).toContain('@Type(() => Address)');
  });

  it('should generate model with array of references', async () => {
    const spec: OpenAPISpec = {
      openapi: '3.0.0',
      info: {
        title: 'Test API',
        version: '1.0.0',
      },
      components: {
        schemas: {
          Tag: {
            type: 'object',
            properties: {
              name: { type: 'string' },
            },
          },
          Post: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              tags: {
                type: 'array',
                items: {
                  $ref: '#/components/schemas/Tag',
                },
              },
            },
          },
        },
      },
    };

    const outputDir = path.join(TEST_OUTPUT_DIR, 'array-model');

    // Parse and generate
    const parser = new OpenAPIParser();
    const ir = parser.parse(spec);

    const generator = new Generator({ outputDir });
    await generator.generate(ir);

    // Verify Post imports Tag and has correct array type
    const postFilePath = path.join(outputDir, 'models', 'post.ts');
    const postFileContent = fs.readFileSync(postFilePath, 'utf-8');

    expect(postFileContent).toContain('from "./tag"');
    expect(postFileContent).toContain("'tags'?: Array<Tag>");
    expect(postFileContent).toContain('@Type(() => Tag)');
  });

  it('should handle ESM mode with .js extensions', async () => {
    const spec: OpenAPISpec = {
      openapi: '3.0.0',
      info: {
        title: 'Test API',
        version: '1.0.0',
      },
      components: {
        schemas: {
          User: {
            type: 'object',
            properties: {
              id: { type: 'string' },
            },
          },
        },
      },
    };

    const outputDir = path.join(TEST_OUTPUT_DIR, 'esm-model');

    // Parse and generate with ESM
    const parser = new OpenAPIParser();
    const ir = parser.parse(spec);

    const generator = new Generator({
      outputDir,
      esm: true,
    });
    await generator.generate(ir);

    // Verify generated file has .js extensions in imports
    const userFilePath = path.join(outputDir, 'models', 'user.ts');
    const userFileContent = fs.readFileSync(userFilePath, 'utf-8');

    expect(userFileContent).toContain('from "class-transformer"'); // External import, no .js

    // Verify package.json has type: module
    const packageJsonPath = path.join(outputDir, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    expect(packageJson.type).toBe('module');

    // Verify index exports have .js extensions
    const indexPath = path.join(outputDir, 'models', 'index.ts');
    const indexContent = fs.readFileSync(indexPath, 'utf-8');
    expect(indexContent).toContain('./user.js');
  });
});
