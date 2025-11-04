/**
 * String utility functions
 */

export function indentLines(
  string: string,
  amount: number = 2,
  delimiter: string = "\n"
): string {
  const whitespace = " ".repeat(amount);
  const sep = `${delimiter}${whitespace}`;
  return `${whitespace}${string.split(delimiter).join(sep)}`;
}
