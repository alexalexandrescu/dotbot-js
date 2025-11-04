/**
 * Abstract base class for plugins that process directives
 */

import type { Context } from "./context.ts";
import { Messenger } from "./messenger/messenger.ts";

export abstract class Plugin {
  /**
   * Plugins must explicitly declare support for dry-run mode
   */
  static readonly supportsDryRun: boolean = false;

  protected readonly _context: Context;
  protected readonly _log: Messenger;

  constructor(context: Context) {
    this._context = context;
    this._log = new Messenger();
  }

  /**
   * Returns true if the Plugin can handle the directive
   */
  abstract canHandle(directive: string): boolean;

  /**
   * Executes the directive
   * @returns true if the Plugin successfully handled the directive
   */
  abstract handle(directive: string, data: unknown): boolean | Promise<boolean>;
}

/**
 * Type for Plugin constructors
 */
export interface PluginConstructor {
  new (context: Context): Plugin;
  supportsDryRun?: boolean;
  readonly name: string;
}
