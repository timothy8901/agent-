# loading-agents-bar

A Claude Code mod that draws each working agent as its own colored loading bar, stacked in the band above the prompt.

```
● Explore · Find the auth ha… ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━────────── Grep · 14 tools · 1m35s
  ● Plan · Check the docs li… ━━━━━━━━━━━━──────────────────────────── Read · 3 tools · 22s
● agent · Write integration … ━━━━━━━━━━━━━━━━━━━━━━━━──────────────── Bash · 9 tools · 58s
✓ agent · Benchmark the pars… ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ done · 21 tools · 2m10s
```

- There is one row per working subagent or teammate (the agents in the tasks list), with the oldest at the top. An agent spawned by a subagent is indented under its parent.
- Each agent keeps the same color while its bar is shown. While it works, a highlight runs along the filled part of its bar.
- Agents don't report a total, so the fill isn't real progress. It's a page-load-style trickle driven by elapsed time and tool calls, and it creeps toward 95% while the agent works.
- When an agent finishes, its bar fills to 100% and gets a ✓, then disappears after 4 seconds. ✗ marks a run that ended in an error and ■ one that was stopped.
- The right column shows the agent's latest tool, its tool-call count and how long it has run. On narrow terminals it shortens.
- The band takes no room when no agent is working, and it gives way to surveys. It draws in the terminal and the desktop app, the two places with a band above the prompt.

## Toggle

| Command | Effect |
| --- | --- |
| `/loading-agents-bar` | Turn the bars on or off |
| `/loading-agents-bar on` | Turn them on |
| `/loading-agents-bar off` | Turn them off |

The command runs immediately, even mid-turn. Your choice is remembered across sessions.

## Load it

- **One session:** `claude --plugin-dir /path/to/loading-agents-bar`
- **Every session:** add the folder's absolute path to `CLAUDE_CODE_PLUGIN_DIRS`, either in your environment or in the `env` block of `~/.claude/settings.json`.

## Files

- `hooks/register.tsx` is the hooks module. It tracks agents through `agent.spawn`, `tool.call`, `turn.complete` and `classic.TeammateIdle`, plus a once-a-second reconcile against `$.agent.list()`. It also serves `/loading-agents-bar` and draws the `AbovePrompt` band.
- `hooks/bars.tsx` is the `Client` surface module. It lays out the bars and animates them on the surface's own frame clock, so no animation frame round-trips through the hooks.
- `types/index.d.ts` is the `$.state` contract.
- `tests/` holds the tests. Run them with `claude plugin test <this folder>`.

This mod was built against Claude Code 2.1.288. The function-hook plugin API is early access and may change between releases.
