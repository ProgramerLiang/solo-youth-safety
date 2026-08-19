---
name: ownmem
description: Use before editing code or documentation in this repository, and whenever the user asks what is already known about a symbol, path, error, or past decision. Retrieves curated engineering memory from .ownmem through a local, deterministic, zero-network CLI.
---

# OwnMem engineering memory

## When to use

- Before changing code or docs: recall first, so a prior decision or a known trap is not rediscovered the hard way.
- When the user asks "why is it like this", "have we hit this before", or names a symbol, path, or error code.
- Before writing anything down as a memory: ask where it belongs first.

## How to use

Recall (local, no model, no network):

```bash
npx ownmem recall -- "<question, symbol, path, or error>"
```

Decide where a new piece of knowledge belongs instead of guessing:

```bash
npx ownmem intent -- "<what you just learned>"
```

## Rules

- Retrieval abstains when nothing is trusted enough. An empty answer means "nothing recorded", not "look harder".
- Never paste a recalled excerpt as fact without opening the topic it came from.
- Do not implement memory logic here. This skill only routes to the CLI.
