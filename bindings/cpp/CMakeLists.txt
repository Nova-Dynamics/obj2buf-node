cmake_minimum_required(VERSION 3.10)
project(obj2buf_cpp_example)

# Set C++ standard
set(CMAKE_CXX_STANDARD 11)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Find nlohmann/json
find_package(nlohmann_json QUIET)

if(nlohmann_json_FOUND)
    message(STATUS "Found nlohmann/json via find_package")
else()
    # Try to find it manually or download it
    find_path(NLOHMANN_JSON_INCLUDE_DIR 
        NAMES nlohmann/json.hpp
        PATHS 
            /usr/include
            /usr/local/include
            /opt/homebrew/include
            ${CMAKE_CURRENT_SOURCE_DIR}/third_party
    )
    
    if(NLOHMANN_JSON_INCLUDE_DIR)
        message(STATUS "Found nlohmann/json at ${NLOHMANN_JSON_INCLUDE_DIR}")
        add_library(nlohmann_json INTERFACE)
        target_include_directories(nlohmann_json INTERFACE ${NLOHMANN_JSON_INCLUDE_DIR})
    else()
        message(STATUS "nlohmann/json not found locally, downloading...")
        include(FetchContent)
        FetchContent_Declare(
            nlohmann_json
            URL https://github.com/nlohmann/json/releases/download/v3.11.2/json.tar.xz
            URL_HASH SHA256=d69f9deb6a75e2580465c6c4c5111b89c4dc2fa94e3a85fcd2ffcd9a143d9273
        )
        FetchContent_MakeAvailable(nlohmann_json)
    endif()
endif()

# Create example executable
add_executable(obj2buf_example example.cpp)
target_link_libraries(obj2buf_example nlohmann_json::nlohmann_json)

# Include current directory for obj2buf.hpp
target_include_directories(obj2buf_example PRIVATE ${CMAKE_CURRENT_SOURCE_DIR})

# Compiler-specific options
if(MSVC)
    target_compile_options(obj2buf_example PRIVATE /W4)
else()
    target_compile_options(obj2buf_example PRIVATE -Wall -Wextra -Wpedantic)
endif()

# Optional: Create a test target if you have tests
# add_executable(obj2buf_tests tests.cpp)
# target_link_libraries(obj2buf_tests nlohmann_json::nlohmann_json)
# target_include_directories(obj2buf_tests PRIVATE ${CMAKE_CURRENT_SOURCE_DIR})

message(STATUS "")
message(STATUS "obj2buf C++ bindings configured!")
message(STATUS "Build the example with: cmake --build . --target obj2buf_example")
message(STATUS "")
