#include "routes.h"
#include "crow.h"
#include "Paths.h"
#include <string>
#include <ctime>
#include <iostream>
#include "Redis.h"
#include "JWT_token.h"
#include "AuditLogger.h"
#include "auth_helper.h"

using namespace std;

string generateOTP();
VerifyOtpResult sendEmail(const string&  recipient,const string& otp,RedisManager& RedisManager,const string &usecase,AuditLogger &AuditLogger,const string &IP);
VerifyOtpResult verifyOTP(const string& email,const string& enteredOtp,RedisManager& RedisManager,AuditLogger &AuditLogger,const string &IP);

void register_Otp_Routes(crow::SimpleApp& app,RedisManager& RedisManager,AuditLogger &AuditLogger)
{
     CROW_ROUTE(app, "/otp")([&RedisManager](const crow::request& req)
     {
      //  if(!check_temp_authentication(req, RedisManager))
       // {
      //     crow::response res(302);
       //    res.set_header("Set-Cookie", AuthUtils::build_logout_cookie());
       //    res.set_header("Location", "/404_Not_Found");
       //    return res;
       // }

        ifstream file(Paths::HTML + "otp.html");

        if(!file.is_open()) return crow::response(404);

        stringstream buffer;
        buffer << file.rdbuf();

        return crow::response(buffer.str());
     });

     CROW_ROUTE(app, "/otp.css")([]()
     {
           ifstream file(Paths::CSS + "otp.css");

           stringstream buffer;
           buffer << file.rdbuf();

           crow::response res(buffer.str());
           res.set_header("Content-Type", "text/css");

           return res;
     });

     CROW_ROUTE(app, "/otp.js")([]()
     {
           ifstream file(Paths::JS+ "otp.js");

           stringstream buffer;
           buffer << file.rdbuf();

           crow::response res(buffer.str());
           res.set_header("Content-Type", "text/js");

           return res;
     });

     CROW_ROUTE(app, "/otp_fx.js")([]()
     {
           ifstream file(Paths::JS+ "otp_fx.js");

           stringstream buffer;
           buffer << file.rdbuf();

           crow::response res(buffer.str());
           res.set_header("Content-Type", "text/js");

           return res;
     });

     CROW_ROUTE(app, "/send-otp").methods("POST"_method)([&RedisManager,&AuditLogger](const crow::request& req)
     {
           string IP=req.remote_ip_address;

           auto body = crow::json::load(req.body);
            
           string email = body["email"].s();
           string usecase = body["usecase"].s();
           string otp = generateOTP();

           cout<<otp<<"\n\n\n\n\n\n"<<endl;

           VerifyOtpResult result = sendEmail(email,otp,RedisManager,usecase,AuditLogger,IP);

           crow::json::wvalue json;

           json["success"] = result.success;
           json["message"] = result.message;

           if(result.usecase)
           {
              json["usecase"] = *result.usecase;
           }
           if(result.reset_token)
           {
              json["reset_token"] = *result.reset_token;
           }

           return crow::response(200,json);
     });
     CROW_ROUTE(app, "/verify-otp").methods("POST"_method)([&RedisManager, &AuditLogger](const crow::request& req)
     {
           string IP = req.remote_ip_address;

           auto body = crow::json::load(req.body);
           if (!body)
           {
             return crow::response(400, "Invalid JSON");
           }

           string email = body["email"].s();
           string otp = body["otp"].s();

           VerifyOtpResult result = verifyOTP(email, otp, RedisManager, AuditLogger, IP);

           crow::json::wvalue json;
           json["success"] = result.success;
           json["message"] = result.message;

           if(result.usecase)
           {
              json["usecase"] = *result.usecase;
           }
           if(result.reset_token) 
           {
              json["reset_token"] = *result.reset_token;
           }

           crow::response res(result.success ? 200 : 401, json);

           // sirf success case me hi cookie set karo
           if (result.success && result.JWT_token) 
           {
              res.set_header("Set-Cookie", AuthUtils::build_auth_cookie(*result.JWT_token));
           }

           return res;
      });
}

