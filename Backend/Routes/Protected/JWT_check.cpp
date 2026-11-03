#include "routes.h"
#include "crow.h"
#include "JWT_token.h"
#include "Redis.h"
#include <iostream>
#include "auth_helper.h"

using namespace std;

void register_JWT_check_Routes(crow::SimpleApp& app,RedisManager &RedisManager,AuditLogger &AuditLogger)
{
    CROW_ROUTE(app, "/JWT_check").methods("POST"_method)([&RedisManager, &AuditLogger](const crow::request& req)
    {
        if (!check_authentication(req, RedisManager))
        {
            crow::response res(302);
            res.set_header("Location", "/404_Not_Found");
            return res;
        }

        string IP = req.remote_ip_address;
        crow::json::wvalue json;
        crow::response res;
        res.set_header("Content-Type", "application/json");

        string cookie_header = req.get_header_value("Cookie");
        if(cookie_header.empty())
        {
            json["success"] = false;
            json["message"] = "No cookie found";
            res.code = 401;
            res.body = json.dump();
         // AuditLogger.log(IP, "JWT_check", "missing_cookie");  
            return res;
        }

        string key = "token=";
        auto pos = cookie_header.find(key);
        if(pos == std::string::npos)
        {
            json["success"] = false;
            json["message"] = "No token in cookie";
            res.code = 401;
            res.body = json.dump();
            return res;
        }
        pos += key.length();
        auto end = cookie_header.find(';', pos);
        string Recieved_JWT_token = cookie_header.substr(pos, end - pos);

        if(Recieved_JWT_token.empty())
        {
            json["success"] = false;
            json["message"] = "Empty token";
            res.code = 401;
            res.body = json.dump();
            return res;
        }

        bool result = RedisManager.verify_JWT_token(Recieved_JWT_token);

        if(result)
        {
            json["success"] = true;
            json["message"] = "Access granted";
            res.code = 200;
        }
        else
        {
            json["success"] = false;
            json["message"] = "Access Denied. Something went wrong!";
            res.code = 401;
        }

        res.body = json.dump();
        return res;
    });
}