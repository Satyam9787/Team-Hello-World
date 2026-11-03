#include "crypto_utils.h"
#include <sodium.h>
#include <stdexcept>

namespace CryptoUtils{

    bool init()
    {
         //Libsodium ko initialize karega, poorey project mein sirf 1 baar chalna chahiye
         return sodium_init() >= 0;
    } 

    string hash_password(const string& password)
    {
        char hashed_password[crypto_pwhash_STRBYTES];

        //Yeh background mein Argon2id use karta hai automatically
        int result = crypto_pwhash_str(
            hashed_password,
            password.c_str(),
            password.length(),
            crypto_pwhash_OPSLIMIT_INTERACTIVE,  //Balanced CPU usage
            crypto_pwhash_MEMLIMIT_INTERACTIVE   //Balanced RAM usage
        );

        if(result != 0)
        {
            throw runtime_error("Password hashing failed (OOM or internal error)");
        }

        return string(hashed_password);
    }

    bool verify_password(const string& password, const string& hashed_password)
    {
        //Yeh function hashed_password ke andar se khud hi salt aur parameters nikal kar match karta hai.
        return crypto_pwhash_str_verify(
            hashed_password.c_str(),
            password.c_str(),
            password.length()
        ) == 0; //Agar 0 return hua toh password sahi hai
    }
}