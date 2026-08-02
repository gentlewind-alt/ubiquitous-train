# Runtime Visualization Engine (RVE) Core 1.0

A language-agnostic, event-driven, constraint-based runtime visualization platform built on an Entity-Component-System (ECS) architecture.

---

## Architecture Overview

1. **Python Runtime Adapter (`Runtime/Instrumentation/tracer.py`)**: Intercepts code execution using `sys.settrace` & `gc.get_referents()` and streams raw memory events to `.rve/recordings/session.jsonl` (Runtime IR).
2. **Semantic Analysis Engine (`Runtime/SemanticDetection/analyzer.py`)**: Consumes the Runtime IR stream, detects data structure relationships, and compiles a language-agnostic ECS Scene Graph snapshot at `.rve/scenes/current_scene.json` (Visualization IR).
3. **C++ Native Visualization Engine (`NativeEngine/src/main.cpp`)**: Consumes the Visualization IR/Event Bus, runs the ECS, solves layout constraints via the **Layout Engine**, interpolates animations using the **Animation Engine**, provides DevTools state inspection, and exports shareable `.rve` recording sessions.

---

## Prerequisites

* **Python 3.8+**
* **C++17 Compiler** (`g++`, `clang++`, or `MSVC`)

---

## Runnable Instructions

### All-in-One Command

#### PowerShell (Windows):
```powershell
python Runtime\Instrumentation\tracer.py; python Runtime\SemanticDetection\analyzer.py; g++ -std=c++17 NativeEngine\src\main.cpp -o NativeEngine\engine.exe; .\NativeEngine\engine.exe
```

#### Bash (Linux / macOS):
```bash
python3 Runtime/Instrumentation/tracer.py && python3 Runtime/SemanticDetection/analyzer.py && g++ -std=c++17 NativeEngine/src/main.cpp -o NativeEngine/engine && ./NativeEngine/engine
```

---

## Step-by-Step Execution

### 1. Step 1: Record Python Execution (Runtime IR)
Traces Python memory allocations and pointer references.
```bash
python Runtime/Instrumentation/tracer.py
```
*Output generated:* `.rve/recordings/session.jsonl`

### 2. Step 2: Perform Semantic Analysis (Visualization IR)
Compiles raw memory events into an ECS Scene Graph.
```bash
python Runtime/SemanticDetection/analyzer.py
```
*Output generated:* `.rve/scenes/current_scene.json`

### 3. Step 3: Compile the C++ Engine Core
Compiles the ECS, EventBus, LayoutSolver, AnimationEngine, Inspector, and Recorder.
```bash
g++ -std=c++17 NativeEngine/src/main.cpp -o NativeEngine/engine.exe
```

### 4. Step 4: Run the Engine
Runs frame update loops, solves layout constraints, animates entities, inspects state, and exports `.rve` sessions.
```bash
./NativeEngine/engine.exe
```
*Output generated:* `.rve/recordings/full_pipeline_session.rve`
