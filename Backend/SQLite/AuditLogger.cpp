#include "SQLite.h"
#include "Tables.h"
#include "AuditLogs.h"
#include "crow.h"
#include "AuditLogger.h"
#include <chrono>
#include <ctime>
#include <iomanip>
#include <sstream>
#include "LogQueue.h"
    
using namespace std;

string getCurrentTimestamp()
{
    auto now = std::chrono::system_clock::now();

    std::time_t currentTime =
        std::chrono::system_clock::to_time_t(now);

    std::tm localTime{};

    localtime_r(&currentTime, &localTime);

    std::ostringstream timestamp;

    timestamp << std::put_time(
        &localTime,
        "%Y-%m-%d %H:%M:%S"
    );

    return timestamp.str();
}

AuditLogger::AuditLogger(Table& table, LogQueue& logQueue) : table(table),logQueue(logQueue)
{;}

void AuditLogger::logLoginSuccess(const string& email,const string& ip,const string &Reason)
{
    AuditLog log;

    log.event = AuditEvent::LOGIN;
    log.email = email;
    log.ip_address = ip;
    log.status = AuditStatus::SUCCESS;
    log.Reason = Reason;
    log.timestamp = getCurrentTimestamp();

    if(table.insert(log))
    {
        logQueue.push(log);
    }
}

void AuditLogger::logLoginFailure(const string& email,const string& ip,const string &Reason)
{
    AuditLog log;

    log.event = AuditEvent::LOGIN;
    log.email = email;
    log.ip_address = ip;
    log.status = AuditStatus::FAILED;
    log.Reason = Reason;
    log.timestamp = getCurrentTimestamp();

    if(table.insert(log))
    {
        logQueue.push(log);
    }
}

void AuditLogger::logSignupSuccess(const string& email,const string& ip,const string &Reason)
{
    AuditLog log;

    log.event = AuditEvent::SIGNUP;
    log.email = email;
    log.ip_address = ip;
    log.status = AuditStatus::SUCCESS;
    log.Reason = Reason;
    log.timestamp = getCurrentTimestamp();

    if(table.insert(log))
    {
        logQueue.push(log);
    }
}

void AuditLogger::logSignupFailure(const string& email,const string& ip,const string &Reason)
{
    AuditLog log;

    log.event = AuditEvent::SIGNUP;
    log.email = email;
    log.ip_address = ip;
    log.status = AuditStatus::FAILED;
    log.Reason = Reason;
    log.timestamp = getCurrentTimestamp();

    if(table.insert(log))
    {
        logQueue.push(log);
    }
}

void AuditLogger::logOtpSentSuccess(const string& email,const string& ip,const string &Reason)
{
    AuditLog log;

    log.event = AuditEvent::OTP_SENT;
    log.email = email;
    log.ip_address = ip;
    log.status = AuditStatus::SUCCESS;
    log.Reason = Reason;
    log.timestamp = getCurrentTimestamp();

    if(table.insert(log))
    {
        logQueue.push(log);
    }
}

void AuditLogger::logOtpSentFailure(const string& email,const string& ip,const string &Reason)
{
    AuditLog log;

    log.event = AuditEvent::OTP_SENT;
    log.email = email;
    log.ip_address = ip;
    log.status = AuditStatus::FAILED;
    log.Reason = Reason;
    log.timestamp = getCurrentTimestamp();

    if(table.insert(log))
    {
        logQueue.push(log);
    }
}

void AuditLogger::logOtpVerifiedSuccess(const string& email,const string& ip,const string &Reason)
{
    AuditLog log;

    log.event = AuditEvent::OTP_VERIFIED;
    log.email = email;
    log.ip_address = ip;
    log.status = AuditStatus::SUCCESS;
    log.Reason = Reason;
    log.timestamp = getCurrentTimestamp();

    if(table.insert(log))
    {
        logQueue.push(log);
    }
}

void AuditLogger::logOtpVerifiedFailure(const string& email,const string& ip,const string &Reason)
{
    AuditLog log;

    log.event = AuditEvent::OTP_VERIFIED;
    log.email = email;
    log.ip_address = ip;
    log.status = AuditStatus::FAILED;
    log.Reason = Reason;
    log.timestamp = getCurrentTimestamp();

    if(table.insert(log))
    {
        logQueue.push(log);
    }
}

void AuditLogger::logForgetVerifySuccess(const string& email,const string& ip,const string &Reason)
{
    AuditLog log;

    log.event = AuditEvent::FORGET_VERIFY;
    log.email = email;
    log.ip_address = ip;
    log.status = AuditStatus::SUCCESS;
    log.Reason = Reason;
    log.timestamp = getCurrentTimestamp();

    if(table.insert(log))
    {
        logQueue.push(log);
    }
}

void AuditLogger::logForgetVerifyFailure(const string& email,const string& ip,const string &Reason)
{
    AuditLog log;

    log.event = AuditEvent::FORGET_VERIFY;
    log.email = email;
    log.ip_address = ip;
    log.status = AuditStatus::FAILED;
    log.Reason = Reason;
    log.timestamp = getCurrentTimestamp();

    if(table.insert(log))
    {
        logQueue.push(log);
    }
}

void AuditLogger::logPasswordResetSuccess(const string& email,const string& ip,const string &Reason)
{
    AuditLog log;

    log.event = AuditEvent::PASSWORD_RESET;
    log.email = email;
    log.ip_address = ip;
    log.status = AuditStatus::SUCCESS;
    log.Reason = Reason;
    log.timestamp = getCurrentTimestamp();

    if(table.insert(log))
    {
        logQueue.push(log);
    }
}

void AuditLogger::logPasswordResetFailure(const string& email,const string& ip,const string &Reason)
{
    AuditLog log;

    log.event = AuditEvent::PASSWORD_RESET;
    log.email = email;
    log.ip_address = ip;
    log.status = AuditStatus::FAILED;
    log.Reason = Reason;
    log.timestamp = getCurrentTimestamp();

    if(table.insert(log))
    {
        logQueue.push(log);
    }
}
