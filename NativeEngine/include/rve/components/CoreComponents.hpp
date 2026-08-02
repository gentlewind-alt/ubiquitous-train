#pragma once

#include <string>
#include <vector>
#include "../ecs/ECS.hpp"

namespace rve::components {

    struct Transform {
        float x = 0.0f;
        float y = 0.0f;
        float scale = 1.0f;
        float rotation = 0.0f;
    };

    struct Shape {
        enum class Type { Rectangle, Circle, Line, Arrow };
        Type type;
        std::string color;
        float width = 50.0f;
        float height = 50.0f;
    };

    struct Text {
        std::string content;
        std::string font_family;
        int font_size = 14;
        std::string color = "#FFFFFF";
    };

    struct Metadata {
        std::string runtime_object_id;
        std::string python_object_id;
        std::string python_type;
        std::string memory_address;
    };

    struct Connection {
        std::vector<rve::ecs::Entity> targets;
        bool directed = true;
    };

    struct Animation {
        float duration_ms = 0.0f;
        float elapsed_ms = 0.0f;
        bool is_playing = false;
        // Animation graph state would go here
    };

} // namespace rve::components
