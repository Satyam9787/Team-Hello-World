#pragma once

#include "crow.h"
#include "AuditLogs.h"
#include <bits/stdc++.h>
#include "Tables.h"

using namespace std;

class LogQueue
{
    private:
        std::queue<AuditLog> queue;

        std::mutex mutex;
        std::condition_variable cv;

        std::atomic<bool> running{true};

        Table& auditTable;

        //std::thread worker;

    public:
        LogQueue(Table& auditTable);

        void push(const AuditLog& log);
        AuditLog pop();

        void processLogs(Table& auditTable);
        void cleanupLogs(Table& auditTable);

        void stop();

        ~LogQueue();
};