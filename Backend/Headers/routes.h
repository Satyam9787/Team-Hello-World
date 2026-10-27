#pragma once

#include "crow.h"
#include "Redis.h"
#include "AuditLogger.h"

void registerRoutes(crow::SimpleApp& app, RedisManager& RedisManager,AuditLogger& AuditLogger);

//Public Routes
void register_Home_Routes(crow::SimpleApp& app);
void register_Login_Routes(crow::SimpleApp& app, RedisManager &RedisManager,AuditLogger& AuditLogger);
void register_Signup_Routes(crow::SimpleApp& app,RedisManager& RedisManager,AuditLogger &AuditLogger);
void register_Otp_Routes(crow::SimpleApp& app,RedisManager& RedisManager,AuditLogger &AuditLogger);
void register_forget_Routes(crow::SimpleApp& app,RedisManager &RedisManager,AuditLogger &AuditLogger);
void register_JWT_check_Routes(crow::SimpleApp& app,RedisManager &RedisManager,AuditLogger &AuditLogger);
void register_404_Not_Found_Routes(crow::SimpleApp& app);
void register_Membership_Routes(crow::SimpleApp& app,RedisManager& RedisManager);

//Protected Routes
void register_Front_Routes(crow::SimpleApp& app,RedisManager &RedisManager);
void register_Dashboard_Routes(crow::SimpleApp& app,RedisManager& RedisManager);
void register_Order_list_Routes(crow::SimpleApp& app,RedisManager& RedisManager);
void register_Create_Sprint_Routes(crow::SimpleApp& app,RedisManager& RedisManager);
