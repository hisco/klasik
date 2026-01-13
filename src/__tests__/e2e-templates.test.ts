/**
 * E2E Tests for Custom Templates
 *
 * Tests that custom template directories work correctly and override defaults
 */

import * as fs from 'fs';
import * as path from 'path';
import { TemplateEngine, DefaultTemplates } from '../templates/template-engine';

const TEST_TEMPLATE_DIR = path.join(__dirname, '../../test-templates');

describe('E2E: Custom Templates', () => {
  beforeEach(() => {
    // Clean test template directory
    if (fs.existsSync(TEST_TEMPLATE_DIR)) {
      fs.rmSync(TEST_TEMPLATE_DIR, { recursive: true });
    }
    fs.mkdirSync(TEST_TEMPLATE_DIR, { recursive: true });
  });

  afterEach(() => {
    // Clean up test templates
    if (fs.existsSync(TEST_TEMPLATE_DIR)) {
      fs.rmSync(TEST_TEMPLATE_DIR, { recursive: true });
    }
  });

  it('should load default templates', () => {
    const engine = new TemplateEngine({
      defaultTemplates: DefaultTemplates.getAll(),
    });

    expect(engine.hasTemplate('model')).toBe(true);
    expect(engine.hasTemplate('api-class')).toBe(true);
    expect(engine.hasTemplate('index')).toBe(true);
    expect(engine.hasTemplate('configuration')).toBe(true);
  });

  it('should render default model template', () => {
    const engine = new TemplateEngine({
      defaultTemplates: DefaultTemplates.getAll(),
    });

    const result = engine.render('model', {
      description: 'Test model',
      className: 'TestModel',
      properties: [
        {
          name: 'id',
          description: 'ID field',
          required: true,
          type: 'string',
          baseName: 'id',
          format: '',
        },
        {
          name: 'name',
          description: 'Name field',
          required: true,
          type: 'string',
          baseName: 'name',
          format: '',
          last: true,
        },
      ],
    });

    expect(result).toContain('export class TestModel');
    expect(result).toContain('id: string');
    expect(result).toContain('name: string');
    expect(result).toContain('attributeTypeMap');
  });

  it('should load custom template from directory', () => {
    // Create a custom template
    const customTemplate = `// Custom Model Template
export class {{className}} {
  // This is a custom template
}`;

    fs.writeFileSync(
      path.join(TEST_TEMPLATE_DIR, 'model.mustache'),
      customTemplate,
      'utf-8'
    );

    const engine = new TemplateEngine({
      defaultTemplates: DefaultTemplates.getAll(),
      templateDir: TEST_TEMPLATE_DIR,
    });

    const result = engine.render('model', {
      className: 'CustomModel',
    });

    expect(result).toContain('// Custom Model Template');
    expect(result).toContain('export class CustomModel');
    expect(result).toContain('// This is a custom template');
  });

  it('should override default template with custom template', () => {
    // Create a custom template that overrides the default
    const customTemplate = `/**
 * CUSTOM TEMPLATE: {{className}}
 */
export class {{className}} {
  customField: string = 'custom';
}`;

    fs.writeFileSync(
      path.join(TEST_TEMPLATE_DIR, 'model.mustache'),
      customTemplate,
      'utf-8'
    );

    const engine = new TemplateEngine({
      defaultTemplates: DefaultTemplates.getAll(),
      templateDir: TEST_TEMPLATE_DIR,
    });

    const result = engine.render('model', {
      className: 'OverriddenModel',
    });

    // Should use custom template, not default
    expect(result).toContain('CUSTOM TEMPLATE: OverriddenModel');
    expect(result).toContain('customField: string');
    expect(result).not.toContain('attributeTypeMap'); // Default template feature
  });

  it('should load multiple custom templates', () => {
    // Create multiple custom templates
    const modelTemplate = `export class {{className}} {}`;
    const indexTemplate = `// Custom index\n{{#exports}}export * from './{{fileName}}';\n{{/exports}}`;

    fs.writeFileSync(
      path.join(TEST_TEMPLATE_DIR, 'model.mustache'),
      modelTemplate,
      'utf-8'
    );
    fs.writeFileSync(
      path.join(TEST_TEMPLATE_DIR, 'index.mustache'),
      indexTemplate,
      'utf-8'
    );

    const engine = new TemplateEngine({
      defaultTemplates: DefaultTemplates.getAll(),
      templateDir: TEST_TEMPLATE_DIR,
    });

    // Test model template
    const modelResult = engine.render('model', { className: 'TestModel' });
    expect(modelResult).toContain('export class TestModel');

    // Test index template
    const indexResult = engine.render('index', {
      exports: [
        { fileName: 'user' },
        { fileName: 'product' },
      ],
    });
    expect(indexResult).toContain('// Custom index');
    expect(indexResult).toContain("export * from './user'");
    expect(indexResult).toContain("export * from './product'");
  });

  it('should handle non-existent template directory gracefully', () => {
    const nonExistentDir = path.join(TEST_TEMPLATE_DIR, 'non-existent');

    // Should not throw, just warn
    const engine = new TemplateEngine({
      defaultTemplates: DefaultTemplates.getAll(),
      templateDir: nonExistentDir,
    });

    // Should still have default templates
    expect(engine.hasTemplate('model')).toBe(true);
  });

  it('should support complex template data', () => {
    const customTemplate = `export class {{className}} {
{{#properties}}
  {{#description}}// {{description}}{{/description}}
  {{name}}{{^required}}?{{/required}}: {{type}};
{{/properties}}

  static methods = [
{{#methods}}
    '{{name}}'{{^last}},{{/last}}
{{/methods}}
  ];
}`;

    fs.writeFileSync(
      path.join(TEST_TEMPLATE_DIR, 'model.mustache'),
      customTemplate,
      'utf-8'
    );

    const engine = new TemplateEngine({
      templateDir: TEST_TEMPLATE_DIR,
    });

    const result = engine.render('model', {
      className: 'ComplexModel',
      properties: [
        { name: 'id', type: 'string', required: true, description: 'Unique ID' },
        { name: 'name', type: 'string', required: false, description: 'User name' },
      ],
      methods: [
        { name: 'save' },
        { name: 'delete', last: true },
      ],
    });

    expect(result).toContain('export class ComplexModel');
    expect(result).toContain('// Unique ID');
    expect(result).toContain('id: string');
    expect(result).toContain('name?: string');
    expect(result).toContain("'save',");
    expect(result).toContain("'delete'");
  });

  it('should add template dynamically', () => {
    const engine = new TemplateEngine();

    engine.setTemplate('custom', 'Hello {{name}}!');

    const result = engine.render('custom', { name: 'World' });
    expect(result).toBe('Hello World!');
  });

  it('should list all template names', () => {
    const engine = new TemplateEngine({
      defaultTemplates: DefaultTemplates.getAll(),
    });

    const names = engine.getTemplateNames();
    expect(names).toContain('model');
    expect(names).toContain('api-class');
    expect(names).toContain('index');
    expect(names).toContain('configuration');
    expect(names.length).toBe(4);
  });

  it('should throw error for non-existent template', () => {
    const engine = new TemplateEngine();

    expect(() => {
      engine.render('non-existent', {});
    }).toThrow('Template not found: non-existent');
  });

  it('should handle empty template directory', () => {
    // Create empty directory
    fs.mkdirSync(TEST_TEMPLATE_DIR, { recursive: true });

    const engine = new TemplateEngine({
      defaultTemplates: DefaultTemplates.getAll(),
      templateDir: TEST_TEMPLATE_DIR,
    });

    // Should still have default templates
    expect(engine.hasTemplate('model')).toBe(true);
  });

  it('should ignore non-mustache files in template directory', () => {
    // Create various files
    fs.writeFileSync(
      path.join(TEST_TEMPLATE_DIR, 'model.mustache'),
      'Model: {{name}}',
      'utf-8'
    );
    fs.writeFileSync(
      path.join(TEST_TEMPLATE_DIR, 'readme.md'),
      '# README',
      'utf-8'
    );
    fs.writeFileSync(
      path.join(TEST_TEMPLATE_DIR, 'config.json'),
      '{}',
      'utf-8'
    );

    const engine = new TemplateEngine({
      templateDir: TEST_TEMPLATE_DIR,
    });

    expect(engine.hasTemplate('model')).toBe(true);
    expect(engine.hasTemplate('readme')).toBe(false);
    expect(engine.hasTemplate('config')).toBe(false);
  });

  it('should handle template with no variables', () => {
    const simpleTemplate = `export class StaticClass {
  static value = 42;
}`;

    fs.writeFileSync(
      path.join(TEST_TEMPLATE_DIR, 'static.mustache'),
      simpleTemplate,
      'utf-8'
    );

    const engine = new TemplateEngine({
      templateDir: TEST_TEMPLATE_DIR,
    });

    const result = engine.render('static', {});
    expect(result).toBe(simpleTemplate);
  });

  it('should support nested template variables', () => {
    const nestedTemplate = `{{#user}}
Name: {{name}}
{{#address}}
  City: {{city}}
  {{#coordinates}}
    Lat: {{lat}}, Lng: {{lng}}
  {{/coordinates}}
{{/address}}
{{/user}}`;

    fs.writeFileSync(
      path.join(TEST_TEMPLATE_DIR, 'nested.mustache'),
      nestedTemplate,
      'utf-8'
    );

    const engine = new TemplateEngine({
      templateDir: TEST_TEMPLATE_DIR,
    });

    const result = engine.render('nested', {
      user: {
        name: 'John Doe',
        address: {
          city: 'New York',
          coordinates: {
            lat: 40.7128,
            lng: -74.0060,
          },
        },
      },
    });

    expect(result).toContain('Name: John Doe');
    expect(result).toContain('City: New York');
    expect(result).toContain('Lat: 40.7128, Lng: -74.006');
  });
});
