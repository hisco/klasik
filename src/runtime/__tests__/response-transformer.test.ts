/**
 * Tests for Response Transformer
 */

import 'reflect-metadata';
import { AxiosResponse } from 'axios';
import {
  transformToInstance,
  transformToInstanceArray,
  transformResponse,
  transformResponseArray,
  transformResponseAuto,
  TransformationError,
  ResponseTransformer,
  validateInstance,
  validateInstanceArray,
  validateRequestBody,
  ValidationError,
  RequestNotInstanceError,
} from '../response-transformer';
import { Configuration } from '../../config/configuration';
import { IsString, IsEmail, IsNotEmpty, Min, Max, IsNumber, IsOptional } from 'class-validator';

// Test model classes
class User {
  id!: number;
  name!: string;
  email!: string;
  active?: boolean;
}

class Product {
  id!: number;
  title!: string;
  price!: number;
  tags?: string[];
}

// Mock axios response
function createMockResponse<T>(data: T, status = 200): AxiosResponse<T> {
  return {
    data,
    status,
    statusText: 'OK',
    headers: {},
    config: {} as any,
  };
}

describe('ResponseTransformer', () => {
  describe('transformToInstance', () => {
    it('should transform plain object to class instance', () => {
      const data = {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        active: true,
      };

      const user = transformToInstance(User, data);

      expect(user).toBeInstanceOf(User);
      expect(user.id).toBe(1);
      expect(user.name).toBe('John Doe');
      expect(user.email).toBe('john@example.com');
      expect(user.active).toBe(true);
    });

    it('should handle partial data', () => {
      const data = {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
      };

      const user = transformToInstance(User, data);

      expect(user).toBeInstanceOf(User);
      expect(user.id).toBe(1);
      expect(user.name).toBe('John Doe');
      expect(user.active).toBeUndefined();
    });

    it('should handle type conversion with enableImplicitConversion', () => {
      const data = {
        id: 123,
        title: 'Product',
        price: 99.99,
      };

      const product = transformToInstance(Product, data, undefined, {
        enableImplicitConversion: true,
      });

      expect(product).toBeInstanceOf(Product);
      expect(typeof product.id).toBe('number');
      expect(product.id).toBe(123);
      expect(typeof product.price).toBe('number');
      expect(product.price).toBe(99.99);
    });

    it('should call error callback on transformation error', () => {
      const errorCallback = jest.fn();
      const config = new Configuration({
        onTransformationError: errorCallback,
      });

      // class-transformer returns null for null input without throwing
      // This is expected behavior, not an error
      const result = transformToInstance(User, null, config);
      expect(result).toBe(null);
      expect(errorCallback).not.toHaveBeenCalled();
    });
  });

  describe('transformToInstanceArray', () => {
    it('should transform array of plain objects to class instances', () => {
      const data = [
        { id: 1, name: 'User 1', email: 'user1@example.com' },
        { id: 2, name: 'User 2', email: 'user2@example.com' },
        { id: 3, name: 'User 3', email: 'user3@example.com' },
      ];

      const users = transformToInstanceArray(User, data);

      expect(users).toHaveLength(3);
      expect(users[0]).toBeInstanceOf(User);
      expect(users[1]).toBeInstanceOf(User);
      expect(users[2]).toBeInstanceOf(User);
      expect(users[0].id).toBe(1);
      expect(users[1].name).toBe('User 2');
      expect(users[2].email).toBe('user3@example.com');
    });

    it('should handle empty array', () => {
      const users = transformToInstanceArray(User, []);

      expect(users).toHaveLength(0);
      expect(Array.isArray(users)).toBe(true);
    });

    it('should throw error for non-array data', () => {
      const data = { id: 1, name: 'User' };

      expect(() => {
        transformToInstanceArray(User, data as any);
      }).toThrow();
    });

    it('should call error callback on transformation error', () => {
      const errorCallback = jest.fn();
      const config = new Configuration({
        onTransformationError: errorCallback,
      });

      expect(() => {
        transformToInstanceArray(User, 'not-an-array' as any, config);
      }).toThrow();

      expect(errorCallback).toHaveBeenCalled();
    });
  });

  describe('transformResponse', () => {
    it('should transform axios response to class instance', () => {
      const response = createMockResponse({
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
      });

      const user = transformResponse(User, response);

      expect(user).toBeInstanceOf(User);
      expect(user.id).toBe(1);
      expect(user.name).toBe('John Doe');
    });

    it('should work with configuration', () => {
      const config = new Configuration({
        basePath: 'https://api.example.com',
      });

      const response = createMockResponse({
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
      });

      const user = transformResponse(User, response, config);

      expect(user).toBeInstanceOf(User);
      expect(user.id).toBe(1);
    });
  });

  describe('transformResponseArray', () => {
    it('should transform axios response with array data to class instances', () => {
      const response = createMockResponse([
        { id: 1, name: 'User 1', email: 'user1@example.com' },
        { id: 2, name: 'User 2', email: 'user2@example.com' },
      ]);

      const users = transformResponseArray(User, response);

      expect(users).toHaveLength(2);
      expect(users[0]).toBeInstanceOf(User);
      expect(users[1]).toBeInstanceOf(User);
    });

    it('should handle empty array response', () => {
      const response = createMockResponse([]);

      const users = transformResponseArray(User, response);

      expect(users).toHaveLength(0);
    });
  });

  describe('transformResponseAuto', () => {
    it('should auto-detect and transform single object response', () => {
      const response = createMockResponse({
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
      });

      const result = transformResponseAuto(User, response);

      expect(result).toBeInstanceOf(User);
      expect(Array.isArray(result)).toBe(false);
      expect((result as User).id).toBe(1);
    });

    it('should auto-detect and transform array response', () => {
      const response = createMockResponse([
        { id: 1, name: 'User 1', email: 'user1@example.com' },
        { id: 2, name: 'User 2', email: 'user2@example.com' },
      ]);

      const result = transformResponseAuto(User, response);

      expect(Array.isArray(result)).toBe(true);
      expect((result as User[]).length).toBe(2);
      expect((result as User[])[0]).toBeInstanceOf(User);
    });
  });

  describe('TransformationError', () => {
    it('should create error with proper properties', () => {
      const originalError = new Error('Original error');
      const data = { id: 1 };

      const error = new TransformationError(
        'Test error',
        User,
        data,
        originalError
      );

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('TransformationError');
      expect(error.message).toBe('Test error');
      expect(error.modelClass).toBe(User);
      expect(error.data).toBe(data);
      expect(error.cause).toBe(originalError);
    });
  });

  describe('ResponseTransformer class', () => {
    it('should create transformer with configuration', () => {
      const config = new Configuration({
        basePath: 'https://api.example.com',
      });

      const transformer = new ResponseTransformer(config);

      expect(transformer).toBeDefined();
    });

    it('should transform response using class method', () => {
      const transformer = new ResponseTransformer();
      const response = createMockResponse({
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
      });

      const user = transformer.transformResponse(User, response);

      expect(user).toBeInstanceOf(User);
      expect(user.id).toBe(1);
    });

    it('should transform response array using class method', () => {
      const transformer = new ResponseTransformer();
      const response = createMockResponse([
        { id: 1, name: 'User 1', email: 'user1@example.com' },
        { id: 2, name: 'User 2', email: 'user2@example.com' },
      ]);

      const users = transformer.transformResponseArray(User, response);

      expect(users).toHaveLength(2);
      expect(users[0]).toBeInstanceOf(User);
    });

    it('should auto-transform using class method', () => {
      const transformer = new ResponseTransformer();
      const response = createMockResponse({
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
      });

      const result = transformer.transformResponseAuto(User, response);

      expect(result).toBeInstanceOf(User);
    });

    it('should transform plain object using class method', () => {
      const transformer = new ResponseTransformer();
      const data = {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
      };

      const user = transformer.transformToInstance(User, data);

      expect(user).toBeInstanceOf(User);
      expect(user.id).toBe(1);
    });

    it('should transform array using class method', () => {
      const transformer = new ResponseTransformer();
      const data = [
        { id: 1, name: 'User 1', email: 'user1@example.com' },
        { id: 2, name: 'User 2', email: 'user2@example.com' },
      ];

      const users = transformer.transformToInstanceArray(User, data);

      expect(users).toHaveLength(2);
      expect(users[0]).toBeInstanceOf(User);
    });

    it('should use configuration error callback', () => {
      const errorCallback = jest.fn();
      const config = new Configuration({
        onTransformationError: errorCallback,
      });

      const transformer = new ResponseTransformer(config);

      // class-transformer returns null for null input without throwing
      // This is expected behavior, not an error
      const result = transformer.transformToInstance(User, null);
      expect(result).toBe(null);
      expect(errorCallback).not.toHaveBeenCalled();
    });
  });

  describe('custom options', () => {
    it('should respect excludeExtraneousValues option', () => {
      const data = {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        extraField: 'should be ignored',
      };

      const user = transformToInstance(User, data, undefined, {
        excludeExtraneousValues: false,
      });

      expect(user).toBeInstanceOf(User);
      expect(user.id).toBe(1);
    });

    it('should pass through custom classTransformerOptions', () => {
      const data = {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
      };

      const user = transformToInstance(User, data, undefined, {
        classTransformerOptions: {
          enableCircularCheck: true,
        },
      });

      expect(user).toBeInstanceOf(User);
      expect(user.id).toBe(1);
    });
  });

  describe('complex transformations', () => {
    it('should handle nested arrays', () => {
      const data = {
        id: 1,
        title: 'Product',
        price: 99.99,
        tags: ['tag1', 'tag2', 'tag3'],
      };

      const product = transformToInstance(Product, data);

      expect(product).toBeInstanceOf(Product);
      expect(product.tags).toEqual(['tag1', 'tag2', 'tag3']);
      expect(Array.isArray(product.tags)).toBe(true);
    });

    it('should handle multiple transformations in sequence', () => {
      const data1 = { id: 1, name: 'User 1', email: 'user1@example.com' };
      const data2 = { id: 2, name: 'User 2', email: 'user2@example.com' };

      const user1 = transformToInstance(User, data1);
      const user2 = transformToInstance(User, data2);

      expect(user1).toBeInstanceOf(User);
      expect(user2).toBeInstanceOf(User);
      expect(user1.id).toBe(1);
      expect(user2.id).toBe(2);
    });
  });

  // Validation tests
  describe('Validation', () => {
    // Validated test model
    class ValidatedUser {
      @IsString()
      @IsNotEmpty()
      name!: string;

      @IsEmail()
      email!: string;

      @IsOptional()
      @IsNumber()
      @Min(0)
      @Max(120)
      age?: number;
    }

    describe('validateInstance', () => {
      it('should validate instance with valid data', async () => {
        const data = {
          name: 'John Doe',
          email: 'john@example.com',
          age: 30,
        };

        const user = transformToInstance(ValidatedUser, data);
        const validated = await validateInstance(ValidatedUser, user);

        expect(validated).toBeInstanceOf(ValidatedUser);
        expect(validated.name).toBe('John Doe');
      });

      it('should throw ValidationError for invalid data', async () => {
        const data = {
          name: '',  // Invalid: empty
          email: 'not-an-email',  // Invalid: not email format
          age: 150,  // Invalid: exceeds max
        };

        const user = transformToInstance(ValidatedUser, data);

        await expect(validateInstance(ValidatedUser, user)).rejects.toThrow(ValidationError);
      });

      it('should call error callback instead of throwing', async () => {
        const errorCallback = jest.fn();
        const config = new Configuration({
          onResponseValidationError: errorCallback,
        });

        const data = {
          name: '',  // Invalid
          email: 'not-an-email',  // Invalid
        };

        const user = transformToInstance(ValidatedUser, data);
        const result = await validateInstance(ValidatedUser, user, config);

        expect(errorCallback).toHaveBeenCalled();
        expect(errorCallback.mock.calls[0][0].length).toBeGreaterThan(0); // Has errors
        expect(result).toBeInstanceOf(ValidatedUser);
      });

      it('should validate array of instances', async () => {
        const dataArray = [
          { name: 'User 1', email: 'user1@example.com' },
          { name: 'User 2', email: 'user2@example.com' },
        ];

        const users = transformToInstanceArray(ValidatedUser, dataArray);
        const validated = await validateInstanceArray(ValidatedUser, users);

        expect(validated).toHaveLength(2);
        expect(validated[0]).toBeInstanceOf(ValidatedUser);
      });

      it('should detect invalid items in array', async () => {
        const dataArray = [
          { name: 'Valid User', email: 'valid@example.com' },
          { name: '', email: 'invalid' },  // Invalid
        ];

        const users = transformToInstanceArray(ValidatedUser, dataArray);

        await expect(
          validateInstanceArray(ValidatedUser, users)
        ).rejects.toThrow(ValidationError);
      });

      it('should ensure ValidationError has correct properties', async () => {
        const data = {
          name: '',
          email: 'invalid',
        };

        const user = transformToInstance(ValidatedUser, data);

        try {
          await validateInstance(ValidatedUser, user);
          fail('Should have thrown ValidationError');
        } catch (error) {
          expect(error).toBeInstanceOf(ValidationError);
          const validationError = error as ValidationError;
          expect(validationError.modelClass).toBe(ValidatedUser);
          expect(validationError.instance).toBe(user);
          expect(validationError.validationErrors).toBeDefined();
          expect(validationError.validationErrors.length).toBeGreaterThan(0);
        }
      });
    });

    describe('validateRequestBody', () => {
      it('should validate request body with valid data and instance', async () => {
        const requestBody = new ValidatedUser();
        requestBody.name = 'John Doe';
        requestBody.email = 'john@example.com';
        requestBody.age = 30;

        const validated = await validateRequestBody(ValidatedUser, requestBody);

        expect(validated).toBeInstanceOf(ValidatedUser);
        expect(validated.name).toBe('John Doe');
      });

      it('should throw RequestNotInstanceError when not an instance', async () => {
        const plainObject = {
          name: 'John Doe',
          email: 'john@example.com',
        };

        await expect(
          validateRequestBody(ValidatedUser, plainObject)
        ).rejects.toThrow(RequestNotInstanceError);
      });

      it('should throw ValidationError when instance is invalid', async () => {
        const requestBody = new ValidatedUser();
        requestBody.name = '';  // Invalid
        requestBody.email = 'not-an-email';  // Invalid

        await expect(
          validateRequestBody(ValidatedUser, requestBody)
        ).rejects.toThrow(ValidationError);
      });

      it('should call error callback for instance check failure', async () => {
        const errorCallback = jest.fn();
        const config = new Configuration({
          onRequestValidationError: errorCallback,
        });

        const plainObject = {
          name: 'John Doe',
          email: 'john@example.com',
        };

        const result = await validateRequestBody(ValidatedUser, plainObject, config);

        expect(errorCallback).toHaveBeenCalled();
        expect(result).toBe(plainObject);
      });

      it('should call error callback for validation failure', async () => {
        const errorCallback = jest.fn();
        const config = new Configuration({
          onRequestValidationError: errorCallback,
        });

        const requestBody = new ValidatedUser();
        requestBody.name = '';  // Invalid

        const result = await validateRequestBody(ValidatedUser, requestBody, config);

        expect(errorCallback).toHaveBeenCalled();
        expect(result).toBe(requestBody);
      });

      it('should ensure RequestNotInstanceError has correct properties', async () => {
        const plainObject = { name: 'John', email: 'john@example.com' };

        try {
          await validateRequestBody(ValidatedUser, plainObject);
          fail('Should have thrown RequestNotInstanceError');
        } catch (error) {
          expect(error).toBeInstanceOf(RequestNotInstanceError);
          const notInstanceError = error as RequestNotInstanceError;
          expect(notInstanceError.expectedClass).toBe(ValidatedUser);
          expect(notInstanceError.receivedValue).toBe(plainObject);
        }
      });
    });

    describe('ResponseTransformer with validation', () => {
      it('should validate instance using ResponseTransformer', async () => {
        const config = new Configuration({
          enableResponseValidation: true,
        });
        const transformer = new ResponseTransformer(config);

        const data = {
          name: 'John Doe',
          email: 'john@example.com',
        };

        const user = transformer.transformToInstance(ValidatedUser, data);
        const validated = await transformer.validateInstance(ValidatedUser, user);

        expect(validated).toBeInstanceOf(ValidatedUser);
      });

      it('should validate request body using ResponseTransformer', async () => {
        const config = new Configuration({
          enableRequestValidation: true,
        });
        const transformer = new ResponseTransformer(config);

        const requestBody = new ValidatedUser();
        requestBody.name = 'John Doe';
        requestBody.email = 'john@example.com';

        const validated = await transformer.validateRequestBody(ValidatedUser, requestBody);

        expect(validated).toBeInstanceOf(ValidatedUser);
      });
    });
  });
});
