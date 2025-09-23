#!/bin/bash

# obj2buf C++ Test Runner
# This script downloads dependencies, compiles, and runs comp    echo "🎉 All tests passed successfully!"
    echo ""
    echo "📊 Test Summary:"
    echo "   ✅ Basic primitive types (UInt32, BooleanType, Float32)"
    echo "   ✅ String types (FixedStringType, VarStringType)"
    echo "   ✅ Complex types (ArrayType, OptionalType)"
    echo "   ✅ Schema-based serialization/deserialization"
    echo "   ✅ JSON compatibility and validation"
    echo "   ✅ Error handling and bounds checking"
    echo ""
    echo "🔧 Development Commands:"
    echo "   📝 Run tests again: ./$OUTPUT"
    echo "   🧹 Clean build: rm -f $OUTPUT"
    echo "   🗑️  Clean all: rm -f $OUTPUT && rm -rf include/"
    echo "   📚 View header: less obj2buf.hpp"

set -e  # Exit on any error

echo "🧪 obj2buf C++ Test Runner"
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

# Detect best compiler and version
echo "� Detecting C++ compiler..."

CXX=""
CXXFLAGS=""

if command -v g++ >/dev/null 2>&1; then
    CXX="g++"
    # Check if C++14 or C++17 is supported
    if g++ -std=c++17 -dumpversion >/dev/null 2>&1; then
        CXXFLAGS="-std=c++17 -Wall -Wextra -O2"
        echo "   Using: g++ with C++17 support"
    elif g++ -std=c++14 -dumpversion >/dev/null 2>&1; then
        CXXFLAGS="-std=c++14 -Wall -Wextra -O2"
        echo "   Using: g++ with C++14 support"
    else
        CXXFLAGS="-std=c++11 -Wall -Wextra -O2"
        echo "   Using: g++ with C++11 support"
    fi
elif command -v clang++ >/dev/null 2>&1; then
    CXX="clang++"
    # Check clang++ version for C++ standard support
    if clang++ -std=c++17 -dumpversion >/dev/null 2>&1; then
        CXXFLAGS="-std=c++17 -Wall -Wextra -O2"
        echo "   Using: clang++ with C++17 support"
    elif clang++ -std=c++14 -dumpversion >/dev/null 2>&1; then
        CXXFLAGS="-std=c++14 -Wall -Wextra -O2"
        echo "   Using: clang++ with C++14 support"
    else
        CXXFLAGS="-std=c++11 -Wall -Wextra -O2"
        echo "   Using: clang++ with C++11 support"
    fi
else
    echo "❌ Error: No C++ compiler found (g++ or clang++)"
    exit 1
fi

INCLUDES="-I./include -I."
OUTPUT="obj2buf_test"

# Compile the tests
echo "🔨 Compiling test suite..."
echo "   Compiler: $CXX"
echo "   Flags: $CXXFLAGS"

$CXX $CXXFLAGS $INCLUDES example.cpp -o $OUTPUT

if [ $? -eq 0 ]; then
    echo "✅ Compilation successful"
else
    echo "❌ Compilation failed"
    exit 1
fi

# Run the tests
echo ""
echo "🎯 Running test suite..."
echo "================================"

./$OUTPUT

TEST_EXIT_CODE=$?

echo ""
echo "================================"

if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo "🎉 All tests passed successfully!"
    echo ""
    echo "📊 Test Summary:"
    echo "   ✅ Basic primitive types (UInt32)"
    echo "   ✅ Complex types (ArrayType with fixed length)"
    echo "   ✅ String types (FixedStringType)"
    echo "   ✅ Schema-based serialization/deserialization"
    echo "   ✅ JSON compatibility"
    echo ""
    echo "� Development Commands:"
    echo "   📝 Run tests again: ./$OUTPUT"
    echo "   🧹 Clean build: rm -f $OUTPUT"
    echo "   🗑️  Clean all: rm -f $OUTPUT && rm -rf include/"
    echo "   📚 View header: less obj2buf.hpp"
else
    echo "❌ Tests failed with exit code $TEST_EXIT_CODE"
    echo ""
    echo "🔧 Debug Commands:"
    echo "   📝 Run with verbose output: ./$OUTPUT"
    echo "   📚 Check implementation: less obj2buf.hpp"
    echo "   🧹 Clean and retry: rm -f $OUTPUT && ./run.sh"
fi

exit $TEST_EXIT_CODE
