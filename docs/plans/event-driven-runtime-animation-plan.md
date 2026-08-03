---
title: Event-Driven Runtime Animation & Camera Tracking Engine
status: active
origin: user_request
created: 2026-08-03
---

# Implementation Plan — Event-Driven Runtime Animation & Camera Tracking Engine

## Problem Frame

The execution timeline advances line-by-line (`Frame 1 / 85` ... `Frame 85 / 85`), but the visualizer canvas renders the complete final object graph statically across all frames. The canvas does not evolve incrementally as Python code executes, the camera remains static, and newly created nodes or edge connections appear instantly without animation.

This plan transforms RVE from a static slideshow player into a **synchronized runtime animation engine**:
1. Line-by-line Python object graph snapshots via `sys.settrace` in Pyodide.
2. An automatic **JS Graph Diff Engine** that computes primitive mutations (`NodeAdded`, `NodeRemoved`, `EdgeAdded`, `EdgeRemoved`, `ValueChanged`).
3. An **Operation Detector** that classifies primitive mutations into high-level semantic events (`AppendChild`, `DeleteChild`, `RotateLeft`, `HeapBubbleUp`, `UpdateValue`).
4. A **Camera Tracking Engine** featuring smooth Lerp/spring panning, auto-focus on active event targets, and selectable camera modes (`Follow Execution`, `Fit Scene`, `Selected Node`).
5. **Node & Edge Micro-Animations** (sliding nodes, growing edges, pulse highlights).

---

## Architecture & Data Flow

```
Python Code Execution
    ↓
CPython Tracer (sys.settrace in Pyodide)
    ↓
Per-Line Object Graph Snapshots (JSON: objects_per_line)
    ↓
[NEW] Graph Diff Engine (Computes primitive mutations between Frame[i-1] and Frame[i])
    ↓
Primitive Mutations: { type: "NodeAdded"|"EdgeAdded"|"ValueChanged", targetId, parentId, val }
    ↓
[NEW] Operation Detector (Maps primitive mutations → Semantic Events)
    ↓
Semantic Event: { type: "AppendChild", parentId, childId, cameraFocusId, anim: "SlideIn" }
    ↓
[NEW] Camera Tracking Engine (Calculates panX, panY, zoomScale per frame/timestamp)
    ↓
Canvas Render Loop (Renders animated nodes, growing edges, camera lerp transform)
```

---

## Implementation Units

### IU-1: CPython `sys.settrace` Line-by-Line Object Graph Snapshots

**File:** `app.js` — inside `executePyodide()` (~L800–1035)

**Problem:** `executePyodide()` runs user code all at once and inspects `user_globals` only after execution finishes. `compileCodeToTimeline()` receives a static array of final objects for every line.

**Solution:**
Update `runnerScript` in `executePyodide()` to use CPython's `sys.settrace()`:
- Set up a trace callback `trace_func(frame, event, arg)` that filters for `event == 'line'`.
- On each `line` event occurring within the user code file filename (ignoring internal system frames):
  - Inspect `user_globals` at that exact moment using `inspect_obj()`.
  - Record `{ lineNumber: frame.f_lineno, objects: deepcopy_objects }`.
- Pass `line_snapshots` back to JS in the result JSON:
  `{ stdout, snapshots: line_snapshots, error }`.

**Result:** `compileCodeToTimeline` receives an array of snapshots, where `snapshots[i]` contains only the objects that existed at line `i`.

**Test Scenarios:**
- Line 1: `user = Folder("User")` → Frame 1 snapshot contains only `user` node.
- Line 2: `home = Folder("Home")` → Frame 2 snapshot contains `user` and `home` nodes (disconnected).
- Line 3: `user.children.append(home)` → Frame 3 snapshot contains edge `user -> home`.

---

### IU-2: Graph Diff Engine & Primitive Graph Mutations

**File:** `app.js` — new class/function `GraphDiffEngine.diff(prevObjects, currObjects)`

**Input:** Object graph array from Frame `i-1` and Frame `i`.

**Output:** Array of `PrimitiveMutation` objects:
```js
[
  { type: "NodeAdded", nodeId: "py_0x12", obj: entity },
  { type: "NodeRemoved", nodeId: "py_0x14" },
  { type: "EdgeAdded", parentId: "py_0x12", childId: "py_0x15", edgeAttr: "children" },
  { type: "EdgeRemoved", parentId: "py_0x12", childId: "py_0x13" },
  { type: "ValueChanged", nodeId: "py_0x12", oldVal: "Docs", newVal: "Documents" }
]
```

**Algorithm:**
1. Map `prevObjects` and `currObjects` by `id`.
2. Find `NodeAdded`: IDs in `currObjects` but not in `prevObjects`.
3. Find `NodeRemoved`: IDs in `prevObjects` but not in `currObjects`.
4. Find `EdgeAdded`: Connections (slots/children/left/right/next) in `currObjects` not present in `prevObjects`.
5. Find `EdgeRemoved`: Connections in `prevObjects` missing from `currObjects`.
6. Find `ValueChanged`: Identical ID where `label` or `val` changed.

**Test Scenarios:**
- Appending child: emits `NodeAdded` (if new instance) and `EdgeAdded`.
- Re-assigning variable: emits `ValueChanged`.
- Removing child: emits `EdgeRemoved` (and `NodeRemoved` if garbage collected).

---

### IU-3: Operation Detector (Semantic Event Classifier)

**File:** `app.js` — new function `detectSemanticEvent(mutations, lineCode, profile)`

**Input:** Array of `PrimitiveMutation`s, current line code string, and active `SemanticProfile`.

**Output:** `SemanticEvent` object:
```js
{
  type: "AppendChild",        // AppendChild | RemoveChild | UpdateValue | RotateLeft | Highlight | Step
  targetId: "py_0x15",
  parentId: "py_0x12",
  cameraFocusId: "py_0x12",   // Node ID camera should track
  description: "Appended RVE Engine to Projects",
  animationType: "SlideIn",    // SlideIn | EdgeGrow | FadeOut | Pulse
  progress: 0.0               // 0.0 to 1.0 animation timeline interpolation
}
```

**Classification Rules:**
- If mutations contain `EdgeAdded` (and optional `NodeAdded`): `type = "AppendChild"`, `animationType = "SlideIn"`, `cameraFocusId = parentId`.
- If mutations contain `EdgeRemoved`: `type = "RemoveChild"`, `animationType = "FadeOut"`, `cameraFocusId = parentId`.
- If mutations contain `ValueChanged`: `type = "UpdateValue"`, `animationType = "Pulse"`, `cameraFocusId = nodeId`.
- If line code includes `rotate_left` / `rotate_right`: `type = "RotateLeft"` / `"RotateRight"`, `animationType = "ArcRotate"`.
- Default: `type = "Step"`, `cameraFocusId = primaryActiveNodeId`.

---

### IU-4: Camera Tracking Engine (Smooth Lerp & Camera Profiles)

**File:** `app.js` — new camera tracking logic in `RVEApplication`

**State:**
```js
this.cameraMode = "follow"; // "follow" | "fit" | "selected"
this.targetPanX = 0;
this.targetPanY = 0;
this.targetZoomScale = 1.0;
```

**Modes:**
1. **Follow Execution (`follow`)**:
   - Automatically centers the canvas viewport on `event.cameraFocusId` (or the active node being mutated in the current frame).
   - Smoothly interpolates `panX`, `panY` towards `targetPanX`, `targetPanY` using exponential Lerp:
     `panX += (targetPanX - panX) * 0.12`.
2. **Fit Scene (`fit`)**:
   - Calculates bounding box of all active entities: `{ minX, maxX, minY, maxY }`.
   - Computes zoom and pan to fit all nodes inside canvas with 50px padding.
3. **Selected Node (`selected`)**:
   - Locks target pan/zoom onto `selectedEntityId`.

**Controls in Navbar:**
Add a Camera Profile dropdown in the visualizer header controls bar:
`[ Camera: 🎥 Follow Execution ▾ ]` (`follow`, `fit`, `selected`).

**Test Scenarios:**
- Stepping to Frame 5 (`projects.children.append(rve)`): camera smoothly pans to center `Projects` node.
- Switching to `Fit Scene`: camera zooms out to display all 12 nodes.
- User manual dragging/panning: temporarily pauses auto-follow until playback resumes or "Reset View" is clicked.

---

### IU-5: Micro-Animations & Canvas Rendering Engine Integration

**File:** `app.js` — inside `startRenderLoop()`, `drawEntities()`, and `drawConnections()`

**Animation Pipeline:**
- When playback is active or frame changes, `this.animationProgress` advances from `0.0` to `1.0` over `300ms`.
- **Node Slide-In (`SlideIn`)**: Newly added node's rendered position interpolates from parent coordinates `(parent.x, parent.y)` to layout target `(node.x, node.y)`:
  `renderX = parent.x + (node.x - parent.x) * easeOutCubic(progress)`.
- **Edge Growing (`EdgeGrow`)**: Edge stroke line draws partially from `0%` length to `100%` length as `progress` increases.
- **Node Pulse Highlight (`Pulse`)**: Mutated node draws a glowing ring whose radius expands and fades out during the frame step.

---

## Sequencing

```
IU-1 (sys.settrace Snapshots)
      ↓
IU-2 (Graph Diff Engine)
      ↓
IU-3 (Operation Detector)
      ↓
IU-4 (Camera Tracking Engine)
      ↓
IU-5 (Canvas Micro-Animations)
```

---

## Backward Compatibility & Safety

- Existing Pyodide error handling and JS fallback remain intact.
- If `sys.settrace` is disabled or fallback engine runs, `compileCodeToTimeline` falls back gracefully to step-by-step diffing.
- Manual pan & zoom controls work alongside camera auto-follow (user manual drag pauses auto-follow).

---

## Files Changed

| File | Nature of change |
|---|---|
| `app.js` | Full engine update (settrace, DiffEngine, OperationDetector, CameraTracking, Animations) |
| `index.html` | Added Camera Mode dropdown selector in navbar |
| `index.css` | Added styles for camera selector badge and animation indicators |
