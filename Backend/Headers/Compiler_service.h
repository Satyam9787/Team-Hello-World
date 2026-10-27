#pragma once 

#include "crow.h"
#include <string.h>

using namespace std;

crow::response One_Compiler(const string& language,const string& code,const string& input);
