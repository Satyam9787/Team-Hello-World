#include <sw/redis++/redis++.h>
#include <iostream>
#include "Redis.h"
#include "Logger.h"
#include "database.h"
#include "JWT_token.h"

using namespace std;

// 1. Store OTP Logic
bool RedisManager::storeOtp(const string &email, const string &otp, int ttl, const string &usecase)
{
    try
    {
        //Dynamic Key Design: "otp:reason:email"
        // string key = "otp:" + reason + ":" +  email;

        //TTL set ke saath store karein
        redis.set("otp:" + email,otp,chrono::seconds(ttl));
        redis.set("usecase:" + email,usecase,chrono::seconds(ttl));
        return true;
    }
    catch(const sw::redis::Error &e)
    {
        cerr << "Error storing OTP in Redis: " << e.what() << endl;
        return false;
    }
}

// 2. Verify OTP Logic
VerifyOtpResult RedisManager::verifyOtp(const string &email, const string &user_otp,RedisManager& RedisManager)
{
    try
    {
        //Yahan par dhayaan rakhna ki 'reason' wahi ho jo store kaarte waqt tha
        //Agar multiple reasons hain, toh reason bhi parameters main pass kar dena baad main
        string otp_key = "otp:" + email; 
        string usecase_key = "usecase:" + email;

        

        auto stored_otp = redis.get(otp_key);
        auto stored_usecase = redis.get(usecase_key);

        //Case 1: Key mili hi nahi (Ya toh banayi nahi ya TTL se expire ho gayi)
        if(!stored_otp || !stored_usecase)
        {
            return {
                false,
                nullopt,
                nullopt,
                "OTP EXPIRED",
                nullopt
            };
        }

        //Case 2. OTP match ho gaya
        if(*stored_otp == user_otp)
        {
            if(stored_usecase == "FORGET_PASSWORD")
            {
               string reset_token = AuthUtils::create_jwt_token(email);
               redis.set("token_email:" + reset_token,email,chrono::seconds(300));
               redis.del(otp_key); 
               redis.del(usecase_key); // Instant Delete verify hote hi!
               return {
                  true,
                  stored_usecase,
                  reset_token,
                  "OTP_VERIFIED",
                  nullopt
               };
            }
            if(stored_usecase == "LOGIN")
            {
                string JWT_token = AuthUtils::create_jwt_token(email);
                string hashed = sha256_hash(JWT_token);
                redis.set("JWT_token:" + hashed,email,chrono::seconds(86400));
                redis.del(otp_key); 
                redis.del(usecase_key);
                return {
                   true,
                   stored_usecase,
                   nullopt,
                   "OTP_VERIFIED",
                   JWT_token
                };
            }
            if(stored_usecase == "SIGNUP")
            {
                string JWT_token = AuthUtils::create_jwt_token(email);
                string hashed = sha256_hash(JWT_token);
                redis.set("JWT_token:" + hashed,email,chrono::seconds(86400));
                redis.del(otp_key); 
                redis.del(usecase_key);
                return {
                   true,
                   stored_usecase,
                   nullopt,
                   "OTP_VERIFIED",
                   JWT_token
                };
            }
        }

        //Case 3. Key mili par OTP galat tha
        return {
            false,
            nullopt,
            nullopt,
            "WRONG_OTP",
            nullopt
        };
    }
    catch(const sw::redis::Error &e)
    { 
        cerr << "Error verifying OTP in Redis: " << e.what() << endl;
        return {
            false,
            nullopt,
            nullopt,
            "Redis Error",
            nullopt
        };
    }
}