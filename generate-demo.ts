import { OpenAPIParser } from './src/parsers/openapi-parser';
import { Generator } from './src/generator/generator';

const taskApiSpec = {
  openapi: '3.0.0',
  info: {
    title: 'Task Management API',
    version: '1.0.0'
  },
  paths: {
    '/tasks': {
      get: {
        operationId: 'listTasks',
        summary: 'List all tasks',
        tags: ['tasks'],
        parameters: [
          {
            name: 'status',
            in: 'query',
            required: false,
            schema: { type: 'string', enum: ['pending', 'completed'] }
          }
        ],
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Task' }
                }
              }
            }
          }
        }
      },
      post: {
        operationId: 'createTask',
        summary: 'Create a new task',
        tags: ['tasks'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/NewTask' }
            }
          }
        },
        responses: {
          '201': {
            description: 'Created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Task' }
              }
            }
          }
        }
      }
    },
    '/tasks/{id}': {
      get: {
        operationId: 'getTaskById',
        summary: 'Get task by ID',
        tags: ['tasks'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          }
        ],
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Task' }
              }
            }
          }
        }
      }
    }
  },
  components: {
    schemas: {
      Task: {
        type: 'object',
        required: ['id', 'title', 'status', 'createdAt'],
        properties: {
          id: { type: 'string', description: 'Task ID' },
          title: { type: 'string', description: 'Task title', minLength: 1, maxLength: 100 },
          description: { type: 'string', description: 'Task description' },
          status: { type: 'string', enum: ['pending', 'completed'], description: 'Task status' },
          priority: { type: 'number', minimum: 1, maximum: 5, description: 'Task priority' },
          createdAt: { type: 'string', format: 'date-time', description: 'Creation timestamp' },
          assignee: { $ref: '#/components/schemas/User' }
        }
      },
      NewTask: {
        type: 'object',
        required: ['title', 'status'],
        properties: {
          title: { type: 'string', minLength: 1 },
          description: { type: 'string' },
          status: { type: 'string', enum: ['pending', 'completed'] },
          priority: { type: 'number', minimum: 1, maximum: 5 }
        }
      },
      User: {
        type: 'object',
        required: ['id', 'email'],
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string', format: 'email' }
        }
      }
    }
  }
};

async function generateDemo() {
  const parser = new OpenAPIParser();
  const ir = parser.parse(taskApiSpec as any, { includeOperations: true });

  const generator = new Generator({
    outputDir: './demo-generated',
    mode: 'full',
    esm: false,
    classValidator: true,
    nestJsSwagger: false
  });

  await generator.generate(ir);
  console.log('✅ Generated code to: ./demo-generated');
  console.log('\nYou can now read the generated files:');
  console.log('  - Models: ./demo-generated/models/');
  console.log('  - APIs: ./demo-generated/apis/');
  console.log('  - Configuration: ./demo-generated/configuration.ts');
  console.log('  - Base: ./demo-generated/base.ts');
}

generateDemo().catch(console.error);
