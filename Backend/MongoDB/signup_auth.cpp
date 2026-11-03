#include "database.h"
#include "crypto_utils.h"
#include <mongoc/mongoc.h>
#include <bson/bson.h>
#include <string>

using namespace std;

// int createUserInDB(const string& username, const string& email, const string& password);

int createUserInDB(const string& username, const string& email, const string& password, const string& firstName,const string& lastName, const string& interest,const string& institution)
{
    if(!global_db_client)
    { 
        return -1;
    }
     
    mongoc_collection_t *collection = mongoc_client_get_collection(global_db_client,"CPP_database","users");
    bson_error_t error;

    string email_json = "{\"email\":\"" + email + "\"}";

    bson_t *email_query = bson_new_from_json((const uint8_t*)email_json.c_str(),-1,&error);
    
    if(!email_query)
    {
        mongoc_collection_count_documents(collection,email_query,NULL,NULL,NULL,&error);
    }

    int64_t email_count = mongoc_collection_count_documents(collection,email_query,NULL,NULL,NULL,&error);
    bson_destroy(email_query);

    if(email_count > 0)
    {
        mongoc_collection_destroy(collection);
        return 0;
    }

    string secure_hash = CryptoUtils::hash_password(password);

    bson_t *new_user = BCON_NEW(
    "username", BCON_UTF8(username.c_str()),
    "email",    BCON_UTF8(email.c_str()),
    "password", BCON_UTF8(secure_hash.c_str()),
    "firstName",BCON_UTF8(firstName.c_str()),
    "lastName", BCON_UTF8(lastName.c_str()),
    "Interest", BCON_UTF8(interest.c_str()),
    "institution", BCON_UTF8(institution.c_str())
    );

    if(!new_user)
    { 
        mongoc_collection_destroy(collection);
        return -1;
    }

    bool inserted = mongoc_collection_insert_one(collection,new_user,NULL,NULL,&error);

    bson_destroy(new_user);
    mongoc_collection_destroy(collection);

    if(!inserted)
    {
        return -1;
    }
    return 1;
}

