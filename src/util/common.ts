/**
 * Common utility functions
 */

import { spawn } from "bun";
import { platform } from "os";

export interface ShellCommandOptions {
  cwd?: string;
  enableStdin?: boolean;
  enableStdout?: boolean;
  enableStderr?: boolean;
}

/**
 * Execute a shell command
 * @param command The shell command to execute
 * @param options Command execution options
 * @returns The exit code of the command
 */
export async function shellCommand(
  command: string,
  options: ShellCommandOptions = {}
): Promise<number> {
  const {
    cwd,
    enableStdin = false,
    enableStdout = false,
    enableStderr = false,
  } = options;

  // Determine the shell to use
  let shell: string;
  let shellArgs: string[];

  if (platform() === "win32") {
    // On Windows, we don't set a custom shell because it causes issues
    // with argument parsing. See:
    // https://github.com/anishathalye/dotbot/issues/219
    // This means complex commands may need to be wrapped like: bash -c "..."
    shell = process.env.COMSPEC || "cmd.exe";
    shellArgs = ["/c", command];
  } else {
    // On Unix-like systems, use SHELL env var or default to sh
    shell = process.env.SHELL || "/bin/sh";
    shellArgs = ["-c", command];
  }

  const proc = spawn([shell, ...shellArgs], {
    cwd: cwd || process.cwd(),
    stdin: enableStdin ? "inherit" : "ignore",
    stdout: enableStdout ? "inherit" : "ignore",
    stderr: enableStderr ? "inherit" : "ignore",
  });

  return await proc.exited;
}

/**
 * Normalize path slashes for the current platform
 * @param path The path to normalize
 * @returns Path with platform-appropriate slashes
 */
export function normslash(path: string): string {
  if (process.platform === "win32") {
    // On Windows, convert forward slashes to backslashes
    // (same as ntpath.normcase in Python, but without lowercasing)
    return path.replace(/\//g, "\\");
  }
  return path;
}
