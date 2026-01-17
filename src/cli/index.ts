#!/usr/bin/env node
import { Command } from 'commander';
import { generateCommand } from './commands/generate';
import { downloadCommand } from './commands/download';
import { generateCrdCommand } from './commands/generate-crd';
import { generateJsonSchemaCommand } from './commands/generate-jsonschema';
import { generateGoCommand } from './commands/generate-go';

const program = new Command();

program
  .name('klasik')
  .description('TypeScript client generator for OpenAPI, CRDs, JSON Schema, and Go structs')
  .version('2.0.0');

// Add commands
program.addCommand(generateCommand);
program.addCommand(downloadCommand);
program.addCommand(generateCrdCommand);
program.addCommand(generateJsonSchemaCommand);
program.addCommand(generateGoCommand);

// Show help if no command is provided
if (process.argv.length === 2) {
  program.outputHelp();
  process.exit(0);
}

program.parse(process.argv);
