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
#include "Redis_batch_worker.h"
#include "Detection_worker.h"

using namespace std;

int main()
{
     // .env load
     loadEnv("../.env");

     // Redis initialization
     RedisManager RedisManager(getEnvValue("REDIS_URI"));

     //Argon2id initialization
     CryptoUtils::init();

     //MongoDB initialization
     init_database();  

     // SQLite initialization
     initSQLite();

     Table auditTable("../SQLite/Data/audit_logs.db");
     auditTable.initialize();

     LogQueue LogQueue(auditTable);

     AuditLogger auditLogger(auditTable, LogQueue);

     std::thread worker(&LogQueue::processLogs,&LogQueue,std::ref(auditTable));

     std::thread cleanupWorker(&Table::cleanupWorker,&auditTable);

     BatchQueue eventQueue(20);

     RedisBatchWorker redisWorker(
          getEnvValue("REDIS_URI"),
          eventQueue
     );

     DetectionWorker detectionWorker(eventQueue);

     std::thread redisThread(
          &RedisBatchWorker::run,
          &redisWorker
     );

     std::thread detectionThread(
          &DetectionWorker::run,
          &detectionWorker
     );

     crow::SimpleApp app;

     registerRoutes(app,RedisManager,auditLogger);
     
     //Server start
     app.ssl_file("../certs/server.crt", "../certs/server.key").bindaddr("0.0.0.0").port(18080).multithreaded().run();

     LogQueue.stop();
     auditTable.cleanupStop();
     worker.join();
     cleanupWorker.join();

     closeSQLite();

     // Server band hone par safely cleanup karo
     cleanup_database();
     return 0;
}