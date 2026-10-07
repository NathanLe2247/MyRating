#!/usr/bin/env bash
# Start the local backend: Supabase (Postgres/PostGIS/Realtime), edge functions,
# and the Django service (once it has been initialized). Also opens Android
# Studio and boots an Android emulator for the mobile app.
#
# Usage: ./start_backend.sh          # start everything, Ctrl+C to stop foreground services
#        ./start_backend.sh --stop   # stop the local Supabase stack
#
# Env:   ANDROID_AVD=<name>          # emulator to boot (default: first from `emulator -list-avds`)
#        SKIP_ANDROID=1              # don't open Android Studio or the emulator
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/backend"

if [[ "${1:-}" == "--stop" ]]; then
  supabase stop
  exit 0
fi

# --- prerequisites ---
command -v docker >/dev/null || { echo "docker not found (Supabase local dev needs it)"; exit 1; }
if ! docker info >/dev/null 2>&1; then
  echo "Starting Docker Desktop..."
  open -a Docker || { echo "Couldn't open Docker Desktop — is it installed?"; exit 1; }
  for _ in $(seq 1 60); do
    docker info >/dev/null 2>&1 && break
    sleep 2
  done
  docker info >/dev/null 2>&1 || { echo "Docker didn't start within 2 minutes"; exit 1; }
fi
command -v supabase >/dev/null || { echo "supabase CLI not found — install with: brew install supabase/tap/supabase"; exit 1; }

# --- env ---
if [[ ! -f .env.local ]]; then
  echo "Missing backend/.env.local — copy .env.example and fill it in"
  exit 1
fi

# --- android (started early so it boots while Supabase comes up) ---
# The emulator runs in its own process group so Ctrl+C here doesn't kill it.
if [[ -z "${SKIP_ANDROID:-}" ]]; then
  open -a "Android Studio" 2>/dev/null || echo "Android Studio not found — skipping"

  sdk="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
  emulator_bin="$sdk/emulator/emulator"
  if [[ ! -x "$emulator_bin" ]]; then
    echo "Android emulator not found at $emulator_bin — skipping"
  elif "$sdk/platform-tools/adb" devices 2>/dev/null | grep -q '^emulator-'; then
    echo "Android emulator already running"
  else
    avd="${ANDROID_AVD:-$("$emulator_bin" -list-avds | head -n 1)}"
    if [[ -z "$avd" ]]; then
      echo "No Android virtual devices — create one in Android Studio's Device Manager"
    else
      echo "Booting Android emulator ($avd)..."
      perl -e 'setpgrp; exec @ARGV' "$emulator_bin" -avd "$avd" >/dev/null 2>&1 &
    fi
  fi
fi

# --- supabase (creates supabase/config.toml on first run) ---
[[ -f supabase/config.toml ]] || supabase init
supabase status >/dev/null 2>&1 || supabase start

pids=()
trap 'kill "${pids[@]}" 2>/dev/null || true' EXIT INT TERM

# --- edge functions ---
supabase functions serve --env-file .env.local &
pids+=($!)

# --- django (skipped until `django-admin startproject config .` has been run) ---
if [[ -f django/manage.py ]]; then
  (
    cd django
    [[ -d .venv ]] || python3 -m venv .venv
    source .venv/bin/activate
    [[ -f requirements.txt ]] && pip install -q -r requirements.txt
    python manage.py runserver 8000
  ) &
  pids+=($!)
else
  echo "Django not initialized yet — skipping (see django/CLAUDE.md)"
fi

wait
