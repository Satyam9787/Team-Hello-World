#pragma once

#include "Event_Batch.h"

#include <atomic>
#include <string>

class CompletedBatchQueue;

class RedisBatchWorker {
public:
    RedisBatchWorker(
        const std::string& redisUri,
        CompletedBatchQueue& completedQueue,
        const std::string& streamName,
        const std::string& groupName,
        const std::string& consumerName
    );

    void run();
    void stop();

private:
    std::string redisUri;
    CompletedBatchQueue& completedQueue;

    std::string streamName;
    std::string groupName;
    std::string consumerName;

    std::atomic<bool> running{true};
};

