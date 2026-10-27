#include "routes.h"
#include "crow.h"
#include "Paths.h"
#include <iostream>
#include "auth_helper.h"
#include "Redis.h"
#include "Json_user.h"

using namespace std;

void register_Front_Routes(crow::SimpleApp& app,RedisManager &RedisManager)
{
    //Front Route
     CROW_ROUTE(app, "/Front_page").methods("GET"_method)([&RedisManager](const crow::request& req)
     {
        if (!check_authentication(req, RedisManager))
        {
            crow::response res(302);
            res.set_header("Location", "/login");
            return res;
        }

        string cookie_header = req.get_header_value("Cookie");
        string key = "token=";
        auto pos = cookie_header.find(key);
        pos += key.length();
        auto end = cookie_header.find(';', pos);
        string token = cookie_header.substr(pos, end - pos);

        json_of_user  Users_data = JSON_OF_USER(token,RedisManager);

        // authenticated — page serve karo
        ifstream file(Paths::HTML + "Front.html");
        if(!file.is_open()) return crow::response(404);

        stringstream buffer;
        buffer << file.rdbuf();
         
        crow::response res(buffer.str());
        res.set_header("Content-Type", "text/html");
        return res;
     });  

     CROW_ROUTE(app, "/Front.css")([]()
     {
           ifstream file(Paths::CSS + "Front.css");

           stringstream buffer;
           buffer << file.rdbuf();

           crow::response res(buffer.str());
           res.set_header("Content-Type", "text/css");

           return res;
     });
     CROW_ROUTE(app, "/Front.js")([]()
     {
           ifstream file(Paths::JS+ "Front.js");

           stringstream buffer;
           buffer << file.rdbuf();

           crow::response res(buffer.str());
           res.set_header("Content-Type", "text/js");

           return res;
     });

     CROW_ROUTE(app, "/Fetch_user_data").methods("GET"_method)([&RedisManager](const crow::request& req)
     {
        string cookie_header = req.get_header_value("Cookie");
        string key = "token=";
        auto pos = cookie_header.find(key);
        pos += key.length();
        auto end = cookie_header.find(';', pos);
        string token = cookie_header.substr(pos, end - pos);

        json_of_user  Users_data = JSON_OF_USER(token,RedisManager);

        crow::json::wvalue response_json;

        response_json["firstName"] = Users_data.firstName.value_or("");
        response_json["ID"] = Users_data.ID.value_or("");

        return crow::response(response_json);
     });
}