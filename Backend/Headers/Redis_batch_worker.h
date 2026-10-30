
#pragma once

#include <condition_variable>
#include <cstddef>
#include <mutex>
#include <queue>
#include <string>
#include <vector>
#include <atomic>

struct StreamEvent {
    std::string id;
    std::string payload;
};

using EventBatch = std::vector<StreamEvent>;

class BatchQueue {
public:
    explicit BatchQueue(std::size_t maxBatches = 20);

    bool push(EventBatch batch);
    bool pop(EventBatch& batch);
    void stop();

private:
    std::queue<EventBatch> batches;
    std::mutex mutex;
    std::condition_variable notEmpty;
    std::condition_variable notFull;

    std::size_t maxBatches;
    bool stopped = false;
};

class RedisBatchWorker {
public:
    RedisBatchWorker(
        const std::string& redisUri,
        BatchQueue& queue,
        const std::string& streamName,
        const std::string& groupName,
        const std::string& consumerName
    );

    void run();
    void stop();

private:
    std::string redisUri;
    BatchQueue& queue;

    std::string streamName;
    std::string groupName;
    std::string consumerName;

    std::atomic<bool> running{true};
};

