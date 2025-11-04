/**
 * Dispatcher - orchestrates task execution across plugins
 */

import { existsSync, statSync } from "fs";
import { resolve } from "path";
import type { CLIOptions, Context } from "./context.ts";
import { Context as ContextClass } from "./context.ts";
import { Messenger } from "./messenger/messenger.ts";
import type { Plugin, PluginConstructor } from "./plugin.ts";
import { loadPlugins } from "./util/module.ts";

export class DispatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DispatchError";
  }
}

export class Dispatcher {
  private _log: Messenger;
  private _context!: Context;  // Will be initialized in _setupContext
  private _plugins: Plugin[];
  private _only?: string[];
  private _skip?: string[];
  private _exit: boolean;
  private _dryRun: boolean;

  constructor(
    baseDirectory: string,
    options: {
      only?: string[];
      skip?: string[];
      exitOnFailure?: boolean;
      options?: CLIOptions;
      plugins?: PluginConstructor[];
    } = {}
  ) {
    this._log = new Messenger();
    this._setupContext(baseDirectory, options.options, options.plugins);

    const plugins = options.plugins ?? [];
    this._plugins = plugins.map(PluginClass => new PluginClass(this._context));
    this._only = options.only;
    this._skip = options.skip;
    this._exit = options.exitOnFailure ?? false;
    this._dryRun = options.options?.dryRun ?? false;
  }

  private _setupContext(
    baseDirectory: string,
    options?: CLIOptions,
    plugins?: PluginConstructor[]
  ): void {
    const path = resolve(baseDirectory);

    if (!existsSync(path)) {
      throw new DispatchError("Nonexistent base directory");
    }

    const stats = statSync(path);
    if (!stats.isDirectory()) {
      throw new DispatchError("Base directory is not a directory");
    }

    this._context = new ContextClass(path, options, plugins);
  }

  async dispatch(tasks: unknown[]): Promise<boolean> {
    let success = true;

    for (const task of tasks) {
      if (typeof task !== "object" || task === null) {
        this._log.error("Invalid task format");
        success = false;
        continue;
      }

      for (const [action, data] of Object.entries(task)) {
        // Check if this action should be skipped
        if (
          (this._only !== undefined && !this._only.includes(action)) ||
          (this._skip !== undefined && this._skip.includes(action))
        ) {
          if (action !== "defaults") {
            this._log.info(`Skipping action ${action}`);
            continue;
          }
        }

        let handled = false;

        // Handle special "defaults" directive
        if (action === "defaults") {
          this._context.setDefaults(data as Record<string, unknown>);
          handled = true;
          // Continue to let plugins handle it if they want
        }

        // Handle special "plugins" directive for dynamic plugin loading
        if (action === "plugins") {
          if (!Array.isArray(data)) {
            this._log.error("Plugins directive must be an array");
            success = false;
            handled = true;
          } else {
            for (const pluginPath of data) {
              try {
                const newPlugins = await loadPlugins(
                  [String(pluginPath)],
                  this._context.plugins() ?? []
                );

                for (const PluginClass of newPlugins) {
                  this._plugins.push(new PluginClass(this._context));
                }
              } catch (error) {
                this._log.warning(`Failed to load plugin '${pluginPath}'`);
                this._log.debug(
                  `${error instanceof Error ? error.message : String(error)}`
                );
                success = false;
              }
            }

            if (!success) {
              this._log.error("Some plugins could not be loaded");
              if (this._exit) {
                this._log.error("Action plugins failed");
                return false;
              }
            }
            handled = true;
            // Continue to let plugins handle it if they want
          }
        }

        // Try to handle with plugins
        for (const plugin of this._plugins) {
          if (plugin.canHandle(action)) {
            // Check dry-run support
            const PluginClass = plugin.constructor as typeof Plugin;
            if (this._dryRun && !PluginClass.supportsDryRun) {
              this._log.action(
                `Skipping dry-run-unaware plugin ${PluginClass.name}`
              );
              handled = true;
              continue;
            }

            try {
              const localSuccess = await plugin.handle(action, data);
              if (!localSuccess && this._exit) {
                // The action has failed, exit
                this._log.error(`Action ${action} failed`);
                return false;
              }
              success = localSuccess && success;
              handled = true;
            } catch (error) {
              this._log.error(
                `An error was encountered while executing action ${action}`
              );
              this._log.debug(
                `${error instanceof Error ? error.message : String(error)}`
              );
              if (this._exit) {
                // There was an exception, exit
                return false;
              }
              success = false;
            }
          }
        }

        if (!handled) {
          success = false;
          this._log.error(`Action ${action} not handled`);
          if (this._exit) {
            // Invalid action, exit
            return false;
          }
        }
      }
    }

    return success;
  }
}
