/**
 * Main Entry Point Tests
 * Verifies all public exports are accessible
 */

import * as klasik from '../index';

describe('Main index exports', () => {
  it('should export Generator', () => {
    expect(klasik.Generator).toBeDefined();
    expect(typeof klasik.Generator).toBe('function');
  });

  it('should export OpenAPIParser', () => {
    expect(klasik.OpenAPIParser).toBeDefined();
    expect(typeof klasik.OpenAPIParser).toBe('function');
  });

  it('should export CRDParser', () => {
    expect(klasik.CRDParser).toBeDefined();
    expect(typeof klasik.CRDParser).toBe('function');
  });

  it('should export JsonSchemaParser', () => {
    expect(klasik.JsonSchemaParser).toBeDefined();
    expect(typeof klasik.JsonSchemaParser).toBe('function');
  });

  it('should export Configuration', () => {
    expect(klasik.Configuration).toBeDefined();
    expect(typeof klasik.Configuration).toBe('function');
  });

  it('should export ClassValidatorPlugin', () => {
    expect(klasik.ClassValidatorPlugin).toBeDefined();
  });

  it('should export ClassTransformerPlugin', () => {
    expect(klasik.ClassTransformerPlugin).toBeDefined();
  });

  it('should export NestJSSwaggerPlugin', () => {
    expect(klasik.NestJSSwaggerPlugin).toBeDefined();
  });

  it('should export SpecLoader', () => {
    expect(klasik.SpecLoader).toBeDefined();
    expect(typeof klasik.SpecLoader).toBe('function');
  });

  it('should export RefResolver', () => {
    expect(klasik.RefResolver).toBeDefined();
    expect(typeof klasik.RefResolver).toBe('function');
  });

  it('should export RefInliner', () => {
    expect(klasik.RefInliner).toBeDefined();
    expect(typeof klasik.RefInliner).toBe('function');
  });

  it('should export ClassBuilder', () => {
    expect(klasik.ClassBuilder).toBeDefined();
    expect(typeof klasik.ClassBuilder).toBe('function');
  });

  it('should export ImportManager', () => {
    expect(klasik.ImportManager).toBeDefined();
    expect(typeof klasik.ImportManager).toBe('function');
  });

  it('should export CRDToIRConverter', () => {
    expect(klasik.CRDToIRConverter).toBeDefined();
    expect(typeof klasik.CRDToIRConverter).toBe('function');
  });

  it('should export PluginRegistry', () => {
    expect(klasik.PluginRegistry).toBeDefined();
    expect(typeof klasik.PluginRegistry).toBe('function');
  });

  it('should export PluginRunner', () => {
    expect(klasik.PluginRunner).toBeDefined();
    expect(typeof klasik.PluginRunner).toBe('function');
  });

  it('should export name utilities', () => {
    expect(klasik.toPascalCase).toBeDefined();
    expect(typeof klasik.toPascalCase).toBe('function');
  });

  it('should export IR types', () => {
    expect(klasik.IRHelpers).toBeDefined();
    expect(typeof klasik.IRHelpers.createSchemaIR).toBe('function');
  });
});
