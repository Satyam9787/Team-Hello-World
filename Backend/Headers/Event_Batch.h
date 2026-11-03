#pragma once

#include <string>
#include <vector>

struct StreamEvent {
    std::string id;
    std::string payload;
};

using EventBatch = std::vector<StreamEvent>;