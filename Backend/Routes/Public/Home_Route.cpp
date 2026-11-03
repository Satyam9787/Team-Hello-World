#include "routes.h"
#include "crow.h"
#include "Paths.h"

using namespace std;

void register_Home_Routes(crow::SimpleApp& app)
{
     //Home Route
     CROW_ROUTE(app,"/")([]()
     {
         ifstream file(Paths::HTML + "index.html");

         if(!file.is_open()) return crow::response(404);

         stringstream buffer;
         buffer << file.rdbuf();
         
         return crow::response(buffer.str());
     });

     CROW_ROUTE(app, "/index.css")([]()
     {
           ifstream file(Paths::CSS + "index.css");

           stringstream buffer;
           buffer << file.rdbuf();

           crow::response res(buffer.str());
           res.set_header("Content-Type", "text/css");

           return res;
     });

     CROW_ROUTE(app, "/index.js")([]()
     {
           ifstream file(Paths::JS+ "index.js");

           stringstream buffer;
           buffer << file.rdbuf();

           crow::response res(buffer.str());
           res.set_header("Content-Type", "text/js");

           return res;
     });
}
