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

// OpenAPI spec with enum schemas for testing enum generation
const enumTestSpec = {
  openapi: '3.0.0',
  info: { title: 'Enum Test API', version: '1.0.0' },
  paths: {},
  components: {
    schemas: {
      ListenerMode: {
        type: 'string',
        enum: ['http', 'grpc', 'tcp'],
        description: 'Protocol mode for the listener',
      },
      DeploymentStatus: {
        type: 'string',
        enum: ['in-progress', 'completed', 'failed', 'not-started'],
      },
      Priority: {
        type: 'integer',
        enum: [0, 1, 2, 3],
        description: 'Task priority level',
      },
      ServiceConfig: {
        type: 'object',
        description: 'Configuration for a service',
        required: ['name', 'mode'],
        properties: {
          name: { type: 'string' },
          mode: { $ref: '#/components/schemas/ListenerMode' },
          status: { $ref: '#/components/schemas/DeploymentStatus' },
          modes: {
            type: 'array',
            items: { $ref: '#/components/schemas/ListenerMode' },
          },
        },
      },
    },
  },
};

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
    expect(packageJson.dependencies['class-transformer']).toBeDefined();

    // Step 5: Install dependencies and compile
    // Add extra deps needed for compilation and schema building
    packageJson.dependencies['@nestjs/common'] = '^10.0.0';
    packageJson.dependencies['@nestjs/core'] = '^10.0.0';
    packageJson.dependencies['graphql'] = '^16.0.0';
    packageJson.dependencies['graphql-scalars'] = '^1.22.0';
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

    // metadata (dictionary type) should have @Field(() => GraphQLJSON)
    expect(userFieldNames).toContain('metadata');

    // Verify field types
    const idField = userFields.find((f: any) => f.name === 'id');
    expect(idField.typeFn).toBe('ID');

    const ageField = userFields.find((f: any) => f.name === 'age');
    expect(ageField.typeFn).toBe('Int');

    const activeField = userFields.find((f: any) => f.name === 'active');
    expect(activeField.typeFn).toBe('Boolean');

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

  it('should generate TypeScript enums with registerEnumType for enum schemas', async () => {
    const TEST_ENUM_DIR = path.join(__dirname, '../../test-output/e2e-nestjs-graphql-enums');
    const ENUM_MODELS_DIR = path.join(TEST_ENUM_DIR, 'models');
    await ensureCleanDirectory(TEST_ENUM_DIR);

    // Parse spec with enum schemas
    const parser = new OpenAPIParser();
    const ir = parser.parse(enumTestSpec, { includeOperations: false });

    // Should have all schemas including enums
    expect(ir.schemas.has('ListenerMode')).toBe(true);
    expect(ir.schemas.has('DeploymentStatus')).toBe(true);
    expect(ir.schemas.has('ServiceConfig')).toBe(true);

    // Verify IR correctly identifies enum schemas
    expect(ir.schemas.get('ListenerMode')!.type).toBe('enum');
    expect(ir.schemas.get('DeploymentStatus')!.type).toBe('enum');
    expect(ir.schemas.get('ServiceConfig')!.type).toBe('object');

    // Generate code
    const generator = new Generator({
      outputDir: TEST_ENUM_DIR,
      nestJsGraphql: true,
      esm: false,
      mode: 'models-only',
    });
    await generator.generate(ir);

    // Verify enum files exist
    const listenerModeFile = path.join(ENUM_MODELS_DIR, 'listener-mode.ts');
    const deploymentStatusFile = path.join(ENUM_MODELS_DIR, 'deployment-status.ts');
    const serviceConfigFile = path.join(ENUM_MODELS_DIR, 'service-config.ts');
    expect(fs.existsSync(listenerModeFile)).toBe(true);
    expect(fs.existsSync(deploymentStatusFile)).toBe(true);
    expect(fs.existsSync(serviceConfigFile)).toBe(true);

    const listenerModeContent = fs.readFileSync(listenerModeFile, 'utf-8');
    const deploymentStatusContent = fs.readFileSync(deploymentStatusFile, 'utf-8');
    const serviceConfigContent = fs.readFileSync(serviceConfigFile, 'utf-8');

    // Verify ListenerMode is a TypeScript enum (not empty class)
    expect(listenerModeContent).toContain('export enum ListenerMode');
    expect(listenerModeContent).toContain("Http = \"http\"");
    expect(listenerModeContent).toContain("Grpc = \"grpc\"");
    expect(listenerModeContent).toContain("Tcp = \"tcp\"");
    // Should NOT contain class declaration
    expect(listenerModeContent).not.toContain('export class ListenerMode');
    // Should NOT contain @Expose (class-transformer not needed for enums)
    expect(listenerModeContent).not.toContain('@Expose');

    // Verify registerEnumType call
    expect(listenerModeContent).toContain('registerEnumType(ListenerMode');
    expect(listenerModeContent).toContain("name: 'ListenerMode'");
    expect(listenerModeContent).toContain('description: `Protocol mode for the listener`');

    // Verify DeploymentStatus with hyphenated values → PascalCase members
    expect(deploymentStatusContent).toContain('export enum DeploymentStatus');
    expect(deploymentStatusContent).toContain("InProgress = \"in-progress\"");
    expect(deploymentStatusContent).toContain("Completed = \"completed\"");
    expect(deploymentStatusContent).toContain("Failed = \"failed\"");
    expect(deploymentStatusContent).toContain("NotStarted = \"not-started\"");
    expect(deploymentStatusContent).toContain('registerEnumType(DeploymentStatus');

    // Verify ServiceConfig references enum types normally
    expect(serviceConfigContent).toContain('export class ServiceConfig');
    expect(serviceConfigContent).toContain('@ObjectType');
    // Should import the enum
    expect(serviceConfigContent).toContain('ListenerMode');
    expect(serviceConfigContent).toContain('DeploymentStatus');

    // Step: Compile and verify runtime behavior
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(TEST_ENUM_DIR, 'package.json'), 'utf-8')
    );
    packageJson.dependencies['@nestjs/common'] = '^10.0.0';
    packageJson.dependencies['@nestjs/core'] = '^10.0.0';
    packageJson.dependencies['graphql'] = '^16.0.0';
    packageJson.dependencies['graphql-scalars'] = '^1.22.0';
    packageJson.dependencies['reflect-metadata'] = '^0.2.0';
    packageJson.dependencies['rxjs'] = '^7.0.0';
    packageJson.dependencies['@apollo/server'] = '^4.0.0';
    fs.writeFileSync(
      path.join(TEST_ENUM_DIR, 'package.json'),
      JSON.stringify(packageJson, null, 2) + '\n',
      'utf-8'
    );

    execSync('npm install --silent 2>&1', {
      cwd: TEST_ENUM_DIR,
      stdio: 'pipe',
      timeout: 120000,
    });

    // Compile TypeScript - this verifies enum types are valid
    execSync('npx tsc --skipLibCheck', {
      cwd: TEST_ENUM_DIR,
      stdio: 'pipe',
      timeout: 60000,
    });

    // Verify enum registration at runtime
    const runtimeScript = `
require('reflect-metadata');

// Import generated models
const { ListenerMode } = require('./dist/listener-mode');
const { DeploymentStatus } = require('./dist/deployment-status');
const { ServiceConfig } = require('./dist/service-config');

// Load lazy metadata
const { LazyMetadataStorage } = require('@nestjs/graphql/dist/schema-builder/storages/lazy-metadata.storage');
LazyMetadataStorage.load();

const { TypeMetadataStorage } = require('@nestjs/graphql/dist/schema-builder/storages/type-metadata.storage');

// Get registered enums
const enumTypes = TypeMetadataStorage.getEnumsMetadata();
const objectTypes = TypeMetadataStorage.getObjectTypesMetadata();

const result = {
  enums: enumTypes.map(e => ({
    name: e.name,
    description: e.description,
    ref: e.ref ? e.ref.name || Object.keys(e.ref).join(',') : null,
  })),
  objectTypes: objectTypes.map(ot => ({
    name: ot.name,
    target: ot.target.name,
  })),
  // Verify enum values are accessible
  listenerModeValues: Object.values(ListenerMode),
  deploymentStatusValues: Object.values(DeploymentStatus),
};

console.log(JSON.stringify(result, null, 2));
`;

    const scriptPath = path.join(TEST_ENUM_DIR, 'verify-enums.js');
    fs.writeFileSync(scriptPath, runtimeScript, 'utf-8');

    const output = execSync('node verify-enums.js', {
      cwd: TEST_ENUM_DIR,
      stdio: 'pipe',
      timeout: 30000,
    }).toString();

    const result = JSON.parse(output);

    // Verify enums are registered
    const enumNames = result.enums.map((e: any) => e.name);
    expect(enumNames).toContain('ListenerMode');
    expect(enumNames).toContain('DeploymentStatus');

    // Verify description preserved
    const listenerEnumMeta = result.enums.find((e: any) => e.name === 'ListenerMode');
    expect(listenerEnumMeta.description).toBe('Protocol mode for the listener');

    // Verify enum values
    expect(result.listenerModeValues).toEqual(['http', 'grpc', 'tcp']);
    expect(result.deploymentStatusValues).toEqual(['in-progress', 'completed', 'failed', 'not-started']);

    // Verify ServiceConfig is registered as ObjectType (not broken by enum references)
    const objectTypeNames = result.objectTypes.map((ot: any) => ot.target);
    expect(objectTypeNames).toContain('ServiceConfig');
  }, 180000);

  it('should auto-rename schemas that conflict with GraphQL built-in scalars', async () => {
    const TEST_SCALAR_DIR = path.join(__dirname, '../../test-output/e2e-nestjs-graphql-scalars');
    const SCALAR_MODELS_DIR = path.join(TEST_SCALAR_DIR, 'models');
    await ensureCleanDirectory(TEST_SCALAR_DIR);

    // Spec with schemas named after GraphQL built-in scalars (realistic wrapper types)
    const scalarConflictSpec = {
      openapi: '3.0.0',
      info: { title: 'Scalar Conflict Test', version: '1.0.0' },
      paths: {},
      components: {
        schemas: {
          Boolean: {
            type: 'object',
            description: 'Three-state boolean wrapper',
            properties: {
              value: { type: 'boolean' },
              isSet: { type: 'boolean' },
            },
          },
          Integer: {
            type: 'object',
            description: 'Nullable integer wrapper',
            properties: {
              value: { type: 'integer', format: 'int32' },
            },
          },
          NullableBoolean: {
            type: 'object',
            description: 'Should NOT be renamed — only exact matches',
            properties: {
              value: { type: 'boolean', nullable: true },
            },
          },
          Config: {
            type: 'object',
            required: ['enabled'],
            properties: {
              enabled: { $ref: '#/components/schemas/Boolean' },
              count: { $ref: '#/components/schemas/Integer' },
              flag: { $ref: '#/components/schemas/NullableBoolean' },
            },
          },
        },
      },
    };

    const parser = new OpenAPIParser();
    const ir = parser.parse(scalarConflictSpec, { includeOperations: false });

    const generator = new Generator({
      outputDir: TEST_SCALAR_DIR,
      nestJsGraphql: true,
      esm: false,
      mode: 'models-only',
    });
    await generator.generate(ir);

    // Boolean should be renamed to BooleanModel
    expect(fs.existsSync(path.join(SCALAR_MODELS_DIR, 'boolean-model.ts'))).toBe(true);
    expect(fs.existsSync(path.join(SCALAR_MODELS_DIR, 'boolean.ts'))).toBe(false);

    const boolModelContent = fs.readFileSync(path.join(SCALAR_MODELS_DIR, 'boolean-model.ts'), 'utf-8');
    expect(boolModelContent).toContain('export class BooleanModel');
    expect(boolModelContent).toContain('@ObjectType');

    // NullableBoolean should NOT be renamed
    expect(fs.existsSync(path.join(SCALAR_MODELS_DIR, 'nullable-boolean.ts'))).toBe(true);
    const nullableBoolContent = fs.readFileSync(path.join(SCALAR_MODELS_DIR, 'nullable-boolean.ts'), 'utf-8');
    expect(nullableBoolContent).toContain('export class NullableBoolean');

    // Config should reference BooleanModel, not Boolean
    const configContent = fs.readFileSync(path.join(SCALAR_MODELS_DIR, 'config.ts'), 'utf-8');
    expect(configContent).toContain("import { BooleanModel } from");
    expect(configContent).toContain("'enabled': BooleanModel");
    // NullableBoolean reference should be unchanged
    expect(configContent).toContain("import { NullableBoolean } from");

    // Integer is not a GraphQL built-in scalar (Int is), so should NOT be renamed
    expect(fs.existsSync(path.join(SCALAR_MODELS_DIR, 'integer.ts'))).toBe(true);
    const integerContent = fs.readFileSync(path.join(SCALAR_MODELS_DIR, 'integer.ts'), 'utf-8');
    expect(integerContent).toContain('export class Integer');
  });

  it('should generate createUnionType for discriminated union and GraphQLJSON fallback for non-discriminated', async () => {
    const TEST_UNION_DIR = path.join(__dirname, '../../test-output/e2e-nestjs-graphql-unions');
    const UNION_MODELS_DIR = path.join(TEST_UNION_DIR, 'models');
    await ensureCleanDirectory(TEST_UNION_DIR);

    const unionSpec = {
      openapi: '3.0.0',
      info: { title: 'Union Test API', version: '1.0.0' },
      paths: {},
      components: {
        schemas: {
          TextBlock: {
            type: 'object',
            required: ['blockType', 'text'],
            properties: {
              blockType: { type: 'string' },
              text: { type: 'string' },
            },
          },
          ImageBlock: {
            type: 'object',
            required: ['blockType', 'url'],
            properties: {
              blockType: { type: 'string' },
              url: { type: 'string', format: 'uri' },
            },
          },
          Widget: {
            type: 'object',
            required: ['id'],
            properties: {
              id: { type: 'string' },
              label: { type: 'string' },
            },
          },
          Gadget: {
            type: 'object',
            required: ['id'],
            properties: {
              id: { type: 'string' },
              power: { type: 'number' },
            },
          },
          Page: {
            type: 'object',
            required: ['title', 'blocks'],
            properties: {
              title: { type: 'string' },
              blocks: {
                type: 'array',
                items: {
                  oneOf: [
                    { $ref: '#/components/schemas/TextBlock' },
                    { $ref: '#/components/schemas/ImageBlock' },
                  ],
                  discriminator: {
                    propertyName: 'blockType',
                    mapping: {
                      text: '#/components/schemas/TextBlock',
                      image: '#/components/schemas/ImageBlock',
                    },
                  },
                },
              },
              mainBlock: {
                oneOf: [
                  { $ref: '#/components/schemas/TextBlock' },
                  { $ref: '#/components/schemas/ImageBlock' },
                ],
                discriminator: {
                  propertyName: 'blockType',
                  mapping: {
                    text: '#/components/schemas/TextBlock',
                    image: '#/components/schemas/ImageBlock',
                  },
                },
              },
              attachment: {
                oneOf: [
                  { $ref: '#/components/schemas/Widget' },
                  { $ref: '#/components/schemas/Gadget' },
                ],
                description: 'An attached item without discriminator',
              },
            },
          },
        },
      },
    };

    const parser = new OpenAPIParser();
    const ir = parser.parse(unionSpec, { includeOperations: false });

    const generator = new Generator({
      outputDir: TEST_UNION_DIR,
      nestJsGraphql: true,
      esm: false,
      mode: 'models-only',
    });
    await generator.generate(ir);

    const pageFile = path.join(UNION_MODELS_DIR, 'page.ts');
    expect(fs.existsSync(pageFile)).toBe(true);
    const pageContent = fs.readFileSync(pageFile, 'utf-8');

    // Discriminated union: should have createUnionType
    expect(pageContent).toContain('createUnionType');
    expect(pageContent).toContain("name: 'TextBlockOrImageBlock'");
    expect(pageContent).toContain('types: () => [TextBlock, ImageBlock] as const');
    expect(pageContent).toContain("'text': TextBlock");
    expect(pageContent).toContain("'image': ImageBlock");
    expect(pageContent).toContain('value.blockType');

    // Array of discriminated union
    expect(pageContent).toContain('[TextBlockOrImageBlockUnion]');
    // Singular discriminated union
    expect(pageContent).toMatch(/\(\) => TextBlockOrImageBlockUnion[,\s]/);

    // Non-discriminated union: should fall back to GraphQLJSON
    expect(pageContent).toContain('GraphQLJSON');
    expect(pageContent).toContain('from "graphql-scalars"');

    // All fields should have @Field — nothing silently dropped
    const fieldCount = (pageContent.match(/@Field\(/g) || []).length;
    expect(fieldCount).toBe(4); // title, blocks, mainBlock, attachment
  });
});
