#include "routes.h"
#include "database.h"
#include "crow.h"
#include "Paths.h"
#include "Redis.h"
#include "AuditLogger.h"

using namespace std;

void handleLogin(const crow::request& req,crow::response& res,RedisManager &RedisManager,AuditLogger &AuditLogger);

void register_Login_Routes(crow::SimpleApp& app,RedisManager &RedisManager,AuditLogger& AuditLogger)
{
     //Login Route
     CROW_ROUTE(app, "/login")([]()
     {
        ifstream file(Paths::HTML + "login.html");

         if(!file.is_open()) return crow::response(404);

         stringstream buffer;
         buffer << file.rdbuf();
         
         return crow::response(buffer.str());
     });
     CROW_ROUTE(app, "/api/login").methods(crow::HTTPMethod::POST)([&RedisManager,&AuditLogger](const crow::request& req)
     {
            crow::response res;
            handleLogin(req,res,RedisManager,AuditLogger);
            return res;
     });
     CROW_ROUTE(app, "/login.css")([]()
     {
           ifstream file(Paths::CSS + "login.css");

           stringstream buffer;
           buffer << file.rdbuf();

           crow::response res(buffer.str());
           res.set_header("Content-Type", "text/css");

           return res;
     });
     CROW_ROUTE(app, "/login.js")([]()
     {
           ifstream file(Paths::JS+ "login.js");

           stringstream buffer;
           buffer << file.rdbuf();

           crow::response res(buffer.str());
           res.set_header("Content-Type", "text/js");

           return res;
     });
}