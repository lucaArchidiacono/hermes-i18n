import { consola, createConsola } from "consola";

/**
 * Logger instance for Stryngz
 * Uses consola for beautiful console output
 */
export const logger = createConsola({
  level: 3, // info level by default
  formatOptions: {
    date: false,
    colors: true,
    compact: false,
  },
});

/**
 * Set logger to verbose mode
 */
export function setVerbose(verbose: boolean): void {
  if (verbose) {
    logger.level = 4; // debug level
  }
}

/**
 * Set logger to quiet mode (errors only)
 */
export function setQuiet(quiet: boolean): void {
  if (quiet) {
    logger.level = 0; // error level only
  }
}

export { consola };
