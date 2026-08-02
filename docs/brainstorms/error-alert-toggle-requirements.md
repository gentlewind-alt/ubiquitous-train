# Requirements Document: Error Alerts Toggle & Rule Conflict Notification Engine

**Date:** 2026-08-02  
**Status:** Approved for Implementation  
**Scope Tier:** Standard (Error Alert Toggle & Language Safety Suite)

---

## 1. Executive Summary

Equip RVE Studio with a customizable **Error Alerts Toggle (`ON / OFF`)** button in the navbar. When Alerts are **ON**, forbidden Python operations (such as mutating a tuple `t[0] = 5`, modifying frozen sets, or runtime CPython exceptions) immediately trigger a red warning banner on the canvas, highlight the failing line in the code editor, and halt execution. When Alerts are **OFF**, the engine runs in normal fallback mode, logging errors silently to the console terminal.

---

## 2. Feature Specifications

### A. Navbar Alert Toggle Switch
- A prominent navbar button: `Error Alerts: ON` (Green) / `Error Alerts: OFF` (Muted Grey).
- State persists in `localStorage.getItem('rve_error_alerts_mode')`.

### B. Forbidden Usage & Exception Interceptor
- Intercepts CPython exceptions from Pyodide (e.g. `TypeError: 'tuple' object does not support item assignment`, `AttributeError`, `IndexError`, `SyntaxError`).
- Identifies exact line numbers of failing statements.

### C. Canvas & Editor Alert Banner (Alerts: ON)
- Displays a glowing red top action banner on the visualizer canvas:
  `⚠️ Rule Conflict (Line 2): TypeError: 'tuple' object does not support item assignment`
- Highlights the line number in the Python editor with a red marker (`.line-num-error`).
- Prints exception details in the stdout console terminal.

### D. Silent Mode (Alerts: OFF)
- Suppresses canvas error banners and line error highlights.
- Allows normal fallback rendering for valid lines without blocking execution.

---

## 3. Success Criteria
- [ ] Navbar button toggles between `Error Alerts: ON` and `Error Alerts: OFF`.
- [ ] Attempting `t = (1, 2); t[0] = 99` with Alerts ON triggers a red error banner: `TypeError: 'tuple' object does not support item assignment (Line 2)`.
- [ ] Toggling Alerts OFF hides the error banner and allows normal execution.
