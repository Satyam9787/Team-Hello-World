#include "database.h"
#include <mongoc/mongoc.h>
#include <bson/bson.h>
#include <chrono>
#include <string>
#include "Logger.h"
#include "AuditLogs.h"
#include "Tables.h"

using namespace std;

bool saveLogInDB(AuditLog log)
{
    string status = toString(log.status);
    string event = toString(log.event);
    string Reason = log.Reason;
    string email = log.email;
    int id = log.id;
    string ip_address = log.ip_address;
    string timestamp = log.timestamp;

    bson_error_t error;

    // Get MongoDB collection
    mongoc_collection_t *collection =
        mongoc_client_get_collection(
            global_db_client,
            "CPP-database",
            "Logs"
        );

    if (!collection)
    {
        std::cerr << "[MongoDB] Failed to get collection."
                  << std::endl;

        return false;
    }

    // --------------------------------------------------
    // Check whether this SQLite log ID already exists
    // --------------------------------------------------

    bson_t *id_query = BCON_NEW(
        "ID", BCON_INT32(id)
    );

    int64_t id_count = mongoc_collection_count_documents(
        collection,
        id_query,
        NULL,
        NULL,
        NULL,
        &error
    );

    bson_destroy(id_query);

    if (id_count < 0)
    {
        std::cerr << "[MongoDB] Failed to check log ID: "
                  << error.message
                  << std::endl;

        mongoc_collection_destroy(collection);

        return false;
    }

    // Log already exists
    if (id_count > 0)
    {
        std::cout << "[MongoDB] Log ID "
                  << id
                  << " already exists. Skipping insertion."
                  << std::endl;

        mongoc_collection_destroy(collection);

        // Return true so markAsSynced() will execute
        return true;
    }

    // --------------------------------------------------
    // Existing IP check
    // --------------------------------------------------

    string ip_json =
        "{\"IP_Address\":\"" + ip_address + "\"}";

    bson_t *ip_query =
        bson_new_from_json(
            (const uint8_t*)ip_json.c_str(),
            -1,
            &error
        );

    if (!ip_query)
    {
        std::cerr << "[MongoDB] Failed to create IP query: "
                  << error.message
                  << std::endl;

        mongoc_collection_destroy(collection);

        return false;
    }

    int64_t ip_count =
        mongoc_collection_count_documents(
            collection,
            ip_query,
            NULL,
            NULL,
            NULL,
            &error
        );

    if (ip_count < 0)
    {
        std::cerr << "[MongoDB] IP query failed: "
                  << error.message
                  << std::endl;

        bson_destroy(ip_query);
        mongoc_collection_destroy(collection);

        return false;
    }

    bson_destroy(ip_query);

    // --------------------------------------------------
    // Create MongoDB document
    // --------------------------------------------------

    bson_t *new_user = BCON_NEW(
        "ID",         BCON_INT32(id),
        "Event",      BCON_UTF8(event.c_str()),
        "IP_Address", BCON_UTF8(ip_address.c_str()),
        "Email",      BCON_UTF8(email.c_str()),
        "Reason",     BCON_UTF8(Reason.c_str()),
        "Status",     BCON_UTF8(status.c_str()),
        "Timestamp",  BCON_UTF8(timestamp.c_str())
    );

    if (!new_user)
    {
        std::cerr << "[MongoDB] Failed to create document."
                  << std::endl;

        mongoc_collection_destroy(collection);

        return false;
    }

    // --------------------------------------------------
    // Insert document
    // --------------------------------------------------

    bool inserted =
        mongoc_collection_insert_one(
            collection,
            new_user,
            NULL,
            NULL,
            &error
        );

    bson_destroy(new_user);
    mongoc_collection_destroy(collection);

    if (!inserted)
    {
        std::cerr << "[MongoDB] Insert failed: "
                  << error.message
                  << std::endl;

        return false;
    }

    std::cout << "[MongoDB] Log ID "
              << log.id
              << " inserted successfully."
              << std::endl;

    return true;
}
