#!/usr/bin/env bun
/**
 * Dotbot executable entry point
 */

import { main } from "../src/cli.ts";

// Run the main CLI function
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
