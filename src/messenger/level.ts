/**
 * Logging levels with comparison support
 */

export enum Level {
  NOTSET = 0,
  DEBUG = 10,
  INFO = 15,
  LOWINFO = 15, // Deprecated: use INFO instead
  ACTION = 20,
  WARNING = 30,
  ERROR = 40,
}

/**
 * Compare two log levels
 */
export function compareLevels(a: Level, b: Level): number {
  return a - b;
}

/**
 * Check if level a is less than level b
 */
export function isLessThan(a: Level, b: Level): boolean {
  return a < b;
}

/**
 * Check if level a is less than or equal to level b
 */
export function isLessThanOrEqual(a: Level, b: Level): boolean {
  return a <= b;
}

/**
 * Check if level a is greater than level b
 */
export function isGreaterThan(a: Level, b: Level): boolean {
  return a > b;
}

/**
 * Check if level a is greater than or equal to level b
 */
export function isGreaterThanOrEqual(a: Level, b: Level): boolean {
  return a >= b;
}
