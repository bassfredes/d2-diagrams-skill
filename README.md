# D2 Diagrams Skill

A Claude Code (and other agent) skill for diagrams-as-code with
[D2](https://d2lang.com): write D2 source, render SVG with the best
available layout engine (TALA if licensed, ELK otherwise), **view the
render and fix layout defects in a loop** before delivering, backed by a
full D2 syntax/pattern reference.

This merges two things:

- The render-and-self-check workflow, engine auto-selection
  (TALA → ELK fallback with a watermark guard), and the guided toolchain
  setup from [khollingworth/d2-diagram-skill](https://github.com/khollingworth/d2-diagram-skill)
  (`scripts/render.sh` and `scripts/setup.sh` are vendored unmodified from
  there — MIT, see [LICENSE](LICENSE)).
- A denser D2 syntax/pattern reference (shapes, containers, classes, vars,
  SQL tables, ERDs, decision trees, theme IDs, D2-vs-Mermaid) written for
  this repo.

## Install

**Via the `skills` CLI (works across 17+ agents, no global install needed):**

```bash
npx skills add bassfredes/d2-diagrams-skill
```

Add `-g` to install globally (user-level, available in every project) instead
of just the current project; add `-a claude-code` to target only Claude Code
if you use multiple agents and want it scoped.

**As a Claude Code plugin (versioned updates via `/plugin`):**

```
/plugin marketplace add bassfredes/d2-diagrams-skill
/plugin install d2-diagrams@d2-diagrams-skill
```

**As a bare skill (copy-paste, no tooling):**

```bash
git clone https://github.com/bassfredes/d2-diagrams-skill.git
cp -r d2-diagrams-skill/skills/d2-diagrams ~/.claude/skills/
```

**Requirements:** the [d2 CLI](https://d2lang.com/tour/install), minimum
0.7.0 — `scripts/setup.sh` checks for it and guides the install. ELK ships
inside d2, so SVG rendering needs nothing else; the PNG self-inspection step
downloads a headless browser on first use (offline, deliver SVG-only with
`--preview-optional`).

## Uninstall

If you installed it with the `skills` CLI:

```bash
npx skills remove -s d2-diagrams
```

(add `-g` if you installed it globally, `--all` only if you want to remove
*every* installed skill).

If you copied it manually into `~/.claude/skills/d2-diagrams` (or it's a
plain, untracked folder there — check with `npx skills list`; an empty
result for this skill means it isn't tracked by the CLI and there's no lock
entry to remove), delete the directory directly:

```bash
rm -rf ~/.claude/skills/d2-diagrams
```

If your setup shares skills across agents through a central store (e.g. a
folder like `~/.agents/skills/d2-diagrams` symlinked into each agent's own
`skills/` directory), remove the real target, not just one symlink — check
with `ls -la ~/.claude/skills/d2-diagrams` first (a symlinked entry doesn't
free anything until the target it points to is deleted, and other agents may
still reference that same target).

## Use it

Just ask:

> "Diagram the architecture of this repo"
> "Draw the checkout flow as a sequence diagram"
> "Turn these CREATE TABLE statements into an ERD"
> "Visualise our incident process as a flowchart"

The agent plans the diagram, writes the `.d2` source, renders it, inspects
the result, fixes what looks wrong, and hands you both the SVG and the
editable `.d2`.

## TALA and licensing — the honest version

| Component | Licence | Cost |
|---|---|---|
| This skill | MIT | Free |
| D2 + ELK + dagre | MPL-2.0 (open source) | Free |
| TALA layout engine | Proprietary (Terrastruct) | Free **evaluation with watermark**; paid licence for clean output ([pricing](https://terrastruct.com/tala)) |

The skill works fully without TALA — ELK produces good layouts. If TALA is
installed (`brew install terrastruct/tap/tala`) **and** licensed
(`TSTRUCT_TOKEN` env var or `~/.config/tstruct/auth.json`), it's used
automatically. If installed but unlicensed, `render.sh` detects the
watermark and re-renders with ELK — you never get a surprise
`UNLICENSED COPY` stamp in a deliverable.

## Credits

- [D2](https://github.com/terrastruct/d2) and [TALA](https://github.com/terrastruct/TALA)
  by Terrastruct.
- `scripts/render.sh` and `scripts/setup.sh` vendored from
  [khollingworth/d2-diagram-skill](https://github.com/khollingworth/d2-diagram-skill)
  (MIT), which itself credits D2 rendering conventions from
  [claude-d2-diagrams](https://github.com/heathdutton/claude-d2-diagrams) by
  Heath Dutton and the render-and-self-check loop pattern pioneered for
  Excalidraw by [Cole Medin](https://github.com/coleam00/excalidraw-diagram-skill).

## Licence

MIT — see [LICENSE](LICENSE). TALA is separately and proprietarily licensed
by Terrastruct; this skill only detects and invokes a TALA installation you
provide.
