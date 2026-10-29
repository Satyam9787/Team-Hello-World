#include "routes.h"

#include <cstdint>
#include <utility>

void register_Ebpf_Events_Routes(crow::SimpleApp& app,CompletedBatchQueue& completedBatches) 
{
    CROW_ROUTE(app, "/api/events/next").methods(crow::HTTPMethod::GET)([&completedBatches]() {
        CompletedBatch batch;

        crow::json::wvalue response;
        response["success"] = true;

        if (!completedBatches.peek(batch)) {
            response["count"] = 0;
            response["events"] = crow::json::wvalue::list{};
            return crow::response{std::move(response)};
        }

        response["batch_id"] = static_cast<std::int64_t>(batch.id);
        response["count"] = batch.events.size();

        crow::json::wvalue::list events;

        for (const auto& event : batch.events) {
            crow::json::wvalue item;
            item["id"] = event.id;
            item["payload"] = event.payload;
            events.push_back(std::move(item));
        }

        response["events"] = std::move(events);

        // Print the exact batch that will be sent to frontend.
std::cout << "\n========== eBPF BATCH RESPONSE ==========\n";

std::cout << "Batch ID: " << batch.id << '\n';
std::cout << "Total Events: " << batch.events.size() << '\n';

for (const auto& event : batch.events) {
    std::cout << "Event ID: " << event.id << '\n';
    std::cout << "Payload: " << event.payload << "\n\n";
}

std::cout << "========== END OF BATCH ================\n\n";

// Send response after printing.
return crow::response{std::move(response)};

        return crow::response{std::move(response)};
    });

    CROW_ROUTE(app, "/api/events/ack").methods(crow::HTTPMethod::POST)([&completedBatches](const crow::request& req) {
        auto body = crow::json::load(req.body);

        if (!body || !body.has("batch_id")) {
            return crow::response(400, "Invalid batch acknowledgement");
        }

        const auto id = body["batch_id"].i();

        if (id <= 0 ||
            !completedBatches.acknowledge(
                static_cast<std::uint64_t>(id))) {
            return crow::response(409, "Batch not available");
        }

        return crow::response(200, "Batch acknowledged");
    });
}