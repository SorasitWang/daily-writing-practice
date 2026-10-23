# Daily Writing Practice

A single-page app for daily English writing practice: a topic and format each day, target words to work in, a 100–150 word goal, and an AI writing coach that gives feedback on word choice, grammar and structure.

## Features

- **Write** – daily topic and format, target vocabulary with live ✓ tracking, word count, streak
- **Coach** – feedback, rewrite comparison, model paragraph, and a chat to ask follow-up questions
- **Notebook** – your vocab list and frequent grammar mistakes, plus automatic mistake stats
- **History** – all past entries
- **Settings** – coach depth (Quick / Standard / Thorough), API key, export and import

## Running it

It's one file, `index.html`, with no build step or dependencies. Open it in a browser, or host it with GitHub Pages:

1. Repo **Settings → Pages**
2. Source: **Deploy from a branch**, branch `main`, folder `/ (root)`
3. Open the URL GitHub gives you

## Writing coach (API key)

Outside Claude, the coach uses your own Anthropic API key:

1. Create a key at [console.anthropic.com](https://console.anthropic.com)
2. Open **Settings** in the app, paste the key, click **Save key**

The key is stored only in your browser's `localStorage` and is sent only to `api.anthropic.com`. Usage is billed to your Anthropic account. Coach depth picks the model:

| Depth    | Model               |
|----------|---------------------|
| Quick    | `claude-haiku-5-5`  |
| Standard | `claude-sonnet-5-5` |
| Thorough | `claude-opus-5-5`   |

To change models, edit `TIER_MODELS` in `index.html`.

## Your data

Entries, vocab and grammar notes are saved in your browser's `localStorage`, so they stay on that browser and device. Use **Export data (.json)** for backups and **Import data (.json)** to move to another browser. Import merges and skips duplicates.

The app also still runs as a Claude artifact. There it uses your Claude account for the coach and storage instead.
