#include "Complete_Batch_Queue.h"

#include <utility>

CompletedBatchQueue::CompletedBatchQueue(std::size_t max)
    : maxBatches(max) {}

bool CompletedBatchQueue::push(EventBatch batch) {
    std::unique_lock<std::mutex> lock(mutex);

    notFull.wait(lock, [this] {
        return batches.size() < maxBatches || stopped;
    });

    if (stopped) {
        return false;
    }

    batches.push_back({nextId++, std::move(batch)});
    return true;
}

bool CompletedBatchQueue::peek(CompletedBatch& batch) {
    std::lock_guard<std::mutex> lock(mutex);

    if (batches.empty()) {
        return false;
    }

    batch = batches.front();
    return true;
}

bool CompletedBatchQueue::acknowledge(std::uint64_t id) {
    std::lock_guard<std::mutex> lock(mutex);

    if (batches.empty() || batches.front().id != id) {
        return false;
    }

    batches.pop_front();
    notFull.notify_one();
    return true;
}

void CompletedBatchQueue::stop() {
    {
        std::lock_guard<std::mutex> lock(mutex);
        stopped = true;
    }

    notFull.notify_all();
}