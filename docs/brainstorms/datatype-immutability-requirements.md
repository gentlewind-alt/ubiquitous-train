# Requirements Document: Data Type Properties & Immutability Visualizer

**Date:** 2026-08-02  
**Status:** Approved for Implementation  
**Scope Tier:** Standard (Language Semantics Visualizer)

---

## 1. Executive Summary

Since RVE executes Python code inside real Pyodide CPython 3.11 WebAssembly, Python language semantics—including data type immutability, object identity (`id()`), and reference aliasing—are enforced natively by the runtime engine. This enhancement makes these underlying CPython data type properties visually explicit on the 2D visualizer canvas and DevTools Inspector.

---

## 2. Feature Specifications

### A. Visual Immutability Badging (`🔒`)
- Objects of immutable type (`tuple`, `frozenset`, `str`, `bytes`, `int`, `float`, `bool`) are badged with a visual lock icon (`🔒 Immutable`) on the canvas.
- Mutable containers (`list`, `dict`, `set`, custom class instances) display a `⚡ Mutable` indicator.

### B. Shared Reference & Aliasing Detection (`a ──► b`)
- When two or more variable names reference the exact same underlying CPython memory address (`id(obj)`), the canvas renders shared reference pointer badges linking the variable names to the single canonical object instance.

### C. DevTools Inspector Extensions
- The DevTools State Inspector displays explicit type property metadata:
  - **Type Classification**: Primitive, Sequence, Mapping, or Custom Object.
  - **Mutability**: `Immutable (Read-Only) 🔒` vs `Mutable (In-Place Modification) ⚡`.
  - **CPython Reference Count / Memory Address**: Exact `0x7ff...` pointer.

---

## 3. Success Criteria
- [ ] Tuples (`(1, 2, 3)`) render with a `🔒 Immutable Tuple` badge on canvas.
- [ ] Assigning `b = a` creates shared reference badges pointing to one object instance instead of duplicating the object.
- [ ] DevTools Inspector explicitly indicates `Mutability: Immutable 🔒` or `Mutable ⚡`.
