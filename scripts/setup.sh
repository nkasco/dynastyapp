#!/usr/bin/env bash
set -euo pipefail

MIN_NODE_MAJOR=20
MIN_NODE_MINOR=9

info() {
  printf '\033[1;34m%s\033[0m\n' "$1"
}

warn() {
  printf '\033[1;33m%s\033[0m\n' "$1"
}

fail() {
  printf '\033[1;31m%s\033[0m\n' "$1" >&2
  exit 1
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

version_at_least() {
  local current_major="$1"
  local current_minor="$2"

  if (( current_major > MIN_NODE_MAJOR )); then
    return 0
  fi

  if (( current_major == MIN_NODE_MAJOR && current_minor >= MIN_NODE_MINOR )); then
    return 0
  fi

  return 1
}

cd "$(dirname "$0")/.."

info "Setting up Dynalytics..."

command_exists node || fail "Node.js is required. Install Node.js ${MIN_NODE_MAJOR}.${MIN_NODE_MINOR}.0 or newer."

node_version="$(node -p "process.versions.node")"
node_major="$(node -p "process.versions.node.split('.')[0]")"
node_minor="$(node -p "process.versions.node.split('.')[1]")"

if ! version_at_least "$node_major" "$node_minor"; then
  fail "Node.js ${node_version} is too old. Install Node.js ${MIN_NODE_MAJOR}.${MIN_NODE_MINOR}.0 or newer."
fi

info "Node.js ${node_version} detected."

command_exists corepack || fail "Corepack is required. It ships with modern Node.js; make sure your Node install includes it."

info "Enabling Corepack..."
corepack enable

if [[ ! -f .env && -f .env.example ]]; then
  info "Creating .env from .env.example..."
  cp .env.example .env
elif [[ -f .env ]]; then
  info ".env already exists; leaving it unchanged."
else
  warn ".env.example is missing, so no .env file was created."
fi

info "Ensuring local data directory exists..."
mkdir -p data

info "Installing dependencies with pnpm..."
corepack pnpm install

info "Setup complete. Start the app with: corepack pnpm dev"
