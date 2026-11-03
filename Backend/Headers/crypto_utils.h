#pragma once
#include <string>

using namespace std;

namespace CryptoUtils{
         
    //1. Libsodium ko start karne ke liye
    bool init();

    //2. Signup ke waqt password hash karne ke liye
    string hash_password(const string& password);

    //3. Login ke waqt password verify karne ke liye
    bool verify_password(const string& password,const string& hashed_password);
}