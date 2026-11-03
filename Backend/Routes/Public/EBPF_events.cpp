#include "routes.h"

#include <nlohmann/json.hpp>

#include <atomic>
#include <chrono>
#include <cctype>
#include <cstdlib>
#include <cstdint>
#include <deque>
#include <iostream>
#include <mutex>
#include <string>
#include <thread>
#include <unordered_set>
#include <algorithm>

using json = nlohmann::json;

namespace {

// ==================================
// WEBSOCKET CLIENTS
// ==================================

std::unordered_set<crow::websocket::connection*> clients;
std::mutex clientsMutex;


// ==================================
// FREEZE COMMAND QUEUE
// ==================================

std::deque<json> freezeCommandQueue;
std::mutex freezeQueueMutex;

std::atomic<uint64_t> commandCounter{1};


// CHANGE THIS TO YOUR ACTUAL ARCH SCRIPT PATH.
const std::string ARCH_FREEZE_SCRIPT =
    "/home/prakharpower/ebpf-monitor/scripts/freeze_demo.sh";


// ==================================
// HELPERS
// ==================================

std::string normalizeHostname(std::string hostname)
{
    std::transform(
        hostname.begin(),
        hostname.end(),
        hostname.begin(),
        [](unsigned char c) {
            return static_cast<char>(std::tolower(c));
        }
    );

    return hostname;
}


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


// ==================================
// REGISTER ROUTES
// ==================================

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


    // ==================================
    // FREEZE DEMO
    // FRONTEND -> BACKEND
    // ==================================

    CROW_ROUTE(app, "/freeze_demo")
    .methods(crow::HTTPMethod::POST)
    ([](const crow::request& req) {

        try {

            json body = json::parse(req.body);

            if (!body.is_object() ||
                !body.contains("hostname") ||
                !body["hostname"].is_string()) {

                return crow::response(
                    400,
                    R"({"success":false,"message":"Hostname required"})"
                );
            }

            std::string hostname =
                normalizeHostname(body["hostname"].get<std::string>());

            std::string hostId;

            if (body.contains("hostId") &&
                body["hostId"].is_string()) {

                hostId = body["hostId"].get<std::string>();

            }
            else if (body.contains("host_id") &&
                     body["host_id"].is_string()) {

                hostId = body["host_id"].get<std::string>();
            }

            if (hostId.empty()) {

                return crow::response(
                    400,
                    R"({"success":false,"message":"hostId required"})"
                );
            }


            // ----------------------------------
            // ARCH: EXECUTE LOCAL SCRIPT
            // ----------------------------------

            if (hostname == "archlinux") {

                std::cout
                    << "[FREEZE DEMO] Arch target received"
                    << " | Host ID: " << hostId
                    << '\n';

                int result = std::system(
                    ("/bin/bash " + ARCH_FREEZE_SCRIPT).c_str()
                );

                if (result == 0) {

                    std::cout
                        << "[FREEZE DEMO] Arch script executed\n";

                    return crow::response(
                        200,
                        json{
                            {"success", true},
                            {"hostname", hostname},
                            {"hostId", hostId},
                            {"message", "Arch script executed successfully"}
                        }.dump()
                    );
                }

                std::cerr
                    << "[FREEZE DEMO] Arch script failed"
                    << " | Exit status: " << result
                    << '\n';

                return crow::response(
                    500,
                    json{
                        {"success", false},
                        {"hostname", hostname},
                        {"message", "Arch script execution failed"}
                    }.dump()
                );
            }


            // ----------------------------------
            // UBUNTU: ADD COMMAND TO POLLING QUEUE
            // ----------------------------------

            if (hostname == "ubuntu") {

                std::string commandId =
                    "freeze-" +
                    std::to_string(commandCounter.fetch_add(1));

                json command = {
                    {"command_id", commandId},
                    {"hostname", hostname},
                    {"hostId", hostId},
                    {"action", "freeze_demo"}
                };

                {
                    std::lock_guard<std::mutex> lock(
                        freezeQueueMutex
                    );

                    freezeCommandQueue.push_back(command);
                }

                std::cout
                    << "[FREEZE DEMO] Ubuntu command queued"
                    << " | Command ID: " << commandId
                    << " | Host ID: " << hostId
                    << '\n';

                return crow::response(
                    200,
                    json{
                        {"success", true},
                        {"command_id", commandId},
                        {"hostname", hostname},
                        {"hostId", hostId},
                        {"message", "Ubuntu execution command queued"}
                    }.dump()
                );
            }


            // ----------------------------------
            // UNKNOWN HOST
            // ----------------------------------

            return crow::response(
                400,
                R"({"success":false,"message":"Unsupported hostname"})"
            );

        }
        catch (const std::exception& e) {

            std::cerr
                << "[POST /freeze_demo] "
                << e.what() << '\n';

            return crow::response(
                400,
                R"({"success":false,"message":"Invalid freeze request"})"
            );
        }
    });


    // ==================================
    // UBUNTU POLLING ENDPOINT
    // ==================================

    CROW_ROUTE(app, "/api/freeze_demo/poll")
    .methods(crow::HTTPMethod::GET)
    ([]() {

        std::lock_guard<std::mutex> lock(
            freezeQueueMutex
        );

        if (freezeCommandQueue.empty()) {

            return crow::response(
                200,
                json{
                    {"success", true},
                    {"command", nullptr}
                }.dump()
            );
        }

        json command = freezeCommandQueue.front();

        freezeCommandQueue.pop_front();

        std::cout
            << "[FREEZE DEMO] Command delivered to Ubuntu agent"
            << " | Command ID: "
            << command["command_id"]
            << '\n';

        return crow::response(
            200,
            json{
                {"success", true},
                {"command", command}
            }.dump()
        );
    });


    // ==================================
    // UBUNTU EXECUTION RESULT
    // ==================================

    CROW_ROUTE(app, "/api/freeze_demo/result")
    .methods(crow::HTTPMethod::POST)
    ([](const crow::request& req) {

        try {

            json body = json::parse(req.body);

            if (!body.is_object() ||
                !body.contains("command_id") ||
                !body["command_id"].is_string() ||
                !body.contains("success") ||
                !body["success"].is_boolean()) {

                return crow::response(
                    400,
                    R"({"success":false,"message":"Invalid result payload"})"
                );
            }

            std::string commandId = body["command_id"];

            bool executionSuccess = body["success"];

            std::string output =
                body.value("output", std::string(""));

            std::cout
                << "[FREEZE DEMO] Ubuntu execution result"
                << " | Command ID: " << commandId
                << " | Success: " << executionSuccess
                << " | Output: " << output
                << '\n';

            return crow::response(
                200,
                json{
                    {"success", true},
                    {"command_id", commandId},
                    {"message", "Execution result received"}
                }.dump()
            );

        }
        catch (const std::exception& e) {

            std::cerr
                << "[POST /api/freeze_demo/result] "
                << e.what() << '\n';

            return crow::response(
                400,
                R"({"success":false,"message":"Invalid result request"})"
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

    std::cout
        << "[PRAHARI WS] Batch publisher started\n";

    while (running.load()) {

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

            std::cout
                << "[PRAHARI WS] Batch pushed"
                << " | Redis ID: " << batch.redisId
                << " | Host: "
                << parsedBatch.value("hostname", "unknown")
                << " | Host ID: "
                << parsedBatch.value("host_id", "unknown")
                << '\n';

        }
        catch (const std::exception& e) {

            std::cerr
                << "[PRAHARI WS] Publisher error: "
                << e.what() << '\n';

            std::this_thread::sleep_for(
                std::chrono::milliseconds(100)
            );
        }
    }

    std::cout
        << "[PRAHARI WS] Batch publisher stopped\n";
}