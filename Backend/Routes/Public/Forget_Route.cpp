#include "routes.h"
#include "crow.h"
#include "Paths.h"
#include "database.h"
#include "AuditLogger.h"

using namespace std;

void handle_forget(const crow::request& req,crow::response& res,AuditLogger &AuditLogger);
void Pass_reset(const crow::request& req,crow::response& res,RedisManager& RedisManager,AuditLogger &AuditLogger);

void register_forget_Routes(crow::SimpleApp& app,RedisManager& RedisManager,AuditLogger &AuditLogger)
{
     //Forget Route
     CROW_ROUTE(app, "/forget")([]()
     {
        ifstream file(Paths::HTML + "forget.html");

         if(!file.is_open()) return crow::response(404);

         stringstream buffer;
         buffer << file.rdbuf();
         
         return crow::response(buffer.str());
     });

     CROW_ROUTE(app, "/Forget.css")([]()
     {
           ifstream file(Paths::CSS + "Forget.css");

           stringstream buffer;
           buffer << file.rdbuf();

           crow::response res(buffer.str());
           res.set_header("Content-Type", "text/css");

           return res;
     });

     CROW_ROUTE(app, "/Forget.js")([]()
     {
           ifstream file(Paths::JS+ "Forget.js");

           stringstream buffer;
           buffer << file.rdbuf();

           crow::response res(buffer.str());
           res.set_header("Content-Type", "text/js");

           return res;
     });

     CROW_ROUTE(app, "/api/forget").methods(crow::HTTPMethod::POST)([&AuditLogger](const crow::request& req)
     {
             crow::response res;
             handle_forget(req,res,AuditLogger);
             return res;
     });
     CROW_ROUTE(app, "/Pass_reset")([]()
     {
             ifstream file(Paths::HTML + "Password_Reset.html");

             if(!file.is_open()) return crow::response(404);

             stringstream buffer;
             buffer << file.rdbuf();

             return crow::response(buffer.str());
     });

     CROW_ROUTE(app, "/Password_Reset.css")([]()
     {
           ifstream file(Paths::CSS + "Password_Reset.css");

           stringstream buffer;
           buffer << file.rdbuf();

           crow::response res(buffer.str());
           res.set_header("Content-Type", "text/css");

           return res;
     });

     CROW_ROUTE(app, "/Password_Reset.js")([]()
     {
           ifstream file(Paths::JS+ "Password_Reset.js");

           stringstream buffer;
           buffer << file.rdbuf();

           crow::response res(buffer.str());
           res.set_header("Content-Type", "text/js");

           return res;
     });

     CROW_ROUTE(app, "/api/Pass-reset").methods(crow::HTTPMethod::POST)([&RedisManager,&AuditLogger](const crow::request& req)
     {
             crow::response res;
             Pass_reset(req,res,RedisManager,AuditLogger);
             return res;
     });
}