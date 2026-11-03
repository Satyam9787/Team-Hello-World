#pragma once

#include <sqlite3.h>
#include <string>
#include "AuditLogs.h"

class Table
{
    private:
        sqlite3* db;
        std::atomic<bool> cleanupRunning{true};

    public:
        Table(const std::string& dbPath);
       ~Table();

        bool initialize();
        bool insert(AuditLog& log);
        bool markAsSynced(int id);
        bool deleteSyncedLogs();
        void cleanupWorker();
        void cleanupStop();
};