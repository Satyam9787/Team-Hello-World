#include "Redis_batch_worker.h"
#include "Complete_Batch_Queue.h"
#include <atomic>

class DetectionWorker {
public:
    DetectionWorker(
        BatchQueue& queue,
        CompletedBatchQueue& completedQueue
    );

    void run();
    void stop();

private:
    BatchQueue& queue;
    CompletedBatchQueue& completedQueue;
    std::atomic<bool> running{true};

    bool isSuspicious(const StreamEvent& event);
};
