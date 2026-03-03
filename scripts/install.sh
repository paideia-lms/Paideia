#!/usr/bin/env bash
set -e

REPO="paideia-lms/paideia"
BINARY_NAME="paideia"
GH_API="https://api.github.com"
GH_REPO="$GH_API/repos/$REPO"

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
    echo "Error: Unsupported architecture: $ARCH" >&2
    exit 1
    ;;
esac

case "$OS" in
  darwin)
    if [ "$ARCH" != "arm64" ]; then
      echo "Error: Intel Mac is not supported. Only Apple Silicon (arm64) is supported." >&2
      exit 1
    fi
    ASSET_NAME="paideia-macos-arm64"
    ;;
  linux)
    ASSET_NAME="paideia-linux-$ARCH"
    ;;
  mingw* | msys* | cygwin*)
    ASSET_NAME="paideia.exe"
    ;;
  *)
    echo "Error: Unsupported OS: $OS" >&2
    exit 1
    ;;
esac

RELEASE_JSON=$(curl -sf "$GH_REPO/releases/latest")

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
    echo "Error: Neither jq nor python3 found. Please install one to parse the release JSON." >&2
    exit 1
  fi
}

ASSET_ID=$(get_asset_id)

if [ -z "$ASSET_ID" ] || [ "$ASSET_ID" = "null" ]; then
  echo "Error: Asset '$ASSET_NAME' not found in latest release." >&2
  exit 1
fi

TMP_DIR=$(mktemp -d)
trap "rm -rf $TMP_DIR" EXIT
cd "$TMP_DIR"

echo "Downloading $BINARY_NAME ($ASSET_NAME)..."

curl -sfL \
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
    echo "Error: Cannot write to $INSTALL_DIR or /usr/local/bin. Fix permissions and try again." >&2
    exit 1
  fi
fi

mv "$ASSET_NAME" "$INSTALL_DIR/$BINARY_NAME"

echo "Installed $BINARY_NAME to $INSTALL_DIR/$BINARY_NAME"

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
  echo "# Added by paideia install script" >> "$config_file"
  echo "$path_export" >> "$config_file"
  return 0
}

if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
  if add_to_path "$HOME/.bashrc"; then
    echo "Added $INSTALL_DIR to PATH in ~/.bashrc"
    echo "Run 'source ~/.bashrc' or restart your terminal to use paideia."
  elif add_to_path "$HOME/.zshrc"; then
    echo "Added $INSTALL_DIR to PATH in ~/.zshrc"
    echo "Run 'source ~/.zshrc' or restart your terminal to use paideia."
  elif add_to_path "$HOME/.profile"; then
    echo "Added $INSTALL_DIR to PATH in ~/.profile"
    echo "Run 'source ~/.profile' or restart your terminal to use paideia."
  else
    echo "" >&2
    echo "Note: Add $INSTALL_DIR to your PATH. For example:" >&2
    echo "  export PATH=\"\$PATH:$INSTALL_DIR\"" >&2
  fi
else
  echo "You can run 'paideia' now."
fi
