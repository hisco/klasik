import { Logger } from '../logger';
import chalk from 'chalk';

describe('Logger', () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let originalDebugEnv: string | undefined;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    originalDebugEnv = process.env.DEBUG;
    Logger.disableDebug();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    process.env.DEBUG = originalDebugEnv;
  });

  describe('info', () => {
    it('should log blue message', () => {
      Logger.info('Test info message');

      expect(consoleLogSpy).toHaveBeenCalledWith(chalk.blue('Test info message'));
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    });

    it('should handle empty message', () => {
      Logger.info('');

      expect(consoleLogSpy).toHaveBeenCalledWith(chalk.blue(''));
    });
  });

  describe('success', () => {
    it('should log green message', () => {
      Logger.success('Test success message');

      expect(consoleLogSpy).toHaveBeenCalledWith(chalk.green('Test success message'));
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    });

    it('should handle multiline message', () => {
      const message = 'Line 1\nLine 2';
      Logger.success(message);

      expect(consoleLogSpy).toHaveBeenCalledWith(chalk.green(message));
    });
  });

  describe('error', () => {
    it('should log red message to stderr', () => {
      Logger.error('Test error message');

      expect(consoleErrorSpy).toHaveBeenCalledWith(chalk.red('Test error message'));
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });

    it('should handle error with special characters', () => {
      Logger.error('Error: $#@!%');

      expect(consoleErrorSpy).toHaveBeenCalledWith(chalk.red('Error: $#@!%'));
    });
  });

  describe('warn', () => {
    it('should log yellow message to stderr', () => {
      Logger.warn('Test warning message');

      expect(consoleWarnSpy).toHaveBeenCalledWith(chalk.yellow('Test warning message'));
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('debug', () => {
    it('should not log when debug is disabled', () => {
      Logger.debug('Debug message');

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should log gray message when debug is enabled via method', () => {
      Logger.enableDebug();
      Logger.debug('Debug message');

      expect(consoleLogSpy).toHaveBeenCalledWith(chalk.gray('[DEBUG] Debug message'));
    });

    it('should log when DEBUG env var is "true"', () => {
      process.env.DEBUG = 'true';
      // Re-import or reinitialize to pick up env var
      Logger.enableDebug();
      Logger.debug('Debug message');

      expect(consoleLogSpy).toHaveBeenCalledWith(chalk.gray('[DEBUG] Debug message'));
    });

    it('should log when DEBUG env var is "1"', () => {
      process.env.DEBUG = '1';
      Logger.enableDebug();
      Logger.debug('Debug message');

      expect(consoleLogSpy).toHaveBeenCalledWith(chalk.gray('[DEBUG] Debug message'));
    });

    it('should not log when DEBUG env var is "false"', () => {
      process.env.DEBUG = 'false';
      Logger.disableDebug();
      Logger.debug('Debug message');

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });

  describe('section', () => {
    it('should log section header with underline', () => {
      Logger.section('Test Section');

      expect(consoleLogSpy).toHaveBeenCalledTimes(3);
      expect(consoleLogSpy).toHaveBeenNthCalledWith(1); // Empty line
      expect(consoleLogSpy).toHaveBeenNthCalledWith(2, chalk.bold.cyan('Test Section'));
      expect(consoleLogSpy).toHaveBeenNthCalledWith(3, chalk.cyan('============'));
    });

    it('should adjust underline length to title', () => {
      Logger.section('Short');

      expect(consoleLogSpy).toHaveBeenCalledTimes(3);
      expect(consoleLogSpy).toHaveBeenNthCalledWith(2, chalk.bold.cyan('Short'));
      expect(consoleLogSpy).toHaveBeenNthCalledWith(3, chalk.cyan('====='));
    });

    it('should handle empty title', () => {
      Logger.section('');

      expect(consoleLogSpy).toHaveBeenCalledTimes(3);
      expect(consoleLogSpy).toHaveBeenNthCalledWith(2, chalk.bold.cyan(''));
      expect(consoleLogSpy).toHaveBeenNthCalledWith(3, chalk.cyan(''));
    });
  });

  describe('detail', () => {
    it('should log label and value', () => {
      Logger.detail('Output', '/path/to/output');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        `${chalk.dim('Output:')} /path/to/output`
      );
    });

    it('should handle empty value', () => {
      Logger.detail('Label', '');

      expect(consoleLogSpy).toHaveBeenCalledWith(`${chalk.dim('Label:')} `);
    });

    it('should handle empty label', () => {
      Logger.detail('', 'value');

      expect(consoleLogSpy).toHaveBeenCalledWith(`${chalk.dim(':')} value`);
    });
  });

  describe('enableDebug', () => {
    it('should enable debug mode', () => {
      expect(Logger.isDebug()).toBe(false);

      Logger.enableDebug();

      expect(Logger.isDebug()).toBe(true);
    });

    it('should allow debug messages after enabling', () => {
      Logger.enableDebug();
      Logger.debug('Test message');

      expect(consoleLogSpy).toHaveBeenCalledWith(chalk.gray('[DEBUG] Test message'));
    });
  });

  describe('disableDebug', () => {
    it('should disable debug mode', () => {
      Logger.enableDebug();
      expect(Logger.isDebug()).toBe(true);

      Logger.disableDebug();

      expect(Logger.isDebug()).toBe(false);
    });

    it('should prevent debug messages after disabling', () => {
      Logger.enableDebug();
      Logger.disableDebug();
      Logger.debug('Test message');

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });

  describe('isDebug', () => {
    it('should return false by default', () => {
      expect(Logger.isDebug()).toBe(false);
    });

    it('should return true when enabled', () => {
      Logger.enableDebug();

      expect(Logger.isDebug()).toBe(true);
    });

    it('should return false when disabled', () => {
      Logger.enableDebug();
      Logger.disableDebug();

      expect(Logger.isDebug()).toBe(false);
    });
  });

  describe('multiple calls', () => {
    it('should handle multiple info calls', () => {
      Logger.info('Message 1');
      Logger.info('Message 2');
      Logger.info('Message 3');

      expect(consoleLogSpy).toHaveBeenCalledTimes(3);
    });

    it('should handle mixed message types', () => {
      Logger.info('Info');
      Logger.success('Success');
      Logger.warn('Warning');
      Logger.error('Error');

      expect(consoleLogSpy).toHaveBeenCalledTimes(2);
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });
  });
});
