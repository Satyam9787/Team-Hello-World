#include "Network_detection.h"

#include <iostream>
#include <utility>

NetworkDetectionWorker::NetworkDetectionWorker(
    BatchQueue& eventQueue,
    CompletedBatchQueue& completedQueueRef
)
    : queue(eventQueue),
      completedQueue(completedQueueRef) {
}

void NetworkDetectionWorker::stop() {
    running.store(false);
}

void NetworkDetectionWorker::run() {

    std::cout << "[NetworkDetectionWorker] Started\n";

    while (running.load()) {

        EventBatch batch;

        if (!queue.pop(batch)) {
            break;
        }

        if (batch.empty()) {
            continue;
        }

        std::cout
            << "[NetworkDetectionWorker] Received batch: "
            << batch.size()
            << " network events\n";

        // Preserve original network event payloads.
        // Network classification will be added later.

        if (!completedQueue.push(std::move(batch))) {

            std::cerr
                << "[NetworkDetectionWorker] Failed to push completed batch\n";

            break;
        }

        std::cout
            << "[NetworkDetectionWorker] Batch saved for frontend\n";
    }

    std::cout << "[NetworkDetectionWorker] Stopped\n";
}
