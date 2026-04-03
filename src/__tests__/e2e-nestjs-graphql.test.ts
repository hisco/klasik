/**
 * E2E Tests for NestJS GraphQL Plugin
 *
 * Tests the complete pipeline:
 * 1. Generate TypeScript classes with @ObjectType/@Field decorators from OpenAPI spec
 * 2. Verify generated file contents (text assertions)
 * 3. Compile the generated code with tsc
 * 4. Build a GraphQL schema from the generated classes
 * 5. Introspect the schema to verify all types, fields, nullability, descriptions, and deprecation
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { OpenAPIParser } from '../parsers/openapi-parser';
import { Generator } from '../generator/generator';
import { ensureCleanDirectory } from './test-helpers/cleanup-utils';

const TEST_OUTPUT_DIR = path.join(__dirname, '../../test-output/e2e-nestjs-graphql');
const MODELS_DIR = path.join(TEST_OUTPUT_DIR, 'models');

// OpenAPI spec with diverse schema types for testing GraphQL generation
const graphqlTestSpec = {
  openapi: '3.0.0',
  info: {
    title: 'GraphQL Test API',
    version: '1.0.0',
    description: 'API for testing NestJS GraphQL plugin generation',
  },
  paths: {},
  components: {
    schemas: {
      User: {
        type: 'object',
        description: 'A user entity in the system',
        required: ['id', 'name', 'active'],
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Unique identifier',
          },
          name: {
            type: 'string',
            description: 'Full name of the user',
          },
          email: {
            type: 'string',
            format: 'email',
            description: 'Email address',
          },
          age: {
            type: 'integer',
            format: 'int32',
            description: 'Age in years',
          },
          score: {
            type: 'number',
            format: 'float',
            description: 'User score',
          },
          active: {
            type: 'boolean',
            description: 'Whether user is active',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'User tags',
          },
          address: {
            $ref: '#/components/schemas/Address',
          },
          friends: {
            type: 'array',
            items: { $ref: '#/components/schemas/User' },
            description: 'List of friends',
          },
          legacyField: {
            type: 'string',
            deprecated: true,
            description: 'This field is deprecated',
          },
          metadata: {
            type: 'object',
            additionalProperties: {
              type: 'string',
            },
            description: 'Arbitrary key-value metadata',
          },
        },
      },
      Address: {
        type: 'object',
        description: 'A physical address',
        required: ['street', 'city'],
        properties: {
          street: {
            type: 'string',
            description: 'Street address',
          },
          city: {
            type: 'string',
            description: 'City name',
          },
          zipCode: {
            type: 'string',
            pattern: '^\\d{5}$',
            description: 'ZIP code',
          },
        },
      },
    },
  },
};

describe('E2E: NestJS GraphQL Plugin', () => {
  beforeAll(async () => {
    await ensureCleanDirectory(TEST_OUTPUT_DIR);
  });

  it('should generate, compile, and introspect GraphQL schema from OpenAPI spec', async () => {
    // Step 1: Parse OpenAPI spec
    const parser = new OpenAPIParser();
    const ir = parser.parse(graphqlTestSpec, { includeOperations: false });
    expect(ir.schemas.size).toBeGreaterThanOrEqual(2);

    // Step 2: Generate code with nestJsGraphql enabled
    const generator = new Generator({
      outputDir: TEST_OUTPUT_DIR,
      nestJsGraphql: true,
      esm: false,
      mode: 'models-only',
    });
    await generator.generate(ir);

    // Step 3: Verify generated file contents
    const userFile = path.join(MODELS_DIR, 'user.ts');
    const addressFile = path.join(MODELS_DIR, 'address.ts');
    expect(fs.existsSync(userFile)).toBe(true);
    expect(fs.existsSync(addressFile)).toBe(true);

    const userContent = fs.readFileSync(userFile, 'utf-8');
    const addressContent = fs.readFileSync(addressFile, 'utf-8');

    // Verify imports
    expect(userContent).toContain('from "@nestjs/graphql"');
    expect(userContent).toContain('from "graphql-scalars"');
    expect(addressContent).toContain('from "@nestjs/graphql"');

    // Verify @ObjectType class decorator
    expect(userContent).toContain('@ObjectType');
    expect(userContent).toContain('description: `A user entity in the system`');
    expect(addressContent).toContain('@ObjectType');
    expect(addressContent).toContain('description: `A physical address`');

    // Verify @Field decorators with correct types
    // ID for uuid format
    expect(userContent).toContain('() => ID');
    expect(userContent).toContain('import { Field, Float, ID, Int, ObjectType }');

    // Int for int32 format
    expect(userContent).toContain('() => Int');

    // Float for float format
    expect(userContent).toContain('() => Float');

    // Boolean
    expect(userContent).toContain('() => Boolean');

    // String
    expect(userContent).toContain('() => String');

    // Array of strings
    expect(userContent).toContain('() => [String]');

    // Array of references
    expect(userContent).toContain('() => [User]');

    // Reference type
    expect(userContent).toContain('() => Address');

    // GraphQLJSON for dictionary type (metadata)
    expect(userContent).toContain('() => GraphQLJSON');

    // Nullable fields (not required)
    expect(userContent).toContain('nullable: true');

    // Descriptions preserved
    expect(userContent).toContain('description: `Full name of the user`');
    expect(userContent).toContain('description: `Unique identifier`');

    // Deprecated fields have deprecationReason
    expect(userContent).toContain('deprecationReason: `Deprecated`');

    // Verify Address fields
    expect(addressContent).toContain('() => String');
    expect(addressContent).toContain('description: `Street address`');

    // Step 4: Verify package.json has @nestjs/graphql
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(TEST_OUTPUT_DIR, 'package.json'), 'utf-8')
    );
    expect(packageJson.dependencies['@nestjs/graphql']).toBe('^12.0.0');
    expect(packageJson.dependencies['graphql-scalars']).toBe('^1.23.0');
    expect(packageJson.dependencies['class-transformer']).toBeDefined();

    // Step 5: Install dependencies and compile
    // Add extra deps needed for compilation and schema building
    packageJson.dependencies['@nestjs/common'] = '^10.0.0';
    packageJson.dependencies['@nestjs/core'] = '^10.0.0';
    packageJson.dependencies['graphql'] = '^16.0.0';
    packageJson.dependencies['reflect-metadata'] = '^0.2.0';
    packageJson.dependencies['rxjs'] = '^7.0.0';
    packageJson.dependencies['@apollo/server'] = '^4.0.0';
    fs.writeFileSync(
      path.join(TEST_OUTPUT_DIR, 'package.json'),
      JSON.stringify(packageJson, null, 2) + '\n',
      'utf-8'
    );

    execSync('npm install --silent 2>&1', {
      cwd: TEST_OUTPUT_DIR,
      stdio: 'pipe',
      timeout: 120000,
    });

    // Compile TypeScript
    execSync('npx tsc --skipLibCheck', {
      cwd: TEST_OUTPUT_DIR,
      stdio: 'pipe',
      timeout: 60000,
    });

    // Step 6: Build metadata introspection script
    // Uses @nestjs/graphql's internal metadata storage to verify all decorators
    const metadataScript = `
require('reflect-metadata');

// Import generated models to trigger decorator registration
const User = require('./dist/user').User;
const Address = require('./dist/address').Address;

// Load lazy metadata (required for @nestjs/graphql v12+)
const { LazyMetadataStorage } = require('@nestjs/graphql/dist/schema-builder/storages/lazy-metadata.storage');
LazyMetadataStorage.load();

// Access the metadata storage
const { TypeMetadataStorage } = require('@nestjs/graphql/dist/schema-builder/storages/type-metadata.storage');

// Get object types
const objectTypes = TypeMetadataStorage.getObjectTypesMetadata();

// Get fields via internal collection
const collection = TypeMetadataStorage.metadataByTargetCollection;

function getFields(target) {
  const meta = collection.get(target);
  if (!meta || !meta.fields) return [];
  const fields = meta.fields.getAll ? meta.fields.getAll() : [];
  if (fields.length > 0) return fields;
  // Fallback: try internalCollection
  if (meta.fields.internalCollection instanceof Map) {
    return Array.from(meta.fields.internalCollection.values());
  }
  return [];
}

const result = {
  objectTypes: objectTypes.map(ot => ({
    name: ot.name,
    description: ot.description,
    target: ot.target.name,
  })),
  fields: {},
};

// Get fields for User
const userFields = getFields(User);
result.fields['User'] = userFields.map(f => ({
  name: f.name,
  typeFn: f.typeFn ? (() => { try { const r = f.typeFn(); return r.name || String(r); } catch(e) { return null; } })() : null,
  options: f.options || {},
}));

// Get fields for Address
const addressFields = getFields(Address);
result.fields['Address'] = addressFields.map(f => ({
  name: f.name,
  typeFn: f.typeFn ? (() => { try { const r = f.typeFn(); return r.name || String(r); } catch(e) { return null; } })() : null,
  options: f.options || {},
}));

console.log(JSON.stringify(result, null, 2));
`;

    // Write and execute the metadata introspection script
    const scriptPath = path.join(TEST_OUTPUT_DIR, 'introspect.js');
    fs.writeFileSync(scriptPath, metadataScript, 'utf-8');

    const introspectionOutput = execSync('node introspect.js', {
      cwd: TEST_OUTPUT_DIR,
      stdio: 'pipe',
      timeout: 30000,
    }).toString();

    const metadata = JSON.parse(introspectionOutput);

    // Verify object types are registered
    const objectTypeNames = metadata.objectTypes.map((ot: any) => ot.target);
    expect(objectTypeNames).toContain('User');
    expect(objectTypeNames).toContain('Address');

    // Verify User description
    const userType = metadata.objectTypes.find((ot: any) => ot.target === 'User');
    expect(userType.description).toBe('A user entity in the system');

    // Verify Address description
    const addressType = metadata.objectTypes.find((ot: any) => ot.target === 'Address');
    expect(addressType.description).toBe('A physical address');

    // Verify User fields
    const userFields = metadata.fields['User'];
    expect(userFields).toBeDefined();
    expect(userFields.length).toBeGreaterThan(0);

    const userFieldNames = userFields.map((f: any) => f.name);
    // These fields should have @Field decorators
    expect(userFieldNames).toContain('id');
    expect(userFieldNames).toContain('name');
    expect(userFieldNames).toContain('email');
    expect(userFieldNames).toContain('age');
    expect(userFieldNames).toContain('score');
    expect(userFieldNames).toContain('active');
    expect(userFieldNames).toContain('tags');
    expect(userFieldNames).toContain('address');
    expect(userFieldNames).toContain('friends');
    expect(userFieldNames).toContain('legacyField');

    // metadata (dictionary type) should have @Field with GraphQLJSON
    expect(userFieldNames).toContain('metadata');

    // Verify field types
    const idField = userFields.find((f: any) => f.name === 'id');
    expect(idField.typeFn).toBe('ID');

    const ageField = userFields.find((f: any) => f.name === 'age');
    expect(ageField.typeFn).toBe('Int');

    const activeField = userFields.find((f: any) => f.name === 'active');
    expect(activeField.typeFn).toBe('Boolean');

    const metadataField = userFields.find((f: any) => f.name === 'metadata');
    // GraphQLJSON is a GraphQLScalarType with name 'JSON'
    expect(metadataField.typeFn).toBe('JSON');

    // Verify nullable options
    const emailField = userFields.find((f: any) => f.name === 'email');
    expect(emailField.options.nullable).toBe(true);

    // Required fields should not be nullable
    const nameField = userFields.find((f: any) => f.name === 'name');
    expect(nameField.options.nullable).toBeFalsy();

    // Verify descriptions
    expect(nameField.options.description).toBe('Full name of the user');
    expect(idField.options.description).toBe('Unique identifier');

    // Verify deprecation
    const legacyField = userFields.find((f: any) => f.name === 'legacyField');
    expect(legacyField.options.deprecationReason).toBe('Deprecated');

    // Verify Address fields
    const addressFields = metadata.fields['Address'];
    expect(addressFields).toBeDefined();
    const addressFieldNames = addressFields.map((f: any) => f.name);
    expect(addressFieldNames).toContain('street');
    expect(addressFieldNames).toContain('city');
    expect(addressFieldNames).toContain('zipCode');

    // street is required
    const streetField = addressFields.find((f: any) => f.name === 'street');
    expect(streetField.options.nullable).toBeFalsy();

    // zipCode is optional
    const zipField = addressFields.find((f: any) => f.name === 'zipCode');
    expect(zipField.options.nullable).toBe(true);
  }, 180000); // 3 minute timeout for npm install + compile
});
