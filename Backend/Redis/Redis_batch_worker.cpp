#include "Redis_batch_worker.h"
#include "Complete_Batch_Queue.h"
#include <sw/redis++/redis++.h>

#include <chrono>
#include <iostream>
#include <iterator>
#include <thread>
#include <unordered_map>
#include <utility>
#include <vector>

RedisBatchWorker::RedisBatchWorker(
    const std::string& uri,
    CompletedBatchQueue& completedQueueRef,
    const std::string& stream,
    const std::string& group,
    const std::string& consumer
)
    : redisUri(uri),
      completedQueue(completedQueueRef),
      streamName(stream),
      groupName(group),
      consumerName(consumer) {
}

void RedisBatchWorker::stop() {
    running.store(false);
}

void RedisBatchWorker::run() {

    try {

        sw::redis::Redis redis(redisUri);

        // Create consumer group if it does not exist.
        try {

            redis.xgroup_create(
                streamName,
                groupName,
                "0-0",
                true
            );

        } catch (const sw::redis::ReplyError& e) {

            if (std::string(e.what()).find("BUSYGROUP")
                == std::string::npos) {
                throw;
            }
        }

        using Attributes =
            std::vector<std::pair<std::string, std::string>>;

        using StreamItem =
            std::pair<
                std::string,
                sw::redis::Optional<Attributes>
            >;

        using StreamItems = std::vector<StreamItem>;

        std::cout
            << "[RedisBatchWorker] Started"
            << " | Stream: " << streamName
            << " | Group: " << groupName
            << " | Consumer: " << consumerName
            << '\n';

        while (running.load()) {

            std::unordered_map<std::string, StreamItems> result;

            // Read up to 100 new events.
            redis.xreadgroup(
                groupName,
                consumerName,
                streamName,
                ">",
                100,
                std::inserter(result, result.end())
            );

            EventBatch batch;

            auto streamIt = result.find(streamName);

            if (streamIt != result.end()) {

                for (const auto& item : streamIt->second) {

                    if (!item.second) {
                        continue;
                    }

                    StreamEvent event;
                    event.id = item.first;

                    for (const auto& field : *item.second) {

                        if (field.first == "event") {
                            event.payload = field.second;
                            break;
                        }
                    }

                    if (!event.payload.empty()) {
                        batch.push_back(std::move(event));
                    }
                }
            }

            if (!batch.empty()) {

                const auto count = batch.size();

                // Directly push into CompletedBatchQueue.
                if (!completedQueue.push(std::move(batch))) {
                    break;
                }

                std::cout
                    << "[RedisBatchWorker] Queued "
                    << count
                    << " events directly into CompletedBatchQueue"
                    << " | Stream: " << streamName
                    << '\n';

            } else {

                std::this_thread::sleep_for(
                    std::chrono::milliseconds(100)
                );
            }
        }

    } catch (const std::exception& e) {

        std::cerr
            << "[RedisBatchWorker] Error: "
            << e.what()
            << '\n';
    }

    std::cout
        << "[RedisBatchWorker] Stopped: "
        << streamName
        << '\n';
}

