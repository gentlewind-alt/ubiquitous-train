# Binary Tree & Custom Object Semantic Visualization Fix Requirements

**Project:** Runtime Visualization Engine (RVE)  
**Date:** August 2026  
**Status:** Requirements & Fix Verified

---

## 1. Problem Statement

When users ran binary tree or AVL tree code (e.g. `root = Node(30); root.left = Node(20); root.right = Node(40)`), the canvas rendered generic CPython runtime object cards for functions (`insert`), classes (`Node`), and variables (`root`) instead of rendering a hierarchical Binary Tree diagram.

### Root Cause
1. **Empty Custom Object Slots in Tracer**: In `app.js` `executePyodide`, the Python tracer's recursive `_node(obj)` serializer handled primitives, `list`, `dict`, `tuple`, and `set`, but for generic user-defined Python instances (`else:` branch for `ObjNode`), it initialized `'slots': []` and **never inspected `obj.__dict__` or `obj.__slots__`**.
2. **Missing Reference Graph**: Because custom object instance attributes (`left`, `right`, `val`, `next`) were never serialized into the JavaScript `nodeMap`, `SemanticAnalyzer.detectBinaryTree` found 0 `left`/`right` slots, failed pattern matching, returned `null`, and forced the canvas to fall back to the generic CPython object graph view.
3. **Globals Contamination**: Global function definitions (`def insert(...)`) and class definitions (`class Node`) were listed as root `_vars`, cluttering the runtime object graph with non-instance callable symbols.

---

## 2. Target Architecture

```
Python Code (Node, left, right)
      ↓
CPython Tracer (inspects obj.__dict__ / __slots__)
      ↓
Object Graph with slots ({ left: Node_20, right: Node_40 })
      ↓
Semantic Analyzer (detects BinaryTreeModel)
      ↓
Visualization Planner (Auto Mode selects Tree Projection)
      ↓
TreeLayout (Reingold-Tilford hierarchy)
      ↓
Renderer (Renders 30 → 20, 40 tree diagram)
```

---

## 3. Acceptance Criteria & Verified Fixes

1. **Custom Object Serialization**:
   - `executePyodide` tracer iterates `obj.__dict__.items()` and `obj.__slots__` to serialize attributes (`left`, `right`, `val`, `height`, `next`) into the object's `slots` array.
2. **Variable Filtering**:
   - `_globals` scanning excludes `callable(v)`, `isinstance(v, type)`, and built-in function/module objects so runtime variables contain only data instances (`root`, `head`, `stack`, `cache`).
3. **Binary Tree Detection**:
   - `SemanticAnalyzer.detectBinaryTree` checks for `left` or `right` child attributes on any `ObjNode`.
   - Traverses `root` recursively to construct a `BinaryTreeModel`.
4. **Auto-Projection to TreeLayout**:
   - `Auto` and `Learning` modes automatically switch to `TreeLayout` when a binary tree is present in runtime state.
   - Nodes are rendered as a clean, hierarchical tree diagram.

---

## 4. Scope & Non-Goals

- **In Scope**: Serialization of custom Python class instance fields (`__dict__` & `__slots__`), binary tree detection, linked list detection, auto-projection in Auto/Learning modes.
- **Out of Scope**: WebGL native shaders, desktop C++ engine bindings (separate phase per system blueprint).
