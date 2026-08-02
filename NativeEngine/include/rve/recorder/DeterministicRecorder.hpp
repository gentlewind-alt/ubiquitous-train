#pragma once

#include <vector>
#include <string>
#include <fstream>
#include <iostream>
#include <algorithm>
#include "../events/EventBus.hpp"

namespace rve::recorder {

    // --- Recorded Event Frame ---
    struct RecordedFrame {
        uint64_t timestamp;
        std::string event_type;
        std::string payload_json;
    };

    // --- Deterministic Recorder & Time Travel Engine ---
    class DeterministicRecorder {
    private:
        std::vector<RecordedFrame> history;
        size_t current_head = 0; // Current playhead position in history

    public:
        // Record a new state mutation event
        void record(uint64_t timestamp, const std::string& event_type, const std::string& payload_json) {
            // If recording after an undo/time-travel, truncate forward history
            if (current_head < history.size()) {
                history.erase(history.begin() + current_head, history.end());
            }

            history.push_back({timestamp, event_type, payload_json});
            current_head = history.size();
        }

        // --- Time Travel APIs ---
        bool stepForward() {
            if (current_head < history.size()) {
                current_head++;
                std::cout << "[Recorder] Stepped Forward to Frame " << current_head << "/" << history.size() << "\n";
                return true;
            }
            return false; // Already at latest
        }

        bool stepBackward() {
            if (current_head > 0) {
                current_head--;
                std::cout << "[Recorder] Stepped Backward (Undo) to Frame " << current_head << "/" << history.size() << "\n";
                return true;
            }
            return false; // Already at start
        }

        void seekToFrame(size_t frame_index) {
            current_head = std::min(frame_index, history.size());
            std::cout << "[Recorder] Seeked to Frame " << current_head << "/" << history.size() << "\n";
        }

        // --- Save / Share (.rve file export) ---
        bool exportRVEFile(const std::string& filepath) {
            std::ofstream file(filepath);
            if (!file.is_open()) return false;

            file << "{\n  \"rve_format_version\": \"1.0.0\",\n  \"total_frames\": " << history.size() << ",\n  \"timeline\": [\n";
            for (size_t i = 0; i < history.size(); ++i) {
                const auto& frame = history[i];
                file << "    {\"frame\": " << i << ", \"timestamp\": " << frame.timestamp 
                     << ", \"type\": \"" << frame.event_type << "\", \"data\": " << frame.payload_json << "}";
                if (i + 1 < history.size()) file << ",";
                file << "\n";
            }
            file << "  ]\n}\n";

            std::cout << "[Recorder] Successfully exported .rve recording session to: " << filepath << "\n";
            return true;
        }

        size_t getFrameCount() const { return history.size(); }
        size_t getCurrentHead() const { return current_head; }
    };

} // namespace rve::recorder
