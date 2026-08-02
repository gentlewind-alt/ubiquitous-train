import sys
import time
import json
import uuid
import os
import gc
from typing import Any, Dict, Set, Tuple

class RuntimeTracer:
    def __init__(self, output_file: str = ".rve/recordings/session.jsonl"):
        self.output_file = output_file
        self.object_registry: Dict[int, str] = {} # Python id() -> runtime_object_id
        self.tracked_objects: Dict[int, Any] = {} # Python id() -> actual object (MVP)
        self.known_references: Set[Tuple[int, int]] = set() # (source_id, target_id)
        
        os.makedirs(os.path.dirname(output_file), exist_ok=True)
        with open(self.output_file, 'w') as f:
            pass

    def _emit_event(self, event_type: str, data: dict):
        event = {
            "timestamp": int(time.time() * 1000),
            "category": "Runtime",
            "type": event_type,
            "data": data
        }
        with open(self.output_file, 'a') as f:
            f.write(json.dumps(event) + "\n")

    def _track_object(self, obj: Any, var_name: str, frame) -> str:
        py_id = id(obj)
        if py_id not in self.object_registry:
            runtime_id = str(uuid.uuid4())
            self.object_registry[py_id] = runtime_id
            self.tracked_objects[py_id] = obj
            
            self._emit_event("ObjectCreated", {
                "runtime_object_id": runtime_id,
                "language_object_id": str(py_id),
                "language_type": type(obj).__name__,
                "memory_address": hex(py_id),
                "reference_count": sys.getrefcount(obj),
                "source_file": frame.f_code.co_filename,
                "line_number": frame.f_lineno
            })
            return runtime_id
        return self.object_registry[py_id]

    def _scan_references(self):
        # MVP: Scan all tracked objects for new references
        for src_py_id, src_obj in list(self.tracked_objects.items()):
            referents = gc.get_referents(src_obj)
            for target_obj in referents:
                target_py_id = id(target_obj)
                # Only track references between objects we are actively monitoring
                if target_py_id in self.tracked_objects:
                    ref_tuple = (src_py_id, target_py_id)
                    if ref_tuple not in self.known_references:
                        self.known_references.add(ref_tuple)
                        self._emit_event("ReferenceCreated", {
                            "source_runtime_id": self.object_registry[src_py_id],
                            "target_runtime_id": self.object_registry[target_py_id],
                            "source_language_id": str(src_py_id),
                            "target_language_id": str(target_py_id)
                        })

    def _trace_lines(self, frame, event, arg):
        if event == "line":
            for var_name, obj in frame.f_locals.items():
                if not var_name.startswith("__"):
                    self._track_object(obj, var_name, frame)
            
            self._scan_references()
            
        elif event == "return":
            self._emit_event("FunctionReturned", {
                "runtime_object_id": "null",
                "language_object_id": "null",
                "language_type": "null",
                "function_name": frame.f_code.co_name
            })
        return self._trace_lines

    def _trace_calls(self, frame, event, arg):
        if event == "call":
            if "python" in frame.f_code.co_filename.lower() or "<" in frame.f_code.co_filename:
                return None
            
            self._emit_event("FunctionCalled", {
                "runtime_object_id": "null",
                "language_object_id": "null",
                "language_type": "null",
                "function_name": frame.f_code.co_name,
                "source_file": frame.f_code.co_filename,
                "line_number": frame.f_lineno
            })
            return self._trace_lines
        return None

    def start(self):
        sys.settrace(self._trace_calls)

    def stop(self):
        sys.settrace(None)
        # Final scan to catch references made on the last line
        self._scan_references()

# --- Example Usage ---
if __name__ == "__main__":
    tracer = RuntimeTracer()
    tracer.start()
    
    def create_linked_list():
        node1 = [1]
        node2 = [2]
        node1.append(node2) # Reference Created!
        
    create_linked_list()
    
    tracer.stop()
    print("Execution complete. Check .rve/recordings/session.jsonl for Runtime IR.")
