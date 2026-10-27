#include "routes.h"
#include "crow.h"
#include "Paths.h"
#include "database.h"
#include "AuditLogger.h"

using namespace std;

void handle_signup(const crow::request& req,crow::response& res,RedisManager& RedisManager,AuditLogger &AuditLogger);

void register_Signup_Routes(crow::SimpleApp& app,RedisManager& RedisManager,AuditLogger &AuditLogger)
{
     //Signup Route
     CROW_ROUTE(app, "/signup")([]()
     {
        ifstream file(Paths::HTML + "signup.html");

         if(!file.is_open()) return crow::response(404);

         stringstream buffer;
         buffer << file.rdbuf();
         
         return crow::response(buffer.str());
     });

     CROW_ROUTE(app, "/signup.css")([]()
     {
           ifstream file(Paths::CSS + "signup.css");

           stringstream buffer;
           buffer << file.rdbuf();

           crow::response res(buffer.str());
           res.set_header("Content-Type", "text/css");

           return res;
     });

     CROW_ROUTE(app, "/signup.js")([]()
     {
           ifstream file(Paths::JS+ "signup.js");

           stringstream buffer;
           buffer << file.rdbuf();

           crow::response res(buffer.str());
           res.set_header("Content-Type", "text/js");

           return res;
     });

     CROW_ROUTE(app, "/api/signup").methods(crow::HTTPMethod::POST)([&RedisManager,&AuditLogger](const crow::request& req)
     {
             crow::response res;
             handle_signup(req,res,RedisManager,AuditLogger);
             return res;
     });
}