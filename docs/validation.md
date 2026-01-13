# Request and Response Validation Guide

## Overview

Klasik provides automatic runtime validation of both API requests and responses using class-validator. This ensures that:
- **Requests**: Data sent to APIs is valid before transmission
- **Responses**: Data received from APIs matches the expected schema

## How It Works

### Response Validation
1. **Generation**: When using `--class-validator` flag, Klasik generates validation decorators
2. **Transformation**: Responses are transformed to class instances using class-transformer
3. **Validation**: Instances are validated using class-validator's `validate()` function
4. **Error Handling**: Validation failures throw errors or invoke custom callbacks

### Request Validation
1. **Instance Check**: Verify request body is an instance of the expected class
2. **Validation**: Validate the instance using class-validator's `validate()` function
3. **Error Handling**: Failures throw errors or invoke custom callbacks
4. **Transmission**: Only valid requests are sent to the server

## Configuration Options

### Request Validation

#### `enableRequestValidation`

- **Type**: `boolean`
- **Default**: `false`
- **Description**: Enable automatic validation of API request bodies

#### `onRequestValidationError`

- **Type**: `(errors: any[], modelClass: any, instance: any) => void`
- **Default**: `undefined`
- **Description**: Custom callback for request validation errors

### Response Validation

#### `enableResponseValidation`

- **Type**: `boolean`
- **Default**: `false`
- **Description**: Enable automatic validation of API responses

#### `onResponseValidationError`

- **Type**: `(errors: ValidationError[], modelClass: any, instance: any) => void`
- **Default**: `undefined`
- **Description**: Custom callback for response validation errors

## Generated Decorators

When `--class-validator` is enabled, Klasik generates:

### Type Validators
- `@IsString()` - String properties
- `@IsNumber()` - Numeric properties
- `@IsBoolean()` - Boolean properties
- `@IsArray()` - Array properties
- `@ValidateNested()` - Nested objects

### Format Validators
- `@IsEmail()` - Email format
- `@IsUrl()` - URL format
- `@IsUUID()` - UUID format
- `@IsDate()` - Date/datetime format

### Constraint Validators
- `@Min(n)` / `@Max(n)` - Numeric ranges
- `@MinLength(n)` / `@MaxLength(n)` - String length
- `@Matches(pattern)` - Regex patterns
- `@ArrayMinSize(n)` / `@ArrayMaxSize(n)` - Array size
- `@ArrayUnique()` - Unique array items

### Optional Properties
- `@IsOptional()` - For optional/nullable properties

## Usage Examples

### Basic Usage

```typescript
const config = new Configuration({
  basePath: 'https://api.example.com',
  enableRequestValidation: true,
  enableResponseValidation: true
});

const api = new UsersApi(config);

// Create and validate request
const newUser = new CreateUserRequest();
newUser.name = 'John Doe';
newUser.email = 'john@example.com';

// Validates request before sending, validates response after receiving
const user = await api.createUser(newUser);
```

### Request Validation Only

```typescript
const config = new Configuration({
  enableRequestValidation: true  // Only validate outgoing requests
});

const api = new UsersApi(config);

// Must use class instances
const newUser = new CreateUserRequest();
newUser.name = 'John Doe';
await api.createUser(newUser);  // Validated before sending
```

### Response Validation Only

```typescript
const config = new Configuration({
  enableResponseValidation: true  // Only validate incoming responses
});

const api = new UsersApi(config);
const users = await api.listUsers();  // Response validated
```

### With Error Callbacks

```typescript
const config = new Configuration({
  enableRequestValidation: true,
  onRequestValidationError: (errors, modelClass, instance) => {
    logger.error(`Request validation failed for ${modelClass.name}`, { errors });
  },
  enableResponseValidation: true,
  onResponseValidationError: (errors, modelClass, instance) => {
    logger.error(`Response validation failed for ${modelClass.name}`, { errors });
  }
});
```

### Handling Validation Errors

```typescript
import { ValidationError, RequestNotInstanceError } from './generated/runtime/response-transformer';

try {
  const newUser = new CreateUserRequest();
  newUser.name = '';  // Invalid
  await api.createUser(newUser);
} catch (error) {
  if (error instanceof RequestNotInstanceError) {
    console.error('Request must be a class instance');
  } else if (error instanceof ValidationError) {
    console.error(`Validation failed for ${error.modelClass.name}`);
    error.validationErrors.forEach(err => {
      console.error(`  ${err.property}:`, err.constraints);
    });
  }
}
```

## Best Practices

1. **Enable During Development**: Use validation in development to catch API contract changes
2. **Custom Callbacks in Production**: Log validation errors to monitoring services
3. **Graceful Degradation**: Use callbacks to handle errors without blocking user flow
4. **Generate with --class-validator**: Always use this flag for validation support
5. **Use Class Instances**: Always instantiate request classes (e.g., `new CreateUserRequest()`)
6. **Validate Both Directions**: Enable both request and response validation for maximum safety

## Performance Considerations

- Both validations are async
- Request validation runs before sending (adds latency before transmission)
- Response validation runs after transformation
- Array validation runs in parallel for better performance
- Both are opt-in (disabled by default) for minimal overhead
- Gracefully skips if models lack validation decorators

## Troubleshooting

### Request Validation not running

Check that:
1. Models generated with `--class-validator` flag
2. `enableRequestValidation: true` in Configuration
3. Request body is a class instance (not plain object)
4. `class-validator` package is installed

### Response Validation not running

Check that:
1. Models generated with `--class-validator` flag
2. `enableResponseValidation: true` in Configuration
3. `enableResponseTransformation` is not disabled
4. `class-validator` package is installed

### "Request must be an instance" errors

- Use `new ModelClass()` instead of plain objects: `{ field: 'value' }`
- Transform plain objects first: `plainToInstance(ModelClass, plainObject)`

### Validation always passes

- Verify decorators are present in generated models
- Check that constraints match your API schema
- Ensure nested objects have `@ValidateNested()` decorator

## CLI Usage

Generate models with validation decorators:

```bash
klasik generate \
  --url https://api.example.com/openapi.json \
  --output ./src/generated \
  --class-validator
```

Then use in your code:

```typescript
import { Configuration, TasksApi, NewTask } from './generated';

const config = new Configuration({
  basePath: 'https://api.example.com',
  enableRequestValidation: true,
  enableResponseValidation: true
});

const api = new TasksApi(config);

// Request will be validated
const newTask = new NewTask();
newTask.title = 'My Task';
const created = await api.createTask(newTask);

// Response will be validated
const tasks = await api.listTasks();
```

## Examples

### Validation in NestJS

```typescript
import { Injectable } from '@nestjs/common';
import { Configuration, UsersApi } from './generated';

@Injectable()
export class UserService {
  private api: UsersApi;

  constructor() {
    const config = new Configuration({
      basePath: process.env.API_BASE_URL,
      enableRequestValidation: true,
      enableResponseValidation: true,
      onRequestValidationError: (errors, modelClass, instance) => {
        this.logger.error('Request validation failed', { errors });
      },
      onResponseValidationError: (errors, modelClass, instance) => {
        this.logger.error('Response validation failed', { errors });
      }
    });

    this.api = new UsersApi(config);
  }

  async createUser(userData: CreateUserDto) {
    const newUser = new CreateUserRequest();
    Object.assign(newUser, userData);

    return await this.api.createUser(newUser);
  }
}
```

### Validation with Monitoring

```typescript
import * as Sentry from '@sentry/node';

const config = new Configuration({
  basePath: 'https://api.example.com',
  enableRequestValidation: true,
  enableResponseValidation: true,
  onRequestValidationError: (errors, modelClass, instance) => {
    Sentry.captureException(new Error('Request validation failed'), {
      extra: {
        modelClass: modelClass.name,
        errors: errors.map(e => e.toString()),
        instance
      }
    });
  },
  onResponseValidationError: (errors, modelClass, instance) => {
    Sentry.captureException(new Error('Response validation failed'), {
      extra: {
        modelClass: modelClass.name,
        errors: errors.map(e => e.property),
        instance
      }
    });
  }
});
```

## Advanced Configuration

### Selective Validation

You can enable validation per-request by cloning the configuration:

```typescript
const baseConfig = new Configuration({
  basePath: 'https://api.example.com',
  enableRequestValidation: false,
  enableResponseValidation: false
});

// Enable for specific request
const validatedConfig = baseConfig.clone({
  enableRequestValidation: true,
  enableResponseValidation: true
});

const api = new UsersApi(validatedConfig);
await api.createUser(newUser);  // This request is validated
```

### Environment-Based Configuration

```typescript
const config = new Configuration({
  basePath: process.env.API_BASE_URL,
  // Enable in development, disable in production
  enableRequestValidation: process.env.NODE_ENV === 'development',
  enableResponseValidation: process.env.NODE_ENV === 'development',
  // Always log errors
  onRequestValidationError: (errors, modelClass) => {
    console.error(`Request validation failed for ${modelClass.name}`, errors);
  },
  onResponseValidationError: (errors, modelClass) => {
    console.error(`Response validation failed for ${modelClass.name}`, errors);
  }
});
```
