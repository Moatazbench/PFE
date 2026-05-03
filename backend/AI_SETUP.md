# AI Integration Setup

This backend uses a **provider-agnostic AI service** for generating review drafts and development plans.

Supported providers: **Grok (xAI)** (default), **OpenAI**.

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `AI_PROVIDER` | No | `grok` | AI provider: `grok` or `openai` |
| `XAI_API_KEY` | Yes (if grok) | — | Your xAI API key from [console.x.ai](https://console.x.ai) |
| `OPENAI_API_KEY` | Yes (if openai) | — | Your OpenAI API key |
| `AI_MODEL` | No | `grok-3-mini-fast` / `gpt-4o-mini` | Model to use |
| `AI_TIMEOUT_MS` | No | `15000` | HTTP request timeout in ms |
| `AI_MAX_INPUT_CHARS` | No | `12000` | Max context length sent to AI |

## Example `.env` (Grok)

```env
AI_PROVIDER=grok
XAI_API_KEY=xai-...
AI_MODEL=grok-3-mini-fast
```

## Example `.env` (OpenAI)

```env
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
AI_MODEL=gpt-4o-mini
```

## Architecture

- **`services/aiService.js`** — Single AI service, provider-agnostic
- **`services/reviewContextService.js`** — Extracts real data from DB for AI context
- **`controllers/aiController.js`** — HTTP endpoints

## Fallback Behavior

If the AI call fails (network error, bad response, etc.), the system returns a structured non-AI summary built from real evaluation data. The user sees a warning that the draft needs manual editing.
