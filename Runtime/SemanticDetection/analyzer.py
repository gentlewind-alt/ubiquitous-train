import json
import os
from typing import Dict, List, Set

class SemanticAnalyzer:
    def __init__(self, input_file: str = ".rve/recordings/session.jsonl", output_scene: str = ".rve/scenes/current_scene.json"):
        self.input_file = input_file
        self.output_scene = output_scene
        
        self.objects: Dict[str, dict] = {} # runtime_object_id -> metadata
        self.adjacency: Dict[str, List[str]] = {} # source_id -> [target_ids]
        
        os.makedirs(os.path.dirname(output_scene), exist_ok=True)

    def consume_runtime_ir(self):
        """Reads the raw Runtime IR events and builds an internal graph."""
        with open(self.input_file, 'r') as f:
            for line in f:
                if not line.strip(): continue
                event = json.loads(line)
                
                if event["type"] == "ObjectCreated":
                    data = event["data"]
                    obj_id = data["runtime_object_id"]
                    if obj_id != "null":
                        self.objects[obj_id] = data
                        self.adjacency[obj_id] = []
                        
                elif event["type"] == "ReferenceCreated":
                    data = event["data"]
                    src = data["source_runtime_id"]
                    tgt = data["target_runtime_id"]
                    if src in self.adjacency:
                        self.adjacency[src].append(tgt)

    def _detect_structures(self):
        """
        Pattern matching logic. 
        In a real engine, this would run continuously. Here we run it once for the MVP snapshot.
        """
        # MVP: Treat every object as a Node entity, and references as ConnectionComponents
        entities = []
        
        for obj_id, data in self.objects.items():
            # Create a base ECS Entity for the object
            entity = {
                "entity_id": f"ent_{obj_id}",
                "runtime_object_id": obj_id,
                "python_object_id": data.get("language_object_id"),
                "components": {
                    "TransformComponent": {
                        "x": 0, "y": 0 # LayoutSystem will overwrite this later
                    },
                    "ShapeComponent": {
                        "type": "Rectangle" if data.get("language_type") == "list" else "Circle",
                        "color": "#4CAF50"
                    },
                    "TextComponent": {
                        "label": f"{data.get('language_type')} ({data.get('memory_address')})"
                    }
                }
            }
            
            # If it has outgoing references, add a ConnectionComponent
            targets = self.adjacency.get(obj_id, [])
            if targets:
                entity["components"]["ConnectionComponent"] = {
                    "edges": [{"target_entity_id": f"ent_{t}"} for t in targets]
                }
                
            entities.append(entity)
            
        return entities

    def generate_visualization_ir(self):
        """Emits the Visualization SDK Scene Graph (ECS format)."""
        entities = self._detect_structures()
        
        scene = {
            "scene_id": "scene_001",
            "metadata": {"description": "Auto-generated from Semantic Analysis"},
            "camera": {"x": 0, "y": 0, "zoom": 1.0},
            "systems": ["RenderSystem", "LayoutSystem", "ConnectionSystem"],
            "constraints": [
                {
                    "type": "EqualSiblingSpacing",
                    "target_entities": [e["entity_id"] for e in entities]
                }
            ],
            "entities": entities
        }
        
        payload = {
            "sdk_version": "1.0.0",
            "scene_version": 1,
            "engine_version": "0.1.0",
            "scene": scene
        }
        
        with open(self.output_scene, 'w') as f:
            json.dump(payload, f, indent=2)
            
        return payload

if __name__ == "__main__":
    analyzer = SemanticAnalyzer()
    analyzer.consume_runtime_ir()
    analyzer.generate_visualization_ir()
    print("Semantic analysis complete. ECS Scene Graph generated at .rve/scenes/current_scene.json")
