#include "database.h"
#include "crypto_utils.h"
#include <bson/bson.h>
#include <mongoc/mongoc.h>
#include <string>
#include <iostream>
#include "Redis.h"
#include "AuditLogger.h"
#include "AuditLogs.h"

using namespace std;

int verifyUserInDB(const string& email)
{
      if(!global_db_client)
      {
           return -1;
      }

     mongoc_collection_t *collection = mongoc_client_get_collection(
          global_db_client, "CPP_database", "users"
        );
     bson_error_t error;

     // STEP 1: Sirf email se document dhundo
     bson_t *email_query = BCON_NEW("email", BCON_UTF8(email.c_str()));

     mongoc_cursor_t *cursor = mongoc_collection_find_with_opts(
          collection, email_query, NULL, NULL
        );
     bson_destroy(email_query);

     // STEP 2: Document mila ya nahi
     const bson_t *doc;
     if(!mongoc_cursor_next(cursor, &doc))
     {
          // Email DB mein nahi mili
          mongoc_cursor_destroy(cursor);
          mongoc_collection_destroy(collection);
          return 0;
     }

     mongoc_cursor_destroy(cursor);
     mongoc_collection_destroy(collection);

     return 1; // ✅ Success
}
int New_password(const string& new_password,const string& reset_token,RedisManager& RedisManager,AuditLogger &AuditLogger,const string &IP)
{
     string Redis_status = RedisManager.Reset_token_check(reset_token,RedisManager);

     if(Redis_status == "TOKEN_EXPIRED")
     {
          return 0;
     }
     if(Redis_status == "REDIS_ERROR")
     {
          return -1;
     }
     if(!global_db_client)
     { 
        return -2;
     }
     
     mongoc_collection_t *collection = mongoc_client_get_collection(global_db_client,
          "CPP_database",
          "users"
     );
     bson_error_t error;

     string secure_hash = CryptoUtils::hash_password(new_password);

     bson_t *filter = BCON_NEW(
     "email",BCON_UTF8(Redis_status.c_str())
     );

     bson_t *update = BCON_NEW(
          "$set",
          "{",
              "password",
     BCON_UTF8(secure_hash.c_str()),
          "}"
     );

    bool success = mongoc_collection_update_one(collection,filter,update,NULL,NULL,&error);

    if(!success)
    {
       AuditLogger.logPasswordResetFailure(Redis_status,IP,"Database_error");
       bson_destroy(filter);
       bson_destroy(update);
       mongoc_collection_destroy(collection);
       cerr<<error.message<<endl;
       return -3;
    }
    else
    {
       AuditLogger.logPasswordResetSuccess(Redis_status,IP,"Password Reset Success!");
       bson_destroy(filter);
       bson_destroy(update);
       mongoc_collection_destroy(collection);
       cout<<"Password updated successfully!"<<endl;
       return 1;
    }

    bson_destroy(update);
    mongoc_collection_destroy(collection);

    return 2;
}