#!/usr/bin/env bash
set -euo pipefail

Color_Off=''
Red=''
Green=''
Yellow=''
Dim=''

Bold_White=''
Bold_Green=''
Bold_Yellow=''

if [[ -t 1 ]]; then
    Color_Off='\033[0m'
    Red='\033[0;31m'
    Green='\033[0;32m'
    Yellow='\033[0;33m'
    Dim='\033[0;2m'
    Bold_White='\033[1m'
    Bold_Green='\033[1;32m'
    Bold_Yellow='\033[1;33m'
fi

error() {
    echo -e "${Red}error${Color_Off}:" "$@" >&2
    exit 1
}

info() {
    echo -e "${Dim}$@${Color_Off}"
}

info_bold() {
    echo -e "${Bold_White}$@${Color_Off}"
}

success() {
    echo -e "${Green}$@${Color_Off}"
}

warn() {
    echo -e "${Yellow}$@${Color_Off}" >&2
}

command -v curl >/dev/null || error 'curl is required to install paideia'

REPO="paideia-lms/paideia"
BINARY_NAME="paideia"
GH_API="https://api.github.com"
GH_REPO="$GH_API/repos/$REPO"

platform=$(uname -ms)
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

case "$ARCH" in
  x86_64 | amd64)
    ARCH="amd64"
    ;;
  aarch64 | arm64 | armv8*)
    ARCH="arm64"
    ;;
  *)
    error "Unsupported architecture: $ARCH"
    ;;
esac

case "$OS" in
  darwin)
    if [ "$ARCH" != "arm64" ]; then
      error "Intel Mac is not supported. Only Apple Silicon (arm64) is supported."
    fi
    ASSET_NAME="paideia-macos-arm64"
    DEST_NAME="paideia"
    ;;
  linux)
    ASSET_NAME="paideia-linux-$ARCH"
    DEST_NAME="paideia"
    ;;
  mingw* | msys* | cygwin*)
    ASSET_NAME="paideia.exe"
    DEST_NAME="paideia.exe"
    ;;
  *)
    error "Unsupported OS: $OS"
    ;;
esac

info "Fetching latest release..."
RELEASE_JSON=$(curl -sf "$GH_REPO/releases/latest") || error "Failed to fetch release info. Check your network connection or GitHub rate limits."

get_asset_id() {
  if command -v jq > /dev/null 2>&1; then
    echo "$RELEASE_JSON" | jq -r --arg name "$ASSET_NAME" '.assets[] | select(.name == $name) | .id'
  elif command -v python3 > /dev/null 2>&1; then
    python3 -c "
import json, sys
data = json.loads(sys.argv[1])
name = sys.argv[2]
for a in data.get('assets', []):
  if a['name'] == name:
    print(a['id'])
    break
" "$RELEASE_JSON" "$ASSET_NAME" 2>/dev/null
  else
    error "Neither jq nor python3 found. Please install one to parse the release JSON."
  fi
}

ASSET_ID=$(get_asset_id)

if [ -z "$ASSET_ID" ] || [ "$ASSET_ID" = "null" ]; then
  error "Asset '$ASSET_NAME' not found in latest release."
fi

TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT
cd "$TMP_DIR"

info "Downloading $BINARY_NAME ($ASSET_NAME)..."

curl --fail --location --progress-bar \
  -H "Accept: application/octet-stream" \
  "$GH_REPO/releases/assets/$ASSET_ID" \
  -o "$ASSET_NAME"

chmod +x "$ASSET_NAME"

if [ -d "$HOME/.local/bin" ] && [ -w "$HOME/.local/bin" ]; then
  INSTALL_DIR="$HOME/.local/bin"
elif [ -d "$HOME/bin" ] && [ -w "$HOME/bin" ]; then
  INSTALL_DIR="$HOME/bin"
elif [ -d "/usr/local/bin" ] && [ -w "/usr/local/bin" ]; then
  INSTALL_DIR="/usr/local/bin"
else
  INSTALL_DIR="$HOME/.local/bin"
  mkdir -p "$INSTALL_DIR"
  if [ ! -w "$INSTALL_DIR" ]; then
    error "Cannot write to $INSTALL_DIR or /usr/local/bin. Fix permissions and try again."
  fi
fi

mv "$ASSET_NAME" "$INSTALL_DIR/$DEST_NAME"

tildify() {
    if [[ $1 = $HOME/* ]]; then
        echo "${1/$HOME\//\~/}"
    else
        echo "$1"
    fi
}

success "Installed ${Bold_Green}$(tildify "$INSTALL_DIR/$DEST_NAME")${Color_Off}"

add_to_path() {
  local path_export="export PATH=\"\$PATH:$INSTALL_DIR\""
  local config_file="$1"

  if [ ! -f "$config_file" ]; then
    return 1
  fi

  if grep -q "$INSTALL_DIR" "$config_file" 2>/dev/null; then
    return 0
  fi

  echo "" >> "$config_file"
  echo "# paideia" >> "$config_file"
  echo "$path_export" >> "$config_file"
  return 0
}

if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
  if add_to_path "$HOME/.bashrc"; then
    info "Added $(tildify "$INSTALL_DIR") to \$PATH in ~/.bashrc"
    info_bold "Run 'source ~/.bashrc' or restart your terminal to use paideia."
  elif add_to_path "$HOME/.zshrc"; then
    info "Added $(tildify "$INSTALL_DIR") to \$PATH in ~/.zshrc"
    info_bold "Run 'source ~/.zshrc' or restart your terminal to use paideia."
  elif add_to_path "$HOME/.profile"; then
    info "Added $(tildify "$INSTALL_DIR") to \$PATH in ~/.profile"
    info_bold "Run 'source ~/.profile' or restart your terminal to use paideia."
  else
    warn "Add $(tildify "$INSTALL_DIR") to your PATH. For example:"
    info_bold "  export PATH=\"\$PATH:$INSTALL_DIR\""
  fi
else
  info_bold "You can run 'paideia' now."
fi
