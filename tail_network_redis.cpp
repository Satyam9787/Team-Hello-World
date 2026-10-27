#include <sw/redis++/redis++.h>
#include <chrono>
#include <fstream>
#include <iostream>
#include <string>
#include <thread>

int main() {
    try {
        sw::redis::Redis redis("tcp://127.0.0.1:6379");

        std::ifstream file("logs/network.events.jsonl");

        if (!file.is_open()) {
            std::cerr << "Cannot open network log file\n";
            return 1;
        }

        // Existing records ko dobara push nahi karna.
        file.seekg(0, std::ios::end);

        std::cout
            << "Watching network log for new events...\n";

        std::string line;

        while (true) {
            while (std::getline(file, line)) {
                if (line.empty()) {
                    continue;
                }

                redis.xadd(
                    "ebpf:network_events",
                    "*",
                    {
                        std::string("event"),
                        line
                    }
                );

                std::cout
                    << "Network event pushed to Redis\n";
            }

            // File ke end par naye events ka wait karo.
            file.clear();

            std::this_thread::sleep_for(
                std::chrono::milliseconds(200)
            );
        }
    } catch (const sw::redis::Error& e) {
        std::cerr << "Redis error: "
                  << e.what() << '\n';
        return 1;
    }

    return 0;
}
