
#include <sw/redis++/redis++.h>
#include <fstream>
#include <iostream>
#include <string>

int main() {
    try {
        sw::redis::Redis redis("tcp://127.0.0.1:6379");
        std::ifstream file("logs/process.events.jsonl");

        if (!file.is_open()) {
            std::cerr << "Cannot open process log file\n";
            return 1;
        }

        std::string line;
        int count = 0;

        while (std::getline(file, line)) {
            if (line.empty()) continue;

            redis.xadd(
    "ebpf:process_events",
    "*",
    {
        std::string("event"),
        line
    }
);
            ++count;
        }

        std::cout << "Pushed " << count
                  << " events to Redis\n";
    } catch (const sw::redis::Error &e) {
        std::cerr << "Error: " << e.what() << '\n';
        return 1;
    }

    return 0;
}

