#!/bin/bash
# Version: 1.0084
# Wrapper - calls the main deploy.sh from project root
# Usage: ./deploy.sh (same arguments as root deploy.sh)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

if [ -f "$ROOT_DIR/deploy.sh" ]; then
    cd "$ROOT_DIR"
    bash deploy.sh "$@"
else
    echo "ERROR: Cannot find deploy.sh in project root: $ROOT_DIR"
    echo "Run from project root instead: ./deploy.sh"
    exit 1
fi
