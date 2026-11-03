#pragma once

#include <sw/redis++/redis++.h>

#include <mutex>
#include <string>

struct BatchRecord {
    std::string redisId;
    std::string payload;
};

class BatchRedisStore {
public:
    explicit BatchRedisStore(const std::string& redisUri);

    // Reads a batch and immediately ACKs + deletes it from Redis.
    bool getNextBatch(BatchRecord& batch);

    bool ingestBatch(
        const std::string& batchId,
        const std::string& payload,
        std::string& redisId,
        bool& duplicate
    );

private:
    sw::redis::Redis redis;

    const std::string hostStreamName =
        "prahari:host:batches";

    const std::string remoteStreamName =
        "prahari:remote:batches";

    const std::string hostGroupName =
        "prahari-host-frontend";

    const std::string remoteGroupName =
        "prahari-remote-frontend";

    const std::string consumerName =
        "prahari-api-1";

    bool preferRemote = false;

    std::mutex mutex;
};