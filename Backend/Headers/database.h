//#ifndef DATABASE_H
//#define DATABASE_H

#pragma once

#include <mongoc/mongoc.h>
#include "crow.h"
#include <string>
#include "Logger.h"
#include "Redis.h"
#include "AuditLogs.h"
#include "AuditLogger.h"

using namespace std;

//Global client pointer taaki baaki files use kar sakein
extern mongoc_client_t *global_db_client;
extern mongoc_client_t *user_data_db_client;

//Functions declarations
void init_database();
void cleanup_database();
DBStatus verifyCredentialsInDB(const string& email, const string& password,RedisManager &RedisManager);
int createUserInDB(const string& username, const string& email, const string& password, const string& firstName,const string& lastName,const string& interest,const string& institution);
bool saveLogInDB(AuditLog log);
int verifyUserInDB(const string& email);
int New_password(const string& new_password,const string& reset_token,RedisManager &RedisManager,AuditLogger &AuditLogger,const string &IP);