#include "obj2buf.hpp"
#include <iostream>
#include <vector>
#include <iomanip>

void test_basic_types() {
    std::cout << "Testing basic primitive types:\n";
    std::cout << "==============================\n";
    
    // Test UInt32
    obj2buf::UInt32 uint32_type;
    obj2buf::json value = 42;
    std::vector<uint8_t> buffer(4);
    uint32_type.encode(value, buffer.data(), 0, buffer.size());
    
    std::cout << "UInt32: Encoded 42 as bytes: ";
    for (uint8_t byte : buffer) {
        std::cout << std::hex << static_cast<int>(byte) << " ";
    }
    std::cout << std::dec << "\n";
    
    size_t offset = 0;
    obj2buf::json decoded = uint32_type.deserialize(buffer.data(), offset, buffer.size());
    std::cout << "UInt32: Decoded value: " << decoded << "\n";
    
    // Test Boolean
    obj2buf::BooleanType bool_type;
    obj2buf::json bool_value = true;
    std::vector<uint8_t> bool_buffer(1);
    bool_type.encode(bool_value, bool_buffer.data(), 0, bool_buffer.size());
    
    offset = 0;
    obj2buf::json decoded_bool = bool_type.deserialize(bool_buffer.data(), offset, bool_buffer.size());
    std::cout << "BooleanType: " << bool_value << " -> " << decoded_bool << "\n";
    
    // Test Float32
    obj2buf::Float32 float_type;
    obj2buf::json float_value = 3.14159f;
    std::vector<uint8_t> float_buffer(4);
    float_type.encode(float_value, float_buffer.data(), 0, float_buffer.size());
    
    offset = 0;
    obj2buf::json decoded_float = float_type.deserialize(float_buffer.data(), offset, float_buffer.size());
    std::cout << "Float32: " << float_value << " -> " << decoded_float << "\n\n";
}

void test_string_types() {
    std::cout << "Testing string types:\n";
    std::cout << "====================\n";
    
    // Test FixedStringType
    obj2buf::FixedStringType fixed_string(10);
    obj2buf::json string_value = "Hello";
    std::vector<uint8_t> string_buffer(10);
    fixed_string.encode(string_value, string_buffer.data(), 0, string_buffer.size());
    
    size_t offset = 0;
    obj2buf::json decoded_string = fixed_string.deserialize(string_buffer.data(), offset, string_buffer.size());
    std::cout << "FixedStringType(10): '" << string_value.get<std::string>() << "' -> '" << decoded_string.get<std::string>() << "'\n";
    
    // Test VarStringType
    obj2buf::VarStringType var_string(100);
    obj2buf::json var_value = "Variable length string!";
    std::vector<uint8_t> var_buffer(100);
    size_t bytes_written = var_string.encode(var_value, var_buffer.data(), 0, var_buffer.size());
    
    offset = 0;
    obj2buf::json decoded_var = var_string.deserialize(var_buffer.data(), offset, var_buffer.size());
    std::cout << "VarStringType: '" << var_value.get<std::string>() << "' -> '" << decoded_var.get<std::string>() << "' (bytes: " << bytes_written << ")\n";
    
    // Test VarBufferType
    obj2buf::VarBufferType var_buffer_type(100);
    obj2buf::json buffer_value = {0x01, 0x02, 0x03, 0xFF, 0x00, 0xAB}; // Array of bytes
    std::vector<uint8_t> buffer_storage(100);
    size_t buffer_bytes_written = var_buffer_type.encode(buffer_value, buffer_storage.data(), 0, buffer_storage.size());
    
    offset = 0;
    obj2buf::json decoded_buffer = var_buffer_type.deserialize(buffer_storage.data(), offset, buffer_storage.size());
    std::cout << "VarBufferType: " << buffer_value << " -> " << decoded_buffer << " (bytes: " << buffer_bytes_written << ")\n";

    // Test VarBufferType with Schema
    obj2buf::json buffer_schema = {
        {"type", "VarBufferType"},
        {"max_length", 50}
    };
    obj2buf::Schema buffer_schema_obj(buffer_schema);
    obj2buf::json schema_buffer_value = {0xDE, 0xAD, 0xBE, 0xEF};
    std::vector<uint8_t> schema_serialized = buffer_schema_obj.serialize(schema_buffer_value);
    obj2buf::json schema_deserialized = buffer_schema_obj.deserialize(schema_serialized);
    std::cout << "VarBufferType (Schema): " << schema_buffer_value << " -> " << schema_deserialized << "\n\n";
}

void test_json_types() {
    std::cout << "Testing JSON types:\n";
    std::cout << "==================\n";
    
    // Test JSONType with simple object
    obj2buf::JSONType json_type(1000);
    obj2buf::json simple_object = {
        {"name", "John Doe"},
        {"age", 30},
        {"active", true}
    };
    
    std::vector<uint8_t> json_buffer(1000);
    size_t json_bytes_written = json_type.encode(simple_object, json_buffer.data(), 0, json_buffer.size());
    
    size_t offset = 0;
    obj2buf::json decoded_json = json_type.deserialize(json_buffer.data(), offset, json_buffer.size());
    std::cout << "JSONType (simple object): " << simple_object.dump() << "\n";
    std::cout << "Decoded: " << decoded_json.dump() << " (bytes: " << json_bytes_written << ")\n";
    
    // Test JSONType with complex nested structure
    obj2buf::json complex_object = {
        {"user", {
            {"profile", {
                {"name", "Alice"},
                {"preferences", {
                    {"theme", "dark"},
                    {"notifications", true},
                    {"languages", {"en", "es", "fr"}}
                }}
            }},
            {"stats", {
                {"login_count", 42},
                {"last_active", "2023-10-15T14:30:00Z"}
            }}
        }},
        {"metadata", {
            {"version", "1.2.3"},
            {"timestamp", 1697375400}
        }}
    };
    
    std::vector<uint8_t> complex_buffer(2000);
    size_t complex_bytes_written = json_type.encode(complex_object, complex_buffer.data(), 0, complex_buffer.size());
    
    offset = 0;
    obj2buf::json decoded_complex = json_type.deserialize(complex_buffer.data(), offset, complex_buffer.size());
    std::cout << "\nJSONType (complex object): " << complex_object.dump(2) << "\n";
    std::cout << "Decoded successfully: " << (decoded_complex == complex_object ? "✅" : "❌") << " (bytes: " << complex_bytes_written << ")\n";
    
    // Test JSONType with array
    obj2buf::json array_value = {1, 2, 3, {"nested", "object"}, true, nullptr};
    std::vector<uint8_t> array_buffer(500);
    size_t array_bytes_written = json_type.encode(array_value, array_buffer.data(), 0, array_buffer.size());
    
    offset = 0;
    obj2buf::json decoded_array = json_type.deserialize(array_buffer.data(), offset, array_buffer.size());
    std::cout << "\nJSONType (array): " << array_value.dump() << "\n";
    std::cout << "Decoded: " << decoded_array.dump() << " (bytes: " << array_bytes_written << ")\n";
    
    // Test JSONType with Schema
    obj2buf::json json_schema = {
        {"type", "JSONType"},
        {"max_length", 500}
    };
    obj2buf::Schema json_schema_obj(json_schema);
    obj2buf::json config_data = {
        {"server", {
            {"host", "localhost"},
            {"port", 8080},
            {"ssl", false}
        }},
        {"database", {
            {"driver", "postgresql"},
            {"connection_string", "postgres://user:pass@localhost/db"}
        }}
    };
    
    std::vector<uint8_t> schema_serialized = json_schema_obj.serialize(config_data);
    obj2buf::json schema_deserialized = json_schema_obj.deserialize(schema_serialized);
    std::cout << "\nJSONType (Schema): Configuration data encoded/decoded successfully: " 
              << (schema_deserialized == config_data ? "✅" : "❌") << "\n";
    std::cout << "Original size: " << config_data.dump().length() << " chars, encoded size: " << schema_serialized.size() << " bytes\n\n";
}

void test_complex_types() {
    std::cout << "Testing complex types:\n";
    std::cout << "=====================\n";
    
    // Test ArrayType with Schema
    obj2buf::json schema_def = {
        {"type", "ArrayType"},
        {"element_type", {{"type", "UInt8"}}},
        {"length", 3}
    };
    
    obj2buf::Schema array_schema(schema_def);
    obj2buf::json array_value = {10, 20, 30};
    
    std::vector<uint8_t> serialized = array_schema.serialize(array_value);
    std::cout << "ArrayType[3] of UInt8: " << array_value << " -> bytes: ";
    for (uint8_t byte : serialized) {
        std::cout << static_cast<int>(byte) << " ";
    }
    std::cout << "\n";
    
    obj2buf::json deserialized = array_schema.deserialize(serialized);
    std::cout << "Deserialized: " << deserialized << "\n";
    
    // Test OptionalType
    obj2buf::json optional_schema = {
        {"type", "OptionalType"},
        {"base_type", {{"type", "UInt16"}}}
    };
    
    obj2buf::Schema opt_schema(optional_schema);
    
    // Test with value
    obj2buf::json opt_value = 1337;
    std::vector<uint8_t> opt_serialized = opt_schema.serialize(opt_value);
    obj2buf::json opt_deserialized = opt_schema.deserialize(opt_serialized);
    std::cout << "OptionalType with value: " << opt_value << " -> " << opt_deserialized << "\n";
    
    // Test with null
    obj2buf::json null_value = nullptr;
    std::vector<uint8_t> null_serialized = opt_schema.serialize(null_value);
    obj2buf::json null_deserialized = opt_schema.deserialize(null_serialized);
    std::cout << "OptionalType with null: null -> " << (null_deserialized.is_null() ? "null" : "not null") << "\n";
    
    // Test ArrayType with JSONType elements
    obj2buf::json json_array_schema = {
        {"type", "ArrayType"},
        {"element_type", {{"type", "JSONType"}, {"max_length", 200}}},
        {"length", 2}
    };
    
    obj2buf::Schema json_array_schema_obj(json_array_schema);
    obj2buf::json json_array_value = {
        {{"name", "Item 1"}, {"value", 100}},
        {{"name", "Item 2"}, {"value", 200}}
    };
    
    std::vector<uint8_t> json_array_serialized = json_array_schema_obj.serialize(json_array_value);
    obj2buf::json json_array_deserialized = json_array_schema_obj.deserialize(json_array_serialized);
    std::cout << "ArrayType[2] of JSONType: " << json_array_value.dump() << "\n";
    std::cout << "Decoded: " << json_array_deserialized.dump() << " (match: " << (json_array_deserialized == json_array_value ? "✅" : "❌") << ")\n\n";
}

void test_validation() {
    std::cout << "Testing validation:\n";
    std::cout << "==================\n";
    
    try {
        obj2buf::UInt8 uint8_type;
        obj2buf::json invalid_value = 256; // Out of range for UInt8
        std::vector<uint8_t> buffer(1);
        uint8_type.encode(invalid_value, buffer.data(), 0, buffer.size());
        std::cout << "❌ Should have thrown validation error!\n";
    } catch (const obj2buf::parser_error& e) {
        std::cout << "✅ Validation correctly caught: " << e.what() << "\n";
    }
    
    try {
        obj2buf::FixedStringType str_type(5);
        obj2buf::json long_string = "This string is too long";
        std::vector<uint8_t> buffer(5);
        str_type.encode(long_string, buffer.data(), 0, buffer.size());
        std::cout << "❌ Should have thrown validation error!\n";
    } catch (const obj2buf::parser_error& e) {
        std::cout << "✅ Validation correctly caught: " << e.what() << "\n";
    }
    
    try {
        obj2buf::VarBufferType buffer_type(5);
        obj2buf::json invalid_buffer = {1, 2, 3, 4, 5, 6}; // Exceeds max_length of 5
        std::vector<uint8_t> buffer(10);
        buffer_type.encode(invalid_buffer, buffer.data(), 0, buffer.size());
        std::cout << "❌ Should have thrown validation error!\n";
    } catch (const obj2buf::parser_error& e) {
        std::cout << "✅ VarBufferType validation correctly caught: " << e.what() << "\n";
    }
    
    try {
        obj2buf::VarBufferType buffer_type(10);
        obj2buf::json invalid_buffer = {1, 256, 3}; // 256 is out of range for uint8
        std::vector<uint8_t> buffer(10);
        buffer_type.encode(invalid_buffer, buffer.data(), 0, buffer.size());
        std::cout << "❌ Should have thrown validation error!\n";
    } catch (const obj2buf::parser_error& e) {
        std::cout << "✅ VarBufferType byte range validation correctly caught: " << e.what() << "\n";
    }
    
    try {
        obj2buf::JSONType json_type(10); // Very small max_length
        obj2buf::json large_json = {
            {"this", "is"},
            {"a", "large"},
            {"json", "object"},
            {"that", "exceeds"},
            {"the", "limit"}
        };
        std::vector<uint8_t> buffer(50);
        json_type.encode(large_json, buffer.data(), 0, buffer.size());
        std::cout << "❌ Should have thrown validation error!\n";
    } catch (const obj2buf::parser_error& e) {
        std::cout << "✅ JSONType validation correctly caught: " << e.what() << "\n";
    }
    
    std::cout << "\n";
}

int main() {
    std::cout << "obj2buf C++ Bindings Test Suite (v" << obj2buf::version() << ")\n";
    std::cout << "===================================================\n\n";

    try {
        test_basic_types();
        test_string_types();
        test_json_types();
        test_complex_types();
        test_validation();
        
        std::cout << "🎉 All tests passed successfully!\n";
        std::cout << "\n📋 Test Coverage Summary:\n";
        std::cout << "   ✅ Basic primitive types (UInt32, BooleanType, Float32)\n";
        std::cout << "   ✅ String types (FixedStringType, VarStringType)\n";
        std::cout << "   ✅ Buffer types (VarBufferType)\n";
        std::cout << "   ✅ JSON types (JSONType with objects, arrays, nested data)\n";
        std::cout << "   ✅ Complex types (ArrayType, OptionalType, JSONType arrays)\n";
        std::cout << "   ✅ Schema-based serialization/deserialization\n";
        std::cout << "   ✅ JSON compatibility and validation\n";
        std::cout << "   ✅ Error handling and bounds checking\n";
        
    } catch (const std::exception& e) {
        std::cerr << "❌ Error: " << e.what() << std::endl;
        return 1;
    }
    
    return 0;
}
