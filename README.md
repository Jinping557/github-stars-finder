# GitHub Stars Finder

[![Live Demo](https://img.shields.io/badge/demo-live-brightgreen?style=flat-square&logo=github)](https://jinping557.github.io/github-stars-finder/)

An AI-powered tool to search your GitHub starred repositories and discover new ones. Connect your GitHub account, describe what you're looking for in plain language, and the app uses any OpenAI-compatible LLM to surface the most relevant projects from your Stars — plus suggest new ones you haven't starred yet.

## Live Demo

**https://jinping557.github.io/github-stars-finder/**

## Features

- Load all starred repositories for any GitHub user (handles pagination automatically)
- Natural-language search powered by any OpenAI-compatible API (OpenAI, DeepSeek, Qwen, Ollama, etc.)
- Results split into two lists: matching repos from your Stars, and new AI-discovered repos
- API settings (URL, key, model) persisted in browser localStorage
- Works without a GitHub token for public accounts (subject to GitHub's 60 req/h rate limit)

## Usage

1. Enter your LLM API endpoint and key (settings are saved locally in your browser)
2. Enter a GitHub username and optionally a Personal Access Token
3. Click **Load Stars** to fetch all starred repositories
4. Describe your requirement and click **Search**

## Development

```bash
npm install
npm run dev      # Start dev server at http://localhost:5000
npm run build    # Production build → dist/
npm run preview  # Serve the production build locally
npm run lint     # Run ESLint
```

No test framework is configured. The entire application logic lives in `src/App.jsx`.
