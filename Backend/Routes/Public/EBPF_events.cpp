#include "routes.h"

#include <cstdint>
#include <string>
#include <utility>

void register_Ebpf_Events_Routes(
    crow::SimpleApp& app,
    CompletedBatchQueue& processBatches,
    CompletedBatchQueue& networkBatches
)
{
    CROW_ROUTE(app, "/api/events/next")
    .methods(crow::HTTPMethod::GET)(
        [&processBatches, &networkBatches]() {

            crow::json::wvalue response;
            response["success"] = true;

            auto addBatch = [](
                crow::json::wvalue& response,
                const std::string& key,
                CompletedBatchQueue& queue
            ) {
                CompletedBatch batch;
                crow::json::wvalue::list events;

                if (!queue.peek(batch)) {
                    response[key]["available"] = false;
                    response[key]["count"] = 0;
                    response[key]["events"] = std::move(events);
                    return;
                }

                response[key]["available"] = true;

                response[key]["batch_id"] =
                    static_cast<std::int64_t>(batch.id);

                response[key]["count"] = batch.events.size();

                for (const auto& event : batch.events) {
                    crow::json::wvalue item;

                    item["id"] = event.id;
                    item["payload"] = event.payload;

                    events.push_back(std::move(item));
                }

                response[key]["events"] = std::move(events);
            };

            addBatch(response, "process", processBatches);
            addBatch(response, "network", networkBatches);

            return crow::response{std::move(response)};
        }
    );
    CROW_ROUTE(app, "/api/events/ack")
    .methods(crow::HTTPMethod::POST)(
        [&processBatches, &networkBatches](
            const crow::request& req
        ) {

            auto body = crow::json::load(req.body);

            if (!body) {
                return crow::response(
                    crow::status::BAD_REQUEST,
                    "Invalid JSON body"
                );
            }

            crow::json::wvalue response;

            response["success"] = true;

            // Process batch acknowledgement
            if (body.has("process_batch_id")) {

                auto batchId =
                    body["process_batch_id"].u();

                bool acknowledged =
                    processBatches.acknowledge(batchId);

                response["process"]["acknowledged"] =
                    acknowledged;

                response["process"]["batch_id"] =
                    static_cast<std::int64_t>(batchId);
            }

            // Network batch acknowledgement
            if (body.has("network_batch_id")) {

                auto batchId =
                    body["network_batch_id"].u();

                bool acknowledged =
                    networkBatches.acknowledge(batchId);

                response["network"]["acknowledged"] =
                    acknowledged;

                response["network"]["batch_id"] =
                    static_cast<std::int64_t>(batchId);
            }

            return crow::response{std::move(response)};
        }
    );
}
