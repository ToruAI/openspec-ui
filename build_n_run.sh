#!/bin/bash

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Building and running OpenSpec UI...${NC}\n"

# Get the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Check if config file exists
CONFIG_FILE="${1:-openspec-ui.json}"
if [ ! -f "$CONFIG_FILE" ]; then
    echo -e "${YELLOW}⚠️  Config file '$CONFIG_FILE' not found.${NC}"
    echo -e "${YELLOW}   Creating default config file...${NC}"
    cat > "$CONFIG_FILE" <<EOF
{
  "sources": [
    {
      "name": "openspec-ui",
      "path": "./openspec"
    },
    {
      "name": "example",
      "path": "./example-openspec"
    }
  ],
  "port": 3000
}
EOF
    echo -e "${GREEN}✅ Created default config file: $CONFIG_FILE${NC}\n"
fi

# Step 1: Build frontend
echo -e "${BLUE}📦 Building frontend...${NC}"
cd frontend

if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}   Installing frontend dependencies...${NC}"
    npm install
fi

npm run build
echo -e "${GREEN}✅ Frontend built successfully${NC}\n"

# Step 2: Build backend
cd ../backend
echo -e "${BLUE}🔨 Building backend...${NC}"
cargo build --release
echo -e "${GREEN}✅ Backend built successfully${NC}\n"

# Step 3: Run
cd ..
echo -e "${BLUE}🏃 Starting OpenSpec UI server...${NC}"
echo -e "${GREEN}   Config: $CONFIG_FILE${NC}"
echo -e "${GREEN}   Frontend: frontend/dist${NC}"
echo -e "${GREEN}   Backend: backend/target/release/openspec-ui${NC}\n"
echo -e "${YELLOW}   Press Ctrl+C to stop${NC}\n"

# Run the backend
./backend/target/release/openspec-ui --config "$CONFIG_FILE"



