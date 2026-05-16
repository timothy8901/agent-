#!/bin/bash
# Desktop Pet Patti — one-click macOS builder
# Double-click this file in Finder to build the app locally.

set -e
cd "$(dirname "$0")"

echo ""
echo "============================================"
echo "  Desktop Pet Patti — macOS Builder"
echo "============================================"
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
echo "Look for 'Desktop Pet Patti-3.0.0-arm64.dmg' (Apple Silicon)"
echo "or 'Desktop Pet Patti-3.0.0.dmg' (Intel Mac) in the dist/ folder."
echo ""
echo "Double-click the .dmg and drag Patti to /Applications."
echo ""
echo "📋 First launch will be blocked by Gatekeeper. To allow it:"
echo "    1. Try to open Patti once (you'll see a 'blocked' dialog — that's fine)"
echo "    2. Open System Settings → Privacy & Security"
echo "    3. Scroll to the bottom — there will be an 'Open Anyway' button for Patti"
echo "    4. Click it, enter your password, and Patti will start"
echo ""
