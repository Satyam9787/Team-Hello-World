#pragma once

#include "crow.h"
#include <sw/redis++/redis++.h>
#include <string>
#include <optional>
#include "db_types.h"
// #include "database.h"

using namespace std;

enum class OTPstatus
{
    OTP_VERIFIED,
    WRONG_OTP,
    EXPIRED,
    REDIS_ERROR,
    FORGET_PASSWORD
};

struct VerifyOtpResult
{
    bool success;
    optional<string> usecase;
    optional<string> reset_token;
    string message;
    optional<string> JWT_token;
};

class RedisManager
{
     private:
         sw::redis::Redis redis;

     public:
          RedisManager(const string &redisUri);

          bool storeOtp(
            const string &email,
            const string &otp,
            int ttl,
            const string &usecase
          );

          VerifyOtpResult verifyOtp(
            const string &email,
            const string &enteredOTP,
            RedisManager& RedisManager
          );

          bool deleteOTP(
            const string &email
          );

          DBStatus Attempt_check(
            const string &email,
            const string &IP,
            const string &password,
            RedisManager &RedisManager
          );

          DBStatus increment_attempt(
            const string &email,
            const string &IP,
            const string &password,
            RedisManager& RedisManager
          );

          bool block_user(
            const string &email,
            const string &IP,
            RedisManager &RedisManager
          );

          void reset_attempt(
            const string &email,
            const string &IP
          );

          string Reset_token_check(
            const string& reset_token,
            RedisManager& RedisManager
          );

          bool verify_JWT_token(
            const string& Recieved_JWT_token
          );

          string Temp_JWT_save(
            const string& email
          );

          bool Temp_JWT_check(
            const string& Recieved_JWT
          );

          optional<string> Fetch_email(
            const string& token
          );
};
