#!/bin/bash
# =============================================================================
# Agent SDR - macOS Setup Script
# =============================================================================
# A guided installer for non-technical users.
# Run with: bash <(curl -fsSL https://raw.githubusercontent.com/charlie-webber-ciam/agent-sdr/main/scripts/setup.sh)
# =============================================================================
set -eo pipefail

# ---------------------------------------------------------------------------
# Colors and formatting
# ---------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

success() { echo -e "${GREEN}✔${NC} $1"; }
fail()    { echo -e "${RED}✘${NC} $1"; }
info()    { echo -e "${BLUE}→${NC} $1"; }
warn()    { echo -e "${YELLOW}⚠${NC} $1"; }
header()  { echo -e "\n${BOLD}$1${NC}"; }

# ---------------------------------------------------------------------------
# Cleanup on exit
# ---------------------------------------------------------------------------
cleanup() {
  # The dev server is left running intentionally so the user can use the app.
  :
}
trap cleanup EXIT

# ---------------------------------------------------------------------------
# Migration state (set by detect_existing_install, used by restore_migrated_data)
# ---------------------------------------------------------------------------
MIGRATED_DB_PATH=""
MIGRATED_API_KEY=""
MIGRATED_OLD_DIR=""

# ---------------------------------------------------------------------------
# Safe .env.local writer
# Avoids heredoc variable expansion corrupting keys that contain $, `, or \
# ---------------------------------------------------------------------------
write_env_file() {
  local path="$1"
  local api_key="$2"
  local base_url="$3"
  (
    umask 077
    {
      printf '# Agent SDR - OpenAI Configuration\n'
      printf 'OPENAI_API_KEY=%s\n' "$api_key"
      printf 'OPENAI_BASE_URL=%s\n' "$base_url"
      printf '# Optional parallel processing (uncomment to enable)\n'
      printf '# ENABLE_PARALLEL_PROCESSING=true\n'
      printf '# PROCESSING_CONCURRENCY=5\n'
    } > "$path"
  )
}

# ---------------------------------------------------------------------------
# Pre-flight checks
# ---------------------------------------------------------------------------
preflight_checks() {
  header "Running pre-flight checks..."

  # macOS only
  if [[ "$(uname)" != "Darwin" ]]; then
    fail "This script only supports macOS. Detected: $(uname)"
    exit 1
  fi
  success "Running on macOS"

  # Internet connectivity
  if ! curl -s --connect-timeout 5 https://github.com > /dev/null 2>&1; then
    fail "No internet connection detected."
    echo "  Please check your Wi-Fi or Ethernet and try again."
    exit 1
  fi
  success "Internet connection OK"

  # Disk space (need at least 2 GB free)
  local free_space_mb
  free_space_mb=$(df -m "$HOME" | awk 'NR==2 {print $4}')
  if [[ "$free_space_mb" -lt 2048 ]]; then
    fail "Less than 2 GB of free disk space available (${free_space_mb} MB)."
    echo "  Please free up some space and try again."
    exit 1
  fi
  success "Disk space OK (${free_space_mb} MB free)"
}

# ---------------------------------------------------------------------------
# Detect existing installation in a non-standard location
# ---------------------------------------------------------------------------
detect_existing_install() {
  header "Checking for existing installation..."

  local canonical="$HOME/agent-sdr"
  local found_dirs=()

  # Search for agent-sdr directories in common locations (shallow search).
  while IFS= read -r dir; do
    [[ "$dir" == "$canonical" ]] && continue
    if [[ -f "$dir/data/accounts.db" ]]; then
      found_dirs+=("$dir")
    fi
  done < <(find "$HOME/Desktop" "$HOME/Documents" "$HOME/Downloads" \
    -maxdepth 3 -type d -name "*agent*sdr*" -not -name "*.backup.*" 2>/dev/null | sort -u)

  while IFS= read -r dir; do
    [[ "$dir" == "$canonical" ]] && continue
    if [[ -f "$dir/data/accounts.db" ]]; then
      found_dirs+=("$dir")
    fi
  done < <(find "$HOME" -maxdepth 1 -type d -name "*agent*sdr*" -not -name "*.backup.*" 2>/dev/null)

  if [[ ${#found_dirs[@]} -eq 0 ]]; then
    success "No previous installation found"
    return
  fi

  local old_install="${found_dirs[0]}"
  local old_db="$old_install/data/accounts.db"
  local old_env="$old_install/.env.local"

  if [[ ! -f "$old_db" ]]; then
    success "No research data to migrate"
    return
  fi

  local db_size
  db_size=$(du -h "$old_db" | cut -f1)

  echo ""
  info "Found a previous installation at:"
  echo "    $old_install"
  info "Research database found ($db_size)"
  echo ""
  read -rp "  Migrate your existing research data to the new location? (Y/n): " migrate_choice
  if [[ "$migrate_choice" == "n" || "$migrate_choice" == "N" ]]; then
    info "Skipping migration. Starting fresh."
    return
  fi

  MIGRATED_DB_PATH="$old_db"
  MIGRATED_OLD_DIR="$old_install"

  if [[ -f "$old_env" ]]; then
    MIGRATED_API_KEY=$(grep -E '^OPENAI_API_KEY=' "$old_env" 2>/dev/null | cut -d'=' -f2-)
    if [[ -n "$MIGRATED_API_KEY" ]]; then
      info "API key found in previous configuration"
    fi
  fi

  success "Data will be migrated after setup completes"
}

# ---------------------------------------------------------------------------
# Restore migrated data into the new install
# ---------------------------------------------------------------------------
restore_migrated_data() {
  if [[ -z "$MIGRATED_DB_PATH" && -z "$MIGRATED_API_KEY" ]]; then
    return
  fi

  header "Migrating data from previous installation..."

  local install_dir="$HOME/agent-sdr"

  if [[ -n "$MIGRATED_API_KEY" && ! -f "$install_dir/.env.local" ]]; then
    write_env_file "$install_dir/.env.local" "$MIGRATED_API_KEY" "https://llm.atko.ai"
    success "API key migrated (base URL set to https://llm.atko.ai)"
  fi

  if [[ -n "$MIGRATED_DB_PATH" && -f "$MIGRATED_DB_PATH" ]]; then
    if [[ -f "$install_dir/data/accounts.db" ]]; then
      info "Research database already exists at $install_dir — skipping migration"
    else
      mkdir -p "$install_dir/data"
      cp "$MIGRATED_DB_PATH" "$install_dir/data/accounts.db"
      local db_size
      db_size=$(du -h "$install_dir/data/accounts.db" | cut -f1)
      success "Research database migrated ($db_size)"
    fi

    local old_preprocessed
    old_preprocessed="$(dirname "$MIGRATED_DB_PATH")/preprocessed"
    if [[ -d "$old_preprocessed" && ! -d "$install_dir/data/preprocessed" ]]; then
      cp -R "$old_preprocessed" "$install_dir/data/preprocessed"
      success "Preprocessed CSV files migrated"
    fi
  fi
}

# ---------------------------------------------------------------------------
# Step 1: Xcode Command Line Tools
# ---------------------------------------------------------------------------
install_xcode_tools() {
  header "Step 1/7: Xcode Command Line Tools"

  if xcode-select -p > /dev/null 2>&1; then
    success "Xcode Command Line Tools already installed"
    return
  fi

  info "Installing Xcode Command Line Tools..."
  echo "  A system dialog will appear asking you to install. Click \"Install\" and wait."
  echo ""
  xcode-select --install 2>/dev/null || true
  echo ""
  info "Waiting for installation to complete..."
  echo "  (This can take several minutes. Do NOT close the installer dialog.)"
  echo ""

  until xcode-select -p > /dev/null 2>&1; do
    sleep 5
  done

  success "Xcode Command Line Tools installed"
}

# ---------------------------------------------------------------------------
# Step 2: nvm (Node Version Manager)
# ---------------------------------------------------------------------------
install_nvm() {
  header "Step 2/7: Node Version Manager (nvm)"

  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"

  # Source nvm if the script exists — this is the reliable check for an
  # existing install, since nvm is a shell function rather than a binary.
  if [[ -s "$NVM_DIR/nvm.sh" ]]; then
    # shellcheck source=/dev/null
    source "$NVM_DIR/nvm.sh"
    success "nvm already installed"
    return
  fi

  info "Installing nvm..."
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash

  export NVM_DIR="$HOME/.nvm"
  if [[ -s "$NVM_DIR/nvm.sh" ]]; then
    # shellcheck source=/dev/null
    source "$NVM_DIR/nvm.sh"
  fi

  if ! command -v nvm > /dev/null 2>&1; then
    fail "nvm installation failed."
    echo "  Try installing it manually: https://github.com/nvm-sh/nvm#installing-and-updating"
    exit 1
  fi

  success "nvm installed"
}

# ---------------------------------------------------------------------------
# Step 3: Node.js 24
# ---------------------------------------------------------------------------
install_node() {
  header "Step 3/7: Node.js 24"

  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [[ -s "$NVM_DIR/nvm.sh" ]]; then
    # shellcheck source=/dev/null
    source "$NVM_DIR/nvm.sh"
  fi

  local current_node
  current_node=$(nvm current 2>/dev/null || echo "none")

  if [[ "$current_node" == v24.* ]]; then
    success "Node.js 24 already active ($current_node)"
    return
  fi

  if nvm ls 24 > /dev/null 2>&1; then
    info "Switching to Node.js 24..."
    nvm use 24
  else
    info "Installing Node.js 24 (this may take a minute)..."
    nvm install 24
    nvm use 24
  fi

  nvm alias default 24 > /dev/null 2>&1 || true

  local version
  version=$(node --version 2>/dev/null || echo "unknown")
  if [[ "$version" == v24.* ]]; then
    success "Node.js $version installed and active"
  else
    fail "Node.js 24 installation failed. Got: $version"
    exit 1
  fi
}

# ---------------------------------------------------------------------------
# Step 4: Clone or update the repository
# ---------------------------------------------------------------------------
clone_repo() {
  header "Step 4/7: Agent SDR Repository"

  local repo_url="https://github.com/charlie-webber-ciam/agent-sdr.git"
  local install_dir="$HOME/agent-sdr"

  if [[ -d "$install_dir/.git" ]]; then
    info "Repository already exists. Pulling latest changes..."
    if git -C "$install_dir" pull --ff-only; then
      success "Repository updated"
    else
      warn "Could not fast-forward. Continuing with existing code."
    fi
    return
  fi

  # Declare both locals at function scope so the error-handler block below
  # can safely reference them regardless of which branch was taken.
  local tmp_preserve=""
  local backup_path=""

  if [[ -d "$install_dir" ]]; then
    warn "$install_dir exists but is not a git repo."
    echo "  Moving it to ${install_dir}.backup and cloning fresh."

    if [[ -d "$install_dir/data" || -f "$install_dir/.env.local" ]]; then
      tmp_preserve=$(mktemp -d)
      if [[ -d "$install_dir/data" ]]; then
        cp -R "$install_dir/data" "$tmp_preserve/data"
        info "Preserving existing data directory"
      fi
      if [[ -f "$install_dir/.env.local" ]]; then
        cp "$install_dir/.env.local" "$tmp_preserve/.env.local"
        info "Preserving existing configuration"
      fi
    fi

    backup_path="${install_dir}.backup.$(date +%s)"
    mv "$install_dir" "$backup_path"
  fi

  info "Cloning repository to $install_dir..."
  if git clone "$repo_url" "$install_dir"; then
    success "Repository cloned to $install_dir"
  else
    fail "Failed to clone repository."
    if [[ -n "$backup_path" && -d "$backup_path" ]]; then
      mv "$backup_path" "$install_dir"
      warn "Restored previous directory from backup."
    fi
    if [[ -n "$tmp_preserve" ]]; then
      rm -rf "$tmp_preserve"
    fi
    echo "  Check your internet connection and try again."
    exit 1
  fi

  if [[ -n "$tmp_preserve" ]]; then
    if [[ -d "$tmp_preserve/data" ]]; then
      cp -R "$tmp_preserve/data" "$install_dir/data"
      success "Existing data directory restored"
    fi
    if [[ -f "$tmp_preserve/.env.local" ]]; then
      cp "$tmp_preserve/.env.local" "$install_dir/.env.local"
      success "Existing configuration restored"
    fi
    rm -rf "$tmp_preserve"
  fi
}

# ---------------------------------------------------------------------------
# Step 5: Environment variables (.env.local)
# ---------------------------------------------------------------------------
configure_env() {
  header "Step 5/7: OpenAI Configuration"

  local env_file="$HOME/agent-sdr/.env.local"

  if [[ -f "$env_file" ]]; then
    success "Configuration file already exists (.env.local)"
    info "Keeping your existing credentials. Delete $env_file and re-run to reconfigure."
    return
  fi

  echo ""
  echo "  The Agent SDR uses an API key to research accounts."
  echo ""
  echo "  If you don't have your API key yet, ask your team lead."
  echo ""

  local api_key=""
  while [[ -z "$api_key" ]]; do
    read -rsp "  Enter your API key: " api_key
    echo ""
    if [[ -z "$api_key" ]]; then
      warn "API key cannot be empty. Please try again."
    fi
  done

  write_env_file "$env_file" "$api_key" "https://llm.atko.ai"
  success "Configuration saved to .env.local"
}

# ---------------------------------------------------------------------------
# Step 6: npm install
# ---------------------------------------------------------------------------
run_npm_install() {
  header "Step 6/7: Installing Dependencies"

  local install_dir="$HOME/agent-sdr"

  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [[ -s "$NVM_DIR/nvm.sh" ]]; then
    # shellcheck source=/dev/null
    source "$NVM_DIR/nvm.sh"
  fi
  nvm use 24 > /dev/null 2>&1 || true

  info "Running npm install (this may take a couple of minutes)..."
  echo "  (The better-sqlite3 package needs to compile native code -- this is normal.)"
  echo ""

  if (cd "$install_dir" && npm install 2>&1); then
    echo ""
    success "All dependencies installed"
  else
    echo ""
    fail "npm install failed."
    echo ""
    echo "  Common fixes:"
    echo "  1. Make sure Xcode Command Line Tools are installed: xcode-select --install"
    echo "  2. Try deleting node_modules and running again:"
    echo "     rm -rf ~/agent-sdr/node_modules && cd ~/agent-sdr && npm install"
    echo "  3. If you see Python errors, make sure Python 3 is installed"
    exit 1
  fi
}

# ---------------------------------------------------------------------------
# Kill any process bound to port 3000, safely.
# ---------------------------------------------------------------------------
kill_port_3000() {
  local pids
  pids=$(lsof -ti :3000 2>/dev/null || true)
  if [[ -n "$pids" ]]; then
    echo "$pids" | xargs kill 2>/dev/null || true
    sleep 1
  fi
}

# ---------------------------------------------------------------------------
# Step 7: Create Desktop launcher and start the app
# ---------------------------------------------------------------------------
create_launcher_and_start() {
  header "Step 7/7: Desktop Launcher & First Launch"

  local launcher="$HOME/Desktop/Agent SDR.command"

  # The launcher is written with a quoted heredoc delimiter ('LAUNCHER') so
  # that no variable expansion occurs here — the script is stored verbatim.
  # Inside the launcher, .env.local is rewritten via printf (not a heredoc)
  # for the same reason: to survive API keys that contain $, `, or \.
  cat > "$launcher" <<'LAUNCHER'
#!/bin/bash
# ================================================
# Agent SDR - Double-click to start
# ================================================
cd ~/agent-sdr || { echo "Error: ~/agent-sdr not found."; read -rp "Press Enter to close."; exit 1; }

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [[ -s "$NVM_DIR/nvm.sh" ]]; then
  source "$NVM_DIR/nvm.sh"
fi
nvm use 24 2>/dev/null || true

# --- Pull latest changes from git ---
echo ""
echo "  Checking for updates..."
if git -C ~/agent-sdr remote get-url origin > /dev/null 2>&1; then
  # Stash any local uncommitted changes so the pull can never be blocked.
  STASH_OUTPUT=$(git -C ~/agent-sdr stash 2>&1)
  PULL_OUTPUT=$(git -C ~/agent-sdr pull --ff-only 2>&1)
  PULL_EXIT=$?

  if [[ $PULL_EXIT -eq 0 ]]; then
    if echo "$PULL_OUTPUT" | grep -q "Already up to date"; then
      echo "  ✔ Already up to date"
    else
      echo "  ✔ Updates pulled — running npm install to sync dependencies..."
      (cd ~/agent-sdr && npm install 2>&1)
      echo "  ✔ Dependencies synced"
    fi
  else
    echo "  ⚠ Could not pull updates (no internet, or diverged history). Continuing with existing code."
    echo "    $PULL_OUTPUT"
  fi

  # Restore any stashed changes — only if something was actually stashed.
  if echo "$STASH_OUTPUT" | grep -q "Saved working directory"; then
    git -C ~/agent-sdr stash pop 2>/dev/null || true
  fi
else
  echo "  ⚠ ~/agent-sdr is not a git repository — skipping update check."
fi

# --- API Key Update Prompt ---
ENV_FILE=~/agent-sdr/.env.local
echo ""

if [[ -f "$ENV_FILE" ]]; then
  CURRENT_KEY=$(grep -E '^OPENAI_API_KEY=' "$ENV_FILE" 2>/dev/null | cut -d'=' -f2-)
  if [[ -n "$CURRENT_KEY" ]]; then
    MASKED_KEY="${CURRENT_KEY:0:8}************************"
    echo "  Current API key: $MASKED_KEY"
  fi
fi

read -rp "  Would you like to update your API key? (y/N): " update_key
if [[ "$update_key" == "y" || "$update_key" == "Y" ]]; then
  NEW_KEY=""
  while [[ -z "$NEW_KEY" ]]; do
    read -rsp "  Enter your new API key: " NEW_KEY
    echo ""
    if [[ -z "$NEW_KEY" ]]; then
      echo "  ⚠ API key cannot be empty. Please try again."
    fi
  done

  BASE_URL=$(grep -E '^OPENAI_BASE_URL=' "$ENV_FILE" 2>/dev/null | cut -d'=' -f2-)
  BASE_URL="${BASE_URL:-https://llm.atko.ai}"

  # Write .env.local via printf so that special characters in the key
  # ($, `, \) are stored literally and never interpreted by the shell.
  (
    umask 077
    {
      printf '# Agent SDR - OpenAI Configuration\n'
      printf 'OPENAI_API_KEY=%s\n' "$NEW_KEY"
      printf 'OPENAI_BASE_URL=%s\n' "$BASE_URL"
      printf '# Optional parallel processing (uncomment to enable)\n'
      printf '# ENABLE_PARALLEL_PROCESSING=true\n'
      printf '# PROCESSING_CONCURRENCY=5\n'
    } > "$ENV_FILE"
  )
  echo "  ✔ API key updated successfully"
else
  echo "  → Keeping existing API key"
fi

echo ""

# Kill any existing process on port 3000, safely.
EXISTING_PIDS=$(lsof -ti :3000 2>/dev/null || true)
if [[ -n "$EXISTING_PIDS" ]]; then
  echo "  Stopping existing process on port 3000..."
  echo "$EXISTING_PIDS" | xargs kill 2>/dev/null || true
  sleep 1
fi

echo ""
echo "  Starting Agent SDR..."
echo "  The app will open in your browser at http://localhost:3000"
echo "  Keep this window open while using the app. Close it to stop."
echo ""

npm run dev &
DEV_PID=$!
sleep 4
open http://localhost:3000

# Wait for the dev server; closing this Terminal window stops it.
wait $DEV_PID
LAUNCHER

  chmod +x "$launcher"
  success "Desktop launcher created: Agent SDR.command"

  # Kill any existing process on port 3000 before starting a fresh one.
  if lsof -ti :3000 > /dev/null 2>&1; then
    info "Stopping existing process on port 3000..."
    kill_port_3000
  fi

  # Start the dev server.
  info "Starting Agent SDR for the first time..."

  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [[ -s "$NVM_DIR/nvm.sh" ]]; then
    # shellcheck source=/dev/null
    source "$NVM_DIR/nvm.sh"
  fi
  nvm use 24 > /dev/null 2>&1 || true

  (cd "$HOME/agent-sdr" && npm run dev > /dev/null 2>&1) &
  local dev_pid=$!

  info "Waiting for the dev server to start..."
  local attempts=0
  while ! curl -s --connect-timeout 2 http://localhost:3000 > /dev/null 2>&1; do
    # If the process has already exited, there is no point continuing to poll.
    if ! kill -0 "$dev_pid" 2>/dev/null; then
      fail "Dev server process exited unexpectedly."
      echo "  Try running manually: cd ~/agent-sdr && npm run dev"
      return 1
    fi

    sleep 2
    attempts=$((attempts + 1))
    if [[ $attempts -ge 15 ]]; then
      warn "Dev server is taking longer than expected."
      echo "  You can try double-clicking \"Agent SDR\" on your Desktop to start it manually."
      return
    fi
  done

  open http://localhost:3000
  echo ""
  success "Agent SDR is running at http://localhost:3000"
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
  echo ""
  echo -e "${BOLD}============================================${NC}"
  echo -e "${BOLD}      Agent SDR - macOS Setup              ${NC}"
  echo -e "${BOLD}============================================${NC}"
  echo ""
  echo "  This script will set up the Agent SDR research tool on your Mac."
  echo "  It will install a few developer tools if you don't have them already"
  echo "  and then download and start the application."
  echo ""
  echo "  What gets installed (only if not already present):"
  echo "    1. Xcode Command Line Tools (Apple developer tools)"
  echo "    2. nvm (Node.js version manager)"
  echo "    3. Node.js 24 (JavaScript runtime)"
  echo ""
  echo "  The app will be installed at: ~/agent-sdr"
  echo "  A launcher shortcut will be placed on your Desktop."
  echo ""
  read -rp "  Press Enter to begin (or Ctrl+C to cancel)... "

  preflight_checks
  detect_existing_install
  install_xcode_tools
  install_nvm
  install_node
  clone_repo
  restore_migrated_data
  configure_env
  run_npm_install
  create_launcher_and_start

  echo ""
  echo -e "${BOLD}============================================${NC}"
  echo -e "${GREEN}${BOLD}  Setup complete!${NC}"
  echo -e "${BOLD}============================================${NC}"
  echo ""
  echo "  Your app is running at: http://localhost:3000"
  echo ""
  echo "  To start the app in the future:"
  echo "    - Double-click \"Agent SDR\" on your Desktop"
  echo ""
  echo "  To stop the app:"
  echo "    - Close the Terminal window running it"
  echo ""
  if [[ -n "$MIGRATED_OLD_DIR" ]]; then
    echo "  Your data was migrated from:"
    echo "    $MIGRATED_OLD_DIR"
    echo ""
    echo "  Once you've confirmed everything works, you can remove the old install:"
    echo "    rm -rf \"$MIGRATED_OLD_DIR\""
    echo ""
  fi
  echo "  If you have any issues, reach out to your team lead."
  echo ""
}

main "$@"