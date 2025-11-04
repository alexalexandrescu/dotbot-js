/**
 * Link plugin - creates symbolic and hard links
 */

import {
  existsSync,
  lstatSync,
  mkdirSync,
  readlinkSync,
  rmSync,
  statSync,
  symlinkSync,
  linkSync,
  unlinkSync,
} from "fs";
import { resolve, join, dirname, basename, normalize, relative, sep } from "path";
import fg from "fast-glob";
import { Plugin } from "../plugin.ts";
import { shellCommand, normslash } from "../util/common.ts";

type LinkType = "symlink" | "hardlink";

interface LinkOptions {
  path?: string;
  type?: LinkType;
  force?: boolean;
  relink?: boolean;
  create?: boolean;
  relative?: boolean;
  canonicalize?: boolean;
  "canonicalize-path"?: boolean;  // legacy support
  glob?: boolean;
  prefix?: string;
  if?: string;
  "ignore-missing"?: boolean;
  exclude?: string[];
}

export class Link extends Plugin {
  static override readonly supportsDryRun = true;

  private readonly _directive = "link";

  canHandle(directive: string): boolean {
    return directive === this._directive;
  }

  async handle(directive: string, data: unknown): Promise<boolean> {
    if (directive !== this._directive) {
      throw new ValueError(`Link cannot handle directive ${directive}`);
    }
    return await this._processLinks(data);
  }

  private async _processLinks(links: unknown): Promise<boolean> {
    let success = true;
    const defaults = (this._context.defaults().link as LinkOptions | undefined) ?? {};

    // Validate the default link type
    const defaultLinkType = (defaults.type ?? "symlink") as string;
    if (defaultLinkType !== "symlink" && defaultLinkType !== "hardlink") {
      this._log.warning(`The default link type is not recognized: '${defaultLinkType}'`);
      return false;
    }

    if (typeof links !== "object" || links === null) {
      this._log.error("Links must be an object");
      return false;
    }

    for (const [linkName, target] of Object.entries(links)) {
      const expandedLinkName = this._expandVars(normslash(linkName));

      // Extract options from defaults
      let relative = defaults.relative === true;
      let canonicalPath = defaults.canonicalize ?? defaults["canonicalize-path"] ?? true;
      let linkType: LinkType = (defaults.type as LinkType) ?? "symlink";
      let force = defaults.force === true;
      let relink = defaults.relink === true;
      let create = defaults.create === true;
      let useGlob = defaults.glob === true;
      let basePrefix = defaults.prefix ?? "";
      let test = defaults.if;
      let ignoreMissing = defaults["ignore-missing"] === true;
      let excludePaths = defaults.exclude ?? [];

      let path: string;

      if (typeof target === "object" && target !== null) {
        // Extended config
        const opts = target as LinkOptions;
        test = opts.if ?? test;
        relative = opts.relative ?? relative;
        canonicalPath = opts.canonicalize ?? opts["canonicalize-path"] ?? canonicalPath;
        const targetLinkType = opts.type;
        if (targetLinkType) {
          if (targetLinkType !== "symlink" && targetLinkType !== "hardlink") {
            this._log.warning(`The link type is not recognized: '${targetLinkType}'`);
            success = false;
            continue;
          }
          linkType = targetLinkType;
        }
        force = opts.force ?? force;
        relink = opts.relink ?? relink;
        create = opts.create ?? create;
        useGlob = opts.glob ?? useGlob;
        basePrefix = opts.prefix ?? basePrefix;
        ignoreMissing = opts["ignore-missing"] ?? ignoreMissing;
        excludePaths = opts.exclude ?? excludePaths;
        path = this._defaultTarget(expandedLinkName, opts.path);
      } else {
        path = this._defaultTarget(expandedLinkName, target as string | undefined);
      }

      path = normslash(path);

      // Handle conditional execution
      if (test !== undefined && !(await this._testSuccess(String(test)))) {
        this._log.info(`Skipping ${expandedLinkName}`);
        continue;
      }

      path = normalize(this._expandPath(path));

      // Handle glob patterns
      if (useGlob && this._hasGlobChars(path)) {
        const globResults = await this._createGlobResults(path, excludePaths);
        this._log.debug(`Globs from '${path}': ${JSON.stringify(globResults)}`);

        for (const globFullItem of globResults) {
          // Find common dirname between pattern and the item
          const commonPrefix = this._commonPrefix([path, globFullItem]);
          const globDirname = dirname(commonPrefix);
          const globItem = globDirname.length === 0
            ? globFullItem
            : globFullItem.slice(globDirname.length + 1);

          // Add prefix to basepath, if provided
          const finalGlobItem = basePrefix ? basePrefix + globItem : globItem;

          // Where is it going
          const globLinkName = join(expandedLinkName, finalGlobItem);

          if (create) {
            success = this._create(globLinkName) && success;
          }

          let didDelete = false;
          if (force || relink) {
            const [deleted, deleteSuccess] = this._delete(
              globFullItem,
              globLinkName,
              { relative, canonicalPath, force }
            );
            didDelete = deleted;
            success = deleteSuccess && success;
          }

          success = this._link(
            globFullItem,
            globLinkName,
            {
              relative,
              canonicalPath,
              ignoreMissing,
              linkType,
              didDelete,
            }
          ) && success;
        }
      } else {
        // Non-glob path
        if (create) {
          success = this._create(expandedLinkName) && success;
        }

        if (!ignoreMissing && !this._exists(join(this._context.baseDirectory(), path))) {
          // Check early to avoid removing if target doesn't exist
          success = false;
          this._log.warning(`Nonexistent target ${expandedLinkName} -> ${path}`);
          continue;
        }

        let didDelete = false;
        if (force || relink) {
          const [deleted, deleteSuccess] = this._delete(
            path,
            expandedLinkName,
            { relative, canonicalPath, force }
          );
          didDelete = deleted;
          success = deleteSuccess && success;
        }

        success = this._link(
          path,
          expandedLinkName,
          {
            relative,
            canonicalPath,
            ignoreMissing,
            linkType,
            didDelete,
          }
        ) && success;
      }
    }

    if (success) {
      this._log.info("All links have been set up");
    } else {
      this._log.error("Some links were not successfully set up");
    }

    return success;
  }

  private async _testSuccess(command: string): Promise<boolean> {
    const ret = await shellCommand(command, {
      cwd: this._context.baseDirectory(),
    });
    if (ret !== 0) {
      this._log.debug(`Test '${command}' returned false`);
    }
    return ret === 0;
  }

  private _defaultTarget(linkName: string, target: string | null | undefined): string {
    if (target === null || target === undefined) {
      const base = basename(linkName);
      if (base.startsWith(".")) {
        return base.slice(1);
      }
      return base;
    }
    return target;
  }

  private _hasGlobChars(path: string): boolean {
    return /[?*\[]/.test(path);
  }

  private async _glob(pattern: string): Promise<string[]> {
    try {
      let found = await fg(pattern, {
        dot: true,
        absolute: false,
        onlyFiles: false,
      });

      // Normalize paths
      found = found.map(p => normalize(p));

      // If using recursive glob (**), filter to return only files
      if (pattern.includes("**") && !pattern.endsWith(sep)) {
        this._log.debug(`Excluding directories from recursive glob: ${pattern}`);
        found = found.filter(f => {
          try {
            return statSync(f).isFile();
          } catch {
            return false;
          }
        });
      }

      return found;
    } catch (error) {
      this._log.warning(`Glob pattern failed: ${pattern}`);
      return [];
    }
  }

  private async _createGlobResults(pattern: string, excludePatterns: string[]): Promise<string[]> {
    this._log.debug(`Globbing with pattern: ${pattern}`);
    const include = await this._glob(pattern);
    this._log.debug(`Glob found: ${JSON.stringify(include)}`);

    // Filter out any paths matching the exclude globs
    const exclude: string[] = [];
    for (const expat of excludePatterns) {
      this._log.debug(`Excluding globs with pattern: ${expat}`);
      const excluded = await this._glob(expat);
      exclude.push(...excluded);
    }
    this._log.debug(`Excluded globs from '${pattern}': ${JSON.stringify(exclude)}`);

    const excludeSet = new Set(exclude);
    return include.filter(item => !excludeSet.has(item));
  }

  private _isLink(path: string): boolean {
    try {
      const stats = lstatSync(this._expandPath(path));
      return stats.isSymbolicLink();
    } catch {
      return false;
    }
  }

  private _linkTarget(path: string): string {
    const expanded = this._expandPath(path);
    let target = readlinkSync(expanded);
    if (process.platform === "win32" && target.startsWith("\\\\?\\")) {
      target = target.slice(4);
    }
    return target;
  }

  private _exists(path: string): boolean {
    return existsSync(this._expandPath(path));
  }

  private _lexists(path: string): boolean {
    // Check if path exists (including broken symlinks)
    try {
      lstatSync(this._expandPath(path));
      return true;
    } catch {
      return false;
    }
  }

  private _create(path: string): boolean {
    const parent = resolve(join(this._expandPath(path), ".."));
    if (!this._exists(parent)) {
      this._log.debug(`Try to create parent: ${parent}`);
      if (this._context.dryRun()) {
        this._log.action(`Would create directory ${parent}`);
        return true;
      }
      try {
        mkdirSync(parent, { recursive: true });
        this._log.action(`Creating directory ${parent}`);
      } catch (error) {
        this._log.warning(`Failed to create directory ${parent}`);
        this._log.debug(`Error: ${error}`);
        return false;
      }
    }
    return true;
  }

  private _delete(
    target: string,
    path: string,
    options: { relative: boolean; canonicalPath: boolean; force: boolean }
  ): [boolean, boolean] {
    let success = true;
    let removed = false;

    const targetPath = join(
      this._context.baseDirectory(options.canonicalPath),
      target
    );
    const fullpath = resolve(this._expandPath(path));

    // Check for special case: path is not a symlink but resolves to target
    try {
      if (
        this._exists(path) &&
        !this._isLink(path) &&
        resolve(fullpath) === resolve(targetPath)
      ) {
        this._log.warning(`${path} appears to be the same file as ${targetPath}.`);
        return [false, false];
      }
    } catch {
      // Ignore errors in comparison
    }

    const effectiveTarget = options.relative
      ? this._relativePath(targetPath, fullpath)
      : targetPath;

    const shouldRemove =
      (this._isLink(path) && this._linkTarget(path) !== effectiveTarget) ||
      (this._lexists(path) && !this._isLink(path));

    if (shouldRemove) {
      if (this._context.dryRun()) {
        this._log.action(`Would remove ${path}`);
        removed = true;
      } else {
        try {
          if (this._isLink(fullpath)) {
            unlinkSync(fullpath);
            removed = true;
          } else if (options.force) {
            const stats = statSync(fullpath);
            if (stats.isDirectory()) {
              rmSync(fullpath, { recursive: true, force: true });
              removed = true;
            } else {
              rmSync(fullpath);
              removed = true;
            }
          }
          if (removed) {
            this._log.action(`Removing ${path}`);
          }
        } catch (error) {
          this._log.warning(`Failed to remove ${path}`);
          this._log.debug(`Error: ${error}`);
          success = false;
        }
      }
    }

    return [removed, success];
  }

  private _relativePath(target: string, linkName: string): string {
    const linkDir = dirname(linkName);
    return relative(linkDir, target);
  }

  private _link(
    target: string,
    linkName: string,
    options: {
      relative: boolean;
      canonicalPath: boolean;
      ignoreMissing: boolean;
      linkType: LinkType;
      didDelete: boolean;
    }
  ): boolean {
    const linkPath = resolve(this._expandPath(linkName));
    const baseDirectory = this._context.baseDirectory(options.canonicalPath);
    const absoluteTarget = join(baseDirectory, target);
    const normalizedLinkName = normalize(linkName);
    const targetPath = options.relative
      ? this._relativePath(absoluteTarget, linkPath)
      : absoluteTarget;

    // Create link if it doesn't exist and target exists (or ignore_missing)
    if (
      (!this._lexists(linkName) || (this._context.dryRun() && options.didDelete)) &&
      (options.ignoreMissing || this._exists(absoluteTarget))
    ) {
      if (this._context.dryRun()) {
        this._log.action(`Would create ${options.linkType} ${linkName} -> ${targetPath}`);
        return true;
      }

      try {
        if (options.linkType === "symlink") {
          symlinkSync(targetPath, linkPath);
        } else {
          // hardlink
          linkSync(absoluteTarget, linkPath);
        }
        this._log.action(`Creating ${options.linkType} ${linkName} -> ${targetPath}`);
        return true;
      } catch (error) {
        this._log.warning(`Linking failed ${linkName} -> ${targetPath}`);
        this._log.debug(`Error: ${error}`);
        return false;
      }
    }

    // Failure case: target doesn't exist
    if (!this._exists(absoluteTarget)) {
      if (this._isLink(linkName)) {
        this._log.warning(`Nonexistent target ${linkName} -> ${targetPath}`);
      } else {
        this._log.warning(`Nonexistent target for ${linkName} : ${targetPath}`);
      }
      return false;
    }

    // Link exists case
    if (this._isLink(linkName)) {
      if (options.linkType === "symlink") {
        if (this._linkTarget(linkName) === targetPath) {
          // Idempotent case: symlink already correct
          this._log.info(`Link exists ${linkName} -> ${targetPath}`);
          return true;
        }

        const terminology = this._exists(linkName) ? "Incorrect" : "Invalid";
        this._log.warning(`${terminology} link ${linkName} -> ${this._linkTarget(linkName)}`);
        return false;
      }

      this._log.warning(`${linkName} already exists but is a symbolic link, not a hard link`);
      return false;
    }

    // Check for hardlink
    if (options.linkType === "hardlink") {
      try {
        const linkStat = statSync(linkPath);
        const targetStat = statSync(absoluteTarget);
        if (linkStat.ino === targetStat.ino) {
          // Idempotent case: hardlink already correct
          this._log.info(`Link exists ${linkName} -> ${targetPath}`);
          return true;
        }
      } catch {
        // Continue to error message below
      }
    }

    this._log.warning(`${linkName} already exists but is a regular file or directory`);
    return false;
  }

  private _commonPrefix(paths: string[]): string {
    if (paths.length === 0) return "";
    if (paths.length === 1) return paths[0]!;

    const sorted = [...paths].sort();
    const first = sorted[0]!;
    const last = sorted[sorted.length - 1]!;
    let i = 0;

    while (i < first.length && first[i] === last[i]) {
      i++;
    }

    return first.slice(0, i);
  }

  private _expandVars(str: string): string {
    return str.replace(/\$\{?([A-Za-z0-9_]+)\}?/g, (_, varName) => {
      return process.env[varName] || "";
    });
  }

  private _expandPath(path: string): string {
    // Expand environment variables
    let expanded = this._expandVars(path);

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
