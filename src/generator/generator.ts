/**
 * Main Generator
 *
 * Orchestrates the code generation process using IR, builders, and plugins
 */

import { Project } from 'ts-morph';
import * as fs from 'fs';
import * as path from 'path';
import {
  SchemaIR,
  SchemaDefinition,
} from '../ir/types';
import { ImportManager } from '../builders/import-manager';
import { ClassBuilder, GenerationContext, GeneratorOptions } from '../builders/class-builder';
import { PluginRegistry, PluginRunner } from '../plugins/plugin-interface';
import { ClassTransformerPlugin } from '../plugins/class-transformer-plugin';
import { NestJSSwaggerPlugin } from '../plugins/nestjs-swagger-plugin';
import { ClassValidatorPlugin } from '../plugins/class-validator-plugin';
import { AjvValidatorPlugin } from '../plugins/ajv-validator-plugin';
import { toKebabCase, toSnakeCase, toPascalCase, toCamelCase } from '../utils/name-utils';
import { ExportStyleManager } from './export-style-manager';

/**
 * Main code generator
 */
export class Generator {
  private project: Project;
  private pluginRegistry: PluginRegistry;
  private pluginRunner: PluginRunner;
  private options: GeneratorOptions;

  constructor(options: GeneratorOptions) {
    this.options = options;

    // Initialize ts-morph project
    this.project = new Project({
      compilerOptions: {
        target: 99, // ES2020
        module: 99, // ESNext
        declaration: true,
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
      },
      useInMemoryFileSystem: false,
    });

    // Initialize plugin system
    this.pluginRegistry = new PluginRegistry();
    this.initializePlugins();
    this.pluginRunner = new PluginRunner(this.pluginRegistry.getAll());
  }

  /**
   * Generate TypeScript code from IR
   */
  async generate(ir: SchemaIR): Promise<void> {
    console.log('Starting code generation...');

    // Create output directory
    this.ensureOutputDirectory();

    // Create generation context
    const context = this.createContext();

    // Run before generation hooks
    await this.pluginRunner.runBeforeGeneration(context, ir);

    // Generate models
    console.log(`Generating ${ir.schemas.size} model(s)...`);
    await this.generateModels(ir, context);

    // Generate API client if in full mode and operations exist
    let hasApiClient = false;
    if (this.options.mode === 'full' && ir.operations.size > 0) {
      const { ApiClientGenerator } = await import('../generators/api-client-generator');
      const apiClientGenerator = new ApiClientGenerator(this.options);
      await apiClientGenerator.generateFullClient(ir);
      hasApiClient = true;
    }

    // Run after generation hooks
    await this.pluginRunner.runAfterGeneration(context, ir);

    // Save all generated files
    console.log('Saving generated files...');
    await this.project.save();

    // Generate package.json and tsconfig.json (skip if bare mode)
    if (!this.options.bare) {
      await this.generatePackageJson(context, hasApiClient);
      await this.generateTsConfig();
    }

    console.log('✅ Code generation completed successfully!');
  }

  /**
   * Generate all model files
   */
  private async generateModels(ir: SchemaIR, context: GenerationContext): Promise<void> {
    const modelsDir = this.options.bare
      ? this.options.outputDir
      : path.join(this.options.outputDir, 'models');
    this.ensureDirectory(modelsDir);

    for (const [name, schema] of ir.schemas) {
      await this.generateModel(schema, context, modelsDir);
    }

    // Generate models index file
    await this.generateModelsIndex(ir, modelsDir);
  }

  /**
   * Generate a single model file
   */
  private async generateModel(
    schema: SchemaDefinition,
    context: GenerationContext,
    modelsDir: string
  ): Promise<void> {
    // Determine file name using centralized logic
    const fileName = this.getSchemaFileName(schema) + '.ts';
    const filePath = path.join(modelsDir, fileName);

    // Create a new ImportManager for this file, cloning the global one
    // This preserves base imports added in beforeGeneration
    const fileImportManager = context.importManager.clone();

    // Create context for this file
    const fileContext: GenerationContext = {
      ...context,
      importManager: fileImportManager,
    };

    // Create class builder
    const builder = new ClassBuilder(fileContext, filePath, schema.name);

    // Add class-level JSDoc
    if (schema.description) {
      builder.addClassDoc(schema.description);
    }

    // Get class declaration for plugins
    const classDecl = builder.getClassDeclaration();

    // Run class decoration hooks
    await this.pluginRunner.runDecorateClass(classDecl, schema, fileContext);

    // Add properties
    for (const [propName, propDef] of schema.properties) {
      const propertyDecl = builder.addProperty(propDef);

      // Run property decoration hooks
      await this.pluginRunner.runDecorateProperty(
        propertyDecl,
        propDef,
        schema,
        fileContext
      );
    }

    // Add attributeTypeMap
    builder.addAttributeTypeMap(schema);

    // Add imports based on property types
    this.addTypeImports(schema, fileImportManager, modelsDir, fileName);

    // Apply imports to source file
    builder.applyImports();

    // Format the file
    builder.format();

    // Build completes when we save the project
  }

  /**
   * Add imports for types referenced in properties
   */
  private addTypeImports(
    schema: SchemaDefinition,
    importManager: ImportManager,
    modelsDir: string,
    currentFile: string
  ): void {
    const importedTypes = new Set<string>();

    for (const [_, propDef] of schema.properties) {
      this.collectTypeImports(propDef.type, importedTypes);
    }

    // Remove self-reference
    importedTypes.delete(schema.name);

    // Add import for each type
    for (const typeName of importedTypes) {
      const typeFileName = toKebabCase(typeName);
      const importPath = `./${typeFileName}`;
      importManager.addImport(importPath, typeName);
    }
  }

  /**
   * Recursively collect type names that need to be imported
   */
  private collectTypeImports(type: any, collected: Set<string>): void {
    if (!type) return;

    switch (type.kind) {
      case 'reference':
      case 'object':
        if (type.name) {
          collected.add(type.name);
        }
        break;

      case 'array':
        if (type.elementType) {
          this.collectTypeImports(type.elementType, collected);
        }
        break;

      case 'union':
        if (type.unionTypes) {
          type.unionTypes.forEach((t: any) => this.collectTypeImports(t, collected));
        }
        break;

      case 'dictionary':
        if (type.additionalProperties) {
          this.collectTypeImports(type.additionalProperties, collected);
        }
        break;
    }
  }

  /**
   * Generate models/index.ts that exports all models
   */
  private async generateModelsIndex(ir: SchemaIR, modelsDir: string): Promise<void> {
    const indexPath = path.join(modelsDir, 'index.ts');

    // In bare mode, use simple direct exports and ignore exportStyle
    if (this.options.bare) {
      const sourceFile = this.project.createSourceFile(indexPath, '', { overwrite: true });

      // Sort schemas alphabetically by name
      const schemas = Array.from(ir.schemas.values()).sort((a, b) =>
        a.name.localeCompare(b.name)
      );

      // Add export statement for each model
      for (const schema of schemas) {
        const fileName = this.getSchemaFileName(schema);
        const importPath = this.options.esm ? `./${fileName}.js` : `./${fileName}`;

        sourceFile.addExportDeclaration({
          moduleSpecifier: importPath,
        });
      }

      sourceFile.formatText({
        indentSize: 2,
        convertTabsToSpaces: true,
      });

      console.log('Generated index.ts with simple exports (bare mode)');
      return;
    }

    // Use ExportStyleManager if exportStyle option is set
    if (this.options.exportStyle) {
      // Save the project first so ExportStyleManager can read the files
      await this.project.save();

      const exportStyleManager = new ExportStyleManager();
      const content = exportStyleManager.generateIndexFile({
        style: this.options.exportStyle,
        esm: this.options.esm || false,
        baseDir: modelsDir,
        subdirs: ['.'],
      });
      fs.writeFileSync(indexPath, content, 'utf-8');
      console.log('Generated models/index.ts with export style:', this.options.exportStyle);
      return;
    }

    // Default behavior: simple re-exports
    const sourceFile = this.project.createSourceFile(indexPath, '', { overwrite: true });

    // Sort schemas alphabetically by name
    const schemas = Array.from(ir.schemas.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    // Add export statement for each model
    for (const schema of schemas) {
      const fileName = this.getSchemaFileName(schema);
      const importPath = this.options.esm ? `./${fileName}.js` : `./${fileName}`;

      sourceFile.addExportDeclaration({
        moduleSpecifier: importPath,
      });
    }

    sourceFile.formatText({
      indentSize: 2,
      convertTabsToSpaces: true,
    });
  }

  /**
   * Generate package.json
   */
  private async generatePackageJson(context: GenerationContext, hasApiClient: boolean): Promise<void> {
    const packageJson: any = {
      name: 'generated-models',
      version: '1.0.0',
      description: 'Generated TypeScript models',
      main: 'models/index.js',
      types: 'models/index.d.ts',
      type: this.options.esm ? 'module' : 'commonjs',
      dependencies: {},
    };

    // Add axios if API client was generated and not using fetch
    if (hasApiClient && this.options.httpClient !== 'fetch') {
      packageJson.dependencies['axios'] = '^1.6.0';
    }

    // Run plugin hooks to modify package.json
    await this.pluginRunner.runModifyPackageJson(packageJson, context);

    // Write package.json
    const packageJsonPath = path.join(this.options.outputDir, 'package.json');
    fs.writeFileSync(
      packageJsonPath,
      JSON.stringify(packageJson, null, 2) + '\n',
      'utf-8'
    );

    console.log('Generated package.json');
  }

  /**
   * Generate tsconfig.json
   */
  private async generateTsConfig(): Promise<void> {
    const tsConfig = {
      compilerOptions: {
        target: 'ES2020',
        module: this.options.esm ? 'ESNext' : 'commonjs',
        lib: ['ES2020'],
        declaration: true,
        outDir: './dist',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
        resolveJsonModule: true,
        moduleResolution: 'node',
      },
      include: ['models/**/*'],
      exclude: ['node_modules', 'dist'],
    };

    const tsConfigPath = path.join(this.options.outputDir, 'tsconfig.json');
    fs.writeFileSync(
      tsConfigPath,
      JSON.stringify(tsConfig, null, 2) + '\n',
      'utf-8'
    );

    console.log('Generated tsconfig.json');
  }

  /**
   * Initialize plugins based on options
   */
  private initializePlugins(): void {
    // Always include ClassTransformer plugin (base decorators)
    this.pluginRegistry.register(new ClassTransformerPlugin());

    // Conditional plugins
    if (this.options.nestJsSwagger) {
      this.pluginRegistry.register(new NestJSSwaggerPlugin());
    }

    if (this.options.classValidator) {
      this.pluginRegistry.register(new ClassValidatorPlugin());
    }

    if (this.options.useAjv) {
      this.pluginRegistry.register(new AjvValidatorPlugin());
    }
  }

  /**
   * Create generation context
   */
  private createContext(): GenerationContext {
    return {
      project: this.project,
      importManager: new ImportManager({ esm: this.options.esm }),
      options: this.options,
    };
  }

  /**
   * Ensure output directory exists
   */
  private ensureOutputDirectory(): void {
    this.ensureDirectory(this.options.outputDir);
  }

  /**
   * Ensure a directory exists
   */
  private ensureDirectory(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Get the file name (without .ts extension) for a schema
   * Uses the same logic as generateModel to ensure consistency
   */
  private getSchemaFileName(schema: SchemaDefinition): string {
    if (this.options.crdKindCase && schema.metadata.kind) {
      // Use original Kind with case transformation
      return this.applyCaseTransform(schema.metadata.kind, this.options.crdKindCase);
    } else {
      // Default: use schema name with kebab-case
      return toKebabCase(schema.name);
    }
  }

  /**
   * Apply case transformation to a name
   */
  private applyCaseTransform(name: string, caseType: 'kebab' | 'snake' | 'pascal' | 'camel' | 'none'): string {
    switch (caseType) {
      case 'kebab':
        return toKebabCase(name);
      case 'snake':
        return toSnakeCase(name);
      case 'pascal':
        return toPascalCase(name);
      case 'camel':
        return toCamelCase(name);
      case 'none':
        return name;
      default:
        return name;
    }
  }
}
