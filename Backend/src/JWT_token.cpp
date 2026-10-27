#include "JWT_token.h"
#include "jwt.h"
#include <chrono>
#include <string>
#include <stdexcept>
#include <iostream>
#include "env_config.h"

using namespace std;

namespace AuthUtils {

    static const string& get_secret_key() {
        static const string SECRET_KEY = [] {
            string key = getEnvValue("JWT_SECRET_KEY");
            if (key.empty() || key.size() < 32) {
                throw runtime_error("JWT_SECRET_KEY missing or too weak (need >= 32 chars)");
            }
            return key;
        }();
        return SECRET_KEY;
    }

    string create_jwt_token(const string& user_id)
    {
        return jwt::create()
            .set_type("JWT")
            .set_issuer("your_app")
            .set_issued_now()
            .set_expires_in(chrono::seconds{3600 * 24})
            .set_payload_claim("user_id", jwt::claim(user_id))
            .sign(jwt::algorithm::hs256{get_secret_key()});
    }

    string build_auth_cookie(const string& token) {
        return "token=" + token + "; HttpOnly; Secure; SameSite=Strict; Max-Age=86400; Path=/";
    }

    string build_logout_cookie() {
        return "token=; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Path=/";
    }
}