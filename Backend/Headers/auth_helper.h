#pragma once
#include "crow.h"
#include "Redis.h"
#include <iostream>

using namespace std;

bool check_authentication(const crow::request& req, RedisManager& RedisManager);

bool check_temp_authentication(const crow::request& req,RedisManager& RedisManager);
