/**
 * Tests for Plugin System Interface
 * Professional test suite for PluginRegistry and PluginRunner
 */

import { Project } from 'ts-morph';
import {
  GeneratorPlugin,
  PluginRegistry,
  PluginRunner,
} from '../plugin-interface';
import { ClassBuilder, GenerationContext } from '../../builders/class-builder';
import { ImportManager } from '../../builders/import-manager';
import { IRHelpers } from '../../ir/types';

describe('Plugin System', () => {
  describe('PluginRegistry', () => {
    let registry: PluginRegistry;

    beforeEach(() => {
      registry = new PluginRegistry();
    });

    describe('register', () => {
      it('should register a plugin', () => {
        const plugin: GeneratorPlugin = {
          name: 'test-plugin',
          priority: 100,
        };

        registry.register(plugin);

        expect(registry.has('test-plugin')).toBe(true);
        expect(registry.getAll()).toHaveLength(1);
      });

      it('should throw error for duplicate plugin names', () => {
        const plugin1: GeneratorPlugin = {
          name: 'duplicate',
          priority: 100,
        };
        const plugin2: GeneratorPlugin = {
          name: 'duplicate',
          priority: 50,
        };

        registry.register(plugin1);

        expect(() => registry.register(plugin2)).toThrow(
          'Plugin with name "duplicate" is already registered'
        );
      });

      it('should sort plugins by priority (higher first)', () => {
        const lowPriority: GeneratorPlugin = {
          name: 'low',
          priority: 10,
        };
        const highPriority: GeneratorPlugin = {
          name: 'high',
          priority: 100,
        };
        const mediumPriority: GeneratorPlugin = {
          name: 'medium',
          priority: 50,
        };

        registry.register(lowPriority);
        registry.register(highPriority);
        registry.register(mediumPriority);

        const plugins = registry.getAll();
        expect(plugins[0].name).toBe('high');
        expect(plugins[1].name).toBe('medium');
        expect(plugins[2].name).toBe('low');
      });
    });

    describe('registerAll', () => {
      it('should register multiple plugins', () => {
        const plugins: GeneratorPlugin[] = [
          { name: 'plugin1', priority: 100 },
          { name: 'plugin2', priority: 50 },
          { name: 'plugin3', priority: 75 },
        ];

        registry.registerAll(plugins);

        expect(registry.getAll()).toHaveLength(3);
        expect(registry.has('plugin1')).toBe(true);
        expect(registry.has('plugin2')).toBe(true);
        expect(registry.has('plugin3')).toBe(true);
      });

      it('should maintain priority sorting with registerAll', () => {
        const plugins: GeneratorPlugin[] = [
          { name: 'low', priority: 10 },
          { name: 'high', priority: 100 },
        ];

        registry.registerAll(plugins);

        const all = registry.getAll();
        expect(all[0].name).toBe('high');
        expect(all[1].name).toBe('low');
      });

      it('should throw error if duplicate found in batch', () => {
        const plugin1: GeneratorPlugin = { name: 'test', priority: 100 };
        registry.register(plugin1);

        const plugins: GeneratorPlugin[] = [
          { name: 'test', priority: 50 },
        ];

        expect(() => registry.registerAll(plugins)).toThrow();
      });
    });

    describe('getAll', () => {
      it('should return array copy of plugins', () => {
        const plugin: GeneratorPlugin = { name: 'test', priority: 100 };
        registry.register(plugin);

        const plugins1 = registry.getAll();
        const plugins2 = registry.getAll();

        expect(plugins1).not.toBe(plugins2); // Different array instances
        expect(plugins1).toEqual(plugins2); // Same contents
      });

      it('should return empty array when no plugins', () => {
        expect(registry.getAll()).toEqual([]);
      });
    });

    describe('getByName', () => {
      it('should return plugin by name', () => {
        const plugin: GeneratorPlugin = { name: 'finder', priority: 100 };
        registry.register(plugin);

        const found = registry.getByName('finder');

        expect(found).toBeDefined();
        expect(found?.name).toBe('finder');
        expect(found?.priority).toBe(100);
      });

      it('should return undefined for non-existent plugin', () => {
        expect(registry.getByName('non-existent')).toBeUndefined();
      });
    });

    describe('has', () => {
      it('should return true for registered plugin', () => {
        const plugin: GeneratorPlugin = { name: 'exists', priority: 100 };
        registry.register(plugin);

        expect(registry.has('exists')).toBe(true);
      });

      it('should return false for non-existent plugin', () => {
        expect(registry.has('does-not-exist')).toBe(false);
      });
    });

    describe('remove', () => {
      it('should remove plugin by name', () => {
        const plugin: GeneratorPlugin = { name: 'removable', priority: 100 };
        registry.register(plugin);

        expect(registry.has('removable')).toBe(true);

        const removed = registry.remove('removable');

        expect(removed).toBe(true);
        expect(registry.has('removable')).toBe(false);
        expect(registry.getAll()).toHaveLength(0);
      });

      it('should return false when removing non-existent plugin', () => {
        const removed = registry.remove('non-existent');

        expect(removed).toBe(false);
      });

      it('should maintain order after removal', () => {
        const plugins: GeneratorPlugin[] = [
          { name: 'plugin1', priority: 100 },
          { name: 'plugin2', priority: 50 },
          { name: 'plugin3', priority: 75 },
        ];
        registry.registerAll(plugins);

        registry.remove('plugin2');

        const remaining = registry.getAll();
        expect(remaining).toHaveLength(2);
        expect(remaining[0].name).toBe('plugin1');
        expect(remaining[1].name).toBe('plugin3');
      });
    });

    describe('clear', () => {
      it('should remove all plugins', () => {
        const plugins: GeneratorPlugin[] = [
          { name: 'plugin1', priority: 100 },
          { name: 'plugin2', priority: 50 },
        ];
        registry.registerAll(plugins);

        expect(registry.getAll()).toHaveLength(2);

        registry.clear();

        expect(registry.getAll()).toHaveLength(0);
        expect(registry.has('plugin1')).toBe(false);
        expect(registry.has('plugin2')).toBe(false);
      });

      it('should work on empty registry', () => {
        expect(() => registry.clear()).not.toThrow();
        expect(registry.getAll()).toHaveLength(0);
      });
    });
  });

  describe('PluginRunner', () => {
    let project: Project;
    let context: GenerationContext;
    let builder: ClassBuilder;

    beforeEach(() => {
      project = new Project({ useInMemoryFileSystem: true });
      context = {
        project,
        importManager: new ImportManager({ esm: false }),
        options: {
          outputDir: '/test/output',
          esm: false,
        },
      };
      builder = new ClassBuilder(context, 'test.ts', 'TestClass');
    });

    describe('runBeforeGeneration', () => {
      it('should call beforeGeneration on all plugins', async () => {
        const plugin1 = {
          name: 'plugin1',
          priority: 100,
          beforeGeneration: jest.fn(),
        };
        const plugin2 = {
          name: 'plugin2',
          priority: 50,
          beforeGeneration: jest.fn(),
        };

        const runner = new PluginRunner([plugin1, plugin2]);
        const ir = IRHelpers.createSchemaIR();

        await runner.runBeforeGeneration(context, ir);

        expect(plugin1.beforeGeneration).toHaveBeenCalledWith(context, ir);
        expect(plugin2.beforeGeneration).toHaveBeenCalledWith(context, ir);
      });

      it('should skip plugins without beforeGeneration hook', async () => {
        const plugin: GeneratorPlugin = {
          name: 'no-hook',
          priority: 100,
        };

        const runner = new PluginRunner([plugin]);
        const ir = IRHelpers.createSchemaIR();

        await expect(runner.runBeforeGeneration(context, ir)).resolves.not.toThrow();
      });

      it('should handle async beforeGeneration hooks', async () => {
        const plugin = {
          name: 'async-plugin',
          priority: 100,
          beforeGeneration: jest.fn().mockResolvedValue(undefined),
        };

        const runner = new PluginRunner([plugin]);
        const ir = IRHelpers.createSchemaIR();

        await runner.runBeforeGeneration(context, ir);

        expect(plugin.beforeGeneration).toHaveBeenCalled();
      });
    });

    describe('runDecorateClass', () => {
      it('should call decorateClass on all plugins', async () => {
        const plugin1 = {
          name: 'plugin1',
          priority: 100,
          decorateClass: jest.fn(),
        };
        const plugin2 = {
          name: 'plugin2',
          priority: 50,
          decorateClass: jest.fn(),
        };

        const runner = new PluginRunner([plugin1, plugin2]);
        const classDecl = builder.getClassDeclaration();
        const schema = IRHelpers.createSchema('TestClass');

        await runner.runDecorateClass(classDecl, schema, context);

        expect(plugin1.decorateClass).toHaveBeenCalledWith(classDecl, schema, context);
        expect(plugin2.decorateClass).toHaveBeenCalledWith(classDecl, schema, context);
      });

      it('should skip plugins without decorateClass hook', async () => {
        const plugin: GeneratorPlugin = {
          name: 'no-hook',
          priority: 100,
        };

        const runner = new PluginRunner([plugin]);
        const classDecl = builder.getClassDeclaration();
        const schema = IRHelpers.createSchema('TestClass');

        await expect(
          runner.runDecorateClass(classDecl, schema, context)
        ).resolves.not.toThrow();
      });

      it('should handle async decorateClass hooks', async () => {
        const plugin = {
          name: 'async-plugin',
          priority: 100,
          decorateClass: jest.fn().mockResolvedValue(undefined),
        };

        const runner = new PluginRunner([plugin]);
        const classDecl = builder.getClassDeclaration();
        const schema = IRHelpers.createSchema('TestClass');

        await runner.runDecorateClass(classDecl, schema, context);

        expect(plugin.decorateClass).toHaveBeenCalled();
      });
    });

    describe('runDecorateProperty', () => {
      it('should call decorateProperty on all plugins', async () => {
        const plugin1 = {
          name: 'plugin1',
          priority: 100,
          decorateProperty: jest.fn(),
        };
        const plugin2 = {
          name: 'plugin2',
          priority: 50,
          decorateProperty: jest.fn(),
        };

        const runner = new PluginRunner([plugin1, plugin2]);
        const propertyDef = IRHelpers.createProperty(
          'testProp',
          IRHelpers.createTypeReference('primitive', 'string')
        );
        const propertyDecl = builder.addProperty(propertyDef);
        const schema = IRHelpers.createSchema('TestClass');

        await runner.runDecorateProperty(propertyDecl, propertyDef, schema, context);

        expect(plugin1.decorateProperty).toHaveBeenCalledWith(
          propertyDecl,
          propertyDef,
          schema,
          context
        );
        expect(plugin2.decorateProperty).toHaveBeenCalledWith(
          propertyDecl,
          propertyDef,
          schema,
          context
        );
      });

      it('should skip plugins without decorateProperty hook', async () => {
        const plugin: GeneratorPlugin = {
          name: 'no-hook',
          priority: 100,
        };

        const runner = new PluginRunner([plugin]);
        const propertyDef = IRHelpers.createProperty(
          'testProp',
          IRHelpers.createTypeReference('primitive', 'string')
        );
        const propertyDecl = builder.addProperty(propertyDef);
        const schema = IRHelpers.createSchema('TestClass');

        await expect(
          runner.runDecorateProperty(propertyDecl, propertyDef, schema, context)
        ).resolves.not.toThrow();
      });
    });

    describe('runAfterGeneration', () => {
      it('should call afterGeneration on all plugins', async () => {
        const plugin1 = {
          name: 'plugin1',
          priority: 100,
          afterGeneration: jest.fn(),
        };
        const plugin2 = {
          name: 'plugin2',
          priority: 50,
          afterGeneration: jest.fn(),
        };

        const runner = new PluginRunner([plugin1, plugin2]);
        const ir = IRHelpers.createSchemaIR();

        await runner.runAfterGeneration(context, ir);

        expect(plugin1.afterGeneration).toHaveBeenCalledWith(context, ir);
        expect(plugin2.afterGeneration).toHaveBeenCalledWith(context, ir);
      });

      it('should skip plugins without afterGeneration hook', async () => {
        const plugin: GeneratorPlugin = {
          name: 'no-hook',
          priority: 100,
        };

        const runner = new PluginRunner([plugin]);
        const ir = IRHelpers.createSchemaIR();

        await expect(runner.runAfterGeneration(context, ir)).resolves.not.toThrow();
      });

      it('should handle async afterGeneration hooks', async () => {
        const plugin = {
          name: 'async-plugin',
          priority: 100,
          afterGeneration: jest.fn().mockResolvedValue(undefined),
        };

        const runner = new PluginRunner([plugin]);
        const ir = IRHelpers.createSchemaIR();

        await runner.runAfterGeneration(context, ir);

        expect(plugin.afterGeneration).toHaveBeenCalled();
      });
    });

    describe('runModifyPackageJson', () => {
      it('should call modifyPackageJson on all plugins', async () => {
        const plugin1 = {
          name: 'plugin1',
          priority: 100,
          modifyPackageJson: jest.fn(),
        };
        const plugin2 = {
          name: 'plugin2',
          priority: 50,
          modifyPackageJson: jest.fn(),
        };

        const runner = new PluginRunner([plugin1, plugin2]);
        const packageJson = { name: 'test-package', version: '1.0.0' };

        await runner.runModifyPackageJson(packageJson, context);

        expect(plugin1.modifyPackageJson).toHaveBeenCalledWith(packageJson, context);
        expect(plugin2.modifyPackageJson).toHaveBeenCalledWith(packageJson, context);
      });

      it('should skip plugins without modifyPackageJson hook', async () => {
        const plugin: GeneratorPlugin = {
          name: 'no-hook',
          priority: 100,
        };

        const runner = new PluginRunner([plugin]);
        const packageJson = { name: 'test-package' };

        await expect(
          runner.runModifyPackageJson(packageJson, context)
        ).resolves.not.toThrow();
      });

      it('should allow plugins to modify package.json', async () => {
        const plugin = {
          name: 'dependency-adder',
          priority: 100,
          modifyPackageJson: jest.fn((pkg) => {
            pkg.dependencies = { 'test-dep': '1.0.0' };
          }),
        };

        const runner = new PluginRunner([plugin]);
        const packageJson: any = { name: 'test-package' };

        await runner.runModifyPackageJson(packageJson, context);

        expect(packageJson.dependencies).toEqual({ 'test-dep': '1.0.0' });
      });
    });

    describe('plugin execution order', () => {
      it('should execute plugins in priority order', async () => {
        const executionOrder: string[] = [];

        const lowPriority = {
          name: 'low',
          priority: 10,
          beforeGeneration: jest.fn(() => {
            executionOrder.push('low');
          }),
        };
        const highPriority = {
          name: 'high',
          priority: 100,
          beforeGeneration: jest.fn(() => {
            executionOrder.push('high');
          }),
        };
        const mediumPriority = {
          name: 'medium',
          priority: 50,
          beforeGeneration: jest.fn(() => {
            executionOrder.push('medium');
          }),
        };

        // Note: PluginRunner doesn't sort, it executes in array order
        // The sorting happens in PluginRegistry
        const runner = new PluginRunner([highPriority, mediumPriority, lowPriority]);
        const ir = IRHelpers.createSchemaIR();

        await runner.runBeforeGeneration(context, ir);

        expect(executionOrder).toEqual(['high', 'medium', 'low']);
      });
    });

    describe('error handling', () => {
      it('should propagate errors from plugin hooks', async () => {
        const plugin = {
          name: 'error-plugin',
          priority: 100,
          beforeGeneration: jest.fn().mockRejectedValue(new Error('Plugin error')),
        };

        const runner = new PluginRunner([plugin]);
        const ir = IRHelpers.createSchemaIR();

        await expect(runner.runBeforeGeneration(context, ir)).rejects.toThrow('Plugin error');
      });
    });
  });

  describe('Integration: Registry and Runner', () => {
    it('should work together for complete plugin lifecycle', async () => {
      const registry = new PluginRegistry();
      const project = new Project({ useInMemoryFileSystem: true });
      const context: GenerationContext = {
        project,
        importManager: new ImportManager({ esm: false }),
        options: { outputDir: '/test', esm: false },
      };

      const mockPlugin: GeneratorPlugin = {
        name: 'integration-test',
        priority: 100,
        beforeGeneration: jest.fn(),
        afterGeneration: jest.fn(),
      };

      registry.register(mockPlugin);
      const runner = new PluginRunner(registry.getAll());
      const ir = IRHelpers.createSchemaIR();

      await runner.runBeforeGeneration(context, ir);
      await runner.runAfterGeneration(context, ir);

      expect(mockPlugin.beforeGeneration).toHaveBeenCalled();
      expect(mockPlugin.afterGeneration).toHaveBeenCalled();
    });
  });
});
