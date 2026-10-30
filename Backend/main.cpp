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

#include <functional>
#include <iostream>
#include <stdexcept>
#include <string>
#include <thread>

#include "Redis_batch_worker.h"
#include "Detection_worker.h"
#include "Network_detection.h"

using namespace std;

int main() {

    // ================= ENVIRONMENT =================

    loadEnv("../.env");

    const string redisUri = getEnvValue("REDIS_URI");
    const string networkStream =
        getEnvValue("NETWORK_STREAM_NAME");

    if (redisUri.empty()) {
        throw runtime_error("REDIS_URI is missing");
    }

    if (networkStream.empty()) {
        throw runtime_error("NETWORK_STREAM_NAME is missing");
    }

    // ================= REDIS =================

    RedisManager RedisManager(redisUri);

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

    // ================= PROCESS PIPELINE =================

    BatchQueue eventQueue(20);
    CompletedBatchQueue completedBatches(100);

    RedisBatchWorker redisWorker(
        redisUri,
        eventQueue,
        "ebpf:process_events",
        "ebpf-detectors",
        "crow-worker-1"
    );

    DetectionWorker detectionWorker(
        eventQueue,
        completedBatches
    );

    // ================= NETWORK PIPELINE =================

    BatchQueue networkEventQueue(20);
    CompletedBatchQueue networkCompletedBatches(100);

    RedisBatchWorker networkRedisWorker(
        redisUri,
        networkEventQueue,
        "ebpf:network_events",
        "ebpf-network-detectors",
        "network-worker-1"
    );

    NetworkDetectionWorker networkDetectionWorker(
        networkEventQueue,
        networkCompletedBatches
    );

    // ================= PROCESS THREADS =================

    thread redisThread(
        &RedisBatchWorker::run,
        &redisWorker
    );

    thread detectionThread(
        &DetectionWorker::run,
        &detectionWorker
    );

    // ================= NETWORK THREADS =================

    thread networkRedisThread(
        &RedisBatchWorker::run,
        &networkRedisWorker
    );

    thread networkDetectionThread(
        &NetworkDetectionWorker::run,
        &networkDetectionWorker
    );

    // ================= CROW SERVER =================

    crow::SimpleApp app;

    // Existing route registration is retained for now.
    // Network API integration comes in the next phase.

    registerRoutes(
        app,
        RedisManager,
        auditLogger,
        completedBatches,
        networkCompletedBatches
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

    // Stop Redis consumers.
    redisWorker.stop();
    networkRedisWorker.stop();

    // Wake up queue consumers/producers.
    eventQueue.stop();
    networkEventQueue.stop();

    // Stop detection workers.
    detectionWorker.stop();
    networkDetectionWorker.stop();

    // Stop completed queues.
    completedBatches.stop();
    networkCompletedBatches.stop();

    // Join all monitoring threads.
    redisThread.join();
    detectionThread.join();

    networkRedisThread.join();
    networkDetectionThread.join();

    // ================= LOGGING SHUTDOWN =================

    LogQueue.stop();
    auditTable.cleanupStop();

    worker.join();
    cleanupWorker.join();

    // ================= CLEANUP =================

    closeSQLite();
    cleanup_database();

    cout << "[PRAHARI] Shutdown complete.\n";

    return 0;
}
