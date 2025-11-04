/**
 * Configuration file reading
 */

import { readFileSync } from "fs";
import { extname } from "path";
import yaml from "js-yaml";
import { indentLines } from "./util/string.ts";

export class ReadingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReadingError";
  }
}

export class ConfigReader {
  private _config: unknown[];

  constructor(configFilePaths: string[]) {
    this._config = [];

    for (const path of configFilePaths) {
      const config = this._read(path);
      if (config === null || config === undefined) {
        continue;
      }

      if (!Array.isArray(config)) {
        throw new ReadingError("Configuration file must be a list of tasks");
      }

      this._config.push(...config);
    }
  }

  private _read(configFilePath: string): unknown {
    try {
      const ext = extname(configFilePath);
      const content = readFileSync(configFilePath, "utf-8");

      if (ext === ".json") {
        return JSON.parse(content);
      } else {
        // Default to YAML parsing
        return yaml.load(content);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const indented = indentLines(errorMsg);
      throw new ReadingError(`Could not read config file:\n${indented}`);
    }
  }

  getConfig(): unknown[] {
    return this._config;
  }
}

/**
 * Read configuration from files
 */
export function readConfig(configFiles: string[]): unknown[] {
  const reader = new ConfigReader(configFiles);
  return reader.getConfig();
}
