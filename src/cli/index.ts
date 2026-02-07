import { Command } from "commander";
import { syncCommand } from "./commands/sync.js";
import { initCommand } from "./commands/init.js";

/**
 * Create and configure the CLI
 */
export function createCLI(): Command {
  const program = new Command();

  program
    .name("stryngz")
    .description("CLI tool for extracting, syncing, and translating localization strings")
    .version("0.1.0");

  // Add commands
  program.addCommand(syncCommand());
  program.addCommand(initCommand());

  return program;
}
