# LESSONS_LEARNED.md — RVE Engineering Lessons & Anti-Patterns Log

> **Operating Rule**: Every error, architectural mismatch, or UI bug encountered during development and its verified solution MUST be documented in this manifest. AI agents MUST review this log alongside [`AGENTS.md`](file:///C:/Users/samar/OneDrive/Desktop/projects/DSA_visualizer/AGENTS.md) and [`agent.md`](file:///C:/Users/samar/OneDrive/Desktop/projects/DSA_visualizer/agent.md) to prevent recurring mistakes.

---

## 1. UI & DOM Architecture

### Lesson 1.1: Avoid Nesting Floating Overlays Inside Conditionally Hidden Panels
- **Symptom**: Local variable cards (`#variables-dock`) were updating in JS during execution, but remained completely invisible on screen.
- **Root Cause**: `<div id="variables-dock">` was placed inside `<aside id="inspector-panel">`. `#inspector-panel` has `display: none` by default and only opens when clicking a node, trapping the variables panel inside a hidden DOM container.
- **Rule**: Floating viewport overlays (active variable docks, execution badges, viewport stats) MUST be direct children of `#canvas-container` (`position: absolute`) and NEVER nested inside toggleable sidebar panels.

---

## 2. Layout Engine & Topology Solvers

### Lesson 2.1: Specialized Graph Topology Solvers Must Precede Generic Fallbacks
- **Symptom**: N-ary tree structures built with custom Python classes (e.g. `Folder` objects with `.children`) were stacked in a single vertical column instead of rendering as a 2D tree graph.
- **Root Cause**: In `solveLayoutConstraintsForObjects()` in `app.js`, `if (firstType === "ClassObject")` executed BEFORE `else if (profile.topology === "NaryTree")`. All custom class nodes matched `ClassObject` first and bypassed the N-ary tree solver.
- **Rule**: Specialized topology matchers (`NaryTree`, `BinaryTree`, `GraphNode`) MUST take precedence over fallback generic type matchers (`ClassObject`, `Object`). Always check `!(profile && (profile.topology === "NaryTree" || profile.topology === "BinaryTree"))` before applying fallback vertical class grouping.

---

## 3. Visual Feedback & Pointer Semantics

### Lesson 3.1: Connect Primitive Loop Variables to Composite Data Structure Renderers
- **Symptom**: Stepping through nested matrix loops (`for i in range(4): for j in range(4):`) did not visually highlight which matrix cell `matrix[i][j]` was currently being accessed.
- **Root Cause**: `MatrixGrid` rendering only checked manual mouse selection (`selectedMatrixCell`) and did not inspect primitive frame variables (`i`, `j`, `r`, `c`).
- **Rule**: Composite canvas renderers (`MatrixGrid`, `ArrayCell`, `ListContainer`) MUST inspect primitive loop variables (`i`, `j`, `r`, `c`, `index`) in the current snapshot frame and render active cursor highlights (e.g. amber glow `#F59E0B`) and pointer badges.

---

## 4. Execution Stream vs Heap Canvas State

### Lesson 4.1: Separate Output Console Stream from Memory Heap Visualizer
- **Symptom**: User expected `print(total)` output to appear directly on the 2D canvas instead of terminal.
- **Rule**: Distinguish stdout text stream outputs from heap variable states:
  - **Memory Variables** (`total = 440`, `matrix`) are rendered on the 2D Canvas and Active Variables Overlay.
  - **Text Output Stream (`sys.stdout`)** is logged to the Execution Console / Terminal Panel.

---

## 5. Matrix & Comprehension Educational Visualization Specification

### Lesson 5.1: Expose Comprehension Semantics & Value Flow for 2D Grids
- **Design Philosophy**: Matrix and 2D comprehension visualizations MUST NOT render as flat opaque list grids. They must expose memory semantics, reference edges, and value flows:
  1. **Variables Rail to Heap Objects**: Variables (`matrix`, `Row 0`, `Row 1`...) explicitly map to memory objects on the heap rail with reference arrows.
  2. **Row & Tuple Reference Graph**: Inner lists/rows display reference pointers pointing to element items / tuples (`Tuple (r, c, val)`).
  3. **Execution Phase Animation**: Step through loop phases (`i` outer -> row creation -> `j` inner -> expression evaluation -> tuple/value creation -> row append -> matrix append).
  4. **Current Computation Panel**: Display dynamic expression evaluation (`(i,j,i*j) -> (3,2,6) -> Tuple Created -> Appending to Row 3`).
  5. **Value Flow**: Animate values traveling from loop operands into element/tuple slots.
  6. **Row Builder Buffer**: Show intermediate row assembly before pushing into the main matrix.
  7. **Hierarchical Camera View**: On final step, camera zooms to expose full reference hierarchy (`matrix -> Rows -> Tuples -> Primitive Values`).

---

## 6. The 4-Layer Synchronized Execution Architecture

### Lesson 6.1: Visualization Engine Must Explain Execution, Not Just Memory
- **Core Principle**: RVE is an **execution explainer**, not a static memory inspector. The engine operates across four synchronized layers:
  1. **Source Code Layer**: Current line highlighted in Monaco editor frame-by-frame.
  2. **Runtime State Layer**: Active variables (`i=3`, `j=2`), CPython memory IDs (`id 0x8f42`), and execution state.
  3. **Semantic Animation Layer**:
     - **Tuple Construction**: Visual slot-by-slot allocation (`slot 0 <- 3`, `slot 1 <- 2`, `slot 2 <- 6`).
     - **Operand Computation**: Multiplication / expression evaluation animation (`3 × 2 → 6`).
     - **Row Builder Buffer**: Temporary row assembly (`Row Builder [] → [(3,0,0)] → ... → append into matrix`).
     - **Reference Particle Flow**: Glowing particle pulsing through reference slots during indexing lookups (`matrix[3][2]`).
  4. **Final Object Graph Layer**:
     - Concrete `Tuple` container cards showing indexed slots (`0: 3`, `1: 2`, `2: 6`).
     - Semantic relationship labels (`contains`, `owns`, `references`, `row`, `element`) instead of generic "ref".

---

## 7. Kimi Visual Eyes Protocol

### Lesson 7.1: Use Kimi Mentor as CLI Visual Eyes for UI & Visual Inspection
- **Rule**: Whenever evaluating visual layouts, canvas rendering hierarchy, or UI presentation quality, invoke `kimi_mentor.py` / `kimi_agent.py` as the **CLI's Visual Eyes** to audit layout aesthetics, spatial alignment, visual rendering fidelity, and design structure.


