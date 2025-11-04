/**
 * Command-line interface
 */

import { Command } from "commander";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { spawn } from "bun";
import { readConfig, ReadingError } from "./config.ts";
import { Dispatcher, DispatchError } from "./dispatcher.ts";
import { Level, Messenger } from "./messenger/index.ts";
import { Create, Shell, Clean, Link } from "./plugins/index.ts";
import { loadPlugins } from "./util/module.ts";
import type { CLIOptions } from "./context.ts";
import type { PluginConstructor } from "./plugin.ts";

// Version - read from package.json
function getVersion(): string {
  try {
    const packagePath = resolve(import.meta.dir, "../package.json");
    const packageJson = JSON.parse(readFileSync(packagePath, "utf-8"));
    return packageJson.version || "unknown";
  } catch {
    return "unknown";
  }
}

async function getGitHash(): Promise<string> {
  try {
    const proc = spawn(["git", "rev-parse", "HEAD"], {
      cwd: import.meta.dir,
      stdout: "pipe",
      stderr: "ignore",
    });

    const output = await new Response(proc.stdout).text();
    return output.trim().slice(0, 10);
  } catch {
    return "";
  }
}

export async function main(argv?: string[]): Promise<void> {
  const log = new Messenger();

  try {
    const program = new Command();

    program
      .name("dotbot")
      .description("A tool that bootstraps your dotfiles")
      .version(getVersion(), "-v, --version", "show program's version number and exit");

    program
      .option("-q, --quiet", "suppress most output")
      .option(
        "--verbose",
        "enable verbose output\n-v: show informational messages\n-vv: also, set shell commands stderr/stdout to true",
        (_, prev) => prev + 1,
        0
      )
      .option("-d, --base-directory <dir>", "execute commands from within BASE_DIR")
      .option(
        "-c, --config-file <file...>",
        "run commands given in CONFIG_FILE"
      )
      .option("-p, --plugin <plugin...>", "load PLUGIN as a plugin")
      .option("--disable-built-in-plugins", "disable built-in plugins")
      .option("--only <directive...>", "only run specified directives")
      .option("--except <directive...>", "skip specified directives")
      .option("-n, --dry-run", "print what would be done, without doing it")
      .option("--force-color", "force color output")
      .option("--no-color", "disable color output")
      .option(
        "-x, --exit-on-failure",
        "exit after first failed directive"
      );

    program.parse(argv ?? process.argv);
    const options = program.opts();

    // Handle version display with git hash
    if (options.version) {
      const version = getVersion();
      const gitHash = await getGitHash();
      const hashMsg = gitHash ? ` (git ${gitHash})` : "";
      console.log(`Dotbot version ${version}${hashMsg}`);
      process.exit(0);
    }

    // Set log level
    if (options.quiet) {
      log.setLevel(Level.WARNING);
    }
    if (options.verbose > 0) {
      log.setLevel(options.verbose === 1 ? Level.INFO : Level.DEBUG);
    }

    // Handle color output
    if (options.forceColor && options.color === false) {
      log.error("`--force-color` and `--no-color` cannot both be provided");
      process.exit(1);
    } else if (options.forceColor) {
      log.useColor(true);
    } else if (options.color === false) {
      log.useColor(false);
    } else {
      // Check if stdout is a TTY
      log.useColor(Boolean(process.stdout.isTTY));
    }

    // Load plugins
    const plugins: PluginConstructor[] = [];
    if (!options.disableBuiltInPlugins) {
      plugins.push(Clean, Create, Link, Shell);
    }

    if (options.plugin) {
      const pluginPaths = Array.isArray(options.plugin)
        ? options.plugin
        : [options.plugin];
      const newPlugins = await loadPlugins(pluginPaths, plugins);
      plugins.push(...newPlugins);
    }

    // Read configuration
    if (!options.configFile) {
      log.error("No configuration file specified");
      process.exit(1);
    }

    const configFiles = Array.isArray(options.configFile)
      ? options.configFile
      : [options.configFile];

    const tasks = readConfig(configFiles);

    if (tasks.length === 0) {
      log.warning("No tasks given in configuration, no work to do");
    }

    // Determine base directory
    let baseDirectory: string;
    if (options.baseDirectory) {
      baseDirectory = resolve(options.baseDirectory);
    } else {
      // Default to directory of first config file
      baseDirectory = dirname(resolve(configFiles[0]!));
    }

    // Change to base directory
    process.chdir(baseDirectory);

    // Create CLI options object
    const cliOptions: CLIOptions = {
      dryRun: options.dryRun,
      verbose: options.verbose,
      quiet: options.quiet,
      only: options.only,
      skip: options.except,
      exitOnFailure: options.exitOnFailure,
      forceColor: options.forceColor,
      noColor: options.color === false,
    };

    // Create dispatcher and execute tasks
    const dispatcher = new Dispatcher(baseDirectory, {
      only: options.only,
      skip: options.except,
      exitOnFailure: options.exitOnFailure,
      options: cliOptions,
      plugins,
    });

    const success = await dispatcher.dispatch(tasks);

    if (success) {
      log.info("All tasks executed successfully");
    } else {
      throw new DispatchError("Some tasks were not executed successfully");
    }
  } catch (error) {
    if (error instanceof ReadingError || error instanceof DispatchError) {
      log.error(error.message);
      process.exit(1);
    } else if (error instanceof Error && error.message === "Operation aborted") {
      log.error("Operation aborted");
      process.exit(1);
    } else {
      throw error;
    }
  }
}

// Handle SIGINT (Ctrl+C)
process.on("SIGINT", () => {
  const log = new Messenger();
  log.error("Operation aborted");
  process.exit(1);
});
