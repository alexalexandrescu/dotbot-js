/**
 * Dotbot - A tool that bootstraps your dotfiles
 */

export { main } from "./cli.ts";
export { Plugin, type PluginConstructor } from "./plugin.ts";
export { Context, type CLIOptions } from "./context.ts";
export { Dispatcher, DispatchError } from "./dispatcher.ts";
export { readConfig, ConfigReader, ReadingError } from "./config.ts";
export { Messenger, Level, Color } from "./messenger/index.ts";
export { Create, Shell, Clean, Link } from "./plugins/index.ts";
