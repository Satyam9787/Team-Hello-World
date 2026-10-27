#pragma once
#include <string>
#include "jwt.h"
#include <optional>

using namespace std;

namespace AuthUtils {

    string create_jwt_token(const string& user_id);
    optional<string> verify_jwt_token(const string& token);
    string build_auth_cookie(const string& token);
    std::string build_logout_cookie();
}

string sha256_hash(const string& input);