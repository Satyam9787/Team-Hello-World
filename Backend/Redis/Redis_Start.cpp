#include <sw/redis++/redis++.h>
#include <iostream>
#include "Redis.h"
#include "Logger.h"

using namespace std;

// Constructor Initialization List use karke connection setup karenge 
RedisManager::RedisManager(const string &redisUri) : redis(redisUri)
{
    try
    {
        redis.ping();
        cout << "Connected to Redis successfully! " << endl;
    }
    catch(const sw::redis::Error &e)
    {
        cerr << "Redis Connection Error: " << e.what() << endl;
        throw;  //object banne hi nahi dega agar Redis unavailable hai.
    }
}