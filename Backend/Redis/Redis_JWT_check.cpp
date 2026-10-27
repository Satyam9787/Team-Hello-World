#include <sw/redis++/redis++.h>
#include <iostream>
#include "Redis.h"
#include "Logger.h"
#include "JWT_token.h"

using namespace std;

bool RedisManager::verify_JWT_token(const string& Recieved_JWT_token)
{
     string hashed = sha256_hash(Recieved_JWT_token);

     string JWT_token_key = "JWT_token:" + hashed;

     auto result = redis.get(JWT_token_key);

     if(result)
     {
          // Key mil gayi!
          return true;
     }
     // Key nahi mili,kuch to gadbad hai!
     return false;
}

string RedisManager::Temp_JWT_save(const string& email)
{
     string Temp_JWT_token = AuthUtils::create_jwt_token(email);
     string hashed = sha256_hash(Temp_JWT_token);

     redis.set("Temp_JWT_token:" + hashed,email,chrono::seconds(120));

     return Temp_JWT_token;
}

bool RedisManager::Temp_JWT_check(const string& Recieved_JWT)
{
     string hashed = sha256_hash(Recieved_JWT);

     string JWT_token_key = "Temp_JWT_token:" + hashed;

     auto result = redis.get(JWT_token_key);

     if(result)
     {
          redis.del(JWT_token_key);
          return true;
     }
     return false;
}

optional<string> RedisManager::Fetch_email(const string& token)
{
     string hashed = sha256_hash(token);
     string email_key = "JWT_token:" + hashed;

     auto result = redis.get(email_key);
 
     return result;
}

