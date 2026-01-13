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
 * Convert kebab-case, snake_case, or preserve PascalCase
 * Example: "app-project" -> "AppProject", "AppProject" -> "AppProject"
 */
export function toPascalCase(str: string): string {
  // If the string contains hyphens or underscores, split on them
  if (str.includes('-') || str.includes('_')) {
    return str
      .split(/[-_]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  }

  // Otherwise, check if it's already PascalCase or camelCase
  // Split on case transitions (e.g., "AppProject" -> ["App", "Project"])
  const words = str.split(/(?=[A-Z])/).filter(word => word.length > 0);

  // If we found multiple words (PascalCase/camelCase), preserve them
  if (words.length > 1) {
    return words
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  }

  // Single word: just capitalize first letter
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
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
