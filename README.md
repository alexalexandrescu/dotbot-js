# Dotbot (TypeScript/Bun Port)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE.md)

**Dotbot** makes installing your dotfiles as easy as `git clone $url && cd dotfiles && ./install`, even on a freshly installed system!

This is a **TypeScript/Bun port** of the original [Python Dotbot](https://github.com/anishathalye/dotbot) by Anish Athalye. It maintains full feature parity with the Python version while leveraging the performance and modern features of Bun and TypeScript.

## Features

- ✅ **Lightweight and self-contained** - No external dependencies needed at runtime
- ✅ **Idempotent** - Safe to run multiple times
- ✅ **Cross-platform** - Works on Linux, macOS, and Windows
- ✅ **VCS-agnostic** - Works with any version control system
- ✅ **Extensible** - Support for custom plugins
- ✅ **Full YAML/JSON support** - Flexible configuration formats
- ✅ **Dry-run mode** - Preview changes before applying them

## Quick Start

### Installation

```bash
# Clone this repository
git clone https://github.com/your-username/dotbot.git

# Or install via Bun (if published)
bun install -g dotbot
```

### Basic Usage

```bash
# Run with a config file
./bin/dotbot.ts -c install.conf.yaml

# Dry run to preview changes
./bin/dotbot.ts -c install.conf.yaml --dry-run

# Verbose output
./bin/dotbot.ts -c install.conf.yaml --verbose
```

## Configuration

Dotbot uses YAML or JSON configuration files. Here's a complete example:

```yaml
- defaults:
    link:
      relink: true

- clean: ['~']

- link:
    ~/.tmux.conf: tmux.conf
    ~/.vim: vim
    ~/.vimrc: vimrc

- create:
    - ~/downloads
    - ~/.vim/undo-history

- shell:
  - [git submodule update --init --recursive, Installing submodules]
```

## Directives

### Link

Create symbolic links (or hard links) to your dotfiles:

```yaml
- link:
    ~/.vimrc: vimrc
    ~/.config/nvim:
      path: nvim
      create: true
    ~/.zshrc:
      force: true
      path: zshrc
```

**Options:**
- `path` - Target file in dotfiles directory
- `type` - `symlink` (default) or `hardlink`
- `create` - Create parent directories
- `relink` - Remove old symlinks
- `force` - Force overwrite existing files
- `relative` - Use relative paths
- `glob` - Enable glob pattern matching
- `exclude` - Exclude patterns (with glob)
- `prefix` - Add prefix to linked files
- `if` - Conditional execution (shell command)
- `ignore-missing` - Don't fail if target is missing

### Create

Create empty directories:

```yaml
- create:
    - ~/downloads
    - ~/.vim/undo-history
    - ~/.ssh:
        mode: 0700
```

### Shell

Execute shell commands:

```yaml
- shell:
  - echo "Hello, World!"
  - [git submodule update, Updating submodules]
  -
    command: brew install zsh
    description: Installing zsh
    stdout: true
    stderr: true
```

**Options:**
- `command` - The command to run
- `description` - Human-readable description
- `stdin` - Enable stdin (default: false)
- `stdout` - Show stdout (default: false)
- `stderr` - Show stderr (default: false)
- `quiet` - Only show description, not command

### Clean

Remove broken symbolic links:

```yaml
- clean:
    - ~
    - ~/.config:
        recursive: true
        force: true
```

**Options:**
- `force` - Remove links outside dotfiles directory
- `recursive` - Recursively clean directories

### Defaults

Set default options for directives:

```yaml
- defaults:
    link:
      create: true
      relink: true
```

## Command-line Options

```bash
Options:
  -c, --config-file <file...>  Configuration file(s) to use
  -d, --base-directory <dir>   Base directory for operations
  -p, --plugin <plugin...>     Load additional plugins
  --disable-built-in-plugins   Disable built-in plugins
  --only <directive...>        Only run specified directives
  --except <directive...>      Skip specified directives
  -n, --dry-run                Preview without making changes
  -v, --verbose                Increase verbosity
  -q, --quiet                  Suppress most output
  -x, --exit-on-failure        Exit on first failure
  --force-color                Force colored output
  --no-color                   Disable colored output
  --version                    Show version number
  -h, --help                   Display help
```

## Plugin System

Dotbot supports custom plugins written in TypeScript/JavaScript:

```typescript
import { Plugin, Context } from "dotbot";

export class MyPlugin extends Plugin {
  static supportsDryRun = true;

  canHandle(directive: string): boolean {
    return directive === "my-directive";
  }

  handle(directive: string, data: unknown): boolean {
    // Your plugin logic here
    return true;
  }
}
```

Load plugins via config:

```yaml
- plugins:
    - ./plugins/my-plugin.ts
```

Or via command line:

```bash
./bin/dotbot.ts -c config.yaml --plugin ./plugins/my-plugin.ts
```

## Development

### Requirements

- [Bun](https://bun.sh/) >= 1.0
- TypeScript >= 5.0

### Setup

```bash
# Install dependencies
bun install

# Run type checking
bun run typecheck

# Run tests
bun test

# Build standalone executable
bun run build
```

### Project Structure

```
src/
├── cli.ts              # Command-line interface
├── dispatcher.ts       # Task routing
├── plugin.ts           # Plugin base class
├── context.ts          # Shared context
├── config.ts           # Config file parsing
├── messenger/          # Logging system
├── plugins/            # Built-in plugins
│   ├── link.ts
│   ├── create.ts
│   ├── shell.ts
│   └── clean.ts
└── util/               # Utility functions
```

## Differences from Python Version

- **Performance**: Significantly faster startup time with Bun
- **Module System**: Uses ES modules instead of Python imports
- **Type Safety**: Full TypeScript type checking
- **Async Operations**: Native async/await throughout
- **Glob Library**: Uses `fast-glob` instead of Python's `glob`
- **YAML Parser**: Uses `js-yaml` instead of PyYAML

All configuration files from the Python version are fully compatible!

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

Copyright (c) Anish Athalye (original Python version)
TypeScript/Bun port by [Your Name]

Released under the MIT License. See [LICENSE.md](LICENSE.md) for details.

## Credits

- Original Python Dotbot: [anishathalye/dotbot](https://github.com/anishathalye/dotbot)
- Inspired by the simplicity and elegance of the original design

## Links

- [Original Python Dotbot](https://github.com/anishathalye/dotbot)
- [Bun Documentation](https://bun.sh/docs)
- [Dotbot Wiki](https://github.com/anishathalye/dotbot/wiki) (Python version, mostly applicable)
