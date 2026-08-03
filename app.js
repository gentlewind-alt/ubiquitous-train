// --- RVE WEB APPLICATION CORE ENGINE (REINGOLD-TILFORD TREE LAYOUT & AVL SEMANTICS) ---

const PRESETS = {
    none: "",
    filesystem: `class Folder:
    def __init__(self, name):
        self.name = name
        self.children = []

user = Folder("User")
home = Folder("Home")
user.children.append(home)

docs = Folder("Documents")
pics = Folder("Pictures")
proj = Folder("Projects")
home.children.extend([docs, pics, proj])

rve = Folder("RVE Engine")
proj.children.append(rve)

src = Folder("src")
assets = Folder("assets")
docs_folder = Folder("docs")
rve.children.extend([src, assets, docs_folder])
`,
    orgchart: `class Employee:
    def __init__(self, name, title):
        self.name = name
        self.title = title
        self.reports = []

ceo = Employee("Alice", "CEO")
vp_eng = Employee("Bob", "VP Eng")
vp_sales = Employee("Carol", "VP Sales")
ceo.reports.extend([vp_eng, vp_sales])

lead1 = Employee("Dave", "Tech Lead")
lead2 = Employee("Eve", "Tech Lead")
vp_eng.reports.extend([lead1, lead2])

dev1 = Employee("Frank", "Senior Dev")
dev2 = Employee("Grace", "Dev")
lead1.reports.extend([dev1, dev2])
`,
    avl: `class Node:
    def __init__(self, key):
        self.key = key
        self.left = None
        self.right = None
        self.height = 1

root = Node(50)
root.left = Node(30)
root.right = Node(70)
root.left.left = Node(20)
root.left.right = Node(40)
`
};

// --- GRAPH DIFF ENGINE (IU-2) ---
class GraphDiffEngine {
    static diff(prevObjects = [], currObjects = []) {
        const prevMap = new Map(prevObjects.map(o => [o.id, o]));
        const currMap = new Map(currObjects.map(o => [o.id, o]));
        const mutations = [];

        currObjects.forEach(curr => {
            if (!prevMap.has(curr.id)) {
                mutations.push({ type: "NodeAdded", targetId: curr.id, entity: curr });
            } else {
                const prev = prevMap.get(curr.id);
                if (prev.label !== curr.label) {
                    mutations.push({ type: "ValueChanged", targetId: curr.id, oldVal: prev.label, newVal: curr.label, entity: curr });
                }
            }
        });

        prevObjects.forEach(prev => {
            if (!currMap.has(prev.id)) {
                mutations.push({ type: "NodeRemoved", targetId: prev.id });
            }
        });

        const extractEdges = (objs) => {
            const edges = new Set();
            objs.forEach(o => {
                if (o.children && Array.isArray(o.children)) {
                    o.children.forEach(cId => edges.add(`${o.id}->${cId}`));
                }
                if (o.left) edges.add(`${o.id}->${o.left}`);
                if (o.right) edges.add(`${o.id}->${o.right}`);
                if (o.next) edges.add(`${o.id}->${o.next}`);
            });
            return edges;
        };

        const prevEdges = extractEdges(prevObjects);
        const currEdges = extractEdges(currObjects);

        currEdges.forEach(edgeStr => {
            if (!prevEdges.has(edgeStr)) {
                const [parentId, childId] = edgeStr.split('->');
                mutations.push({ type: "EdgeAdded", parentId, childId, targetId: childId });
            }
        });

        prevEdges.forEach(edgeStr => {
            if (!currEdges.has(edgeStr)) {
                const [parentId, childId] = edgeStr.split('->');
                mutations.push({ type: "EdgeRemoved", parentId, childId, targetId: childId });
            }
        });

        return mutations;
    }
}

class RVEApplication {
    constructor() {
        this.codeEditor = document.getElementById('code-editor');
        this.lineNumbers = document.getElementById('line-numbers');
        this.lineHighlightBar = document.getElementById('line-highlight-bar');
        this.canvas = document.getElementById('visualizer-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        this.speedSelect = document.getElementById('speed-select');
        this.cameraSelect = document.getElementById('camera-mode-select');
        this.metaSelect = document.getElementById('meta-mode-select');

        this.cameraMode = "follow"; // "follow" | "fit" | "selected"
        this.metaMode = "learning"; // "learning" | "presentation" | "debug"
        this.targetPanX = 0;
        this.targetPanY = 0;
        this.targetZoomScale = 1.0;
        this.isUserDraggingCamera = false;
        this.animProgress = 1.0;
        this.prevNodePositions = new Map();
        
        this.btnAutosaveToggle = document.getElementById('btn-autosave-toggle');
        this.btnSave = document.getElementById('btn-save');
        this.btnRun = document.getElementById('btn-run');
        this.btnStepPrev = document.getElementById('btn-step-prev');
        this.btnStepNext = document.getElementById('btn-step-next');
        this.btnReset = document.getElementById('btn-reset');

        this.btnTimelinePlay = document.getElementById('btn-timeline-play');
        this.timelinePlayIcon = document.getElementById('timeline-play-icon');
        
        this.saveStatusTag = document.getElementById('save-status-tag');
        this.btnCollapsePanel = document.getElementById('btn-collapse-panel');
        this.btnExpandPanel = document.getElementById('btn-expand-panel');
        this.panelEditor = document.getElementById('panel-editor');
        this.dragResizer = document.getElementById('drag-resizer');
        
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

        // Auto Save Toggle State
        const savedAutoSaveState = localStorage.getItem('rve_autosave_mode');
        this.autoSaveEnabled = savedAutoSaveState !== null ? JSON.parse(savedAutoSaveState) : true;
        this.isPanelCollapsed = false;

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
        this.updateAutoSaveUI();
        window.addEventListener('resize', () => this.resizeCanvas());

        this.btnAutosaveToggle.addEventListener('click', () => this.toggleAutoSave());
        this.btnCollapsePanel.addEventListener('click', () => this.toggleEditorPanel());
        this.btnExpandPanel.addEventListener('click', () => this.toggleEditorPanel());

        if (this.cameraSelect) {
            this.cameraSelect.addEventListener('change', (e) => {
                this.cameraMode = e.target.value;
                this.isUserDraggingCamera = false;
                if (this.currentFrameIndex >= 0 && this.timelineFrames[this.currentFrameIndex]) {
                    this.updateCameraTargetForFrame(this.timelineFrames[this.currentFrameIndex]);
                }
            });
        }

        if (this.metaSelect) {
            this.metaSelect.addEventListener('change', (e) => {
                this.metaMode = e.target.value;
            });
        }

        // Line Numbers Scroll Synchronization
        this.codeEditor.addEventListener('scroll', () => {
            this.lineNumbers.scrollTop = this.codeEditor.scrollTop;
            this.updateLineHighlightBar();
        });

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

    // --- AUTO SAVE TOGGLE STATE MANAGEMENT ---
    toggleAutoSave() {
        this.autoSaveEnabled = !this.autoSaveEnabled;
        localStorage.setItem('rve_autosave_mode', JSON.stringify(this.autoSaveEnabled));
        this.updateAutoSaveUI();
        if (this.autoSaveEnabled) {
            // Immediately save on re-enable
            this.triggerLiveLineCompilation();
        }
    }

    updateAutoSaveUI() {
        if (this.autoSaveEnabled) {
            this.btnAutosaveToggle.className = "btn btn-autosave-on";
            this.btnAutosaveToggle.innerText = "Auto Save: ON";
            this.btnAutosaveToggle.title = "Auto Save ON: Code is saved to localStorage on every line change";
        } else {
            this.btnAutosaveToggle.className = "btn btn-autosave-off";
            this.btnAutosaveToggle.innerText = "Auto Save: OFF";
            this.btnAutosaveToggle.title = "Auto Save OFF: Only saves when you press Ctrl+S or the Save button";
        }
    }

    // --- EDITOR PANEL COLLAPSE / EXPAND ---
    toggleEditorPanel() {
        this.isPanelCollapsed = !this.isPanelCollapsed;
        if (this.isPanelCollapsed) {
            // Store current width so we can restore it on expand
            this.savedPanelWidth = this.panelEditor.style.width || '40%';
            this.panelEditor.classList.add('panel-collapsed');
            this.dragResizer.classList.add('panel-collapsed');
            this.btnExpandPanel.style.display = 'inline-flex';
        } else {
            this.panelEditor.classList.remove('panel-collapsed');
            this.dragResizer.classList.remove('panel-collapsed');
            this.btnExpandPanel.style.display = 'none';
            // Restore saved panel width if it was set by resizer
            if (this.savedPanelWidth) {
                this.panelEditor.style.width = this.savedPanelWidth;
            }
        }
        // Trigger canvas resize after animation completes
        setTimeout(() => this.resizeCanvas(), 320);
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

        // Safety Guard: Pause live-compile for large stress test inputs (>15,000 chars or >250 lines)
        if (code.length > 15000 || code.split('\n').length > 250) {
            this.printTerminal("[RVE Engine] Large script detected. Live compile paused. Press Ctrl+Enter or click 'Run' to execute.", "info");
            return;
        }

        if (this.autoSaveEnabled) {
            this.markSaved();
            localStorage.setItem('rve_saved_code', code);
        }

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
        // Disabled automatic code restoration from localStorage on refresh to prevent non-responsiveness on large scripts
        localStorage.removeItem('rve_saved_code');
        this.updateLineNumbers();
        this.markSaved();
        this.printTerminal("[RVE Engine] Editor ready. Auto-restore on refresh is disabled.", "info");
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
                this.startPanY = e.clientY - this.panY;
            }
        });

        window.addEventListener('mousemove', (e) => {
            if (this.isPanning) {
                this.panX = e.clientX - this.startPanX;
                this.panY = e.clientY - this.startPanY;
                this.isUserDraggingCamera = true;
            }
        });

        window.addEventListener('mouseup', () => {
            if (this.isPanning) {
                this.isPanning = false;
            }
        });

        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.isUserDraggingCamera = true;
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
        this.isUserDraggingCamera = false;
        this.zoomScale = 1.0;
        this.panX = 0;
        this.panY = 0;
        this.updateZoomCounter();
        this.pause();
        if (this.timelineFrames.length > 0) {
            this.seekToFrame(0);
        }
        this.closeInspector();
    }

    markUnsaved() {
        this.isUnsaved = true;
        if (!this.autoSaveEnabled) {
            this.saveStatusTag.innerText = "Unsaved · Ctrl+S";
        } else {
            this.saveStatusTag.innerText = "Unsaved *";
        }
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
        this.lineNumbers.scrollTop = this.codeEditor.scrollTop;
    }

    updateLineHighlightBar() {
        if (!this.currentActiveLineNo) return;
        const targetLine = document.getElementById(`line-num-${this.currentActiveLineNo}`);
        if (targetLine) {
            const rowHeight = 20.8;
            const topOffset = 12 + (this.currentActiveLineNo - 1) * rowHeight - this.codeEditor.scrollTop;
            this.lineHighlightBar.style.top = `${topOffset}px`;
            this.lineHighlightBar.style.display = 'block';
        }
    }

    highlightLine(lineNo, isError = false) {
        this.currentActiveLineNo = lineNo;
        this.isCurrentLineError = isError;

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
            
            this.updateLineHighlightBar();

            if (isError) {
                this.lineHighlightBar.classList.add('error-bar');
            } else {
                this.lineHighlightBar.classList.remove('error-bar');
            }

            const rowHeight = 20.8;
            const lineTop = (lineNo - 1) * rowHeight;
            const editorHeight = this.codeEditor.clientHeight || 300;
            const targetScroll = Math.max(0, lineTop - editorHeight / 2 + 15);
            
            this.codeEditor.scrollTo({ top: targetScroll, behavior: 'smooth' });
            this.lineNumbers.scrollTop = this.codeEditor.scrollTop;
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

    // --- CPYTHON INTROSPECTION WITH AVL SEMANTICS & LINE-BY-LINE TRACE SNAPSHOTS ---
    async executePyodide(userCode) {
        const runnerScript = `
import sys
import io
import json

sys.stdout = io.StringIO()
user_globals = {}
exec_exception = None
line_snapshots = []
IMMUTABLE_TYPES = {'int', 'float', 'str', 'bool', 'tuple', 'frozenset', 'bytes', 'NoneType'}

def get_node_height(node):
    if not node or callable(node): return 0
    h_attr = getattr(node, 'height', None)
    if isinstance(h_attr, (int, float)):
        return int(h_attr)
    lh = get_node_height(getattr(node, 'left', None))
    rh = get_node_height(getattr(node, 'right', None))
    return max(lh, rh) + 1

def capture_snapshot(line_no):
    objects = []
    seen_ids = set()

    def inspect_obj(obj, name=""):
        if obj is None or id(obj) in seen_ids or callable(obj):
            return None
        cls_name = type(obj).__name__
        if cls_name in ['int', 'str', 'float', 'bool', 'list', 'dict', 'set', 'tuple', 'frozenset', 'module', 'function', 'type']:
            return None
            
        seen_ids.add(id(obj))
        val = getattr(obj, 'key', getattr(obj, 'data', getattr(obj, 'val', getattr(obj, 'value', getattr(obj, 'name', str(obj))))))
        if callable(val):
            val = str(obj)
        next_obj = getattr(obj, 'next', None)
        left_obj = getattr(obj, 'left', None)
        right_obj = getattr(obj, 'right', None)
        manager_obj = getattr(obj, 'manager', None)
        
        if callable(next_obj): next_obj = None
        if callable(left_obj): left_obj = None
        if callable(right_obj): right_obj = None
        if callable(manager_obj): manager_obj = None

        lh = get_node_height(left_obj)
        rh = get_node_height(right_obj)
        h_attr = getattr(obj, 'height', None)
        h = int(h_attr) if isinstance(h_attr, (int, float)) else (max(lh, rh) + 1)
        bf = int(lh - rh)

        slots_data = []
        child_objs_to_inspect = []

        attrs = {}
        if hasattr(obj, '__dict__'):
            attrs.update(obj.__dict__)
        elif hasattr(obj, '__slots__'):
            for s in getattr(obj, '__slots__'):
                if hasattr(obj, s):
                    attrs[s] = getattr(obj, s)

        for attr_name, attr_val in list(attrs.items())[:20]:
            if attr_name.startswith('__') or callable(attr_val):
                continue
            if isinstance(attr_val, list):
                list_refs = []
                for item in attr_val:
                    if item is not None and not callable(item) and not isinstance(item, (int, float, str, bool, dict, tuple, set)):
                        list_refs.append(f"py_0x{id(item):x}")
                        child_objs_to_inspect.append((item, f"{name}.{attr_name}" if name else attr_name))
                slots_data.append({
                    "attr": attr_name,
                    "ref": None,
                    "isList": True,
                    "listRefs": list_refs
                })
            elif attr_val is not None and not callable(attr_val) and not isinstance(attr_val, (int, float, str, bool, dict, tuple, set)):
                slots_data.append({
                    "attr": attr_name,
                    "ref": f"py_0x{id(attr_val):x}",
                    "isList": False,
                    "listRefs": []
                })
                child_objs_to_inspect.append((attr_val, f"{name}.{attr_name}" if name else attr_name))
            else:
                slots_data.append({
                    "attr": attr_name,
                    "ref": None,
                    "scalar": str(attr_val) if attr_val is not None else None,
                    "isList": False,
                    "listRefs": []
                })

        obj_data = {
            "id": f"py_0x{id(obj):x}",
            "varName": name or cls_name,
            "label": str(val),
            "type": "TreeNode" if (left_obj or right_obj or 'Tree' in cls_name or hasattr(obj, 'key')) else ("ClassObject" if (hasattr(obj, '__dict__') or hasattr(obj, '__slots__')) else "Node"),
            "pyType": cls_name,
            "pyId": f"0x{id(obj):x}",
            "height": h,
            "balanceFactor": bf,
            "isImmutable": cls_name in IMMUTABLE_TYPES,
            "next": f"py_0x{id(next_obj):x}" if next_obj else None,
            "left": f"py_0x{id(left_obj):x}" if left_obj else None,
            "right": f"py_0x{id(right_obj):x}" if right_obj else None,
            "manager": f"py_0x{id(manager_obj):x}" if manager_obj else None,
            "slots": slots_data
        }
        objects.append(obj_data)
        
        if next_obj: inspect_obj(next_obj, f"{name}.next" if name else "")
        if left_obj: inspect_obj(left_obj, f"{name}.left" if name else "")
        if right_obj: inspect_obj(right_obj, f"{name}.right" if name else "")
        for child_item, child_name in child_objs_to_inspect:
            inspect_obj(child_item, child_name)

        return obj_data["id"]

    def inspect_compound(val, name="", depth=0):
        if val is None or callable(val) or depth > 6:
            return None
            
        cls_name = type(val).__name__
        val_id = f"py_0x{id(val):x}"
        
        if id(val) in seen_ids:
            return val_id
            
        if isinstance(val, dict):
            seen_ids.add(id(val))
            entries = []
            for dk, dv in list(val.items())[:20]:
                is_comp = isinstance(dv, (dict, list, tuple, set)) or (hasattr(dv, '__dict__') and not callable(dv))
                if is_comp and dv is not None and not isinstance(dv, (int, float, str, bool)):
                    child_id = inspect_compound(dv, f"{name}['{dk}']" if name else str(dk), depth + 1)
                    entries.append({
                        "key": str(dk),
                        "ref": child_id or f"py_0x{id(dv):x}",
                        "val": None,
                        "isCompound": True
                    })
                else:
                    entries.append({
                        "key": str(dk),
                        "ref": None,
                        "val": repr(dv) if isinstance(dv, str) else str(dv),
                        "isCompound": False
                    })
            objects.append({
                "id": val_id,
                "varName": name or "dict",
                "label": name or "dict",
                "type": "DictContainer",
                "pyType": "dict",
                "pyId": f"0x{id(val):x}",
                "entries": entries,
                "color": "#EC4899"
            })
            return val_id
        elif isinstance(val, list):
            seen_ids.add(id(val))
            elements = []
            for idx, elem in enumerate(val[:20]):
                is_c = isinstance(elem, (dict, list, tuple, set)) or (hasattr(elem, '__dict__') and not callable(elem))
                if is_c and elem is not None and not isinstance(elem, (int, float, str, bool)):
                    child_id = inspect_compound(elem, f"{name}[{idx}]" if name else f"[{idx}]", depth + 1)
                    elements.append({
                        "index": idx,
                        "ref": child_id or f"py_0x{id(elem):x}",
                        "val": None,
                        "isCompound": True
                    })
                else:
                    elements.append({
                        "index": idx,
                        "ref": None,
                        "val": repr(elem) if isinstance(elem, str) else str(elem),
                        "isCompound": False
                    })
            objects.append({
                "id": val_id,
                "varName": name or "list",
                "label": name or "list",
                "type": "ListContainer",
                "pyType": "list",
                "pyId": f"0x{id(val):x}",
                "elements": elements,
                "color": "#6366F1"
            })
            return val_id
        elif hasattr(val, '__dict__') or hasattr(val, '__slots__'):
            return inspect_obj(val, name)
        return None

    for k, v in list(user_globals.items()):
        if not k.startswith('__') and not callable(v) and not isinstance(v, type):
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
                objects.append({
                    "id": f"tup_{k}",
                    "varName": k,
                    "type": "TupleContainer",
                    "pyType": "tuple",
                    "pyId": f"0x{id(v):x}",
                    "isImmutable": True,
                    "color": "#8B5CF6",
                    "elements": [repr(item) if isinstance(item, str) else str(item) for item in v[:20]]
                })
            elif isinstance(v, list):
                # Detect 2D Rectangular Matrix (nested list of equal length containing primitive values)
                is_2d_matrix = (
                    len(v) > 0 and 
                    all(isinstance(row, list) for row in v) and
                    all(len(row) == len(v[0]) for row in v) and
                    len(v[0]) > 0 and
                    all(isinstance(val, (int, float, str, bool)) or val is None for row in v for val in (row[:20] if isinstance(row, list) else []))
                )
                
                has_compound = any(isinstance(item, (dict, list, tuple, set)) or (hasattr(item, '__dict__') and not callable(item)) for item in v[:20])
                
                if is_2d_matrix:
                    rows = len(v)
                    cols = len(v[0])
                    grid_data = []
                    for r_idx, row in enumerate(v[:20]):
                        row_vals = []
                        for c_idx, val in enumerate(row[:20]):
                            row_vals.append({
                                "r": r_idx,
                                "c": c_idx,
                                "val": repr(val) if isinstance(val, str) else str(val),
                                "varName": f"{k}[{r_idx}][{c_idx}]"
                            })
                        grid_data.append(row_vals)
                    
                    objects.append({
                        "id": f"matrix_{k}",
                        "varName": k,
                        "label": f"{k} ({rows}x{cols})",
                        "type": "MatrixGrid",
                        "pyType": "2D List Matrix",
                        "pyId": f"0x{id(v):x}",
                        "rows": rows,
                        "cols": cols,
                        "data": grid_data,
                        "color": "#6366F1"
                    })
                elif has_compound:
                    inspect_compound(v, k)
                else:
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
                has_compound = any(isinstance(dv, (dict, list, tuple, set)) or (hasattr(dv, '__dict__') and not callable(dv)) for dv in v.values())
                if has_compound:
                    inspect_compound(v, k)
                else:
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
                head = getattr(v, 'root', getattr(v, 'head', v))
                target_id = inspect_obj(head, k)
                if target_id and isinstance(target_id, str):
                    objects.append({
                        "id": f"var_{k}",
                        "varName": k,
                        "type": "VariableRef",
                        "label": k,
                        "targetId": target_id
                    })

    line_snapshots.append({
        "line": line_no,
        "objects": objects
    })

def trace_func(frame, event, arg):
    if event == 'line' and len(line_snapshots) < 150:
        capture_snapshot(frame.f_lineno)
    return trace_func

sys.settrace(trace_func)
try:
    exec("""${userCode.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}""", user_globals)
except Exception as e:
    exec_exception = str(e)
finally:
    sys.settrace(None)

stdout_output = sys.stdout.getvalue()

json.dumps({
    "stdout": stdout_output,
    "snapshots": line_snapshots,
    "error": exec_exception
})
`;

        const resultJsonStr = await this.pyodide.runPythonAsync(runnerScript);
        const res = JSON.parse(resultJsonStr);

        if (res.stdout) {
            this.printTerminal(res.stdout, "output");
        }

        if (res.error) {
            this.printTerminal(`[Runtime Exception] ${res.error}`, "output");
            this.actionBanner.classList.add('error-alert');
            this.actionLineBadge.innerText = "⚠️ Error";
            this.actionDescription.innerText = `Exception: ${res.error}`;
        } else {
            this.actionBanner.classList.remove('error-alert');
        }

        return this.compileCodeToTimeline(userCode, res.snapshots);
    }

    compileCodeFallback(code) {
        return this.compileCodeToTimeline(code);
    }

    // --- OPERATION DETECTOR (IU-3) ---
    detectSemanticEvent(mutations, lineCode) {
        if (!mutations || mutations.length === 0) {
            return { type: "Step", targetId: null, animationType: "None", description: lineCode || "Executing step..." };
        }

        const edgeAdded = mutations.find(m => m.type === "EdgeAdded");
        const edgeRemoved = mutations.find(m => m.type === "EdgeRemoved");
        const valChanged = mutations.find(m => m.type === "ValueChanged");
        const nodeAdded = mutations.find(m => m.type === "NodeAdded");

        if (edgeAdded) {
            return {
                type: "AppendChild",
                parentId: edgeAdded.parentId,
                targetId: edgeAdded.childId,
                cameraFocusId: edgeAdded.parentId,
                animationType: "SlideIn",
                description: lineCode ? `Executed: ${lineCode}` : `Appended child to ${edgeAdded.parentId}`
            };
        } else if (edgeRemoved) {
            return {
                type: "RemoveChild",
                parentId: edgeRemoved.parentId,
                targetId: edgeRemoved.childId,
                cameraFocusId: edgeRemoved.parentId,
                animationType: "FadeOut",
                description: lineCode ? `Executed: ${lineCode}` : `Removed child from ${edgeRemoved.parentId}`
            };
        } else if (valChanged) {
            return {
                type: "UpdateValue",
                targetId: valChanged.targetId,
                cameraFocusId: valChanged.targetId,
                animationType: "Pulse",
                description: lineCode ? `Executed: ${lineCode}` : `Updated value to ${valChanged.newVal}`
            };
        } else if (nodeAdded) {
            return {
                type: "CreateNode",
                targetId: nodeAdded.targetId,
                cameraFocusId: nodeAdded.targetId,
                animationType: "SlideIn",
                description: lineCode ? `Executed: ${lineCode}` : `Created node ${nodeAdded.targetId}`
            };
        }

        return {
            type: "Step",
            targetId: mutations[0]?.targetId || null,
            cameraFocusId: mutations[0]?.targetId || null,
            animationType: "Pulse",
            description: lineCode || "Executing step..."
        };
    }

    compileCodeToTimeline(code, snapshots = null) {
        const lines = code.split('\n');
        const frames = [];
        let timestamp = 1000;
        let prevEntities = [];

        if (snapshots && snapshots.length > 0) {
            snapshots.forEach((snap) => {
                const lineNo = snap.line;
                const lineCode = lines[lineNo - 1] ? lines[lineNo - 1].trim() : `Line ${lineNo}`;
                if (!lineCode || lineCode.startsWith('#')) return;

                const currentEntities = this.solveLayoutConstraintsForObjects(snap.objects);
                const mutations = GraphDiffEngine.diff(prevEntities, currentEntities);
                const event = this.detectSemanticEvent(mutations, lineCode);

                frames.push({
                    timestamp: timestamp += 50,
                    lineNumber: lineNo,
                    lineCode: lineCode,
                    description: event.description,
                    entities: currentEntities,
                    mutations: mutations,
                    event: event
                });
                prevEntities = currentEntities;
            });
        } else {
            let accumulatedObjects = [];
            lines.forEach((line, lineIndex) => {
                const lineNo = lineIndex + 1;
                const cleanLine = line.trim();
                if (!cleanLine || cleanLine.startsWith('#') || cleanLine.startsWith('class ') || cleanLine.startsWith('def ')) return;

                const currentEntities = this.solveLayoutConstraintsForObjects(accumulatedObjects);
                const mutations = GraphDiffEngine.diff(prevEntities, currentEntities);
                const event = this.detectSemanticEvent(mutations, cleanLine);

                frames.push({
                    timestamp: timestamp += 50,
                    lineNumber: lineNo,
                    lineCode: cleanLine,
                    description: event.description,
                    entities: currentEntities,
                    mutations: mutations,
                    event: event
                });
                prevEntities = currentEntities;
            });
        }

        return frames.length > 0 ? frames : [{
            timestamp: 1000,
            lineNumber: 1,
            lineCode: "",
            description: "Initial Execution State",
            entities: [],
            mutations: [],
            event: { type: "Step", description: "Initial State" }
        }];
    }

    // --- TOPOLOGY DETECTOR (IU-2) ---
    detectTopology(objects) {
        const customNodes = objects.filter(o => o.type !== "Primitive" && o.type !== "ArrayCell" && o.type !== "DictBucket");
        if (customNodes.length === 0) {
            return { topology: "Flat", childAttr: null, roots: [], childrenMap: new Map() };
        }

        const objectMap = new Map();
        const inDegree = new Map();
        const childrenMap = new Map();
        let discoveredChildAttr = null;
        let hasNaryList = false;

        customNodes.forEach(o => {
            objectMap.set(o.id, o);
            inDegree.set(o.id, 0);
            childrenMap.set(o.id, []);
        });

        customNodes.forEach(o => {
            let naryRefs = [];
            if (o.slots && Array.isArray(o.slots)) {
                for (const slot of o.slots) {
                    if (slot.isList && Array.isArray(slot.listRefs) && slot.listRefs.length > 0) {
                        const validRefs = slot.listRefs.filter(refId => objectMap.has(refId));
                        if (validRefs.length > 0) {
                            discoveredChildAttr = slot.attr;
                            naryRefs.push(...validRefs);
                            hasNaryList = true;
                        }
                    } else if (slot.ref && objectMap.has(slot.ref)) {
                        naryRefs.push(slot.ref);
                    }
                }
            }

            if (naryRefs.length > 0) {
                naryRefs.forEach(childId => {
                    childrenMap.get(o.id).push(childId);
                    inDegree.set(childId, (inDegree.get(childId) || 0) + 1);
                });
            } else {
                if (o.left && objectMap.has(o.left)) {
                    childrenMap.get(o.id).push(o.left);
                    inDegree.set(o.left, (inDegree.get(o.left) || 0) + 1);
                }
                if (o.right && objectMap.has(o.right)) {
                    childrenMap.get(o.id).push(o.right);
                    inDegree.set(o.right, (inDegree.get(o.right) || 0) + 1);
                }
                if (childrenMap.get(o.id).length === 0 && o.next && objectMap.has(o.next)) {
                    childrenMap.get(o.id).push(o.next);
                    inDegree.set(o.next, (inDegree.get(o.next) || 0) + 1);
                }
            }
        });

        const visited = new Set();
        const recStack = new Set();
        let hasCycle = false;

        const isCyclic = (nodeId) => {
            visited.add(nodeId);
            recStack.add(nodeId);
            const children = childrenMap.get(nodeId) || [];
            for (const childId of children) {
                if (!visited.has(childId)) {
                    if (isCyclic(childId)) return true;
                } else if (recStack.has(childId)) {
                    return true;
                }
            }
            recStack.delete(nodeId);
            return false;
        };

        let roots = customNodes.filter(o => inDegree.get(o.id) === 0).map(o => o.id);
        if (roots.length === 0 && customNodes.length > 0) {
            roots = [customNodes[0].id];
        }

        for (const rootId of roots) {
            if (isCyclic(rootId)) {
                hasCycle = true;
                break;
            }
        }

        if (hasCycle) {
            return { topology: "CyclicGraph", childAttr: discoveredChildAttr, roots, childrenMap };
        }

        let maxChildren = 0;
        childrenMap.forEach((children) => {
            if (children.length > maxChildren) maxChildren = children.length;
        });

        let topology = "Generic";
        if (hasNaryList || maxChildren > 2) {
            topology = "NaryTree";
        } else if (customNodes.some(o => o.left || o.right || o.type === "TreeNode")) {
            topology = "BinaryTree";
        } else if (maxChildren === 1 && customNodes.some(o => o.next)) {
            topology = "LinkedList";
        } else if (maxChildren > 0) {
            topology = "NaryTree";
        }

        return {
            topology,
            childAttr: discoveredChildAttr,
            rootId: roots[0] || null,
            roots,
            childrenMap
        };
    }

    // --- DOMAIN DETECTOR (IU-3) ---
    detectDomain(objects, profile) {
        const DOMAIN_REGISTRY = [
            {
                name: "Filesystem",
                classSignals: ["folder", "directory", "dir", "file", "path"],
                attrSignals: ["children", "files", "subfolders", "name", "extension", "path"],
                icon: "📁", leafIcon: "📄",
                nodeColor: "#10B981", edgeColor: "#059669"
            },
            {
                name: "OrgChart",
                classSignals: ["employee", "person", "manager", "worker", "department"],
                attrSignals: ["reports", "team", "subordinates", "employees", "name", "title", "role"],
                icon: "👤", leafIcon: "👤",
                nodeColor: "#6366F1", edgeColor: "#4F46E5"
            },
            {
                name: "AST",
                classSignals: ["astnode", "node", "statement", "expression", "decl"],
                attrSignals: ["children", "body", "args", "op", "value"],
                icon: "⬡", leafIcon: "◉",
                nodeColor: "#F59E0B", edgeColor: "#D97706"
            },
            {
                name: "SceneGraph",
                classSignals: ["scenenode", "gameobject", "transform", "entity"],
                attrSignals: ["children", "position", "rotation", "scale"],
                icon: "⬜", leafIcon: "⬜",
                nodeColor: "#8B5CF6", edgeColor: "#7C3AED"
            },
            {
                name: "Menu",
                classSignals: ["menuitem", "menu", "navitem", "option"],
                attrSignals: ["children", "label", "href", "icon", "disabled"],
                icon: "☰", leafIcon: "▪",
                nodeColor: "#EC4899", edgeColor: "#DB2777"
            }
        ];

        const pyTypes = new Set(objects.map(o => (o.pyType || "").toLowerCase()));
        const attrNames = new Set();
        objects.forEach(o => {
            if (o.slots && Array.isArray(o.slots)) {
                o.slots.forEach(s => attrNames.add((s.attr || "").toLowerCase()));
            }
        });

        let bestDomain = null;
        let maxScore = 0;

        DOMAIN_REGISTRY.forEach(domain => {
            let classMatches = 0;
            domain.classSignals.forEach(sig => {
                if (pyTypes.has(sig)) classMatches++;
            });

            let attrMatches = 0;
            domain.attrSignals.forEach(sig => {
                if (attrNames.has(sig)) attrMatches++;
            });

            const classScore = domain.classSignals.length > 0 ? classMatches / domain.classSignals.length : 0;
            const attrScore = domain.attrSignals.length > 0 ? attrMatches / domain.attrSignals.length : 0;
            const confidence = (classScore * 0.6) + (attrScore * 0.4);

            if (confidence > maxScore) {
                maxScore = confidence;
                bestDomain = domain;
            }
        });

        if (!bestDomain || maxScore < 0.2) {
            return {
                ...profile,
                domain: "Generic",
                domainConfidence: 0,
                icon: null,
                leafIcon: null,
                nodeColor: "#6366F1",
                edgeColor: "rgba(255, 255, 255, 0.35)"
            };
        }

        return {
            ...profile,
            domain: bestDomain.name,
            domainConfidence: maxScore,
            icon: bestDomain.icon,
            leafIcon: bestDomain.leafIcon,
            nodeColor: bestDomain.nodeColor,
            edgeColor: bestDomain.edgeColor
        };
    }

    // --- REINGOLD-TILFORD INSPIRED TREE LAYOUT SOLVER (NO OVERLAPS & CLEAN HIERARCHY) ---
    solveLayoutConstraintsForObjects(objects) {
        if (!objects || objects.length === 0) return [];

        const profile = this.detectDomain(objects, this.detectTopology(objects));


        // 1. Filter out redundant Primitive objects if a Tree Graph is active to eliminate duplicate representations
        const treeNodes = objects.filter(o => o.type === "TreeNode");
        let activeObjects = objects;

        if (treeNodes.length > 0) {
            // Filter out primitives named 'root' or redundant object pointers
            activeObjects = objects.filter(o => !(o.type === "Primitive" && (o.varName === "root" || o.varName.startsWith("t"))));
        }

        const expandedObjects = [];
        activeObjects.forEach(obj => {
            if (obj.type === "TupleContainer") {
                expandedObjects.push({
                    id: `var_${obj.id}`,
                    type: "VariableRef",
                    label: obj.varName || "point",
                    targetId: obj.id,
                    isImmutable: true
                });
                expandedObjects.push(obj);
            } else {
                expandedObjects.push(obj);
            }
        });
        activeObjects = expandedObjects;

        const varGroups = new Map();
        activeObjects.forEach(obj => {
            if (obj.type === "TupleContainer") return; // Positioned dynamically with its VariableRef
            
            let groupKey = obj.varName ? obj.varName.split('[')[0].split('{')[0].split('.')[0] : obj.type;
            if (!varGroups.has(groupKey)) {
                varGroups.set(groupKey, []);
            }
            varGroups.get(groupKey).push(obj);
        });

        let currentY = 40;
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
            } else if (firstType === "VariableRef") {
                groupObjects.forEach((vRef) => {
                    const target = activeObjects.find(o => o.id === vRef.targetId);
                    const elemCount = (target && target.elements) ? target.elements.length : 2;
                    const totalH = Math.max(48, 24 * (elemCount + 1));
                    const centerY = currentY + totalH / 2;
                    
                    this.ctx.font = "600 11px Fira Code, monospace";
                    const textWidth = this.ctx.measureText(vRef.label).width || 40;
                    vRef.width = Math.max(60, textWidth + 24);
                    
                    vRef.x = 80; // Variable Rail
                    vRef.y = centerY;
                    
                    if (target) {
                        target.x = 260; // Heap rail
                        target.y = centerY;
                    }
                    
                    currentY += totalH + 30;
                });
            } else if (firstType === "MatrixGrid") {
                groupObjects.forEach((mat) => {
                    const cellW = 46;
                    const cellH = 34;
                    const gridW = mat.cols * cellW;
                    const gridH = mat.rows * cellH;
                    mat.width = gridW + 60;
                    mat.height = gridH + 50;
                    mat.x = (this.canvas.width / 2) || 400;
                    mat.y = currentY + gridH / 2 + 25;
                    currentY += mat.height + 40;
                });
            } else if (firstType === "DictContainer" || firstType === "ListContainer") {
                const getContainerHeight = (c) => {
                    const count = (c.entries ? c.entries.length : (c.elements ? c.elements.length : 1));
                    return 28 + Math.max(1, count) * 24;
                };

                const childToParent = new Map();
                groupObjects.forEach(obj => {
                    const refs = [];
                    if (obj.entries) obj.entries.forEach(e => { if (e.ref) refs.push(e.ref); });
                    if (obj.elements) obj.elements.forEach(e => { if (e.ref) refs.push(e.ref); });
                    refs.forEach(r => childToParent.set(r, obj.id));
                });

                const levels = new Map();
                const getLevel = (id, visited = new Set()) => {
                    if (visited.has(id)) return 0;
                    visited.add(id);
                    if (levels.has(id)) return levels.get(id);
                    if (!childToParent.has(id)) {
                        levels.set(id, 0);
                        return 0;
                    }
                    const parentId = childToParent.get(id);
                    const lvl = getLevel(parentId, visited) + 1;
                    levels.set(id, lvl);
                    return lvl;
                };

                groupObjects.forEach(obj => getLevel(obj.id));

                const levelColumns = new Map();
                groupObjects.forEach(obj => {
                    const lvl = levels.get(obj.id) || 0;
                    if (!levelColumns.has(lvl)) levelColumns.set(lvl, []);
                    levelColumns.get(lvl).push(obj);
                });

                let maxColY = currentY;
                levelColumns.forEach((colObjects, lvl) => {
                    let colY = currentY;
                    const colX = startX + lvl * 240;
                    colObjects.forEach(obj => {
                        const h = getContainerHeight(obj);
                        obj.x = colX + 90;
                        obj.y = colY + h / 2;
                        obj.width = 180;
                        obj.height = h;
                        colY += h + 25;
                    });
                    if (colY > maxColY) maxColY = colY;
                });

            } else if (firstType === "ClassObject") {
                const classGroups = new Map();
                groupObjects.forEach(obj => {
                    const cType = obj.pyType || "ClassObject";
                    if (!classGroups.has(cType)) classGroups.set(cType, []);
                    classGroups.get(cType).push(obj);
                });

                let colIndex = 0;
                let maxColY = currentY;

                classGroups.forEach((cObjects, cType) => {
                    let colY = currentY;
                    const colX = 300 + colIndex * 300;
                    
                    cObjects.forEach(obj => {
                        const slotsCount = (obj.slots ? obj.slots.length : 1);
                        const h = 30 + slotsCount * 26;
                        obj.x = colX + 100;
                        obj.y = colY + h / 2;
                        obj.width = 200;
                        obj.height = h;
                        
                        const vRef = activeObjects.find(o => o.type === "VariableRef" && o.targetId === obj.id);
                        if (vRef) {
                            this.ctx.font = "600 11px Fira Code, monospace";
                            const textWidth = this.ctx.measureText(vRef.label).width || 40;
                            vRef.width = Math.max(60, textWidth + 24);
                            vRef.x = 80;
                            vRef.y = obj.y;
                        }
                        
                        colY += h + 30;
                    });
                    if (colY > maxColY) maxColY = colY;
                    colIndex++;
                });

                currentY = maxColY + 40;
            } else if (firstType === "ArrayCell" || firstType === "DictBucket") {
                groupObjects.forEach((cell, idx) => {
                    cell.x = startX + (idx % 10) * 70;
                    cell.y = currentY + Math.floor(idx / 10) * 65;
                });
                currentY += Math.ceil(groupObjects.length / 10) * 65 + 50;
            } else if (firstType === "TreeNode") {
                // Reingold-Tilford Tree Layout Solver
                const root = groupObjects[0];
                const cx = (this.canvas.width / 2) || 380;

                const getSubtreeWidth = (nodeId, level = 0) => {
                    const node = activeObjects.find(o => o.id === nodeId);
                    if (!node) return 0;

                    const leftW = node.left ? getSubtreeWidth(node.left, level + 1) : 0;
                    const rightW = node.right ? getSubtreeWidth(node.right, level + 1) : 0;
                    return Math.max(1, leftW + rightW);
                };

                const positionReingoldTilford = (nodeId, x, y, levelSpacing) => {
                    const node = activeObjects.find(o => o.id === nodeId);
                    if (!node) return;

                    node.x = x;
                    node.y = y;

                    // Color node based on balance factor (|bf| > 1 gets highlighted amber/red)
                    if (Math.abs(node.balanceFactor || 0) > 1) {
                        node.color = "#EF4444"; // Unbalanced highlight
                    } else {
                        node.color = "#6366F1"; // Balanced Indigo
                    }

                    const nextSpacing = Math.max(28, levelSpacing / 1.75);

                    if (node.left) {
                        positionReingoldTilford(node.left, x - levelSpacing, y + 68, nextSpacing);
                    }
                    if (node.right) {
                        positionReingoldTilford(node.right, x + levelSpacing, y + 68, nextSpacing);
                    }
                };

                const treeWidth = getSubtreeWidth(root.id);
                const initialLevelSpacing = Math.max(45, Math.min(180, treeWidth * 18));

                positionReingoldTilford(root.id, cx, currentY + 30, initialLevelSpacing);
                currentY += 320;
            } else if (firstType === "NaryNode" || (profile && profile.topology === "NaryTree")) {
                const cx = (this.canvas.width / 2) || 380;

                const getSubtreeLeafCount = (nodeId, visitedNodes = new Set()) => {
                    if (visitedNodes.has(nodeId)) return 1;
                    visitedNodes.add(nodeId);

                    const children = profile.childrenMap.get(nodeId) || [];
                    if (children.length === 0) return 1;

                    let total = 0;
                    children.forEach(cId => {
                        total += getSubtreeLeafCount(cId, visitedNodes);
                    });
                    return Math.max(1, total);
                };

                const positionNaryTree = (nodeId, x, y, availableWidth, visitedNodes = new Set()) => {
                    if (visitedNodes.has(nodeId)) return;
                    visitedNodes.add(nodeId);

                    const node = activeObjects.find(o => o.id === nodeId);
                    if (!node) return;

                    node.type = "NaryNode";
                    node.x = x;
                    node.y = y;

                    const children = profile.childrenMap.get(nodeId) || [];
                    node.children = children;

                    const isRoot = profile.roots.includes(nodeId);
                    const isLeaf = children.length === 0;

                    node.isRoot = isRoot;
                    node.isLeaf = isLeaf;
                    node.childCount = children.length;

                    node.icon = isLeaf ? profile.leafIcon : profile.icon;
                    node.color = profile.nodeColor || "#6366F1";
                    node.edgeColor = profile.edgeColor || "#4F46E5";

                    if (children.length > 0) {
                        const childLeafCounts = children.map(cId => getSubtreeLeafCount(cId));
                        const totalLeaves = childLeafCounts.reduce((a, b) => a + b, 0);

                        let currentX = x - (availableWidth / 2);
                        children.forEach((childId, idx) => {
                            const childWidthRatio = childLeafCounts[idx] / totalLeaves;
                            const childAllocatedWidth = availableWidth * childWidthRatio;
                            const childCenterX = currentX + (childAllocatedWidth / 2);

                            positionNaryTree(childId, childCenterX, y + 85, childAllocatedWidth, visitedNodes);
                            currentX += childAllocatedWidth;
                        });
                    }
                };

                const totalForestLeaves = profile.roots.map(rId => getSubtreeLeafCount(rId)).reduce((a, b) => a + b, 0);
                const totalForestWidth = Math.max(totalForestLeaves * 85, Math.min(1100, (this.canvas.width || 800) * 0.9));

                let startForestX = cx - (totalForestWidth / 2);
                profile.roots.forEach((rootId) => {
                    const rootLeafCount = getSubtreeLeafCount(rootId);
                    const rootWidth = (rootLeafCount / (totalForestLeaves || 1)) * totalForestWidth;
                    const rootCenterX = startForestX + (rootWidth / 2);
                    positionNaryTree(rootId, rootCenterX, currentY + 30, rootWidth);
                    startForestX += rootWidth;
                });

                currentY += 320;
            } else { // Linked list / General Node
                groupObjects.forEach((node, idx) => {
                    node.x = startX + idx * 130;
                    node.y = currentY + 30;
                });
                currentY += 100;
            }
        });

        return activeObjects;
    }

    // --- CAMERA TRACKING ENGINE (IU-4) ---
    updateCameraTargetForFrame(frame) {
        if (!frame || this.isUserDraggingCamera) return;

        if (this.cameraMode === "follow") {
            const focusId = frame.event?.cameraFocusId || frame.event?.targetId;
            if (focusId && this.entities.has(focusId)) {
                const targetNode = this.entities.get(focusId);
                this.targetPanX = (this.canvas.width / 2) - targetNode.x * this.zoomScale;
                this.targetPanY = (this.canvas.height / 2) - targetNode.y * this.zoomScale;
            } else if (this.entities.size > 0) {
                // Focus on root or first entity if no specific focus node
                const firstNode = Array.from(this.entities.values())[0];
                this.targetPanX = (this.canvas.width / 2) - firstNode.x * this.zoomScale;
                this.targetPanY = (this.canvas.height / 2) - firstNode.y * this.zoomScale;
            }
        } else if (this.cameraMode === "fit") {
            if (this.entities.size === 0) return;
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            this.entities.forEach(e => {
                if (e.x < minX) minX = e.x;
                if (e.x > maxX) maxX = e.x;
                if (e.y < minY) minY = e.y;
                if (e.y > maxY) maxY = e.y;
            });
            const boundsWidth = (maxX - minX) || 400;
            const boundsHeight = (maxY - minY) || 300;
            const padding = 140;
            const scaleX = (this.canvas.width - padding) / boundsWidth;
            const scaleY = (this.canvas.height - padding) / boundsHeight;
            const fitScale = Math.max(0.4, Math.min(1.1, Math.min(scaleX, scaleY)));

            const centerX = (minX + maxX) / 2;
            const centerY = (minY + maxY) / 2;

            this.targetZoomScale = fitScale;
            this.targetPanX = (this.canvas.width / 2) - centerX * fitScale;
            this.targetPanY = (this.canvas.height / 2) - centerY * fitScale;
        } else if (this.cameraMode === "selected") {
            if (this.selectedEntityId && this.entities.has(this.selectedEntityId)) {
                const selectedNode = this.entities.get(this.selectedEntityId);
                this.targetPanX = (this.canvas.width / 2) - selectedNode.x * this.zoomScale;
                this.targetPanY = (this.canvas.height / 2) - selectedNode.y * this.zoomScale;
            }
        }
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

        // Update Docked Variables Panel
        const primitiveEntities = Array.from(this.entities.values()).filter(e => e.type === "Primitive");
        const varDock = document.getElementById('variables-dock');
        const varDockContent = document.getElementById('variables-dock-content');
        if (varDock && varDockContent) {
            if (primitiveEntities.length > 0) {
                varDock.style.display = 'block';
                varDockContent.innerHTML = primitiveEntities.map(p => `
                    <div class="var-dock-item">
                        <span class="var-dock-name">${p.varName}</span>
                        <span class="var-dock-val">${p.label.includes('=') ? p.label.split('=').pop().trim() : p.label}</span>
                    </div>
                `).join('');
            } else {
                varDock.style.display = 'none';
            }
        }

        // Camera Auto-Tracking Target Update
        this.updateCameraTargetForFrame(frame);

        // Reset animation progress for smooth transitions
        this.animProgress = 0.0;
    }

    step(direction) {
        this.seekToFrame(this.currentFrameIndex + direction);
    }

    // --- CANVAS RENDER ENGINE LOOP ---
    startRenderLoop() {
        const render = () => {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

            // Smooth Lerp Camera
            if (!this.isUserDraggingCamera) {
                this.panX += (this.targetPanX - this.panX) * 0.12;
                this.panY += (this.targetPanY - this.panY) * 0.12;
                this.zoomScale += (this.targetZoomScale - this.zoomScale) * 0.12;
            }

            // Lerp Micro-Animation Progress
            if (this.animProgress < 1.0) {
                this.animProgress = Math.min(1.0, this.animProgress + 0.08);
            }

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

    // --- DRAW CONNECTIONS WITH LEFT (L) & RIGHT (R) EDGE SEMANTICS ---
    drawConnections() {
        this.ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
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
                this.drawLineWithEdgeBadge(entity.x - 10, entity.y + 16, target.x + 10, target.y - 16, "L");
            }
            if (entity.right && this.entities.has(entity.right)) {
                const target = this.entities.get(entity.right);
                this.drawLineWithEdgeBadge(entity.x + 10, entity.y + 16, target.x - 10, target.y - 16, "R");
            }
            if (entity.children && Array.isArray(entity.children) && entity.children.length > 0) {
                entity.children.forEach(childId => {
                    if (this.entities.has(childId)) {
                        const target = this.entities.get(childId);
                        this.ctx.beginPath();
                        this.ctx.moveTo(entity.x, entity.y + 18);
                        this.ctx.lineTo(target.x, target.y - 18);
                        this.ctx.strokeStyle = entity.edgeColor || "rgba(255, 255, 255, 0.35)";
                        this.ctx.lineWidth = 2;
                        this.ctx.stroke();
                    }
                });
            }
            if (entity.manager && this.entities.has(entity.manager)) {
                const target = this.entities.get(entity.manager);
                this.drawArrow(entity.x, entity.y - 20, target.x, target.y + 20);
            }
            if (entity.type === "VariableRef" && this.entities.has(entity.targetId)) {
                const target = this.entities.get(entity.targetId);
                const rectW = entity.width || 60;
                const startX = entity.x + rectW / 2;
                const startY = entity.y;
                
                const endX = target.x - 80;
                const endY = target.y;
                
                this.ctx.strokeStyle = "#60A5FA";
                this.ctx.lineWidth = 2.2;
                this.drawArrow(startX, startY, endX, endY, "#60A5FA");
            }
            if (entity.refAnchors && typeof entity.refAnchors === "object") {
                Object.entries(entity.refAnchors).forEach(([targetId, anchor]) => {
                    if (this.entities.has(targetId)) {
                        const target = this.entities.get(targetId);
                        const targetW = target.width || 180;
                        const startX = anchor.x;
                        const startY = anchor.y;
                        const endX = target.x - targetW / 2;
                        const endY = target.y;
                        
                        const edgeColor = entity.type === "DictContainer" ? "#EC4899" : "#6366F1";
                        this.ctx.strokeStyle = edgeColor;
                        this.ctx.lineWidth = 2.0;
                        
                        this.ctx.beginPath();
                        this.ctx.moveTo(startX, startY);
                        const cp1x = startX + (endX - startX) * 0.4;
                        const cp2x = startX + (endX - startX) * 0.6;
                        this.ctx.bezierCurveTo(cp1x, startY, cp2x, endY, endX, endY);
                        this.ctx.stroke();
                        
                        const headlen = 7;
                        this.ctx.beginPath();
                        this.ctx.moveTo(endX, endY);
                        this.ctx.lineTo(endX - headlen, endY - 4);
                        this.ctx.lineTo(endX - headlen, endY + 4);
                        this.ctx.fillStyle = edgeColor;
                        this.ctx.fill();
                    }
                });
            }
        });
    }

    drawLineWithEdgeBadge(x1, y1, x2, y2, label) {
        const animX2 = x1 + (x2 - x1) * this.animProgress;
        const animY2 = y1 + (y2 - y1) * this.animProgress;

        this.ctx.beginPath();
        this.ctx.moveTo(x1, y1);
        this.ctx.lineTo(animX2, animY2);
        this.ctx.strokeStyle = label === "L" ? "#EC4899" : "#10B981";
        this.ctx.lineWidth = 2.2;
        this.ctx.stroke();

        if (this.animProgress >= 0.75) {
            const midX = (x1 + x2) / 2;
            const midY = (y1 + y2) / 2;
            
            this.ctx.fillStyle = label === "L" ? "#EC4899" : "#10B981";
            this.ctx.font = "700 9px Fira Code, monospace";
            this.ctx.textAlign = "center";
            this.ctx.textBaseline = "middle";
            this.ctx.fillText(label, midX + (label === "L" ? -7 : 7), midY);
        }
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

    drawArrow(x1, y1, x2, y2, color = "rgba(255, 255, 255, 0.4)") {
        this.ctx.beginPath();
        this.ctx.moveTo(x1, y1);
        this.ctx.lineTo(x2, y2);
        this.ctx.stroke();

        const headlen = 8;
        const angle = Math.atan2(y2 - y1, x2 - x1);
        this.ctx.beginPath();
        this.ctx.moveTo(x2, y2);
        this.ctx.lineTo(x2 - headlen * Math.cos(angle - Math.PI / 6), y2 - headlen * Math.sin(angle - Math.PI / 6));
        this.ctx.lineTo(x2 - headlen * Math.cos(angle + Math.PI / 6), y2 - headlen * Math.sin(angle + Math.PI / 6));
        this.ctx.fillStyle = color;
        this.ctx.fill();
    }

    // --- DRAW ENTITIES WITH MINIMAL LABELS & HEIGHT/BALANCE BADGES ---
    drawEntities() {
        // Easing helper
        const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
        const easeT = easeOutCubic(this.animProgress);

        this.entities.forEach(entity => {
            if (entity.type === "Primitive") return; // Rendered in Docked Variables Panel

            // Calculate interpolated position for smooth movement
            let renderX = entity.x;
            let renderY = entity.y;
            let scaleFactor = 1.0;

            if (this.prevNodePositions && this.prevNodePositions.has(entity.id)) {
                const prevPos = this.prevNodePositions.get(entity.id);
                renderX = prevPos.x + (entity.x - prevPos.x) * easeT;
                renderY = prevPos.y + (entity.y - prevPos.y) * easeT;
            } else {
                scaleFactor = easeT;
            }

            const isSelected = entity.id === this.selectedEntityId;

            if (isSelected) {
                this.ctx.beginPath();
                this.ctx.arc(renderX, renderY, (28 * scaleFactor), 0, Math.PI * 2);
                this.ctx.fillStyle = "rgba(99, 102, 241, 0.25)";
                this.ctx.fill();
                this.ctx.strokeStyle = "#6366F1";
                this.ctx.lineWidth = 2.5;
                this.ctx.stroke();
            }

            if (entity.type === "VariableRef") {
                this.ctx.save();
                
                // Draw rounded rectangle variable badge
                this.ctx.fillStyle = "rgba(30, 41, 59, 0.9)";
                this.ctx.strokeStyle = "#60A5FA";
                this.ctx.lineWidth = 1.5;
                this.ctx.beginPath();
                this.ctx.font = "600 11px Fira Code, monospace";
                const textWidth = this.ctx.measureText(entity.label).width || 40;
                const padW = 12;
                const rectW = entity.width || Math.max(60, textWidth + padW * 2);
                const rectH = 28;
                
                this.ctx.roundRect(renderX - rectW / 2, renderY - rectH / 2, rectW, rectH, 6);
                this.ctx.fill();
                this.ctx.stroke();
                
                // Text label
                this.ctx.fillStyle = "#60A5FA";
                this.ctx.font = "600 11px Fira Code, monospace";
                this.ctx.textAlign = "center";
                this.ctx.textBaseline = "middle";
                this.ctx.fillText(entity.label, renderX, renderY);
                
                this.ctx.restore();
            } else if (entity.type === "TupleContainer") {
                const elements = entity.elements || [];
                const rowH = 24;
                const headerH = 24;
                const totalH = headerH + rowH * elements.length;
                const width = 160;
                
                const startX = renderX - width / 2;
                const startY = renderY - totalH / 2;
                
                this.ctx.save();
                
                // Outer container rounded rect
                this.ctx.fillStyle = "rgba(18, 24, 38, 0.88)";
                this.ctx.beginPath();
                this.ctx.roundRect(startX, startY, width, totalH, 8);
                this.ctx.fill();
                this.ctx.strokeStyle = entity.color || "#8B5CF6";
                this.ctx.lineWidth = isSelected ? 2.5 : 1.8;
                this.ctx.stroke();
                
                // Header background
                this.ctx.fillStyle = "rgba(139, 92, 246, 0.15)";
                this.ctx.beginPath();
                this.ctx.roundRect(startX, startY, width, headerH, [8, 8, 0, 0]);
                this.ctx.fill();
                
                // Header text "Tuple"
                this.ctx.fillStyle = "#A78BFA";
                this.ctx.font = "700 11px Inter, sans-serif";
                this.ctx.textAlign = "center";
                this.ctx.textBaseline = "middle";
                this.ctx.fillText("Tuple", startX + width / 2, startY + headerH / 2);
                
                // Line under header
                this.ctx.beginPath();
                this.ctx.moveTo(startX, startY + headerH);
                this.ctx.lineTo(startX + width, startY + headerH);
                this.ctx.strokeStyle = "rgba(139, 92, 246, 0.4)";
                this.ctx.stroke();
                
                // Draw elements
                const colDividerX = startX + 40;
                
                elements.forEach((elem, idx) => {
                    const rowY = startY + headerH + idx * rowH;
                    
                    // Index (Left column)
                    this.ctx.fillStyle = "#94A3B8";
                    this.ctx.font = "600 10px Fira Code, monospace";
                    this.ctx.textAlign = "center";
                    this.ctx.textBaseline = "middle";
                    this.ctx.fillText(String(idx), startX + 20, rowY + rowH / 2);
                    
                    // Value (Right column)
                    this.ctx.fillStyle = "#FFFFFF";
                    this.ctx.font = "500 11px Fira Code, monospace";
                    this.ctx.textAlign = "center";
                    this.ctx.textBaseline = "middle";
                    this.ctx.fillText(String(elem), colDividerX + 60, rowY + rowH / 2);
                    
                    // Row divider line (if not last)
                    if (idx < elements.length - 1) {
                        this.ctx.beginPath();
                        this.ctx.moveTo(startX, rowY + rowH);
                        this.ctx.lineTo(startX + width, rowY + rowH);
                        this.ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
                        this.ctx.stroke();
                    }
                });
                
                // Column divider vertical line
                this.ctx.beginPath();
                this.ctx.moveTo(colDividerX, startY + headerH);
                this.ctx.lineTo(colDividerX, startY + totalH);
                this.ctx.strokeStyle = "rgba(139, 92, 246, 0.4)";
                this.ctx.stroke();
                
                this.ctx.restore();
            } else if (entity.type === "TreeNode") {
                const radius = Math.max(1, 20 * scaleFactor);

                this.ctx.beginPath();
                this.ctx.arc(renderX, renderY, radius, 0, Math.PI * 2);
                this.ctx.fillStyle = entity.color || "#6366F1";
                this.ctx.fill();
                this.ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
                this.ctx.lineWidth = 2;
                this.ctx.stroke();

                if (scaleFactor > 0.4) {
                    this.ctx.fillStyle = "#FFFFFF";
                    this.ctx.font = "700 13px Fira Code, monospace";
                    this.ctx.textAlign = "center";
                    this.ctx.textBaseline = "middle";
                    this.ctx.fillText(entity.label, renderX, renderY);

                    // Render Metadata based on Mode
                    if (this.metaMode === "learning" && entity.height !== undefined) {
                        this.ctx.fillStyle = "#94A3B8";
                        this.ctx.font = "600 9px Fira Code, monospace";
                        this.ctx.textAlign = "center";
                        this.ctx.fillText(`h=${entity.height} bf=${entity.balanceFactor ?? 0}`, renderX, renderY + radius + 10);
                    } else if (this.metaMode === "debug" && entity.height !== undefined) {
                        this.ctx.fillStyle = "#F59E0B";
                        this.ctx.font = "600 8px Fira Code, monospace";
                        this.ctx.textAlign = "center";
                        this.ctx.fillText(`${entity.pyId} h=${entity.height}`, renderX, renderY + radius + 10);
                    }
                }
            } else if (entity.type === "NaryNode") {
                const isRoot = entity.isRoot;
                const isLeaf = entity.isLeaf;
                const baseRadius = isRoot ? 28 : (isLeaf ? 16 : 22);
                const radius = Math.max(1, baseRadius * scaleFactor);

                this.ctx.save();

                // Root Glow Effect
                if (isRoot) {
                    this.ctx.beginPath();
                    this.ctx.arc(renderX, renderY, radius + 6, 0, Math.PI * 2);
                    this.ctx.fillStyle = entity.color ? `${entity.color}33` : "rgba(16, 185, 129, 0.25)";
                    this.ctx.fill();
                }

                // Node Circle
                this.ctx.beginPath();
                this.ctx.arc(renderX, renderY, radius, 0, Math.PI * 2);

                if (isLeaf) {
                    this.ctx.fillStyle = "rgba(30, 41, 59, 0.9)";
                    this.ctx.strokeStyle = entity.color || "#6366F1";
                    this.ctx.lineWidth = 1.8;
                } else if (isRoot) {
                    this.ctx.fillStyle = entity.color || "#10B981";
                    this.ctx.strokeStyle = "#FFFFFF";
                    this.ctx.lineWidth = 3;
                } else {
                    this.ctx.fillStyle = entity.color || "#6366F1";
                    this.ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
                    this.ctx.lineWidth = 2;
                }
                this.ctx.fill();
                this.ctx.stroke();

                if (scaleFactor > 0.4) {
                    // Truncate long labels
                    let displayLabel = entity.label || "";
                    if (displayLabel.length > 11) {
                        displayLabel = displayLabel.substring(0, 9) + "..";
                    }

                    this.ctx.fillStyle = "#FFFFFF";
                    this.ctx.font = isRoot ? "700 13px Fira Code, monospace" : (isLeaf ? "600 10px Fira Code, monospace" : "700 11px Fira Code, monospace");
                    this.ctx.textAlign = "center";
                    this.ctx.textBaseline = "middle";
                    this.ctx.fillText(displayLabel, renderX, renderY);

                    // Icon & Child Count Badge
                    if (entity.icon) {
                        let iconText = entity.icon;
                        if (!isLeaf && entity.childCount > 0) {
                            iconText = `${entity.icon} (${entity.childCount})`;
                        }
                        this.ctx.font = isRoot ? "bold 15px sans-serif" : "13px sans-serif";
                        this.ctx.fillStyle = "#E2E8F0";
                        this.ctx.textAlign = "center";
                        this.ctx.textBaseline = "bottom";
                        this.ctx.fillText(iconText, renderX, renderY - radius - 4);
                    }
                }

                this.ctx.restore();
            } else if (entity.type === "DictContainer" || entity.type === "ListContainer") {
                const isDict = entity.type === "DictContainer";
                const items = isDict ? (entity.entries || []) : (entity.elements || []);
                const rowH = 24;
                const headerH = 28;
                const totalH = headerH + Math.max(1, items.length) * rowH;
                const width = entity.width || 180;
                
                const startX = renderX - width / 2;
                const startY = renderY - totalH / 2;
                
                this.ctx.save();
                
                // Outer container card
                this.ctx.fillStyle = "rgba(18, 24, 38, 0.92)";
                this.ctx.beginPath();
                this.ctx.roundRect(startX, startY, width, totalH, 8);
                this.ctx.fill();
                this.ctx.strokeStyle = isSelected ? "#FFFFFF" : (entity.color || (isDict ? "#EC4899" : "#6366F1"));
                this.ctx.lineWidth = isSelected ? 2.5 : 1.8;
                this.ctx.stroke();
                
                // Header background
                this.ctx.fillStyle = isDict ? "rgba(236, 72, 153, 0.2)" : "rgba(99, 102, 241, 0.2)";
                this.ctx.beginPath();
                this.ctx.roundRect(startX, startY, width, headerH, [8, 8, 0, 0]);
                this.ctx.fill();
                
                // Header Title
                this.ctx.fillStyle = isDict ? "#F472B6" : "#818CF8";
                this.ctx.font = "700 11px Fira Code, monospace";
                this.ctx.textAlign = "center";
                this.ctx.textBaseline = "middle";
                const headerTitle = entity.varName || (isDict ? "{dict}" : "[list]");
                this.ctx.fillText(headerTitle.length > 22 ? headerTitle.substring(0, 20) + ".." : headerTitle, startX + width / 2, startY + headerH / 2);
                
                // Line under header
                this.ctx.beginPath();
                this.ctx.moveTo(startX, startY + headerH);
                this.ctx.lineTo(startX + width, startY + headerH);
                this.ctx.strokeStyle = isDict ? "rgba(236, 72, 153, 0.4)" : "rgba(99, 102, 241, 0.4)";
                this.ctx.stroke();
                
                // Column divider vertical line
                const colDividerX = startX + 65;
                this.ctx.beginPath();
                this.ctx.moveTo(colDividerX, startY + headerH);
                this.ctx.lineTo(colDividerX, startY + totalH);
                this.ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
                this.ctx.stroke();
                
                entity.refAnchors = {};
                
                items.forEach((item, idx) => {
                    const rowY = startY + headerH + idx * rowH;
                    const keyLabel = isDict ? String(item.key) : `[${item.index}]`;
                    
                    // Left Column (Key / Index)
                    this.ctx.fillStyle = "#94A3B8";
                    this.ctx.font = "600 10px Fira Code, monospace";
                    this.ctx.textAlign = "center";
                    this.ctx.textBaseline = "middle";
                    const truncKey = keyLabel.length > 8 ? keyLabel.substring(0, 7) + ".." : keyLabel;
                    this.ctx.fillText(truncKey, startX + 32, rowY + rowH / 2);
                    
                    // Right Column (Value or Ref Dot)
                    if (item.isCompound && item.ref) {
                        const anchorX = startX + width;
                        const anchorY = rowY + rowH / 2;
                        entity.refAnchors[item.ref] = { x: anchorX, y: anchorY };
                        
                        // Draw Reference Link Dot
                        this.ctx.beginPath();
                        this.ctx.arc(startX + 115, anchorY, 4, 0, Math.PI * 2);
                        this.ctx.fillStyle = isDict ? "#EC4899" : "#6366F1";
                        this.ctx.fill();
                        this.ctx.strokeStyle = "#FFFFFF";
                        this.ctx.lineWidth = 1;
                        this.ctx.stroke();
                        
                        this.ctx.fillStyle = "#CBD5E1";
                        this.ctx.font = "500 10px Fira Code, monospace";
                        this.ctx.textAlign = "left";
                        this.ctx.fillText("ref ➜", startX + 72, anchorY);
                    } else {
                        const valStr = String(item.val !== undefined ? item.val : "");
                        const truncVal = valStr.length > 12 ? valStr.substring(0, 10) + ".." : valStr;
                        this.ctx.fillStyle = "#F1F5F9";
                        this.ctx.font = "500 11px Fira Code, monospace";
                        this.ctx.textAlign = "center";
                        this.ctx.textBaseline = "middle";
                        this.ctx.fillText(truncVal, colDividerX + (width - 65) / 2, rowY + rowH / 2);
                    }
                    
                    // Row divider line
                    if (idx < items.length - 1) {
                        this.ctx.beginPath();
                        this.ctx.moveTo(startX, rowY + rowH);
                        this.ctx.lineTo(startX + width, rowY + rowH);
                        this.ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
                        this.ctx.stroke();
                    }
                });
                
                this.ctx.restore();
            } else if (entity.type === "ClassObject") {
                const slots = entity.slots || [];
                const rowH = 26;
                const headerH = 30;
                const totalH = headerH + Math.max(1, slots.length) * rowH;
                const width = entity.width || 200;
                
                const startX = renderX - width / 2;
                const startY = renderY - totalH / 2;
                
                this.ctx.save();
                
                const isStudent = (entity.pyType || "").toLowerCase().includes("student");
                const isCourse = (entity.pyType || "").toLowerCase().includes("course");
                const headerBg = isStudent ? "rgba(99, 102, 241, 0.25)" : (isCourse ? "rgba(16, 185, 129, 0.25)" : "rgba(236, 72, 153, 0.25)");
                const headerColor = isStudent ? "#818CF8" : (isCourse ? "#34D399" : "#F472B6");
                const strokeColor = isSelected ? "#FFFFFF" : (isStudent ? "#6366F1" : (isCourse ? "#10B981" : "#EC4899"));
                const icon = isStudent ? "🎓" : (isCourse ? "📚" : "📦");
                
                this.ctx.fillStyle = "rgba(18, 24, 38, 0.92)";
                this.ctx.beginPath();
                this.ctx.roundRect(startX, startY, width, totalH, 8);
                this.ctx.fill();
                this.ctx.strokeStyle = strokeColor;
                this.ctx.lineWidth = isSelected ? 2.5 : 1.8;
                this.ctx.stroke();
                
                this.ctx.fillStyle = headerBg;
                this.ctx.beginPath();
                this.ctx.roundRect(startX, startY, width, headerH, [8, 8, 0, 0]);
                this.ctx.fill();
                
                this.ctx.fillStyle = headerColor;
                this.ctx.font = "700 11px Fira Code, monospace";
                this.ctx.textAlign = "center";
                this.ctx.textBaseline = "middle";
                const classTitle = `${icon} ${entity.pyType}: ${entity.label}`;
                this.ctx.fillText(classTitle.length > 24 ? classTitle.substring(0, 22) + ".." : classTitle, startX + width / 2, startY + headerH / 2);
                
                this.ctx.beginPath();
                this.ctx.moveTo(startX, startY + headerH);
                this.ctx.lineTo(startX + width, startY + headerH);
                this.ctx.strokeStyle = strokeColor;
                this.ctx.lineWidth = 1;
                this.ctx.stroke();
                
                const colDividerX = startX + 75;
                this.ctx.beginPath();
                this.ctx.moveTo(colDividerX, startY + headerH);
                this.ctx.lineTo(colDividerX, startY + totalH);
                this.ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
                this.ctx.stroke();
                
                entity.refAnchors = {};
                
                slots.forEach((slot, idx) => {
                    const rowY = startY + headerH + idx * rowH;
                    const attrName = String(slot.attr || "");
                    
                    this.ctx.fillStyle = "#94A3B8";
                    this.ctx.font = "600 10px Fira Code, monospace";
                    this.ctx.textAlign = "center";
                    this.ctx.textBaseline = "middle";
                    const truncAttr = attrName.length > 9 ? attrName.substring(0, 8) + ".." : attrName;
                    this.ctx.fillText(truncAttr, startX + 37, rowY + rowH / 2);
                    
                    const anchorY = rowY + rowH / 2;
                    if (slot.isList && slot.listRefs && slot.listRefs.length > 0) {
                        const anchorX = startX + width;
                        slot.listRefs.forEach(refId => {
                            entity.refAnchors[refId] = { x: anchorX, y: anchorY };
                        });
                        
                        this.ctx.beginPath();
                        this.ctx.arc(startX + 125, anchorY, 4, 0, Math.PI * 2);
                        this.ctx.fillStyle = headerColor;
                        this.ctx.fill();
                        this.ctx.strokeStyle = "#FFFFFF";
                        this.ctx.lineWidth = 1;
                        this.ctx.stroke();
                        
                        this.ctx.fillStyle = "#CBD5E1";
                        this.ctx.font = "500 10px Fira Code, monospace";
                        this.ctx.textAlign = "left";
                        this.ctx.fillText(`[${slot.listRefs.length}] ➜`, startX + 82, anchorY);
                    } else if (slot.ref) {
                        const anchorX = startX + width;
                        entity.refAnchors[slot.ref] = { x: anchorX, y: anchorY };
                        
                        this.ctx.beginPath();
                        this.ctx.arc(startX + 125, anchorY, 4, 0, Math.PI * 2);
                        this.ctx.fillStyle = headerColor;
                        this.ctx.fill();
                        this.ctx.strokeStyle = "#FFFFFF";
                        this.ctx.lineWidth = 1;
                        this.ctx.stroke();
                        
                        this.ctx.fillStyle = "#CBD5E1";
                        this.ctx.font = "500 10px Fira Code, monospace";
                        this.ctx.textAlign = "left";
                        this.ctx.fillText("ref ➜", startX + 82, anchorY);
                    } else {
                        const valStr = String(slot.scalar !== undefined ? slot.scalar : (slot.val !== undefined ? slot.val : ""));
                        const truncVal = valStr.length > 14 ? valStr.substring(0, 12) + ".." : valStr;
                        this.ctx.fillStyle = "#F1F5F9";
                        this.ctx.font = "500 11px Fira Code, monospace";
                        this.ctx.textAlign = "center";
                        this.ctx.textBaseline = "middle";
                        this.ctx.fillText(truncVal, colDividerX + (width - 75) / 2, anchorY);
                    }
                    
                    if (idx < slots.length - 1) {
                        this.ctx.beginPath();
                        this.ctx.moveTo(startX, rowY + rowH);
                        this.ctx.lineTo(startX + width, rowY + rowH);
                        this.ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
                        this.ctx.stroke();
                    }
                });
                
                this.ctx.restore();
            } else if (entity.type === "Primitive") {
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

                this.ctx.fillStyle = "#FFFFFF";
                this.ctx.font = "600 13px Inter, sans-serif";
                this.ctx.textAlign = "center";
                this.ctx.textBaseline = "middle";
                this.ctx.fillText(entity.label, entity.x, entity.y);
            } else if (entity.type === "MatrixGrid") {
                const rows = entity.rows || 0;
                const cols = entity.cols || 0;
                const cellW = 46;
                const cellH = 34;
                const totalW = cols * cellW;
                const totalH = rows * cellH;

                const startX = renderX - totalW / 2;
                const startY = renderY - totalH / 2 + 10;

                this.ctx.save();

                // Outer Glass Container Card
                this.ctx.fillStyle = "rgba(18, 24, 38, 0.88)";
                this.ctx.beginPath();
                this.ctx.roundRect(startX - 36, startY - 32, totalW + 50, totalH + 46, 10);
                this.ctx.fill();
                this.ctx.strokeStyle = isSelected ? "#6366F1" : "rgba(99, 102, 241, 0.4)";
                this.ctx.lineWidth = isSelected ? 2.5 : 1.5;
                this.ctx.stroke();

                // Matrix Title Badge (e.g. "matrix [5x5]")
                this.ctx.fillStyle = "#818CF8";
                this.ctx.font = "700 12px Fira Code, monospace";
                this.ctx.textAlign = "left";
                this.ctx.textBaseline = "middle";
                this.ctx.fillText(`📊 ${entity.varName} [${rows}×${cols}]`, startX - 24, startY - 16);

                // Column Header Indices (c0, c1, c2...)
                this.ctx.font = "600 10px Fira Code, monospace";
                this.ctx.fillStyle = "#94A3B8";
                this.ctx.textAlign = "center";
                for (let c = 0; c < cols; c++) {
                    const cx = startX + c * cellW + cellW / 2;
                    this.ctx.fillText(`c${c}`, cx, startY - 5);
                }

                // Render Cells with Row Header Indices (r0, r1, r2...)
                for (let r = 0; r < rows; r++) {
                    const ry = startY + r * cellH;
                    
                    // Row Header Index
                    this.ctx.font = "600 10px Fira Code, monospace";
                    this.ctx.fillStyle = "#94A3B8";
                    this.ctx.textAlign = "right";
                    this.ctx.fillText(`r${r}`, startX - 8, ry + cellH / 2);

                    const rowData = entity.data ? entity.data[r] : [];
                    for (let c = 0; c < cols; c++) {
                        const rx = startX + c * cellW;
                        const cellItem = rowData ? rowData[c] : null;
                        const cellVal = cellItem ? cellItem.val : "";

                        const isCellSelected = this.selectedMatrixCell && 
                            this.selectedMatrixCell.matrixId === entity.id && 
                            this.selectedMatrixCell.r === r && 
                            this.selectedMatrixCell.c === c;

                        this.ctx.beginPath();
                        this.ctx.roundRect(rx + 2, ry + 2, cellW - 4, cellH - 4, 4);

                        if (isCellSelected) {
                            this.ctx.fillStyle = "rgba(99, 102, 241, 0.5)";
                            this.ctx.strokeStyle = "#818CF8";
                            this.ctx.lineWidth = 2;
                        } else {
                            this.ctx.fillStyle = "rgba(30, 41, 59, 0.9)";
                            this.ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
                            this.ctx.lineWidth = 1;
                        }
                        this.ctx.fill();
                        this.ctx.stroke();

                        // Cell Value
                        this.ctx.fillStyle = isCellSelected ? "#FFFFFF" : "#F1F5F9";
                        this.ctx.font = "600 12px Fira Code, monospace";
                        this.ctx.textAlign = "center";
                        this.ctx.textBaseline = "middle";
                        this.ctx.fillText(String(cellVal), rx + cellW / 2, ry + cellH / 2);
                    }
                }

                this.ctx.restore();
            } else {
                this.ctx.beginPath();
                this.ctx.arc(entity.x, entity.y, 22, 0, Math.PI * 2);
                this.ctx.fillStyle = entity.color || "#6366F1";
                this.ctx.fill();
                this.ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
                this.ctx.lineWidth = 2;
                this.ctx.stroke();

                this.ctx.fillStyle = "#FFFFFF";
                this.ctx.font = "600 13px Inter, sans-serif";
                this.ctx.textAlign = "center";
                this.ctx.textBaseline = "middle";
                this.ctx.fillText(entity.label, entity.x, entity.y);
            }
        });
    }

    // --- DEVTOOLS INSPECTOR OVERLAY WITH FULL AVL METADATA ---
    handleCanvasClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const rawMouseX = e.clientX - rect.left;
        const rawMouseY = e.clientY - rect.top;

        const mouseX = (rawMouseX - this.panX) / this.zoomScale;
        const mouseY = (rawMouseY - this.panY) / this.zoomScale;

        let clickedEntity = null;
        let clickedMatrixCell = null;

        this.entities.forEach(entity => {
            if (entity.type === "MatrixGrid") {
                const rows = entity.rows || 0;
                const cols = entity.cols || 0;
                const cellW = 46;
                const cellH = 34;
                const totalW = cols * cellW;
                const totalH = rows * cellH;
                const startX = entity.x - totalW / 2;
                const startY = entity.y - totalH / 2 + 10;

                if (mouseX >= startX - 36 && mouseX <= startX + totalW + 20 &&
                    mouseY >= startY - 32 && mouseY <= startY + totalH + 15) {
                    clickedEntity = entity;
                    for (let r = 0; r < rows; r++) {
                        for (let c = 0; c < cols; c++) {
                            const rx = startX + c * cellW;
                            const ry = startY + r * cellH;
                            if (mouseX >= rx && mouseX <= rx + cellW && mouseY >= ry && mouseY <= ry + cellH) {
                                clickedMatrixCell = { matrixId: entity.id, r, c, cellItem: entity.data[r][c] };
                                break;
                            }
                        }
                    }
                }
            } else if (entity.type === "VariableRef") {
                const rectW = 60;
                const rectH = 28;
                if (mouseX >= entity.x - rectW / 2 && mouseX <= entity.x + rectW / 2 &&
                    mouseY >= entity.y - rectH / 2 && mouseY <= entity.y + rectH / 2) {
                    clickedEntity = entity;
                }
            } else if (entity.type === "TupleContainer") {
                const width = 160;
                const totalH = 24 * ((entity.elements || []).length + 1);
                if (mouseX >= entity.x - width / 2 && mouseX <= entity.x + width / 2 &&
                    mouseY >= entity.y - totalH / 2 && mouseY <= entity.y + totalH / 2) {
                    clickedEntity = entity;
                }
            } else {
                const dist = Math.hypot(entity.x - mouseX, entity.y - mouseY);
                if (dist <= 25) {
                    clickedEntity = entity;
                }
            }
        });

        if (clickedEntity) {
            this.selectedEntityId = clickedEntity.id;
            this.selectedMatrixCell = clickedMatrixCell;
            this.showInspector(clickedEntity);

            const targetVar = clickedMatrixCell ? clickedMatrixCell.cellItem.varName : clickedEntity.varName;
            if (targetVar) {
                const lines = this.codeEditor.value.split('\n');
                const cleanVar = targetVar.split('[')[0];
                const matchedLineIdx = lines.findIndex(l => l.includes(cleanVar));
                if (matchedLineIdx !== -1) {
                    this.highlightLine(matchedLineIdx + 1);
                }
            }
        } else {
            this.selectedMatrixCell = null;
            this.closeInspector();
        }
    }

    showInspector(entity) {
        this.inspectorPanel.style.display = 'flex';
        
        if (entity.type === "MatrixGrid" && this.selectedMatrixCell) {
            const cell = this.selectedMatrixCell.cellItem;
            this.inspectorContent.innerHTML = `
                <div class="dock-section" id="variables-dock">
                    <div class="dock-section-title">📌 Active Variables</div>
                    <div class="variables-dock-content" id="variables-dock-content"></div>
                </div>
                <div class="dock-section" id="inspector-details">
                    <div class="dock-section-title">Matrix Cell Inspector</div>
                    <div class="inspect-item">
                        <span class="inspect-label">Cell Reference</span>
                        <span class="inspect-val" style="color: #60A5FA; font-weight: 700;">${cell.varName}</span>
                    </div>
                    <div class="inspect-item">
                        <span class="inspect-label">Cell Value</span>
                        <span class="inspect-val" style="color: #F59E0B; font-weight: 700;">${cell.val}</span>
                    </div>
                    <div class="inspect-item">
                        <span class="inspect-label">Row Index (r)</span>
                        <span class="inspect-val">${cell.r}</span>
                    </div>
                    <div class="inspect-item">
                        <span class="inspect-label">Col Index (c)</span>
                        <span class="inspect-val">${cell.c}</span>
                    </div>
                    <div class="inspect-item">
                        <span class="inspect-label">Grid Dimensions</span>
                        <span class="inspect-val">${entity.rows} × ${entity.cols}</span>
                    </div>
                    <div class="inspect-item">
                        <span class="inspect-label">CPython Pointer</span>
                        <span class="inspect-val">${entity.pyId}</span>
                    </div>
                </div>
            `;
            return;
        }
        
        if (entity.type === "TupleContainer") {
            this.inspectorContent.innerHTML = `
                <div class="dock-section" id="inspector-details">
                    <div class="dock-section-title">Tuple Inspector</div>
                    <div class="inspect-item">
                        <span class="inspect-label">Variable Reference</span>
                        <span class="inspect-val" style="color: #60A5FA; font-weight: 700;">${entity.varName}</span>
                    </div>
                    <div class="inspect-item">
                        <span class="inspect-label">Type</span>
                        <span class="inspect-val">${entity.pyType || 'tuple'}</span>
                    </div>
                    <div class="inspect-item">
                        <span class="inspect-label">CPython Pointer</span>
                        <span class="inspect-val">${entity.pyId}</span>
                    </div>
                    <div class="inspect-item">
                        <span class="inspect-label">Elements Count</span>
                        <span class="inspect-val">${(entity.elements || []).length}</span>
                    </div>
                </div>
            `;
            return;
        }
        
        let extraInfo = '';
        if (entity.height !== undefined) {
            extraInfo = `
                <div class="inspect-item">
                    <span class="inspect-label">Height (h)</span>
                    <span class="inspect-val">${entity.height}</span>
                </div>
                <div class="inspect-item">
                    <span class="inspect-label">Balance Factor (bf)</span>
                    <span class="inspect-val">${entity.balanceFactor ?? 0}</span>
                </div>
            `;
        }

        this.inspectorContent.innerHTML = `
            <div class="inspect-item">
                <span class="inspect-label">Node Value</span>
                <span class="inspect-val" style="color: #60A5FA; font-weight: 700;">${entity.label}</span>
            </div>
            ${extraInfo}
            <div class="inspect-item">
                <span class="inspect-label">Variable Name</span>
                <span class="inspect-val">${entity.varName}</span>
            </div>
            <div class="inspect-item">
                <span class="inspect-label">CPython Pointer</span>
                <span class="inspect-val">${entity.pyId}</span>
            </div>
            ${entity.type === "NaryNode" ? `
            <div class="inspect-item">
                <span class="inspect-label">Children (${(entity.children || []).length})</span>
                <span class="inspect-val">${(entity.children || []).join(', ') || 'None'}</span>
            </div>
            ` : `
            <div class="inspect-item">
                <span class="inspect-label">Left Child</span>
                <span class="inspect-val">${entity.left || 'None'}</span>
            </div>
            <div class="inspect-item">
                <span class="inspect-label">Right Child</span>
                <span class="inspect-val">${entity.right || 'None'}</span>
            </div>
            `}
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
