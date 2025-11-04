# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Dotbot is a tool that bootstraps dotfiles, making installation as simple as `git clone && ./install`. This is a **TypeScript/Bun port** of the original Python Dotbot, maintaining full feature parity while leveraging modern JavaScript tooling. It creates symbolic/hard links, runs shell commands, creates directories, and cleans broken links based on YAML/JSON configuration files. Written in TypeScript with Bun runtime, Dotbot is designed to be lightweight, self-contained, and idempotent.

## Development Commands

### Running Dotbot
```bash
# Direct execution from source
./bin/dotbot.ts -c <config-file>

# With bun explicitly
bun run bin/dotbot.ts -c <config-file>

# Using npm script
bun start -c <config-file>
```

### Testing
```bash
# Run all tests
bun test

# Run tests in watch mode
bun test --watch

# Run specific test file
bun test tests/link.test.ts
```

### Type Checking
```bash
# Run TypeScript type checker
bun run typecheck

# This runs: tsc --noEmit
```

### Building
```bash
# Build standalone executable
bun run build

# This creates a compiled binary: ./dotbot
```

### Development
```bash
# Install dependencies
bun install

# Run type checking and tests
bun run typecheck && bun test
```

## Architecture

### Core Components

**CLI Entry Point** (`src/cli.ts`)
- Parses command-line arguments using Commander.js
- Loads built-in and external plugins
- Creates Dispatcher and executes tasks
- Manages logging levels and output colors
- Handles SIGINT (Ctrl+C) gracefully

**Dispatcher** (`src/dispatcher.ts`)
- Iterates through configuration tasks
- Routes each action to appropriate plugin via `canHandle()` / `handle()` pattern
- Handles special directives: `defaults` (sets plugin defaults) and `plugins` (loads additional plugins dynamically)
- Supports `--only` and `--except` filtering of directives
- Implements `--exit-on-failure` mode
- Fully async/await based for non-blocking operations

**Plugin System** (`src/plugin.ts`)
- Abstract base class for all directives
- Methods: `canHandle(directive: string)` and `handle(directive: string, data: unknown)`
- Plugins receive a `Context` object with base directory, options, and defaults
- Plugins must explicitly declare `static supportsDryRun = true` to work with `--dry-run`
- Type-safe plugin interface with TypeScript

**Context** (`src/context.ts`)
- Provides contextual data to plugins: base directory, CLI options, defaults, available plugins
- Uses `structuredClone()` for deep copying defaults
- Manages defaults that can be set per-directive via the `defaults` directive

**Built-in Plugins** (`src/plugins/`)
- **Link** (`link.ts`): Creates symlinks/hardlinks with glob support (fast-glob), conditional execution (`if`), relative paths, force/relink options
- **Create** (`create.ts`): Creates empty directories with optional mode specification
- **Shell** (`shell.ts`): Executes shell commands using Bun.spawn() with optional stdin/stdout/stderr control
- **Clean** (`clean.ts`): Removes broken symbolic links in specified directories

### Configuration Flow

1. User provides YAML/JSON config file(s) via `-c` flag
2. `ConfigReader` (`src/dotbot/config.py`) parses configuration into task list
3. Dispatcher loops through tasks, routing each action to plugins
4. Plugins execute actions using Context for base directory and defaults
5. Success/failure tracked and reported

### Plugin Development

Custom plugins should:
- Inherit from `dotbot.Plugin`
- Implement `can_handle(directive: str) -> bool`
- Implement `handle(directive, data) -> bool`
- Optionally set `supports_dry_run = True` and check `Context.dry_run()`
- Access base directory via `self._context.base_directory()`
- Access defaults via `self._context.defaults().get(directive_name, {})`

Plugins can be loaded via:
- `plugins` directive in config file (paths relative to base directory)
- `--plugin` command-line flag (paths relative to working directory)

## Code Structure

```
src/
├── index.ts             # Public API exports
├── cli.ts               # Command-line interface and main()
├── dispatcher.ts        # Task routing to plugins
├── plugin.ts            # Plugin base class
├── context.ts           # Contextual data container
├── config.ts            # Configuration file parsing (js-yaml)
├── messenger/           # Logging system
│   ├── color.ts
│   ├── level.ts
│   └── messenger.ts
├── plugins/             # Built-in directive implementations
│   ├── link.ts          # 600+ lines - most complex
│   ├── create.ts
│   ├── shell.ts
│   └── clean.ts
└── util/                # Utility functions
    ├── string.ts        # Text formatting
    ├── common.ts        # Shell execution, path helpers
    ├── singleton.ts     # Singleton pattern
    └── module.ts        # Dynamic plugin loading

bin/
└── dotbot.ts            # Executable entry point (#!/usr/bin/env bun)

tests/                   # Bun test suite (to be ported)
package.json             # Bun package configuration
tsconfig.json            # TypeScript configuration (strict mode)
```

## Testing Guidelines

- Tests use Bun's built-in test runner
- Tests should exercise filesystem operations and shell commands in isolation
- Each plugin should have dedicated test file: `link.test.ts`, `create.test.ts`, etc.
- Test fixtures should create isolated temp directories per test
- **Note**: Full test suite from Python version is not yet ported

## Important Patterns

**Idempotency**: All operations should be safe to run multiple times. The installer is designed to be re-run after updates.

**Defaults System**: The `defaults` directive sets per-plugin defaults that apply to subsequent tasks. Access via `this._context.defaults()[directiveName]` in plugins.

**Glob Expansion**: The Link plugin uses `fast-glob` library for pattern matching (`*`, `**`, `?`, `[seq]`). Patterns starting with `.` must be explicit (e.g., `config/.*`).

**Conditional Execution**: The Link plugin's `if` parameter executes shell commands to conditionally create links (e.g., `if: '[ $(uname) = Darwin ]'`).

**Async/Await**: Plugins that perform I/O operations (Shell, Link with globs) use async/await. The `handle()` method can return `Promise<boolean>`.

**Type Safety**: Full TypeScript strict mode is enabled. All plugin data should be validated at runtime since config files are `unknown` type.

**Path Expansion**: Use helper methods to expand `~` and environment variables (`$VAR` or `${VAR}`) in paths across all platforms.

## Runtime Support

- **Bun**: 1.0+
- **TypeScript**: 5.0+
- **Platforms**: Linux, macOS, Windows
- **Node Compatibility**: Should work with Node.js 18+ but Bun is recommended

## Technology Stack

- **Runtime**: Bun (fast JavaScript runtime)
- **Language**: TypeScript (strict mode)
- **CLI**: Commander.js for argument parsing
- **YAML**: js-yaml for config parsing
- **Glob**: fast-glob for pattern matching
- **Colors**: ANSI codes (no external library needed)

## Key Differences from Python Version

1. **Module Loading**: Uses dynamic `import()` instead of `importlib`. Plugins must export their classes.
2. **Singleton Pattern**: Uses module-level instances or WeakMap, not metaclasses.
3. **Shell Execution**: Uses `Bun.spawn()` instead of `subprocess.call()`.
4. **Path Handling**: Node's `path` module instead of `os.path`.
5. **Deep Copying**: `structuredClone()` instead of `copy.deepcopy()`.
6. **Async Operations**: Native async/await throughout, especially in Shell and Link plugins.

## CI/CD (To Be Implemented)

Planned GitHub Actions jobs:
- **test**: Run test suite across platforms
- **typecheck**: Run TypeScript type checking
- **lint**: Verify code formatting
- **build**: Create standalone executable

CI should trigger on push, pull requests, and weekly schedule.
