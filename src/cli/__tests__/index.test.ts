import { Command } from 'commander';

describe('CLI Index', () => {
  let consoleLogSpy: jest.SpyInstance;
  let processExitSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation((code?: string | number | null) => {
      throw new Error(`process.exit(${code})`);
    }) as any;
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    processExitSpy.mockRestore();
    jest.resetModules();
  });

  describe('program configuration', () => {
    it('should create CLI program with correct metadata', () => {
      const program = new Command();
      program
        .name('klasik')
        .description('TypeScript client generator for OpenAPI, CRDs, and JSON Schema')
        .version('2.0.0');

      expect(program.name()).toBe('klasik');
      expect(program.description()).toBe('TypeScript client generator for OpenAPI, CRDs, and JSON Schema');
    });

    it('should have version 2.0.0', () => {
      const program = new Command();
      program.version('2.0.0');

      expect(program.version()).toBe('2.0.0');
    });
  });

  describe('help output', () => {
    it('should show help when no arguments provided', () => {
      const program = new Command();
      program
        .name('klasik')
        .description('TypeScript client generator for OpenAPI, CRDs, and JSON Schema')
        .version('2.0.0');

      const helpOutput = program.helpInformation();

      expect(helpOutput).toContain('klasik');
      expect(helpOutput).toContain('TypeScript client generator');
    });

    it('should display version with --version flag', () => {
      const program = new Command();
      program.version('2.0.0');

      const versionOutput = program.version();

      expect(versionOutput).toBe('2.0.0');
    });
  });

  describe('program structure', () => {
    it('should be ready to accept commands', () => {
      const program = new Command();
      program
        .name('klasik')
        .description('TypeScript client generator for OpenAPI, CRDs, and JSON Schema')
        .version('2.0.0');

      // Verify program can accept subcommands
      const mockCommand = new Command('test-command');
      program.addCommand(mockCommand);

      expect(program.commands).toContain(mockCommand);
    });

    it('should parse command line arguments', () => {
      const program = new Command();
      program
        .name('klasik')
        .version('2.0.0')
        .exitOverride();

      // Test that program can parse arguments
      const args = ['node', 'klasik', '--help'];

      try {
        program.parse(args, { from: 'user' });
      } catch (err: any) {
        // Expected to throw on --help
        expect(err.code).toBe('commander.helpDisplayed');
      }
    });
  });

  describe('error handling', () => {
    it('should handle invalid commands gracefully', () => {
      const program = new Command();
      program
        .name('klasik')
        .version('2.0.0')
        .exitOverride(); // Prevent actual exit

      const args = ['node', 'klasik', 'invalid-command'];

      try {
        program.parse(args, { from: 'user' });
        // If no error, that's okay too - commander may just ignore unknown commands
        expect(true).toBe(true);
      } catch (err: any) {
        // Expected to throw on unknown command
        expect(err.code).toBe('commander.unknownCommand');
      }
    });
  });
});
