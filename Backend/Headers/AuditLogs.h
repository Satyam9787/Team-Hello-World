#pragma once

#include "crow.h"
#include <string>

using namespace std;

enum class AuditEvent
{
    OTP_SENT,
    OTP_VERIFIED,
    OTP_FAILED,

    FORGET_VERIFY,
    PASSWORD_RESET,

    RATE_LIMIT_BLOCK,

    UNKNOWN,

    LOGIN,
    SIGNUP
};

enum class AuditStatus
{
    SUCCESS,
    FAILED,
    BLOCKED,
    EXPIRED,
    UNKNOWN
};

struct AuditLog
{
    int id = 0;

    AuditEvent event;
    AuditStatus status;
    
    string Reason;
    string email;
    string ip_address;
    string timestamp;
};

string toString(AuditEvent event);
string toString(AuditStatus status);