#pragma once

#include "crow.h"
#include "Redis.h"
#include "AuditLogger.h"
#include "BatchRedisStore.h"

#include <atomic>

void registerRoutes(
    crow::SimpleApp& app,
    RedisManager& RedisManager,
    AuditLogger& AuditLogger,
    BatchRedisStore& batchStore
);

// Background Redis -> WebSocket publisher
void publishBatches(
    BatchRedisStore& batchStore,
    std::atomic<bool>& running
);

// Public Routes
void register_Home_Routes(crow::SimpleApp& app);
void register_Login_Routes(crow::SimpleApp& app, RedisManager& RedisManager, AuditLogger& AuditLogger);
void register_Signup_Routes(crow::SimpleApp& app, RedisManager& RedisManager, AuditLogger& AuditLogger);
void register_Otp_Routes(crow::SimpleApp& app, RedisManager& RedisManager, AuditLogger& AuditLogger);
void register_forget_Routes(crow::SimpleApp& app, RedisManager& RedisManager, AuditLogger& AuditLogger);
void register_JWT_check_Routes(crow::SimpleApp& app, RedisManager& RedisManager, AuditLogger& AuditLogger);
void register_404_Not_Found_Routes(crow::SimpleApp& app);
void register_Membership_Routes(crow::SimpleApp& app, RedisManager& RedisManager);
void register_Ebpf_Events_Routes(crow::SimpleApp& app, BatchRedisStore& batchStore);

// Protected Routes
void register_Front_Routes(crow::SimpleApp& app, RedisManager& RedisManager);
void register_Dashboard_Routes(crow::SimpleApp& app, RedisManager& RedisManager);
void register_Order_list_Routes(crow::SimpleApp& app, RedisManager& RedisManager);
void register_Create_Sprint_Routes(crow::SimpleApp& app, RedisManager& RedisManager);
