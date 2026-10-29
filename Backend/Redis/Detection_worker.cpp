
#include "Detection_worker.h"
#include "Complete_Batch_Queue.h"
#include "crow.h"

#include <cctype>
#include <iostream>
#include <string>
#include <utility>
#include <vector>

namespace {

struct Classification {
    std::string status;
    std::string reason;
};

bool isJsonObject(const std::string& payload) {
    const auto first = payload.find_first_not_of(" \t\n\r");

    if (first == std::string::npos || payload[first] != '{') {
        return false;
    }

    const auto last = payload.find_last_not_of(" \t\n\r");

    return last != std::string::npos && payload[last] == '}';
}

bool hasRequiredFields(const crow::json::rvalue& json) {
    return json.has("event") &&
           json.has("pid") &&
           json.has("ppid") &&
           json.has("comm");
}

bool hasTrueFlag(
    const crow::json::rvalue& json,
    const char* field
) {
    if (!json.has(field)) {
        return false;
    }

    // The marker must be a JSON boolean true.
    return json[field].t() == crow::json::type::True;
}

Classification classifyEvent(
    const crow::json::rvalue& json
) {
    // Rule 1: known test indicator has highest priority.
    if (hasTrueFlag(json, "test_suspicious")) {
        return {"unsafe", "test_indicator_matched"};
    }

    // Rule 2: missing telemetry means incomplete evidence.
    if (!hasRequiredFields(json)) {
        return {"partial", "missing_required_fields"};
    }

    // Rule 3: safe requires an explicit trusted-policy result.
    // This flag must only be set by a real policy check.
    if (hasTrueFlag(json, "trusted_policy_passed")) {
        return {"safe", "trusted_policy_passed"};
    }

    // A valid event without sufficient trust/threat evidence.
    return {"unknown", "insufficient_evidence"};
}

std::string escapeJsonString(const std::string& value) {
    std::string result;
    result.reserve(value.size() + 16);

    for (unsigned char ch : value) {
        switch (ch) {
            case '"':
                result += "\\\"";
                break;
            case '\\':
                result += "\\\\";
                break;
            case '\b':
                result += "\\b";
                break;
            case '\f':
                result += "\\f";
                break;
            case '\n':
                result += "\\n";
                break;
            case '\r':
                result += "\\r";
                break;
            case '\t':
                result += "\\t";
                break;
            default:
                if (ch < 0x20) {
                    static const char hex[] = "0123456789abcdef";
                    result += "\\u00";
                    result += hex[(ch >> 4) & 0x0f];
                    result += hex[ch & 0x0f];
                } else {
                    result += static_cast<char>(ch);
                }
        }
    }

    return result;
}

std::string addClassification(
    const std::string& payload,
    const Classification& result
) {
    if (!isJsonObject(payload)) {
        // Preserve malformed/non-object data for investigation.
        return std::string("{\"original_payload\":\"") +
               escapeJsonString(payload) +
               "\",\"status\":\"partial\"" +
               ",\"reason\":\"invalid_event_object\"}";
    }

    const auto first = payload.find_first_not_of(" \t\n\r");
    const auto last = payload.find_last_not_of(" \t\n\r");

    const std::string inner =
        payload.substr(first + 1, last - first - 1);

    const bool emptyObject =
        inner.find_first_not_of(" \t\n\r") == std::string::npos;

    std::string updated = payload;

    // Insert before the outer closing brace.
    // The classification values below are fixed internal strings.
    const std::string fields =
        std::string(emptyObject ? "" : ",") +
        "\"status\":\"" + result.status + "\"," +
        "\"reason\":\"" + result.reason + "\"";

    updated.insert(last, fields);

    return updated;
}

} // namespace

DetectionWorker::DetectionWorker(
    BatchQueue& eventQueue,
    CompletedBatchQueue& completedQueueRef
)
    : queue(eventQueue),
      completedQueue(completedQueueRef) {
}

void DetectionWorker::stop() {
    running.store(false);
}

bool DetectionWorker::isSuspicious(
    const StreamEvent& event
) {
    const auto json = crow::json::load(event.payload);

    if (!json || !isJsonObject(event.payload)) {
        return false;
    }

    return hasTrueFlag(json, "test_suspicious");
}

void DetectionWorker::run() {
    std::cout << "[DetectionWorker] Started\n";

    while (running.load()) {
        EventBatch batch;

        if (!queue.pop(batch)) {
            break;
        }

        if (batch.empty()) {
            continue;
        }

        std::size_t safeCount = 0;
        std::size_t unsafeCount = 0;
        std::size_t partialCount = 0;
        std::size_t unknownCount = 0;

        // Classify every event in the batch in memory.
        // No per-event HTTP calls or database requests.
        for (auto& event : batch) {
            const auto json = crow::json::load(event.payload);

            if (!json || !isJsonObject(event.payload)) {
                Classification result{
                    "partial",
                    "invalid_json_or_event_object"
                };

                event.payload = addClassification(
                    event.payload,
                    result
                );

                ++partialCount;

                std::cerr
                    << "[Detection] Invalid event payload; ID: "
                    << event.id << '\n';

                continue;
            }

            const Classification result = classifyEvent(json);

            event.payload = addClassification(
                event.payload,
                result
            );

            if (result.status == "safe") {
                ++safeCount;
            } else if (result.status == "unsafe") {
                ++unsafeCount;
            } else if (result.status == "partial") {
                ++partialCount;
            } else {
                ++unknownCount;
            }

            std::cout
                << "[Detection] ID: " << event.id
                << " | Status: " << result.status
                << " | Reason: " << result.reason
                << '\n';
        }

        std::cout
            << "[DetectionWorker] Batch classified: "
            << batch.size()
            << " events"
            << " | safe=" << safeCount
            << " | unsafe=" << unsafeCount
            << " | partial=" << partialCount
            << " | unknown=" << unknownCount
            << '\n';

        // Preserve every event and its original Redis ID.
        // Only the payload gains classification fields.
        if (!completedQueue.push(std::move(batch))) {
            std::cerr
                << "[DetectionWorker] Failed to store completed batch\n";

            break;
        }

        std::cout
            << "[DetectionWorker] Classified batch saved for frontend\n";
    }

    std::cout << "[DetectionWorker] Stopped\n";
}

