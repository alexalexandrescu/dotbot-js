/**
 * Contextual data and information for plugins
 */

import { resolve, relative } from "path";
import type { PluginConstructor } from "./plugin.ts";

export interface CLIOptions {
  dryRun?: boolean;
  verbose?: number;
  quiet?: boolean;
  only?: string[];
  skip?: string[];
  exitOnFailure?: boolean;
  forceColor?: boolean;
  noColor?: boolean;
  [key: string]: unknown;
}

export class Context {
  private _baseDirectory: string;
  private _defaults: Record<string, unknown>;
  private _options: CLIOptions;
  private _plugins?: PluginConstructor[];

  constructor(
    baseDirectory: string,
    options: CLIOptions = {},
    plugins?: PluginConstructor[]
  ) {
    this._baseDirectory = baseDirectory;
    this._defaults = {};
    this._options = options;
    this._plugins = plugins;
  }

  setBaseDirectory(baseDirectory: string): void {
    this._baseDirectory = baseDirectory;
  }

  baseDirectory(canonicalPath: boolean = true): string {
    if (canonicalPath) {
      // In TypeScript/Node, realpath is the equivalent of Python's os.path.realpath
      return resolve(this._baseDirectory);
    }
    return this._baseDirectory;
  }

  setDefaults(defaults: Record<string, unknown>): void {
    this._defaults = defaults;
  }

  defaults(): Record<string, unknown> {
    // Deep copy the defaults to prevent mutation
    return structuredClone(this._defaults);
  }

  options(): CLIOptions {
    // Deep copy the options to prevent mutation
    return structuredClone(this._options);
  }

  plugins(): PluginConstructor[] | undefined {
    // Shallow copy is ok here
    return this._plugins ? [...this._plugins] : undefined;
  }

  dryRun(): boolean {
    return Boolean(this._options.dryRun);
  }
}
