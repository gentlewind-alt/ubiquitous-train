// --- RVE WEB APPLICATION CORE ENGINE (ERROR ALERTS TOGGLE & RULE CONFLICT ENGINE) ---

const PRESETS = {
    none: ""
};

class RVEApplication {
    constructor() {
        this.codeEditor = document.getElementById('code-editor');
        this.lineNumbers = document.getElementById('line-numbers');
        this.lineHighlightBar = document.getElementById('line-highlight-bar');
        this.canvas = document.getElementById('visualizer-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        this.algoSelect = document.getElementById('algorithm-select');
        this.speedSelect = document.getElementById('speed-select');
        
        this.btnAlertToggle = document.getElementById('btn-alert-toggle');
        this.btnSave = document.getElementById('btn-save');
        this.btnRun = document.getElementById('btn-run');
        this.btnStepPrev = document.getElementById('btn-step-prev');
        this.btnStepNext = document.getElementById('btn-step-next');
        this.btnReset = document.getElementById('btn-reset');

        this.btnTimelinePlay = document.getElementById('btn-timeline-play');
        this.timelinePlayIcon = document.getElementById('timeline-play-icon');
        
        this.saveStatusTag = document.getElementById('save-status-tag');
        
        this.timelineSlider = document.getElementById('timeline-slider');
        this.currentFrameLabel = document.getElementById('current-frame-label');
        this.currentTimestampLabel = document.getElementById('current-timestamp-label');
        this.entityCounter = document.getElementById('entity-counter');
        this.zoomCounter = document.getElementById('zoom-counter');
        
        this.terminalOutput = document.getElementById('terminal-output');
        this.btnClearTerminal = document.getElementById('btn-clear-terminal');

        this.actionBanner = document.getElementById('action-banner');
        this.actionLineBadge = document.getElementById('action-line-badge');
        this.actionDescription = document.getElementById('action-description');

        this.inspectorPanel = document.getElementById('inspector-panel');
        this.inspectorContent = document.getElementById('inspector-content');
        this.btnCloseInspector = document.getElementById('btn-close-inspector');

        // Error Alerts Toggle State
        const savedAlertState = localStorage.getItem('rve_error_alerts_mode');
        this.errorAlertsEnabled = savedAlertState !== null ? JSON.parse(savedAlertState) : true;

        // Unsaved & Realtime State
        this.isUnsaved = false;
        this.lastCompiledLineCount = 1;
        this.liveCompileDebounceTimer = null;

        // Playback State
        this.isPlaying = false;
        this.playInterval = null;

        // Viewport Pan & Zoom State
        this.zoomScale = 1.0;
        this.panX = 0;
        this.panY = 0;
        this.isPanning = false;
        this.startPanX = 0;
        this.startPanY = 0;

        // Pyodide Wasm CPython State
        this.pyodide = null;
        this.isPyodideReady = false;

        // Engine State
        this.timelineFrames = [];
        this.currentFrameIndex = 0;
        this.selectedEntityId = null;
        this.entities = new Map();
        
        this.init();
    }

    async init() {
        this.resizeCanvas();
        this.initResizer();
        this.initCanvasPanAndZoom();
        this.initGlobalHardwareKeyboardShortcuts();
        this.updateAlertToggleUI();
        window.addEventListener('resize', () => this.resizeCanvas());

        this.btnAlertToggle.addEventListener('click', () => this.toggleErrorAlerts());

        this.codeEditor.addEventListener('input', () => {
            this.updateLineNumbers();
            this.markUnsaved();
        });

        // --- REAL-TIME LIVE LINE COMPILER TRIGGERS ---
        this.codeEditor.addEventListener('keyup', (e) => {
            if (e.key === 'Enter' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                this.checkLiveLineCompile();
            }
        });

        this.codeEditor.addEventListener('click', () => {
            this.checkLiveLineCompile();
        });
        
        // --- VS CODE KEYBOARD SHORTCUTS HANDLER ---
        this.codeEditor.addEventListener('keydown', (e) => {
            // 1. Ctrl + S (Save)
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                this.saveCode();
                return;
            }

            // 2. Ctrl + Enter (Run Execution)
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                this.runExecution({ autoPlay: true });
                return;
            }

            // 3. Ctrl + / (Toggle Comment)
            if ((e.ctrlKey || e.metaKey) && e.key === '/') {
                e.preventDefault();
                this.toggleComment();
                this.checkLiveLineCompile(true);
                return;
            }

            // 4. Shift + Alt + Up/Down (Duplicate Line)
            if (e.shiftKey && e.altKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
                e.preventDefault();
                this.duplicateLine(e.key === 'ArrowDown' ? 'down' : 'up');
                this.checkLiveLineCompile(true);
                return;
            }

            // 5. Alt + Up/Down (Move Line)
            if (e.altKey && !e.shiftKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
                e.preventDefault();
                this.moveLine(e.key === 'ArrowDown' ? 'down' : 'up');
                this.checkLiveLineCompile(true);
                return;
            }

            // 6. Ctrl + Shift + K (Delete Line)
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'k' || e.key === 'K')) {
                e.preventDefault();
                this.deleteLine();
                this.checkLiveLineCompile(true);
                return;
            }

            // 7. Tab / Shift + Tab (Indent / Outdent)
            if (e.key === 'Tab') {
                e.preventDefault();
                this.handleTab(e.shiftKey);
                this.checkLiveLineCompile(true);
                return;
            }
        });

        this.codeEditor.addEventListener('scroll', () => {
            this.lineNumbers.scrollTop = this.codeEditor.scrollTop;
            if (this.currentFrameIndex >= 0 && this.timelineFrames[this.currentFrameIndex]) {
                const currentFrame = this.timelineFrames[this.currentFrameIndex];
                if (currentFrame.lineNumber) {
                    const rowHeight = 20.8;
                    const topOffset = 12 + (currentFrame.lineNumber - 1) * rowHeight - this.codeEditor.scrollTop;
                    this.lineHighlightBar.style.top = `${topOffset}px`;
                }
            }
        });
        
        this.algoSelect.addEventListener('change', (e) => this.loadPreset(e.target.value));
        this.btnSave.addEventListener('click', () => this.saveCode());
        this.btnRun.addEventListener('click', () => this.runExecution({ autoPlay: true }));
        this.btnTimelinePlay.addEventListener('click', () => this.togglePlay());

        this.btnStepPrev.addEventListener('click', () => { this.pause(); this.step(-1); });
        this.btnStepNext.addEventListener('click', () => { this.pause(); this.step(1); });
        this.btnReset.addEventListener('click', () => { this.resetView(); });
        this.timelineSlider.addEventListener('input', (e) => { this.pause(); this.seekToFrame(parseInt(e.target.value)); });
        this.speedSelect.addEventListener('change', () => { if (this.isPlaying) this.startPlayback(); });
        
        this.btnCloseInspector.addEventListener('click', () => this.closeInspector());
        this.btnClearTerminal.addEventListener('click', () => this.clearTerminal());
        
        this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));

        // Start Canvas Loop
        this.startRenderLoop();

        // Load Pyodide Wasm Engine
        await this.initPyodide();

        // Restore Saved Code & Visualization
        this.loadSavedCodeOnRefresh();
    }

    // --- ERROR ALERTS TOGGLE STATE MANAGEMENT ---
    toggleErrorAlerts() {
        this.errorAlertsEnabled = !this.errorAlertsEnabled;
        localStorage.setItem('rve_error_alerts_mode', JSON.stringify(this.errorAlertsEnabled));
        this.updateAlertToggleUI();
        this.triggerLiveLineCompilation();
    }

    updateAlertToggleUI() {
        if (this.errorAlertsEnabled) {
            this.btnAlertToggle.className = "btn btn-alert-on";
            this.btnAlertToggle.innerText = "Error Alerts: ON";
            this.btnAlertToggle.title = "Error Alerts ON: Displays red warning banner on rule conflict / CPython exceptions";
        } else {
            this.btnAlertToggle.className = "btn btn-alert-off";
            this.btnAlertToggle.innerText = "Error Alerts: OFF";
            this.btnAlertToggle.title = "Error Alerts OFF: Runs in silent fallback mode without blocking banners";
        }
    }

    // --- REAL-TIME LIVE COMPILATION DETECTOR ---
    checkLiveLineCompile(force = false) {
        const val = this.codeEditor.value;
        const currentLine = val.substring(0, this.codeEditor.selectionStart).split('\n').length;

        if (force || currentLine !== this.lastCompiledLineCount) {
            this.lastCompiledLineCount = currentLine;
            
            if (this.liveCompileDebounceTimer) clearTimeout(this.liveCompileDebounceTimer);
            this.liveCompileDebounceTimer = setTimeout(() => {
                this.triggerLiveLineCompilation();
            }, 100);
        }
    }

    async triggerLiveLineCompilation() {
        const code = this.codeEditor.value;
        if (!code.trim()) return;

        this.markSaved();
        localStorage.setItem('rve_saved_code', code);

        if (this.isPyodideReady && this.pyodide) {
            try {
                this.timelineFrames = await this.executePyodide(code);
            } catch (err) {
                this.timelineFrames = this.compileCodeFallback(code);
            }
        } else {
            this.timelineFrames = this.compileCodeFallback(code);
        }

        this.timelineSlider.max = Math.max(0, this.timelineFrames.length - 1);
        const targetFrame = Math.max(0, this.timelineFrames.length - 1);
        this.seekToFrame(targetFrame);
        
        const status = document.getElementById('editor-status');
        status.innerText = `Real-time Live Compiled (${this.timelineFrames.length} Steps)`;
        status.style.color = '#10B981';
    }

    loadSavedCodeOnRefresh() {
        const savedCode = localStorage.getItem('rve_saved_code');
        if (savedCode !== null && savedCode.trim() !== '') {
            this.codeEditor.value = savedCode;
            this.updateLineNumbers();
            this.markSaved();
            this.printTerminal("[RVE Engine] Restored saved code from local storage.", "info");
            
            setTimeout(() => {
                this.triggerLiveLineCompilation();
            }, 300);
        } else {
            this.updateLineNumbers();
            this.markSaved();
        }
    }

    // --- GLOBAL HARDWARE KEYBOARD CONTROLS ---
    initGlobalHardwareKeyboardShortcuts() {
        window.addEventListener('keydown', (e) => {
            if (document.activeElement === this.codeEditor) return;

            if (e.code === 'Space') {
                e.preventDefault();
                this.togglePlay();
                return;
            }

            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                this.pause();
                this.step(-1);
                return;
            }

            if (e.key === 'ArrowRight') {
                e.preventDefault();
                this.pause();
                this.step(1);
                return;
            }

            if (e.key === 'Home' || (e.shiftKey && e.key === 'ArrowLeft')) {
                e.preventDefault();
                this.pause();
                this.seekToFrame(0);
                return;
            }

            if (e.key === 'End' || (e.shiftKey && e.key === 'ArrowRight')) {
                e.preventDefault();
                this.pause();
                this.seekToFrame(Math.max(0, this.timelineFrames.length - 1));
                return;
            }

            if (e.key === 'Escape') {
                e.preventDefault();
                this.closeInspector();
                return;
            }
        });
    }

    // --- MOUSE HARDWARE CANVAS CONTROLS ---
    initCanvasPanAndZoom() {
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        this.canvas.addEventListener('mousedown', (e) => {
            if (e.button === 0 || e.button === 1 || e.button === 2) {
                this.isPanning = true;
                this.startPanX = e.clientX - this.panX;
                this.startPanY = e.clientY - this.startPanY;
            }
        });

        window.addEventListener('mousemove', (e) => {
            if (this.isPanning) {
                this.panX = e.clientX - this.startPanX;
                this.panY = e.clientY - this.startPanY;
            }
        });

        window.addEventListener('mouseup', () => {
            if (this.isPanning) {
                this.isPanning = false;
            }
        });

        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
            const newScale = Math.min(Math.max(0.3, this.zoomScale * zoomFactor), 3.0);
            
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            this.panX = mouseX - (mouseX - this.panX) * (newScale / this.zoomScale);
            this.panY = mouseY - (mouseY - this.panY) * (newScale / this.zoomScale);
            this.zoomScale = newScale;

            this.updateZoomCounter();
        });

        this.canvas.addEventListener('dblclick', () => {
            this.resetView();
        });
    }

    // --- VS CODE KEYBOARD SHORTCUT HELPER METHODS ---
    toggleComment() {
        const start = this.codeEditor.selectionStart;
        const end = this.codeEditor.selectionEnd;
        const value = this.codeEditor.value;

        const startLineIdx = value.substring(0, start).split('\n').length - 1;
        const endLineIdx = value.substring(0, end).split('\n').length - 1;

        const lines = value.split('\n');
        let allCommented = true;
        for (let i = startLineIdx; i <= endLineIdx; i++) {
            if (!lines[i].trim().startsWith('#')) {
                allCommented = false;
                break;
            }
        }

        for (let i = startLineIdx; i <= endLineIdx; i++) {
            if (allCommented) {
                lines[i] = lines[i].replace(/^(\s*)#\s?/, '$1');
            } else {
                lines[i] = lines[i].replace(/^(\s*)/, '$1# ');
            }
        }

        this.codeEditor.value = lines.join('\n');
        this.updateLineNumbers();
        this.markUnsaved();
    }

    moveLine(dir) {
        const start = this.codeEditor.selectionStart;
        const value = this.codeEditor.value;
        const lines = value.split('\n');
        const lineIdx = value.substring(0, start).split('\n').length - 1;

        const targetIdx = dir === 'down' ? lineIdx + 1 : lineIdx - 1;
        if (targetIdx < 0 || targetIdx >= lines.length) return;

        const temp = lines[lineIdx];
        lines[lineIdx] = lines[targetIdx];
        lines[targetIdx] = temp;

        this.codeEditor.value = lines.join('\n');
        this.updateLineNumbers();
        this.markUnsaved();
        this.highlightLine(targetIdx + 1);
    }

    duplicateLine(dir) {
        const start = this.codeEditor.selectionStart;
        const value = this.codeEditor.value;
        const lines = value.split('\n');
        const lineIdx = value.substring(0, start).split('\n').length - 1;

        const currentLine = lines[lineIdx];
        if (dir === 'down') {
            lines.splice(lineIdx + 1, 0, currentLine);
        } else {
            lines.splice(lineIdx, 0, currentLine);
        }

        this.codeEditor.value = lines.join('\n');
        this.updateLineNumbers();
        this.markUnsaved();
    }

    deleteLine() {
        const start = this.codeEditor.selectionStart;
        const value = this.codeEditor.value;
        const lines = value.split('\n');
        const lineIdx = value.substring(0, start).split('\n').length - 1;

        lines.splice(lineIdx, 1);
        this.codeEditor.value = lines.join('\n');
        this.updateLineNumbers();
        this.markUnsaved();
    }

    handleTab(isShift) {
        const start = this.codeEditor.selectionStart;
        const end = this.codeEditor.selectionEnd;
        const value = this.codeEditor.value;

        if (start === end && !isShift) {
            this.codeEditor.value = value.substring(0, start) + "    " + value.substring(end);
            this.codeEditor.selectionStart = this.codeEditor.selectionEnd = start + 4;
        } else {
            const startLineIdx = value.substring(0, start).split('\n').length - 1;
            const endLineIdx = value.substring(0, end).split('\n').length - 1;
            const lines = value.split('\n');

            for (let i = startLineIdx; i <= endLineIdx; i++) {
                if (isShift) {
                    lines[i] = lines[i].replace(/^ {1,4}/, '');
                } else {
                    lines[i] = "    " + lines[i];
                }
            }
            this.codeEditor.value = lines.join('\n');
        }
        this.updateLineNumbers();
        this.markUnsaved();
    }

    initResizer() {
        const resizer = document.getElementById('drag-resizer');
        const leftPanel = document.getElementById('panel-editor');
        const rightPanel = document.getElementById('panel-visualizer');
        const workspace = document.getElementById('workspace-container');

        let isDragging = false;

        resizer.addEventListener('mousedown', () => {
            isDragging = true;
            resizer.classList.add('dragging');
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            const workspaceRect = workspace.getBoundingClientRect();
            const mouseX = e.clientX - workspaceRect.left;
            const totalWidth = workspaceRect.width;

            let leftPercent = (mouseX / totalWidth) * 100;
            if (leftPercent < 15) leftPercent = 15;
            if (leftPercent > 85) leftPercent = 85;

            leftPanel.style.width = `${leftPercent}%`;
            rightPanel.style.width = `calc(${100 - leftPercent}% - 6px)`;

            this.resizeCanvas();
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                resizer.classList.remove('dragging');
                document.body.style.cursor = 'default';
                document.body.style.userSelect = 'auto';
                this.resizeCanvas();
            }
        });
    }

    updateZoomCounter() {
        if (this.zoomCounter) {
            this.zoomCounter.innerText = `${Math.round(this.zoomScale * 100)}%`;
        }
    }

    resetView() {
        this.zoomScale = 1.0;
        this.panX = 0;
        this.panY = 0;
        this.updateZoomCounter();
        this.pause();
        this.seekToFrame(0);
        this.closeInspector();
    }

    markUnsaved() {
        this.isUnsaved = true;
        this.saveStatusTag.innerText = "Unsaved *";
        this.saveStatusTag.classList.add('unsaved');
    }

    markSaved() {
        this.isUnsaved = false;
        this.saveStatusTag.innerText = "Saved";
        this.saveStatusTag.classList.remove('unsaved');
    }

    saveCode() {
        this.markSaved();
        localStorage.setItem('rve_saved_code', this.codeEditor.value);
        this.printTerminal("[RVE Engine] Python code saved successfully.", "info");
        this.triggerLiveLineCompilation();
    }

    togglePlay() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.startPlayback();
        }
    }

    startPlayback() {
        if (this.currentFrameIndex >= this.timelineFrames.length - 1) {
            this.seekToFrame(0);
        }
        
        this.isPlaying = true;
        this.btnTimelinePlay.classList.add('paused');
        this.timelinePlayIcon.innerHTML = `<rect x="5" y="4" width="4" height="16"></rect><rect x="15" y="4" width="4" height="16"></rect>`;
        
        const speed = parseFloat(this.speedSelect.value) || 0.5;
        const delay = 300 / speed;

        if (this.playInterval) clearInterval(this.playInterval);
        
        this.playInterval = setInterval(() => {
            if (this.currentFrameIndex < this.timelineFrames.length - 1) {
                this.step(1);
            } else {
                this.pause();
            }
        }, delay);
    }

    pause() {
        this.isPlaying = false;
        if (this.playInterval) {
            clearInterval(this.playInterval);
            this.playInterval = null;
        }
        this.btnTimelinePlay.classList.remove('paused');
        this.timelinePlayIcon.innerHTML = `<polygon points="5 3 19 12 5 21 5 3"></polygon>`;
    }

    async initPyodide() {
        const status = document.getElementById('editor-status');
        const badge = document.getElementById('engine-badge');
        try {
            if (window.loadPyodide) {
                status.innerText = "Initializing Pyodide CPython 3.11 Engine...";
                this.pyodide = await window.loadPyodide();
                this.isPyodideReady = true;
                status.innerText = "Pyodide Wasm Engine Ready";
                status.style.color = "#10B981";
                badge.innerText = "CPython 3.11 Wasm Active";
                badge.style.color = "#10B981";
            }
        } catch (err) {
            console.warn("Pyodide failed to load from CDN. Using JS Fallback Engine:", err);
            status.innerText = "JS Engine Active (Offline)";
            badge.innerText = "JS Engine (Fallback)";
        }
    }

    resizeCanvas() {
        const container = document.getElementById('canvas-container');
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
    }

    updateLineNumbers() {
        const lines = this.codeEditor.value.split('\n').length;
        this.lineNumbers.innerHTML = Array.from({ length: lines }, (_, i) => `<span class="line-number" id="line-num-${i+1}">${i + 1}</span>`).join('');
    }

    highlightLine(lineNo, isError = false) {
        const activeLines = this.lineNumbers.querySelectorAll('.active-line-num');
        activeLines.forEach(el => {
            el.classList.remove('active-line-num');
            el.classList.remove('error');
        });

        if (!lineNo) {
            this.lineHighlightBar.style.display = 'none';
            return;
        }

        const targetLine = document.getElementById(`line-num-${lineNo}`);
        if (targetLine) {
            targetLine.classList.add('active-line-num');
            if (isError) targetLine.classList.add('error');
            
            const rowHeight = 20.8;
            const topOffset = 12 + (lineNo - 1) * rowHeight - this.codeEditor.scrollTop;
            
            this.lineHighlightBar.style.top = `${topOffset}px`;
            this.lineHighlightBar.style.display = 'block';

            if (isError) {
                this.lineHighlightBar.classList.add('error-bar');
            } else {
                this.lineHighlightBar.classList.remove('error-bar');
            }

            const editorHeight = this.codeEditor.clientHeight;
            const lineTop = targetLine.offsetTop - 12;
            if (lineTop < this.codeEditor.scrollTop || lineTop > this.codeEditor.scrollTop + editorHeight - 40) {
                this.codeEditor.scrollTop = lineTop - editorHeight / 2;
                this.lineNumbers.scrollTop = this.codeEditor.scrollTop;
            }
        }
    }

    loadPreset(presetKey) {
        this.codeEditor.value = PRESETS[presetKey] || '';
        this.updateLineNumbers();
        this.markSaved();
    }

    clearTerminal() {
        this.terminalOutput.innerHTML = '';
    }

    printTerminal(text, type = 'output') {
        if (!text) return;
        const div = document.createElement('div');
        div.className = `terminal-line ${type}`;
        div.innerText = text;
        this.terminalOutput.appendChild(div);
        this.terminalOutput.scrollTop = this.terminalOutput.scrollHeight;
    }

    // --- EXECUTION PIPELINE ---
    async runExecution(options = { autoPlay: false }) {
        const code = this.codeEditor.value;
        if (!code.trim()) {
            this.printTerminal("[RVE Engine] Code editor is empty. Please enter Python code.", "info");
            return;
        }

        this.clearTerminal();
        this.printTerminal("[RVE Engine] Initiating execution & scene graph trace...", "info");

        if (this.isPyodideReady && this.pyodide) {
            try {
                this.timelineFrames = await this.executePyodide(code);
            } catch (err) {
                this.printTerminal(`[CPython SyntaxError / RuntimeError]\n${err.message}`, "output");
                this.timelineFrames = this.compileCodeFallback(code);
            }
        } else {
            this.timelineFrames = this.compileCodeFallback(code);
        }
        
        this.timelineSlider.max = Math.max(0, this.timelineFrames.length - 1);
        this.timelineSlider.value = 0;
        this.seekToFrame(0);
        
        const status = document.getElementById('editor-status');
        status.innerText = `Executed ${this.timelineFrames.length} Steps`;
        status.style.color = '#10B981';

        if (options.autoPlay) {
            this.startPlayback();
        }
    }

    // --- CPYTHON INTROSPECTION WITH RULE CONFLICT & ERROR ALERTS INTERCEPTOR ---
    async executePyodide(userCode) {
        const runnerScript = `
import sys
import io
import json

sys.stdout = io.StringIO()
user_globals = {}
exec_exception = None

try:
    exec("""${userCode.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}""", user_globals)
except Exception as e:
    exec_exception = str(e)

stdout_output = sys.stdout.getvalue()

objects = []
seen_ids = set()
IMMUTABLE_TYPES = {'int', 'float', 'str', 'bool', 'tuple', 'frozenset', 'bytes', 'NoneType'}

def inspect_obj(obj, name=""):
    if obj is None or id(obj) in seen_ids:
        return None
    cls_name = type(obj).__name__
    if cls_name in ['int', 'str', 'float', 'bool', 'list', 'dict', 'set', 'tuple', 'frozenset', 'module', 'function', 'type']:
        return None
        
    seen_ids.add(id(obj))
    val = getattr(obj, 'data', getattr(obj, 'val', getattr(obj, 'value', getattr(obj, 'name', str(obj)))))
    next_obj = getattr(obj, 'next', None)
    left_obj = getattr(obj, 'left', None)
    right_obj = getattr(obj, 'right', None)
    manager_obj = getattr(obj, 'manager', None)
    
    obj_data = {
        "id": f"py_0x{id(obj):x}",
        "varName": name or cls_name,
        "label": str(val),
        "type": "TreeNode" if (left_obj or right_obj or 'Tree' in cls_name) else "Node",
        "pyType": cls_name,
        "pyId": f"0x{id(obj):x}",
        "isImmutable": cls_name in IMMUTABLE_TYPES,
        "next": f"py_0x{id(next_obj):x}" if next_obj else None,
        "left": f"py_0x{id(left_obj):x}" if left_obj else None,
        "right": f"py_0x{id(right_obj):x}" if right_obj else None,
        "manager": f"py_0x{id(manager_obj):x}" if manager_obj else None
    }
    objects.append(obj_data)
    
    if next_obj: inspect_obj(next_obj, f"{name}.next" if name else "")
    if left_obj: inspect_obj(left_obj, f"{name}.left" if name else "")
    if right_obj: inspect_obj(right_obj, f"{name}.right" if name else "")
    return obj_data["id"]

for k, v in list(user_globals.items()):
    if not k.startswith('__'):
        cls_name = type(v).__name__
        is_immut = cls_name in IMMUTABLE_TYPES
        
        if isinstance(v, (int, float, str, bool)) or v is None:
            objects.append({
                "id": f"prim_{k}",
                "varName": k,
                "label": f"{k} = {repr(v)}",
                "type": "Primitive",
                "pyType": cls_name,
                "pyId": f"0x{id(v):x}",
                "isImmutable": True,
                "color": "#F59E0B"
            })
        elif isinstance(v, tuple):
            for idx, item in enumerate(v[:50]):
                objects.append({
                    "id": f"tup_{k}_{idx}",
                    "varName": f"{k}[{idx}]",
                    "label": str(item),
                    "type": "DictBucket",
                    "pyType": "tuple",
                    "pyId": f"0x{id(v):x}",
                    "isImmutable": True,
                    "color": "#8B5CF6"
                })
        elif isinstance(v, list):
            for idx, item in enumerate(v[:50]):
                objects.append({
                    "id": f"arr_{k}_{idx}",
                    "varName": f"{k}[{idx}]",
                    "label": str(item),
                    "type": "ArrayCell",
                    "pyType": "list",
                    "pyId": f"0x{id(v):x}",
                    "isImmutable": False,
                    "color": "#6366F1"
                })
        elif isinstance(v, set):
            for idx, item in enumerate(sorted(list(v))[:50]):
                objects.append({
                    "id": f"set_{k}_{idx}",
                    "varName": f"{k}{{{item}}}",
                    "label": str(item),
                    "type": "DictBucket",
                    "pyType": "set",
                    "pyId": f"0x{id(v):x}",
                    "isImmutable": False,
                    "color": "#10B981"
                })
        elif isinstance(v, dict):
            idx = 0
            for dk, dv in list(v.items())[:20]:
                objects.append({
                    "id": f"dict_{k}_{idx}",
                    "varName": f"{k}['{dk}']",
                    "label": f"{dk}: {dv}",
                    "type": "DictBucket",
                    "pyType": "dict",
                    "pyId": f"0x{id(v):x}",
                    "isImmutable": False,
                    "color": "#EC4899"
                })
                idx += 1
        else:
            head = getattr(v, 'head', v)
            inspect_obj(head, k)

json.dumps({
    "stdout": stdout_output,
    "objects": objects,
    "error": exec_exception
})
`;

        const resultJsonStr = await this.pyodide.runPythonAsync(runnerScript);
        const res = JSON.parse(resultJsonStr);

        if (res.stdout) {
            this.printTerminal(res.stdout, "output");
        }

        // --- RULE CONFLICT & ERROR ALERT INTERCEPTOR ---
        if (res.error) {
            this.printTerminal(`[Rule Conflict / Exception] ${res.error}`, "output");

            if (this.errorAlertsEnabled) {
                this.actionBanner.classList.add('error-alert');
                this.actionLineBadge.innerText = "⚠️ Error";
                this.actionDescription.innerText = `Rule Conflict: ${res.error}`;
                this.highlightLine(this.lastCompiledLineCount, true);
            } else {
                this.actionBanner.classList.remove('error-alert');
            }
        } else {
            this.actionBanner.classList.remove('error-alert');
        }

        return this.compileCodeToTimeline(userCode, res.objects);
    }

    compileCodeFallback(code) {
        return this.compileCodeToTimeline(code);
    }

    compileCodeToTimeline(code, wasmObjects = null) {
        const lines = code.split('\n');
        const frames = [];
        let timestamp = 1000;

        const objects = new Map();
        let idCounter = 1;
        let inClassDef = false;

        lines.forEach((line, lineIndex) => {
            const lineNo = lineIndex + 1;
            const cleanLine = line.trim();
            if (!cleanLine || cleanLine.startsWith('#')) return;

            if (cleanLine.startsWith('class ') || cleanLine.startsWith('def ')) {
                inClassDef = true;
                return;
            }
            if (inClassDef && (line.startsWith('    ') || line.startsWith('\t'))) {
                return;
            }
            if (inClassDef && !line.startsWith(' ') && !line.startsWith('\t')) {
                inClassDef = false;
            }

            let changed = false;
            let actionDesc = `Executed line ${lineNo}: ${cleanLine}`;

            if (cleanLine.startsWith('if ') || cleanLine.startsWith('elif ') || cleanLine.startsWith('while ')) {
                actionDesc = `Evaluating Condition Statement: ${cleanLine}`;
                changed = true;
            }
            if (cleanLine.startsWith('print(')) {
                actionDesc = `Printed output to console: ${cleanLine}`;
                changed = true;
            }

            let currentEntities = [];
            if (wasmObjects && wasmObjects.length > 0) {
                currentEntities = this.solveLayoutConstraintsForObjects(wasmObjects);
                changed = true;
            } else {
                currentEntities = this.solveLayoutConstraintsForObjects(Array.from(objects.values()));
            }

            if (changed) {
                frames.push({
                    timestamp: timestamp += 50,
                    lineNumber: lineNo,
                    lineCode: cleanLine,
                    description: actionDesc,
                    entities: currentEntities
                });
            }
        });

        return frames.length > 0 ? frames : [{
            timestamp: 1000,
            lineNumber: 1,
            lineCode: "",
            description: "Initial Execution State",
            entities: []
        }];
    }

    // --- DYNAMIC MULTI-VARIABLE ROW SOLVER ---
    solveLayoutConstraintsForObjects(objects) {
        if (!objects || objects.length === 0) return [];

        const varGroups = new Map();

        objects.forEach(obj => {
            let groupKey = obj.varName ? obj.varName.split('[')[0].split('{')[0].split('.')[0] : obj.type;
            if (!varGroups.has(groupKey)) {
                varGroups.set(groupKey, []);
            }
            varGroups.get(groupKey).push(obj);
        });

        let currentY = 90;
        const startX = 100;

        varGroups.forEach((groupObjects, groupKey) => {
            if (groupObjects.length === 0) return;

            const firstType = groupObjects[0].type;

            if (firstType === "Primitive") {
                groupObjects.forEach((p, idx) => {
                    p.x = startX + (idx % 4) * 160;
                    p.y = currentY + Math.floor(idx / 4) * 50;
                });
                currentY += Math.ceil(groupObjects.length / 4) * 50 + 40;
            } else if (firstType === "ArrayCell" || firstType === "DictBucket") {
                groupObjects.forEach((cell, idx) => {
                    cell.x = startX + (idx % 10) * 70;
                    cell.y = currentY + Math.floor(idx / 10) * 65;
                });
                currentY += Math.ceil(groupObjects.length / 10) * 65 + 50;
            } else if (firstType === "TreeNode") {
                const root = groupObjects[0];
                const cx = (this.canvas.width / 2) || 350;
                root.x = cx;
                root.y = currentY + 30;

                const positionTree = (node, x, y, offset) => {
                    if (!node) return;
                    node.x = x;
                    node.y = y;
                    if (node.left) {
                        const leftNode = objects.find(o => o.id === node.left);
                        if (leftNode) { leftNode.color = "#EC4899"; positionTree(leftNode, x - offset, y + 75, offset / 1.8); }
                    }
                    if (node.right) {
                        const rightNode = objects.find(o => o.id === node.right);
                        if (rightNode) { rightNode.color = "#EC4899"; positionTree(rightNode, x + offset, y + 75, offset / 1.8); }
                    }
                };
                positionTree(root, cx, currentY + 30, 140);
                currentY += 220;
            } else { // Linked list / General Node
                groupObjects.forEach((node, idx) => {
                    node.x = startX + idx * 130;
                    node.y = currentY + 30;
                });
                currentY += 100;
            }
        });

        return objects;
    }

    seekToFrame(frameIndex) {
        if (frameIndex < 0 || frameIndex >= this.timelineFrames.length) return;
        this.currentFrameIndex = frameIndex;
        this.timelineSlider.value = frameIndex;
        
        const frame = this.timelineFrames[frameIndex];
        this.currentFrameLabel.innerText = `Frame: ${frameIndex + 1} / ${this.timelineFrames.length}`;
        this.currentTimestampLabel.innerText = `${frame.timestamp}ms`;
        
        if (!this.actionBanner.classList.contains('error-alert')) {
            this.actionLineBadge.innerText = `Line ${frame.lineNumber || 1}`;
            this.actionDescription.innerText = frame.description || "Executing...";
            this.highlightLine(frame.lineNumber);
        }

        this.entities.clear();
        frame.entities.forEach(e => {
            this.entities.set(e.id, { ...e });
        });
        
        this.entityCounter.innerText = this.entities.size;
        
        if (this.selectedEntityId && this.entities.has(this.selectedEntityId)) {
            this.showInspector(this.entities.get(this.selectedEntityId));
        }
    }

    step(direction) {
        this.seekToFrame(this.currentFrameIndex + direction);
    }

    // --- CANVAS RENDER ENGINE LOOP ---
    startRenderLoop() {
        const render = () => {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

            this.ctx.save();
            this.ctx.translate(this.panX, this.panY);
            this.ctx.scale(this.zoomScale, this.zoomScale);

            this.drawConnections();
            this.drawEntities();

            this.ctx.restore();

            requestAnimationFrame(render);
        };
        requestAnimationFrame(render);
    }

    drawConnections() {
        this.ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
        this.ctx.lineWidth = 2;

        const renderedEdges = new Set();

        this.entities.forEach(entity => {
            if (entity.next === entity.id) {
                this.drawSelfLoopArc(entity.x, entity.y);
                return;
            }

            if (entity.next && this.entities.has(entity.next)) {
                const edgeKey = `${entity.id}->${entity.next}`;
                if (!renderedEdges.has(edgeKey)) {
                    renderedEdges.add(edgeKey);
                    const target = this.entities.get(entity.next);
                    this.drawArrow(entity.x + 22, entity.y, target.x - 22, target.y);
                }
            }
            if (entity.left && this.entities.has(entity.left)) {
                const target = this.entities.get(entity.left);
                this.drawLine(entity.x - 12, entity.y + 18, target.x + 12, target.y - 18);
            }
            if (entity.right && this.entities.has(entity.right)) {
                const target = this.entities.get(entity.right);
                this.drawLine(entity.x + 12, entity.y + 18, target.x - 12, target.y - 18);
            }
            if (entity.manager && this.entities.has(entity.manager)) {
                const target = this.entities.get(entity.manager);
                this.drawArrow(entity.x, entity.y - 20, target.x, target.y + 20);
            }
        });
    }

    drawSelfLoopArc(x, y) {
        this.ctx.beginPath();
        this.ctx.arc(x, y - 24, 18, 0, Math.PI * 2);
        this.ctx.strokeStyle = "#EC4899";
        this.ctx.lineWidth = 2.5;
        this.ctx.stroke();

        this.ctx.fillStyle = "#EC4899";
        this.ctx.beginPath();
        this.ctx.moveTo(x + 16, y - 10);
        this.ctx.lineTo(x + 22, y - 20);
        this.ctx.lineTo(x + 10, y - 20);
        this.ctx.fill();
    }

    drawLine(x1, y1, x2, y2) {
        this.ctx.beginPath();
        this.ctx.moveTo(x1, y1);
        this.ctx.lineTo(x2, y2);
        this.ctx.stroke();
    }

    drawArrow(x1, y1, x2, y2) {
        this.drawLine(x1, y1, x2, y2);
        const headlen = 8;
        const angle = Math.atan2(y2 - y1, x2 - x1);
        this.ctx.beginPath();
        this.ctx.moveTo(x2, y2);
        this.ctx.lineTo(x2 - headlen * Math.cos(angle - Math.PI / 6), y2 - headlen * Math.sin(angle - Math.PI / 6));
        this.ctx.lineTo(x2 - headlen * Math.cos(angle + Math.PI / 6), y2 - headlen * Math.sin(angle + Math.PI / 6));
        this.ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
        this.ctx.fill();
    }

    drawEntities() {
        this.entities.forEach(entity => {
            const isSelected = entity.id === this.selectedEntityId;

            if (isSelected) {
                this.ctx.beginPath();
                this.ctx.arc(entity.x, entity.y, 30, 0, Math.PI * 2);
                this.ctx.fillStyle = "rgba(99, 102, 241, 0.25)";
                this.ctx.fill();
                this.ctx.strokeStyle = "#6366F1";
                this.ctx.lineWidth = 2.5;
                this.ctx.stroke();
            }

            if (entity.type === "Primitive") {
                this.ctx.fillStyle = "rgba(245, 158, 11, 0.15)";
                this.ctx.beginPath();
                this.ctx.roundRect(entity.x - 70, entity.y - 20, 140, 40, 8);
                this.ctx.fill();
                this.ctx.strokeStyle = "#F59E0B";
                this.ctx.lineWidth = 1.5;
                this.ctx.stroke();

                this.ctx.fillStyle = "#F59E0B";
                this.ctx.font = "600 10px Inter, sans-serif";
                this.ctx.textAlign = "right";
                this.ctx.fillText("🔒 Immutable", entity.x + 65, entity.y - 24);

                this.ctx.fillStyle = "#FFFFFF";
                this.ctx.font = "600 12px Fira Code, monospace";
                this.ctx.textAlign = "center";
                this.ctx.textBaseline = "middle";
                this.ctx.fillText(entity.label, entity.x, entity.y);
            } else if (entity.type === "DictBucket") {
                this.ctx.fillStyle = entity.color === "#10B981" ? "rgba(16, 185, 129, 0.18)" : (entity.color === "#8B5CF6" ? "rgba(139, 92, 246, 0.2)" : "rgba(236, 72, 153, 0.15)");
                this.ctx.beginPath();
                this.ctx.roundRect(entity.x - 30, entity.y - 20, 60, 40, 6);
                this.ctx.fill();
                this.ctx.strokeStyle = entity.color || "#EC4899";
                this.ctx.lineWidth = 1.5;
                this.ctx.stroke();

                if (entity.isImmutable) {
                    this.ctx.fillStyle = "#8B5CF6";
                    this.ctx.font = "600 10px Inter, sans-serif";
                    this.ctx.textAlign = "center";
                    this.ctx.fillText("🔒 Tuple", entity.x, entity.y - 24);
                }

                this.ctx.fillStyle = "#FFFFFF";
                this.ctx.font = "600 12px Fira Code, monospace";
                this.ctx.textAlign = "center";
                this.ctx.textBaseline = "middle";
                this.ctx.fillText(entity.label, entity.x, entity.y);
            } else if (entity.type === "ArrayCell") {
                this.ctx.fillStyle = entity.color || "#6366F1";
                this.ctx.fillRect(entity.x - 25, entity.y - 25, 50, 50);
                this.ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
                this.ctx.lineWidth = 2;
                this.ctx.strokeRect(entity.x - 25, entity.y - 25, 50, 50);

                if (entity.pointerLabel) {
                    const badgeY = entity.y - 42;
                    const badgeWidth = 32;
                    const badgeHeight = 20;

                    this.ctx.shadowColor = entity.color;
                    this.ctx.shadowBlur = 10;

                    this.ctx.fillStyle = entity.color;
                    this.ctx.beginPath();
                    this.ctx.roundRect(entity.x - badgeWidth / 2, badgeY - badgeHeight / 2, badgeWidth, badgeHeight, 6);
                    this.ctx.fill();

                    this.ctx.shadowBlur = 0;

                    this.ctx.fillStyle = "#000000";
                    this.ctx.font = "700 12px Fira Code, monospace";
                    this.ctx.textAlign = "center";
                    this.ctx.textBaseline = "middle";
                    this.ctx.fillText(entity.pointerLabel, entity.x, badgeY);

                    this.ctx.beginPath();
                    this.ctx.moveTo(entity.x - 6, badgeY + 10);
                    this.ctx.lineTo(entity.x + 6, badgeY + 10);
                    this.ctx.lineTo(entity.x, badgeY + 17);
                    this.ctx.fillStyle = entity.color;
                    this.ctx.fill();
                }

                this.ctx.fillStyle = "#FFFFFF";
                this.ctx.font = "600 13px Inter, sans-serif";
                this.ctx.textAlign = "center";
                this.ctx.textBaseline = "middle";
                this.ctx.fillText(entity.label, entity.x, entity.y);
            } else {
                this.ctx.beginPath();
                this.ctx.arc(entity.x, entity.y, 22, 0, Math.PI * 2);
                this.ctx.fillStyle = entity.color || "#6366F1";
                this.ctx.fill();
                this.ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
                this.ctx.lineWidth = 2;
                this.ctx.stroke();

                if (entity.pointerLabel) {
                    const badgeY = entity.y - 36;
                    const badgeWidth = 36;
                    const badgeHeight = 18;

                    this.ctx.fillStyle = entity.color;
                    this.ctx.beginPath();
                    this.ctx.roundRect(entity.x - badgeWidth / 2, badgeY - badgeHeight / 2, badgeWidth, badgeHeight, 5);
                    this.ctx.fill();

                    this.ctx.fillStyle = "#000000";
                    this.ctx.font = "700 11px Fira Code, monospace";
                    this.ctx.textAlign = "center";
                    this.ctx.textBaseline = "middle";
                    this.ctx.fillText(entity.pointerLabel, entity.x, badgeY);
                }

                this.ctx.fillStyle = "#FFFFFF";
                this.ctx.font = "600 13px Inter, sans-serif";
                this.ctx.textAlign = "center";
                this.ctx.textBaseline = "middle";
                this.ctx.fillText(entity.label, entity.x, entity.y);
            }
        });
    }

    // --- DEVTOOLS INSPECTOR OVERLAY ---
    handleCanvasClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const rawMouseX = e.clientX - rect.left;
        const rawMouseY = e.clientY - rect.top;

        const mouseX = (rawMouseX - this.panX) / this.zoomScale;
        const mouseY = (rawMouseY - this.panY) / this.zoomScale;

        let clickedEntity = null;
        this.entities.forEach(entity => {
            const dist = Math.hypot(entity.x - mouseX, entity.y - mouseY);
            if (dist <= 25) {
                clickedEntity = entity;
            }
        });

        if (clickedEntity) {
            this.selectedEntityId = clickedEntity.id;
            this.showInspector(clickedEntity);
        } else {
            this.closeInspector();
        }
    }

    showInspector(entity) {
        this.inspectorPanel.style.display = 'flex';
        const mutabilityHtml = entity.isImmutable 
            ? `<span class="inspect-val" style="color: #F59E0B; font-weight: 700;">Immutable (Read-Only) 🔒</span>` 
            : `<span class="inspect-val" style="color: #10B981; font-weight: 700;">Mutable (In-Place Modifications) ⚡</span>`;

        this.inspectorContent.innerHTML = `
            <div class="inspect-item">
                <span class="inspect-label">Entity ID</span>
                <span class="inspect-val">${entity.id}</span>
            </div>
            <div class="inspect-item">
                <span class="inspect-label">Variable Name</span>
                <span class="inspect-val">${entity.varName}</span>
            </div>
            <div class="inspect-item">
                <span class="inspect-label">Python Class</span>
                <span class="inspect-val">${entity.pyType}</span>
            </div>
            <div class="inspect-item">
                <span class="inspect-label">CPython Pointer</span>
                <span class="inspect-val">${entity.pyId}</span>
            </div>
            <div class="inspect-item">
                <span class="inspect-label">Mutability Property</span>
                ${mutabilityHtml}
            </div>
            <div class="inspect-item">
                <span class="inspect-label">Transform (Canvas X, Y)</span>
                <span class="inspect-val">(${Math.round(entity.x)}, ${Math.round(entity.y)})</span>
            </div>
            <div class="inspect-item">
                <span class="inspect-label">Value / Label</span>
                <span class="inspect-val">${entity.label}</span>
            </div>
        `;
    }

    closeInspector() {
        this.selectedEntityId = null;
        this.inspectorPanel.style.display = 'none';
    }
}

window.addEventListener('DOMContentLoaded', () => {
    new RVEApplication();
});
