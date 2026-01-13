/**
 * Tests for TemplateEngine
 */

import { TemplateEngine, DefaultTemplates } from '../template-engine';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('TemplateEngine', () => {
  describe('constructor', () => {
    it('should create engine without templates', () => {
      const engine = new TemplateEngine();
      expect(engine.getTemplateNames()).toEqual([]);
    });

    it('should load default templates', () => {
      const defaultTemplates = new Map([
        ['test', 'Hello {{name}}'],
      ]);

      const engine = new TemplateEngine({ defaultTemplates });
      expect(engine.hasTemplate('test')).toBe(true);
    });

    it('should load custom templates from directory', () => {
      // Create temp directory with template
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'klasik-test-'));
      const templatePath = path.join(tempDir, 'custom.mustache');
      fs.writeFileSync(templatePath, 'Custom {{value}}', 'utf-8');

      try {
        const engine = new TemplateEngine({ templateDir: tempDir });
        expect(engine.hasTemplate('custom')).toBe(true);
      } finally {
        // Cleanup
        fs.unlinkSync(templatePath);
        fs.rmdirSync(tempDir);
      }
    });

    it('should override default templates with custom ones', () => {
      const defaultTemplates = new Map([
        ['test', 'Default {{name}}'],
      ]);

      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'klasik-test-'));
      const templatePath = path.join(tempDir, 'test.mustache');
      fs.writeFileSync(templatePath, 'Custom {{name}}', 'utf-8');

      try {
        const engine = new TemplateEngine({
          defaultTemplates,
          templateDir: tempDir,
        });

        const result = engine.render('test', { name: 'World' });
        expect(result).toBe('Custom World');
      } finally {
        fs.unlinkSync(templatePath);
        fs.rmdirSync(tempDir);
      }
    });

    it('should handle non-existent template directory gracefully', () => {
      const engine = new TemplateEngine({
        templateDir: '/non/existent/path',
      });

      expect(engine.getTemplateNames()).toEqual([]);
    });
  });

  describe('render', () => {
    it('should render simple template', () => {
      const engine = new TemplateEngine({
        defaultTemplates: new Map([
          ['greeting', 'Hello {{name}}!'],
        ]),
      });

      const result = engine.render('greeting', { name: 'World' });
      expect(result).toBe('Hello World!');
    });

    it('should render template with multiple variables', () => {
      const engine = new TemplateEngine({
        defaultTemplates: new Map([
          ['user', '{{firstName}} {{lastName}} ({{age}})'],
        ]),
      });

      const result = engine.render('user', {
        firstName: 'John',
        lastName: 'Doe',
        age: 30,
      });

      expect(result).toBe('John Doe (30)');
    });

    it('should render template with conditionals', () => {
      const engine = new TemplateEngine({
        defaultTemplates: new Map([
          ['status', '{{#active}}Active{{/active}}{{^active}}Inactive{{/active}}'],
        ]),
      });

      expect(engine.render('status', { active: true })).toBe('Active');
      expect(engine.render('status', { active: false })).toBe('Inactive');
    });

    it('should render template with loops', () => {
      const engine = new TemplateEngine({
        defaultTemplates: new Map([
          ['list', '{{#items}}{{name}}\n{{/items}}'],
        ]),
      });

      const result = engine.render('list', {
        items: [
          { name: 'Item 1' },
          { name: 'Item 2' },
          { name: 'Item 3' },
        ],
      });

      expect(result).toBe('Item 1\nItem 2\nItem 3\n');
    });

    it('should throw error for non-existent template', () => {
      const engine = new TemplateEngine();

      expect(() => {
        engine.render('missing', {});
      }).toThrow('Template not found: missing');
    });
  });

  describe('hasTemplate', () => {
    it('should return true for existing template', () => {
      const engine = new TemplateEngine({
        defaultTemplates: new Map([['test', 'content']]),
      });

      expect(engine.hasTemplate('test')).toBe(true);
    });

    it('should return false for non-existent template', () => {
      const engine = new TemplateEngine();

      expect(engine.hasTemplate('missing')).toBe(false);
    });
  });

  describe('setTemplate', () => {
    it('should add new template', () => {
      const engine = new TemplateEngine();

      engine.setTemplate('new', 'New {{value}}');

      expect(engine.hasTemplate('new')).toBe(true);
      expect(engine.render('new', { value: 'Template' })).toBe('New Template');
    });

    it('should update existing template', () => {
      const engine = new TemplateEngine({
        defaultTemplates: new Map([['test', 'Old {{value}}']]),
      });

      engine.setTemplate('test', 'New {{value}}');

      expect(engine.render('test', { value: 'Content' })).toBe('New Content');
    });
  });

  describe('getTemplateNames', () => {
    it('should return empty array when no templates', () => {
      const engine = new TemplateEngine();

      expect(engine.getTemplateNames()).toEqual([]);
    });

    it('should return all template names', () => {
      const engine = new TemplateEngine({
        defaultTemplates: new Map([
          ['template1', 'content1'],
          ['template2', 'content2'],
          ['template3', 'content3'],
        ]),
      });

      const names = engine.getTemplateNames();
      expect(names).toHaveLength(3);
      expect(names).toContain('template1');
      expect(names).toContain('template2');
      expect(names).toContain('template3');
    });
  });

  describe('DefaultTemplates', () => {
    it('should provide all default templates', () => {
      const templates = DefaultTemplates.getAll();

      expect(templates.size).toBeGreaterThan(0);
      expect(templates.has('model')).toBe(true);
      expect(templates.has('api-class')).toBe(true);
      expect(templates.has('index')).toBe(true);
      expect(templates.has('configuration')).toBe(true);
    });

    it('should have valid model template', () => {
      const template = DefaultTemplates.MODEL_TEMPLATE;

      expect(template).toContain('{{className}}');
      expect(template).toContain('{{#properties}}');
      expect(template).toContain('attributeTypeMap');
    });

    it('should have valid api-class template', () => {
      const template = DefaultTemplates.API_CLASS_TEMPLATE;

      expect(template).toContain('{{className}}');
      expect(template).toContain('{{#methods}}');
      expect(template).toContain('AxiosInstance');
      expect(template).toContain('Configuration');
    });

    it('should have valid index template', () => {
      const template = DefaultTemplates.INDEX_TEMPLATE;

      expect(template).toContain('{{#exports}}');
      expect(template).toContain('{{fileName}}');
    });

    it('should have valid configuration template', () => {
      const template = DefaultTemplates.CONFIGURATION_TEMPLATE;

      expect(template).toContain('Configuration');
      expect(template).toContain('basePath');
      expect(template).toContain('headers');
    });

    it('should render model template with data', () => {
      const engine = new TemplateEngine({
        defaultTemplates: new Map([['model', DefaultTemplates.MODEL_TEMPLATE]]),
      });

      const result = engine.render('model', {
        className: 'User',
        description: 'User model',
        isGenerated: true,
        properties: [
          {
            name: 'id',
            baseName: 'id',
            type: 'string',
            format: '',
            description: 'User ID',
            required: true,
            last: false,
          },
          {
            name: 'name',
            baseName: 'name',
            type: 'string',
            format: '',
            description: 'User name',
            required: false,
            last: true,
          },
        ],
      });

      expect(result).toContain('export class User');
      expect(result).toContain('id: string;');
      expect(result).toContain('name?: string;');
      expect(result).toContain('attributeTypeMap');
    });
  });

  describe('integration with file system', () => {
    it('should load multiple template files', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'klasik-test-'));

      try {
        fs.writeFileSync(
          path.join(tempDir, 'template1.mustache'),
          'Template 1: {{value}}',
          'utf-8'
        );
        fs.writeFileSync(
          path.join(tempDir, 'template2.mustache'),
          'Template 2: {{value}}',
          'utf-8'
        );

        const engine = new TemplateEngine({ templateDir: tempDir });

        expect(engine.hasTemplate('template1')).toBe(true);
        expect(engine.hasTemplate('template2')).toBe(true);
        expect(engine.render('template1', { value: 'A' })).toBe('Template 1: A');
        expect(engine.render('template2', { value: 'B' })).toBe('Template 2: B');
      } finally {
        fs.unlinkSync(path.join(tempDir, 'template1.mustache'));
        fs.unlinkSync(path.join(tempDir, 'template2.mustache'));
        fs.rmdirSync(tempDir);
      }
    });

    it('should ignore non-mustache files', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'klasik-test-'));

      try {
        fs.writeFileSync(
          path.join(tempDir, 'readme.txt'),
          'Not a template',
          'utf-8'
        );
        fs.writeFileSync(
          path.join(tempDir, 'template.mustache'),
          'Valid {{template}}',
          'utf-8'
        );

        const engine = new TemplateEngine({ templateDir: tempDir });

        expect(engine.hasTemplate('readme')).toBe(false);
        expect(engine.hasTemplate('template')).toBe(true);
      } finally {
        fs.unlinkSync(path.join(tempDir, 'readme.txt'));
        fs.unlinkSync(path.join(tempDir, 'template.mustache'));
        fs.rmdirSync(tempDir);
      }
    });
  });
});
