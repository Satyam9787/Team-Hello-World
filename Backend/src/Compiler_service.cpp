#include "Compiler_service.h"
#include <curl/curl.h>
#include <string>
#include <cstdlib>
#include "env_config.h"
#include <bits/stdc++.h>

using namespace std;

static size_t WriteCallback(void* contents,size_t size,size_t nmemb,void* userp)
        {
           size_t totalSize = size * nmemb;

           string* response = static_cast<std::string*>(userp);

           response->append(static_cast<char*>(contents),totalSize);

           return totalSize;
        }

crow::response One_Compiler(const string& language,const string& code,const string& input)
{
        // ====================================================
        // Get OneCompiler API key
        // ====================================================

        //const char*
        string apiKeyEnv = getEnvValue("OneCompiler_API_KEY");

        string apiKey = apiKeyEnv;


        // ====================================================
        // Determine filename
        // ====================================================

        string fileName = "main.txt";

        if (language == "cpp")
        {
            fileName = "main.cpp";
        }
        else if (language == "c")
        {
            fileName = "main.c";
        }
        else if (language == "python")
        {
            fileName = "main.py";
        }
        else if (language == "javascript")
        {
            fileName = "main.js";
        }
        else if (language == "java")
        {
            fileName = "Main.java";
        }
        else if (language == "csharp")
        {
            fileName = "Program.cs";
        }
        else if (language == "go")
        {
            fileName = "main.go";
        }
        else if (language == "rust")
        {
            fileName = "main.rs";
        }
        else if (language == "kotlin")
        {
            fileName = "Main.kt";
        }
        else if (language == "php")
        {
            fileName = "main.php";
        }
        else if (language == "ruby")
        {
            fileName = "main.rb";
        }
        else if (language == "swift")
        {
            fileName = "main.swift";
        }

        // ====================================================
        // Create OneCompiler JSON request
        // ====================================================

        crow::json::wvalue oneCompilerRequest;

        oneCompilerRequest["language"] =
            language;

        oneCompilerRequest["stdin"] =
            input;


        // ====================================================
        // files array
        // ====================================================

        crow::json::wvalue file;

        file["name"] =
            fileName;

        file["content"] =
            code;


        oneCompilerRequest["files"] = crow::json::wvalue::list({ std::move(file) });


        // ====================================================
        // Serialize JSON
        // ====================================================

        std::string requestBody =
            oneCompilerRequest.dump();


        // ====================================================
        // Initialize CURL
        // ====================================================

        CURL* curl =
            curl_easy_init();

        if (!curl)
        {
            return crow::response(
                500,
                R"({"error":"Failed to initialize CURL"})"
            );
        }


        // ====================================================
        // Store API response
        // ====================================================

        std::string apiResponse;


        // ====================================================
        // Headers
        // ====================================================

        struct curl_slist* headers =
            nullptr;

        headers =
            curl_slist_append(
                headers,
                "Content-Type: application/json"
            );


        std::string apiKeyHeader =
            "X-API-Key: " + apiKey;

        headers =
            curl_slist_append(
                headers,
                apiKeyHeader.c_str()
            );

        // ====================================================
        // CURL configuration
        // ====================================================

        curl_easy_setopt(
            curl,
            CURLOPT_URL,
            "https://api.onecompiler.com/v1/run"
        );


        curl_easy_setopt(
            curl,
            CURLOPT_HTTPHEADER,
            headers
        );


        curl_easy_setopt(
            curl,
            CURLOPT_POST,
            1L
        );


        curl_easy_setopt(
            curl,
            CURLOPT_POSTFIELDS,
            requestBody.c_str()
        );


        curl_easy_setopt(
            curl,
            CURLOPT_POSTFIELDSIZE,
            requestBody.size()
        );


        curl_easy_setopt(
            curl,
            CURLOPT_WRITEFUNCTION,
            WriteCallback
        );


        curl_easy_setopt(
            curl,
            CURLOPT_WRITEDATA,
            &apiResponse
        );


        // ====================================================
        // Timeout
        // ====================================================

        curl_easy_setopt(
            curl,
            CURLOPT_TIMEOUT,
            30L
        );


        // ====================================================
        // Perform API request
        // ====================================================

        CURLcode result =
            curl_easy_perform(curl);


        // ====================================================
        // CURL error
        // ====================================================

        if (result != CURLE_OK)
        {
            std::string error =
                curl_easy_strerror(result);

            curl_slist_free_all(headers);

            curl_easy_cleanup(curl);

            crow::json::wvalue response;

            response["error"] =
                "OneCompiler request failed";

            response["details"] =
                error;

            return crow::response(
                502,
                response
            );
        }


        // ====================================================
        // Get HTTP status code
        // ====================================================

        long httpStatus = 0;

        curl_easy_getinfo(
            curl,
            CURLINFO_RESPONSE_CODE,
            &httpStatus
        );


        // ====================================================
        // Cleanup CURL
        // ====================================================

        curl_slist_free_all(headers);

        curl_easy_cleanup(curl);


        // ====================================================
        // Parse OneCompiler response
        // ====================================================

        auto compilerResponse =
    crow::json::load(apiResponse);

if (!compilerResponse)
{
    crow::response response(
        502,
        R"({"error":"Invalid response from OneCompiler"})"
    );

    response.set_header(
        "Content-Type",
        "application/json"
    );

    return response;
}


// ====================================================
// API failure
// ====================================================

if (httpStatus < 200 ||
    httpStatus >= 300)
{
    crow::response response(
        static_cast<int>(httpStatus),
        apiResponse
    );

    response.set_header(
        "Content-Type",
        "application/json"
    );

    return response;
}


// ====================================================
// Return OneCompiler response
// ====================================================

crow::response response(
    apiResponse
);

response.set_header(
    "Content-Type",
    "application/json"
);

return response;
}