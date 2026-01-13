/**
 * Plugin System Interface
 *
 * Defines the contract for generator plugins that extend functionality
 */

import { ClassDeclaration, PropertyDeclaration } from 'ts-morph';
import {
  SchemaDefinition,
  PropertyDefinition,
  SchemaIR,
} from '../ir/types';
import { GenerationContext } from '../builders/class-builder';

/**
 * Base interface for all generator plugins
 */
export interface GeneratorPlugin {
  /**
   * Plugin name (unique identifier)
   */
  name: string;

  /**
   * Plugin priority (higher = runs first)
   * Recommended ranges:
   * - 200+: Base decorators (class-transformer)
   * - 100-199: Feature decorators (NestJS, class-validator)
   * - 0-99: Post-processing (ESM, formatting)
   */
  priority: number;

  /**
   * Called before any generation starts
   * Use for setup, validation, adding base imports
   */
  beforeGeneration?(context: GenerationContext, ir: SchemaIR): void | Promise<void>;

  /**
   * Called when decorating a class
   * Add class-level decorators, JSDoc, etc.
   */
  decorateClass?(
    classDecl: ClassDeclaration,
    schema: SchemaDefinition,
    context: GenerationContext
  ): void | Promise<void>;

  /**
   * Called when decorating a property
   * Add property-level decorators
   */
  decorateProperty?(
    property: PropertyDeclaration,
    propertyDef: PropertyDefinition,
    schema: SchemaDefinition,
    context: GenerationContext
  ): void | Promise<void>;

  /**
   * Called after all generation is complete
   * Use for post-processing, cleanup, validation
   */
  afterGeneration?(context: GenerationContext, ir: SchemaIR): void | Promise<void>;

  /**
   * Modify the generated package.json
   * Add dependencies required by this plugin
   */
  modifyPackageJson?(
    packageJson: any,
    context: GenerationContext
  ): void | Promise<void>;
}

/**
 * Plugin registry for managing plugins
 */
export class PluginRegistry {
  private plugins: GeneratorPlugin[] = [];

  /**
   * Register a plugin
   */
  register(plugin: GeneratorPlugin): void {
    // Check for duplicate names
    if (this.plugins.some(p => p.name === plugin.name)) {
      throw new Error(`Plugin with name "${plugin.name}" is already registered`);
    }

    this.plugins.push(plugin);
    this.sortPlugins();
  }

  /**
   * Register multiple plugins
   */
  registerAll(plugins: GeneratorPlugin[]): void {
    for (const plugin of plugins) {
      this.register(plugin);
    }
  }

  /**
   * Get all registered plugins
   */
  getAll(): GeneratorPlugin[] {
    return [...this.plugins];
  }

  /**
   * Get plugin by name
   */
  getByName(name: string): GeneratorPlugin | undefined {
    return this.plugins.find(p => p.name === name);
  }

  /**
   * Check if plugin is registered
   */
  has(name: string): boolean {
    return this.plugins.some(p => p.name === name);
  }

  /**
   * Remove a plugin
   */
  remove(name: string): boolean {
    const index = this.plugins.findIndex(p => p.name === name);
    if (index !== -1) {
      this.plugins.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Clear all plugins
   */
  clear(): void {
    this.plugins = [];
  }

  /**
   * Sort plugins by priority (higher first)
   */
  private sortPlugins(): void {
    this.plugins.sort((a, b) => b.priority - a.priority);
  }
}

/**
 * Helper for running plugin hooks
 */
export class PluginRunner {
  constructor(private plugins: GeneratorPlugin[]) {}

  /**
   * Run beforeGeneration hooks
   */
  async runBeforeGeneration(context: GenerationContext, ir: SchemaIR): Promise<void> {
    for (const plugin of this.plugins) {
      if (plugin.beforeGeneration) {
        await plugin.beforeGeneration(context, ir);
      }
    }
  }

  /**
   * Run decorateClass hooks
   */
  async runDecorateClass(
    classDecl: ClassDeclaration,
    schema: SchemaDefinition,
    context: GenerationContext
  ): Promise<void> {
    for (const plugin of this.plugins) {
      if (plugin.decorateClass) {
        await plugin.decorateClass(classDecl, schema, context);
      }
    }
  }

  /**
   * Run decorateProperty hooks
   */
  async runDecorateProperty(
    property: PropertyDeclaration,
    propertyDef: PropertyDefinition,
    schema: SchemaDefinition,
    context: GenerationContext
  ): Promise<void> {
    for (const plugin of this.plugins) {
      if (plugin.decorateProperty) {
        await plugin.decorateProperty(property, propertyDef, schema, context);
      }
    }
  }

  /**
   * Run afterGeneration hooks
   */
  async runAfterGeneration(context: GenerationContext, ir: SchemaIR): Promise<void> {
    for (const plugin of this.plugins) {
      if (plugin.afterGeneration) {
        await plugin.afterGeneration(context, ir);
      }
    }
  }

  /**
   * Run modifyPackageJson hooks
   */
  async runModifyPackageJson(packageJson: any, context: GenerationContext): Promise<void> {
    for (const plugin of this.plugins) {
      if (plugin.modifyPackageJson) {
        await plugin.modifyPackageJson(packageJson, context);
      }
    }
  }
}
