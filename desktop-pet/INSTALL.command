#!/bin/bash
# Desktop Pet — one-click macOS installer
# Double-click this file in Finder to build and install Desktop Pet.

set -e
cd "$(dirname "$0")"

echo ""
echo "======================================"
echo "  Desktop Pet — macOS Builder"
echo "======================================"
echo ""

# Check for Node.js
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed."
  echo "Opening nodejs.org — please install Node.js, then run this script again."
  open "https://nodejs.org"
  exit 1
fi

NODE_VER=$(node -v)
echo "Found Node.js $NODE_VER"
echo ""

echo "Step 1/3 — Installing dependencies..."
npm install

echo ""
echo "Step 2/3 — Building the app..."
npm run package

echo ""
echo "Step 3/3 — Done! Opening the dist/ folder..."
open dist/

echo ""
echo "Look for 'Desktop Pet-2.0.0-arm64.dmg' (Apple Silicon)"
echo "or 'Desktop Pet-2.0.0.dmg' (Intel Mac) in the dist/ folder."
echo "Double-click the .dmg to install."
echo ""
