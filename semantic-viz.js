// ═══════════════════════════════════════════════════════════════════════════════
// RVE — Semantic Visualization Engine  v1.0
// Adds pattern detection + per-structure rendering on top of the generic object graph.
//
// Architecture:
//   nodeMap (from tracer)
//     └─► SemanticAnalyzer.analyze()  → SemanticScene
//           └─► LayoutSolver[type]()  → positioned nodes/edges
//                 └─► SemanticRenderer.draw()
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// COLOURS (shared palette for semantic renderer)
// ─────────────────────────────────────────────────────────────────────────────
const SEM = {
    bg:          '#0B0F19',
    nodeFill:    '#1A2234',
    nodeStroke:  '#3B4F74',
    nodeHead:    '#6366F1',
    textPri:     '#F1F5F9',
    textSec:     '#94A3B8',
    textKey:     '#A5B4FC',
    accent:      '#6366F1',
    accentGlow:  'rgba(99,102,241,0.5)',
    success:     '#10B981',
    warning:     '#F59E0B',
    error:       '#EF4444',
    arrowFill:   'rgba(99,102,241,0.85)',
    arrowStroke: 'rgba(99,102,241,0.5)',
    nullColor:   '#475569',
    headColor:   '#EC4899',
    tailColor:   '#F59E0B',
    // per-type
    tree:   { head: '#4338CA', fill: '#1e1b4b', stroke: '#4F46E5' },
    list:   { head: '#065F46', fill: '#022c22', stroke: '#10B981' },
    stack:  { head: '#7C3AED', fill: '#1e1b4b', stroke: '#8B5CF6' },
    queue:  { head: '#B45309', fill: '#1c1007', stroke: '#D97706' },
    graph:  { head: '#1D4ED8', fill: '#0c1a3d', stroke: '#3B82F6' },
    heap:   { head: '#9D174D', fill: '#1f0920', stroke: '#EC4899' },
    map:    { head: '#0F766E', fill: '#042f2e', stroke: '#14B8A6' },
};

// ─────────────────────────────────────────────────────────────────────────────
// SEMANTIC ANALYZER
// Takes the raw nodeMap + vars from the tracer, runs detectors in priority order,
// and returns a SemanticScene: { type, model, confidence }
// ─────────────────────────────────────────────────────────────────────────────
class SemanticAnalyzer {

    // Entry point: analyze the full graph, return the best-fit scene
    static analyze(nodeMap, vars) {
        if (!nodeMap || !nodeMap.size) return null;

        // Run each detector. Detectors return a model object or null.
        const detectors = [
            SemanticAnalyzer.detectBinaryTree,
            SemanticAnalyzer.detectLinkedList,
            SemanticAnalyzer.detectHeap,
            SemanticAnalyzer.detectStack,
            SemanticAnalyzer.detectQueue,
            SemanticAnalyzer.detectGraph,
            SemanticAnalyzer.detectHashMap,
        ];

        for (const detect of detectors) {
            const result = detect(nodeMap, vars);
            if (result) return result;
        }
        return null;  // falls back to object graph renderer
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    // Find slot by key name on a node
    static _slot(n, key) {
        return (n.slots || []).find(s => s.key === key);
    }

    // Resolve a slot's target node from the map
    static _target(nodeMap, n, key) {
        const s = SemanticAnalyzer._slot(n, key);
        if (!s || !s.targetId) return null;
        return nodeMap.get(s.targetId) || null;
    }

    // Get the primitive value of a slot (for numeric fields like val, key, data)
    static _primVal(nodeMap, n, ...keys) {
        for (const key of keys) {
            const s = SemanticAnalyzer._slot(n, key);
            if (s && s.targetId) {
                const t = nodeMap.get(s.targetId);
                if (t && t.type === 'PrimNode') return t.label;
            }
            if (s && !s.targetId && s.valRepr) return s.valRepr;
        }
        return null;
    }

    // Walk a linked chain following a pointer key, collect visited ids
    static _walkChain(nodeMap, startId, ptrKey, limit = 50) {
        const chain = [];
        const seen = new Set();
        let cur = nodeMap.get(startId);
        while (cur && !seen.has(cur.id) && chain.length < limit) {
            seen.add(cur.id);
            chain.push(cur);
            const s = SemanticAnalyzer._slot(cur, ptrKey);
            if (!s || !s.targetId) break;
            const next = nodeMap.get(s.targetId);
            if (!next || next.type === 'PrimNode') break;
            cur = next;
        }
        return chain;
    }

    // Check if a set of node ids form a tree (no cycles, each has ≤1 parent)
    static _isAcyclic(nodeMap, rootId, ...ptrKeys) {
        const visited = new Set();
        const queue = [rootId];
        while (queue.length) {
            const id = queue.shift();
            if (visited.has(id)) return false;  // cycle
            visited.add(id);
            const n = nodeMap.get(id);
            if (!n) continue;
            for (const key of ptrKeys) {
                const s = SemanticAnalyzer._slot(n, key);
                if (s && s.targetId && nodeMap.has(s.targetId)) queue.push(s.targetId);
            }
        }
        return true;
    }

    // ── DETECTOR: Binary Tree ─────────────────────────────────────────────────
    // Signal: at least one ObjNode with both 'left' and 'right' slots,
    //         reachable from a variable named root/tree/avl/bst etc., no cycles
    static detectBinaryTree(nodeMap, vars) {
        // Find candidate root: a non-primitive ObjNode with left/right
        const hasBranch = n =>
            n.type === 'ObjNode' &&
            (n.slots || []).some(s => s.key === 'left' || s.key === 'right');

        let rootNode = null;

        // Priority: look for a var named root/tree/avl/bst
        for (const v of (vars || [])) {
            const n = nodeMap.get(v.targetId);
            if (!n) continue;
            // The variable might point to a wrapper class (AVLTree) that has .root
            if (n.type === 'ObjNode') {
                const rootSlot = SemanticAnalyzer._slot(n, 'root');
                if (rootSlot && rootSlot.targetId) {
                    const potentialRoot = nodeMap.get(rootSlot.targetId);
                    if (potentialRoot && hasBranch(potentialRoot)) {
                        // wrapper class case — traverse from potentialRoot
                        if (SemanticAnalyzer._isAcyclic(nodeMap, potentialRoot.id, 'left', 'right')) {
                            rootNode = potentialRoot;
                            break;
                        }
                    }
                }
                // Direct tree root variable
                if (hasBranch(n) && SemanticAnalyzer._isAcyclic(nodeMap, n.id, 'left', 'right')) {
                    rootNode = n;
                    break;
                }
            }
        }

        // Fallback: scan all nodes
        if (!rootNode) {
            for (const [, n] of nodeMap) {
                if (hasBranch(n) && SemanticAnalyzer._isAcyclic(nodeMap, n.id, 'left', 'right')) {
                    rootNode = n;
                    break;
                }
            }
        }
        if (!rootNode) return null;

        // Build abstract BinaryTree model by BFS
        const nodes = [];
        const queue = [{ node: rootNode, parentId: null, side: null, depth: 0 }];
        const visited = new Set();

        while (queue.length) {
            const { node: n, parentId, side, depth } = queue.shift();
            if (!n || visited.has(n.id)) continue;
            visited.add(n.id);

            const val = SemanticAnalyzer._primVal(nodeMap, n, 'val', 'key', 'data', 'value') || n.label || '?';
            const leftSlot  = SemanticAnalyzer._slot(n, 'left');
            const rightSlot = SemanticAnalyzer._slot(n, 'right');
            // Extra fields for AVL/BST
            const height = SemanticAnalyzer._primVal(nodeMap, n, 'height');
            const bf     = SemanticAnalyzer._primVal(nodeMap, n, 'bf', 'balance_factor');

            nodes.push({ id: n.id, val, parentId, side, depth, height, bf, leftId: null, rightId: null });
            const me = nodes[nodes.length - 1];

            if (leftSlot?.targetId && nodeMap.has(leftSlot.targetId)) {
                me.leftId = leftSlot.targetId;
                queue.push({ node: nodeMap.get(leftSlot.targetId), parentId: n.id, side: 'left', depth: depth + 1 });
            }
            if (rightSlot?.targetId && nodeMap.has(rightSlot.targetId)) {
                me.rightId = rightSlot.targetId;
                queue.push({ node: nodeMap.get(rightSlot.targetId), parentId: n.id, side: 'right', depth: depth + 1 });
            }
        }

        if (nodes.length < 1) return null;
        return { type: 'BinaryTree', nodes, rootId: rootNode.id };
    }

    // ── DETECTOR: Linked List ──────────────────────────────────────────────────
    // Signal: ObjNode with 'next' slot chain, no cycles (except doubly-linked prev)
    static detectLinkedList(nodeMap, vars) {
        const hasNext = n => n.type === 'ObjNode' && (n.slots || []).some(s => s.key === 'next');

        let headNode = null;
        for (const v of (vars || [])) {
            const n = nodeMap.get(v.targetId);
            if (n && hasNext(n)) { headNode = n; break; }
        }
        if (!headNode) {
            for (const [, n] of nodeMap) {
                if (hasNext(n)) { headNode = n; break; }
            }
        }
        if (!headNode) return null;

        const chain = SemanticAnalyzer._walkChain(nodeMap, headNode.id, 'next');
        if (chain.length < 1) return null;

        const nodes = chain.map((n, i) => {
            const val = SemanticAnalyzer._primVal(nodeMap, n, 'val', 'data', 'value', 'key') || n.label || '?';
            const nextSlot = SemanticAnalyzer._slot(n, 'next');
            const hasNextNode = nextSlot && nextSlot.targetId && nodeMap.has(nextSlot.targetId);
            return { id: n.id, val, index: i, nextId: hasNextNode ? nextSlot.targetId : null };
        });

        return { type: 'LinkedList', nodes, headId: headNode.id };
    }

    // ── DETECTOR: Heap ─────────────────────────────────────────────────────────
    // Signal: a list variable whose name suggests heap, or heapq-touched list
    static detectHeap(nodeMap, vars) {
        // Look for a list variable with name suggesting heap
        const heapNames = /heap|pq|priority/i;
        for (const v of (vars || [])) {
            const n = nodeMap.get(v.targetId);
            if (!n) continue;
            if (n.type === 'ListNode' && heapNames.test(v.name)) {
                // Extract values from slots
                const items = (n.slots || []).map((s, i) => {
                    const t = nodeMap.get(s.targetId);
                    const val = t?.type === 'PrimNode' ? t.label : s.valRepr || '?';
                    return { index: i, val };
                });
                if (items.length > 0) {
                    return { type: 'Heap', items, varName: v.name };
                }
            }
        }
        return null;
    }

    // ── DETECTOR: Stack ────────────────────────────────────────────────────────
    // Signal: a list variable with name suggesting stack
    static detectStack(nodeMap, vars) {
        const stackNames = /stack|stk/i;
        for (const v of (vars || [])) {
            const n = nodeMap.get(v.targetId);
            if (!n) continue;
            if (n.type === 'ListNode' && stackNames.test(v.name)) {
                const items = (n.slots || []).map((s, i) => {
                    const t = nodeMap.get(s.targetId);
                    const val = t?.type === 'PrimNode' ? t.label : s.valRepr || '?';
                    return { index: i, val };
                });
                return { type: 'Stack', items, varName: v.name };
            }
        }
        return null;
    }

    // ── DETECTOR: Queue ────────────────────────────────────────────────────────
    // Signal: a list/deque variable with name suggesting queue
    static detectQueue(nodeMap, vars) {
        const queueNames = /queue|deque|fifo|q\b/i;
        for (const v of (vars || [])) {
            const n = nodeMap.get(v.targetId);
            if (!n) continue;
            if ((n.type === 'ListNode' || n.pyType === 'deque') && queueNames.test(v.name)) {
                const items = (n.slots || []).map((s, i) => {
                    const t = nodeMap.get(s.targetId);
                    const val = t?.type === 'PrimNode' ? t.label : s.valRepr || '?';
                    return { index: i, val };
                });
                return { type: 'Queue', items, varName: v.name };
            }
        }
        return null;
    }

    // ── DETECTOR: Graph ────────────────────────────────────────────────────────
    // Signal: a dict mapping node keys → lists/sets of neighbors
    static detectGraph(nodeMap, vars) {
        for (const v of (vars || [])) {
            const n = nodeMap.get(v.targetId);
            if (!n || n.type !== 'DictNode') continue;
            // Check if values are lists/sets (adjacency list)
            let adjCount = 0;
            for (const s of (n.slots || [])) {
                const t = nodeMap.get(s.targetId);
                if (t && (t.type === 'ListNode' || t.type === 'SetNode')) adjCount++;
            }
            if (adjCount > 0 && adjCount >= (n.slots || []).length * 0.5) {
                // Build node+edge list
                const graphNodes = [];
                const graphEdges = [];
                const seenNodes = new Set();

                for (const s of (n.slots || [])) {
                    const fromKey = s.key;
                    if (!seenNodes.has(fromKey)) { seenNodes.add(fromKey); graphNodes.push({ id: fromKey, label: fromKey }); }
                    const adjList = nodeMap.get(s.targetId);
                    if (adjList) {
                        for (const adj of (adjList.slots || [])) {
                            const toKey = adj.valRepr || adj.key;
                            if (!seenNodes.has(toKey)) { seenNodes.add(toKey); graphNodes.push({ id: toKey, label: toKey }); }
                            graphEdges.push({ from: fromKey, to: toKey });
                        }
                    }
                }
                if (graphNodes.length >= 2) {
                    return { type: 'Graph', nodes: graphNodes, edges: graphEdges, varName: v.name };
                }
            }
        }
        return null;
    }

    // ── DETECTOR: Hash Map ─────────────────────────────────────────────────────
    // Signal: a dict variable with name suggesting map/table/hash
    static detectHashMap(nodeMap, vars) {
        const mapNames = /map|hash|table|dict|index|cache|memo/i;
        for (const v of (vars || [])) {
            const n = nodeMap.get(v.targetId);
            if (!n || n.type !== 'DictNode') continue;
            if (mapNames.test(v.name) || (n.slots || []).length >= 3) {
                const entries = (n.slots || []).map(s => {
                    const t = nodeMap.get(s.targetId);
                    const val = t?.type === 'PrimNode' ? t.label : s.valRepr || '?';
                    return { key: s.key, val };
                });
                return { type: 'HashMap', entries, varName: v.name };
            }
        }
        return null;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// LAYOUT SOLVERS  — per-template position assignment
// Each returns an array of positioned visual objects and edges.
// ─────────────────────────────────────────────────────────────────────────────
class SemanticLayoutSolver {

    // ── Binary Tree: Reingold-Tilford ─────────────────────────────────────────
    static binaryTree(scene, canvasW, canvasH) {
        const { nodes, rootId } = scene;
        if (!nodes.length) return { nodes: [], edges: [] };

        const nodeById = new Map(nodes.map(n => [n.id, n]));
        const CW = 60, CH = 52, HGAP = 28, VGAP = 72;

        // First pass: compute subtree widths bottom-up
        const width = new Map();
        const computeWidth = (id) => {
            if (!id) return 0;
            const n = nodeById.get(id);
            if (!n) return 0;
            const lw = n.leftId  ? computeWidth(n.leftId)  : 0;
            const rw = n.rightId ? computeWidth(n.rightId) : 0;
            const w = Math.max(CW, lw + rw + (lw && rw ? HGAP : 0));
            width.set(id, w);
            return w;
        };
        computeWidth(rootId);

        // Second pass: assign x,y positions top-down
        const posX = new Map(), posY = new Map();
        const assign = (id, x, y) => {
            if (!id || !nodeById.has(id)) return;
            posX.set(id, x);
            posY.set(id, y);
            const n = nodeById.get(id);
            const lw = n.leftId  ? (width.get(n.leftId)  || 0) : 0;
            const rw = n.rightId ? (width.get(n.rightId) || 0) : 0;
            const leftX  = x - rw / 2 - HGAP / 2 - lw / 2 + lw / 2;
            const rightX = x + lw / 2 + HGAP / 2 + rw / 2 - rw / 2;
            if (n.leftId)  assign(n.leftId,  x - (rw + HGAP + lw) / 2 + lw / 2,  y + VGAP + CH);
            if (n.rightId) assign(n.rightId, x + (lw + HGAP + rw) / 2 - rw / 2,  y + VGAP + CH);
        };

        // Center root
        const totalW = width.get(rootId) || CW;
        const startX = Math.max(canvasW / 2, totalW / 2 + 60);
        assign(rootId, startX, 80);

        // Build positioned output
        const out = nodes.map(n => ({
            id: n.id, val: n.val, height: n.height, bf: n.bf,
            x: posX.get(n.id) - CW/2,
            y: posY.get(n.id),
            w: CW, h: CH,
            isRoot: n.id === rootId,
        }));

        const edges = [];
        nodes.forEach(n => {
            const px = posX.get(n.id), py = posY.get(n.id);
            if (n.leftId && posX.has(n.leftId)) {
                edges.push({ from: n.id, to: n.leftId, label: 'L',
                    fx: px, fy: py + CH,
                    tx: posX.get(n.leftId), ty: posY.get(n.leftId) });
            }
            if (n.rightId && posX.has(n.rightId)) {
                edges.push({ from: n.id, to: n.rightId, label: 'R',
                    fx: px, fy: py + CH,
                    tx: posX.get(n.rightId), ty: posY.get(n.rightId) });
            }
        });

        return { nodes: out, edges, nodeW: CW, nodeH: CH };
    }

    // ── Linked List: horizontal chain ─────────────────────────────────────────
    static linkedList(scene, canvasW) {
        const { nodes } = scene;
        const NW = 100, NH = 48, GAP = 52;
        const startX = 80, startY = 160;
        const perRow  = Math.max(1, Math.floor((canvasW - startX - 40) / (NW + GAP)));

        const out = nodes.map((n, i) => {
            const row = Math.floor(i / perRow);
            const col = i % perRow;
            return { id: n.id, val: n.val, index: i, nextId: n.nextId,
                x: startX + col * (NW + GAP),
                y: startY + row * (NH + 72),
                w: NW, h: NH };
        });

        const edges = [];
        out.forEach((n, i) => {
            if (n.nextId) {
                const next = out.find(m => m.id === n.nextId);
                if (next) {
                    edges.push({ from: n.id, to: n.nextId,
                        fx: n.x + n.w, fy: n.y + n.h / 2,
                        tx: next.x,    ty: next.y + n.h / 2,
                        wrap: Math.floor(i / perRow) !== Math.floor((i+1) / perRow) });
                }
            }
        });
        return { nodes: out, edges, nodeW: NW, nodeH: NH, perRow };
    }

    // ── Stack: vertical tower ──────────────────────────────────────────────────
    static stack(scene, canvasW, canvasH) {
        const { items } = scene;
        const NW = 180, NH = 44, GAP = 3;
        const totalH = items.length * (NH + GAP);
        const startX = (canvasW - NW) / 2;
        const startY = Math.max(80, (canvasH - totalH) / 2);

        // TOP is the last element (index = length-1), drawn at top visually
        const out = items.map((item, i) => {
            const reversed = items.length - 1 - i;  // top of stack = items[last] = top visually
            return {
                id: `stack_${i}`, val: item.val, stackIndex: i,
                isTop: i === items.length - 1,
                x: startX,
                y: startY + reversed * (NH + GAP),
                w: NW, h: NH
            };
        });
        return { nodes: out, edges: [], nodeW: NW, nodeH: NH };
    }

    // ── Queue: horizontal ribbon ───────────────────────────────────────────────
    static queue(scene, canvasW, canvasH) {
        const { items } = scene;
        const NW = 80, NH = 56, GAP = 4;
        const totalW = items.length * (NW + GAP) - GAP;
        const startX = Math.max(80, (canvasW - totalW) / 2);
        const startY = (canvasH - NH) / 2;

        const out = items.map((item, i) => ({
            id: `queue_${i}`, val: item.val, queueIndex: i,
            isFront: i === 0,
            isRear:  i === items.length - 1,
            x: startX + i * (NW + GAP),
            y: startY,
            w: NW, h: NH
        }));
        return { nodes: out, edges: [], nodeW: NW, nodeH: NH };
    }

    // ── Heap: split view (array strip + tree) ─────────────────────────────────
    static heap(scene, canvasW, canvasH) {
        const { items } = scene;
        // Array strip
        const AW = 56, AH = 40, AGAP = 4;
        const stripStartX = Math.max(60, (canvasW - items.length * (AW + AGAP)) / 2);
        const stripY = 60;

        const arrayNodes = items.map((item, i) => ({
            id: `arr_${i}`, val: item.val, index: i,
            x: stripStartX + i * (AW + AGAP), y: stripY, w: AW, h: AH,
            isArrayCell: true
        }));

        // Tree derived from array indices: parent(i) = (i-1)//2
        const TW = 52, TH = 44, THGAP = 24, TVGAP = 64;
        const treeStartY = stripY + AH + 60;

        // Compute positions using level-width layout
        const levels = {};
        items.forEach((_, i) => {
            const lvl = Math.floor(Math.log2(i + 1));
            if (!levels[lvl]) levels[lvl] = [];
            levels[lvl].push(i);
        });

        const treePos = new Map();
        Object.keys(levels).sort((a,b)=>+a-+b).forEach(lvl => {
            const lvlNodes = levels[lvl];
            const count = lvlNodes.length;
            const rowW = count * (TW + THGAP) - THGAP;
            const rowStartX = Math.max(60, (canvasW - rowW) / 2);
            lvlNodes.forEach((i, j) => {
                treePos.set(i, {
                    x: rowStartX + j * (TW + THGAP),
                    y: treeStartY + +lvl * (TH + TVGAP)
                });
            });
        });

        const treeNodes = items.map((item, i) => ({
            id: `tree_${i}`, val: item.val, index: i,
            x: treePos.get(i)?.x ?? 0,
            y: treePos.get(i)?.y ?? 0,
            w: TW, h: TH,
            isTreeNode: true
        }));

        // Tree edges
        const treeEdges = items.map((_, i) => {
            if (i === 0) return null;
            const parent = Math.floor((i - 1) / 2);
            const cp = treePos.get(parent), cc = treePos.get(i);
            if (!cp || !cc) return null;
            return { from: `tree_${parent}`, to: `tree_${i}`,
                fx: cp.x + TW/2, fy: cp.y + TH,
                tx: cc.x + TW/2, ty: cc.y };
        }).filter(Boolean);

        // Dashed connectors: array cell → tree node
        const connectors = items.map((_, i) => {
            const ac = arrayNodes[i], tc = treeNodes[i];
            return { from: `arr_${i}`, to: `tree_${i}`, dashed: true,
                fx: ac.x + AW/2, fy: ac.y + AH,
                tx: tc.x + TW/2, ty: tc.y };
        });

        return { arrayNodes, treeNodes, treeEdges, connectors };
    }

    // ── Graph: simple spring layout ────────────────────────────────────────────
    static graph(scene, canvasW, canvasH) {
        const { nodes: gNodes, edges: gEdges } = scene;
        const R = 26;  // node radius
        const CX = canvasW / 2, CY = canvasH / 2;

        // Init positions in a circle
        const pos = new Map();
        gNodes.forEach((n, i) => {
            const angle = (2 * Math.PI * i) / gNodes.length;
            const radius = Math.min(canvasW, canvasH) * 0.35;
            pos.set(n.id, { x: CX + radius * Math.cos(angle), y: CY + radius * Math.sin(angle) });
        });

        // Spring relaxation (30 iterations)
        const K = 80, REPULSE = 4500;
        for (let iter = 0; iter < 30; iter++) {
            const forces = new Map(gNodes.map(n => [n.id, { dx: 0, dy: 0 }]));

            // Repulsion
            for (let i = 0; i < gNodes.length; i++) {
                for (let j = i + 1; j < gNodes.length; j++) {
                    const a = pos.get(gNodes[i].id), b = pos.get(gNodes[j].id);
                    const dx = b.x - a.x, dy = b.y - a.y;
                    const d  = Math.max(1, Math.hypot(dx, dy));
                    const f  = REPULSE / (d * d);
                    forces.get(gNodes[i].id).dx -= f * dx / d;
                    forces.get(gNodes[i].id).dy -= f * dy / d;
                    forces.get(gNodes[j].id).dx += f * dx / d;
                    forces.get(gNodes[j].id).dy += f * dy / d;
                }
            }

            // Attraction along edges
            for (const e of gEdges) {
                const a = pos.get(e.from), b = pos.get(e.to);
                if (!a || !b) continue;
                const dx = b.x - a.x, dy = b.y - a.y;
                const d  = Math.max(1, Math.hypot(dx, dy));
                const f  = (d - K) / K;
                forces.get(e.from).dx += f * dx / d * K * 0.1;
                forces.get(e.from).dy += f * dy / d * K * 0.1;
                if (forces.has(e.to)) {
                    forces.get(e.to).dx -= f * dx / d * K * 0.1;
                    forces.get(e.to).dy -= f * dy / d * K * 0.1;
                }
            }

            // Apply
            gNodes.forEach(n => {
                const p = pos.get(n.id), f = forces.get(n.id);
                pos.set(n.id, {
                    x: Math.max(R + 20, Math.min(canvasW - R - 20, p.x + f.dx * 0.5)),
                    y: Math.max(R + 20, Math.min(canvasH - R - 20, p.y + f.dy * 0.5))
                });
            });
        }

        const out = gNodes.map(n => ({ id: n.id, label: n.label, ...pos.get(n.id), r: R }));
        const edges = gEdges.map(e => {
            const a = pos.get(e.from), b = pos.get(e.to);
            if (!a || !b) return null;
            return { from: e.from, to: e.to, fx: a.x, fy: a.y, tx: b.x, ty: b.y };
        }).filter(Boolean);

        return { nodes: out, edges };
    }

    // ── Hash Map: bucket column layout ────────────────────────────────────────
    static hashMap(scene, canvasW, canvasH) {
        const { entries } = scene;
        const BH = 36, EH = 34, GAP = 3, INDENT = 180;
        const startX = Math.max(60, (canvasW - 360) / 2);
        const startY = 80;

        const out = entries.map((e, i) => ({
            id: `entry_${i}`, key: e.key, val: e.val,
            x: startX, ex: startX + INDENT,
            y: startY + i * (EH + GAP),
            w: 120, ew: 160, h: EH
        }));
        return { entries: out };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SEMANTIC RENDERER  — draws each template type on a Canvas 2D context
// ─────────────────────────────────────────────────────────────────────────────
class SemanticRenderer {
    constructor(ctx) {
        this.ctx = ctx;
    }

    // Entry: given a SemanticScene + layout, dispatch to the right draw method
    draw(scene, layout, zoom, selectedId) {
        if (!scene || !layout) return;
        switch (scene.type) {
            case 'BinaryTree': this.drawBinaryTree(layout, zoom, selectedId); break;
            case 'LinkedList': this.drawLinkedList(layout, zoom, selectedId); break;
            case 'Stack':      this.drawStack(layout, zoom, selectedId);      break;
            case 'Queue':      this.drawQueue(layout, zoom, selectedId);       break;
            case 'Heap':       this.drawHeap(layout, zoom);                    break;
            case 'Graph':      this.drawGraph(layout, zoom, selectedId);       break;
            case 'HashMap':    this.drawHashMap(layout, zoom);                 break;
        }
    }

    // ── helpers ───────────────────────────────────────────────────────────────
    _roundRect(x, y, w, h, r, fill, stroke, lw = 1.5) {
        this.ctx.fillStyle   = fill;
        this.ctx.strokeStyle = stroke;
        this.ctx.lineWidth   = lw;
        this.ctx.beginPath();
        this.ctx.roundRect(x, y, w, h, r);
        this.ctx.fill();
        this.ctx.stroke();
    }

    _arrow(fx, fy, tx, ty, color, curved = true, dashed = false) {
        const ctx = this.ctx;
        ctx.strokeStyle = color;
        ctx.fillStyle   = color;
        ctx.lineWidth   = 1.8;
        if (dashed) ctx.setLineDash([5, 4]);
        ctx.beginPath();
        if (curved) {
            const mx = fx + (tx - fx) * 0.5;
            ctx.moveTo(fx, fy);
            ctx.bezierCurveTo(mx, fy, mx, ty, tx, ty);
        } else {
            ctx.moveTo(fx, fy);
            ctx.lineTo(tx, ty);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        // arrowhead
        const angle = Math.atan2(ty - fy, tx - fx);
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(tx - 9*Math.cos(angle - 0.38), ty - 9*Math.sin(angle - 0.38));
        ctx.lineTo(tx - 9*Math.cos(angle + 0.38), ty - 9*Math.sin(angle + 0.38));
        ctx.closePath();
        ctx.fill();
    }

    _label(text, x, y, color, font = '700 12px Fira Code, monospace', align = 'center') {
        this.ctx.fillStyle   = color;
        this.ctx.font        = font;
        this.ctx.textAlign   = align;
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(text, x, y);
    }

    // ── DRAW: Binary Tree ─────────────────────────────────────────────────────
    drawBinaryTree(layout, zoom, selectedId) {
        const { nodes, edges } = layout;
        const pal = SEM.tree;

        // Draw edges first
        edges.forEach(e => {
            this._arrow(e.fx, e.fy, e.tx, e.ty + 0, 'rgba(99,102,241,0.45)', false);
        });

        // Draw nodes
        nodes.forEach(n => {
            const sel = n.id === selectedId;
            const { x, y, w, h } = n;

            // glow
            if (sel) { this.ctx.shadowColor = SEM.accentGlow; this.ctx.shadowBlur = 18; }

            // circle background
            const cx = x + w / 2, cy = y + h / 2, r = Math.min(w, h) / 2;
            this.ctx.fillStyle = sel ? pal.head : pal.fill;
            this.ctx.strokeStyle = sel ? '#A5B4FC' : pal.stroke;
            this.ctx.lineWidth = sel ? 2.5 : 1.8;
            this.ctx.beginPath();
            this.ctx.arc(cx, cy, r, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();
            this.ctx.shadowBlur = 0;

            // value
            if (zoom >= 0.45) {
                this._label(String(n.val), cx, cy, SEM.textPri, '700 13px Fira Code, monospace');
            }

            // height / bf badge (for AVL trees) — top right
            if (zoom >= 0.7 && (n.height != null || n.bf != null)) {
                const badge = n.bf != null ? `bf:${n.bf}` : `h:${n.height}`;
                this._label(badge, cx + r - 4, y - 10, SEM.textSec,
                    '500 9px Inter, sans-serif', 'right');
            }

            // ROOT label
            if (n.isRoot && zoom >= 0.55) {
                this._label('root', cx, y - 16, '#A5B4FC', '500 9px Inter, sans-serif');
            }
        });
    }

    // ── DRAW: Linked List ─────────────────────────────────────────────────────
    drawLinkedList(layout, zoom, selectedId) {
        const { nodes, edges } = layout;
        const pal = SEM.list;

        // HEAD label
        if (nodes.length && zoom >= 0.5) {
            const first = nodes[0];
            this._label('HEAD', first.x + first.w / 2, first.y - 18, SEM.headColor,
                '600 10px Inter, sans-serif');
            // arrow from HEAD to first node
            this._arrow(first.x + first.w/2, first.y - 12, first.x + first.w/2, first.y,
                SEM.headColor, false);
        }

        // Edges (pointer arrows)
        edges.forEach(e => {
            if (e.wrap) {
                // wrap-around: draw a bent arrow
                this._arrow(e.fx, e.fy, e.fx + 20, e.fy, SEM.arrowFill, false);
                this._arrow(e.fx + 20, e.fy, e.tx - 20, e.ty, SEM.arrowFill, false);
                this._arrow(e.tx - 20, e.ty, e.tx, e.ty, SEM.arrowFill, false);
            } else {
                this._arrow(e.fx, e.fy, e.tx, e.ty, SEM.arrowFill, false);
            }
        });

        // Nodes — drawn as [data | ptr] split cells
        nodes.forEach(n => {
            const sel = n.id === selectedId;
            const { x, y, w, h } = n;
            const split = w * 0.62;  // data section width

            if (sel) { this.ctx.shadowColor = SEM.accentGlow; this.ctx.shadowBlur = 14; }

            // outer box
            this._roundRect(x, y, w, h, 6, pal.fill, sel ? '#A5B4FC' : pal.stroke, sel ? 2.5 : 1.8);
            this.ctx.shadowBlur = 0;

            // divider between data and ptr
            this.ctx.strokeStyle = pal.stroke;
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.moveTo(x + split, y + 4);
            this.ctx.lineTo(x + split, y + h - 4);
            this.ctx.stroke();

            if (zoom >= 0.5) {
                // data value
                this._label(String(n.val), x + split/2, y + h/2, SEM.textPri);
                // pointer dot
                if (n.nextId) {
                    this.ctx.fillStyle = SEM.arrowFill;
                    this.ctx.beginPath();
                    this.ctx.arc(x + split + (w - split)/2, y + h/2, 4, 0, Math.PI * 2);
                    this.ctx.fill();
                } else {
                    // NULL
                    this._label('∅', x + split + (w - split)/2, y + h/2, SEM.nullColor,
                        '600 11px Fira Code, monospace');
                }
            }
        });

        // NULL terminator after last node
        if (nodes.length && !nodes[nodes.length-1].nextId && zoom >= 0.5) {
            const last = nodes[nodes.length-1];
            this._label('NULL', last.x + last.w + 28, last.y + last.h/2, SEM.nullColor,
                '600 10px Fira Code, monospace');
        }
    }

    // ── DRAW: Stack ───────────────────────────────────────────────────────────
    drawStack(layout, zoom, selectedId) {
        const { nodes } = layout;
        if (!nodes.length) return;
        const pal = SEM.stack;
        const topNode = nodes.find(n => n.isTop);

        // "TOP" arrow
        if (topNode && zoom >= 0.5) {
            this._label('TOP ▼', topNode.x + topNode.w / 2, topNode.y - 18, SEM.headColor,
                '700 10px Inter, sans-serif');
        }

        nodes.forEach(n => {
            const sel = n.id === selectedId;
            const { x, y, w, h } = n;
            const isTop = n.isTop;

            if (sel || isTop) { this.ctx.shadowColor = SEM.accentGlow; this.ctx.shadowBlur = 14; }

            this._roundRect(x, y, w, h, isTop ? [8, 8, 0, 0] : (n.stackIndex === 0 ? [0,0,8,8] : 0),
                isTop ? pal.head : pal.fill,
                sel ? '#A5B4FC' : pal.stroke,
                sel ? 2.5 : 1.8);
            this.ctx.shadowBlur = 0;

            if (zoom >= 0.45) {
                this._label(String(n.val), x + w/2, y + h/2, SEM.textPri);
            }

            // index label on the left
            if (zoom >= 0.65) {
                this._label(`[${n.stackIndex}]`, x - 22, y + h/2, SEM.textSec,
                    '500 10px Fira Code, monospace', 'right');
            }
        });

        // base plate
        if (nodes.length) {
            const base = nodes[0];
            this.ctx.fillStyle = 'rgba(99,102,241,0.2)';
            this.ctx.strokeStyle = pal.stroke;
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.roundRect(base.x - 8, base.y + base.h, base.w + 16, 6, [0,0,6,6]);
            this.ctx.fill();
            this.ctx.stroke();
        }
    }

    // ── DRAW: Queue ───────────────────────────────────────────────────────────
    drawQueue(layout, zoom, selectedId) {
        const { nodes } = layout;
        if (!nodes.length) return;
        const pal = SEM.queue;

        nodes.forEach(n => {
            const sel = n.id === selectedId;
            const { x, y, w, h } = n;

            if (sel) { this.ctx.shadowColor = SEM.accentGlow; this.ctx.shadowBlur = 14; }

            this._roundRect(x, y, w, h,
                n.isFront ? [8,0,0,8] : n.isRear ? [0,8,8,0] : 0,
                n.isFront || n.isRear ? pal.head : pal.fill,
                sel ? '#A5B4FC' : pal.stroke,
                sel ? 2.5 : 1.8);
            this.ctx.shadowBlur = 0;

            if (zoom >= 0.45) {
                this._label(String(n.val), x + w/2, y + h/2, SEM.textPri);
            }

            // FRONT / REAR labels
            if (zoom >= 0.5) {
                if (n.isFront) {
                    this._label('FRONT', x + w/2, y - 16, SEM.headColor, '600 9px Inter, sans-serif');
                    this._arrow(x + w/2, y - 10, x + w/2, y, SEM.headColor, false);
                }
                if (n.isRear) {
                    this._label('REAR', x + w/2, y + h + 18, SEM.tailColor, '600 9px Inter, sans-serif');
                    this._arrow(x + w/2, y + h, x + w/2, y + h + 10, SEM.tailColor, false);
                }
            }
        });

        // Dequeue arrow on the left
        if (nodes.length && zoom >= 0.5) {
            const first = nodes[0];
            this._arrow(first.x - 40, first.y + first.h/2, first.x - 8, first.y + first.h/2,
                SEM.success, false);
            this._label('dequeue', first.x - 44, first.y + first.h/2 - 14, SEM.success,
                '500 9px Inter, sans-serif', 'right');
        }
        // Enqueue arrow on the right
        if (nodes.length && zoom >= 0.5) {
            const last = nodes[nodes.length - 1];
            this._arrow(last.x + last.w + 8, last.y + last.h/2, last.x + last.w + 48, last.y + last.h/2,
                SEM.warning, false);
            this._label('enqueue', last.x + last.w + 52, last.y + last.h/2 - 14, SEM.warning,
                '500 9px Inter, sans-serif', 'left');
        }
    }

    // ── DRAW: Heap ────────────────────────────────────────────────────────────
    drawHeap(layout, zoom) {
        const { arrayNodes, treeNodes, treeEdges, connectors } = layout;
        const pal = SEM.heap;

        // Array strip label
        if (zoom >= 0.5) {
            this._label('Array', arrayNodes[0]?.x ?? 80, (arrayNodes[0]?.y ?? 60) - 18,
                SEM.textSec, '600 10px Inter, sans-serif', 'left');
        }

        // Array cells
        arrayNodes.forEach((n, i) => {
            this._roundRect(n.x, n.y, n.w, n.h, i === 0 ? [6,0,0,6] : i === arrayNodes.length-1 ? [0,6,6,0] : 0,
                i === 0 ? pal.head : pal.fill, pal.stroke);
            if (zoom >= 0.45) {
                this._label(String(n.val), n.x + n.w/2, n.y + n.h/2, SEM.textPri);
                this._label(String(i), n.x + n.w/2, n.y + n.h + 10, SEM.textSec,
                    '400 9px Fira Code, monospace');
            }
        });

        // Dashed connectors
        connectors.forEach(c => {
            this._arrow(c.fx, c.fy, c.tx, c.ty, 'rgba(100,116,139,0.3)', false, true);
        });

        // Tree label
        if (treeNodes.length && zoom >= 0.5) {
            this._label('Heap Tree', treeNodes[0].x, treeNodes[0].y - 18,
                SEM.textSec, '600 10px Inter, sans-serif', 'left');
        }

        // Tree edges
        treeEdges.forEach(e => {
            this._arrow(e.fx, e.fy, e.tx, e.ty, 'rgba(236,72,153,0.45)', false);
        });

        // Tree nodes
        treeNodes.forEach(n => {
            const isRoot = n.index === 0;
            if (isRoot) { this.ctx.shadowColor = SEM.accentGlow; this.ctx.shadowBlur = 12; }
            this._roundRect(n.x, n.y, n.w, n.h, 8,
                isRoot ? pal.head : pal.fill,
                pal.stroke, isRoot ? 2 : 1.5);
            this.ctx.shadowBlur = 0;
            if (zoom >= 0.45) {
                this._label(String(n.val), n.x + n.w/2, n.y + n.h/2, SEM.textPri);
            }
        });
    }

    // ── DRAW: Graph ───────────────────────────────────────────────────────────
    drawGraph(layout, zoom, selectedId) {
        const { nodes, edges } = layout;
        const pal = SEM.graph;

        // Edges first
        edges.forEach(e => {
            this._arrow(e.fx, e.fy, e.tx, e.ty, 'rgba(59,130,246,0.5)', false);
        });

        // Nodes as circles
        nodes.forEach(n => {
            const sel = n.id === selectedId;
            if (sel) { this.ctx.shadowColor = SEM.accentGlow; this.ctx.shadowBlur = 16; }

            this.ctx.fillStyle   = sel ? pal.head : pal.fill;
            this.ctx.strokeStyle = sel ? '#93C5FD' : pal.stroke;
            this.ctx.lineWidth   = sel ? 2.5 : 1.8;
            this.ctx.beginPath();
            this.ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();
            this.ctx.shadowBlur = 0;

            if (zoom >= 0.45) {
                this._label(String(n.label), n.x, n.y, SEM.textPri);
            }
        });
    }

    // ── DRAW: Hash Map ────────────────────────────────────────────────────────
    drawHashMap(layout, zoom) {
        const { entries } = layout;
        if (!entries.length) return;
        const pal = SEM.map;

        if (zoom >= 0.5) {
            this._label('Key', entries[0].x + 60, entries[0].y - 18, SEM.textSec,
                '600 10px Inter, sans-serif');
            this._label('Value', entries[0].ex + 80, entries[0].y - 18, SEM.textSec,
                '600 10px Inter, sans-serif');
        }

        entries.forEach((e, i) => {
            // Key cell
            this._roundRect(e.x, e.y, e.w, e.h, [6,0,0,6], i % 2 === 0 ? pal.head : pal.fill, pal.stroke);
            // Value cell
            this._roundRect(e.ex, e.y, e.ew, e.h, [0,6,6,0], pal.fill, pal.stroke);
            // Arrow
            this._arrow(e.x + e.w, e.y + e.h/2, e.ex, e.y + e.h/2, SEM.arrowFill, false);

            if (zoom >= 0.45) {
                this._label(String(e.key), e.x + e.w/2, e.y + e.h/2, SEM.textPri);
                this._label(String(e.val), e.ex + e.ew/2, e.y + e.h/2, SEM.textPri);
            }

            // Row index
            if (zoom >= 0.65) {
                this._label(`[${i}]`, e.x - 18, e.y + e.h/2, SEM.textSec,
                    '400 10px Fira Code, monospace', 'right');
            }
        });
    }
}
