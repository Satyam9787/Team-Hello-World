#include "routes.h"

#include <nlohmann/json.hpp>

#include <atomic>
#include <chrono>
#include <iostream>
#include <mutex>
#include <string>
#include <thread>
#include <unordered_set>

using json = nlohmann::json;

namespace {

std::unordered_set<crow::websocket::connection*> clients;
std::mutex clientsMutex;


bool hasConnectedClients()
{
    std::lock_guard<std::mutex> lock(clientsMutex);
    return !clients.empty();
}


void broadcastMessage(const std::string& message)
{
    std::lock_guard<std::mutex> lock(clientsMutex);

    for (auto* client : clients) {
        if (client != nullptr) {
            client->send_text(message);
        }
    }
}

} // namespace


void register_Ebpf_Events_Routes(
    crow::SimpleApp& app,
    BatchRedisStore& batchStore
) {

    // ==================================
    // WEBSOCKET CONNECTION
    // ==================================

    CROW_WEBSOCKET_ROUTE(app, "/ws")

    .onopen([](crow::websocket::connection& conn) {

    size_t clientCount;

    {
        std::lock_guard<std::mutex> lock(clientsMutex);
        clients.insert(&conn);
        clientCount = clients.size();
    }

    std::cout << "[PRAHARI WS] Dashboard connected"
              << " | IP: " << conn.get_remote_ip()
              << " | Clients: " << clientCount
              << '\n';
})

    .onclose([](
        crow::websocket::connection& conn,
        const std::string& reason,
        uint16_t
    ) {

        std::lock_guard<std::mutex> lock(clientsMutex);

        clients.erase(&conn);

        std::cout << "[PRAHARI WS] Dashboard disconnected"
                  << " | Reason: " << reason
                  << " | Clients: " << clients.size()
                  << '\n';
    })

    .onmessage([](
        crow::websocket::connection&,
        const std::string&,
        bool
    ) {
        // Dashboard currently only receives batches.
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


// ==================================
// BACKGROUND REDIS -> WEBSOCKET
// ==================================

void publishBatches(
    BatchRedisStore& batchStore,
    std::atomic<bool>& running
) {
    std::cout << "[PRAHARI WS] Batch publisher started\n";

    while (running.load()) {

        // Don't consume Redis batches without a dashboard.
        if (!hasConnectedClients()) {
            std::this_thread::sleep_for(
                std::chrono::milliseconds(100)
            );
            continue;
        }

        try {
            BatchRecord batch;

            if (!batchStore.getNextBatch(batch)) {
                std::this_thread::sleep_for(
                    std::chrono::milliseconds(5)
                );
                continue;
            }

            json parsedBatch = json::parse(batch.payload);

            json message = {
                {"type", "batch"},
                {"batch", parsedBatch}
            };

            broadcastMessage(message.dump());

            std::cout << "[PRAHARI WS] Batch pushed"
                      << " | Redis ID: " << batch.redisId
                      << " | Host: "
                      << parsedBatch.value("hostname", "unknown")
                      << " | Host ID: "
                      << parsedBatch.value("host_id", "unknown")
                      << '\n';
        }
        catch (const std::exception& e) {
            std::cerr << "[PRAHARI WS] Publisher error: "
                      << e.what() << '\n';

            std::this_thread::sleep_for(
                std::chrono::milliseconds(100)
            );
        }
    }

    std::cout << "[PRAHARI WS] Batch publisher stopped\n";
}