/**
 * Demo script showing how to use klasik-2
 *
 * Run with: npx ts-node demo.ts
 */

import { OpenAPIParser, OpenAPISpec } from './src/parsers/openapi-parser';
import { Generator } from './src/generator/generator';
import * as path from 'path';

async function main() {
  console.log('🚀 Klasik Demo\n');

  // Example OpenAPI spec
  const spec: OpenAPISpec = {
    openapi: '3.0.0',
    info: {
      title: 'Pet Store API',
      version: '1.0.0',
      description: 'A simple pet store API',
    },
    components: {
      schemas: {
        Pet: {
          type: 'object',
          description: 'A pet in the store',
          properties: {
            id: {
              type: 'string',
              description: 'Pet ID',
              format: 'uuid',
            },
            name: {
              type: 'string',
              description: 'Pet name',
              minLength: 1,
              maxLength: 50,
            },
            species: {
              type: 'string',
              description: 'Type of animal',
              enum: ['dog', 'cat', 'bird', 'fish'],
            },
            age: {
              type: 'number',
              description: 'Pet age in years',
              minimum: 0,
              maximum: 30,
            },
            owner: {
              $ref: '#/components/schemas/Owner',
            },
          },
          required: ['id', 'name', 'species'],
        },
        Owner: {
          type: 'object',
          description: 'Pet owner information',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            name: {
              type: 'string',
              minLength: 1,
            },
            email: {
              type: 'string',
              format: 'email',
            },
            phone: {
              type: 'string',
              pattern: '^\\+?[1-9]\\d{1,14}$',
            },
          },
          required: ['id', 'name', 'email'],
        },
      },
    },
  };

  console.log('📝 Parsing OpenAPI spec...');
  const parser = new OpenAPIParser();
  const ir = parser.parse(spec);

  console.log(`   Found ${ir.schemas.size} schemas: ${Array.from(ir.schemas.keys()).join(', ')}\n`);

  // Generate with all features enabled
  console.log('🔨 Generating TypeScript code with:');
  console.log('   - class-transformer decorators (@Expose, @Type)');
  console.log('   - NestJS Swagger decorators (@ApiProperty)');
  console.log('   - class-validator decorators (@IsString, @Min, etc.)');
  console.log('   - ESM imports (.js extensions)\n');

  const outputDir = path.join(__dirname, 'demo-output');
  const generator = new Generator({
    outputDir,
    nestJsSwagger: true,
    classValidator: true,
    esm: true,
  });

  await generator.generate(ir);

  console.log('\n✨ Generation complete!');
  console.log(`📁 Check the output in: ${outputDir}`);
  console.log('\nGenerated files:');
  console.log('   - models/pet.ts');
  console.log('   - models/owner.ts');
  console.log('   - models/index.ts');
  console.log('   - package.json');
  console.log('   - tsconfig.json');
  console.log('\n💡 Example usage:');
  console.log('```typescript');
  console.log('import { Pet, Owner } from \'./demo-output/models\';');
  console.log('import { plainToInstance } from \'class-transformer\';');
  console.log('import { validate } from \'class-validator\';');
  console.log('');
  console.log('// API response data');
  console.log('const data = {');
  console.log('  id: "123e4567-e89b-41d3-a456-426614174000",');
  console.log('  name: "Buddy",');
  console.log('  species: "dog",');
  console.log('  age: 5,');
  console.log('  owner: {');
  console.log('    id: "223e4567-e89b-41d3-a456-426614174000",');
  console.log('    name: "John Doe",');
  console.log('    email: "john@example.com"');
  console.log('  }');
  console.log('};');
  console.log('');
  console.log('// Transform to class instance');
  console.log('const pet = plainToInstance(Pet, data);');
  console.log('console.log(pet instanceof Pet); // true');
  console.log('');
  console.log('// Validate');
  console.log('const errors = await validate(pet);');
  console.log('if (errors.length === 0) {');
  console.log('  console.log("✅ Valid pet!");');
  console.log('}');
  console.log('```');
}

main().catch(console.error);
