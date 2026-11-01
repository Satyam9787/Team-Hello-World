#pragma once

#include "Event_Batch.h"

#include <condition_variable>
#include <cstdint>
#include <deque>
#include <mutex>
#include <cstddef>

struct CompletedBatch {
    std::uint64_t id;
    EventBatch events;
};

class CompletedBatchQueue {
public:
    explicit CompletedBatchQueue(std::size_t maxBatches = 100);

    bool push(EventBatch batch);
    bool peek(CompletedBatch& batch);
    bool acknowledge(std::uint64_t id);
    void stop();

private:
    std::deque<CompletedBatch> batches;
    std::mutex mutex;
    std::condition_variable notFull;

    std::size_t maxBatches;
    std::uint64_t nextId = 1;
    bool stopped = false;
};