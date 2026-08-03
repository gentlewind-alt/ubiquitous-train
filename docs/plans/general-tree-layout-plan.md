---
title: General Tree Layout & Semantic Pipeline
status: active
origin: docs/brainstorms/general-tree-layout-requirements.md
created: 2026-08-03
---

# Implementation Plan — General Tree Layout & Semantic Pipeline

## Problem Frame

The layout engine hard-codes `left`/`right` as the only tree edge attributes.
Any n-ary tree (filesystem, org chart, AST) falls through to the vertical-list
fallback, making it unreadable. This plan adds a two-phase semantic pipeline
(Topology Detector → Domain Detector → SemanticProfile) and a generalized n-ary
Reingold-Tilford layout, while leaving all existing layouts untouched.

(see origin: `docs/brainstorms/general-tree-layout-requirements.md`)

---

## Architecture Decision

**Single file, additive approach.** All changes land in `app.js`. No bundler,
no module split. New logic is added as:
- A Python runner extension (embedded string in `executePyodide`)
- Two new JS functions (`detectTopology`, `detectDomain`) inserted before
  `solveLayoutConstraintsForObjects`
- A new dispatch branch in `solveLayoutConstraintsForObjects` for `NaryNode`
- A new render branch in `drawEntities` and `drawConnections` for `NaryNode`

The key contract change: entities whose topology is NaryTree get `type:
"NaryNode"` and carry a `children: [id, id, ...]` array instead of `left`/`right`.
The existing `TreeNode` type and its binary layout path are untouched.

**Why not reuse `TreeNode`?** The binary tree layout uses `left`/`right` for
both layout and edge-drawing. Sharing the type would require branching inside
an already complex renderer. A dedicated `NaryNode` type is clean and isolated.

---

## Implementation Units

### IU-1: Python Runner — Emit Full Slot Table

**File:** `app.js` — inside `executePyodide()`, the `inspect_obj()` Python
function (~L790–837)

**Problem:** The runner currently hardcodes lookups for `left`, `right`,
`next`, `manager` only. The Topology Detector (IU-2) needs to see **all**
instance attributes to discover the child-list attribute by graph analysis,
not by name. The Domain Detector (IU-3) needs class names (already emitted as
`pyType`) and attribute names (not yet emitted).

**Changes:**

1. Extend `inspect_obj()` to iterate `obj.__dict__` and build a `slots` list:
   each slot is `{ attr: str, ref: "py_0x..." | null, isList: bool }`.
   - For each attr in `obj.__dict__`:
     - If the value is a custom object instance (not callable, not primitive
       Python type): emit as a `ref` pointing to its Pyodide object ID.
     - If the value is a list: inspect each element; emit `isList: true` with
       an array of refs for same-class elements, null for others.
     - If the value is a scalar: emit `ref: null`, include the scalar value
       as a `scalar` field for label/domain detection.
2. Keep the existing hardcoded `left`, `right`, `next`, `manager` fields on
   the emitted object for **backward compatibility** with the existing
   `TreeNode` / `Node` path. The new `slots` array is additive.
3. Cap `slots` at 20 attributes to prevent serialization explosions.
4. Guard: only emit `slots` for custom class instances (the `else:` branch in
   the globals loop, i.e., objects already routed through `inspect_obj`).

**Resulting object shape addition:**
```
{
  "id": "py_0x...",
  "pyType": "Folder",          // already emitted
  "slots": [
    { "attr": "name",     "ref": null,        "scalar": "Documents", "isList": false },
    { "attr": "children", "ref": null,        "isList": true,
      "listRefs": ["py_0x...", "py_0x..."] }
  ],
  ...existing fields unchanged...
}
```

**Pyodide runner rules to follow (from AGENTS.md §6.2):**
- Only `json.dumps()` as the final expression, no `print()`
- All values JSON-serializable
- Guard `callable()` on every attribute access
- `seen_ids` recursion guard must wrap all new recursive inspection calls

**Test scenarios:**
- `class Folder: def __init__(self): self.name=""; self.children=[]` → slots
  contains `name` (scalar) and `children` (isList=true)
- A node with a bound method attribute → method is excluded (`callable()` guard)
- A node with 25 attributes → only first 20 slots emitted
- Existing binary tree code (`root.left`, `root.right`) → `slots` is populated
  AND existing `left`/`right` fields are still present

---

### IU-2: TopologyDetector — Graph Analysis

**File:** `app.js` — new function `detectTopology(objects)` inserted above
`solveLayoutConstraintsForObjects` (~L1012)

**Input:** The raw `objects` array returned by `executePyodide` (or the JS
fallback). Each object has `id`, `pyType`, `slots[]`, `left`, `right`, `next`.

**Output:** A `SemanticProfile` object:
```js
{
  topology: "NaryTree",   // BinaryTree | NaryTree | LinkedList | Generic
  childAttr: "children",  // discovered child-list attribute name, or null
  rootId: "py_0x...",     // id of the root node
  roots: ["py_0x..."],    // all root ids (forest support)
  childrenMap: Map<id, [id, ...]>,  // pre-built parent→children mapping
}
```

**Algorithm:**

1. **Build reference graph** — create an in-degree map and an adjacency list
   by scanning:
   - Each object's `left`, `right`, `next` fields (existing binary/linked refs)
   - Each object's `slots[].listRefs` (new n-ary refs from IU-1)
   
2. **Check for BinaryTree first** (most specific wins, per requirements):
   - All objects of the dominant class have at most 2 object-type refs in their
     slots (or `left`/`right` set)
   - No cycles (DFS cycle check)
   - If yes → `topology: "BinaryTree"`, return early (existing code handles it)

3. **Check for NaryTree**:
   - Find the slot attribute where: (a) `isList === true`, (b) every `listRef`
     element has the same `pyType` as the parent
   - If such an attribute exists on the majority (>50%) of objects → that
     attribute is `childAttr`
   - Verify no cycles → `topology: "NaryTree"`

4. **Check for LinkedList**:
   - Each node has exactly one outgoing ref of the same class
   - → `topology: "LinkedList"`

5. **Fallback** → `topology: "Generic"`

6. **Root detection**:
   - Root = object with in-degree 0 in the reference graph
   - If multiple roots → `roots` array (forest), lay out each tree separately
   - If no roots (cycle or disconnected) → pick first object as root

**Cycle detection:** DFS with a `visiting` set (gray nodes). If a gray node is
revisited → cycle found → `topology: "CyclicGraph"` (renders as Generic flat
layout, does not crash).

**Test scenarios:**
- `Folder` with `children: [Folder, Folder]` → `NaryTree`, childAttr="children"
- Employee with `reports: [Employee]` (any attr name) → `NaryTree`
- `Node(left, right)` binary tree → `BinaryTree` (existing path untouched)
- Linked list (`.next` chain) → `LinkedList`
- Circular ref (`a.children = [b]; b.children = [a]`) → `CyclicGraph` → no crash
- Two disconnected trees → `roots` has 2 entries → forest layout
- Object with 0 slots → `Generic`

---

### IU-3: DomainDetector — Class/Attr Signal Matching

**File:** `app.js` — new function `detectDomain(objects, profile)` inserted
directly after `detectTopology`, before `solveLayoutConstraintsForObjects`

**Input:** The `objects` array and the `SemanticProfile` from IU-2 (needed for
`childAttr` to distinguish children from other attrs in signal scoring).

**Output:** Adds to the SemanticProfile:
```js
{
  ...profile,
  domain: "Filesystem",      // Filesystem | OrgChart | AST | SceneGraph | Menu | Generic
  domainConfidence: 0.85,
  icon: "📁",                // internal-node icon
  leafIcon: "📄",            // leaf-node icon
  nodeColor: "#10B981",      // node fill color
  edgeColor: "#059669",      // edge stroke color
}
```

**Domain signal table (from requirements §4.2):**

Each domain has a `classSignals` set and an `attrSignals` set. Confidence =
(matched class signals + matched attr signals) / (total signals checked).

```js
const DOMAIN_REGISTRY = [
  {
    name: "Filesystem",
    classSignals: ["Folder","Directory","Dir","File","Path"],
    attrSignals:  ["children","files","subfolders","name","extension","path"],
    icon: "📁", leafIcon: "📄",
    nodeColor: "#10B981", edgeColor: "#059669",
  },
  {
    name: "OrgChart",
    classSignals: ["Employee","Person","Manager","Worker","Department"],
    attrSignals:  ["reports","team","subordinates","employees","name","title","role"],
    icon: "👤", leafIcon: "👤",
    nodeColor: "#6366F1", edgeColor: "#4F46E5",
  },
  {
    name: "AST",
    classSignals: ["ASTNode","Statement","Expression","Decl"],
    attrSignals:  ["body","args","op","value"],
    icon: "⬡", leafIcon: "◉",
    nodeColor: "#F59E0B", edgeColor: "#D97706",
  },
  {
    name: "SceneGraph",
    classSignals: ["SceneNode","GameObject","Transform","Entity"],
    attrSignals:  ["position","rotation","scale"],
    icon: "⬜", leafIcon: "⬜",
    nodeColor: "#8B5CF6", edgeColor: "#7C3AED",
  },
  {
    name: "Menu",
    classSignals: ["MenuItem","Menu","NavItem","Option"],
    attrSignals:  ["label","href","icon","disabled"],
    icon: "☰", leafIcon: "▪",
    nodeColor: "#EC4899", edgeColor: "#DB2777",
  },
];
```

**Scoring algorithm:**
1. Collect all unique `pyType` values from the objects array.
2. Collect all unique slot `attr` names from objects' `slots`.
3. For each domain in `DOMAIN_REGISTRY`:
   - `classScore` = fraction of class signals matched in the pyType set
   - `attrScore` = fraction of attr signals matched in the slot attr set
   - `confidence` = (classScore + attrScore) / 2
4. Pick the domain with highest confidence. If < 0.4 → `Generic`.
5. Generic uses existing colors/no icon (null icon field → renderer uses
   current circle-only behavior).

**Test scenarios:**
- Objects with `pyType="Folder"` and attr `children` → Filesystem ≥ 0.6
- Objects with `pyType="Employee"` and attrs `reports`, `name` → OrgChart
- Objects with `pyType="Widget"` and attr `items` → Generic (< 0.4)
- Binary tree objects (topology=BinaryTree) → `detectDomain` is called but
  domain result is ignored — binary tree rendering uses existing path regardless

---

### IU-4: N-ary Reingold-Tilford Layout

**File:** `app.js` — new branch in `solveLayoutConstraintsForObjects()`,
inserted after the existing `TreeNode` branch (~L1054–1096), before the
`else` (linked list) fallback

**Trigger condition:** `profile.topology === "NaryTree"`

**Entity type:** Objects in an n-ary tree get `type: "NaryNode"` set on them
(not `TreeNode` or `Node`), so the existing binary path is not touched.

**Algorithm (top-down Reingold-Tilford for n children):**

The existing binary version uses a recursive `positionReingoldTilford` that
calls itself for `node.left` and `node.right`. The n-ary version:

1. `getSubtreeWidth(nodeId)` — recursive:
   - For each child in `childrenMap.get(nodeId)`, sum their subtree widths.
   - Return `Math.max(1, sumOfChildWidths)`.
   - Leaf nodes return width=1.

2. `positionNaryNode(nodeId, x, y, availableWidth)`:
   - Set `node.x = x`, `node.y = y`.
   - Get children list from `profile.childrenMap`.
   - Compute each child's subtree width proportionally within `availableWidth`.
   - Starting x = `x - availableWidth/2`.
   - For each child: place at `childX = startX + (childSubtreeWidth / 2)`,
     recurse with `y + LEVEL_SPACING`, `availableWidth = childSubtreeWidth`.
   - After positioning, set `node.children = childIds` (array of ids, for
     `drawConnections` to use).

3. Constants:
   - `LEVEL_SPACING = 80` (px between tree levels, slightly larger than binary's 68px for readability)
   - `NODE_DIAMETER = 44` (px, used as minimum width per leaf)
   - `initialWidth = Math.max(totalLeaves * NODE_DIAMETER, canvas.width * 0.8)`

4. After positioning all nodes, advance `currentY` past the tree's bounding
   box before the next group renders.

5. Apply domain color to each node:
   ```js
   node.color = profile.nodeColor || "#6366F1";
   node.edgeColor = profile.edgeColor || "#4F46E5";
   node.icon = isLeaf ? profile.leafIcon : profile.icon;
   ```
   A leaf is a node whose `childrenMap` entry is empty or absent.

**Forest support:** For each root in `profile.roots`, call
`positionNaryNode(root, cx_offset, currentY, treeWidth)` side by side,
spacing each tree by its own bounding width + a 60px gap.

**Test scenarios:**
- 3-level filesystem tree (1 root, 3 children, 9 grandchildren) → all nodes
  spread horizontally, no overlaps
- Single-child chain (n-ary tree with 1 child per node) → renders as a vertical
  column (correct, not a linked list)
- 2 disconnected trees → laid out side by side
- Very wide tree (8 children at level 1) → nodes fit within canvas width;
  pan to see if they overflow

---

### IU-5: NaryNode Renderer — drawEntities + drawConnections

**File:** `app.js` — two functions

#### 5a — drawEntities (new branch, ~L1259)

Add a new `else if (entity.type === "NaryNode")` branch in `drawEntities()`.
Insert it **before** the final `else` (generic Node) branch.

Draw:
1. **Circle** — same as `TreeNode` (radius 20, `fillStyle = entity.color`).
2. **Label** — `entity.label` centered in circle, same font as `TreeNode`.
3. **Icon** — if `entity.icon` is set:
   - Draw emoji above the circle: `ctx.fillText(entity.icon, entity.x, entity.y - 26)`
   - Font: `"16px serif"` (emoji rendering requires serif or system font)
4. **Sub-label** — if `entity.subLabel` is set (domain metadata e.g. `ext=.pdf`):
   - Draw below circle at y+28 in muted color, small font (same as bf badge).

`ctx.save()` / `ctx.restore()` wraps each entity draw pass.

#### 5b — drawConnections (new branch, ~L1166)

In `drawConnections()`, add a check for `entity.children` (array of child ids):

```js
if (entity.children && entity.children.length > 0) {
    entity.children.forEach(childId => {
        if (this.entities.has(childId)) {
            const target = this.entities.get(childId);
            // Draw plain line (no L/R badge — n-ary trees don't have binary semantics)
            this.ctx.beginPath();
            this.ctx.moveTo(entity.x, entity.y + 20);
            this.ctx.lineTo(target.x, target.y - 20);
            this.ctx.strokeStyle = entity.edgeColor || "rgba(255,255,255,0.3)";
            this.ctx.lineWidth = 1.5;
            this.ctx.stroke();
        }
    });
}
```

No L/R badge for n-ary edges — they are positionally implied by layout.

**Test scenarios:**
- Filesystem tree: 📁 icon visible above each folder node; 📄 on leaf nodes
- OrgChart: 👤 icon on each employee node
- Generic NaryTree (no domain match): circle rendered without icon (just label)
- Edge lines connect parent to all children with domain-accent color
- Selected node (click): selection ring draws correctly around NaryNode (the
  existing `isSelected` arc at radius 28 works for NaryNode too without change)

---

## Integration Point — Wiring the Pipeline

**File:** `app.js` — `solveLayoutConstraintsForObjects(objects)` entry point
(~L1013)

The current function signature and call sites don't change. Add the pipeline
at the top of `solveLayoutConstraintsForObjects` before the existing dispatch:

```
// DIRECTION (not code):
// 1. Run detectTopology(objects) → profile
// 2. If topology is BinaryTree or LinkedList or Generic → fall through to
//    existing dispatch (no change to downstream code)
// 3. If topology is NaryTree → run detectDomain(objects, profile) → enriched
//    profile, then dispatch to new NaryTree layout branch
// 4. The profile object is local to this call; nothing persists to class state
```

This keeps the existing paths fully isolated. The only shared contract is that
`objects` enters and positioned entities exit — unchanged.

---

## Sequencing

```
IU-1 → IU-2 → IU-3
                 ↓
               IU-4
                 ↓
               IU-5
```

IU-1 must ship before IU-2 (topology detection needs the slots data).
IU-2 must ship before IU-3 (domain detection takes the profile from topology).
IU-4 and IU-5 can be developed in parallel once IU-3's SemanticProfile shape
is locked, but IU-5 has no canvas effect until IU-4 positions the nodes.

Each IU is independently testable:
- IU-1: verify the runner emits slots in browser console
- IU-2: call `detectTopology(objects)` in browser console with mock objects
- IU-3: call `detectDomain(objects, profile)` in console
- IU-4: verify node positions in console before rendering
- IU-5: visual verification in canvas

---

## Risks & Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Pyodide runner string escaping breaks with new Python code | Medium | Strictly follow the escape rules in AGENTS.md §6.2; test with a Folder tree immediately after IU-1 |
| N-ary width calculation produces overlap for very wide trees (8+ siblings) | Medium | Use `canvas.width * 0.8` as the min initial width; add a 50-node test case during IU-4 |
| Emoji rendering on canvas varies by OS/browser | Low | Test on Windows Chrome; fall back to ASCII glyph (`F`,`D`,`O`) if `ctx.fillText` produces tofu box |
| `detectTopology` misclassifies a binary tree as NaryTree (both `left`/`right` AND a `children` list exist) | Low | BinaryTree check runs first and returns early; add a test for this exact case |
| `slots` serialization causes circular JSON if two objects reference each other | Medium | The `seen_ids` set in the runner already guards against this; verify it covers new slot recursion paths |

---

## Backward Compatibility Contract

These must not change behavior:
- Any Python code producing `TreeNode` objects (left/right) → same layout as today
- Any Python code producing `Node` objects (next chain) → same layout as today
- Primitive, ArrayCell, DictBucket → same layout as today
- `showInspector()` — no changes; NaryNode entities can display `entity.slots`
  in the inspector as a bonus (optional)
- `handleCanvasClick()` hit-test radius (25px) — NaryNode uses the same 20px
  circle, so existing hit-test works without change

---

## Files Changed

| File | Nature of change |
|---|---|
| `app.js` | All changes land here |

Sections touched in `app.js`:
- `executePyodide()` → Python runner string (~L761–914): extend `inspect_obj` with slots
- New function `detectTopology()`: insert ~L1012 (above `solveLayoutConstraintsForObjects`)
- New function `detectDomain()`: insert ~L1012+30 (above `solveLayoutConstraintsForObjects`)
- `solveLayoutConstraintsForObjects()` (~L1013): add NaryTree dispatch branch + pipeline entry
- `drawConnections()` (~L1160): add `entity.children` edge-drawing branch
- `drawEntities()` (~L1245): add `NaryNode` render branch

No changes to `index.html`, `index.css`, or `semantic-viz.js`.
