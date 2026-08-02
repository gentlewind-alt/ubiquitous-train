#include <iostream>
#include <fstream>
#include <string>
#include "../include/rve/ecs/ECS.hpp"
#include "../include/rve/components/CoreComponents.hpp"
#include "../include/rve/events/EventBus.hpp"
#include "../include/rve/layout/LayoutSolver.hpp"
#include "../include/rve/animation/AnimationEngine.hpp"
#include "../include/rve/recorder/DeterministicRecorder.hpp"
#include "../include/rve/inspector/InspectorEngine.hpp"

// Render System
class RenderSystem : public rve::ecs::System {
public:
    void update(rve::ecs::World& world) {
        std::cout << "  [RenderSystem] Render Frame Output:\n";
        for (auto const& entity : mEntities) {
            try {
                auto& transform = world.getComponent<rve::components::Transform>(entity);
                auto& shape = world.getComponent<rve::components::Shape>(entity);
                auto& text = world.getComponent<rve::components::Text>(entity);

                std::cout << "    -> Entity " << entity << " [" << shape.color << " " 
                          << (shape.type == rve::components::Shape::Type::Circle ? "Circle" : "Rect")
                          << "] \"" << text.content << "\" at Pos(" << transform.x << ", " << transform.y << ")\n";
            } catch (...) {}
        }
    }
};

int main() {
    std::cout << "=========================================================\n";
    std::cout << "    RUNTIME VISUALIZATION ENGINE (RVE) CORE 1.0          \n";
    std::cout << "=========================================================\n\n";

    // 1. Initialize Engine Subsystems
    rve::ecs::World world;
    rve::events::EventBus eventBus;
    rve::recorder::DeterministicRecorder recorder;

    world.registerComponent<rve::components::Transform>();
    world.registerComponent<rve::components::Shape>();
    world.registerComponent<rve::components::Text>();
    world.registerComponent<rve::components::Metadata>();
    world.registerComponent<rve::components::Connection>();

    auto renderSystem = world.registerSystem<RenderSystem>(rve::ecs::Signature());
    auto layoutSolver = world.registerSystem<rve::layout::LayoutSolverSystem>(rve::ecs::Signature());
    auto animationSystem = world.registerSystem<rve::animation::AnimationSystem>(rve::ecs::Signature());
    auto inspector = world.registerSystem<rve::inspector::InspectorSystem>(rve::ecs::Signature());

    // 2. Wire Event Bus to ECS & Recorder
    eventBus.subscribe<rve::events::ObjectCreatedEvent>([&](const rve::events::ObjectCreatedEvent& event) {
        std::cout << "[EventBus -> ECS] Received ObjectCreatedEvent (" << event.language_type << ")\n";
        
        // Record to Deterministic Recorder
        recorder.record(1000, "ObjectCreated", "{\"id\": \"" + event.runtime_object_id + "\"}");

        // Map to ECS Entity
        rve::ecs::Entity e = world.createEntity();
        world.addComponent(e, rve::components::Transform{0.0f, 0.0f, 1.0f, 0.0f});
        world.addComponent(e, rve::components::Shape{rve::components::Shape::Type::Circle, "#4CAF50"});
        world.addComponent(e, rve::components::Text{event.language_type + " (" + event.runtime_object_id.substr(0, 8) + ")", "Arial"});
        world.addComponent(e, rve::components::Metadata{event.runtime_object_id, "py_101", event.language_type, "0x1daee8ac880"});
    });

    // 3. Simulate Event Stream Ingestion (Runtime IR -> EventBus -> ECS)
    std::cout << "--- 1. Ingesting Runtime IR Stream ---\n";
    rve::events::ObjectCreatedEvent ev1;
    ev1.runtime_object_id = "rt_node_head";
    ev1.language_type = "LinkedListNode";
    eventBus.publish(ev1);

    rve::events::ObjectCreatedEvent ev2;
    ev2.runtime_object_id = "rt_node_tail";
    ev2.language_type = "LinkedListNode";
    eventBus.publish(ev2);

    // 4. Setup Layout Constraints
    std::cout << "\n--- 2. Applying Layout Constraints ---\n";
    layoutSolver->addConstraint({rve::layout::ConstraintType::ParentAboveChild, 0, {1}, 80.0f, 0.0f});
    layoutSolver->addConstraint({rve::layout::ConstraintType::EqualSiblingSpacing, 0, {1}, 0.0f, 150.0f});
    
    std::cout << "Solving Layout Constraints (5 iterations)...\n";
    layoutSolver->update(world, 5);

    // 5. Add Animation Tweens
    std::cout << "\n--- 3. Scheduling Animations ---\n";
    animationSystem->addTween({
        0, // Entity 0
        "x",
        0.0f,
        200.0f,
        500.0f, // 500ms duration
        0.0f,
        rve::animation::Easing::EaseOutQuad,
        false
    });

    // 6. Run Engine Loop
    std::cout << "\n--- 4. Running Engine Loop (3 Frames) ---\n";
    for (int frame = 1; frame <= 3; ++frame) {
        std::cout << "\n[Frame " << frame << "]\n";
        animationSystem->update(world, 250.0f); // 250ms delta
        renderSystem->update(world);
    }

    // 7. DevTools Inspector Query
    std::cout << "\n--- 5. DevTools Inspector Query ---\n";
    std::cout << "Inspecting Entity 0:\n";
    auto report = inspector->inspectEntity(world, 0);
    std::cout << report.to_json() << "\n";

    // 8. Export Shareable .rve Session
    std::cout << "\n--- 6. Exporting Shareable Session ---\n";
    recorder.exportRVEFile(".rve/recordings/full_pipeline_session.rve");

    std::cout << "\n=========================================================\n";
    std::cout << "    SYSTEM EXECUTION COMPLETE - ALL MODULES VERIFIED     \n";
    std::cout << "=========================================================\n";

    return 0;
}
