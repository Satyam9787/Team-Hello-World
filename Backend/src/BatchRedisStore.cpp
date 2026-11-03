#include "BatchRedisStore.h"

#include <iostream>
#include <iterator>
#include <unordered_map>
#include <utility>
#include <vector>
#include <string>

BatchRedisStore::BatchRedisStore(const std::string& redisUri)
    : redis(redisUri)
{
    auto createGroup = [&](const std::string& stream,
                           const std::string& group) {
        try {
            redis.xgroup_create(
                stream,
                group,
                "0-0",
                true
            );

            std::cout << "[BatchRedisStore] Created group: "
                      << group << " on " << stream << '\n';
        }
        catch (const sw::redis::ReplyError& e) {
            if (std::string(e.what()).find("BUSYGROUP")
                == std::string::npos) {
                throw;
            }

            std::cout << "[BatchRedisStore] Group already exists: "
                      << group << '\n';
        }
    };

    createGroup(hostStreamName, hostGroupName);
    createGroup(remoteStreamName, remoteGroupName);
}


bool BatchRedisStore::getNextBatch(BatchRecord& batch)
{
    std::lock_guard<std::mutex> lock(mutex);

    using Attributes =
        std::vector<std::pair<std::string, std::string>>;

    using StreamItem =
        std::pair<std::string, sw::redis::Optional<Attributes>>;

    using StreamItems = std::vector<StreamItem>;

    auto tryRead = [&](const std::string& stream,
                       const std::string& group,
                       const std::string& readId,
                       const std::string& source) -> bool {

        std::unordered_map<std::string, StreamItems> result;

        redis.xreadgroup(
            group,
            consumerName,
            stream,
            readId,
            1,
            std::inserter(result, result.end())
        );

        auto streamIt = result.find(stream);

        if (streamIt == result.end() ||
            streamIt->second.empty()) {
            return false;
        }

        const auto& item = streamIt->second.front();

        if (!item.second) {
            return false;
        }

        const std::string actualRedisId = item.first;

        std::string payload;

        for (const auto& field : *item.second) {
            if (field.first == "payload") {
                payload = field.second;
                break;
            }
        }

        /*
         * DEMO MODE:
         *
         * Redis entry is acknowledged and deleted immediately
         * after backend consumption.
         *
         * Frontend no longer performs ACK requests.
         */

        auto acknowledged = redis.xack(
            stream,
            group,
            actualRedisId
        );

        if (acknowledged == 0) {
            std::cerr << "[BatchRedisStore] ACK failed: "
                      << actualRedisId << '\n';

            return false;
        }

        redis.xdel(stream, actualRedisId);

        std::cout << "[BatchRedisStore] Consumed and deleted"
                  << " | Source: " << source
                  << " | Redis ID: " << actualRedisId << '\n';

        if (payload.empty()) {
            std::cerr << "[BatchRedisStore] Empty payload: "
                      << actualRedisId << '\n';

            return false;
        }

        batch.redisId = source + ":" + actualRedisId;
        batch.payload = std::move(payload);

        return true;
    };


    const std::string& firstStream =
        preferRemote ? remoteStreamName : hostStreamName;

    const std::string& firstGroup =
        preferRemote ? remoteGroupName : hostGroupName;

    const std::string& firstSource =
        preferRemote ? "remote" : "host";


    const std::string& secondStream =
        preferRemote ? hostStreamName : remoteStreamName;

    const std::string& secondGroup =
        preferRemote ? hostGroupName : remoteGroupName;

    const std::string& secondSource =
        preferRemote ? "host" : "remote";


    // 1. Check previously pending entries first.
    if (
        tryRead(firstStream, firstGroup, "0", firstSource) ||
        tryRead(secondStream, secondGroup, "0", secondSource)
    ) {
        preferRemote = !preferRemote;
        return true;
    }


    // 2. Read new entries.
    if (
        tryRead(firstStream, firstGroup, ">", firstSource) ||
        tryRead(secondStream, secondGroup, ">", secondSource)
    ) {
        preferRemote = !preferRemote;
        return true;
    }

    return false;
}


bool BatchRedisStore::ingestBatch(
    const std::string& batchId,
    const std::string& payload,
    std::string& redisId,
    bool& duplicate
) {
    std::lock_guard<std::mutex> lock(mutex);

    const std::string dedupKey =
        "prahari:remote:received:" + batchId;

    const std::string script = R"(
        local existing = redis.call('GET', KEYS[1])

        if existing then
            return 'DUPLICATE:' .. existing
        end

        local id = redis.call(
            'XADD',
            KEYS[2],
            '*',
            'batch_id', ARGV[1],
            'payload', ARGV[2]
        )

        redis.call('SET', KEYS[1], id)

        return 'STORED:' .. id
    )";

    try {
        std::vector<std::string> keys = {
            dedupKey,
            remoteStreamName
        };

        std::vector<std::string> args = {
            batchId,
            payload
        };

        std::string result = redis.eval<std::string>(
            script,
            keys.begin(),
            keys.end(),
            args.begin(),
            args.end()
        );

        if (result.rfind("DUPLICATE:", 0) == 0) {
            duplicate = true;
            redisId = result.substr(10);

            std::cout << "[BatchRedisStore] Duplicate remote batch: "
                      << batchId << '\n';

            return true;
        }

        if (result.rfind("STORED:", 0) == 0) {
            duplicate = false;
            redisId = result.substr(7);

            std::cout << "[BatchRedisStore] Remote batch stored: "
                      << batchId
                      << " | Redis ID: "
                      << redisId << '\n';

            return true;
        }

        return false;
    }
    catch (const std::exception& e) {
        std::cerr << "[BatchRedisStore] Ingestion error: "
                  << e.what() << '\n';

        return false;
    }
}