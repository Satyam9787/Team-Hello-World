#pragma once

#include <string>
using namespace std;

bool loadEnv(const string& filename);
string getEnvValue(const string& key);