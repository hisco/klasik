#!/bin/bash
set -e

echo "Building go-schema-gen..."

# Download dependencies
echo "Downloading Go dependencies..."
go mod tidy

# Build binary
echo "Compiling binary..."
go build -o ../../dist/bin/go-schema-gen .

echo "✓ Build complete: dist/bin/go-schema-gen"

# Test the binary
echo ""
echo "Testing binary..."
if ../../dist/bin/go-schema-gen --type "helm.sh/helm/v3/pkg/chart.Metadata" > /dev/null 2>&1; then
    echo "✓ Binary test successful"
else
    echo "✗ Binary test failed"
    exit 1
fi
