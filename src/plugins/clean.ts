/**
 * Clean plugin - removes broken symbolic links
 */

import {
  existsSync,
  lstatSync,
  readdirSync,
  readlinkSync,
  rmSync,
  statSync
} from "fs";
import { resolve, join, dirname, normalize } from "path";
import { Plugin } from "../plugin.ts";
import { normslash } from "../util/common.ts";

export class Clean extends Plugin {
  static override readonly supportsDryRun = true;

  private readonly _directive = "clean";

  canHandle(directive: string): boolean {
    return directive === this._directive;
  }

  handle(directive: string, data: unknown): boolean {
    if (directive !== this._directive) {
      throw new ValueError(`Clean cannot handle directive ${directive}`);
    }
    return this._processClean(data);
  }

  private _processClean(targets: unknown): boolean {
    let success = true;
    const defaults = (this._context.defaults()[this._directive] as Record<string, unknown> | undefined) ?? {};

    // Handle both array and object formats
    const targetEntries: Array<{ target: string; force?: boolean; recursive?: boolean }> = [];

    if (Array.isArray(targets)) {
      for (const target of targets) {
        if (typeof target === "string") {
          targetEntries.push({ target });
        }
      }
    } else if (typeof targets === "object" && targets !== null) {
      for (const [key, value] of Object.entries(targets)) {
        const options =
          value && typeof value === "object"
            ? (value as Record<string, unknown>)
            : {};
        targetEntries.push({
          target: key,
          force: typeof options.force === "boolean" ? options.force : undefined,
          recursive: typeof options.recursive === "boolean" ? options.recursive : undefined,
        });
      }
    }

    for (const { target, force: entryForce, recursive: entryRecursive } of targetEntries) {
      const force = entryForce ?? (defaults.force === true);
      const recursive = entryRecursive ?? (defaults.recursive === true);
      success = this._clean(normslash(target), { force, recursive }) && success;
    }

    if (success) {
      this._log.info("All targets have been cleaned");
    } else {
      this._log.error("Some targets were not successfully cleaned");
    }

    return success;
  }

  private _clean(
    target: string,
    options: { force: boolean; recursive: boolean }
  ): boolean {
    /**
     * Cleans all the broken symbolic links in target if they point to
     * a subdirectory of the base directory or if forced to clean.
     */
    const expandedTarget = this._expandPath(target);

    try {
      const stats = statSync(expandedTarget);
      if (!stats.isDirectory()) {
        this._log.debug(`Ignoring nonexistent directory ${target}`);
        return true;
      }
    } catch {
      this._log.debug(`Ignoring nonexistent directory ${target}`);
      return true;
    }

    const items = readdirSync(expandedTarget);

    for (const item of items) {
      const path = resolve(join(expandedTarget, item));

      // Check if it's a directory and recurse if needed
      if (options.recursive) {
        try {
          const stats = statSync(path);
          if (stats.isDirectory()) {
            // isDirectory implies not a symlink - we don't descend into symlinked directories
            this._clean(path, options);
          }
        } catch {
          // Path doesn't exist or can't be accessed, continue
        }
      }

      // Check if it's a broken symlink
      try {
        const linkStats = lstatSync(path);
        if (linkStats.isSymbolicLink()) {
          // Check if the link target exists
          if (!existsSync(path)) {
            // Broken symlink
            const linkTarget = readlinkSync(path);
            let pointsAt = normalize(join(dirname(path), linkTarget));

            // Handle Windows \\?\ prefix
            if (process.platform === "win32" && pointsAt.startsWith("\\\\?\\")) {
              pointsAt = pointsAt.slice(4);
            }

            if (this._inDirectory(path, this._context.baseDirectory()) || options.force) {
              if (this._context.dryRun()) {
                this._log.action(`Would remove invalid link ${path} -> ${pointsAt}`);
              } else {
                this._log.action(`Removing invalid link ${path} -> ${pointsAt}`);
                rmSync(path);
              }
            } else {
              this._log.info(`Link ${path} -> ${pointsAt} not removed.`);
            }
          }
        }
      } catch {
        // Error accessing path, skip it
      }
    }

    return true;
  }

  private _inDirectory(path: string, directory: string): boolean {
    /**
     * Returns true if the path is in the directory
     */
    const dir = normalize(resolve(directory)) + "/";
    const filePath = normalize(resolve(path));

    // Check if path starts with directory
    return filePath.startsWith(dir) || filePath === dir.slice(0, -1);
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
