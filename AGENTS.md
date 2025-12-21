# Hermes-i18n - Localization CLI Tool

## Project Overview

Hermes is a standalone CLI tool for extracting, syncing, and translating localization strings. It scans codebases for `_("key")` patterns and manages translations across iOS (`.strings`), JavaScript (`.json`), and Android (`.xml`) formats.

## Tech Stack

- **Runtime**: Bun
- **Language**: TypeScript
- **CLI Framework**: Commander
- **Logging**: Consola
- **Testing**: Vitest
- **Translation**: DeepL API + Vercel AI SDK (configurable providers)

## Architecture

### Pipeline Pattern

The tool uses a sequential pipeline where each step processes and enriches a shared context:

```
Extractor → SourceSync → MissingFinder → DeepL → AIRefiner → Writer
```

1. **Extractor** - Scans code for `_("key")` patterns
2. **SourceSync** - Adds missing keys to source file (creates file if needed)
3. **MissingFinder** - Identifies untranslated entries per language
4. **DeepLTranslator** - First-pass machine translation (skips unsupported languages)
5. **AIRefiner** - AI-powered translation refinement
6. **Writer** - Writes results to output files

### FileHandler Pattern

Each file format implements the `FileHandler` interface:

```typescript
interface FileHandler {
  read(path: string): Promise<LocalizationEntry[]>;
  write(path: string, entries: LocalizationEntry[]): Promise<void>;
}
```

Handlers: `StringsHandler`, `JsonHandler`, `XmlHandler`

## Directory Structure

```
src/
├── index.ts              # CLI entry point
├── cli/
│   ├── index.ts          # Commander setup
│   └── commands/
│       ├── sync.ts       # Main sync command
│       └── init.ts       # Config generator
├── config/
│   ├── types.ts          # Config TypeScript types
│   ├── loader.ts         # Load hermes.config.ts
│   └── defaults.ts       # Default values
├── pipeline/
│   ├── index.ts          # Pipeline runner
│   ├── types.ts          # Pipeline context and types
│   └── steps/
│       ├── extractor.ts      # Key extraction
│       ├── source-sync.ts    # Source file sync
│       ├── missing-finder.ts # Find untranslated
│       ├── deepl.ts          # DeepL translation
│       ├── ai-refiner.ts     # AI refinement
│       └── writer.ts         # File writing
├── file-handlers/
│   ├── types.ts          # FileHandler interface
│   ├── registry.ts       # Handler factory
│   ├── strings.ts        # iOS .strings
│   ├── json.ts           # JSON format
│   └── xml.ts            # Android XML
├── services/
│   ├── deepl.ts          # DeepL API wrapper
│   └── ai.ts             # Vercel AI SDK wrapper
└── utils/
    ├── logger.ts         # Consola wrapper
    └── fs.ts             # File system helpers
```

## Key Behaviors

| Scenario | Behavior |
|----------|----------|
| Source file doesn't exist | Create it automatically |
| Key in code but not in source | Add key to source (value = key) |
| Key in source but not in target | Translate and add to target |
| Key in target with empty value | Translate and update |
| DeepL unsupported language | Skip DeepL, use AI only |
| DeepL API error | Mark failed, skip entry |
| AI API error | Mark failed, skip entry |
| Dry-run mode | Log all changes, write nothing |

## Conventions

- Use `consola` for all logging output
- Async/await over callbacks
- Resolve paths relative to config file location
- API keys via environment variables (never hardcode)
- Sequential translation processing (no parallel API calls)
- Create files/directories automatically as needed

## Commands

```bash
# Main sync command
hermes sync

# Preview without writing
hermes sync --dry-run

# Verbose output
hermes sync --verbose

# Process specific languages only
hermes sync --language de fr

# Use custom config path
hermes sync --config ./path/to/config.ts

# Generate config file
hermes init
```

## Testing

```bash
# Run all tests
bun test

# Run tests once (CI mode)
bun test:run

# Run with coverage
bun test:coverage
```

All file handlers must have comprehensive test coverage including:
- Reading and writing entries
- Handling special characters and unicode
- Creating parent directories
- Edge cases (empty files, missing files)

## Building

```bash
bun run build
```

## Environment Variables

- `DEEPL_API_KEY` - DeepL API key (optional)
- `OPENAI_API_KEY` - OpenAI API key
- `ANTHROPIC_API_KEY` - Anthropic API key
- `GOOGLE_API_KEY` - Google AI API key
- `MISTRAL_API_KEY` - Mistral API key

## Adding New File Formats

1. Create a new handler in `src/file-handlers/`
2. Implement the `FileHandler` interface
3. Register in `src/file-handlers/registry.ts`
4. Add the new type to `FileType` in `src/config/types.ts`
5. Add comprehensive tests in `tests/file-handlers/`

## Adding New AI Providers

1. Install the provider package from `@ai-sdk/`
2. Update `AIProvider` type in `src/config/types.ts`
3. Add the provider case in `src/services/ai.ts`
4. Add the env key mapping in `src/config/defaults.ts`
