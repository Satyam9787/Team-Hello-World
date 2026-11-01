#include "routes.h"

#include <nlohmann/json.hpp>
#include <iostream>
#include <string>

using json = nlohmann::json;

void register_Ebpf_Events_Routes(
    crow::SimpleApp& app,
    BatchRedisStore& batchStore
) {
    // ==================================
    // GET NEXT BATCH
    // ==================================

    CROW_ROUTE(app, "/api/batches/next")
    .methods(crow::HTTPMethod::GET)
    ([&batchStore]() {

        try {
            BatchRecord batch;

            if (!batchStore.getNextBatch(batch)) {
                json response = {
                    {"success", true},
                    {"available", false},
                    {"message", "No batch available"}
                };

                return crow::response(200, response.dump());
            }

            json payload = json::parse(batch.payload);

            json response = {
                {"success", true},
                {"available", true},
                {"redis_id", batch.redisId},
                {"batch", payload}
            };

            return crow::response(200, response.dump());
        }
        catch (const std::exception& e) {
            std::cerr << "[GET /api/batches/next] "
                      << e.what() << '\n';

            json response = {
                {"success", false},
                {"message", "Internal server error"}
            };

            return crow::response(500, response.dump());
        }
    });


    // ==================================
    // ACKNOWLEDGE BATCH
    // ==================================

    CROW_ROUTE(app, "/api/batches/ack")
    .methods(crow::HTTPMethod::POST)
    ([&batchStore](const crow::request& req) {

        try {
            json body = json::parse(req.body);

            if (!body.is_object() ||
                !body.contains("redis_id") ||
                !body["redis_id"].is_string()) {

                return crow::response(
                    400,
                    R"({"success":false,"message":"redis_id is required"})"
                );
            }

            const std::string redisId = body["redis_id"];

            bool acknowledged =
                batchStore.acknowledgeBatch(redisId);

            json response = {
                {"success", acknowledged},
                {"acknowledged", acknowledged},
                {"redis_id", redisId}
            };

            return crow::response(
                acknowledged ? 200 : 404,
                response.dump()
            );
        }
        catch (const std::exception& e) {
            std::cerr << "[POST /api/batches/ack] "
                      << e.what() << '\n';

            return crow::response(
                400,
                R"({"success":false,"message":"Invalid request"})"
            );
        }
    });


    // ==================================
    // RECEIVE BATCH FROM UBUNTU
    // ==================================

    CROW_ROUTE(app, "/api/batches/ingest")
    .methods(crow::HTTPMethod::POST)
    ([&batchStore](const crow::request& req) {

        try {
            json body = json::parse(req.body);

            if (!body.is_object() ||
                !body.contains("batch_id") ||
                !body["batch_id"].is_string() ||
                !body.contains("process_logs") ||
                !body["process_logs"].is_array() ||
                !body.contains("network_logs") ||
                !body["network_logs"].is_array()) {

                return crow::response(
                    400,
                    R"({"success":false,"message":"Invalid batch payload"})"
                );
            }

            const std::string batchId = body["batch_id"];

            if (batchId.empty()) {
                return crow::response(
                    400,
                    R"({"success":false,"message":"Empty batch_id"})"
                );
            }

            // Actual arrays ke according counts update karo.
            body["process_count"] =
                body["process_logs"].size();

            body["network_count"] =
                body["network_logs"].size();

            std::string redisId;
            bool duplicate = false;

            bool stored = batchStore.ingestBatch(
                batchId,
                body.dump(),
                redisId,
                duplicate
            );

            json response = {
                {"success", stored},
                {"batch_id", batchId},
                {"redis_id", redisId},
                {"duplicate", duplicate},
                {"message", stored
                    ? "Batch received successfully"
                    : "Batch storage failed"}
            };

            return crow::response(
                stored ? 200 : 500,
                response.dump()
            );
        }
        catch (const std::exception& e) {
            std::cerr << "[POST /api/batches/ingest] "
                      << e.what() << '\n';

            return crow::response(
                400,
                R"({"success":false,"message":"Invalid batch request"})"
            );
        }
    });
}