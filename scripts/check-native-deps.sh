#!/bin/bash

# Script to check for native/binary dependencies in imported packages
# Usage: ./scripts/check-native-deps.sh [build-file] [node_modules-dir]

set -uo pipefail

BUILD_FILE="${1:-build/server/index.js}"
NODE_MODULES="${2:-node_modules}"

if [ ! -f "$BUILD_FILE" ]; then
  echo "Error: Build file not found: $BUILD_FILE"
  exit 1
fi

if [ ! -d "$NODE_MODULES" ]; then
  echo "Error: node_modules directory not found: $NODE_MODULES"
  exit 1
fi

echo "Extracting imports from $BUILD_FILE..."
echo ""

# Extract all import statements and get package names
# Handles: import ... from "package", import "package", import ... from "scoped/package"
extract_imports() {
  # Extract imports with 'from' clause
  grep -E '^import.*from\s+"[^"]+"' "$BUILD_FILE" | \
    sed -E 's/.*from[[:space:]]+"([^"]+)".*/\1/' > /tmp/imports_from.txt 2>/dev/null || true
  
  # Extract side-effect imports (no 'from' clause)
  grep -E '^import\s+"[^"]+"' "$BUILD_FILE" | \
    sed -E 's/^import[[:space:]]+"([^"]+)".*/\1/' > /tmp/imports_side.txt 2>/dev/null || true
  
  # Combine and sort unique
  cat /tmp/imports_from.txt /tmp/imports_side.txt 2>/dev/null | sort -u
  rm -f /tmp/imports_from.txt /tmp/imports_side.txt 2>/dev/null || true
}

# Get the base package name from an import path
get_base_package() {
  local import_path="$1"
  
  # Skip node: built-ins
  if [[ "$import_path" == node:* ]]; then
    return 1
  fi
  
  # Handle scoped packages: @scope/name/subpath -> @scope/name
  if [[ "$import_path" == @* ]]; then
    # @scope/name -> @scope/name (no subpath)
    # @scope/name/subpath -> @scope/name
    # @scope/name/subpath/more -> @scope/name
    echo "$import_path" | sed -E 's|^(@[^/]+/[^/]+)(/.*)?$|\1|'
  else
    # Regular package: package/subpath -> package
    # e.g., react/jsx-runtime -> react
    # e.g., highlight.js/lib/languages/bash -> highlight.js
    echo "$import_path" | sed -E 's|^([^/]+)(/.*)?$|\1|'
  fi
}

# Check if package has native/binary dependencies
# Returns 0 if native deps found, 1 if no native deps, 2 if package not found
check_native_deps() {
  local pkg="$1"
  local pkg_path="$NODE_MODULES/$pkg"
  
  if [ ! -d "$pkg_path" ]; then
    echo "  ⚠️  Package not found in node_modules"
    return 2  # Special return code for not found
  fi
  
  local has_native=false
  local reasons=()
  
  # Check for .node files (native bindings) - most common indicator
  local node_files=$(find "$pkg_path" -name "*.node" -type f 2>/dev/null | wc -l | tr -d ' ')
  if [ "$node_files" -gt 0 ]; then
    has_native=true
    reasons+=("Contains $node_files .node file(s)")
  fi
  
  # Check for other native binary files
  if find "$pkg_path" -name "*.so" -o -name "*.dylib" -o -name "*.dll" -o -name "*.a" -o -name "*.lib" 2>/dev/null | grep -q .; then
    has_native=true
    local bin_count=$(find "$pkg_path" \( -name "*.so" -o -name "*.dylib" -o -name "*.dll" -o -name "*.a" -o -name "*.lib" \) -type f 2>/dev/null | wc -l | tr -d ' ')
    reasons+=("Contains $bin_count native binary file(s) (.so/.dylib/.dll/.a/.lib)")
  fi
  
  # Check for binding.gyp (node-gyp build configuration)
  if [ -f "$pkg_path/binding.gyp" ]; then
    has_native=true
    reasons+=("Has binding.gyp file (node-gyp build)")
  fi
  
  # Check for node-addon-api (indicates native addon)
  if [ -f "$pkg_path/package.json" ]; then
    # Extract dependencies section (excluding devDependencies)
    # Check for node-gyp/nan/node-addon-api in production dependencies only
    local deps_section=$(awk '/"dependencies"[:{]/,/^[[:space:]]*[}]/' "$pkg_path/package.json" 2>/dev/null)
    local opt_deps_section=$(awk '/"optionalDependencies"[:{]/,/^[[:space:]]*[}]/' "$pkg_path/package.json" 2>/dev/null)
    
    # Check dependencies (not devDependencies)
    if echo "$deps_section" | grep -qiE '"node-gyp"|"nan"|"node-addon-api"|"node-pre-gyp"|"bindings"|"prebuild"|"prebuild-install"'; then
      has_native=true
      reasons+=("Has native build tools in dependencies")
    fi
    
    # Check optionalDependencies (often used for native binaries like sharp)
    if [ -n "$opt_deps_section" ]; then
      if echo "$opt_deps_section" | grep -qiE '"sharp"|"canvas"|"fsevents"|"electron"|"node-gyp"|"nan"|"node-addon-api"|"bindings"|"prebuild"|"prebuild-install"'; then
        has_native=true
        reasons+=("Has optionalDependencies with native binaries")
      fi
    fi
    
    # Check if package is actually installed (check node_modules for prebuild packages)
    if [ -d "$pkg_path/node_modules/prebuild" ] || [ -d "$pkg_path/node_modules/prebuild-install" ]; then
      has_native=true
      reasons+=("Has prebuild/prebuild-install packages installed")
    fi
    
    # Check for binding.gyp in scripts (but only if node-gyp is actually used)
    # This is a weak signal, so only flag if we have other evidence
    if grep -E '"scripts"' "$pkg_path/package.json" 2>/dev/null | grep -qiE "\"(install|rebuild|build)\".*:.*node-gyp"; then
      # Only flag if we also have native binaries or node-gyp in deps
      if [ "$has_native" = true ] || grep -qiE '"node-gyp"|"nan"|"node-addon-api"' "$pkg_path/package.json" 2>/dev/null; then
        has_native=true
        if [[ ! " ${reasons[@]} " =~ " native build scripts " ]]; then
          reasons+=("Has native build scripts")
        fi
      fi
    fi
  fi
  
  # Check for build directories with compiled native code
  if [ -d "$pkg_path/build" ] || [ -d "$pkg_path/build/Release" ] || [ -d "$pkg_path/build/Default" ]; then
    if find "$pkg_path/build" \( -name "*.node" -o -name "*.so" -o -name "*.dylib" -o -name "*.dll" \) -type f 2>/dev/null | grep -q .; then
      has_native=true
      reasons+=("Has compiled native code in build directory")
    fi
  fi
  
  # Known packages with native dependencies (whitelist approach for reliability)
  local known_native_packages=("sharp" "canvas" "bcrypt" "sqlite3" "fsevents" "node-sass" "sass" "@sass/dart-sass")
  for known in "${known_native_packages[@]}"; do
    if [ "$pkg" = "$known" ]; then
      has_native=true
      reasons+=("Known native dependency package")
      break
    fi
  done
  
  if [ "$has_native" = true ]; then
    echo "  ✅ NATIVE DEPENDENCIES FOUND:"
    for reason in "${reasons[@]}"; do
      echo "     - $reason"
    done
    return 0
  else
    echo "  ✓ No native dependencies detected"
    return 1
  fi
}

# Main execution
echo "Checking for native/binary dependencies in imported packages..."
echo "This script identifies packages that may not work in a pure JavaScript bundle."
echo "=================================================="
echo ""

packages_with_native=()
packages_without_native=()
packages_not_found=()
seen_packages=()

while IFS= read -r import_path; do
  if [ -z "$import_path" ]; then
    continue
  fi
  
  base_pkg=$(get_base_package "$import_path")
  
  if [ $? -ne 0 ]; then
    # Skip node: built-ins
    continue
  fi
  
  # Skip if we've already checked this package
  already_seen=0
  if [ ${#seen_packages[@]} -gt 0 ]; then
    for seen in "${seen_packages[@]}"; do
      if [ "$seen" = "$base_pkg" ]; then
        already_seen=1
        break
      fi
    done
  fi
  
  if [ $already_seen -eq 1 ]; then
    continue
  fi
  seen_packages+=("$base_pkg")
  
  echo "📦 Checking: $base_pkg"
  
  check_native_deps "$base_pkg"
  result=$?
  
  if [ $result -eq 0 ]; then
    # Native deps found
    packages_with_native+=("$base_pkg")
  elif [ $result -eq 2 ]; then
    # Package not found
    packages_not_found+=("$base_pkg")
  else
    # No native deps
    packages_without_native+=("$base_pkg")
  fi
  
  echo ""
done < <(extract_imports)

# Summary
echo "=================================================="
echo "SUMMARY"
echo "=================================================="
echo ""
echo "Packages with native/binary dependencies: ${#packages_with_native[@]}"
if [ ${#packages_with_native[@]} -gt 0 ]; then
  for pkg in "${packages_with_native[@]}"; do
    echo "  ❌ $pkg"
  done
  echo ""
  echo "⚠️  WARNING: These packages contain native/binary dependencies!"
  echo "   They may not work when bundled into a single pure JavaScript executable."
  echo "   Consider:"
  echo "     - Using alternatives without native dependencies"
  echo "     - Excluding these packages from the bundle"
  echo "     - Using dynamic imports or runtime loading"
  echo "     - Bundling platform-specific binaries separately"
fi

echo ""
echo "Packages without native dependencies: ${#packages_without_native[@]}"
if [ ${#packages_without_native[@]} -gt 0 ] && [ ${#packages_with_native[@]} -gt 0 ]; then
  echo "  (Safe to bundle as pure JavaScript)"
fi

echo ""
echo "Packages not found in node_modules: ${#packages_not_found[@]}"
if [ ${#packages_not_found[@]} -gt 0 ]; then
  for pkg in "${packages_not_found[@]}"; do
    echo "  ⚠️  $pkg"
  done
fi

if [ ${#packages_with_native[@]} -gt 0 ]; then
  exit 1
else
  echo ""
  echo "✅ No native dependencies found in imported packages."
  echo "   The server/index.js can be pure JavaScript."
  exit 0
fi
