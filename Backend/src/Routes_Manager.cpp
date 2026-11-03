#include "routes.h"
#include "crow.h"
#include "Redis.h"
#include "AuditLogger.h"
#include "BatchRedisStore.h"

using namespace std;

void registerRoutes(crow::SimpleApp& app,RedisManager& RedisManager,AuditLogger& AuditLogger,BatchRedisStore& batchStore)
{
    register_Home_Routes(app);
    register_Login_Routes(app,RedisManager,AuditLogger);
    register_Signup_Routes(app,RedisManager,AuditLogger);
    register_Otp_Routes(app,RedisManager,AuditLogger);
    register_Front_Routes(app,RedisManager);
    register_JWT_check_Routes(app,RedisManager,AuditLogger);
    register_Ebpf_Events_Routes(app,batchStore);
}