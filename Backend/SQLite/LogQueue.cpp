#include "crow.h"
#include "AuditLogs.h"
#include <queue>
#include "LogQueue.h"
#include "database.h"
#include <chrono>

using namespace std;

LogQueue::LogQueue(Table& table) : auditTable(table)
{;}

LogQueue::~LogQueue()
{
    stop();
}

void LogQueue::push(const AuditLog& log)
{
    {
        std::lock_guard<std::mutex> lock(mutex);

        queue.push(log);
    }

    cv.notify_one();
}

AuditLog LogQueue::pop()
{
    std::unique_lock<std::mutex> lock(mutex);

    cv.wait(lock, [this] {
        return !queue.empty() || !running;
    });

    if (!running && queue.empty())
        return AuditLog{};

    AuditLog log = std::move(queue.front());
    queue.pop();

    return log;
}

void LogQueue::processLogs(Table& auditTable)
{
    while (running)
    {
        AuditLog log = pop();

        if (!running && log.id == 0)
            break;

        if (saveLogInDB(log))
        {
            std::this_thread::sleep_for(std::chrono::seconds(2));
        }

    // MongoDB successful

        if (!running)
            break;

        while (running)
        {
            if (auditTable.markAsSynced(log.id))
            {
               break;
            }
            std::this_thread::sleep_for(std::chrono::seconds(1));
        }
    }
}

void Table::cleanupWorker()
{
    while (cleanupRunning)
    {
        if (!deleteSyncedLogs())
        {
            std::this_thread::sleep_for(
                std::chrono::seconds(1)
            );

            continue;
        }

        std::this_thread::sleep_for(
            std::chrono::seconds(5)
        );
    }
}

void Table::cleanupStop()
{
    cleanupRunning = false;
}

void LogQueue::stop()
{
    if (!running)
        return;

    running = false;

    cv.notify_all();
}