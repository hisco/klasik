/**
 * Name utility functions
 *
 * Functions for transforming names between different cases
 */

/**
 * Convert PascalCase or camelCase to kebab-case
 * Example: "AppProject" -> "app-project"
 */
export function toKebabCase(str: string): string {
  return str
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

/**
 * Convert PascalCase or camelCase to snake_case
 * Example: "AppProject" -> "app_project"
 */
export function toSnakeCase(str: string): string {
  return str
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();
}

/**
 * Convert kebab-case or snake_case to PascalCase
 * Example: "app-project" -> "AppProject"
 */
export function toPascalCase(str: string): string {
  return str
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

/**
 * Convert kebab-case or snake_case to camelCase
 * Example: "app-project" -> "appProject"
 */
export function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

/**
 * Sanitize a name to be a valid JavaScript identifier
 * Removes or replaces invalid characters
 */
export function sanitizeIdentifier(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9_$]/g, '_')
    .replace(/^([0-9])/, '_$1'); // Can't start with number
}

/**
 * Ensure a name is unique within a set
 * Appends numbers if needed: "User" -> "User2", "User3", etc.
 */
export function makeUnique(name: string, existingNames: Set<string>): string {
  if (!existingNames.has(name)) {
    return name;
  }

  let counter = 2;
  let uniqueName = `${name}${counter}`;

  while (existingNames.has(uniqueName)) {
    counter++;
    uniqueName = `${name}${counter}`;
  }

  return uniqueName;
}
