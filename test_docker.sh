#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

IMAGE_NAME="openspec-ui:test"
CONTAINER_NAME="openspec-ui-test"

cleanup() {
    echo "Cleaning up..."
    if [ "$(docker ps -aq -f name=$CONTAINER_NAME)" ]; then
        docker rm -f $CONTAINER_NAME > /dev/null
    fi
}

trap cleanup EXIT

echo "Building Docker image..."
docker build -t $IMAGE_NAME .

echo "Starting container..."
docker run -d --name $CONTAINER_NAME -p 3000:3000 $IMAGE_NAME

echo "Waiting for health check..."
# Wait up to 30 seconds for the service to be ready
for i in {1..30}; do
    if curl -s http://localhost:3000/api/health > /dev/null; then
        echo -e "${GREEN}Health check passed!${NC}"
        exit 0
    fi
    echo -n "."
    sleep 1
done

echo -e "\n${RED}Health check failed.${NC}"
echo "Container logs:"
docker logs $CONTAINER_NAME
exit 1

