// ═══════════════════════════════════════════════════════════════════════════════
// RVE — Runtime Visualization Engine  ·  Object Graph Renderer  v2.0
// Architecture: Heap Graph  ·  Columnar Layout  ·  Level-of-Detail  ·  CPython Tracer
// ═══════════════════════════════════════════════════════════════════════════════

// ─── SECURITY: HTML escape helper ─────────────────────────────────────────────
function escHtml(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

const PRESETS = {
    none: "",
    avl_tree: `# AVL / Binary Search Tree
class Node:
    def __init__(self, val):
        self.val = val
        self.left = None
        self.right = None
        self.height = 1

def insert(root, val):
    if not root:
        return Node(val)
    if val < root.val:
        root.left = insert(root.left, val)
    else:
        root.right = insert(root.right, val)
    return root

# Build tree
root = Node(30)
root = insert(root, 20)
root = insert(root, 40)
root = insert(root, 10)
root = insert(root, 25)
root = insert(root, 50)
print("BST built with root 30")`,

    linked_list: `# Singly Linked List
class Node:
    def __init__(self, val):
        self.val = val
        self.next = None

head = Node(10)
head.next = Node(20)
head.next.next = Node(30)
head.next.next.next = Node(40)
print("Linked list created: 10 -> 20 -> 30 -> 40")`,

    stack_tower: `# Stack Tower (LIFO)
stack = []
stack.append(10)
stack.append(20)
stack.append(30)
stack.append(40)

top_val = stack.pop()
print("Popped:", top_val)`,

    queue_ribbon: `# Queue Ribbon (FIFO)
queue = []
queue.append(10)
queue.append(20)
queue.append(30)
queue.append(40)

front_val = queue.pop(0)
print("Dequeued:", front_val)`,

    heap_split: `# Min Heap (Array + Tree)
import heapq

heap = []
heapq.heappush(heap, 40)
heapq.heappush(heap, 10)
heapq.heappush(heap, 30)
heapq.heappush(heap, 20)
heapq.heappush(heap, 50)

min_val = heapq.heappop(heap)
print("Popped min:", min_val)`,

    graph_adjacency: `# Adjacency Graph
graph = {
    "A": ["B", "C"],
    "B": ["D", "E"],
    "C": ["F"],
    "D": [],
    "E": ["F"],
    "F": []
}
print("Graph nodes:", list(graph.keys()))`,

    hash_map: `# Hash Map / Dictionary
cache = {
    "user_1": "Alice",
    "user_2": "Bob",
    "user_3": "Charlie",
    "user_4": "David"
}
cache["user_5"] = "Eve"
print("Cache size:", len(cache))`,

    nested_comprehension: `# Nested data
students = [
    {"name": "Alice", "marks": [85, 92, 78]},
    {"name": "Bob", "marks": [55, 61, 48]},
    {"name": "Charlie", "marks": [95, 88, 91]},
    {"name": "David", "marks": [72, 69, 81]},
]

# Complex list comprehension
result = [
    {
        "student": student["name"],
        "average": sum(student["marks"]) / len(student["marks"]),
        "grade": (
            "A"
            if sum(student["marks"]) / len(student["marks"]) >= 90
            else "B"
            if sum(student["marks"]) / len(student["marks"]) >= 75
            else "C"
        ),
    }
    for student in students
    if all(mark >= 60 for mark in student["marks"])
]

print(result)`
};

// ─── COLOUR PALETTE ───────────────────────────────────────────────────────────
const COLORS = {
    bg:           '#070A11',
    surface:      '#0D1117',
    surface2:     '#111827',
    border:       'rgba(99,102,241,0.25)',
    borderHover:  '#6366F1',
    accent:       '#6366F1',
    accentGlow:   'rgba(99,102,241,0.35)',
    list:         { fill:'rgba(99,102,241,0.18)', stroke:'#6366F1',   head:'#4338CA' },
    dict:         { fill:'rgba(236,72,153,0.18)', stroke:'#EC4899',   head:'#BE185D' },
    tuple:        { fill:'rgba(139,92,246,0.18)', stroke:'#8B5CF6',   head:'#7C3AED' },
    set:          { fill:'rgba(16,185,129,0.18)', stroke:'#10B981',   head:'#059669' },
    prim:         { fill:'rgba(245,158,11,0.18)', stroke:'#F59E0B',   head:'#D97706' },
    var:          { fill:'rgba(30,41,59,0.8)',    stroke:'rgba(148,163,184,0.4)', head:'#475569' },
    ref:          'rgba(148,163,184,0.45)',
    iterGlow:     '#10B981',
    textPrimary:  '#F1F5F9',
    textSecond:   '#94A3B8',
    textKey:      '#A5B4FC',
};

// ─── NODE GEOMETRY CONSTANTS ──────────────────────────────────────────────────
const NODE = {
    ROW_H:        26,    // height per key-row inside dict / per index-row inside list
    HEADER_H:     28,    // coloured header bar height
    MIN_W:        140,   // minimum node width
    MAX_W:        200,   // maximum node width
    CORNER:       10,    // border-radius
    PRIM_H:       36,    // height of a primitive leaf
    PRIM_W:       110,   // width of a primitive leaf
    VAR_W:        90,    // stack-variable pill width
    VAR_H:        30,    // stack-variable pill height
    COL_GAP:      90,    // horizontal gap between columns (for reference arrows)
    ROW_GAP:      20,    // vertical gap between sibling nodes
};

// ─── LAYOUT COLUMNS (conceptual memory zones) ─────────────────────────────────
// Col 0  →  Stack Variables  (x ≈ 40)
// Col 1  →  Root containers  (students, result …)
// Col 2  →  Dict / sub-list children
// Col 3  →  Nested list children (marks …)
// Col 4  →  Leaf primitives  ("Alice", 85, …)
const COL_X = [40, 170, 420, 650, 860];

class RVEApplication {
    constructor() {
        // DOM refs
        this.codeEditor       = document.getElementById('code-editor');
        this.lineNumbers      = document.getElementById('line-numbers');
        this.lineHighlightBar = document.getElementById('line-highlight-bar');
        this.canvas           = document.getElementById('visualizer-canvas');
        this.ctx              = this.canvas.getContext('2d');

        this.algoSelect  = document.getElementById('algorithm-select');
        this.speedSelect = document.getElementById('speed-select');

        this.btnAlertToggle  = document.getElementById('btn-alert-toggle');
        this.btnSave         = document.getElementById('btn-save');
        this.btnRun          = document.getElementById('btn-run');
        this.btnStepPrev     = document.getElementById('btn-step-prev');
        this.btnStepNext     = document.getElementById('btn-step-next');
        this.btnReset        = document.getElementById('btn-reset');
        this.btnTimelinePlay = document.getElementById('btn-timeline-play');
        this.timelinePlayIcon= document.getElementById('timeline-play-icon');
        this.saveStatusTag   = document.getElementById('save-status-tag');
        this.timelineSlider  = document.getElementById('timeline-slider');
        this.currentFrameLabel= document.getElementById('current-frame-label');
        this.currentTimestampLabel= document.getElementById('current-timestamp-label');
        this.entityCounter   = document.getElementById('entity-counter');
        this.zoomCounter     = document.getElementById('zoom-counter');

        this.terminalOutput   = document.getElementById('terminal-output');
        this.stackFrameList   = document.getElementById('stack-frame-list');
        this.heapSpaceList    = document.getElementById('heap-space-list');
        this.inspectorContent = document.getElementById('inspector-content');
        this.eventStreamList  = document.getElementById('event-stream-list');
        this.pipelineStreamList= document.getElementById('pipeline-stream-list');

        this.actionBanner     = document.getElementById('action-banner');
        this.actionLineBadge  = document.getElementById('action-line-badge');
        this.actionDescription= document.getElementById('action-description');
        this.actionIterBadge  = document.getElementById('action-iter-badge');

        this.statRefs  = document.getElementById('stat-refs');
        this.statScope = document.getElementById('stat-scope');

        // State
        const saved = localStorage.getItem('rve_error_alerts_mode');
        this.errorAlertsEnabled = saved !== null ? JSON.parse(saved) : true;
        this.isUnsaved = false;
        this.liveCompileTimer = null;
        this.lastCompiledLine = 1;

        this.isPlaying = false;
        this.playInterval = null;
        this._isExecuting = false;
        this._dragStartX = 0;
        this._dragStartY = 0;

        this.zoom = 1.0;
        this.panX = 0;
        this.panY = 0;
        this.isPanning = false;
        this._panStartX = 0;
        this._panStartY = 0;

        this.pyodide = null;
        this.isPyodideReady = false;

        this.timelineFrames = [];
        this.currentFrameIndex = 0;

        // Graph state — built per-frame
        // nodes: Map<id, NodeObj>
        // refs:  Array<{fromId, toId, label, fromAnchor, toAnchor}>
        // vars:  Array<{name, targetId, pyType}>
        this.graph = { nodes: new Map(), refs: [], vars: [], semanticScene: null, semanticLayout: null };
        this.selectedNodeId = null;
        this.activeIterInfo = null;
        this.pipelineLog = [];

        this.viewMode = 'auto'; // 'auto' | 'ds' | 'graph'
        this.semanticRenderer = null;

        this.dpr = window.devicePixelRatio || 1;

        this.init();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // INIT
    // ─────────────────────────────────────────────────────────────────────────
    async init() {
        this.resizeCanvas();
        this.initResizer();
        this.initPanZoom();
        this.initKeyboard();
        this.initTabSwitching();
        this.initCollapse();
        this.updateAlertUI();
        window.addEventListener('resize', () => this.resizeCanvas());

        // Pause playback when tab is hidden (fixes setInterval firing in background)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.isPlaying) this.pause();
        });

        this.btnAlertToggle.addEventListener('click', () => this.toggleAlerts());
        this.codeEditor.addEventListener('input', () => { this.updateLineNums(); this.markUnsaved(); });
        this.codeEditor.addEventListener('keyup', e => {
            if (['Enter','ArrowUp','ArrowDown'].includes(e.key)) this.scheduleLiveCompile();
        });
        this.codeEditor.addEventListener('click', () => this.scheduleLiveCompile());
        this.codeEditor.addEventListener('keydown', e => this.handleEditorShortcuts(e));
        this.codeEditor.addEventListener('scroll', () => {
            this.lineNumbers.scrollTop = this.codeEditor.scrollTop;
        });

        this.algoSelect.addEventListener('change', e => this.loadPreset(e.target.value));
        this.btnSave.addEventListener('click', () => this.saveCode());
        this.btnRun.addEventListener('click', () => this.runExecution({ autoPlay: true }));
        this.btnTimelinePlay.addEventListener('click', () => this.togglePlay());
        this.btnStepPrev.addEventListener('click', () => { this.pause(); this.step(-1); });
        this.btnStepNext.addEventListener('click', () => { this.pause(); this.step(1); });
        this.btnReset.addEventListener('click', () => this.resetView());
        this.timelineSlider.addEventListener('input', e => { this.pause(); this.seekToFrame(+e.target.value); });
        this.speedSelect.addEventListener('change', () => { if (this.isPlaying) this.startPlayback(); });
        this.canvas.addEventListener('click', e => this.handleCanvasClick(e));

        ['auto','learning','runtime','memory','debug'].forEach(m => {
            const btn = document.getElementById(`btn-view-${m}`);
            if (btn) btn.addEventListener('click', () => this.setViewMode(m));
        });

        this.startRenderLoop();
        await this.initPyodide();
        this.loadSavedCode();
    }

    initTabSwitching() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                if (!tab) return;  // ignore the collapse button which has no data-tab
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                btn.classList.add('active');
                const el = document.getElementById(`tab-${tab}`);
                if (el) el.classList.add('active');
            });
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // COLLAPSIBLE PANELS
    // Editor panel: Ctrl+B or the ‹ chevron button. Slim rail click to reopen.
    // Console pane: Ctrl+J or the ∧ chevron in the tab bar.
    // ─────────────────────────────────────────────────────────────────────────
    initCollapse() {
        this._editorCollapsed  = localStorage.getItem('rve_editor_collapsed')  === 'true';
        this._consoleCollapsed = localStorage.getItem('rve_console_collapsed') === 'true';

        const workspace    = document.getElementById('workspace-container');
        const editorPanel  = document.getElementById('panel-editor');
        const bottomPane   = document.querySelector('.bottom-pane-container');
        const reopenRail   = document.getElementById('editor-reopen-rail');
        const btnColEditor = document.getElementById('btn-collapse-editor');
        const btnColCon    = document.getElementById('btn-collapse-console');
        const colIcon      = document.getElementById('editor-collapse-icon');
        const conIcon      = document.getElementById('console-collapse-icon');

        const applyEditorState = () => {
            editorPanel.classList.toggle('collapsed', this._editorCollapsed);
            workspace.classList.toggle('editor-collapsed', this._editorCollapsed);
            // Flip the header chevron: point right when collapsed, left when open
            colIcon.setAttribute('points', this._editorCollapsed ? '9 18 15 12 9 6' : '15 18 9 12 15 6');
            btnColEditor.title = this._editorCollapsed ? 'Expand editor' : 'Collapse editor';
            localStorage.setItem('rve_editor_collapsed', String(this._editorCollapsed));
            // Allow the CSS transition to finish before recalculating canvas size
            setTimeout(() => this.resizeCanvas(), 300);
        };

        const applyConsoleState = () => {
            bottomPane.classList.toggle('collapsed', this._consoleCollapsed);
            // Chevron: up = expanded, down = collapsed
            conIcon.setAttribute('points', this._consoleCollapsed ? '6 9 12 15 18 9' : '18 15 12 9 6 15');
            btnColCon.title = this._consoleCollapsed ? 'Expand console' : 'Collapse console';
            localStorage.setItem('rve_console_collapsed', String(this._consoleCollapsed));
            setTimeout(() => this.resizeCanvas(), 300);
        };

        // Apply persisted state on load
        applyEditorState();
        applyConsoleState();

        // Button handlers
        btnColEditor.addEventListener('click', () => {
            this._editorCollapsed = !this._editorCollapsed;
            applyEditorState();
        });

        if (reopenRail) {
            reopenRail.addEventListener('click', () => {
                this._editorCollapsed = false;
                applyEditorState();
            });
        }

        btnColCon.addEventListener('click', () => {
            this._consoleCollapsed = !this._consoleCollapsed;
            applyConsoleState();
        });

        // Keyboard shortcuts: Ctrl+B = toggle editor, Ctrl+J = toggle console
        window.addEventListener('keydown', e => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
                e.preventDefault();
                this._editorCollapsed = !this._editorCollapsed;
                applyEditorState();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'j') {
                e.preventDefault();
                this._consoleCollapsed = !this._consoleCollapsed;
                applyConsoleState();
            }
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CANVAS RESIZE (HIGH-DPI)
    // ─────────────────────────────────────────────────────────────────────────
    resizeCanvas() {
        const c = document.getElementById('canvas-container');
        if (!c) return;
        const dpr = window.devicePixelRatio || 1;
        const w = c.clientWidth, h = c.clientHeight;
        this.canvas.width  = Math.floor(w * dpr);
        this.canvas.height = Math.floor(h * dpr);
        this.canvas.style.width  = w + 'px';
        this.canvas.style.height = h + 'px';
        this.dpr = dpr;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PAN + ZOOM
    // ─────────────────────────────────────────────────────────────────────────
    initPanZoom() {
        this.canvas.addEventListener('contextmenu', e => e.preventDefault());
        this.canvas.addEventListener('mousedown', e => {
            this.isPanning = true;
            this._dragStartX = e.clientX;
            this._dragStartY = e.clientY;
            this._panStartX = e.clientX - this.panX;
            this._panStartY = e.clientY - this.panY;
        });
        window.addEventListener('mousemove', e => {
            if (this.isPanning) {
                this.panX = e.clientX - this._panStartX;
                this.panY = e.clientY - this._panStartY;
            }
        });
        window.addEventListener('mouseup', () => { this.isPanning = false; });
        this.canvas.addEventListener('wheel', e => {
            e.preventDefault();
            const factor = e.deltaY < 0 ? 1.1 : 0.9;
            const nz = Math.min(Math.max(0.25, this.zoom * factor), 4.0);
            const rect = this.canvas.getBoundingClientRect();
            const mx = e.clientX - rect.left, my = e.clientY - rect.top;
            this.panX = mx - (mx - this.panX) * (nz / this.zoom);
            this.panY = my - (my - this.panY) * (nz / this.zoom);
            this.zoom = nz;
            this.zoomCounter.innerText = `${Math.round(this.zoom * 100)}%`;
        }, { passive: false });
        this.canvas.addEventListener('dblclick', () => this.resetView());
    }

    resetView() {
        this.zoom = 1.0;
        this.panX = 20;
        this.panY = 30;
        this.zoomCounter.innerText = '100%';
        this.pause();
        this.seekToFrame(0);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // KEYBOARD
    // ─────────────────────────────────────────────────────────────────────────
    initKeyboard() {
        window.addEventListener('keydown', e => {
            if (document.activeElement === this.codeEditor) return;
            if (e.code === 'Space') { e.preventDefault(); this.togglePlay(); }
            if (e.key === 'ArrowLeft')  { e.preventDefault(); this.pause(); this.step(-1); }
            if (e.key === 'ArrowRight') { e.preventDefault(); this.pause(); this.step(1); }
            if (e.key === 'Home') { e.preventDefault(); this.pause(); this.seekToFrame(0); }
            if (e.key === 'End')  { e.preventDefault(); this.pause(); this.seekToFrame(this.timelineFrames.length - 1); }
        });
    }

    handleEditorShortcuts(e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); this.saveCode(); return; }
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); this.runExecution({ autoPlay: true }); return; }
        if ((e.ctrlKey || e.metaKey) && e.key === '/') { e.preventDefault(); this.toggleComment(); this.scheduleLiveCompile(true); return; }
        if (e.key === 'Tab') { e.preventDefault(); this.handleTab(e.shiftKey); this.scheduleLiveCompile(true); return; }
        if (e.altKey && !e.shiftKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            e.preventDefault(); this.moveLine(e.key === 'ArrowDown' ? 'down' : 'up'); this.scheduleLiveCompile(true); return;
        }
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'k' || e.key === 'K')) {
            e.preventDefault(); this.deleteLine(); this.scheduleLiveCompile(true); return;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // EDITOR HELPERS
    // ─────────────────────────────────────────────────────────────────────────
    updateLineNums() {
        const count = this.codeEditor.value.split('\n').length;
        this.lineNumbers.innerHTML = Array.from({length:count},(_,i)=>
            `<span class="line-number" id="line-num-${i+1}">${i+1}</span>`).join('');
    }

    toggleComment() {
        const { value, selectionStart, selectionEnd } = this.codeEditor;
        const si = value.substring(0,selectionStart).split('\n').length - 1;
        const ei = value.substring(0,selectionEnd).split('\n').length - 1;
        const lines = value.split('\n');
        const all = lines.slice(si,ei+1).every(l=>l.trim().startsWith('#'));
        for (let i=si;i<=ei;i++) lines[i] = all ? lines[i].replace(/^(\s*)#\s?/,'$1') : lines[i].replace(/^(\s*)/,'$1# ');
        this.codeEditor.value = lines.join('\n');
        this.updateLineNums(); this.markUnsaved();
    }

    moveLine(dir) {
        const { value, selectionStart, selectionEnd } = this.codeEditor;
        const lines = value.split('\n');
        const idx = value.substring(0,selectionStart).split('\n').length - 1;
        const t = dir === 'down' ? idx+1 : idx-1;
        if (t < 0 || t >= lines.length) return;
        // Compute cursor delta before swapping so we can restore position after value reassignment
        const delta = (dir === 'down' ? 1 : -1) * (lines[t].length + 1);
        [lines[idx],lines[t]] = [lines[t],lines[idx]];
        this.codeEditor.value = lines.join('\n');
        this.codeEditor.selectionStart = selectionStart + delta;
        this.codeEditor.selectionEnd   = selectionEnd   + delta;
        this.updateLineNums(); this.markUnsaved();
    }

    deleteLine() {
        const { value, selectionStart } = this.codeEditor;
        const lines = value.split('\n');
        const idx = value.substring(0,selectionStart).split('\n').length - 1;
        lines.splice(idx,1);
        this.codeEditor.value = lines.join('\n');
        this.updateLineNums(); this.markUnsaved();
    }

    handleTab(shift) {
        const { value, selectionStart, selectionEnd } = this.codeEditor;
        if (selectionStart === selectionEnd && !shift) {
            this.codeEditor.value = value.slice(0,selectionStart) + '    ' + value.slice(selectionEnd);
            this.codeEditor.selectionStart = this.codeEditor.selectionEnd = selectionStart + 4;
        } else {
            const si = value.substring(0,selectionStart).split('\n').length - 1;
            const ei = value.substring(0,selectionEnd).split('\n').length - 1;
            const lines = value.split('\n');
            for (let i=si;i<=ei;i++) lines[i] = shift ? lines[i].replace(/^ {1,4}/,'') : '    '+lines[i];
            this.codeEditor.value = lines.join('\n');
        }
        this.updateLineNums(); this.markUnsaved();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // RESIZER
    // ─────────────────────────────────────────────────────────────────────────
    initResizer() {
        const resizer = document.getElementById('drag-resizer');
        const left    = document.getElementById('panel-editor');
        const right   = document.getElementById('panel-visualizer');
        const ws      = document.getElementById('workspace-container');
        let dragging  = false;
        resizer.addEventListener('mousedown', () => { dragging = true; resizer.classList.add('dragging'); document.body.style.cursor='col-resize'; document.body.style.userSelect='none'; });
        document.addEventListener('mousemove', e => {
            if (!dragging) return;
            const pct = Math.min(Math.max(15, (e.clientX - ws.getBoundingClientRect().left) / ws.clientWidth * 100), 85);
            left.style.width = pct+'%';
            right.style.width = `calc(${100-pct}% - 6px)`;
            this.resizeCanvas();
        });
        document.addEventListener('mouseup', () => { if (!dragging) return; dragging=false; resizer.classList.remove('dragging'); document.body.style.cursor=''; document.body.style.userSelect=''; this.resizeCanvas(); });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ALERTS, SAVE
    // ─────────────────────────────────────────────────────────────────────────
    toggleAlerts() {
        this.errorAlertsEnabled = !this.errorAlertsEnabled;
        localStorage.setItem('rve_error_alerts_mode', JSON.stringify(this.errorAlertsEnabled));
        this.updateAlertUI();
    }
    updateAlertUI() {
        // Use classList.toggle instead of overwriting className (preserves base 'btn' class)
        this.btnAlertToggle.classList.toggle('btn-alert-on',  this.errorAlertsEnabled);
        this.btnAlertToggle.classList.toggle('btn-alert-off', !this.errorAlertsEnabled);
        this.btnAlertToggle.innerText = this.errorAlertsEnabled ? 'Error Alerts: ON' : 'Error Alerts: OFF';
    }
    markUnsaved() { this.isUnsaved=true; this.saveStatusTag.innerText='Unsaved *'; this.saveStatusTag.classList.add('unsaved'); }
    markSaved()   { this.isUnsaved=false; this.saveStatusTag.innerText='Saved';    this.saveStatusTag.classList.remove('unsaved'); }

    saveCode() {
        this.markSaved();
        localStorage.setItem('rve_saved_code', this.codeEditor.value);
        this.printTerminal('[RVE] Code saved.', 'info');
        this.scheduleLiveCompile(true);
    }

    loadPreset(key) {
        this.codeEditor.value = PRESETS[key] || '';
        this.updateLineNums(); this.markSaved();
        this.scheduleLiveCompile(true);
    }

    loadSavedCode() {
        const saved = localStorage.getItem('rve_saved_code');
        if (saved && saved.trim()) {
            this.codeEditor.value = saved;
            this.updateLineNums(); this.markSaved();
            this.printTerminal('[RVE] Restored saved code.', 'info');
            setTimeout(() => this.scheduleLiveCompile(true), 200);
        } else {
            this.loadPreset('avl_tree');
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // LIVE COMPILE
    // ─────────────────────────────────────────────────────────────────────────
    scheduleLiveCompile(force = false) {
        const line = this.codeEditor.value.substring(0, this.codeEditor.selectionStart).split('\n').length;
        if (!force && line === this.lastCompiledLine) return;
        this.lastCompiledLine = line;
        if (this.liveCompileTimer) clearTimeout(this.liveCompileTimer);
        this.liveCompileTimer = setTimeout(() => this.doCompile(), 120);
    }

    async doCompile() {
        const code = this.codeEditor.value;
        if (!code.trim()) return;
        // Do NOT call markSaved() here — live compile auto-saves to localStorage
        // but must not clear the "Unsaved *" badge (only explicit Save should do that).
        localStorage.setItem('rve_saved_code', code);
        try {
            this.timelineFrames = this.isPyodideReady && this.pyodide
                ? await this.executePyodide(code)
                : this.buildFallbackTimeline(code);
        } catch {
            this.timelineFrames = this.buildFallbackTimeline(code);
        }
        this.timelineSlider.max = Math.max(0, this.timelineFrames.length - 1);
        this.seekToFrame(this.timelineFrames.length - 1);
        const s = document.getElementById('editor-status');
        s.innerText = `Live compiled · ${this.timelineFrames.length} steps`;
        s.style.color = '#10B981';
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PYODIDE
    // ─────────────────────────────────────────────────────────────────────────
    async initPyodide() {
        const s = document.getElementById('editor-status');
        const b = document.getElementById('engine-badge');
        try {
            if (window.loadPyodide) {
                s.innerText = 'Loading CPython 3.11 Wasm…';
                // 30-second timeout so the UI doesn't hang forever on slow connections
                const timeout = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Pyodide load timed out after 30s')), 30_000));
                this.pyodide = await Promise.race([window.loadPyodide(), timeout]);
                this.isPyodideReady = true;
                s.innerText = 'CPython 3.11 Wasm · Ready'; s.style.color='#10B981';
                b.innerText = 'CPython 3.11 Wasm Active'; b.style.color='#10B981';
            }
        } catch(e) {
            console.warn('Pyodide unavailable, JS fallback active:', e);
            s.innerText = 'JS Fallback Engine'; b.innerText = 'JS Engine (Offline)';
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // EXECUTION
    // ─────────────────────────────────────────────────────────────────────────
    async runExecution({ autoPlay = false } = {}) {
        // Concurrency guard — prevent multiple simultaneous Pyodide executions
        if (this._isExecuting) return;
        this._isExecuting = true;
        this.btnRun.disabled = true;
        // Clear any pending live-compile timer so it doesn't race with this run
        if (this.liveCompileTimer) { clearTimeout(this.liveCompileTimer); this.liveCompileTimer = null; }
        const code = this.codeEditor.value;
        if (!code.trim()) { this._isExecuting = false; this.btnRun.disabled = false; return; }
        this.clearTerminal();
        this.printTerminal('[RVE] Starting execution trace…', 'info');
        try {
            this.timelineFrames = this.isPyodideReady && this.pyodide
                ? await this.executePyodide(code)
                : this.buildFallbackTimeline(code);
        } catch(e) {
            this.printTerminal(`[Error] ${e.message}`, 'output');
            this.timelineFrames = this.buildFallbackTimeline(code);
        } finally {
            this._isExecuting = false;
            this.btnRun.disabled = false;
        }
        this.timelineSlider.max = Math.max(0, this.timelineFrames.length - 1);
        this.timelineSlider.value = 0;
        this.seekToFrame(0);
        const s = document.getElementById('editor-status');
        s.innerText = `Executed · ${this.timelineFrames.length} frames`; s.style.color='#10B981';
        if (autoPlay) this.startPlayback();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CPYTHON TRACER  (runs inside Pyodide WebAssembly)
    // Builds a recursive heap graph with: nodes (ListNode, DictNode, TupleNode,
    // SetNode, PrimNode), slot refs, and stack variable pointers.
    // ─────────────────────────────────────────────────────────────────────────
    async executePyodide(userCode) {
        const script = `
import sys, io, json, builtins
_stdout = io.StringIO()
sys.stdout = _stdout
_globals = {}
_err = None
_steps = []
_iter_counts = {}
_MAX_STEPS = 5000

def _tracer(frame, event, arg):
    if event == 'line':
        if len(_steps) >= _MAX_STEPS:
            raise RuntimeError(f'Execution exceeded {_MAX_STEPS} steps — possible infinite loop or very large dataset')
        no = frame.f_lineno
        _iter_counts[no] = _iter_counts.get(no, 0) + 1
        locs = {}
        for k,v in frame.f_locals.items():
            if k.startswith('_') or k.startswith('.'): continue
            try:
                cn = type(v).__name__
                if cn in ('int','float','str','bool'): locs[k] = repr(v)
                elif cn in ('list','tuple','dict','set'): locs[k] = f"0x{id(v):x}"
            except: pass
        _steps.append({'line': no, 'iter': _iter_counts[no], 'scope': frame.f_code.co_name, 'locals': locs})
    return _tracer

sys.settrace(_tracer)
try:
    exec(_user_code, _globals)
except Exception as e:
    _err = str(e)
finally:
    sys.settrace(None)

# ── build heap graph ─────────────────────────────────────────────────────────
_seen = {}
_events = []

def _node(obj, name='', depth=0):
    oid = f"0x{id(obj):x}"
    if oid in _seen or depth > 5: return oid
    cls = type(obj).__name__
    rc  = sys.getrefcount(obj) - 1
    num = id(obj) & 0xFF
    slots = []

    if isinstance(obj, (int, float, str, bool, type(None))):
        _seen[oid] = {'id':oid,'varName':name,'label':repr(obj),'type':'PrimNode','pyType':cls,'pyId':oid,'objNum':num,'refCount':rc,'isImmutable':True,'slots':[]}
    elif isinstance(obj, list):
        _seen[oid] = {'id':oid,'varName':name,'label':f"list  ({len(obj)} items)",'type':'ListNode','pyType':'list','pyId':oid,'objNum':num,'refCount':rc,'isImmutable':False,'slots':slots}
        for i,item in enumerate(obj[:12]):
            cid = _node(item, f"{name}[{i}]", depth+1)
            vr  = repr(item) if isinstance(item,(int,float,str,bool)) else f"{type(item).__name__}"
            slots.append({'key':str(i),'targetId':cid,'valRepr':vr})
    elif isinstance(obj, dict):
        _seen[oid] = {'id':oid,'varName':name,'label':f"dict  ({len(obj)} keys)",'type':'DictNode','pyType':'dict','pyId':oid,'objNum':num,'refCount':rc,'isImmutable':False,'slots':slots}
        for k,v in list(obj.items())[:12]:
            cid = _node(v, f"{name}['{k}']", depth+1)
            vr  = repr(v) if isinstance(v,(int,float,str,bool)) else f"{type(v).__name__}"
            slots.append({'key':str(k),'targetId':cid,'valRepr':vr})
    elif isinstance(obj, tuple):
        _seen[oid] = {'id':oid,'varName':name,'label':f"tuple ({len(obj)} items)",'type':'TupleNode','pyType':'tuple','pyId':oid,'objNum':num,'refCount':rc,'isImmutable':True,'slots':slots}
        for i,item in enumerate(obj[:12]):
            cid = _node(item, f"{name}[{i}]", depth+1)
            vr  = repr(item) if isinstance(item,(int,float,str,bool)) else f"{type(item).__name__}"
            slots.append({'key':str(i),'targetId':cid,'valRepr':vr})
    elif isinstance(obj, set):
        _seen[oid] = {'id':oid,'varName':name,'label':f"set   ({len(obj)} items)",'type':'SetNode','pyType':'set','pyId':oid,'objNum':num,'refCount':rc,'isImmutable':False,'slots':slots}
        for i,item in enumerate(sorted(list(obj))[:12]):
            cid = _node(item, f"{name}{{{i}}}", depth+1)
            vr  = repr(item) if isinstance(item,(int,float,str,bool)) else f"{type(item).__name__}"
            slots.append({'key':f'{{{i}}}','targetId':cid,'valRepr':vr})
    else:
        _seen[oid] = {'id':oid,'varName':name,'label':type(obj).__name__,'type':'ObjNode','pyType':cls,'pyId':oid,'objNum':num,'refCount':rc,'isImmutable':False,'slots':slots}
        if hasattr(obj, '__dict__'):
            for k,v in list(obj.__dict__.items())[:12]:
                if k.startswith('_'): continue
                cid = _node(v, f"{name}.{k}", depth+1)
                vr  = repr(v) if isinstance(v,(int,float,str,bool)) else f"{type(v).__name__}"
                slots.append({'key':str(k),'targetId':cid,'valRepr':vr})
        elif hasattr(obj, '__slots__'):
            for k in obj.__slots__:
                if hasattr(obj, k):
                    v = getattr(obj, k); cid = _node(v, f"{name}.{k}", depth+1)
                    vr  = repr(v) if isinstance(v,(int,float,str,bool)) else f"{type(v).__name__}"
                    slots.append({'key':str(k),'targetId':cid,'valRepr':vr})
    return oid

_vars = []
for k,v in _globals.items():
    if k.startswith('_') or callable(v) or isinstance(v, type) or type(v).__name__ in ('module','function','type'): continue
    cls = type(v).__name__
    _events.append({'event':'ASSIGN','msg':f"'{k}' ──► {cls} @ 0x{id(v):x}"})
    rid = _node(v, k)
    _vars.append({'name':k,'targetId':rid,'pyType':cls})

json.dumps({
    'stdout': _stdout.getvalue(),
    'nodes':  list(_seen.values()),
    'vars':   _vars,
    'events': _events,
    'steps':  _steps,
    'error':  _err
})
`;

        // Pass user code as a Pyodide global binding — avoids string interpolation/escaping entirely
        this.pyodide.globals.set('_user_code', userCode);
        const raw = await this.pyodide.runPythonAsync(script);
        const res = JSON.parse(raw);

        if (res.stdout) this.printTerminal(res.stdout, 'output');
        if (res.events) this.renderEventLog(res.events);
        if (res.error) {
            this.printTerminal(`[Exception] ${res.error}`, 'output');
            if (this.errorAlertsEnabled) {
                this.actionBanner.classList.add('error-alert');
                this.actionLineBadge.innerText = '⚠ Error';
                this.actionDescription.innerText = res.error;
            }
        } else {
            this.actionBanner.classList.remove('error-alert');
        }

        return this.buildTimeline(userCode, res.nodes, res.vars, res.steps);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TIMELINE BUILDER
    // Turns CPython step records into animation frames,
    // each frame referencing the full heap graph.
    // ─────────────────────────────────────────────────────────────────────────
    buildTimeline(code, nodes, vars, steps) {
        const lines  = code.split('\n');
        const frames = [];
        let   ts     = 1000;
        this.pipelineLog = [];

        const graph = this.buildGraphLayout(nodes, vars);

        if (steps && steps.length) {
            const counts = new Map();

            // Compute the actual total iterations per line from the trace data
            // (replaces the hardcoded TOTAL=4 that was wrong for non-preset code)
            const lineTotals = new Map();
            steps.forEach(step => lineTotals.set(step.line, step.iter));

            steps.forEach(step => {
                const ln  = step.line;
                if (ln < 1 || ln > lines.length) return;
                const raw = lines[ln - 1] || '';
                const cl  = raw.trim();
                if (!cl || cl.startsWith('#')) return;

                const n     = (counts.get(ln) || 0) + 1;
                const total = lineTotals.get(ln) || n;
                counts.set(ln, n);

                const isLoop = /^for |^while /.test(cl);
                const isCond = /^if |^elif |^else:| if |^if all/.test(cl);

                // Pick the first loop-scope local that looks like an iterator variable
                let iterVar = null, iterVal = null, condResult = null;
                for (const [k,v] of Object.entries(step.locals || {})) {
                    iterVar = k; iterVal = v; break;
                }

                // Pipeline stage detection
                let stage = null;
                if (ln <= 7)  stage = 'input';
                else if (cl.startsWith('for ') && cl.includes('student')) stage = 'iter';
                else if (cl.startsWith('if all') || (isCond && cl.includes('mark'))) {
                    stage = 'filter';
                    // condResult left null here — real result comes from tracer when available
                }
                else if (cl.includes('sum(') || cl.includes('average') || cl.includes('grade')) stage = 'eval';
                else if (cl.startsWith('result') || cl === ']' || cl.includes('append')) stage = 'output';

                if (stage) this.pipelineLog.push({ frame: frames.length+1, ln, stage, iterVar, iterVal, condResult });

                const iterInfo = (isLoop || isCond) ? {
                    iterIndex: n, totalIters: total,
                    iteratorVar: iterVar || (isLoop ? 'item' : null),
                    iteratorVal: iterVal, conditionResult: condResult, stage
                } : null;

                frames.push({
                    ts: ts += 40,
                    lineNumber: ln, lineCode: cl,
                    description: this.describeStep(cl, n, total, iterVar, iterVal, condResult),
                    graph, iterInfo, stage
                });
            });
        }

        this.updatePipelineTab();
        if (frames.length) return frames;
        return this.buildFallbackTimeline(code, graph);
    }

    buildFallbackTimeline(code, graph = null) {
        const lines  = code.split('\n');
        const frames = [];
        let   ts     = 1000;
        const g = graph || this.buildGraphLayout([], []);

        lines.forEach((line, i) => {
            const cl = line.trim();
            if (!cl || cl.startsWith('#')) return;
            frames.push({ ts: ts+=50, lineNumber: i+1, lineCode: cl,
                description: `Executed line ${i+1}: ${cl}`, graph: g, iterInfo: null, stage: null });
        });
        return frames.length ? frames : [{ ts:1000, lineNumber:1, lineCode:'', description:'Ready', graph:g, iterInfo:null, stage:null }];
    }

    describeStep(cl, n, total, ivar, ival, cond) {
        if (cond)  return `Filter step ${n}/${total}: ${cl.slice(0,40)} → ${cond}`;
        if (ivar)  return `Iter ${n}/${total}: ${ivar} = ${ival}`;
        return `Line executed: ${cl.slice(0,60)}`;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GRAPH LAYOUT ENGINE  (columnar, no overlapping)
    //
    //  Zone 0 (x≈40):   Stack variable pills
    //  Zone 1 (x≈170):  Root containers  (list / dict at top level)
    //  Zone 2 (x≈420):  Depth-1 children  (dict items inside list, etc.)
    //  Zone 3 (x≈650):  Depth-2 children  (marks list, nested dicts …)
    //  Zone 4 (x≈860):  Leaf primitives   ("Alice", 85 …)
    //
    //  Nodes are stacked vertically within each zone with ROW_GAP spacing.
    //  Reference arrows are drawn from the slot anchor point → left edge of target.
    // ─────────────────────────────────────────────────────────────────────────
    buildGraphLayout(nodes, vars) {
        const nodeMap = new Map();
        nodes.forEach(n => nodeMap.set(n.id, { ...n, _placed: false }));

        // Classify depth of each node
        const depth = new Map();
        const classifyDepth = (id, d) => {
            if (!nodeMap.has(id) || depth.has(id)) return;
            depth.set(id, d);
            const n = nodeMap.get(id);
            (n.slots||[]).forEach(s => { if (s.targetId) classifyDepth(s.targetId, d+1); });
        };
        vars.forEach(v => classifyDepth(v.targetId, 0));
        nodeMap.forEach((_, id) => { if (!depth.has(id)) depth.set(id, 3); });

        // Group by depth
        const byDepth = [[], [], [], [], []];
        nodeMap.forEach((n,id) => {
            const d = Math.min(depth.get(id)||0, 4);
            n._depth = d;
            byDepth[d].push(n);
        });

        // Assign Y positions (stacked vertically per column)
        const curY = [60, 60, 60, 60, 60];
        const layoutNode = (n) => {
            if (n._placed) return;
            n._placed = true;
            const d   = n._depth;
            const col = COL_X[d];
            const w   = this._nodeWidth(n);
            const h   = this._nodeHeight(n);
            n.x  = col;
            n.y  = curY[d];
            n.w  = w;
            n.h  = h;
            curY[d] += h + NODE.ROW_GAP;
            // layout children first so arrows know where targets are
            (n.slots||[]).forEach(s => {
                if (s.targetId && nodeMap.has(s.targetId)) layoutNode(nodeMap.get(s.targetId));
            });
        };

        // Layout in variable-reference order first (ensures referenced nodes get correct depth)
        vars.forEach(v => { if (nodeMap.has(v.targetId)) layoutNode(nodeMap.get(v.targetId)); });
        nodeMap.forEach(n => layoutNode(n));

        // Stack variables (zone 0) — simple pills
        const varNodes = [];
        let vy = 60;
        vars.forEach(v => {
            varNodes.push({ name: v.name, targetId: v.targetId, pyType: v.pyType, x: COL_X[0], y: vy });
            vy += NODE.VAR_H + 12;
        });

        // Build ref list
        const refs = [];
        nodeMap.forEach(n => {
            (n.slots||[]).forEach((s,i) => {
                if (s.targetId && nodeMap.has(s.targetId)) {
                    const target = nodeMap.get(s.targetId);
                    // anchor: right edge of slot row inside n
                    const fromY = n.y + NODE.HEADER_H + i * NODE.ROW_H + NODE.ROW_H/2;
                    const fromX = n.x + n.w;
                    const toX   = target.x;
                    const toY   = target.y + NODE.HEADER_H/2;
                    refs.push({ fromId:n.id, toId:s.targetId, label:s.key, valRepr:s.valRepr, fromX, fromY, toX, toY });
                }
            });
        });

        // Variable → target refs
        vars.forEach(v => {
            if (nodeMap.has(v.targetId)) {
                const target = nodeMap.get(v.targetId);
                refs.push({ fromId:'var_'+v.name, toId:v.targetId, label:v.name, isVarRef:true,
                    fromX: COL_X[0]+NODE.VAR_W, fromY: varNodes.find(vn=>vn.name===v.name)?.y + NODE.VAR_H/2,
                    toX: target.x, toY: target.y + NODE.HEADER_H/2 });
            }
        });

        // ── SEMANTIC ANALYSIS & LAYOUT ──────────────────────────────────────
        let semanticScene = null;
        let semanticLayout = null;
        if (typeof SemanticAnalyzer !== 'undefined') {
            semanticScene = SemanticAnalyzer.analyze(nodeMap, vars);
            if (semanticScene) {
                const cw = (this.canvas?.width || 800) / (this.dpr * this.zoom);
                const ch = (this.canvas?.height || 600) / (this.dpr * this.zoom);
                switch (semanticScene.type) {
                    case 'BinaryTree': semanticLayout = SemanticLayoutSolver.binaryTree(semanticScene, cw, ch); break;
                    case 'LinkedList': semanticLayout = SemanticLayoutSolver.linkedList(semanticScene, cw); break;
                    case 'Stack':      semanticLayout = SemanticLayoutSolver.stack(semanticScene, cw, ch); break;
                    case 'Queue':      semanticLayout = SemanticLayoutSolver.queue(semanticScene, cw, ch); break;
                    case 'Heap':       semanticLayout = SemanticLayoutSolver.heap(semanticScene, cw, ch); break;
                    case 'Graph':      semanticLayout = SemanticLayoutSolver.graph(semanticScene, cw, ch); break;
                    case 'HashMap':    semanticLayout = SemanticLayoutSolver.hashMap(semanticScene, cw, ch); break;
                }
            }
        }

        return { nodeMap, refs, varNodes, semanticScene, semanticLayout };
    }

    _nodeWidth(n) {
        if (n.type === 'PrimNode') return NODE.PRIM_W;
        // measure longest key string
        this.ctx.font = '12px Fira Code, monospace';
        let max = this.ctx.measureText(n.label||'').width;
        (n.slots||[]).forEach(s => {
            const w = this.ctx.measureText(s.key + '  ' + s.valRepr).width;
            if (w > max) max = w;
        });
        return Math.min(NODE.MAX_W, Math.max(NODE.MIN_W, Math.ceil(max) + 44));
    }

    _nodeHeight(n) {
        if (n.type === 'PrimNode') return NODE.PRIM_H;
        return NODE.HEADER_H + Math.max(1, (n.slots||[]).length) * NODE.ROW_H + 8;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SEEK / STEP / PLAY
    // ─────────────────────────────────────────────────────────────────────────
    seekToFrame(idx) {
        if (idx < 0 || idx >= this.timelineFrames.length) return;
        this.currentFrameIndex = idx;
        this.timelineSlider.value = idx;

        const f = this.timelineFrames[idx];
        this.currentFrameLabel.innerText = `Frame: ${idx+1} / ${this.timelineFrames.length}`;
        this.currentTimestampLabel.innerText = `${f.ts}ms`;

        if (!this.actionBanner.classList.contains('error-alert')) {
            const ii = f.iterInfo;
            this.actionLineBadge.innerText = `Line ${f.lineNumber||1}${ii ? ` [Iter ${ii.iterIndex}/${ii.totalIters}]` : ''}`;
            this.actionDescription.innerText = f.description || 'Executing…';
            if (ii && this.actionIterBadge) {
                this.actionIterBadge.style.display = 'inline-flex';
                const cond = ii.conditionResult;
                this.actionIterBadge.className = 'action-iter-badge' + (cond ? (cond.includes('True') ? ' pass' : ' fail') : '');
                this.actionIterBadge.innerText  = cond || '';
            } else if (this.actionIterBadge) {
                this.actionIterBadge.style.display = 'none';
            }
        }

        this.highlightLine(f.lineNumber, false, f.iterInfo);
        this.graph = f.graph || { nodeMap:new Map(), refs:[], varNodes:[], semanticScene:null, semanticLayout:null };
        this.activeIterInfo = f.iterInfo || null;

        this.updateCanvasTitle();

        // stats
        const nc = this.graph.nodeMap ? this.graph.nodeMap.size : 0;
        const rc = this.graph.refs ? this.graph.refs.filter(r=>!r.isVarRef).length : 0;
        this.entityCounter.innerText = nc;
        if (this.statRefs) this.statRefs.innerHTML = `Refs: <strong>${rc}</strong>`;
        if (this.statScope) this.statScope.innerHTML = `Scope: <strong>${f.iterInfo?.iteratorVar || 'main'}</strong>`;

        this.updateMemoryPanel();
        // Pass switchTab=false so stepping/scrubbing doesn't forcibly jump to Inspector tab
        if (this.selectedNodeId && this.graph.nodeMap?.has(this.selectedNodeId)) {
            this.showInspector(this.graph.nodeMap.get(this.selectedNodeId), false);
        }
    }

    step(d) { this.seekToFrame(this.currentFrameIndex + d); }

    togglePlay() { this.isPlaying ? this.pause() : this.startPlayback(); }

    startPlayback() {
        if (this.currentFrameIndex >= this.timelineFrames.length-1) this.seekToFrame(0);
        this.isPlaying = true;
        this.btnTimelinePlay.classList.add('paused');
        this.timelinePlayIcon.innerHTML = '<rect x="5" y="4" width="4" height="16"></rect><rect x="15" y="4" width="4" height="16"></rect>';
        const delay = 350 / (parseFloat(this.speedSelect.value) || 0.5);
        if (this.playInterval) clearInterval(this.playInterval);
        this.playInterval = setInterval(() => {
            if (this.currentFrameIndex < this.timelineFrames.length-1) this.step(1);
            else this.pause();
        }, delay);
    }

    pause() {
        this.isPlaying = false;
        if (this.playInterval) { clearInterval(this.playInterval); this.playInterval=null; }
        this.btnTimelinePlay.classList.remove('paused');
        this.timelinePlayIcon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"></polygon>';
    }

    // ─────────────────────────────────────────────────────────────────────────
    // LINE HIGHLIGHTER
    // ─────────────────────────────────────────────────────────────────────────
    highlightLine(ln, isError=false, ii=null) {
        this.lineNumbers.querySelectorAll('.active-line-num').forEach(el => {
            el.classList.remove('active-line-num','error');
        });
        if (!ln) { this.lineHighlightBar.style.display='none'; return; }
        const target = document.getElementById(`line-num-${ln}`);
        if (!target) return;
        target.classList.add('active-line-num');
        if (isError) target.classList.add('error');
        // Read actual computed line-height so highlight stays aligned if CSS changes
        const rowH = this._editorLineH || (this._editorLineH = parseFloat(getComputedStyle(this.codeEditor).lineHeight) || 20.8);
        const top  = 12 + (ln-1)*rowH - this.codeEditor.scrollTop;
        this.lineHighlightBar.style.top     = `${top}px`;
        this.lineHighlightBar.style.display = 'flex';
        this.lineHighlightBar.className     = isError ? 'line-highlight-bar error-bar' : (ii ? 'line-highlight-bar smart-iter-active' : 'line-highlight-bar');
        this.lineHighlightBar.innerHTML     = ii ? `<div class="smart-iterator-badge"><span class="iter-tag">Iter ${ii.iterIndex}/${ii.totalIters}</span>${ii.iteratorVar ? `<span>${ii.iteratorVar} = <strong>${ii.iteratorVal}</strong></span>` : ''}${ii.conditionResult ? `<span class="${ii.conditionResult.includes('True')?'cond-pass':'cond-fail'}">${ii.conditionResult}</span>` : ''}</div>` : '';
        const edH = this.codeEditor.clientHeight;
        const lt  = target.offsetTop - 12;
        if (lt < this.codeEditor.scrollTop || lt > this.codeEditor.scrollTop + edH - 40) {
            this.codeEditor.scrollTop = lt - edH/2;
            this.lineNumbers.scrollTop = this.codeEditor.scrollTop;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TERMINAL
    // ─────────────────────────────────────────────────────────────────────────
    clearTerminal() { this.terminalOutput.innerHTML = ''; }
    printTerminal(text, type='output') {
        const d = document.createElement('div');
        d.className = `terminal-line ${type}`; d.innerText = text;
        this.terminalOutput.appendChild(d);
        this.terminalOutput.scrollTop = this.terminalOutput.scrollHeight;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PIPELINE TAB
    // ─────────────────────────────────────────────────────────────────────────
    updatePipelineTab() {
        if (!this.pipelineStreamList) return;
        if (!this.pipelineLog.length) { this.pipelineStreamList.innerHTML = '<p class="empty-state">No comprehension steps recorded.</p>'; return; }
        const stageLabel = { input:'📥 Input', iter:'🔄 Loop', filter:'🔍 Filter', eval:'🧮 Math', output:'📤 Output' };
        const cls = { input:'assign', iter:'assign', filter:'', eval:'info', output:'create' };
        this.pipelineStreamList.innerHTML = this.pipelineLog.map(p => {
            const clsExtra = p.condResult ? (p.condResult.includes('True') ? 'create' : 'delete') : (cls[p.stage]||'info');
            return `<div class="event-log-item ${clsExtra}">
                <span class="event-tag">${stageLabel[p.stage]||p.stage}</span>
                <span class="event-msg">Line ${p.ln}${p.iterVar ? ` · ${p.iterVar} = ${p.iterVal}` : ''}${p.condResult ? ` → ${p.condResult}` : ''}</span>
            </div>`;
        }).join('');
    }

    renderEventLog(events) {
        if (!events?.length || !this.eventStreamList) return;
        this.eventStreamList.innerHTML = events.map(e => {
            const cls = e.event.startsWith('ASSIGN') ? 'assign' : e.event.startsWith('CREATE') ? 'create' : 'info';
            return `<div class="event-log-item ${cls}"><span class="event-tag">${e.event}</span><span class="event-msg">${e.msg}</span></div>`;
        }).join('');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MEMORY PANEL
    // ─────────────────────────────────────────────────────────────────────────
    updateMemoryPanel() {
        if (!this.graph) return;
        const { nodeMap, varNodes } = this.graph;

        if (varNodes?.length) {
            // escHtml applied to user-derived variable names and type strings (XSS fix)
            this.stackFrameList.innerHTML = varNodes.map(v => `
                <div class="memory-item">
                    <span class="memory-var-name">${escHtml(v.name)}</span>
                    <span class="memory-ptr-arrow">──► ${escHtml(v.pyType)} @ ${escHtml(v.targetId)}</span>
                </div>`).join('');
        } else {
            this.stackFrameList.innerHTML = '<p class="empty-state">No stack variables.</p>';
        }

        if (nodeMap?.size) {
            this.heapSpaceList.innerHTML = [...nodeMap.values()].map(n => `
                <div class="memory-item">
                    <span class="memory-var-name">${escHtml(n.type.replace('Node',''))} #${escHtml(String(n.objNum))}</span>
                    <span>${escHtml(String(n.refCount))} ref${n.refCount!==1?'s':''} · ${n.isImmutable?'🔒':'⚡'} · ${escHtml(n.pyId)}</span>
                </div>`).join('');
        } else {
            this.heapSpaceList.innerHTML = '<p class="empty-state">No heap objects.</p>';
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CANVAS CLICK → INSPECTOR
    // ─────────────────────────────────────────────────────────────────────────
    handleCanvasClick(e) {
        // isPanning is always false at click-time (click fires after mouseup clears the flag).
        // Instead, check drag distance to distinguish a click from a pan gesture.
        const dx = e.clientX - this._dragStartX;
        const dy = e.clientY - this._dragStartY;
        if (Math.hypot(dx, dy) > 5) return;  // was a drag, not an intentional click
        const rect = this.canvas.getBoundingClientRect();
        const mx = (e.clientX - rect.left - this.panX) / this.zoom;
        const my = (e.clientY - rect.top  - this.panY) / this.zoom;
        let hit = null;
        this.graph.nodeMap?.forEach(n => {
            if (mx >= n.x && mx <= n.x+n.w && my >= n.y && my <= n.y+n.h) hit = n;
        });
        if (hit) { this.selectedNodeId = hit.id; this.showInspector(hit); }
        else      this.selectedNodeId = null;
    }

    showInspector(n, switchTab = true) {
        if (!this.inspectorContent) return;
        const im = n.isImmutable
            ? `<span class="inspect-immutable">Immutable 🔒</span>`
            : `<span class="inspect-mutable">Mutable ⚡</span>`;
        // escHtml applied to all user-data values to prevent XSS
        const slots = n.slots?.length
            ? n.slots.map(s=>`<li><code>${escHtml(s.key)}</code> ──► ${escHtml(s.valRepr)}</li>`).join('')
            : '<li class="inspect-leaf-empty">— (leaf node)</li>';
        this.inspectorContent.innerHTML = `
            <div class="inspect-item"><span class="inspect-label">Python Type</span><span class="inspect-val">${escHtml(n.pyType)}</span></div>
            <div class="inspect-item"><span class="inspect-label">Object ID</span><span class="inspect-val">#${escHtml(String(n.objNum))}</span></div>
            <div class="inspect-item"><span class="inspect-label">Memory Address</span><span class="inspect-val">${escHtml(n.pyId)}</span></div>
            <div class="inspect-item"><span class="inspect-label">Reference Count</span><span class="inspect-val">${escHtml(String(n.refCount))} active ref${n.refCount!==1?'s':''}</span></div>
            <div class="inspect-item"><span class="inspect-label">Mutability</span>${im}</div>
            <div class="inspect-item"><span class="inspect-label">Variable Name</span><span class="inspect-val">${escHtml(n.varName||'—')}</span></div>
            <div class="inspect-item"><span class="inspect-label">Children / Slots</span><ul class="inspect-slots-list">${slots}</ul></div>`;

        // Only switch to inspector tab when the user explicitly clicked a node
        if (switchTab) {
            document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c=>c.classList.remove('active'));
            const tb = document.querySelector('.tab-btn[data-tab="inspector"]');
            const tc = document.getElementById('tab-inspector');
            if (tb) tb.classList.add('active');
            if (tc) tc.classList.add('active');
        }
    }

    setViewMode(mode) {
        this.viewMode = mode;
        ['auto','learning','runtime','memory','debug'].forEach(m => {
            const btn = document.getElementById(`btn-view-${m}`);
            if (btn) btn.classList.toggle('active', m === mode);
        });

        if (mode === 'memory') {
            const tb = document.querySelector('.tab-btn[data-tab="memory"]');
            if (tb) tb.click();
        } else if (mode === 'debug') {
            const tb = document.querySelector('.tab-btn[data-tab="pipeline"]');
            if (tb) tb.click();
        }
        this.updateCanvasTitle();
    }

    updateCanvasTitle() {
        const titleEl = document.getElementById('canvas-title-text');
        if (!titleEl) return;
        const scene = this.graph?.semanticScene;
        if (this.viewMode === 'runtime') {
            titleEl.innerText = 'CPython Object Graph Projection';
        } else if (this.viewMode === 'memory') {
            titleEl.innerText = 'Memory Allocation Projection (Stack & Heap)';
        } else if (this.viewMode === 'debug') {
            titleEl.innerText = 'Execution Trace & Pipeline Projection';
        } else if (scene) {
            const names = {
                BinaryTree: 'Binary Tree Projection',
                LinkedList: 'Linked List Projection',
                Stack: 'Stack Tower Projection',
                Queue: 'Queue Ribbon Projection',
                Heap: 'Heap Split Projection',
                Graph: 'Adjacency Graph Projection',
                HashMap: 'Hash Map Bucket Projection'
            };
            titleEl.innerText = names[scene.type] || 'Semantic Data Structure Projection';
        } else {
            titleEl.innerText = 'Semantic DSA Visualizer Engine';
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER LOOP
    // ─────────────────────────────────────────────────────────────────────────
    startRenderLoop() {
        const tick = () => {
            if (!this.semanticRenderer && typeof SemanticRenderer !== 'undefined') {
                this.semanticRenderer = new SemanticRenderer(this.ctx);
            }
            const dpr = this.dpr;
            this.ctx.setTransform(1,0,0,1,0,0);
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.save();
            this.ctx.scale(dpr, dpr);
            this.ctx.translate(this.panX, this.panY);
            this.ctx.scale(this.zoom, this.zoom);

            const scene  = this.graph?.semanticScene;
            const layout = this.graph?.semanticLayout;
            const useDS  = (this.viewMode === 'learning' && scene) ||
                          (this.viewMode === 'auto' && scene);

            if (useDS && this.semanticRenderer) {
                // Pure clean data structure view — no low-level CPython memory zone pills or headers!
                this.semanticRenderer.draw(scene, layout, this.zoom, this.selectedNodeId);
                this.drawIterOverlay();
            } else {
                // Low-level CPython memory object graph view
                this.drawZoneLabels();
                this.drawRefs();
                this.drawVarPills();
                this.drawNodes();
                this.drawIterOverlay();
            }

            this.ctx.restore();
            requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DRAW: Zone labels (faint column headers)
    // ─────────────────────────────────────────────────────────────────────────
    drawZoneLabels() {
        if (!this.graph?.nodeMap?.size && !this.graph?.varNodes?.length) return;
        const labels = ['Stack', 'Root Objects', 'Children', 'Nested', 'Leaves'];
        this.ctx.font = '500 10px Inter, sans-serif';
        this.ctx.textBaseline = 'middle';
        this.ctx.textAlign = 'left';
        COL_X.forEach((x, i) => {
            this.ctx.fillStyle = 'rgba(100,116,139,0.3)';
            this.ctx.fillText(labels[i], x, 30);
            // faint vertical rule
            this.ctx.strokeStyle = 'rgba(100,116,139,0.08)';
            this.ctx.lineWidth = 1;
            this.ctx.setLineDash([4,6]);
            this.ctx.beginPath();
            this.ctx.moveTo(x - 10, 45);
            this.ctx.lineTo(x - 10, 1200);
            this.ctx.stroke();
            this.ctx.setLineDash([]);
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DRAW: Reference arrows (bezier)
    // ─────────────────────────────────────────────────────────────────────────
    drawRefs() {
        const refs = this.graph?.refs;
        if (!refs?.length) return;
        refs.forEach(r => {
            const isVarRef = r.isVarRef;
            this.ctx.strokeStyle = isVarRef ? 'rgba(148,163,184,0.55)' : 'rgba(99,102,241,0.4)';
            this.ctx.lineWidth   = isVarRef ? 1.5 : 1.5;
            this.ctx.setLineDash(isVarRef ? [5,3] : []);

            const fx=r.fromX, fy=r.fromY, tx=r.toX, ty=r.toY;
            const mx = fx + (tx-fx) * 0.55;
            this.ctx.beginPath();
            this.ctx.moveTo(fx, fy);
            this.ctx.bezierCurveTo(mx, fy, mx, ty, tx, ty);
            this.ctx.stroke();
            this.ctx.setLineDash([]);

            // arrow head
            const a = Math.atan2(ty-fy, tx-fx);
            this.ctx.fillStyle = isVarRef ? 'rgba(148,163,184,0.7)' : 'rgba(99,102,241,0.7)';
            this.ctx.beginPath();
            this.ctx.moveTo(tx, ty);
            this.ctx.lineTo(tx - 8*Math.cos(a-0.4), ty - 8*Math.sin(a-0.4));
            this.ctx.lineTo(tx - 8*Math.cos(a+0.4), ty - 8*Math.sin(a+0.4));
            this.ctx.closePath();
            this.ctx.fill();
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DRAW: Stack variable pills (Zone 0)
    // ─────────────────────────────────────────────────────────────────────────
    drawVarPills() {
        const varNodes = this.graph?.varNodes;
        if (!varNodes?.length) return;
        const zoom = this.zoom;

        varNodes.forEach(v => {
            const x=v.x, y=v.y, w=NODE.VAR_W, h=NODE.VAR_H;

            this.ctx.fillStyle = COLORS.var.fill;
            this.ctx.strokeStyle = COLORS.var.stroke;
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.roundRect(x, y, w, h, 6);
            this.ctx.fill();
            this.ctx.stroke();

            if (zoom >= 0.5) {
                this.ctx.fillStyle = COLORS.textPrimary;
                this.ctx.font = '600 11px Fira Code, monospace';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText(v.name, x + w/2, y + h/2);
            }
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DRAW: Heap nodes  (Level-of-Detail by zoom)
    // ─────────────────────────────────────────────────────────────────────────
    drawNodes() {
        if (!this.graph?.nodeMap) return;
        const zoom = this.zoom;

        this.graph.nodeMap.forEach(n => {
            const isSelected = n.id === this.selectedNodeId;
            const pal = this._palette(n.type);
            const x=n.x, y=n.y, w=n.w, h=n.h;

            // selection glow
            if (isSelected) {
                this.ctx.shadowColor  = COLORS.accentGlow;
                this.ctx.shadowBlur   = 16;
            } else {
                this.ctx.shadowBlur   = 0;
            }

            // ── LOD 0  (zoomed out < 0.45):  solid coloured badge ───────────
            if (zoom < 0.45) {
                this.ctx.fillStyle = pal.head;
                this.ctx.beginPath();
                this.ctx.roundRect(x, y, w, Math.min(h, 22), 5);
                this.ctx.fill();
                this.ctx.shadowBlur = 0;
                return;
            }

            // ── background box ───────────────────────────────────────────────
            this.ctx.fillStyle = pal.fill;
            this.ctx.beginPath();
            this.ctx.roundRect(x, y, w, h, NODE.CORNER);
            this.ctx.fill();
            this.ctx.strokeStyle = isSelected ? COLORS.borderHover : pal.stroke;
            this.ctx.lineWidth   = isSelected ? 2 : 1.5;
            this.ctx.stroke();
            this.ctx.shadowBlur  = 0;

            // ── coloured header strip ────────────────────────────────────────
            this.ctx.fillStyle = pal.head;
            this.ctx.beginPath();
            this.ctx.roundRect(x, y, w, NODE.HEADER_H, [NODE.CORNER, NODE.CORNER, 0, 0]);
            this.ctx.fill();

            // type badge (top-right corner)
            const badge = this._typeBadge(n.type);
            this.ctx.fillStyle = 'rgba(255,255,255,0.12)';
            this.ctx.font = '500 9px Inter, sans-serif';
            this.ctx.textAlign = 'right'; this.ctx.textBaseline = 'middle';
            this.ctx.fillText(badge, x+w-8, y+NODE.HEADER_H/2);

            // ── LOD 1  (medium: 0.45–0.7):  header label only ───────────────
            if (zoom < 0.7) {
                this.ctx.fillStyle = COLORS.textPrimary;
                this.ctx.font = '600 11px Fira Code, monospace';
                this.ctx.textAlign = 'left';
                this.ctx.fillText(n.varName || n.label, x+10, y+NODE.HEADER_H/2);
                return;
            }

            // ── LOD 2  (full detail: zoom >= 0.7) ───────────────────────────

            // header text: varName + label
            this.ctx.fillStyle = COLORS.textPrimary;
            this.ctx.font = '700 11px Fira Code, monospace';
            this.ctx.textAlign = 'left'; this.ctx.textBaseline = 'middle';
            const varLabel = n.varName ? n.varName : '';
            this.ctx.fillText(varLabel, x+10, y+NODE.HEADER_H/2);

            // sub-label (type hint)
            if (n.type !== 'PrimNode') {
                this.ctx.fillStyle = 'rgba(255,255,255,0.45)';
                this.ctx.font = '500 9px Fira Code, monospace';
                const sub = n.label || '';
                this.ctx.fillText(sub, x+10 + this.ctx.measureText(varLabel+'  ').width, y+NODE.HEADER_H/2);
            }

            // ── Primitive leaf:  centered value ─────────────────────────────
            if (n.type === 'PrimNode') {
                this.ctx.fillStyle = COLORS.textPrimary;
                this.ctx.font = '600 12px Fira Code, monospace';
                this.ctx.textAlign = 'center';
                this.ctx.fillText(n.label, x+w/2, y+NODE.HEADER_H + (h-NODE.HEADER_H)/2);

                // HIGH LOD  (> 1.3):  show address
                if (zoom > 1.3) {
                    this.ctx.fillStyle = COLORS.textSecond;
                    this.ctx.font = '400 9px Fira Code, monospace';
                    this.ctx.fillText(n.pyId, x+w/2, y+h+10);
                }
                return;
            }

            // ── Key-value rows (dict / list / tuple / set) ───────────────────
            const slots = n.slots || [];
            slots.forEach((s, i) => {
                const ry = y + NODE.HEADER_H + i * NODE.ROW_H;

                // alternating row bg
                if (i % 2 === 0) {
                    this.ctx.fillStyle = 'rgba(255,255,255,0.03)';
                    this.ctx.fillRect(x+1, ry, w-2, NODE.ROW_H);
                }

                // divider
                this.ctx.strokeStyle = 'rgba(255,255,255,0.05)';
                this.ctx.lineWidth = 1;
                this.ctx.beginPath(); this.ctx.moveTo(x+8, ry); this.ctx.lineTo(x+w-8, ry); this.ctx.stroke();

                // key (left, coloured)
                this.ctx.fillStyle = COLORS.textKey;
                this.ctx.font = '600 11px Fira Code, monospace';
                this.ctx.textAlign = 'left';
                this.ctx.fillText(s.key, x+12, ry + NODE.ROW_H/2);

                // value preview (right, dim) — only if target is a leaf (no targetId child or it's primitive)
                const target = this.graph.nodeMap?.get(s.targetId);
                const isLeaf = target?.type === 'PrimNode';
                if (isLeaf && s.valRepr) {
                    this.ctx.fillStyle = COLORS.textPrimary;
                    this.ctx.font = '500 11px Fira Code, monospace';
                    this.ctx.textAlign = 'right';
                    const vr = s.valRepr.length > 14 ? s.valRepr.slice(0,12)+'…' : s.valRepr;
                    this.ctx.fillText(vr, x+w-18, ry + NODE.ROW_H/2);
                } else if (s.valRepr && !isLeaf) {
                    // show ref arrow dot (the bezier arrow will connect)
                    this.ctx.fillStyle = pal.stroke;
                    this.ctx.beginPath();
                    this.ctx.arc(x+w-8, ry+NODE.ROW_H/2, 3.5, 0, Math.PI*2);
                    this.ctx.fill();
                }
            });

            // HIGH LOD:  show memory address below node
            if (zoom > 1.3) {
                this.ctx.fillStyle = COLORS.textSecond;
                this.ctx.font = '400 9px Fira Code, monospace';
                this.ctx.textAlign = 'center';
                this.ctx.fillText(`id: ${n.pyId}  refs: ${n.refCount}`, x+w/2, y+h+10);
            }
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DRAW: Iterator glow overlay
    // ─────────────────────────────────────────────────────────────────────────
    drawIterOverlay() {
        if (!this.activeIterInfo) return;
        const ii  = this.activeIterInfo;
        const val = ii.iteratorVal ? String(ii.iteratorVal).replace(/^['"]|['"]$/g,'') : null;
        let   hit = null;

        this.graph.nodeMap?.forEach(n => {
            if (hit) return;
            if ((n.varName && val && n.varName.includes(val)) ||
                (ii.iteratorVar && n.varName === ii.iteratorVar)) hit = n;
        });
        if (!hit) {
            // fall back: highlight any dict node for the current iter step
            let idx = 0;
            this.graph.nodeMap?.forEach(n => {
                if (!hit && n.type === 'DictNode' && idx++ === (ii.iterIndex - 1) % 4) hit = n;
            });
        }
        if (!hit) return;

        const pulse = Math.sin(Date.now()/250) * 5;
        const x = hit.x - 6 - pulse/2;
        const y = hit.y - 6 - pulse/2;
        const w = hit.w + 12 + pulse;
        const h = hit.h + 12 + pulse;

        this.ctx.save();
        this.ctx.shadowColor = COLORS.iterGlow;
        this.ctx.shadowBlur  = 18;
        this.ctx.strokeStyle = COLORS.iterGlow;
        this.ctx.lineWidth   = 2.5;
        this.ctx.beginPath();
        this.ctx.roundRect(x, y, w, h, NODE.CORNER + 4);
        this.ctx.stroke();
        this.ctx.restore();

        // floating label
        const tag = `⚡ ${ii.iteratorVar||'student'} [${ii.iterIndex}/${ii.totalIters}]`;
        this.ctx.font = '700 10px Fira Code, monospace';
        const tw = Math.max(100, this.ctx.measureText(tag).width + 16);
        const ty = hit.y - 22;
        this.ctx.fillStyle = COLORS.iterGlow;
        this.ctx.beginPath();
        this.ctx.roundRect(hit.x + hit.w/2 - tw/2, ty - 9, tw, 18, 4);
        this.ctx.fill();
        this.ctx.fillStyle = '#070A11';
        this.ctx.textAlign = 'center'; this.ctx.textBaseline = 'middle';
        this.ctx.fillText(tag, hit.x + hit.w/2, ty);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────────────────────────────────
    _palette(type) {
        return COLORS[{
            ListNode:'list', DictNode:'dict', TupleNode:'tuple',
            SetNode:'set',   PrimNode:'prim', ObjNode:'list'
        }[type] || 'prim'];
    }

    _typeBadge(type) {
        return { ListNode:'[ ]', DictNode:'{ }', TupleNode:'( )',
                 SetNode:'{ }', PrimNode:'val', ObjNode:'obj' }[type] || '?';
    }
}

window.addEventListener('DOMContentLoaded', () => { new RVEApplication(); });
