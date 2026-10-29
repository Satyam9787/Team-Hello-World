#include "Detection_worker.h"
#include "crow.h"

#include <iostream>
#include <vector>

DetectionWorker::DetectionWorker(BatchQueue& eventQueue)
    : queue(eventQueue) {
}

void DetectionWorker::stop() {
    running.store(false);
}

bool DetectionWorker::isSuspicious(const StreamEvent& event) {
    auto json = crow::json::load(event.payload);

    if (!json) {
        std::cerr << "[Detection] Invalid JSON, event ID: "
                  << event.id << '\n';
        return false;
    }

    // TEST RULE ONLY:
    // A real detection rule will be added later.
    if (json.has("test_suspicious")) {
        return json["test_suspicious"].b();
    }

    return false;
}

void DetectionWorker::run() {
    std::cout << "[DetectionWorker] Started\n";

    while (running.load()) {
        EventBatch batch;

        if (!queue.pop(batch)) {
            break;
        }

        std::vector<StreamEvent> suspiciousEvents;

        // Scan the complete batch.
        for (const auto& event : batch) {
            auto json = crow::json::load(event.payload);

            if (!json) {
                std::cerr << "[Detection] Invalid JSON: "
                          << event.id << '\n';
                continue;
            }

            std::cout
                << "[Detection] Event: "
                << json["event"].s()
                << " | PID: "
                << json["pid"].i()
                << " | PPID: "
                << json["ppid"].i()
                << " | Process: "
                << json["comm"].s()
                << '\n';

            if (isSuspicious(event)) {
                suspiciousEvents.push_back(event);
            }
        }

        std::cout
            << "[DetectionWorker] Scanned "
            << batch.size()
            << " events; suspicious matches: "
            << suspiciousEvents.size()
            << '\n';

        if (!suspiciousEvents.empty()) {
            std::cout
                << "[DetectionWorker] Suspicious batch:\n";

            for (const auto& event : suspiciousEvents) {
                std::cout << event.payload << '\n';
            }
        }
    }

    std::cout << "[DetectionWorker] Stopped\n";
}
