#pragma once

#include "Redis_batch_worker.h"
#include <atomic>

class DetectionWorker {
public:
    explicit DetectionWorker(BatchQueue& queue);

    void run();
    void stop();

private:
    BatchQueue& queue;
    std::atomic<bool> running{true};

    bool isSuspicious(const StreamEvent& event);
};
