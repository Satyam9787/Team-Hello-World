#pragma once

#include "crow.h"
#include "CompletedBatchQueue.h"

void register_Ebpf_Events_Routes(
    crow::SimpleApp& app,
    CompletedBatchQueue& completedBatches,
    CompletedBatchQueue& networkBatches
);