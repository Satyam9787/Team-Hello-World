#pragma once

#include "crow.h"
#include <string>
#include "AuditLogger.h"
#include "Tables.h"
#include "LogQueue.h"

using namespace std;

class AuditLogger
{
    private:
        LogQueue& logQueue;
        Table& table;
        
    public:
        AuditLogger(Table& table,LogQueue& logQueue);

        void logLoginSuccess(const string& email,
                         const string& ip,const string& Reason);

        void logLoginFailure(const string& email,
                         const string& ip,const string &Reason);

        void logSignupSuccess(const string& email,
                         const string& ip,const string &Reason);

        void logSignupFailure(const string& email,
                         const string& ip,const string &Reason);

        void logOtpSentSuccess(const string& email,
                         const string& ip,const string &Reason);

        void logOtpSentFailure(const string& email,
                         const string& ip,const string &Reason);

        void logOtpVerifiedSuccess(const string& email,
                         const string& ip,const string &Reason);

        void logOtpVerifiedFailure(const string& email,
                         const string& ip,const string &Reason);

        void logForgetVerifySuccess(const string& email,
                         const string& ip,const string &Reason);

        void logForgetVerifyFailure(const string& email,
                         const string& ip,const string &Reason);

        void logPasswordResetSuccess(const string& email,
                         const string& ip,const string &Reason);

        void logPasswordResetFailure(const string& email,
                         const string& ip,const string &Reason);
};

string getCurrentTimestamp();