#include <sw/redis++/redis++.h>
#include <fstream>
#include <iostream>
#include <string>

int main() {
    try {
        sw::redis::Redis redis("tcp://127.0.0.1:6379");

        std::ifstream file("logs/network.events.jsonl");

        if (!file.is_open()) {
            std::cerr << "Cannot open network log file\n";
            return 1;
        }

        std::string line;
        int count = 0;

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

            ++count;
        }

        std::cout << "Pushed " << count
                  << " network events to Redis\n";

    } catch (const sw::redis::Error& e) {
        std::cerr << "Redis error: "
                  << e.what() << '\n';
        return 1;
    }

    return 0;
}
