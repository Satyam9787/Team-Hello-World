#include "database.h"
#include "env_config.h"
#include <cstdlib>

using namespace std;

mongoc_client_t *global_db_client = nullptr;
mongoc_client_t *user_data_db_client = nullptr;

void init_database()
{
    mongoc_init();

    bson_error_t error;

    string mongodb_url = getEnvValue("MONGO_URI");

    mongoc_uri_t *uri =
        mongoc_uri_new_with_error(
            mongodb_url.c_str(),
            &error
        );

    if(!uri)
    {
        cerr << "URI Error: "
             << error.message
             << endl;
        return;
    }

    mongoc_uri_destroy(uri);

    // Existing client
    global_db_client =
        mongoc_client_new(
            mongodb_url.c_str()
        );

    // Second client - only for user/profile data
    user_data_db_client =
        mongoc_client_new(
            mongodb_url.c_str()
        );

    if(!global_db_client)
    {
        cerr << "Global MongoDB client creation failed!"
             << endl;
    }

    if(!user_data_db_client)
    {
        cerr << "User-data MongoDB client creation failed!"
             << endl;
    }
}

void cleanup_database()
{
    if(global_db_client)
    {
        mongoc_client_destroy(global_db_client);
        global_db_client = nullptr;
    }

    if(user_data_db_client)
    {
        mongoc_client_destroy(user_data_db_client);
        user_data_db_client = nullptr;
    }

    mongoc_cleanup();
}