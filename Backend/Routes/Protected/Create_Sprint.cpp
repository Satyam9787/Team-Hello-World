#include "routes.h"
#include "crow.h"
#include "Paths.h"
#include "auth_helper.h"
#include "Json_user.h"
#include "Compiler_service.h"

using namespace std;

void register_Create_Sprint_Routes(crow::SimpleApp& app,RedisManager& RedisManager)
{
     //Home Route
     CROW_ROUTE(app, "/Create_Sprint").methods("GET"_method)([&RedisManager](const crow::request& req)
     {
         if (!check_authentication(req, RedisManager))
         {
            crow::response res(302);
            res.set_header("Location", "/404_Not_Found");
            return res;
         }

         string cookie_header = req.get_header_value("Cookie");
         string key = "token=";
         auto pos = cookie_header.find(key);
         pos += key.length();
         auto end = cookie_header.find(';', pos);
         string token = cookie_header.substr(pos, end - pos);

         json_of_user  Users_data = JSON_OF_USER(token,RedisManager);

         ifstream file(Paths::HTML + "Create_Sprint.html");

         if(!file.is_open()) return crow::response(404);

         stringstream buffer;
         buffer << file.rdbuf();
         
         return crow::response(buffer.str());
     });

     CROW_ROUTE(app, "/Create_Sprint.css")([]()
     {
           ifstream file(Paths::CSS + "Create_Sprint.css");

           stringstream buffer;
           buffer << file.rdbuf();

           crow::response res(buffer.str());
           res.set_header("Content-Type", "text/css");

           return res;
     });

     CROW_ROUTE(app, "/Create_Sprint.js")([]()
     {
           ifstream file(Paths::JS+ "Create_Sprint.js");

           stringstream buffer;
           buffer << file.rdbuf();

           crow::response res(buffer.str());
           res.set_header("Content-Type", "text/js");

           return res;
     });

     CROW_ROUTE(app, "/Execution").methods("POST"_method)([](const crow::request& req)
     {

           // ====================================================
           // Parse frontend request
           // ====================================================

           auto body = crow::json::load(req.body);

           if (!body)
           {
                return crow::response(
                400,
                R"({"error":"Invalid JSON request"})"
            );
           }

            // ====================================================
            // Extract language
            // ====================================================

            if (!body.has("language"))
            {
                return crow::response(
                400,
                R"({"error":"language is missing"})"
            );
            }
            
           string language = body["language"].s();

           // ====================================================
           // Extract code
           // ====================================================

           if (!body.has("code"))
           {
                return crow::response(
                400,
                R"({"error":"code is missing"})"
            );
           }

           string code = body["code"].s();   
           
           // ====================================================
           // Extract input
           // ====================================================

           string input = "";

           if (body.has("input"))
           {
                input = body["input"].s();
           }

           // ====================================================
           // Basic validation
           // ====================================================

           if (language.empty())
           {
                return crow::response(
                400,
                R"({"error":"Language cannot be empty"})"
            );
           }

           if (code.empty())
           {
                return crow::response(
                400,
                R"({"error":"Code cannot be empty"})"
            );
            }

            crow::response result = One_Compiler(language,code,input);

            return result;
     });
}