# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server on port 5000
npm run build    # Production build (output: dist/)
npm run preview  # Serve the production build locally
npm run lint     # Run ESLint on all .js/.jsx files
```

There is no test framework configured in this project.

## Architecture

This is a single-page React 19 + Vite app with **no routing, no backend, and no state management library**. The entire application lives in `src/App.jsx`.

### Data flow

1. **Load Stars** — `fetchAllStars(token, username)` calls the GitHub REST API (`/users/:username/starred`) with automatic pagination (100 per page), accumulating all starred repos into a flat array held in React state.
2. **Search** — `callLLM(system, userMsg, { apiUrl, apiKey, model })` POSTs the full stars snapshot plus the user's natural-language query to any OpenAI-compatible endpoint. The LLM is instructed (via `SYSTEM_PROMPT`) to return a strict JSON object with three keys: `summary`, `from_stars`, and `external`.
3. **Display** — The parsed JSON is split into two result lists rendered by `RepoCard` components, distinguishing starred (`source="stars"`) from AI-discovered (`source="external"`) repositories.

### Key design decisions

- **Single-file component**: All logic, sub-components (`Tag`, `RepoCard`), and the system prompt constant sit in `App.jsx`. There is no component directory or barrel file.
- **All inline styles**: There is no CSS framework or CSS modules. Every element is styled with inline `style={{}}` objects. Shared style objects (e.g., `lbl`, `inp`, `bt`, `er`) are defined as plain JS variables inside the component body.
- **LLM response parsing**: The raw LLM output is regex-matched for the first `{...}` block before `JSON.parse` so minor surrounding text in the response doesn't break parsing.
- **LocalStorage persistence**: LLM settings (`llm_apiUrl`, `llm_apiKey`, `llm_apiModel`) are read from and written to `localStorage` on every change. The GitHub token and username are **not** persisted.
- **OpenAI-compatible API**: `callLLM` normalises the endpoint URL by appending `/chat/completions` only when the base URL does not already end with it.
- **No auth on GitHub side**: A Personal Access Token is optional; the app works unauthenticated for public users (rate-limited to 60 req/h).

### Dev server

Vite is configured with `host: '0.0.0.0'` and `port: 5000` (Replit-compatible). `allowedHosts: true` disables host-header checks.
