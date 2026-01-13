/**
 * Template Engine
 *
 * Loads and renders Mustache templates with support for custom template overrides
 */

import * as fs from 'fs';
import * as path from 'path';
import * as Mustache from 'mustache';

export interface TemplateEngineOptions {
  /** Directory containing custom templates */
  templateDir?: string;
  /** Default templates (name -> content) */
  defaultTemplates?: Map<string, string>;
}

/**
 * Template engine for rendering code generation templates
 */
export class TemplateEngine {
  private templates = new Map<string, string>();

  constructor(options: TemplateEngineOptions = {}) {
    // Load default templates first
    if (options.defaultTemplates) {
      for (const [name, content] of options.defaultTemplates) {
        this.templates.set(name, content);
      }
    }

    // Override with custom templates if provided
    if (options.templateDir) {
      this.loadCustomTemplates(options.templateDir);
    }
  }

  /**
   * Render a template with data
   */
  render(templateName: string, data: any): string {
    const template = this.templates.get(templateName);
    if (!template) {
      throw new Error(`Template not found: ${templateName}`);
    }

    return Mustache.render(template, data);
  }

  /**
   * Check if a template exists
   */
  hasTemplate(templateName: string): boolean {
    return this.templates.has(templateName);
  }

  /**
   * Add or update a template
   */
  setTemplate(templateName: string, content: string): void {
    this.templates.set(templateName, content);
  }

  /**
   * Get all template names
   */
  getTemplateNames(): string[] {
    return Array.from(this.templates.keys());
  }

  /**
   * Load custom templates from a directory
   */
  private loadCustomTemplates(templateDir: string): void {
    if (!fs.existsSync(templateDir)) {
      console.warn(`Template directory not found: ${templateDir}`);
      return;
    }

    const files = fs.readdirSync(templateDir);

    for (const file of files) {
      if (file.endsWith('.mustache')) {
        const templateName = file.replace('.mustache', '');
        const filePath = path.join(templateDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        this.templates.set(templateName, content);
        console.log(`Loaded custom template: ${templateName}`);
      }
    }
  }
}

/**
 * Default templates for code generation
 */
export class DefaultTemplates {
  /**
   * Get all default templates
   */
  static getAll(): Map<string, string> {
    const templates = new Map<string, string>();

    templates.set('model', DefaultTemplates.MODEL_TEMPLATE);
    templates.set('api-class', DefaultTemplates.API_CLASS_TEMPLATE);
    templates.set('index', DefaultTemplates.INDEX_TEMPLATE);
    templates.set('configuration', DefaultTemplates.CONFIGURATION_TEMPLATE);

    return templates;
  }

  /**
   * Model class template
   */
  static readonly MODEL_TEMPLATE = `/**
 * {{description}}
 {{#isGenerated}}
 * @generated
 {{/isGenerated}}
 */
export class {{className}} {
{{#properties}}
  /**
   * {{description}}
   {{#required}}@required{{/required}}
   {{#format}}@format {{format}}{{/format}}
   */
  {{name}}{{^required}}?{{/required}}: {{type}};

{{/properties}}
  static readonly discriminator: string | undefined = undefined;

  static readonly attributeTypeMap: Array<{name: string, baseName: string, type: string, format: string}> = [
{{#properties}}
    {
      name: "{{name}}",
      baseName: "{{baseName}}",
      type: "{{type}}",
      format: "{{format}}"
    }{{^last}},{{/last}}
{{/properties}}
  ];

  static getAttributeTypeMap() {
    return {{className}}.attributeTypeMap;
  }
}
`;

  /**
   * API class template
   */
  static readonly API_CLASS_TEMPLATE = `import { AxiosInstance, AxiosResponse, RawAxiosRequestConfig } from 'axios';
import { Configuration } from '../configuration';
import { RequiredError } from '../base';
{{#modelImports}}
import { {{name}} } from '../models/{{fileName}}';
{{/modelImports}}

/**
 * {{className}} - API class
 * {{#description}}
 * {{description}}
 * {{/description}}
 * @export
 */
export class {{className}} {
  protected configuration: Configuration;
  protected axios: AxiosInstance;

  constructor(configuration: Configuration, axios: AxiosInstance) {
    this.configuration = configuration;
    this.axios = axios;
  }

{{#methods}}
  /**
   * {{summary}}
   {{#description}}
   * {{description}}
   {{/description}}
   * @param {{#parameters}}{{{type}}} {{name}} {{#description}}- {{description}}{{/description}}{{#hasMore}}, {{/hasMore}}{{/parameters}}
   * @param {RawAxiosRequestConfig} [options] Override http request option.
   * @throws {RequiredError}
   * @memberof {{../className}}
   */
  async {{methodName}}({{#parameters}}{{name}}{{^required}}?{{/required}}: {{type}}{{#hasMore}}, {{/hasMore}}{{/parameters}}{{#hasParameters}}, {{/hasParameters}}options?: RawAxiosRequestConfig): Promise<AxiosResponse<{{returnType}}>> {
    {{#requiredParams}}
    if ({{name}} === null || {{name}} === undefined) {
      throw new RequiredError('{{name}}', 'Required parameter {{name}} was null or undefined when calling {{methodName}}.');
    }
    {{/requiredParams}}

    const localVarPath = '{{path}}'{{#pathParams}}.replace('{' + '{{baseName}}' + '}', encodeURIComponent(String({{name}}))){{/pathParams}};
    const localVarUrlObj = new URL(localVarPath, this.configuration.basePath);
    const localVarRequestOptions: RawAxiosRequestConfig = { method: '{{method}}', ...options };
    const localVarHeaderParameter = {} as any;
    const localVarQueryParameter = {} as any;

    {{#queryParams}}
    if ({{name}} !== undefined) {
      localVarQueryParameter['{{baseName}}'] = {{name}};
    }
    {{/queryParams}}

    {{#headerParams}}
    if ({{name}} !== undefined && {{name}} !== null) {
      localVarHeaderParameter['{{baseName}}'] = String({{name}});
    }
    {{/headerParams}}

    {{#hasFormParams}}
    localVarHeaderParameter['Content-Type'] = 'multipart/form-data';
    {{/hasFormParams}}

    {{#hasBodyParam}}
    localVarHeaderParameter['Content-Type'] = 'application/json';
    {{/hasBodyParam}}

    // Apply configuration headers
    Object.assign(localVarHeaderParameter, this.configuration.headers);

    {{#hasQueryParams}}
    localVarUrlObj.search = new URLSearchParams(localVarQueryParameter).toString();
    {{/hasQueryParams}}

    localVarRequestOptions.headers = localVarHeaderParameter;
    localVarRequestOptions.url = localVarUrlObj.toString();

    {{#hasBodyParam}}
    localVarRequestOptions.data = {{bodyParam}};
    {{/hasBodyParam}}

    return this.axios.request(localVarRequestOptions);
  }

{{/methods}}
}
`;

  /**
   * Index file template
   */
  static readonly INDEX_TEMPLATE = `{{#exports}}
export * from './{{fileName}}';
{{/exports}}
`;

  /**
   * Configuration class template
   */
  static readonly CONFIGURATION_TEMPLATE = `/**
 * Configuration for API clients
 */
export interface ConfigurationParameters {
  basePath?: string;
  headers?: { [key: string]: string };
  timeout?: number;
  enableResponseTransformation?: boolean;
  onTransformationError?: (error: Error, modelClass: any, data: any) => void;
}

export class Configuration {
  basePath: string;
  headers: { [key: string]: string };
  timeout: number;
  enableResponseTransformation: boolean;
  onTransformationError?: (error: Error, modelClass: any, data: any) => void;

  constructor(params: ConfigurationParameters = {}) {
    this.basePath = params.basePath || '';
    this.headers = params.headers || {};
    this.timeout = params.timeout || 30000;
    this.enableResponseTransformation = params.enableResponseTransformation ?? true;
    this.onTransformationError = params.onTransformationError;
  }
}
`;
}
