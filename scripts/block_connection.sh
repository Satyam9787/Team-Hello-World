#!/bin/bash

set -euo pipefail

IP="${1:-}"
PORT="${2:-}"

if [[ "$EUID" -ne 0 ]]; then
    echo "ERROR: Run with sudo"
    exit 1
fi

if [[ ! "$IP" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]]; then
    echo "ERROR: Invalid IPv4 address"
    exit 1
fi

if ! python3 -c 'import ipaddress,sys; ipaddress.IPv4Address(sys.argv[1])' "$IP" 2>/dev/null; then
    echo "ERROR: Invalid IPv4 address"
    exit 1
fi

if [[ ! "$PORT" =~ ^[0-9]+$ ]] || (( PORT < 1 || PORT > 65535 )); then
    echo "ERROR: Invalid port"
    exit 1
fi

if ! command -v iptables >/dev/null 2>&1; then
    echo "ERROR: iptables not installed"
    exit 1
fi

CHAIN="PRAHARI_BLOCK"

iptables -N "$CHAIN" 2>/dev/null || true

iptables -C OUTPUT -j "$CHAIN" 2>/dev/null ||
    iptables -I OUTPUT 1 -j "$CHAIN"

if iptables -C "$CHAIN" -d "$IP" -p tcp --dport "$PORT" -j REJECT 2>/dev/null; then
    echo "Connection already blocked"
    exit 0
fi

iptables -A "$CHAIN" -d "$IP" -p tcp --dport "$PORT" -j REJECT

echo "SUCCESS: Blocked $IP:$PORT"