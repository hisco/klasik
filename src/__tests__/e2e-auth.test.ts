/**
 * E2E Tests for Authentication Headers
 *
 * Tests that authentication headers are properly passed when loading specs
 */

import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import { SpecLoader } from '../loaders/spec-loader';
import { OpenAPIParser } from '../parsers/openapi-parser';
import { Generator } from '../generator/generator';

const TEST_OUTPUT_DIR = path.join(__dirname, '../../test-output-auth');
const TEST_PORT = 39876;

describe('E2E: Authentication Headers', () => {
  let server: http.Server;
  let receivedHeaders: Record<string, string> = {};

  beforeAll((done) => {
    // Create a mock HTTP server that requires auth
    server = http.createServer((req, res) => {
      // Capture headers
      receivedHeaders = {};
      Object.keys(req.headers).forEach(key => {
        receivedHeaders[key] = req.headers[key] as string;
      });

      // Check for authorization header
      if (!req.headers.authorization || req.headers.authorization !== 'Bearer test-token-123') {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }

      // Check for custom header
      if (req.headers['x-api-key'] !== 'custom-api-key') {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid API Key' }));
        return;
      }

      // Return a simple OpenAPI spec
      const spec = {
        openapi: '3.0.0',
        info: {
          title: 'Authenticated API',
          version: '1.0.0',
        },
        components: {
          schemas: {
            SecureUser: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                username: { type: 'string' },
                email: { type: 'string' },
              },
              required: ['id', 'username'],
            },
          },
        },
      };

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(spec));
    });

    server.listen(TEST_PORT, done);
  });

  afterAll((done) => {
    server.close(done);

    // Clean up test output
    if (fs.existsSync(TEST_OUTPUT_DIR)) {
      fs.rmSync(TEST_OUTPUT_DIR, { recursive: true });
    }
  });

  beforeEach(() => {
    receivedHeaders = {};

    // Clean test output directory
    if (fs.existsSync(TEST_OUTPUT_DIR)) {
      fs.rmSync(TEST_OUTPUT_DIR, { recursive: true });
    }
    fs.mkdirSync(TEST_OUTPUT_DIR, { recursive: true });
  });

  it('should fail to load spec without authentication', async () => {
    const loader = new SpecLoader();

    await expect(
      loader.load({
        url: `http://localhost:${TEST_PORT}/api/spec`,
        timeout: 5000,
      })
    ).rejects.toThrow();
  });

  it('should successfully load spec with authentication headers', async () => {
    const loader = new SpecLoader();

    const spec = await loader.load({
      url: `http://localhost:${TEST_PORT}/api/spec`,
      headers: {
        'Authorization': 'Bearer test-token-123',
        'X-API-Key': 'custom-api-key',
      },
      timeout: 5000,
    });

    expect(spec).toBeDefined();
    expect(spec.info.title).toBe('Authenticated API');
    expect(spec.components.schemas.SecureUser).toBeDefined();
  });

  it('should pass authentication headers through the full pipeline', async () => {
    const outputDir = path.join(TEST_OUTPUT_DIR, 'with-auth');

    const loader = new SpecLoader();
    const spec = await loader.load({
      url: `http://localhost:${TEST_PORT}/api/spec`,
      headers: {
        'Authorization': 'Bearer test-token-123',
        'X-API-Key': 'custom-api-key',
      },
      timeout: 5000,
    });

    // Verify headers were received by server
    expect(receivedHeaders.authorization).toBe('Bearer test-token-123');
    expect(receivedHeaders['x-api-key']).toBe('custom-api-key');

    // Parse and generate
    const parser = new OpenAPIParser();
    const ir = parser.parse(spec);

    const generator = new Generator({ outputDir });
    await generator.generate(ir);

    // Verify file was generated
    const userFilePath = path.join(outputDir, 'models', 'secure-user.ts');
    expect(fs.existsSync(userFilePath)).toBe(true);

    const fileContent = fs.readFileSync(userFilePath, 'utf-8');
    expect(fileContent).toContain('export class SecureUser');
    expect(fileContent).toContain("'id': string");
    expect(fileContent).toContain("'username': string");
  });

  it('should handle Bearer token authentication', async () => {
    const loader = new SpecLoader();

    const spec = await loader.load({
      url: `http://localhost:${TEST_PORT}/api/spec`,
      headers: {
        'Authorization': 'Bearer test-token-123',
        'X-API-Key': 'custom-api-key',
      },
      timeout: 5000,
    });

    expect(receivedHeaders.authorization).toBe('Bearer test-token-123');
    expect(spec).toBeDefined();
  });

  it('should handle multiple custom headers', async () => {
    const loader = new SpecLoader();

    const spec = await loader.load({
      url: `http://localhost:${TEST_PORT}/api/spec`,
      headers: {
        'Authorization': 'Bearer test-token-123',
        'X-API-Key': 'custom-api-key',
        'X-Custom-Header': 'custom-value',
        'X-Another-Header': 'another-value',
      },
      timeout: 5000,
    });

    expect(receivedHeaders.authorization).toBe('Bearer test-token-123');
    expect(receivedHeaders['x-api-key']).toBe('custom-api-key');
    expect(receivedHeaders['x-custom-header']).toBe('custom-value');
    expect(receivedHeaders['x-another-header']).toBe('another-value');
    expect(spec).toBeDefined();
  });

  it('should fail with incorrect API key', async () => {
    const loader = new SpecLoader();

    await expect(
      loader.load({
        url: `http://localhost:${TEST_PORT}/api/spec`,
        headers: {
          'Authorization': 'Bearer test-token-123',
          'X-API-Key': 'wrong-api-key',
        },
        timeout: 5000,
      })
    ).rejects.toThrow();
  });

  it('should fail with incorrect bearer token', async () => {
    const loader = new SpecLoader();

    await expect(
      loader.load({
        url: `http://localhost:${TEST_PORT}/api/spec`,
        headers: {
          'Authorization': 'Bearer wrong-token',
          'X-API-Key': 'custom-api-key',
        },
        timeout: 5000,
      })
    ).rejects.toThrow();
  });

  it('should handle case-insensitive header names', async () => {
    const loader = new SpecLoader();

    const spec = await loader.load({
      url: `http://localhost:${TEST_PORT}/api/spec`,
      headers: {
        'authorization': 'Bearer test-token-123', // lowercase
        'x-api-key': 'custom-api-key', // lowercase
      },
      timeout: 5000,
    });

    expect(spec).toBeDefined();
    expect(receivedHeaders.authorization).toBe('Bearer test-token-123');
  });
});
