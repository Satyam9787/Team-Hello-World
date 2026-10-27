#include "env_config.h"
#include <fstream>
#include <unordered_map>

static unordered_map<string,string> envMap;

bool loadEnv(const string& filename)
{
    ifstream file(filename);

    if(!file.is_open())
    {
        return false;
    }

    string line;
     
    while(getline(file,line))
    {
        size_t pos = line.find('=');

        if(pos==string::npos)
        {
            continue;
        }

        string key = line.substr(0,pos);

        string value = line.substr(pos+1);

        envMap[key] = value;
    }
    return true;
}
string getEnvValue(const string& key)
{
    auto it = envMap.find(key);

    if(it != envMap.end())
    {
        return it->second;
    }
    return "";
}