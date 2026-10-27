#include "crow.h"
#include "AuditLogs.h"

using namespace std;

string toString(AuditEvent event)
{
    switch(event)
    {
        case AuditEvent::LOGIN:
            return "LOGIN";

        case AuditEvent::SIGNUP:
            return "SIGNUP";

        case AuditEvent::OTP_SENT:
            return "OTP_SENT";

        case AuditEvent::OTP_VERIFIED:
            return "OTP_VERIFIED";

        case AuditEvent::PASSWORD_RESET:
            return "PASSWORD_RESET";

        default:
            return "UNKNOWN";
    }
}

string toString(AuditStatus status)
{
    switch(status)
    {
        case AuditStatus::SUCCESS:
            return "SUCCESS";

        case AuditStatus::FAILED:
            return "FAILED";

        default:
            return "UNKNOWN";
    }
}