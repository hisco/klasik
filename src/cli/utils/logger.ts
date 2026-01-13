import chalk from 'chalk';

/**
 * CLI Logger utility with colored output
 */
export class Logger {
  private static isDebugEnabled = process.env.DEBUG === 'true' || process.env.DEBUG === '1';

  /**
   * Log informational message
   */
  static info(message: string): void {
    console.log(chalk.blue(message));
  }

  /**
   * Log success message
   */
  static success(message: string): void {
    console.log(chalk.green(message));
  }

  /**
   * Log error message
   */
  static error(message: string): void {
    console.error(chalk.red(message));
  }

  /**
   * Log warning message
   */
  static warn(message: string): void {
    console.warn(chalk.yellow(message));
  }

  /**
   * Log debug message (only if DEBUG env var is set)
   */
  static debug(message: string): void {
    if (this.isDebugEnabled) {
      console.log(chalk.gray(`[DEBUG] ${message}`));
    }
  }

  /**
   * Log section header
   */
  static section(title: string): void {
    console.log();
    console.log(chalk.bold.cyan(title));
    console.log(chalk.cyan('='.repeat(title.length)));
  }

  /**
   * Log detail line with label and value
   */
  static detail(label: string, value: string): void {
    console.log(`${chalk.dim(label + ':')} ${value}`);
  }

  /**
   * Enable debug mode programmatically
   */
  static enableDebug(): void {
    this.isDebugEnabled = true;
  }

  /**
   * Disable debug mode programmatically
   */
  static disableDebug(): void {
    this.isDebugEnabled = false;
  }

  /**
   * Check if debug mode is enabled
   */
  static isDebug(): boolean {
    return this.isDebugEnabled;
  }
}
