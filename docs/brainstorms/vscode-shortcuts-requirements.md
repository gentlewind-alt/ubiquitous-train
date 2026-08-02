# Requirements Document: VS Code Shortcuts Suite for Python Editor

**Date:** 2026-08-02  
**Status:** Approved for Implementation  
**Scope Tier:** Standard (Web Studio Editor Extension)

---

## 1. Executive Summary

Integrate a full suite of VS Code keyboard shortcuts into the RVE Web Studio Python Code Editor (`index.html` & `app.js`). This equips the in-browser textarea editor with native code editor shortcuts, allowing users to move lines, duplicate lines, toggle comments, handle indentation, and run execution effortlessly without touching the mouse.

---

## 2. Target Features & Keybindings

### A. Line Operations
- **`Alt + Up Arrow`**: Move active line (or selected block of lines) UP by 1 row.
- **`Alt + Down Arrow`**: Move active line (or selected block of lines) DOWN by 1 row.
- **`Shift + Alt + Down Arrow`**: Duplicate current line (or selected block) downwards.
- **`Shift + Alt + Up Arrow`**: Duplicate current line (or selected block) upwards.
- **`Ctrl + Shift + K`**: Delete current active line completely.

### B. Indentation & Block Formatting
- **`Tab`**: Insert 4 spaces at cursor position, or indent all lines in active text selection.
- **`Shift + Tab`**: Outdent 4 spaces for active line or selected block.

### C. Commenting & Quick Actions
- **`Ctrl + /`**: Toggle `# ` Python line comment for current line or selected multi-line block.
- **`Ctrl + Enter`**: Trigger **Run Execution & Auto-Play** immediately.
- **`Ctrl + S`**: Trigger **Save** python code.

---

## 3. User Experience & Behavior Rules

1. **Focus State**: Shortcuts only trigger when `#code-editor` textarea is actively focused to prevent interfering with browser navigation.
2. **Selection Preservation**: Moving or duplicating selected blocks preserves line highlighting and cursor selection bounds seamlessly.
3. **Undo/Redo Native History**: All line manipulations push to textarea history so native `Ctrl+Z` / `Ctrl+Y` undoes/redoes line movements.
4. **Console Terminal Feedback**: Action updates (e.g. `Moved line 14 up`, `Toggled comment on 3 lines`) log cleanly in terminal output.

---

## 4. Scope Boundaries

### Included
- All 8 core VS Code editing keyboard shortcuts listed above.
- Full selection & multi-line block compatibility.
- Line number & highlight bar synchronization on every shortcut press.

### Excluded (Deferred for Later)
- Full Monaco/VSCode Editor iframe embed (keeping lightweight native textarea engine for maximum performance).

---

## 5. Success Criteria
- [ ] User can press `Ctrl + /` to comment/uncomment Python lines instantly.
- [ ] User can press `Alt + Up/Down` to re-order lines without losing context.
- [ ] User can press `Shift + Alt + Down` to duplicate algorithm lines quickly.
- [ ] User can press `Tab` / `Shift + Tab` for clean 4-space Python indentation.
- [ ] Line numbers and highlight bar update instantly on every shortcut invocation.
