#include "routes.h"
#include "crow.h"
#include "Paths.h"
#include "auth_helper.h"
#include "Json_user.h"

using namespace std;

void register_Membership_Routes(crow::SimpleApp& app,RedisManager& RedisManager)
{
     //Home Route
     CROW_ROUTE(app, "/Membership").methods("GET"_method)([&RedisManager](const crow::request& req)
     {
         ifstream file(Paths::HTML + "Membership.html");

         if(!file.is_open()) return crow::response(404);

         stringstream buffer;
         buffer << file.rdbuf();
         
         return crow::response(buffer.str());
     });

     CROW_ROUTE(app, "/Membership.css")([]()
     {
           ifstream file(Paths::CSS + "Membership.css");

           stringstream buffer;
           buffer << file.rdbuf();

           crow::response res(buffer.str());
           res.set_header("Content-Type", "text/css");

           return res;
     });

     CROW_ROUTE(app, "/Membership.js")([]()
     {
           ifstream file(Paths::JS+ "Membership.js");

           stringstream buffer;
           buffer << file.rdbuf();

           crow::response res(buffer.str());
           res.set_header("Content-Type", "text/js");

           return res;
     });
}
