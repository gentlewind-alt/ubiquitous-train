# AGENTS.md — RVE Studio: Runtime Visualization Engine
# Project Intelligence Manifest for Antigravity (AGY)

> **Scope & Mandatory Rule**: This file, along with [`agent.md`](file:///C:/Users/samar/OneDrive/Desktop/projects/DSA_visualizer/agent.md) and [`LESSONS_LEARNED.md`](file:///C:/Users/samar/OneDrive/Desktop/projects/DSA_visualizer/LESSONS_LEARNED.md), constitutes the single authoritative operating context for any AI agent working on this project.
> **EVERY USER REQUEST MUST USE AND ADHERE TO `AGENTS.md`, `agent.md`, AND `LESSONS_LEARNED.md`**.
> They define how the agent should think, search, edit, collaborate, and reason — going beyond "just coding" into being an active co-architect of a visualization engine.

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

## 2. Mandatory Engineering Workflow

Every non-trivial feature, bug fix, refactor, or optimization MUST follow this workflow:

### Phase 1 — Understand
Before writing any code:
- Understand the feature request.
- Identify every subsystem involved.
- Explain the current architecture.
- Explain why the current implementation behaves as it does.

*Never modify code before understanding the execution pipeline.*

---

### Phase 2 — Search
Before editing:
- `grep_search` every affected function.
- Locate every caller.
- Locate every renderer.
- Locate every data producer.
- Locate every consumer.

*Never assume a function location.*

---

### Phase 3 — Design
Produce a concise data flow design containing:

$$\text{Input} \longrightarrow \text{Transformation} \longrightarrow \text{Intermediate Representation} \longrightarrow \text{Renderer} \longrightarrow \text{Canvas} \longrightarrow \text{User-Visible Result}$$

*If the data flow cannot be explained, do not implement.*

---

### Phase 4 — Risk Analysis
Before editing, identify potential breaking changes in:
- Breaking changes & side effects
- Performance impact
- JSON schema changes
- Layout changes
- Rendering changes
- Camera changes
- Animation changes

---

### Phase 5 — Implementation
- Edit the minimum number of files required.
- Prefer extending existing systems over creating new ones.
- Avoid duplicate abstractions.

---

### Phase 6 — Verification
Before claiming completion verify:
- [x] Runtime executes without uncaught exceptions
- [x] Renderer consumes new data
- [x] Animation plays correctly
- [x] Inspector updates
- [x] Timeline updates
- [x] Camera behaves correctly
- [x] No regressions introduced

---

### Phase 7 — Report
Every implementation summary MUST explicitly state:
- Files changed
- Functions modified
- New classes
- Execution path
- User-visible behavior
- Remaining work

*Never claim "implemented" unless the feature is observable.*

---

## 3. Engineering Principles

1. **Runtime Truth**: Everything rendered must originate from runtime execution. Never fabricate semantic information.
2. **Semantic Before Visual**: The renderer is the last stage. Semantics determine visualization; visualization never invents semantics.
3. **Single Source of Truth**: Every piece of runtime information should exist once. Avoid duplicate state or parallel representations.
4. **Extend Before Replacing**: Prefer extending existing architecture. Only introduce new abstractions when existing systems cannot be reasonably extended.
5. **Educational First**: Visualization exists to explain computation. Every animation must answer: *What changed? Why? Where did the value originate? Where is it going? What operation is occurring?*
6. **Animation Explains Computation**: Animations are never decorative. They should communicate movement, ownership, reference changes, value flow, and algorithm progress.
7. **Stable Layout**: The layout engine should minimize node movement. Only changed objects should animate; unchanged objects should remain spatially stable.
8. **Evidence Over Claims**: Never claim *Implemented*, *Completed*, *Supported*, or *Working* unless the implementation exists, the renderer consumes it, and the feature is observable.

---

## 4. Architecture & Pipeline Rules

The visualization pipeline is strictly layered:

$$\text{Python Runtime} \longrightarrow \text{Runtime Snapshot} \longrightarrow \text{Runtime IR} \longrightarrow \text{Semantic IR} \longrightarrow \text{Animation IR} \longrightarrow \text{Layout Engine} \longrightarrow \text{Renderer} \longrightarrow \text{Canvas}$$

- Each layer must have exactly one responsibility.
- No layer should bypass another.
- The renderer must never infer semantics.
- Semantics must never perform rendering.
- Layout must never mutate runtime state.

---

## 5. Implementation Quality & Performance Rules

### Quality Constraints
Do not generate:
- `TODO` comments
- Placeholder implementations
- Temporary fixes
- Fake animations
- Hardcoded values
- Mock behavior
- Empty abstractions
- Unused classes

*Every new abstraction must have at least one active consumer.*

### Performance Budget
- **Target FPS**: 60 FPS
- **Layout Computation**: < 16ms
- **Animation Update**: < 4ms
- **Avoid**: $O(n^2)$ rendering, repeated allocations, duplicate graph traversals, repeated JSON parsing, or garbage-heavy animation loops.
- Renderer should reuse objects whenever possible.

---

## 6. Visualization Philosophy

The Runtime Visualization Engine is not an object inspector; it is an **execution explainer**. The objective is not to show memory, but to explain: *execution, ownership, references, indexing, iteration, computation, data flow, and state changes.*

| Visual Element | Question Answered |
|---|---|
| **Reference Arrow** | *"What owns this?"* |
| **Index Highlight** | *"What element is being accessed?"* |
| **Value Particle** | *"What value is moving?"* |
| **Operation Node** | *"What computation is occurring?"* |
| **Camera** | *"What deserves attention?"* |
| **Timeline** | *"What changed over time?"* |
| **Animation** | *"Why did it change?"* |

---

## 7. Feature Acceptance Checklist

Before any feature is marked complete, verify:
- [x] Runtime executes
- [x] Runtime snapshot updated
- [x] Runtime IR updated
- [x] Semantic IR updated
- [x] Animation IR updated
- [x] Renderer updated
- [x] Timeline updated
- [x] Inspector updated
- [x] Camera updated
- [x] User-visible behavior exists

---

## 8. Kimi-K3 Usage & Mentorship Protocol (`kimi_agent.py`)

Kimi-K3 (`moonshotai/kimi-k3-free`) via TokenRouter (`https://api.tokenrouter.com/v1`) serves as the **Master Architectural Mentor & Lead Designer** for this project.

- **Bridge Script**: `C:\Users\samar\.gemini\antigravity-cli\kimi_agent.py`
- **Capabilities**: Full access to system tools (`read_file`, `write_file`, `run_command`) and all 39 AGY skills (`get_skill_instruction`).

### Allocation & Scoping Policy
- **Use Kimi-K3 For**: Major architecture, renderer redesign, semantic engine, layout engine, animation engine, large refactors, cross-system debugging.
- **Avoid Kimi-K3 For**: Small bug fixes, variable renaming, formatting, minor CSS, simple utility functions.
- **Workflow**: Use Kimi to design → Use AGY to implement → Use AGY to iterate → Use Kimi to review.

### Mentorship Directive for Main AGY Models
1. **Channel Kimi's Mastery**: Primary AGY models must adopt Kimi's high-level architectural rigor, clean design aesthetic, and robust error-handling standards, writing code as if they are Kimi themselves.
2. **Design & Blueprint First**: Consult Kimi for architectural design and skill blueprints before writing code:
   ```powershell
   python C:\Users\samar\.gemini\antigravity-cli\kimi_agent.py -p "Use ce-plan to design a high-performance tree traversal animation engine"
   ```

---

## 9. Agent Capabilities & Permitted Tool Usage

### 9.1 File Intelligence
- `read_file` — scan any file or directory tree
- `write_file` — create new files
- `multi_replace_file_content` — surgical multi-chunk edits (PREFERRED for precision edits)
- `replace_file_content` — single contiguous block replacement

**Surgical edit preference**: Always prefer `multi_replace_file_content` over `write_to_file` for existing files. Only use `write_to_file` with `Overwrite: true` when the file needs a complete structural rewrite (>60% change).

### 9.2 Code Search
- `grep_search` — regex or literal ripgrep across the codebase
- `list_dir` — map the directory tree before editing
- `view_file` — read specific line ranges (ALWAYS specify StartLine/EndLine)

### 9.3 Execution & Git
Use `run_command` for all shell operations. PowerShell on Windows:
- Use `;` NOT `&&` to chain commands.
- Git workflow:
```powershell
git add . ; git commit -m "<feat|fix|refactor>: <what changed>" ; git push origin Old_ver
```
- Server restart:
```powershell
python -m http.server 8000
```

---

## 10. Architecture Map & Code Locations

```
DSA_visualizer/
├── index.html              # Shell: navbar, editor panel, canvas panel
├── index.css               # Design system: dark studio tokens, panel layout
├── app.js                  # CORE ENGINE (~1400 lines)
│   ├── class RVEApplication
│   │   ├── init()                          # Wires event listeners
│   │   ├── initPyodide()                   # Loads CPython 3.11 Wasm
│   │   ├── executePyodide(code)            # Core: introspects Python globals
│   │   │   └── [embedded Python runner]    # JSON inspection script
│   │   ├── solveLayoutConstraintsForObjects() # Reingold-Tilford layout
│   │   ├── startRenderLoop()               # Canvas RAF draw loop
│   │   ├── drawConnections()               # Edges with L/R badges
│   │   ├── drawEntities()                  # Nodes: TreeNode / Array / Primitive
│   │   ├── seekToFrame(i)                  # Timeline scrubber
│   │   └── showInspector(entity)           # DevTools inspector
├── semantic-viz.js         # Legacy / alternative semantic engine
├── docs/brainstorms/       # Requirements & brainstorm docs
└── blueprint.md            # High-level architecture blueprint
```

### Critical Code Sections in `app.js`

| Feature | Search Term to Locate |
|---|---|
| Pyodide runner script | `runnerScript` |
| Object inspector | `def inspect_obj(obj, name` |
| Height/balance compute | `def get_node_height` |
| Reingold-Tilford layout | `positionReingoldTilford` |
| Connection drawing | `drawLineWithEdgeBadge` |
| Error alerts toggle | `toggleErrorAlerts()` |
| Live line compiler | `triggerLiveLineCompilation` |
| DevTools inspector UI | `showInspector(entity)` |

---

## 11. Data Type & Rendering Semantic Contract

| Python Type | Canvas Entity Type | Color | Notes |
|---|---|---|---|
| `int/float/str/bool` | `Primitive` | `#F59E0B` | Shown as rounded rect |
| `list` | `ArrayCell` | `#6366F1` | Shown as square cells |
| `set` | `DictBucket` | `#10B981` | Shown as rounded cells |
| `dict` | `DictBucket` | `#EC4899` | Key: value label |
| `tuple` | `DictBucket` | `#8B5CF6` | Lock immutable badge |
| Custom Node objects | `TreeNode` or `Node` | `#6366F1` | Detected by left/right/key |

### Node Label Convention
- Label = value/key of node (e.g. `50`)
- Sub-label = `h=${height} bf=${balanceFactor}`
- Balance Factor Color: $|bf| \le 1 \rightarrow \text{indigo } (\#6366F1)$, $|bf| > 1 \rightarrow \text{red } (\#EF4444)$

---

## 12. Design System Tokens (`index.css`)

```css
--bg-dark:          #0A0E17   /* Canvas / body background */
--panel-bg:         #121826   /* Editor & visualizer panel */
--panel-header-bg:  #1A2234   /* Panel header bars */
--border-color:     #26334D   /* Default borders */
--border-highlight: #3B4F74   /* Hover/active borders */
--accent-color:     #6366F1   /* Primary: indigo */
--accent-hover:     #4F46E5   /* Primary hover */
--accent-glow:      rgba(99,102,241,0.35)
--text-main:        #F1F5F9   /* Primary text */
--text-muted:       #94A3B8   /* Muted text */
--success-color:    #10B981   /* Green: saved, set, balanced */
--warning-color:    #F59E0B   /* Amber: primitives, unsaved */
--error-color:      #EF4444   /* Red: errors, unbalanced nodes */
```

Font stack: `Inter` for UI, `Fira Code` for code/terminal/node labels. Always use CSS variables.

---

## 13. Known Bugs & Gotchas

1. **`&&` not valid in PowerShell** — always use `;` to chain commands.
2. **TypeError: Object of type method is not JSON serializable** — check `callable()` and `isinstance(h_attr, (int, float))`.
3. **Pyodide runner string escaping** — escape `\`, `"`, and newlines in template literals.
4. **Pan state drift on mouse up** — check `startPanY` in `mousedown` handler.
5. **Duplicate tree nodes** — `Primitive` objects named `root` are filtered when tree nodes are active.
6. **Class/method variables skip** — `user_globals` iteration skips `callable(v)` or `isinstance(v, type)`.

---

## 14. Slash Command Reference

| Command | Best Used For |
|---|---|
| `/plan` | Before large refactors (new layout engine, new type) |
| `/goal` | Overnight tasks: implement full traversal animation |
| `/ce-frontend-design` | Any CSS/UI polish pass on the studio interface |
| `/learn` | After fixing a recurring bug |
| `/teamwork-preview` | Parallel agent delegation |

