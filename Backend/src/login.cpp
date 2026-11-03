#include "crow.h"
#include "database.h"
#include <string>
#include "Logger.h"
#include "Redis.h"
#include "AuditLogger.h"
#include "JWT_token.h"

using namespace std;

void handleLogin(const crow::request& req,crow::response& res,RedisManager &RedisManager,AuditLogger& AuditLogger);

void handleLogin(const crow::request& req, crow::response& res,RedisManager &RedisManager,AuditLogger& AuditLogger)
{
    //Crow mai response headers ko JSON set kar dete hain
    res.set_header("Content-Type", "application/json");

    // 1. Request body ko JSON mai parse karna
    auto json_data = crow::json::load(req.body);
    string email = json_data["email"].s();
    string IP=req.remote_ip_address;

        try
        {
            if(!json_data || !json_data.has("email") || !json_data.has("password"))
            {
                res.code = 400; //Bad request
                AuditLogger.logLoginFailure(email,IP,"Email and password required");
                res.body = "{\"error\": \"Email and password required\"}";
                return;
            }

            string password = json_data["password"].s();
        
            DBStatus Attempt_status = RedisManager.Attempt_check(email,IP,password,RedisManager);
                // 3.Response Generation (If-Else logic)
                if(Attempt_status.message == "SUCCESS")
                {
                     optional<string> optionalStr = Attempt_status.token;
                     string regularStr = optionalStr.value_or("default value");   
                     res.code = 201;
                     AuditLogger.logLoginSuccess(email,IP,"Login successful!");
                     res.set_header("Set-Cookie", AuthUtils::build_auth_cookie(regularStr));
                     res.body = "{\"status\": \"otp_required\",""\"message\": \"Login successful!\"}";
                }
                else if(Attempt_status.message == "EMAIL_NOT_FOUND_IN_DB")
                {
                     res.code = 401;
                     AuditLogger.logLoginFailure(email,IP,"Unknown user / No user exist!");
                     res.body = "{\"status\": \"USER_NOT_FOUND\", \"error\": \"Unknown user / No user exist!\"}";
                }
                else if(Attempt_status.message == "WRONG_PASSWORD")
                {
                     res.code = 404;
                     AuditLogger.logLoginFailure(email,IP,"Invalid_pass");
                     res.body = "{\"status\":\"Invalid_pass\"}";
                }
                else if(Attempt_status.message == "ATTEMPT_LIMIT_EXCEED")
                {
                     res.code = 429;
                     AuditLogger.logLoginFailure(email,IP,"Attempt Limit Exceed");
                     res.body = "{\"status\":\"ATTEMPT_LIMIT_EXCEED\",\"error\":\"Attempt Limit Exceed.Please Try again later!\"}";
                }
                else
                {
                     res.code = 500;
                     AuditLogger.logLoginFailure(email,IP,"Database connection issue.");
                     res.body = "{\"status\":\"error\",\"error\":\"Database connection issue.\"}";
                }
        }
        catch(const std::exception& e)
        {
            //Agar database down hua ya koei aur crash hua toh server nahi rukega
            res.code = 500;
            AuditLogger.logLoginFailure(email,IP,"Internal Server Error");
            res.body = "{\"status\": \"error\", \"error\": \"Internal Server Error. Database connectivity issue.\"}";
        }
}