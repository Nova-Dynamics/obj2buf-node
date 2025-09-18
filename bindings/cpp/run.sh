#!/bin/bash

# obj2buf C++ Example Runner
# This script downloads dependencies, compiles, and runs the example

set -e  # Exit on any error

echo "🚀 obj2buf C++ Example Runner"
echo "================================"

# Create local include directory
mkdir -p include/nlohmann

# Check if nlohmann/json is already downloaded
if [ ! -f "include/nlohmann/json.hpp" ]; then
    echo "📦 Downloading nlohmann/json (single header)..."
    
    # Try curl first, then wget
    if command -v curl >/dev/null 2>&1; then
        curl -L -o include/nlohmann/json.hpp \
            https://github.com/nlohmann/json/releases/download/v3.11.2/json.hpp
    elif command -v wget >/dev/null 2>&1; then
        wget -O include/nlohmann/json.hpp \
            https://github.com/nlohmann/json/releases/download/v3.11.2/json.hpp
    else
        echo "❌ Error: Neither curl nor wget found. Please install one of them."
        exit 1
    fi
    
    echo "✅ nlohmann/json downloaded successfully"
else
    echo "✅ nlohmann/json already available"
fi

# Compile the example
echo "🔨 Compiling example.cpp..."

# Compiler flags
CXXFLAGS="-std=c++11 -Wall -Wextra -O2"
INCLUDES="-I./include -I."
OUTPUT="obj2buf_example"

if command -v g++ >/dev/null 2>&1; then
    CXX="g++"
elif command -v clang++ >/dev/null 2>&1; then
    CXX="clang++"
else
    echo "❌ Error: No C++ compiler found (g++ or clang++)"
    exit 1
fi

echo "   Using compiler: $CXX"
echo "   Flags: $CXXFLAGS"

$CXX $CXXFLAGS $INCLUDES example.cpp -o $OUTPUT

echo "✅ Compilation successful"

# Run the example
echo "🎯 Running the example..."
echo "================================"

./$OUTPUT

echo ""
echo "================================"
echo "🎉 Example completed successfully!"
echo ""
echo "📝 To run again: ./$OUTPUT"
echo "🧹 To clean: rm -f $OUTPUT && rm -rf include/"
