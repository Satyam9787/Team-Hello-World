#pragma once

#include "crow.h"
#include <sqlite3.h>

using namespace std;

extern sqlite3 *global_sqlite_db;

bool initSQLite();
void closeSQLite();
bool executeQuery(const string& query);