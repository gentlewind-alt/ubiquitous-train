#pragma once

#include <vector>
#include <functional>
#include <string>
#include <algorithm>
#include <cmath>
#include <iostream>
#include "../ecs/ECS.hpp"
#include "../components/CoreComponents.hpp"

namespace rve::animation {

    // --- Easing Functions ---
    enum class Easing {
        Linear,
        EaseInQuad,
        EaseOutQuad,
        EaseInOutQuad
    };

    inline float applyEasing(float t, Easing easing) {
        switch (easing) {
            case Easing::EaseInQuad: return t * t;
            case Easing::EaseOutQuad: return t * (2.0f - t);
            case Easing::EaseInOutQuad: return t < 0.5f ? 2.0f * t * t : -1.0f + (4.0f - 2.0f * t) * t;
            case Easing::Linear:
            default: return t;
        }
    }

    // --- Animation Track / Node in Graph ---
    struct PropertyTween {
        rve::ecs::Entity target_entity;
        std::string property_name; // "x", "y", "scale", etc.
        float start_value;
        float end_value;
        float duration_ms;
        float elapsed_ms = 0.0f;
        Easing easing = Easing::Linear;
        bool completed = false;
    };

    // --- Animation Graph Node ---
    struct AnimationNode {
        std::string id;
        std::vector<PropertyTween> tweens;
        std::vector<std::string> next_node_ids; // Graph transitions (Sequence / Branching)
    };

    // --- Animation Engine & Scheduler System ---
    class AnimationSystem : public rve::ecs::System {
    private:
        std::vector<PropertyTween> active_tweens;

    public:
        void addTween(const PropertyTween& tween) {
            active_tweens.push_back(tween);
        }

        void update(rve::ecs::World& world, float delta_time_ms) {
            for (auto& tween : active_tweens) {
                if (tween.completed) continue;

                tween.elapsed_ms += delta_time_ms;
                float progress = std::min(1.0f, tween.elapsed_ms / tween.duration_ms);
                float easedProgress = applyEasing(progress, tween.easing);

                // Lerp Interpolation
                float currentValue = tween.start_value + (tween.end_value - tween.start_value) * easedProgress;

                // Apply to Target Entity Component
                if (tween.property_name == "x" || tween.property_name == "y") {
                    auto& transform = world.getComponent<rve::components::Transform>(tween.target_entity);
                    if (tween.property_name == "x") transform.x = currentValue;
                    if (tween.property_name == "y") transform.y = currentValue;
                }

                if (progress >= 1.0f) {
                    tween.completed = true;
                }
            }

            // Clean up completed tweens
            active_tweens.erase(
                std::remove_if(active_tweens.begin(), active_tweens.end(), [](const PropertyTween& t) { return t.completed; }),
                active_tweens.end()
            );
        }

        bool hasActiveAnimations() const {
            return !active_tweens.empty();
        }
    };

} // namespace rve::animation
