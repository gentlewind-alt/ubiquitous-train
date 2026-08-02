#pragma once

#include <vector>
#include <memory>
#include <cmath>
#include <iostream>
#include "../ecs/ECS.hpp"
#include "../components/CoreComponents.hpp"

namespace rve::layout {

    // --- Constraint Types ---
    enum class ConstraintType {
        ParentAboveChild,
        EqualSiblingSpacing,
        MinimumDistance,
        CenterSubtree
    };

    struct Constraint {
        ConstraintType type;
        rve::ecs::Entity parent_id;
        std::vector<rve::ecs::Entity> children_ids;
        float param1 = 50.0f; // e.g. Vertical distance or Minimum distance
        float param2 = 40.0f; // e.g. Horizontal spacing
    };

    // --- Layout Engine (Constraint Solver) ---
    class LayoutSolverSystem : public rve::ecs::System {
    private:
        std::vector<Constraint> constraints;

    public:
        void addConstraint(const Constraint& constraint) {
            constraints.push_back(constraint);
        }

        void clearConstraints() {
            constraints.clear();
        }

        // Iteratively solves constraints until positions converge (Relaxation / Constraint Solver Loop)
        void update(rve::ecs::World& world, int iterations = 5) {
            for (int iter = 0; iter < iterations; ++iter) {
                for (const auto& constraint : constraints) {
                    solveConstraint(world, constraint);
                }
            }
        }

    private:
        void solveConstraint(rve::ecs::World& world, const Constraint& constraint) {
            switch (constraint.type) {
                case ConstraintType::ParentAboveChild: {
                    // Ensures parent Y is param1 distance above all children
                    if (!constraint.children_ids.empty()) {
                        auto& parentTransform = world.getComponent<rve::components::Transform>(constraint.parent_id);
                        for (auto child_id : constraint.children_ids) {
                            auto& childTransform = world.getComponent<rve::components::Transform>(child_id);
                            childTransform.y = parentTransform.y + constraint.param1;
                        }
                    }
                    break;
                }
                case ConstraintType::EqualSiblingSpacing: {
                    // Spaces siblings horizontally centered under parent
                    if (!constraint.children_ids.empty()) {
                        auto& parentTransform = world.getComponent<rve::components::Transform>(constraint.parent_id);
                        size_t n = constraint.children_ids.size();
                        float spacing = constraint.param2;
                        float totalWidth = (n - 1) * spacing;
                        float startX = parentTransform.x - (totalWidth / 2.0f);

                        for (size_t i = 0; i < n; ++i) {
                            auto& childTransform = world.getComponent<rve::components::Transform>(constraint.children_ids[i]);
                            childTransform.x = startX + (i * spacing);
                        }
                    }
                    break;
                }
                case ConstraintType::MinimumDistance: {
                    // Pushes overlapping nodes apart if distance < param1
                    for (size_t i = 0; i < constraint.children_ids.size(); ++i) {
                        for (size_t j = i + 1; j < constraint.children_ids.size(); ++j) {
                            auto& t1 = world.getComponent<rve::components::Transform>(constraint.children_ids[i]);
                            auto& t2 = world.getComponent<rve::components::Transform>(constraint.children_ids[j]);

                            float dx = t2.x - t1.x;
                            float dy = t2.y - t1.y;
                            float dist = std::sqrt(dx * dx + dy * dy);
                            float minDist = constraint.param1;

                            if (dist < minDist && dist > 0.0001f) {
                                float overlap = 0.5f * (minDist - dist);
                                t1.x -= overlap * (dx / dist);
                                t1.y -= overlap * (dy / dist);
                                t2.x += overlap * (dx / dist);
                                t2.y += overlap * (dy / dist);
                            }
                        }
                    }
                    break;
                }
                case ConstraintType::CenterSubtree: {
                    // Centers parent X over the midpoint of its outer children
                    if (!constraint.children_ids.empty()) {
                        auto& parentTransform = world.getComponent<rve::components::Transform>(constraint.parent_id);
                        auto& firstChild = world.getComponent<rve::components::Transform>(constraint.children_ids.front());
                        auto& lastChild = world.getComponent<rve::components::Transform>(constraint.children_ids.back());
                        parentTransform.x = (firstChild.x + lastChild.x) / 2.0f;
                    }
                    break;
                }
            }
        }
    };

} // namespace rve::layout
