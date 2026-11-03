#!/bin/bash

set -euo pipefail

PID="${1:-}"
EXPECTED_UID="${2:-}"
EXPECTED_START="${3:-}"

if [[ ! "$PID" =~ ^[0-9]+$ ]] || [[ "$PID" -le 1 ]]; then
    echo "ERROR: Invalid PID"
    exit 1
fi

if [[ "$EUID" -ne 0 ]]; then
    echo "ERROR: Run with sudo"
    exit 1
fi

if [[ ! -d "/proc/$PID" ]]; then
    echo "ERROR: Process does not exist"
    exit 1
fi

ACTUAL_UID=$(awk '/^Uid:/ {print $2}' "/proc/$PID/status")
ACTUAL_START=$(awk '{print $22}' "/proc/$PID/stat")
PROCESS_NAME=$(cat "/proc/$PID/comm")

if [[ -n "$EXPECTED_UID" && "$ACTUAL_UID" != "$EXPECTED_UID" ]]; then
    echo "ERROR: UID mismatch"
    exit 1
fi

if [[ -n "$EXPECTED_START" && "$ACTUAL_START" != "$EXPECTED_START" ]]; then
    echo "ERROR: Process identity mismatch"
    exit 1
fi

echo "Target: $PROCESS_NAME (PID: $PID)"

kill -TERM "$PID"

for i in {1..5}; do
    if ! kill -0 "$PID" 2>/dev/null; then
        echo "SUCCESS: Process terminated"
        exit 0
    fi
    sleep 1
done

if [[ -d "/proc/$PID" ]]; then
    CURRENT_START=$(awk '{print $22}' "/proc/$PID/stat")

    if [[ "$CURRENT_START" != "$ACTUAL_START" ]]; then
        echo "ERROR: PID was reused; refusing SIGKILL"
        exit 1
    fi

    kill -KILL "$PID"
fi

echo "SUCCESS: Process termination requested"