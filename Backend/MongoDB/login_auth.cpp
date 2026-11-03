#include "database.h"
#include "crypto_utils.h"
#include <bson/bson.h>
#include <mongoc/mongoc.h>
#include <string>
#include <iostream>
#include "Redis.h"
#include "JWT_token.h"

using namespace std;

DBStatus verifyCredentialsInDB(const string& email, const string& password,RedisManager& RedisManager)
{
      if(!global_db_client)
      {
           return {
               "DATABASE_ERROR",
               nullopt
           };
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
          return 
          {
              "EMAIL_NOT_FOUND_IN_DB",
              nullopt
          };
     }

     // STEP 3: DB se hashed password nikalo
     string stored_hash = "";
     bson_iter_t iter;

     if(bson_iter_init_find(&iter, doc, "password") && BSON_ITER_HOLDS_UTF8(&iter))
     {
          stored_hash = bson_iter_utf8(&iter, nullptr);
     }

     mongoc_cursor_destroy(cursor);
     mongoc_collection_destroy(collection);

     // STEP 4: Hash empty check
     if(stored_hash.empty())
     {
          return 
          {
               "SERVER SIDE PROBLEM", // Server side problem
               nullopt
          };
     }

     // STEP 5: Libsodium se verify karo
     if(CryptoUtils::verify_password(password, stored_hash))
     {
          string Temp_JWT_token=RedisManager.Temp_JWT_save(email);
          return 
          {
               "SUCCESS",
               Temp_JWT_token // ✅ Success
          };
     }
     else
     {
          return 
          {
               "WRONG_PASSWORD",
               nullopt
          };                 // ❌ Password galat
     }
}