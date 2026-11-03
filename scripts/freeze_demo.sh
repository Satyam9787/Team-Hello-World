#!/bin/bash

set -euo pipefail

DURATION="${1:-10}"

if [[ ! "$DURATION" =~ ^[0-9]+$ ]] || (( DURATION < 1 || DURATION > 60 )); then
    echo "ERROR: Duration must be between 1 and 60 seconds"
    exit 1
fi

clear

echo ""
echo "########################################################"
echo "#                                                      #"
echo "#                PRAHARI SECURITY ALERT                #"
echo "#                                                      #"
echo "#                 SYSTEM FREEZE DEMO                   #"
echo "#                                                      #"
echo "#          SUSPICIOUS ACTIVITY DETECTED                 #"
echo "#                                                      #"
echo "#             SYSTEM RESPONSE INITIATED                #"
echo "#                                                      #"
echo "#          THIS IS ONLY A SIMULATION                    #"
echo "#                                                      #"
echo "########################################################"

echo ""
echo "Device is entering demonstration mode..."
echo "Duration: $DURATION seconds"

sleep "$DURATION"

echo ""
echo "PRAHARI: Demonstration completed."
echo "System is operating normally."

exit 0