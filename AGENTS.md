# Stryngz - Localization CLI Tool

## Project Overview

Stryngz is a standalone CLI tool for extracting, syncing, and translating localization strings. It scans codebases for `_("key")` patterns and manages translations across iOS (`.strings`), JavaScript (`.json`), and Android (`.xml`) formats.

## Tech Stack

- **Runtime**: Bun
- **Language**: TypeScript
- **CLI Framework**: Commander
- **Logging**: Consola
- **Testing**: Vitest
- **Translation**: DeepL API / Google Translate API (with fallback) + Vercel AI SDK (configurable providers)

## Architecture

### Pipeline Pattern

The tool uses a sequential pipeline where each step processes and enriches a shared context:

```
Extractor → SourceSync → MissingFinder → Translator → AIRefiner (optional) → Writer
```

1. **Extractor** - Scans code for `_("key")` patterns
2. **SourceSync** - Adds missing keys to source file (creates file if needed)
3. **MissingFinder** - Identifies untranslated entries per language
4. **Translator** - Translates using the ordered `translations` provider chain (first success wins)
5. **AIRefiner** - Optional AI-powered translation refinement (configured via `refiner`)
6. **Writer** - Writes only successful translations to output files

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
│   ├── loader.ts         # Load stryngz.config.json
│   └── defaults.ts       # Default values
├── pipeline/
│   ├── index.ts          # Pipeline runner
│   ├── types.ts          # Pipeline context and types
│   └── steps/
│       ├── extractor.ts      # Key extraction
│       ├── source-sync.ts    # Source file sync
│       ├── missing-finder.ts # Find untranslated
│       ├── translator.ts     # Machine translation (DeepL/Google)
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
│   ├── google-translate.ts # Google Translate API wrapper
│   ├── translator.ts     # Translation service interface
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
| Single translation provider configured | Use that provider only |
| Multiple translation providers configured | Try in array order, first success wins |
| Translation provider fails | Try next provider in chain, skip entry if all fail |
| Translation failed | Do NOT write to target (no placeholder values) |
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
stryngz sync

# Preview without writing
stryngz sync --dry-run

# Verbose output
stryngz sync --verbose

# Process specific languages only
stryngz sync --language de fr

# Use custom config path
stryngz sync --config ./path/to/stryngz.config.json

# Generate config file
stryngz init
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

Copy `.env.example` to `.env` and fill in your API keys:

```bash
cp .env.example .env
```

### Translation Providers (at least one required, used in `translations` array)

- `DEEPL_API_KEY` - DeepL API key (for `"deepl"` provider)
- `GOOGLE_TRANSLATE_API_KEY` - Google Cloud Translation API key (for `"google-translate"` provider)
- `OPENAI_API_KEY` - OpenAI API key (for `"openai"` provider)
- `ANTHROPIC_API_KEY` - Anthropic API key (for `"anthropic"` provider)
- `GOOGLE_API_KEY` - Google AI (Gemini) API key (for `"google-ai"` provider)
- `MISTRAL_API_KEY` - Mistral API key (for `"mistral"` provider)

### AI Refiner (optional, uses same AI provider env vars above)

## Adding New File Formats

1. Create a new handler in `src/file-handlers/`
2. Implement the `FileHandler` interface
3. Register in `src/file-handlers/registry.ts`
4. Add the new type to `FileType` in `src/config/types.ts`
5. Add comprehensive tests in `tests/file-handlers/`

## Adding New AI Providers

1. Install the provider package from `@ai-sdk/`
2. Add the provider name to `AIProviderName` type in `src/config/types.ts`
3. Add the provider case in `src/services/ai.ts`
4. Add the env key mapping in `getAIProviderEnvKey()` in `src/config/defaults.ts`
5. Add the provider name to `VALID_AI_PROVIDERS` in `src/config/loader.ts`
