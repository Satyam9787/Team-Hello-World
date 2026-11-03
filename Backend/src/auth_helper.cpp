#include "crow.h"
#include <string>
#include "auth_helper.h"
#include "Redis.h"

using namespace std;

bool check_authentication(const crow::request& req, RedisManager& RedisManager)
{
    string cookie_header = req.get_header_value("Cookie");
    if (cookie_header.empty()) return false;

    string key = "token=";
    auto pos = cookie_header.find(key);
    if (pos == std::string::npos) return false;

    pos += key.length();
    auto end = cookie_header.find(';', pos);
    string token = cookie_header.substr(pos, end - pos);

    if (token.empty()) return false;

    return RedisManager.verify_JWT_token(token);
}

bool check_temp_authentication(const crow::request& req, RedisManager& RedisManager)
{
    string cookie_header = req.get_header_value("Cookie");
    if (cookie_header.empty()) return false;

    string key = "token=";
    auto pos = cookie_header.find(key);
    if (pos == std::string::npos) return false;

    pos += key.length();
    auto end = cookie_header.find(';', pos);
    string token = cookie_header.substr(pos, end - pos);

    if (token.empty()) return false;

    return RedisManager.Temp_JWT_check(token);
}