#include "database.h"
#include "crow.h"
#include "Json_user.h"

using namespace std;

json_of_user JSON_OF_USER(const string& token, RedisManager& redisManager)
{
    // 1. Check MongoDB client
    if (!user_data_db_client)
    {
        cout << "Database error: global_db_client is NULL" << endl;
        return {nullopt,nullopt};
    }

    // 2. Get email from Redis using JWT/token
    optional<string> str = redisManager.Fetch_email(token);

    if (!str)
    {
        cout << "Redis error: Email not found for token" << endl;
        return {nullopt,nullopt};
    }

    string email = *str;

    cout << "Fetching user with email: "
         << email
         << endl;

    // 3. Get MongoDB collection
    mongoc_collection_t* collection =
        mongoc_client_get_collection(
            user_data_db_client,
            "CPP_database",
            "users"
        );

    if (!collection)
    {
        cout << "MongoDB error: Could not get collection" << endl;
        return {nullopt,nullopt};
    }

    // 4. Create query
    bson_t* query = BCON_NEW(
        "email", BCON_UTF8(email.c_str())
    );

    // 5. Execute query
    mongoc_cursor_t* cursor =
        mongoc_collection_find_with_opts(
            collection,
            query,
            nullptr,
            nullptr
        );

    const bson_t* doc = nullptr;
    bson_error_t error;

    // 6. Read document
    if (mongoc_cursor_next(cursor, &doc))
    {
        cout << "MongoDB document received" << endl;

        bson_iter_t iter;

        string objectId;

        if (bson_iter_init_find(&iter, doc, "_id"))
        {
            const bson_oid_t* oid = bson_iter_oid(&iter);

            char oid_str[25];
            bson_oid_to_string(oid, oid_str);

            objectId = oid_str;

            cout << "Object ID: "
                 << objectId
                 << endl;
        }
        else
        {
            cout << "_id field not found" << endl;
        }

        // Fetch username
        if (bson_iter_init_find(&iter, doc, "username"))
        {
            const char* username =
                bson_iter_utf8(&iter, nullptr);

            string usernameStr(username);

            cout << "username: "
                 << usernameStr
                 << endl;

            mongoc_cursor_destroy(cursor);
            bson_destroy(query);
            mongoc_collection_destroy(collection);

            return {
                usernameStr,
                objectId
            };
        }

        cout << "username field not found in document" << endl;
    }
    else
    {
        // Check whether MongoDB itself reported an error
        if (mongoc_cursor_error(cursor, &error))
        {
            cout << "MongoDB cursor error: "
                 << error.message
                 << endl;
        }
        else
        {
            cout << "No user found for email: "
                 << email
                 << endl;
        }
    }

    // 7. Cleanup
    mongoc_cursor_destroy(cursor);
    bson_destroy(query);
    mongoc_collection_destroy(collection);

    return {nullopt,nullopt};
}
