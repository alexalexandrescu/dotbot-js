/**
 * Shell plugin - executes shell commands
 */

import { Plugin } from "../plugin.ts";
import { shellCommand } from "../util/common.ts";

export class Shell extends Plugin {
  static override readonly supportsDryRun = true;

  private readonly _directive = "shell";
  private _hasShownOverrideMessage = false;

  canHandle(directive: string): boolean {
    return directive === this._directive;
  }

  async handle(directive: string, data: unknown): Promise<boolean> {
    if (directive !== this._directive) {
      throw new ValueError(`Shell cannot handle directive ${directive}`);
    }
    return await this._processCommands(data);
  }

  private async _processCommands(data: unknown): Promise<boolean> {
    let success = true;
    const defaults = (this._context.defaults().shell as Record<string, unknown> | undefined) ?? {};
    const options = this._getOptionOverrides();

    if (!Array.isArray(data)) {
      this._log.error("Shell commands must be an array");
      return false;
    }

    for (const item of data) {
      let cmd: string;
      let msg: string | null = null;
      let stdin = defaults.stdin === true;
      let stdout = defaults.stdout === true;
      let stderr = defaults.stderr === true;
      let quiet = defaults.quiet === true;

      if (typeof item === "object" && item !== null && "command" in item) {
        // Dictionary format
        const itemObj = item as Record<string, unknown>;
        cmd = String(itemObj.command);
        msg = itemObj.description !== undefined ? String(itemObj.description) : null;
        stdin = itemObj.stdin !== undefined ? Boolean(itemObj.stdin) : stdin;
        stdout = itemObj.stdout !== undefined ? Boolean(itemObj.stdout) : stdout;
        stderr = itemObj.stderr !== undefined ? Boolean(itemObj.stderr) : stderr;
        quiet = itemObj.quiet !== undefined ? Boolean(itemObj.quiet) : quiet;
      } else if (Array.isArray(item)) {
        // Array format [command, description?]
        cmd = String(item[0]);
        msg = item.length > 1 ? String(item[1]) : null;
      } else {
        // String format
        cmd = String(item);
      }

      const prefix = this._context.dryRun() ? "Would run command " : "";

      if (quiet) {
        if (msg !== null) {
          this._log.info(`${prefix}${msg}`);
        }
        // if quiet and no msg, show nothing
      } else if (msg === null) {
        this._log.action(`${prefix}${cmd}`);
      } else {
        this._log.action(`${prefix}${msg} [${cmd}]`);
      }

      if (this._context.dryRun()) {
        continue;
      }

      // Apply option overrides
      stdout = options.stdout ?? stdout;
      stderr = options.stderr ?? stderr;

      const ret = await shellCommand(cmd, {
        cwd: this._context.baseDirectory(),
        enableStdin: stdin,
        enableStdout: stdout,
        enableStderr: stderr,
      });

      if (ret !== 0) {
        success = false;
        this._log.warning(`Command [${cmd}] failed`);
      }
    }

    if (success) {
      this._log.info("All commands have been executed");
    } else {
      this._log.error("Some commands were not successfully executed");
    }

    return success;
  }

  private _getOptionOverrides(): { stdout?: boolean; stderr?: boolean } {
    const ret: { stdout?: boolean; stderr?: boolean } = {};
    const options = this._context.options();

    if ((options.verbose ?? 0) > 1) {
      ret.stderr = true;
      ret.stdout = true;
      if (!this._hasShownOverrideMessage) {
        this._log.debug("Shell: Found cli option to force show stderr and stdout.");
        this._hasShownOverrideMessage = true;
      }
    }

    return ret;
  }
}

class ValueError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValueError";
  }
}
