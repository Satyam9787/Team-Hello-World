// #include "otp.h"
#include "env_config.h"
#include <random>
#include <ctime>
#include <curl/curl.h>
#include <sstream>
#include <string>
#include <iostream>
#include "Redis.h"
#include "AuditLogger.h"

using namespace std;

string generateOTP();
VerifyOtpResult sendEmail(const string&  recipient,const string& otp,RedisManager& RedisManager,const string &usecase,AuditLogger &AuditLogger);
VerifyOtpResult verifyOTP(const string& email,const string& enteredOtp,RedisManager& RedisManager,AuditLogger &AuditLogger);

static size_t WriteCallback(
    void* contents,
    size_t size,
    size_t nmemb,
    string* output)
{
    output->append(
        (char*)contents,
        size * nmemb
    );
    return size * nmemb;
}

string generateOTP()
{
    random_device rd;
    mt19937 gen(rd());
    uniform_int_distribution<> dist(100000,999999);

    return to_string(dist(gen));
}

VerifyOtpResult verifyOTP(const string& email,const string& enteredOtp, RedisManager& RedisManager,AuditLogger &AuditLogger,const string &IP)
{
    VerifyOtpResult result = RedisManager.verifyOtp(email,enteredOtp,RedisManager);

    if(result.message == "OTP EXPIRED")
       AuditLogger.logOtpSentFailure(email,IP,"OTP EXPIRED");

    if(result.message == "OTP_VERIFIED")
       AuditLogger.logOtpSentSuccess(email,IP,"OTP_VERIFIED");

    if(result.message == "WRONG_OTP")
       AuditLogger.logOtpSentFailure(email,IP,"WRONG_OTP");

    if(result.message == "Redis Error")
       AuditLogger.logOtpSentFailure(email,IP,"Redis Error");

    return result;
}
VerifyOtpResult sendEmail(const string& recipient,const string& otp, RedisManager& RedisManager, const string &usecase,AuditLogger &AuditLogger,const string &IP)
{
    if(RedisManager.storeOtp(recipient,otp,120,usecase))
    {
        AuditLogger.logOtpSentSuccess(recipient,IP,"Otp stored successfully");
        cout<<"OTP stored in Redis successFully! " << endl;
    }
    else
    {
        AuditLogger.logOtpSentFailure(recipient,IP,"Otp storing failed");
        cout << "OTP store in Redis failed " << endl;
    }

    string API_KEY = getEnvValue("Brevo_REST_API");

    CURL* curl = curl_easy_init();

    if(!curl)
    {
        cout<<"Curl init failed"<<endl;
        return {
               false,
               nullopt,
               nullopt,
               "CURL_INIT_FAILED",
               nullopt
        };
    }

    curl_easy_setopt(
        curl,
        CURLOPT_URL,"https://api.brevo.com/v3/smtp/email"
    );

    struct curl_slist* headers = nullptr;
    headers = curl_slist_append(
        headers,
        "accept: application/json"
    );

    headers = curl_slist_append(
        headers,
        "content-type: application/json"
    );

    string apiHeader = "api-key: " + API_KEY;

    headers = curl_slist_append(
        headers,
        apiHeader.c_str()
    );

    curl_easy_setopt(
        curl,
        CURLOPT_HTTPHEADER,
        headers
    );

    stringstream payload;
    string sender = getEnvValue("Email");

    payload
    <<"{"
    <<"\"sender\":{"
    <<"\"name\":\"Prakhar\","
    <<
    "\"email\":\"" + sender + "\""
    << "},"
    
    << "\"to\":[{"
    << "\"email\":\"" << recipient << "\""
    << "}],"

    <<"\"subject\":\"YOUR OTP CODE\","

    <<"\"htmlContent\":\"<h2>Your OTP is: "
    << otp
    <<"<h2>\""

    <<"}";

    string jsonData = payload.str();

    curl_easy_setopt(
        curl,
        CURLOPT_POSTFIELDS,
        jsonData.c_str()
    );

    curl_easy_setopt(
        curl,
        CURLOPT_POST,
        1L
    );
    string responseBody;

    curl_easy_setopt(
        curl,
        CURLOPT_WRITEFUNCTION,
        WriteCallback
    );
    curl_easy_setopt(
        curl,
        CURLOPT_WRITEDATA,
        &responseBody
    );

    CURLcode res = curl_easy_perform(curl);

    long response_code = 0;

    curl_easy_getinfo(
        curl,
        CURLINFO_RESPONSE_CODE,
        &response_code
    );

    if(res != CURLE_OK)
    {
        AuditLogger.logOtpSentFailure(recipient,IP,"Otp sent failed");
        cerr<<"Request failed! : "<<curl_easy_strerror(res)<<endl;
    }
    else
    {
        AuditLogger.logOtpSentSuccess(recipient,IP,"Otp sent successfully");
        cout<<"Email request sent successfully"<<endl;
    }

    curl_slist_free_all(headers);
    curl_easy_cleanup(curl);

    if(res == CURLE_OK)
    {
        return{
            true,
            usecase,
            nullopt,
            usecase,
            nullopt
        };
    }
    return{
            false,
            nullopt,
            nullopt,
            "UNKNOWN",
            nullopt
        };
}
