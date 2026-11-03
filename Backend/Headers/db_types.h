#pragma once

#include <string>
#include <optional>

using namespace std;

struct DBStatus{
    string message;
    optional<string> token;
};