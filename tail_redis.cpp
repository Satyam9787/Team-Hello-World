
#include <sw/redis++/redis++.h>

#include <chrono>
#include <fstream>
#include <iostream>
#include <string>
#include <thread>

int main() {
    try {
        sw::redis::Redis redis("tcp://127.0.0.1:6379");

        std::ifstream file("logs/process.events.jsonl");
        if (!file.is_open()) {
            std::cerr << "Cannot open process log file\n";
            return 1;
        }

        // Existing records ko dobara push nahi karna.
        file.seekg(0, std::ios::end);

        std::cout << "Watching process log for new events...\n";

        std::string line;

        while (true) {
            while (std::getline(file, line)) {
                if (line.empty()) {
                    continue;
                }

                redis.xadd(
                    "ebpf:process_events",
                    "*",
                    {
                        std::string("event"),
                        line
                    }
                );

                std::cout << "New event pushed to Redis\n";
            }

            // File ke end par pahunchne ke baad
            // naye appended records ka wait karo.
            file.clear();
            std::this_thread::sleep_for(
                std::chrono::milliseconds(200)
            );
        }
    } catch (const sw::redis::Error& e) {
        std::cerr << "Redis error: " << e.what() << '\n';
        return 1;
    }

    return 0;
}
