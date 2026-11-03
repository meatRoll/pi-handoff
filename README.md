# pi-handoff

> `/handoff` for the [pi coding agent](https://pi.dev): transfer the context that matters into a new, focused session instead of compacting the current one.

Compaction summarizes history in place and is lossy. Handoff is deliberate: you say where the next thread should go, the current model writes a self-contained prompt, you edit it, and pi opens a fresh session with that prompt already in the editor.

```text
/handoff now implement this for teams as well
/handoff execute phase one of the plan
/handoff check other places that need this fix
```

## Install

Install straight from GitHub (no npm publication required):

```sh
pi install git:github.com/meatRoll/pi-handoff
```

Then restart pi or run `/reload`. Install it globally (the default) so `/handoff` is available in every project.

> If you already enable pi's bundled `handoff` example (for example through a package that ships it), disable that copy first. When two extensions register the same command, pi exposes them as `/handoff:1` and `/handoff:2`, so plain `/handoff` stays unbound.

To try it without adding it to your settings:

```sh
pi -e git:github.com/meatRoll/pi-handoff
```

## Usage

```text
/handoff <goal for the new thread>
```

1. The command reads the current branch and keeps at most the latest compaction summary plus everything it retained, so an already-compacted session does not lose the thread of work.
2. The active model turns that history and your goal into a prompt with `## Context`, involved files, and `## Task`.
3. The prompt opens in pi's editor for review. Edit it, cancel it, or submit it.
4. Submitting creates a new session linked to the old one via `parentSession`; the new session starts with the edited prompt in the editor.

The original session is untouched. Nothing is written until you submit the edited prompt.

## Requirements

- pi with extension support (developed and tested against pi 1.4/1.5, TypeScript extensions)
- TUI mode — `/handoff` needs the editor and loader UI, so it reports an error in print/RPC mode
- a selected model (`/model`), since generation uses the session's active model

## How it works

- `src/index.ts` registers the `/handoff` command, renders the generation loader, and delegates the session switch to `ctx.newSession({ parentSession })`.
- `src/history.ts` contains the branch-selection logic, with no runtime pi imports, so it is unit tested in isolation.

Generation runs as a single non-streaming completion with `cacheRetention: "none"` and a fresh session id, so the handoff request does not pollute the live conversation or its prompt cache.

## Development

```sh
npm ci
npm run typecheck
npm test
pi -e ./src/index.ts   # load the local checkout as an extension, then run /handoff
```

`npm test` uses Node's built-in test runner; tests cover compaction-aware branch selection only, since the command itself needs a live TUI session.

## Credits

Extracted from the `handoff` example extension shipped with pi (`packages/coding-agent/examples/extensions/handoff.ts`) and packaged as a standalone pi package.

## License

MIT
