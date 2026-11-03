#!/bin/bash
set -e

"$(dirname "$0")/build.sh"

echo "Flushing Redis..."
redis-cli FLUSHDB

echo "Starting Backend server..."
cd "$(dirname "$0")/../build"
./my_app