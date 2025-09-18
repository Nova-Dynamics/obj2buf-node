# obj2buf C++ Bindings v1.0.0

C++11 header-only library for deserializing binary data created by the obj2buf JavaScript library.

Compatible with obj2buf JavaScript library v1.0.0+

## Features

- **Header-only*// 2. C++ side
#include "obj2buf.hpp"

void process_user_data(const std::vector<uint8_t>& buffer, 
                      const nlohmann::json& schema_json) {
    std::cout << "Using obj2buf C++ bindings v" << obj2buf::version() << std::endl;
    
    obj2buf::Schema schema(schema_json["root_type"]);
    nlohmann::json user = schema.deserialize(buffer);
    
    uint32_t id = user["id"];
    std::string name = user["name"];
    uint32_t age = user["age"];
    
    std::cout << "Processing user: " << name 
              << " (ID: " << id << ", Age: " << age << ")" << std::endl;
}buf.hpp` file, no compilation required
- **C++11 Compatible**: Works with modern C++ standards
- **nlohmann/json Integration**: Uses familiar JSON objects for deserialized data
- **Complete Type Support**: All obj2buf types supported (primitives, strings, arrays, maps, etc.)
- **Exception Safety**: Proper error handling with descriptive messages
- **Version Information**: Built-in version checking for compatibility

## Dependencies

- **nlohmann/json**: For JSON object representation
- **C++11 or later**: Modern C++ standard

## Installation

### Using vcpkg
```bash
vcpkg install nlohmann-json
```

### Using Conan
```bash
conan install nlohmann_json/3.11.2@
```

### Manual Installation
Download `nlohmann/json` from https://github.com/nlohmann/json

## Usage

### Basic Example

```cpp
#include "obj2buf.hpp"
#include <iostream>
#include <vector>

int main() {
    // Schema definition (exported from JavaScript schema.to_json())
    nlohmann::json schema_def = {
        {"type", "Schema"},
        {"root_type", {
            {"type", "MapType"},
            {"field_pairs", {
                {"id", {{"type", "UInt32"}}},
                {"name", {{"type", "VarStringType"}, {"max_length", 100}}},
                {"age", {{"type", "UInt8"}}},
                {"is_active", {{"type", "BooleanType"}}}
            }}
        }}
    };
    
    // Create schema from the root_type
    obj2buf::Schema schema(schema_def["root_type"]);
    
    // Your binary data (from JavaScript obj2buf.serialize())
    std::vector<uint8_t> buffer = {/* ... binary data ... */};
    
    // Deserialize
    nlohmann::json result = schema.deserialize(buffer);
    
    // Access data
    std::cout << "ID: " << result["id"] << std::endl;
    std::cout << "Name: " << result["name"] << std::endl;
    std::cout << "Age: " << result["age"] << std::endl;
    std::cout << "Active: " << result["is_active"] << std::endl;
    
    return 0;
}
```

### Working with Raw Pointers

```cpp
// If you have raw buffer data
const uint8_t* raw_buffer = /* ... */;
size_t buffer_size = /* ... */;

nlohmann::json result = schema.deserialize(raw_buffer, buffer_size);
```

### Schema from JavaScript Export

```cpp
// In JavaScript:
// const schema_json = schema.to_json();
// // Send schema_json to C++

// In C++:
nlohmann::json schema_json = /* received from JavaScript */;
obj2buf::Schema schema(schema_json);
```

## Version Information

Check the version of the C++ bindings:

```cpp
#include "obj2buf.hpp"
#include <iostream>

int main() {
    std::cout << "obj2buf C++ bindings version: " << obj2buf::version() << std::endl;
    std::cout << "Major: " << obj2buf::version_major() << std::endl;
    std::cout << "Minor: " << obj2buf::version_minor() << std::endl;
    std::cout << "Patch: " << obj2buf::version_patch() << std::endl;
    return 0;
}
```

### Compatibility

- **C++ Bindings v1.0.0**: Compatible with obj2buf JavaScript v1.0.0+
- **Breaking changes**: Will be indicated by major version bumps
- **New features**: Will be indicated by minor version bumps  
- **Bug fixes**: Will be indicated by patch version bumps

## Supported Types

### Primitive Types
- `UInt8`, `UInt16`, `UInt32` - Unsigned integers
- `Int8`, `Int16`, `Int32` - Signed integers  
- `Float32`, `Float64` - IEEE 754 floating point
- `BooleanType` - Boolean values
- `Char` - Single characters

### Unified Types (Alternative Syntax)
- `UInt(byte_length)` - Generic unsigned integer (1, 2, or 4 bytes)
- `Int(byte_length)` - Generic signed integer (1, 2, or 4 bytes)
- `Float(byte_length)` - Generic floating point (4 or 8 bytes)

### String Types
- `FixedStringType(length)` - Fixed-length strings
- `VarStringType(max_length)` - Variable-length strings

### Container Types
- `ArrayType(element_type, length?)` - Arrays (fixed or variable length)
- `TupleType(element_types...)` - Fixed-structure tuples
- `MapType(field_pairs)` - Objects with named fields
- `EnumType(options)` - String enumerations
- `OptionalType(base_type)` - Nullable values

## Error Handling

All parsing errors throw `obj2buf::parser_error`:

```cpp
try {
    nlohmann::json result = schema.deserialize(buffer);
} catch (const obj2buf::parser_error& e) {
    std::cerr << "Parse error: " << e.what() << std::endl;
}
```

## Performance Notes

- **Zero-copy**: Strings are constructed directly from buffer data
- **Minimal allocations**: Efficient memory usage
- **Little-endian**: Matches JavaScript buffer format
- **Header-only**: No linking overhead

## Type Mapping

| obj2buf Type | C++ JSON Type | Notes |
|--------------|---------------|--------|
| UInt8/16/32  | `uint32_t`    | Promoted to 32-bit for JSON compatibility |
| Int8/16/32   | `int32_t`     | Promoted to 32-bit for JSON compatibility |
| UInt(1/2/4)  | `uint32_t`    | Generic unsigned integer types |
| Int(1/2/4)   | `int32_t`     | Generic signed integer types with sign extension |
| Float32/64   | `double`      | Float32 promoted to double |
| Float(4/8)   | `double`      | Generic floating point types |
| BooleanType  | `bool`        | |
| String types | `std::string` | UTF-8 encoded |
| Arrays       | `json::array` | |
| Maps         | `json::object` | |
| Enums        | `std::string` | Enum value as string |
| Optional     | `null` or value | null for absent values |

## Integration Example

```cpp
// Complete example showing JavaScript → C++ workflow

// 1. JavaScript side (Node.js/Browser)
/*
const { Schema, types } = require('obj2buf');

const user_type = new types.MapType([
    ['id', new types.UInt32()],
    ['name', new types.VarStringType(50)],
    ['age', new types.UInt8()]
]);

const schema = new Schema(user_type);
const user_data = { id: 1234, name: 'Alice', age: 30 };

// Serialize data
const buffer = schema.serialize(user_data);

// Export schema for C++
const schema_json = schema.to_json();

// Send both buffer and schema_json to C++
*/

// 2. C++ side
#include "obj2buf.hpp"

void process_user_data(const std::vector<uint8_t>& buffer, 
                      const nlohmann::json& schema_json) {
    obj2buf::Schema schema(schema_json["root_type"]);
    nlohmann::json user = schema.deserialize(buffer);
    
    uint32_t id = user["id"];
    std::string name = user["name"];
    uint8_t age = user["age"];
    
    std::cout << "Processing user: " << name 
              << " (ID: " << id << ", Age: " << age << ")" << std::endl;
}
```

## Building

### Quick Start with run.sh

The easiest way to get started is using the provided `run.sh` script:

```bash
cd bindings/cpp
./run.sh
```

This script will:
1. Download nlohmann/json locally (single header)
2. Compile the example with the correct flags
3. Run the example program

No system installation required!

### Manual Building

No special build configuration required. Just include the header:

```cpp
#include "obj2buf.hpp"
```

Make sure nlohmann/json is available in your include path.

### CMake Example
```cmake
find_package(nlohmann_json REQUIRED)
target_link_libraries(your_target nlohmann_json::nlohmann_json)
```

## License

Same as obj2buf JavaScript library (ISC License).
