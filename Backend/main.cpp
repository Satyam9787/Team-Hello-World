#include "crow.h"
#include "routes.h"
#include "database.h"
#include "env_config.h"
#include "crypto_utils.h"
#include "Redis.h"
#include "SQLite.h"
#include "Tables.h"
#include "AuditLogs.h"
#include "AuditLogger.h"
#include "LogQueue.h"
#include "BatchRedisStore.h"

#include <functional>
#include <iostream>
#include <stdexcept>
#include <string>
#include <thread>

using namespace std;

int main() {

    // ================= ENVIRONMENT =================

    loadEnv("../.env");

    const string redisUri = getEnvValue("REDIS_URI");

    if (redisUri.empty()) {
        throw runtime_error("REDIS_URI is missing");
    }

    // ================= REDIS =================

    RedisManager RedisManager(redisUri);

    // Separate Redis connection for Prahari batches.
    BatchRedisStore batchStore(redisUri);

    // ================= CRYPTO =================

    CryptoUtils::init();

    // ================= MONGODB =================

    init_database();

    // ================= SQLITE =================

    initSQLite();

    Table auditTable("../SQLite/Data/audit_logs.db");
    auditTable.initialize();

    LogQueue LogQueue(auditTable);

    AuditLogger auditLogger(auditTable, LogQueue);

    thread worker(
        &LogQueue::processLogs,
        &LogQueue,
        ref(auditTable)
    );

    thread cleanupWorker(
        &Table::cleanupWorker,
        &auditTable
    );

    // ================= CROW SERVER =================

    crow::SimpleApp app;

    registerRoutes(
        app,
        RedisManager,
        auditLogger,
        batchStore
    );

    cout << "[PRAHARI] Starting server...\n";

    app.ssl_file(
        "../certs/server.crt",
        "../certs/server.key"
    )
    .bindaddr("0.0.0.0")
    .port(18080)
    .multithreaded()
    .run();

    // ================= SHUTDOWN =================

    cout << "[PRAHARI] Shutting down...\n";

    LogQueue.stop();
    auditTable.cleanupStop();

    worker.join();
    cleanupWorker.join();

    closeSQLite();
    cleanup_database();

    cout << "[PRAHARI] Shutdown complete.\n";

    return 0;
}
