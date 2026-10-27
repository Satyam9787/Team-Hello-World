#include "routes.h"
#include "crow.h"
#include "Paths.h"
#include "auth_helper.h"
#include "Json_user.h"

using namespace std;

void register_Order_list_Routes(crow::SimpleApp& app,RedisManager& RedisManager)
{
     //Home Route
     CROW_ROUTE(app, "/Order_list").methods("GET"_method)([&RedisManager](const crow::request& req)
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

         ifstream file(Paths::HTML + "Order_list1.html");

         if(!file.is_open()) return crow::response(404);

         stringstream buffer;
         buffer << file.rdbuf();
         
         return crow::response(buffer.str());
     });

     CROW_ROUTE(app, "/Order_list1.css")([]()
     {
           ifstream file(Paths::CSS + "Order_list1.css");

           stringstream buffer;
           buffer << file.rdbuf();

           crow::response res(buffer.str());
           res.set_header("Content-Type", "text/css");

           return res;
     });

     CROW_ROUTE(app, "/Order_list1.js")([]()
     {
           ifstream file(Paths::JS+ "Order_list1.js");

           stringstream buffer;
           buffer << file.rdbuf();

           crow::response res(buffer.str());
           res.set_header("Content-Type", "text/js");

           return res;
     });

     CROW_ROUTE(app, "/Order_list2").methods("GET"_method)([&RedisManager](const crow::request& req)
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

         ifstream file(Paths::HTML + "Order_list2.html");

         if(!file.is_open()) return crow::response(404);

         stringstream buffer;
         buffer << file.rdbuf();
         
         return crow::response(buffer.str());
     });

     CROW_ROUTE(app, "/Order_list3").methods("GET"_method)([&RedisManager](const crow::request& req)
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

         ifstream file(Paths::HTML + "Order_list3.html");

         if(!file.is_open()) return crow::response(404);

         stringstream buffer;
         buffer << file.rdbuf();
         
         return crow::response(buffer.str());
     });
}