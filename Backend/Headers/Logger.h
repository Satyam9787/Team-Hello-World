// login.h
#ifndef LOGIN_H
#define LOGIN_H

#include "crow.h" // Crow framework include karna zaroori hai
#include <string>

using namespace std;

enum class LogEntry
{
     ATTEMPT,

     DETAILS_MISSING,

     LOGIN_SUCCESS,

     SIGNUP_SUCCESS,

     USER_NOT_FOUND,

     USER_ALREADY_EXIST,

     INVALID_PASSWORD,

     DB_CONNECTION_ISSUE,

     SERVER_ERROR,

     ATTEMPT_LIMIT_EXCEED,

     FORGET_PASSWORD,

     PASSWORD_RESET,

     PASSWORD_RESET_TOKEN_EXPIRED
};

struct LogData
{
     string event;

     string email;
     
     string ip;

     string response;

     int status_code;

     string timestamp;
};


#endif
