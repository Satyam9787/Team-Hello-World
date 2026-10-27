#include "crypto_utils.h"
#include <sodium.h>
#include <sstream>
#include <iomanip>
#include "JWT_token.h"
#include "Logger.h"
#include "Redis.h"
#include <sw/redis++/redis++.h>

using namespace std;

string RedisManager::Reset_token_check(const string& reset_token,RedisManager& RedisManager)
{
    try
    {
        string token_key = "token_email:" + reset_token;

        auto stored_token = redis.get(token_key);

        //Case 1: Key mili hi nahi (Ya toh banayi nahi ya TTL se expire ho gayi)
        if(!stored_token)
        {
            return "TOKEN_EXPIRED";
        }

        string email = *stored_token;
        
        redis.del(token_key);
        
        return email;
    }
    catch(const sw::redis::Error &e)
    { 
        cerr << "Error verifying reset_token in Redis: " << e.what() << endl;
        return "REDIS_ERROR";
    }
}