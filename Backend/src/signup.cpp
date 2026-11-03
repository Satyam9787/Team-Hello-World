#include "crow.h"
#include <string>
#include "database.h"
#include "Logger.h"
#include "AuditLogger.h"
#include "Redis.h"
#include "JWT_token.h"
#include "db_types.h"

using namespace std;

void handle_signup(const crow::request& req,crow::response& res,RedisManager& RedisManager,AuditLogger &AuditLogger);

void handle_signup(const crow::request& req, crow::response& res,RedisManager& RedisManager,AuditLogger &AuditLogger)
{
    res.set_header
    ("Content-Type","application/json");
   auto json_data = crow::json::load(req.body);
   string email = json_data["email"].s();
   string IP=req.remote_ip_address;

    try
    {
         if(!json_data || !json_data.has("username") || !json_data.has("email") || !json_data.has("password"))
         {
            res.code = 400;
            AuditLogger.logSignupFailure(email,IP,"Incomplete Input");
            res.body= "{\"error\":\"username,email,password required\"}";
            return;
         }

         string username = json_data["username"].s();
         string password = json_data["password"].s();
         string firstName = json_data["firstName"].s();
         string lastName = json_data["lastName"].s();
         string interest = json_data["interest"].s();
         string institution = json_data["institution"].s();

         int signup_status = createUserInDB(username,email,password,firstName,lastName,interest,institution);

         DBStatus Attempt_status = RedisManager.Attempt_check(email,IP,password,RedisManager);

         if(signup_status == 1)
         {
            optional<string> optionalStr = Attempt_status.token;
            string regularStr = optionalStr.value_or("default value");
            res.code = 200;
            AuditLogger.logSignupSuccess(email,IP,"Signup success");
            res.set_header("Set-Cookie", AuthUtils::build_auth_cookie(regularStr));
            res.body = "{\"status\":\"otp_required\",""\"message\":\"OTP sent to email\"}";
         }
         else if(signup_status == 0)
         {
             res.code = 409;
             AuditLogger.logSignupFailure(email,IP,"User already exist");
             res.body = "{\"status\":\"fail\",""\"message\":\"User already exists\"}";
         }
         else
         {
            res.code = 500;
            AuditLogger.logSignupFailure(email,IP,"Database error");
            res.body = "{\"status\":\"fail\",""\"message\":\"Database error\"}";
         }
    }
    catch(const exception& e)
    {
          res.code = 500;
          AuditLogger.logSignupFailure(email,IP,"Internal server error");
          res.body = "{\"status\":\"fail\",""\"message\":\"Internal server error\"}";
    }
}