#include "Redis_batch_worker.h"

#include <sw/redis++/redis++.h>

#include <chrono>
#include <iostream>
#include <iterator>
#include <thread>
#include <unordered_map>
#include <utility>
#include <vector>

// ================= BATCH QUEUE =================

BatchQueue::BatchQueue(std::size_t capacity)
    : maxBatches(capacity) {
}

bool BatchQueue::push(EventBatch batch) {
    std::unique_lock<std::mutex> lock(mutex);

    notFull.wait(lock, [&] {
        return stopped || batches.size() < maxBatches;
    });

    if (stopped) {
        return false;
    }

    batches.push(std::move(batch));

    lock.unlock();
    notEmpty.notify_one();

    return true;
}

bool BatchQueue::pop(EventBatch& batch) {
    std::unique_lock<std::mutex> lock(mutex);

    notEmpty.wait(lock, [&] {
        return stopped || !batches.empty();
    });

    if (batches.empty()) {
        return false;
    }

    batch = std::move(batches.front());
    batches.pop();

    lock.unlock();
    notFull.notify_one();

    return true;
}

void BatchQueue::stop() {
    {
        std::lock_guard<std::mutex> lock(mutex);
        stopped = true;
    }

    notEmpty.notify_all();
    notFull.notify_all();
}

// ================= REDIS BATCH WORKER =================

RedisBatchWorker::RedisBatchWorker(
    const std::string& uri,
    BatchQueue& eventQueue,
    const std::string& stream,
    const std::string& group,
    const std::string& consumer
)
    : redisUri(uri),
      queue(eventQueue),
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

                if (!queue.push(std::move(batch))) {
                    break;
                }

                std::cout
                    << "[RedisBatchWorker] Queued "
                    << count
                    << " events from "
                    << streamName
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

