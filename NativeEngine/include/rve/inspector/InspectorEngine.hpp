#pragma once

#include <iostream>
#include <string>
#include <vector>
#include <sstream>
#include "../ecs/ECS.hpp"
#include "../components/CoreComponents.hpp"

namespace rve::inspector {

    struct InspectionReport {
        rve::ecs::Entity entity_id;
        std::string runtime_object_id;
        std::string python_object_id;
        std::string python_type;
        std::string memory_address;
        
        // Geometry & Visuals
        float position_x;
        float position_y;
        std::string shape_type;
        std::string shape_color;
        std::string label;
        
        // Structural Relationships
        std::vector<rve::ecs::Entity> child_connections;
        
        std::string to_json() const {
            std::stringstream ss;
            ss << "{\n"
               << "  \"inspect_target\": {\n"
               << "    \"entity_id\": " << entity_id << ",\n"
               << "    \"runtime_object_id\": \"" << runtime_object_id << "\",\n"
               << "    \"python_object_id\": \"" << python_object_id << "\",\n"
               << "    \"python_type\": \"" << python_type << "\",\n"
               << "    \"memory_address\": \"" << memory_address << "\"\n"
               << "  },\n"
               << "  \"visual_state\": {\n"
               << "    \"transform\": {\"x\": " << position_x << ", \"y\": " << position_y << "},\n"
               << "    \"shape\": {\"type\": \"" << shape_type << "\", \"color\": \"" << shape_color << "\"},\n"
               << "    \"text\": \"" << label << "\"\n"
               << "  },\n"
               << "  \"outgoing_references_count\": " << child_connections.size() << "\n"
               << "}";
            return ss.str();
        }
    };

    // --- DevTools Inspector System ---
    class InspectorSystem : public rve::ecs::System {
    public:
        InspectionReport inspectEntity(rve::ecs::World& world, rve::ecs::Entity entity) {
            InspectionReport report;
            report.entity_id = entity;

            // Inspect Metadata Component
            try {
                auto& meta = world.getComponent<rve::components::Metadata>(entity);
                report.runtime_object_id = meta.runtime_object_id;
                report.python_object_id = meta.python_object_id;
                report.python_type = meta.python_type;
                report.memory_address = meta.memory_address;
            } catch (...) {
                report.python_type = "Unknown / Untracked";
            }

            // Inspect Transform Component
            try {
                auto& transform = world.getComponent<rve::components::Transform>(entity);
                report.position_x = transform.x;
                report.position_y = transform.y;
            } catch (...) {}

            // Inspect Shape Component
            try {
                auto& shape = world.getComponent<rve::components::Shape>(entity);
                report.shape_color = shape.color;
                report.shape_type = (shape.type == rve::components::Shape::Type::Circle) ? "Circle" : "Rectangle";
            } catch (...) {}

            // Inspect Text Component
            try {
                auto& text = world.getComponent<rve::components::Text>(entity);
                report.label = text.content;
            } catch (...) {}

            // Inspect Connection Component
            try {
                auto& conn = world.getComponent<rve::components::Connection>(entity);
                report.child_connections = conn.targets;
            } catch (...) {}

            return report;
        }
    };

} // namespace rve::inspector
