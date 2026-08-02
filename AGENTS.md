# AGENTS.md — RVE Studio: Runtime Visualization Engine
# Project Intelligence Manifest for Antigravity (AGY)

> **Scope**: This file is the authoritative operating context for any AI agent
> working on this project. It defines how the agent should think, search,
> edit, and reason — going beyond "just coding" into being an active
> co-architect of a visualization engine.

---

## 1. Project Identity

| Field         | Value                                                                 |
|---------------|-----------------------------------------------------------------------|
| Project       | Runtime Visualization Engine (RVE) Web Studio                        |
| Stack         | Vanilla HTML / CSS / JavaScript + Pyodide (CPython 3.11 WebAssembly) |
| Repo          | `https://github.com/gentlewind-alt/ubiquitous-train.git`             |
| Branch        | `Old_ver` (active working branch)                                     |
| Local path    | `C:\Users\samar\OneDrive\Desktop\projects\DSA_visualizer`            |
| Entry points  | `index.html`, `app.js`, `index.css`                                  |
| Server        | `python -m http.server 8000` → `http://localhost:8000/`              |

### What RVE Is

RVE is an **educational, real-time Python DSA visualization studio** that:
- Runs real CPython 3.11 code via **Pyodide WebAssembly** in the browser.
- Introspects live Python objects (Nodes, Trees, Lists, Sets, Dicts) using a
  custom Pyodide inspection script embedded in `app.js`.
- Renders the object graph onto a 2D `<canvas>` using a custom ECS-like
  draw engine with pan, zoom, Reingold-Tilford layout, and edge semantics.
- Provides a Monaco-like code editor with VS Code keybindings, real-time line
  compilation, live AVL height/balance badges, DevTools inspector, and an
  Error Alerts toggle.

---

## 2. Agent Capabilities & Permitted Tool Usage

The agent has access to the full Antigravity (agy) tool suite:

### 2.1 File Intelligence

- `read_file` — scan any file or directory tree
- `write_file` — create new files
- `multi_replace_file_content` — surgical multi-chunk edits (PREFERRED for precision edits)
- `replace_file_content` — single contiguous block replacement

**Surgical edit preference**: Always prefer `multi_replace_file_content` over
`write_to_file` for existing files. Only use `write_to_file` with `Overwrite:
true` when the file needs a complete structural rewrite (>60% change).

### 2.2 Code Search

- `grep_search` — regex or literal ripgrep across the codebase
- `list_dir` — map the directory tree before editing
- `view_file` — read specific line ranges (ALWAYS specify StartLine/EndLine to avoid loading entire large files)

**Search-before-edit protocol**: Before modifying any function, ALWAYS run
`grep_search` to locate the exact definition and all call sites first.

### 2.3 Execution & Git

Use `run_command` for all shell operations. PowerShell on Windows:
- Use `;` NOT `&&` to chain commands.
- Git workflow — always commit and push to `Old_ver` after meaningful changes:

```
git add . ; git commit -m "<feat|fix|refactor>: <what changed>" ; git push origin Old_ver
```

Server restart — always restart the dev server after file changes:

```
python -m http.server 8000
```

### 2.4 GitHub (permissioned-github skill)

When pushing branches or creating PRs, use `gh` CLI with `-R gentlewind-alt/ubiquitous-train`.
Request `ask_permission` with `Action="custom"` when a `git` or `gh` command fails.

---

## 3. Architecture Map

```
DSA_visualizer/
├── index.html              # Shell: navbar, editor panel, canvas panel
├── index.css               # Design system: dark studio tokens, panel layout
├── app.js                  # CORE ENGINE (single ~1400 line file)
│   ├── class RVEApplication
│   │   ├── init()                          # Wires all event listeners
│   │   ├── initPyodide()                   # Loads CPython 3.11 Wasm
│   │   ├── executePyodide(code)            # Core: introspects Python globals
│   │   │   └── [embedded Python runner]    # JSON inspection script
│   │   ├── solveLayoutConstraintsForObjects() # Reingold-Tilford layout
│   │   ├── startRenderLoop()               # Canvas RAF draw loop
│   │   ├── drawConnections()               # Edges with L/R badges
│   │   ├── drawEntities()                  # Nodes: TreeNode / Array / Primitive
│   │   ├── seekToFrame(i)                  # Timeline scrubber
│   │   ├── showInspector(entity)           # DevTools: h= bf= pointer
│   │   └── [VS Code shortcuts, pan/zoom, hardware keyboard]
├── semantic-viz.js         # Legacy / alternative semantic engine
├── docs/brainstorms/       # Requirements & brainstorm docs
├── blueprint.md            # High-level architecture blueprint
└── NativeEngine/ Runtime/  # Experimental native engine dirs
```

### Critical Code Sections in `app.js`

| Feature                  | Search Term to Locate            |
|--------------------------|----------------------------------|
| Pyodide runner script    | `runnerScript`                   |
| Object inspector         | `def inspect_obj(obj, name`      |
| Height/balance compute   | `def get_node_height`            |
| Reingold-Tilford layout  | `positionReingoldTilford`        |
| Connection drawing       | `drawLineWithEdgeBadge`          |
| Error alerts toggle      | `toggleErrorAlerts()`            |
| Live line compiler       | `triggerLiveLineCompilation`     |
| DevTools inspector UI    | `showInspector(entity)`          |

---

## 4. Data Type & Rendering Semantic Contract

The Pyodide inspection script maps Python types to canvas entity types.
These mappings are the contract between Python and the canvas:

| Python Type          | Canvas Entity Type | Color      | Notes                        |
|----------------------|--------------------|------------|------------------------------|
| `int/float/str/bool` | `Primitive`        | `#F59E0B`  | Shown as rounded rect        |
| `list`               | `ArrayCell`        | `#6366F1`  | Shown as square cells        |
| `set`                | `DictBucket`       | `#10B981`  | Shown as rounded cells       |
| `dict`               | `DictBucket`       | `#EC4899`  | Key: value label             |
| `tuple`              | `DictBucket`       | `#8B5CF6`  | Lock immutable badge         |
| Custom Node objects  | `TreeNode` or `Node`| `#6366F1` | Detected by left/right/key   |

### Node Label Convention

- Label = the value/key of the node (e.g. `50`) — minimal, no `Node(50)` text
- Sub-label = `h=${height} bf=${balanceFactor}` drawn below the circle
- Balance Factor Color Coding:
  - `|bf| <= 1` → `#6366F1` (balanced, indigo)
  - `|bf| > 1` → `#EF4444` (unbalanced, red — AVL violation)

---

## 5. Known Bugs & Gotchas

1. **`&&` not valid in PowerShell** — always use `;` to chain commands.
2. **TypeError: Object of type method is not JSON serializable** —
   occurs when `getattr(obj, 'height')` retrieves a bound method instead of int.
   Fix: always check `callable()` and `isinstance(h_attr, (int, float))`.
3. **Pyodide runner string escaping** — user code is interpolated into a
   backtick template string. Must escape: `\` → `\\`, `"` → `\"`, newlines → `\\n`.
4. **Pan state drift on mouse up** — `startPanY` is sometimes incorrectly
   initialized. If panning drifts, inspect the `mousedown` handler.
5. **Duplicate tree nodes** — `Primitive` objects named `root` are filtered
   out when tree nodes are active. See `solveLayoutConstraintsForObjects`.
6. **Class/method variables skip** — `user_globals` iteration skips anything
   where `callable(v) or isinstance(v, type)` to prevent AVLTree methods
   from appearing as canvas objects.

---

## 6. Editing Protocols

### 6.1 Before Any Edit

1. Run `grep_search` to find the exact function/section.
2. Use `view_file` with precise `StartLine`/`EndLine` — never load the whole file.
3. Understand ALL callers of the function before changing its signature.

### 6.2 Pyodide Runner Script Edits

The embedded Python script inside `executePyodide()` is a JS template literal.

Rules:
- Only use `json.dumps()` as the final expression (not `print()`).
- All Python values written to JSON must be JSON-serializable types only.
- Always guard against `callable()` attributes on objects.
- Recursion guard: `seen_ids = set()` prevents infinite loops on circular refs.

### 6.3 Canvas Renderer Edits

- The render loop runs at 60fps via `requestAnimationFrame`.
- Always save/restore `ctx` state: `this.ctx.save()` / `this.ctx.restore()`.
- Hit-testing in `handleCanvasClick()` must inverse-transform mouse coordinates:
  `mouseX = (rawX - panX) / zoomScale`.

### 6.4 Layout Solver Edits

The Reingold-Tilford solver in `solveLayoutConstraintsForObjects()` works by:
1. Grouping objects by their `varName` prefix (before `[`, `{`, `.`).
2. Dispatching to type-specific layout: Primitive, ArrayCell, DictBucket, TreeNode, Node.
3. For TreeNode: recursive `positionReingoldTilford(nodeId, x, y, levelSpacing)`
   where spacing halves by `/1.75` per level (min 28px).

To add a new layout type, add a new `else if` branch dispatched on `firstType`.

---

## 7. Design System Tokens (index.css)

```
--bg-dark:          #0A0E17   (Canvas / body background)
--panel-bg:         #121826   (Editor & visualizer panel)
--panel-header-bg:  #1A2234   (Panel header bars)
--border-color:     #26334D   (Default borders)
--border-highlight: #3B4F74   (Hover/active borders)
--accent-color:     #6366F1   (Primary: indigo)
--accent-hover:     #4F46E5   (Primary hover)
--accent-glow:      rgba(99,102,241,0.35)
--text-main:        #F1F5F9   (Primary text)
--text-muted:       #94A3B8   (Muted text)
--success-color:    #10B981   (Green: saved, set, balanced)
--warning-color:    #F59E0B   (Amber: primitives, unsaved)
--error-color:      #EF4444   (Red: errors, unbalanced nodes)
```

Font stack: `Inter` for UI, `Fira Code` for code/terminal/node labels.
Always use CSS variables. Never hardcode hex colors in CSS rules.

---

## 8. Git & Branching Convention

| Branch     | Purpose                              |
|------------|--------------------------------------|
| `main`     | Stable base                          |
| `Old_ver`  | Active development branch (current)  |

Commit message format:

```
feat: <new capability>
fix: <bug fixed and why>
refactor: <what changed structurally>
docs: <documentation update>
```

---

## 9. Agent Operating Principles

### Think in Systems, Not Lines

Before touching a function, understand its role in the full pipeline:
`user code → Pyodide exec → JSON objects → layout solver → render loop → canvas`.
A change to the JSON schema propagates to the layout solver, renderer, and inspector.

### Verify Before Mutating

- Never guess at a function's location — `grep_search` first.
- Never assume a variable's type — check the Python type contract table in §4.
- Never assume the canvas coordinate space — account for pan/zoom transform.

### Preserve What Works

When adding features:
- Do not break the existing entity rendering pipeline.
- Do not introduce new CSS color values outside the token system in §7.
- Do not change the JSON field names emitted by `inspect_obj()` without
  updating `drawEntities()`, `showInspector()`, and the layout solver.

### Fail Loudly in Dev, Silently in Prod

- Error Alerts ON: surface CPython exceptions to the canvas banner.
- Error Alerts OFF: log to console only, keep the canvas clean.
- Never let a JS exception bubble up uncaught into the render loop.

### Restart the Server After File Changes

The dev server does not hot-reload. Always restart:
```
python -m http.server 8000
```
Instruct the user to hard-refresh (`Ctrl+Shift+R`) after JS/CSS changes.

---

## 10. Slash Command Reference

| Command               | Best Used For                                          |
|-----------------------|--------------------------------------------------------|
| `/plan`               | Before large refactors (new layout engine, new type)   |
| `/goal`               | Overnight tasks: implement full traversal animation    |
| `/ce-frontend-design` | Any CSS/UI polish pass on the studio interface         |
| `/learn`              | After fixing a recurring bug (e.g. PowerShell `&&`)    |
| `/teamwork-preview`   | Splitting engine, layout, UI into parallel agents      |

---

## 11. Future Roadmap Items (Do Not Implement Without Being Asked)

- [ ] Traversal animation (inorder/preorder/postorder node highlighting)
- [ ] Call-stack panel (recursive insert/delete frame visualization)
- [ ] Operation overlay (comparison decisions: `45 < 50 -> Go Left`)
- [ ] Rotation animation (highlight pivot → rotate subtree → reconnect edges)
- [ ] Learning mode vs Advanced mode toggle for node metadata density
- [ ] Persistent canvas camera state (panX, panY, zoomScale) in localStorage
