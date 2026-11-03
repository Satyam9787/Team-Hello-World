#pragma once

#include "crow.h"
#include <string.h>
#include "Redis.h"

using namespace std;

struct json_of_user
{
    optional<string> firstName;
    optional<string> ID;
};

json_of_user JSON_OF_USER(const string& token,RedisManager& RedisManager);