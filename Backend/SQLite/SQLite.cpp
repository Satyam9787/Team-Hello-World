#include "SQLite.h"
#include "crow.h"
#include <iostream>
#include <filesystem>

using namespace std;

sqlite3 *global_sqlite_db = nullptr;

bool initSQLite()
{
    filesystem::create_directories(filesystem::path(PROJECT_ROOT) / "SQLite" / "SQLite_data");

    filesystem::path dbPath = filesystem::path(PROJECT_ROOT) / "SQLite" / "SQLite_data" / "SQLite.db";

    int rc = sqlite3_open(dbPath.string().c_str(), &global_sqlite_db);

    if(rc != SQLITE_OK)
    {
        cout << "SQLite Database open failed" <<sqlite3_errmsg(global_sqlite_db)<<endl;
        sqlite3_close(global_sqlite_db);
        global_sqlite_db = nullptr;
        return false;
    }
    cout<< "SQLite Database connected" << endl;
    return true;
}

void closeSQLite()
{
    if(global_sqlite_db)
    {
        sqlite3_close(global_sqlite_db);
        global_sqlite_db = nullptr;
    }
}