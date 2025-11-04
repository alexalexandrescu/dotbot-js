/**
 * Create plugin - creates empty directories
 */

import { existsSync, mkdirSync, chmodSync } from "fs";
import { resolve } from "path";
import { Plugin } from "../plugin.ts";
import { normslash } from "../util/common.ts";

export class Create extends Plugin {
  static override readonly supportsDryRun = true;

  private readonly _directive = "create";

  canHandle(directive: string): boolean {
    return directive === this._directive;
  }

  handle(directive: string, data: unknown): boolean {
    if (directive !== this._directive) {
      throw new ValueError(`Create cannot handle directive ${directive}`);
    }
    return this._processPaths(data);
  }

  private _processPaths(paths: unknown): boolean {
    let success = true;
    const defaults = (this._context.defaults().create as Record<string, unknown> | undefined) ?? {};

    // Handle both array and object formats
    const pathEntries: Array<{ path: string; mode?: number }> = [];

    if (Array.isArray(paths)) {
      // Array format: just a list of paths
      for (const path of paths) {
        if (typeof path === "string") {
          pathEntries.push({ path });
        }
      }
    } else if (typeof paths === "object" && paths !== null) {
      // Object format: paths as keys, options as values
      for (const [key, value] of Object.entries(paths)) {
        const options =
          value && typeof value === "object"
            ? (value as Record<string, unknown>)
            : {};
        pathEntries.push({
          path: key,
          mode: typeof options.mode === "number" ? options.mode : undefined,
        });
      }
    }

    for (const { path: key, mode: entryMode } of pathEntries) {
      const path = resolve(
        this._expandPath(normslash(key))
      );
      // Default mode is 0o777 (same as os.makedirs default)
      const defaultMode = typeof defaults.mode === "number" ? defaults.mode : 0o777;
      const mode = entryMode ?? defaultMode;

      success = this._create(path, mode) && success;
    }

    if (success) {
      this._log.info("All paths have been set up");
    } else {
      this._log.error("Some paths were not successfully set up");
    }

    return success;
  }

  private _exists(path: string): boolean {
    return existsSync(this._expandPath(path));
  }

  private _create(path: string, mode: number): boolean {
    if (!this._exists(path)) {
      this._log.debug(`Trying to create path ${path} with mode ${mode.toString(8)}`);

      try {
        if (this._context.dryRun()) {
          this._log.action(`Would create path ${path}`);
          return true;
        }

        this._log.action(`Creating path ${path}`);
        mkdirSync(path, { recursive: true, mode });

        // On Windows, the mode argument may be ignored
        // Set it explicitly in a follow-up call
        chmodSync(path, mode);

        return true;
      } catch (error) {
        this._log.warning(`Failed to create path ${path}`);
        return false;
      }
    } else {
      this._log.info(`Path exists ${path}`);
      return true;
    }
  }

  private _expandPath(path: string): string {
    // Expand environment variables
    let expanded = path.replace(/\$\{?([A-Za-z0-9_]+)\}?/g, (_, varName) => {
      return process.env[varName] || "";
    });

    // Expand ~ to home directory
    if (expanded.startsWith("~")) {
      const home = process.env.HOME || process.env.USERPROFILE || "";
      expanded = expanded.replace(/^~/, home);
    }

    return expanded;
  }
}

class ValueError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValueError";
  }
}
