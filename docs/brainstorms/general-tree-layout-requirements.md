# General Tree Layout & Semantic Pipeline Requirements

**Project:** Runtime Visualization Engine (RVE)
**Date:** August 2026
**Status:** Requirements — Ready for Planning

---

## 1. Problem Statement

The current layout engine handles exactly two topologies: **binary trees** (via
`left`/`right` detection) and a **fallback vertical list** for everything else.
When a user builds any n-ary tree structure (filesystem, org chart, AST, menu
tree) the nodes are placed on a single vertical axis, making the visualization
unreadable and defeating the educational purpose.

The root cause is architectural: the engine conflates *topology* (how objects
are connected) with *shape detection* (hardcoded attribute names like `left`,
`right`). This makes any tree that isn't binary invisible to the layout solver.

---

## 2. Target Architecture

The pipeline adds two new phases between object inspection and layout:

```
Python Code
    ↓
CPython Tracer  (app.js — existing)
    ↓
Object Graph JSON  (existing schema: id, type, slots)
    ↓
[NEW] Topology Detector  — "How are objects connected?"
    ↓
Topology: BinaryTree | NaryTree | LinkedList | DAG | ...
    ↓
[NEW] Domain Detector  — "What does this represent?"
    ↓
Domain: Filesystem | OrgChart | AST | SceneGraph | Menu | Generic
    ↓
Semantic Profile  (topology + domain + layout hint + theme hint)
    ↓
Layout Registry  — dispatches to the right layout algorithm
    ↓
Canvas Renderer  (existing, extended for domain themes)
```

---

## 3. Phase 1 — Topology Detector

### 3.1 Principles

- Detection is based **purely on the reference graph structure**, not on
  attribute names. A class with `reports=[]`, `children=[]`, `branches=[]`, or
  `items=[]` all resolve to the same topology if their shape matches.
- The detector builds a directed graph from all object-to-object references in
  the inspected globals, then runs graph algorithms on that structure.

### 3.2 Topology Classification Rules

| Topology | Detection Criteria |
|---|---|
| `BinaryTree` | Each node has at most 2 object-reference children. Any attribute can be the child; `left`/`right` is a hint but not a requirement. No cycles. |
| `NaryTree` | Each node has one list-typed attribute that contains references to objects of the same class (or a compatible subclass). No cycles. No back-edges. |
| `LinkedList` | Each node has exactly one object-reference child of the same class, forming a chain. |
| `DAG` | Multiple paths to some nodes, but no cycles. |
| `CyclicGraph` | Cycles detected. |
| `Primitive/Flat` | No object-to-object references — scalars, lists, dicts only. |

The detector returns the **most specific** topology that fits. If an object has
both a `left`/`right` pair AND a `children` list, binary tree wins (more
specific).

### 3.3 N-ary Child List Discovery

To find the child-list attribute without hardcoding names:

1. Iterate all attributes of each object in the graph.
2. For each attribute that is a `list`, check if **every element** in the list
   is an object reference to the same class as the parent.
3. The first such list attribute is the **child edge** for that class.
4. If multiple lists qualify (ambiguous), prefer the longest one, then
   alphabetical as a tiebreaker.

### 3.4 Root Detection

For a tree topology, the root is the object with **in-degree 0** in the
reference graph (no other object holds a reference to it). If multiple roots
exist, treat as a forest — lay out each tree side by side.

---

## 4. Phase 2 — Domain Detector

### 4.1 Principles

Domain detection is **optional enrichment** — if detection fails or produces
low confidence, the visualization falls back to a clean generic n-ary tree
rendering. The topology is always rendered correctly regardless of domain.

Domain is inferred from class name, attribute names, and optionally the
variable name in scope.

### 4.2 Domain Classification Table (v1)

| Domain | Class name signals | Attribute name signals |
|---|---|---|
| `Filesystem` | `Folder`, `Directory`, `Dir`, `File`, `Path`, `Node` (when attrs include `name`, `extension`) | `children`, `files`, `subfolders`, `name`, `extension`, `path` |
| `OrgChart` | `Employee`, `Person`, `Manager`, `Worker`, `Department` | `reports`, `team`, `subordinates`, `employees`, `name`, `title`, `role` |
| `AST` | `ASTNode`, `Node`, `Statement`, `Expression`, `Decl` | `children`, `body`, `args`, `op`, `value`, `left`, `right` |
| `SceneGraph` | `SceneNode`, `GameObject`, `Transform`, `Entity` | `children`, `position`, `rotation`, `scale` |
| `Menu` | `MenuItem`, `Menu`, `NavItem`, `Option` | `children`, `label`, `href`, `icon`, `disabled` |
| `Generic` | (any class not matching above) | — |

### 4.3 Confidence Scoring

Each domain detector returns a confidence score 0–1. If the top score is below
**0.4**, domain is `Generic`. The score is the fraction of matching signals
found out of signals checked.

---

## 5. Semantic Profile Object

The two detectors together produce a SemanticProfile:

```
{
  topology:         "NaryTree",
  domain:           "Filesystem",
  domainConfidence: 0.85,
  childAttr:        "children",
  rootId:           "obj_12",
  layoutHint:       "FolderTreeLayout",
  themeHint:        "FilesystemTheme",
}
```

This profile is passed to the Layout Registry. Nothing downstream needs to
re-run graph analysis.

---

## 6. Layout Registry

### 6.1 v1 Layouts

| Key | Algorithm | Used when |
|---|---|---|
| `BinaryTreeLayout` | Existing Reingold-Tilford (left/right) | topology === "BinaryTree" |
| `NaryTreeLayout` | Top-down Reingold-Tilford generalized to n children | topology === "NaryTree" (any domain) |
| `LinkedListLayout` | Existing horizontal chain | topology === "LinkedList" |
| `FlatLayout` | Existing grid/row layout | topology === "Primitive/Flat" |

Note: `FolderTreeLayout`, `OrgChartLayout`, `ASTLayout` are domain
specializations of `NaryTreeLayout` that differ only in **visual theme** in
v1 — not in algorithm. Domain-specific layout geometry (e.g. OrgChart
left-to-right orientation) is a post-v1 enhancement.

### 6.2 N-ary Reingold-Tilford Algorithm

The general version:

- Accepts an ordered list of `children` (from the discovered `childAttr`)
  rather than `left`/`right`
- Computes subtree widths for each child, sums them, and distributes children
  evenly centered under their parent
- Level spacing: fixed 68px vertical; horizontal spacing derived from subtree
  width × node diameter (minimum 32px)
- No overlap guarantee: each child subtree's bounding width is computed
  recursively and used to offset siblings

---

## 7. Visual Theme System

### 7.1 Domain Icon Map (v1)

Icons are Unicode emoji rendered inside/above the node on the canvas via ctx.fillText().

| Domain | Internal node icon | Leaf node icon |
|---|---|---|
| `Filesystem` | 📁 | 📄 |
| `OrgChart` | 👤 | 👤 |
| `AST` | (hexagon canvas path) | (circle canvas path) |
| `SceneGraph` | ⬜ | ⬜ |
| `Menu` | ☰ | ▪ |
| `Generic` | ● (current) | ● (current) |

Leaf = node with an empty child list (or no child list attribute).

### 7.2 Domain Color Scheme

| Domain | Node fill | Edge color |
|---|---|---|
| `Filesystem` | #10B981 | #059669 |
| `OrgChart` | #6366F1 | #4F46E5 |
| `AST` | #F59E0B | #D97706 |
| `SceneGraph` | #8B5CF6 | #7C3AED |
| `Menu` | #EC4899 | #DB2777 |
| `Generic` | #6366F1 | #4F46E5 |

### 7.3 Node Label Convention (unchanged)

- Label = the object's key/val/name attribute value (e.g. "Documents")
- If no scalar label is found, fall back to the variable name
- Sub-label = domain-specific metadata (e.g. ext=.pdf for Filesystem leaves)

---

## 8. Acceptance Criteria

### 8.1 Topology Detection

- [ ] Any Python class whose instances form an n-ary tree (via any list
  attribute containing same-class objects) is detected as NaryTree
- [ ] Detection does not require attribute names children, left, or right
- [ ] Binary trees are still detected correctly and use BinaryTreeLayout
- [ ] Cycles are detected and reported (CyclicGraph) without crashing the layout
- [ ] Forests (multiple roots) are laid out side by side

### 8.2 Domain Detection

- [ ] Filesystem structures (Folder/File classes) classify as Filesystem with confidence ≥ 0.6
- [ ] OrgChart structures (Employee/Manager classes) classify as OrgChart
- [ ] AST structures (ASTNode/Expression) classify as AST
- [ ] Low-confidence and unrecognized classes fall through to Generic — no crash

### 8.3 Layout

- [ ] N-ary tree nodes spread horizontally at each level — no vertical-list layout
- [ ] Subtrees do not overlap at any depth
- [ ] Scales to at least 50 nodes without clipping (pan to see the rest)
- [ ] Domain color and icon are visible on each node

### 8.4 Backward Compatibility

- [ ] Binary tree / AVL code renders identically to current behavior
- [ ] Primitive, ArrayCell, DictBucket layouts are unaffected
- [ ] Linked list horizontal layout is unaffected

---

## 9. Scope Boundaries

### In Scope (v1)

- Topology Detector (graph analysis on inspected object graph)
- Domain Detector (5 domains: Filesystem, OrgChart, AST, SceneGraph, Menu + Generic fallback)
- SemanticProfile schema between detection and layout
- N-ary Reingold-Tilford layout algorithm
- Domain icon + color theming in canvas renderer
- Backward compatibility with all existing layouts

### Deferred (post-v1)

- Collapsible nodes (click to expand/collapse subtrees)
- Slide animations on children.append() operations
- Domain-specific layout geometry (e.g., OrgChart left-to-right orientation)
- Trie layout (requires character-edge rendering)
- DOM tree detection (browser-API inspection)
- Additional domains beyond the v1 five

### Outside This Feature's Identity

- Native C++ engine or WebGL renderer (separate system)
- Call-stack / recursion frame visualization (separate roadmap item)
- Any changes to the CPython tracer's emitted JSON schema

---

## 10. Dependencies & Assumptions

- The existing CPython tracer already serializes object slots (attribute
  name → value/ref pairs) — topology detection reads from this existing schema
- The canvas renderer's drawEntities() function can be extended with an
  icon field on the entity object without breaking existing paths
- Emoji rendering on canvas via ctx.fillText() is sufficient for v1 icons
- A single app.js file continues to be the implementation target
