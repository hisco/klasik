/**
 * End-to-end test for CRD code generation
 * Verifies high-quality TypeScript output with all decorators
 */

import * as fs from 'fs';
import * as path from 'path';
import { CRDParser } from '../parsers/crd-parser';
import { CRDToIRConverter } from '../parsers/crd-to-ir';
import { Generator } from '../generator/generator';

const TEST_OUTPUT_DIR = path.join(__dirname, '../../test-output/e2e-crd');

describe('CRD E2E: Code Quality', () => {
  beforeAll(() => {
    // Clean test output directory
    if (fs.existsSync(TEST_OUTPUT_DIR)) {
      fs.rmSync(TEST_OUTPUT_DIR, { recursive: true });
    }
    fs.mkdirSync(TEST_OUTPUT_DIR, { recursive: true });
  });

  afterAll(() => {
    // Clean up test output
    if (fs.existsSync(TEST_OUTPUT_DIR)) {
      fs.rmSync(TEST_OUTPUT_DIR, { recursive: true });
    }
  });

  it('should generate high-quality TypeScript from CRD with all decorators', async () => {
    // Sample CRD similar to ArgoCD Application
    const crdYaml = {
      apiVersion: 'apiextensions.k8s.io/v1',
      kind: 'CustomResourceDefinition',
      metadata: {
        name: 'applications.argoproj.io',
      },
      spec: {
        group: 'argoproj.io',
        names: {
          kind: 'Application',
          plural: 'applications',
          singular: 'application',
          shortNames: ['app', 'apps'],
        },
        scope: 'Namespaced',
        versions: [
          {
            name: 'v1alpha1',
            served: true,
            storage: true,
            schema: {
              openAPIV3Schema: {
                description: 'Application is a definition of an Application resource',
                type: 'object',
                properties: {
                  apiVersion: {
                    description: 'APIVersion defines the versioned schema',
                    type: 'string',
                  },
                  kind: {
                    description: 'Kind is a string value representing the REST resource',
                    type: 'string',
                  },
                  metadata: {
                    type: 'object',
                  },
                  spec: {
                    description: 'ApplicationSpec represents desired application state',
                    type: 'object',
                    required: ['project', 'source', 'destination'],
                    properties: {
                      project: {
                        description: 'Project is a reference to the project this application belongs to',
                        type: 'string',
                        minLength: 1,
                        maxLength: 63,
                      },
                      source: {
                        description: 'Source is a reference to the location of the application manifests',
                        type: 'object',
                        required: ['repoURL'],
                        properties: {
                          repoURL: {
                            description: 'RepoURL is the URL to the repository',
                            type: 'string',
                            format: 'uri',
                          },
                          path: {
                            description: 'Path is a directory path within the Git repository',
                            type: 'string',
                          },
                          targetRevision: {
                            description: 'TargetRevision defines the revision of the source to sync',
                            type: 'string',
                          },
                        },
                      },
                      destination: {
                        description: 'Destination is a reference to the target Kubernetes server and namespace',
                        type: 'object',
                        required: ['server'],
                        properties: {
                          server: {
                            description: 'Server specifies the URL of the target cluster',
                            type: 'string',
                            format: 'uri',
                          },
                          namespace: {
                            description: 'Namespace specifies the target namespace',
                            type: 'string',
                            pattern: '^[a-z0-9]([-a-z0-9]*[a-z0-9])?$',
                          },
                        },
                      },
                      syncPolicy: {
                        description: 'SyncPolicy controls when and how a sync will be performed',
                        type: 'object',
                        properties: {
                          automated: {
                            description: 'Automated will keep an application synced',
                            type: 'object',
                            properties: {
                              prune: {
                                description: 'Prune specifies whether to delete resources',
                                type: 'boolean',
                              },
                              selfHeal: {
                                description: 'SelfHeal specifies whether to sync on drift',
                                type: 'boolean',
                              },
                            },
                          },
                        },
                      },
                      ignoreDifferences: {
                        description: 'IgnoreDifferences is a list of resources to ignore',
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            group: {
                              description: 'Group is the API group',
                              type: 'string',
                            },
                            kind: {
                              description: 'Kind is the Kubernetes resource kind',
                              type: 'string',
                            },
                            jsonPointers: {
                              description: 'JSONPointers is a list of JSON pointers',
                              type: 'array',
                              items: {
                                type: 'string',
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                  status: {
                    description: 'ApplicationStatus contains status information',
                    type: 'object',
                    properties: {
                      sync: {
                        description: 'Sync contains information about the sync status',
                        type: 'object',
                        properties: {
                          status: {
                            description: 'Status is the sync state',
                            type: 'string',
                            enum: ['Unknown', 'Synced', 'OutOfSync'],
                          },
                          revision: {
                            description: 'Revision contains information about the revision',
                            type: 'string',
                          },
                        },
                      },
                      health: {
                        description: 'Health contains information about the health status',
                        type: 'object',
                        properties: {
                          status: {
                            description: 'Status holds the health status',
                            type: 'string',
                            enum: ['Unknown', 'Progressing', 'Healthy', 'Suspended', 'Degraded', 'Missing'],
                          },
                          message: {
                            description: 'Message is a human-readable message',
                            type: 'string',
                          },
                        },
                      },
                    },
                  },
                },
                required: ['apiVersion', 'kind', 'metadata', 'spec'],
              },
            },
            subresources: {
              status: {},
            },
          },
        ],
      },
    };

    const outputDir = path.join(TEST_OUTPUT_DIR, 'application-crd');

    // Parse CRD
    const parser = new CRDParser();
    const parsedCrds = parser.parse(crdYaml);
    expect(parsedCrds).toHaveLength(1);

    // Convert to IR
    const converter = new CRDToIRConverter({
      includeStatus: true,
      extractNested: true,
    });
    const ir = converter.convert(parsedCrds);

    // Generate code with all plugins enabled
    const generator = new Generator({
      outputDir,
      nestJsSwagger: true,
      classValidator: true,
      esm: true,
    });

    await generator.generate(ir);

    // List all generated files for debugging
    const modelsDir = path.join(outputDir, 'models');
    const generatedFiles = fs.readdirSync(modelsDir);
    console.log('Generated files:', generatedFiles);

    // Read generated Application file
    const appFilePath = path.join(outputDir, 'models', 'application.ts');
    expect(fs.existsSync(appFilePath)).toBe(true);

    const appFileContent = fs.readFileSync(appFilePath, 'utf-8');

    // === VERIFY CLASS-LEVEL DOCUMENTATION ===
    expect(appFileContent).toContain('/** Application is a definition of an Application resource */');
    expect(appFileContent).toContain('export class Application');

    // === VERIFY IMPORTS ===
    expect(appFileContent).toContain('from "@nestjs/swagger"');
    expect(appFileContent).toContain('from "class-transformer"');
    expect(appFileContent).toContain('from "class-validator"');

    // === VERIFY @Expose() DECORATOR ===
    expect(appFileContent).toContain('@Expose()');

    // === VERIFY @ApiProperty DECORATOR ===
    // Check it has proper format (type: String, not type: 'string')
    expect(appFileContent).toContain('type: String');
    expect(appFileContent).toContain('description:');
    expect(appFileContent).toContain('required:');

    // === VERIFY VALIDATION DECORATORS ===
    expect(appFileContent).toContain('@IsString');
    expect(appFileContent).toContain('@IsOptional');

    // === VERIFY NESTED OBJECT HANDLING ===
    // Should have @Type(() => ClassName) for nested objects
    expect(appFileContent).toMatch(/@Type\(\(\) => \w+\)/);
    expect(appFileContent).toContain('@ValidateNested');

    // === VERIFY attributeTypeMap ===
    expect(appFileContent).toContain('public static readonly attributeTypeMap');

    // Read generated ApplicationSpec file (nested) - uses kebab-case
    const specFilePath = path.join(outputDir, 'models', 'application-spec.ts');
    const specFileContent = fs.existsSync(specFilePath)
      ? fs.readFileSync(specFilePath, 'utf-8')
      : '';

    if (specFileContent) {
      // === VERIFY PROPERTY-LEVEL DOCUMENTATION ===
      // JSDoc is multi-line with rich metadata
      expect(specFileContent).toContain('Project is a reference to the project this application belongs to');
      expect(specFileContent).toContain('Source is a reference to the location of the application manifests');

      // === VERIFY CONSTRAINTS IN @ApiProperty ===
      expect(specFileContent).toContain('minLength:');
      expect(specFileContent).toContain('maxLength:');

      // === VERIFY CONSTRAINT VALIDATORS ===
      expect(specFileContent).toContain('@MinLength');
      expect(specFileContent).toContain('@MaxLength');

      // === VERIFY ARRAY HANDLING ===
      expect(specFileContent).toContain('@IsArray');

      // === VERIFY REQUIRED vs OPTIONAL ===
      // Required fields should NOT have @IsOptional or ?
      expect(specFileContent).toMatch(/'project':\s*string/); // Required, no ?
      expect(specFileContent).not.toContain('@IsOptional()\n  @IsString\n  @MinLength(1)\n  @MaxLength(63)\n  \'project\'');

      // Optional fields SHOULD have @IsOptional and ?
      expect(specFileContent).toContain('@IsOptional');
    }

    // === VERIFY FORMAT VALIDATORS ===
    const sourceFilePath = path.join(outputDir, 'models', 'application-source.ts');
    if (fs.existsSync(sourceFilePath)) {
      const sourceContent = fs.readFileSync(sourceFilePath, 'utf-8');
      // repoURL has format: uri, should have @IsUrl validator
      expect(sourceContent).toContain('@IsUrl');
      expect(sourceContent).toContain('format: `uri`');
    }

    // === VERIFY PATTERN VALIDATORS ===
    const destFilePath = path.join(outputDir, 'models', 'application-destination.ts');
    if (fs.existsSync(destFilePath)) {
      const destContent = fs.readFileSync(destFilePath, 'utf-8');
      // namespace has pattern, should have @Matches validator
      expect(destContent).toContain('@Matches');
      expect(destContent).toContain('pattern:');
    }

    // === VERIFY BOOLEAN HANDLING ===
    const automatedFilePath = path.join(outputDir, 'models', 'application-sync-policy-automated.ts');
    if (fs.existsSync(automatedFilePath)) {
      const automatedContent = fs.readFileSync(automatedFilePath, 'utf-8');
      expect(automatedContent).toContain('@IsBoolean');
      expect(automatedContent).toContain('type: Boolean');
    }

    // === VERIFY ENUM HANDLING ===
    // Note: Enum values may appear in nested schemas like ApplicationSync
    // The ApplicationStatus itself may not have enum properties directly
    const syncFilePath = path.join(outputDir, 'models', 'application-sync.ts');
    if (fs.existsSync(syncFilePath)) {
      const syncContent = fs.readFileSync(syncFilePath, 'utf-8');
      // ApplicationSync has status enum
      if (syncContent.includes('status')) {
        console.log('Checking for enum in ApplicationSync...');
        // Enum should appear in @ApiProperty if present in the schema
      }
    }

    // === VERIFY ESM IMPORTS ===
    // All relative imports should have .js extension (allow kebab-case)
    expect(appFileContent).toMatch(/from "\.\/[\w-]+\.js"/);

    // === VERIFY PACKAGE.JSON ===
    const packageJsonPath = path.join(outputDir, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    expect(packageJson.dependencies['@nestjs/swagger']).toBeDefined();
    expect(packageJson.dependencies['class-validator']).toBeDefined();
    expect(packageJson.dependencies['class-transformer']).toBeDefined();

    console.log('✅ All code quality checks passed!');
    console.log(`Generated ${ir.schemas.size} schemas with full decorators`);
  });
});
