#pragma once

#include <cstdint>
#include <vector>
#include <unordered_map>
#include <memory>
#include <typeindex>
#include <bitset>
#include <iostream>
#include <algorithm>

namespace rve::ecs {

    // 1. ENTITY
    // An Entity is purely a unique identifier. It contains no data or logic.
    using Entity = uint32_t;
    const Entity MAX_ENTITIES = 100000;
    const size_t MAX_COMPONENTS = 32;

    // A bitmask representing which components an entity has.
    using Signature = std::bitset<MAX_COMPONENTS>;

    // 2. COMPONENT
    // Base class for component type identification
    struct IComponentArray {
        virtual ~IComponentArray() = default;
        virtual void entityDestroyed(Entity entity) = 0;
    };

    // A packed array to store components contiguously in memory for fast iteration
    template<typename T>
    class ComponentArray : public IComponentArray {
    private:
        std::vector<T> componentArray;
        std::unordered_map<Entity, size_t> entityToIndexMap;
        std::unordered_map<size_t, Entity> indexToEntityMap;
        size_t size;

    public:
        ComponentArray() : size(0) {
            componentArray.resize(MAX_ENTITIES);
        }

        void insertData(Entity entity, T component) {
            size_t newIndex = size;
            entityToIndexMap[entity] = newIndex;
            indexToEntityMap[newIndex] = entity;
            componentArray[newIndex] = component;
            size++;
        }

        void removeData(Entity entity) {
            // Move the last element into the deleted element's place to keep array packed
            size_t indexOfRemovedEntity = entityToIndexMap[entity];
            size_t indexOfLastElement = size - 1;
            componentArray[indexOfRemovedEntity] = componentArray[indexOfLastElement];

            // Update maps
            Entity entityOfLastElement = indexToEntityMap[indexOfLastElement];
            entityToIndexMap[entityOfLastElement] = indexOfRemovedEntity;
            indexToEntityMap[indexOfRemovedEntity] = entityOfLastElement;

            entityToIndexMap.erase(entity);
            indexToEntityMap.erase(indexOfLastElement);
            size--;
        }

        T& getData(Entity entity) {
            return componentArray[entityToIndexMap[entity]];
        }

        void entityDestroyed(Entity entity) override {
            if (entityToIndexMap.find(entity) != entityToIndexMap.end()) {
                removeData(entity);
            }
        }
    };

    // 3. SYSTEM
    // Systems contain logic and iterate over entities that match their Signature.
    class System {
    public:
        std::vector<Entity> mEntities;
    };

    // 4. WORLD
    // The central registry that orchestrates Entities, Components, and Systems.
    class World {
    private:
        Entity nextEntity = 0;
        std::vector<Signature> signatures;

        // Component Management
        std::unordered_map<std::type_index, uint8_t> componentTypes;
        std::unordered_map<std::type_index, std::shared_ptr<IComponentArray>> componentArrays;
        uint8_t nextComponentType = 0;

        // System Management
        std::unordered_map<std::type_index, std::shared_ptr<System>> systems;

    public:
        World() {
            signatures.resize(MAX_ENTITIES);
        }

        Entity createEntity() {
            Entity id = nextEntity++;
            return id;
        }

        void destroyEntity(Entity entity) {
            signatures[entity].reset();
            for (auto const& pair : componentArrays) {
                auto const& component = pair.second;
                component->entityDestroyed(entity);
            }
            // Remove from systems
            for (auto const& pair : systems) {
                auto const& system = pair.second;
                system->mEntities.erase(
                    std::remove(system->mEntities.begin(), system->mEntities.end(), entity),
                    system->mEntities.end()
                );
            }
        }

        // Component Registration
        template<typename T>
        void registerComponent() {
            componentTypes[typeid(T)] = nextComponentType++;
            componentArrays[typeid(T)] = std::make_shared<ComponentArray<T>>();
        }

        template<typename T>
        void addComponent(Entity entity, T component) {
            getComponentArray<T>()->insertData(entity, component);
            auto signature = signatures[entity];
            signature.set(componentTypes[typeid(T)], true);
            signatures[entity] = signature;
            updateEntitySignatures(entity, signature);
        }

        template<typename T>
        T& getComponent(Entity entity) {
            return getComponentArray<T>()->getData(entity);
        }

        // System Registration
        template<typename T>
        std::shared_ptr<T> registerSystem(Signature signature) {
            auto system = std::make_shared<T>();
            systems[typeid(T)] = system;
            return system;
        }

    private:
        template<typename T>
        std::shared_ptr<ComponentArray<T>> getComponentArray() {
            return std::static_pointer_cast<ComponentArray<T>>(componentArrays[typeid(T)]);
        }

        void updateEntitySignatures(Entity entity, Signature entitySignature) {
            for (auto const& pair : systems) {
                auto const& type = pair.first;
                auto const& system = pair.second;
                // Hardcoded signature check for MVP. In reality, Systems register their required Signature.
                system->mEntities.push_back(entity); 
            }
        }
    };

} // namespace rve::ecs
