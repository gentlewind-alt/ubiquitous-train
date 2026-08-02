#pragma once

#include <functional>
#include <unordered_map>
#include <vector>
#include <typeindex>
#include <memory>
#include <iostream>

namespace rve::events {

    // --- Base Event ---
    struct Event {
        virtual ~Event() = default;
    };

    // --- Event Categories (Priority 3 definition) ---
    // 1. Runtime Events
    struct ObjectCreatedEvent : public Event {
        std::string runtime_object_id;
        std::string language_type;
    };

    struct ReferenceCreatedEvent : public Event {
        std::string source_runtime_id;
        std::string target_runtime_id;
    };

    // 2. Visualization Events
    struct MoveEvent : public Event {
        std::string entity_id;
        float new_x;
        float new_y;
    };

    // 3. Timeline Events
    struct PlayEvent : public Event {};
    struct PauseEvent : public Event {};
    struct SeekEvent : public Event {
        uint64_t target_timestamp;
    };

    // --- Event Bus ---
    class EventBus {
    private:
        // Base listener interface to store in our generic map
        struct IListener {
            virtual ~IListener() = default;
        };

        // Typed listener wrapper
        template<typename TEvent>
        struct Listener : public IListener {
            std::function<void(const TEvent&)> callback;
            Listener(std::function<void(const TEvent&)> cb) : callback(cb) {}
        };

        std::unordered_map<std::type_index, std::vector<std::shared_ptr<IListener>>> listeners;

    public:
        // Subscribe to a specific event type
        template<typename TEvent>
        void subscribe(std::function<void(const TEvent&)> callback) {
            auto listener = std::make_shared<Listener<TEvent>>(callback);
            listeners[typeid(TEvent)].push_back(listener);
        }

        // Publish an event to all subscribers
        template<typename TEvent>
        void publish(const TEvent& event) {
            auto it = listeners.find(typeid(TEvent));
            if (it != listeners.end()) {
                for (auto& baseListener : it->second) {
                    auto listener = std::static_pointer_cast<Listener<TEvent>>(baseListener);
                    listener->callback(event);
                }
            }
        }
    };

} // namespace rve::events
