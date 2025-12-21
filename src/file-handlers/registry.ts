import type { FileType } from "../config/types.js";
import type { FileHandler } from "./types.js";
import { StringsHandler } from "./strings.js";
import { JsonHandler } from "./json.js";
import { XmlHandler } from "./xml.js";

/**
 * Registry of file handlers by type
 */
const handlers: Map<FileType, FileHandler> = new Map();

/**
 * Get or create a file handler for the given type
 */
export function getFileHandler(type: FileType): FileHandler {
  let handler = handlers.get(type);

  if (!handler) {
    switch (type) {
      case "strings":
        handler = new StringsHandler();
        break;
      case "json":
        handler = new JsonHandler();
        break;
      case "xml":
        handler = new XmlHandler();
        break;
      default:
        throw new Error(`Unknown file type: ${type}`);
    }
    handlers.set(type, handler);
  }

  return handler;
}

/**
 * Get all supported file types
 */
export function getSupportedFileTypes(): FileType[] {
  return ["strings", "json", "xml"];
}
