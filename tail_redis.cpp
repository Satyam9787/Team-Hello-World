#include <sw/redis++/redis++.h>
#include <nlohmann/json.hpp>

#include <chrono>
#include <fstream>
#include <iostream>
#include <stdexcept>
#include <string>
#include <thread>
#include <vector>
#include <unistd.h>

using namespace std;
using json = nlohmann::json;

constexpr size_t MAX_PROCESS_LOGS = 50;
constexpr size_t MAX_NETWORK_LOGS = 50;

const string PROCESS_FILE = "logs/process.events.jsonl";
const string NETWORK_FILE = "logs/network.events.jsonl";
const string REDIS_STREAM = "prahari:host:batches";

string getHostname() {
    char hostname[256] = {};

    if (gethostname(hostname, sizeof(hostname) - 1) != 0) {
        throw runtime_error("Unable to get hostname");
    }

    return string(hostname);
}

string getHostId() {
    ifstream file("/etc/machine-id");

    string hostId;

    if (!file.is_open() || !getline(file, hostId) || hostId.empty()) {
        throw runtime_error("Unable to read machine-id");
    }

    return hostId;
}

void readNewLogs(
    ifstream& file,
    string& pending,
    vector<json>& logs,
    size_t maxLogs
) {
    string line;

    while (logs.size() < maxLogs) {

        if (!getline(file, line)) {
            // EOF state clear karo, taaki next iteration
            // mein appended logs read ho sakein.
            file.clear();
            break;
        }

        // Agar line newline ke bina incomplete hai,
        // toh next read tak preserve karo.
        if (file.eof()) {
            pending += line;
            file.clear();
            break;
        }

        line = pending + line;
        pending.clear();

        if (line.empty()) {
            continue;
        }

        try {
            logs.push_back(json::parse(line));
        }
        catch (const json::exception& e) {
            cerr << "[JSON Error] "
                 << e.what() << '\n';

            cerr << "[Invalid Line] "
                 << line << '\n';
        }
    }
}

void pushBatch(
    sw::redis::Redis& redis,
    const string& hostname,
    const string& hostId,
    const vector<json>& processLogs,
    const vector<json>& networkLogs,
    unsigned long long& batchCounter
) {
    if (processLogs.empty() && networkLogs.empty()) {
        return;
    }

    auto now = chrono::system_clock::now();

    auto timestamp =
        chrono::duration_cast<chrono::milliseconds>(
            now.time_since_epoch()
        ).count();

    string batchId =
        hostname + "_" +
        to_string(timestamp) + "_" +
        to_string(++batchCounter);

    json batch = {
        {"batch_id", batchId},
        {"hostname", hostname},
        {"host_id", hostId},
        {"created_at", timestamp},

        {"process_count", processLogs.size()},
        {"network_count", networkLogs.size()},

        {"process_logs", processLogs},
        {"network_logs", networkLogs}
    };

    vector<pair<string, string>> fields = {
    {"batch_id", batchId},
    {"payload", batch.dump()}
    };

    string redisId = redis.xadd(
        REDIS_STREAM,
        "*",
        fields.begin(),
        fields.end()
    );

    cout << "[Redis] Batch successfully inserted!"<< " | Redis ID: " << redisId << '\n';

    cout << "\n========== BATCH PUSHED ==========\n";
    cout << "Batch ID     : " << batchId << '\n';
    cout << "Hostname     : " << hostname << '\n';
    cout << "Host ID      : " << hostId << '\n';
    cout << "Process logs : " << processLogs.size() << '\n';
    cout << "Network logs : " << networkLogs.size() << '\n';
    cout << "Redis stream : " << REDIS_STREAM << '\n';
    cout << "=================================\n";
}

int main() {
    try {
        sw::redis::Redis redis("tcp://127.0.0.1:6379");

        ifstream processFile(PROCESS_FILE);
        ifstream networkFile(NETWORK_FILE);

        if (!processFile.is_open()) {
            cerr << "Cannot open " << PROCESS_FILE << '\n';
            return 1;
        }

        if (!networkFile.is_open()) {
            cerr << "Cannot open " << NETWORK_FILE << '\n';
            return 1;
        }

        // Existing logs ko skip karo.
        processFile.seekg(0, ios::end);
        networkFile.seekg(0, ios::end);

        const string hostname = getHostname();
        const string hostId = getHostId();

        cout << "[PRAHARI] Batch producer started\n";
        cout << "Hostname: " << hostname << '\n';
        cout << "Host ID : " << hostId << '\n';

        vector<json> processLogs;
        vector<json> networkLogs;

        string pendingProcess;
        string pendingNetwork;

        unsigned long long batchCounter = 0;

        auto lastFlush = chrono::steady_clock::now();

        while (true) {

            readNewLogs(
                processFile,
                pendingProcess,
                processLogs,
                MAX_PROCESS_LOGS
            );

            readNewLogs(
                networkFile,
                pendingNetwork,
                networkLogs,
                MAX_NETWORK_LOGS
            );

            auto currentTime = chrono::steady_clock::now();

            bool processLimitReached =
                processLogs.size() >= MAX_PROCESS_LOGS;

            bool networkLimitReached =
                networkLogs.size() >= MAX_NETWORK_LOGS;

            bool timeoutReached =
                currentTime - lastFlush >= chrono::seconds(1);

            bool hasLogs =
                !processLogs.empty() || !networkLogs.empty();

            if (hasLogs &&
                (processLimitReached ||
                 networkLimitReached ||
                 timeoutReached)) {

                pushBatch(
                    redis,
                    hostname,
                    hostId,
                    processLogs,
                    networkLogs,
                    batchCounter
                );

                // Successful push ke baad hi clear.
                processLogs.clear();
                networkLogs.clear();

                lastFlush = chrono::steady_clock::now();
            }

            this_thread::sleep_for(
                chrono::milliseconds(100)
            );
        }

    }
    catch (const sw::redis::Error& e) {
        cerr << "[Redis Error] " << e.what() << '\n';
        return 1;
    }
    catch (const exception& e) {
        cerr << "[Error] " << e.what() << '\n';
        return 1;
    }

    return 0;
}

