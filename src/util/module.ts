/**
 * Dynamic plugin loading utilities
 */

import { readdirSync, statSync } from "fs";
import { resolve, join, extname, basename } from "path";
import type { Plugin, PluginConstructor } from "../plugin.ts";

// Keep references to loaded modules to prevent garbage collection
const loadedModules: unknown[] = [];

/**
 * Check if a value is a Plugin constructor
 */
function isPluginConstructor(value: unknown): value is PluginConstructor {
  if (typeof value !== "function") {
    return false;
  }

  // Check if it has the Plugin interface methods
  const proto = value.prototype;
  return (
    proto &&
    typeof proto.canHandle === "function" &&
    typeof proto.handle === "function"
  );
}

/**
 * Load a single module and extract Plugin classes from it
 * @param moduleName The name of the module
 * @param path The absolute path to the module file
 * @returns Array of Plugin constructors found in the module
 */
async function load(path: string): Promise<PluginConstructor[]> {
  const plugins: PluginConstructor[] = [];

  try {
    // Dynamic import with a cache-busting query param to avoid caching issues
    const module = await import(`${path}?t=${Date.now()}`);
    loadedModules.push(module);

    // Look for Plugin subclasses in the module exports
    for (const key of Object.keys(module)) {
      const exported = module[key];
      if (isPluginConstructor(exported)) {
        plugins.push(exported);
      }
    }
  } catch (error) {
    throw new Error(
      `Unable to load module from ${path}: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  return plugins;
}

/**
 * Load plugins from the given paths and add them to the given list
 * @param paths List of file or directory paths to load plugins from
 * @param existingPlugins List of existing plugins to check for duplicates
 * @returns Array of newly-loaded Plugin constructors
 */
export async function loadPlugins(
  paths: string[],
  existingPlugins: PluginConstructor[] = []
): Promise<PluginConstructor[]> {
  const newPlugins: PluginConstructor[] = [];
  const pluginPaths: string[] = [];

  // Collect all plugin file paths
  for (const path of paths) {
    const absPath = resolve(path);
    try {
      const stats = statSync(absPath);
      if (stats.isDirectory()) {
        // Load all .ts and .js files from the directory
        const files = readdirSync(absPath);
        for (const file of files) {
          const ext = extname(file);
          if (ext === ".ts" || ext === ".js") {
            pluginPaths.push(join(absPath, file));
          }
        }
      } else {
        pluginPaths.push(absPath);
      }
    } catch (error) {
      throw new Error(
        `Unable to access path ${absPath}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // Load plugins from each path
  for (const pluginPath of pluginPaths) {
    const absPath = resolve(pluginPath);
    const plugins = await load(absPath);

    for (const plugin of plugins) {
      // Ensure plugins are unique to avoid duplicate execution
      // Compare by constructor name and file path
      const pluginAlreadyLoaded = existingPlugins.some(
        (existing) => existing.name === plugin.name
      );

      if (!pluginAlreadyLoaded) {
        existingPlugins.push(plugin);
        newPlugins.push(plugin);
      }
    }
  }

  return newPlugins;
}

/**
 * Reset the loaded modules cache (useful for testing)
 */
export function resetLoadedModules(): void {
  loadedModules.length = 0;
}
