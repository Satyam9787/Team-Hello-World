#include "routes.h"
#include "crow.h"
#include "Paths.h"

using namespace std;

void register_404_Not_Found_Routes(crow::SimpleApp& app)
{
     //Home Route
     CROW_ROUTE(app,"/404_Not_Found")([]()
     {
         ifstream file(Paths::HTML + "404_Not_Found.html");

         if(!file.is_open()) return crow::response(404);

         stringstream buffer;
         buffer << file.rdbuf();
         
         return crow::response(buffer.str());
     });

     CROW_ROUTE(app, "/404_Not_Found.css")([]()
     {
           ifstream file(Paths::CSS + "404_Not_Found.css");

           stringstream buffer;
           buffer << file.rdbuf();

           crow::response res(buffer.str());
           res.set_header("Content-Type", "text/css");

           return res;
     });
}