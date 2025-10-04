#pragma once

/*
 * obj2buf C++ Bindings v1.4.0
 * 
 * Header-only C++11 library for deserializing binary data created by obj2buf JavaScript library.
 * Compatible with obj2buf JavaScript library v1.0.0+
 * 
 * GitHub: https://github.com/Nova-Dynamics/obj2buf-node
 * License: ISC
 */

#define OBJ2BUF_VERSION_MAJOR 1
#define OBJ2BUF_VERSION_MINOR 4
#define OBJ2BUF_VERSION_PATCH 0
#define OBJ2BUF_VERSION "1.4.0"

#include <nlohmann/json.hpp>
#include <string>
#include <vector>
#include <cstring>
#include <stdexcept>
#include <memory>
#include <map>

namespace obj2buf {

using json = nlohmann::json;

// Version information
inline const char* version() {
    return OBJ2BUF_VERSION;
}

inline int version_major() {
    return OBJ2BUF_VERSION_MAJOR;
}

inline int version_minor() {
    return OBJ2BUF_VERSION_MINOR;
}

inline int version_patch() {
    return OBJ2BUF_VERSION_PATCH;
}

// Exception class for parsing errors
class parser_error : public std::runtime_error {
public:
    explicit parser_error(const std::string& message) : std::runtime_error(message) {}
};

// Forward declarations
class Type;
class Schema;

// Base Type interface
class Type {
public:
    virtual ~Type() = default;
    virtual json deserialize(const uint8_t* buffer, size_t& offset, size_t buffer_size) const = 0;
    virtual size_t get_byte_length() const = 0; // Returns 0 for variable-length types
    virtual bool is_static_length() const = 0;
    virtual size_t calculate_byte_length(const json&) const = 0;
    virtual size_t encode(const json& value, uint8_t* buffer, size_t offset, size_t buffer_size, bool unsafe = false) const = 0;
    virtual bool validate(const json& value) const = 0;
    virtual json to_json() const = 0;
    
    static std::unique_ptr<Type> from_json(const json& type_def);
};

// Helper function to create unique_ptr (C++11 compatible replacement for std::make_unique)
template<typename T, typename... Args>
std::unique_ptr<T> make_unique_ptr(Args&&... args) {
    return std::unique_ptr<T>(new T(std::forward<Args>(args)...));
}

// Helper function to validate non-null values
template<typename T>
void throw_if_nullish(const T* value, const std::string& typeName) {
    if (value == nullptr) {
        throw parser_error("Cannot encode null value as " + typeName + ". Expected a valid value.");
    }
}

// Helper function for JSON values
inline void throw_if_nullish_json(const json& value, const std::string& typeName) {
    if (value.is_null()) {
        throw parser_error("Cannot encode null value as " + typeName + ". Expected a valid value.");
    }
}

// Unified Types
class UInt : public Type {
private:
    size_t bytes_;
    uint64_t max_value_;

public:
    explicit UInt(size_t byte_length) : bytes_(byte_length) {
        if (byte_length != 1 && byte_length != 2 && byte_length != 4) {
            throw std::invalid_argument("UInt byte_length must be 1, 2, or 4, got " + std::to_string(byte_length));
        }
        max_value_ = (1ULL << (byte_length * 8)) - 1;
    }

    json deserialize(const uint8_t* buffer, size_t& offset, size_t buffer_size) const override {
        if (offset + bytes_ > buffer_size) {
            throw parser_error("Buffer too small to read UInt" + std::to_string(bytes_ * 8));
        }
        
        uint64_t value = 0;
        // Little-endian reading
        for (size_t i = 0; i < bytes_; ++i) {
            value |= static_cast<uint64_t>(buffer[offset + i]) << (i * 8);
        }
        offset += bytes_;
        return json(value);
    }

    size_t get_byte_length() const override {
        return bytes_;
    }

    bool is_static_length() const override {
        return true;
    }

    size_t calculate_byte_length(const json&) const override {
        return bytes_;
    }

    size_t encode(const json& value, uint8_t* buffer, size_t offset, size_t buffer_size, bool unsafe = false) const {
        if (!unsafe) {
            validate(value);
        }
        
        if (offset + bytes_ > buffer_size) {
            throw parser_error("Buffer too small to encode UInt" + std::to_string(bytes_ * 8));
        }
        
        uint64_t val = value.get<uint64_t>();
        // Little-endian writing
        for (size_t i = 0; i < bytes_; ++i) {
            buffer[offset + i] = static_cast<uint8_t>((val >> (i * 8)) & 0xFF);
        }
        return bytes_;
    }

    bool validate(const json& value) const {
        throw_if_nullish_json(value, "UInt" + std::to_string(bytes_ * 8));
        
        if (!value.is_number_integer()) {
            throw parser_error("UInt" + std::to_string(bytes_ * 8) + " value must be an integer");
        }
        
        uint64_t val = value.get<uint64_t>();
        if (val > max_value_) {
            throw parser_error("UInt" + std::to_string(bytes_ * 8) + " value must be between 0 and " + std::to_string(max_value_));
        }
        
        return true;
    }

    json to_json() const {
        return json{{"type", "UInt"}, {"byte_length", bytes_}};
    }
};

class Int : public Type {
private:
    size_t bytes_;
    int64_t max_value_;
    int64_t min_value_;

public:
    explicit Int(size_t byte_length) : bytes_(byte_length) {
        if (byte_length != 1 && byte_length != 2 && byte_length != 4) {
            throw std::invalid_argument("Int byte_length must be 1, 2, or 4, got " + std::to_string(byte_length));
        }
        max_value_ = (1LL << (byte_length * 8 - 1)) - 1;
        min_value_ = -(1LL << (byte_length * 8 - 1));
    }

    json deserialize(const uint8_t* buffer, size_t& offset, size_t buffer_size) const override {
        if (offset + bytes_ > buffer_size) {
            throw parser_error("Buffer too small to read Int" + std::to_string(bytes_ * 8));
        }
        
        int64_t value = 0;
        // Little-endian reading with sign extension
        for (size_t i = 0; i < bytes_; ++i) {
            value |= static_cast<int64_t>(buffer[offset + i]) << (i * 8);
        }
        
        // Sign extension for smaller types
        if (bytes_ == 1 && (value & 0x80)) {
            value |= 0xFFFFFFFFFFFFFF00LL;
        } else if (bytes_ == 2 && (value & 0x8000)) {
            value |= 0xFFFFFFFFFFFF0000LL;
        } else if (bytes_ == 4 && (value & 0x80000000)) {
            value |= 0xFFFFFFFF00000000LL;
        }
        
        offset += bytes_;
        return json(value);
    }

    size_t get_byte_length() const override {
        return bytes_;
    }

    bool is_static_length() const override {
        return true;
    }

    size_t calculate_byte_length(const json&) const override {
        return bytes_;
    }

    size_t encode(const json& value, uint8_t* buffer, size_t offset, size_t buffer_size, bool unsafe = false) const {
        if (!unsafe) {
            validate(value);
        }
        
        if (offset + bytes_ > buffer_size) {
            throw parser_error("Buffer too small to encode Int" + std::to_string(bytes_ * 8));
        }
        
        int64_t val = value.get<int64_t>();
        // Little-endian writing
        for (size_t i = 0; i < bytes_; ++i) {
            buffer[offset + i] = static_cast<uint8_t>((val >> (i * 8)) & 0xFF);
        }
        return bytes_;
    }

    bool validate(const json& value) const {
        throw_if_nullish_json(value, "Int" + std::to_string(bytes_ * 8));
        
        if (!value.is_number_integer()) {
            throw parser_error("Int" + std::to_string(bytes_ * 8) + " value must be an integer");
        }
        
        int64_t val = value.get<int64_t>();
        if (val < min_value_ || val > max_value_) {
            throw parser_error("Int" + std::to_string(bytes_ * 8) + " value must be between " + 
                             std::to_string(min_value_) + " and " + std::to_string(max_value_));
        }
        
        return true;
    }

    json to_json() const {
        return json{{"type", "Int"}, {"byte_length", bytes_}};
    }
};

class Float : public Type {
private:
    size_t bytes_;

public:
    explicit Float(size_t byte_length) : bytes_(byte_length) {
        if (byte_length != 4 && byte_length != 8) {
            throw std::invalid_argument("Float byte_length must be 4 or 8, got " + std::to_string(byte_length));
        }
    }

    json deserialize(const uint8_t* buffer, size_t& offset, size_t buffer_size) const override {
        if (offset + bytes_ > buffer_size) {
            throw parser_error("Buffer too small to read Float" + std::to_string(bytes_ * 8));
        }
        
        if (bytes_ == 4) {
            float value;
            std::memcpy(&value, buffer + offset, 4);
            offset += 4;
            return json(value);
        } else {
            double value;
            std::memcpy(&value, buffer + offset, 8);
            offset += 8;
            return json(value);
        }
    }

    size_t get_byte_length() const override {
        return bytes_;
    }

    bool is_static_length() const override {
        return true;
    }

    size_t calculate_byte_length(const json&) const override {
        return bytes_;
    }

    size_t encode(const json& value, uint8_t* buffer, size_t offset, size_t buffer_size, bool unsafe = false) const {
        if (!unsafe) {
            validate(value);
        }
        
        if (offset + bytes_ > buffer_size) {
            throw parser_error("Buffer too small to encode Float" + std::to_string(bytes_ * 8));
        }
        
        if (bytes_ == 4) {
            float val = value.get<float>();
            std::memcpy(buffer + offset, &val, 4);
        } else {
            double val = value.get<double>();
            std::memcpy(buffer + offset, &val, 8);
        }
        return bytes_;
    }

    bool validate(const json& value) const {
        throw_if_nullish_json(value, "Float" + std::to_string(bytes_ * 8));
        
        if (!value.is_number()) {
            throw parser_error("Float" + std::to_string(bytes_ * 8) + " value must be a number");
        }
        
        double val = value.get<double>();
        if (!std::isfinite(val)) {
            throw parser_error("Float" + std::to_string(bytes_ * 8) + " value must be finite");
        }
        
        return true;
    }

    json to_json() const {
        return json{{"type", "Float"}, {"byte_length", bytes_}};
    }
};

// Primitive Types
class UInt8 : public UInt {
public:
    UInt8() : UInt(1) {}
    
    json to_json() const override {
        return json{{"type", "UInt8"}};
    }
};

class UInt16 : public UInt {
public:
    UInt16() : UInt(2) {}
    
    json to_json() const override {
        return json{{"type", "UInt16"}};
    }
};

class UInt32 : public UInt {
public:
    UInt32() : UInt(4) {}
    
    json to_json() const override {
        return json{{"type", "UInt32"}};
    }
};

class Int8 : public Int {
public:
    Int8() : Int(1) {}
    
    json to_json() const override {
        return json{{"type", "Int8"}};
    }
};

class Int16 : public Int {
public:
    Int16() : Int(2) {}
    
    json to_json() const override {
        return json{{"type", "Int16"}};
    }
};

class Int32 : public Int {
public:
    Int32() : Int(4) {}
    
    json to_json() const override {
        return json{{"type", "Int32"}};
    }
};

class Float32 : public Float {
public:
    Float32() : Float(4) {}
    
    json to_json() const override {
        return json{{"type", "Float32"}};
    }
};

class Float64 : public Float {
public:
    Float64() : Float(8) {}
    
    json to_json() const override {
        return json{{"type", "Float64"}};
    }
};



class BooleanType : public Type {
public:
    json deserialize(const uint8_t* buffer, size_t& offset, size_t buffer_size) const override {
        if (offset + 1 > buffer_size) {
            throw parser_error("Buffer too small to read BooleanType");
        }
        
        bool value = buffer[offset] != 0;
        offset += 1;
        return json(value);
    }

    size_t get_byte_length() const override {
        return 1;
    }

    bool is_static_length() const override {
        return true;
    }

    size_t calculate_byte_length(const json&) const override {
        return 1;
    }

    size_t encode(const json& value, uint8_t* buffer, size_t offset, size_t buffer_size, bool unsafe = false) const {
        if (!unsafe) {
            validate(value);
        }
        
        if (offset + 1 > buffer_size) {
            throw parser_error("Buffer too small to encode BooleanType");
        }
        
        buffer[offset] = value.get<bool>() ? 1 : 0;
        return 1;
    }

    bool validate(const json& value) const {
        throw_if_nullish_json(value, "BooleanType");
        
        if (!value.is_boolean()) {
            throw parser_error("BooleanType value must be a boolean");
        }
        
        return true;
    }

    json to_json() const {
        return json{{"type", "BooleanType"}};
    }
};

class Char : public Type {
public:
    json deserialize(const uint8_t* buffer, size_t& offset, size_t buffer_size) const override {
        if (offset + 1 > buffer_size) {
            throw parser_error("Buffer too small to read Char");
        }
        
        char c = static_cast<char>(buffer[offset]);
        offset += 1;
        return json(std::string(1, c));
    }

    size_t get_byte_length() const override {
        return 1;
    }

    bool is_static_length() const override {
        return true;
    }

    size_t calculate_byte_length(const json&) const override {
        return 1;
    }

    size_t encode(const json& value, uint8_t* buffer, size_t offset, size_t buffer_size, bool unsafe = false) const {
        if (!unsafe) {
            validate(value);
        }
        
        if (offset + 1 > buffer_size) {
            throw parser_error("Buffer too small to encode Char");
        }
        
        std::string str = value.get<std::string>();
        char c = str.empty() ? '\0' : str[0];
        buffer[offset] = static_cast<uint8_t>(c);
        return 1;
    }

    bool validate(const json& value) const {
        throw_if_nullish_json(value, "Char");
        
        if (!value.is_string()) {
            throw parser_error("Char value must be a string");
        }
        
        return true;
    }

    json to_json() const {
        return json{{"type", "Char"}};
    }
};

class FixedStringType : public Type {
private:
    size_t length_;

public:
    explicit FixedStringType(size_t length) : length_(length) {}

    json deserialize(const uint8_t* buffer, size_t& offset, size_t buffer_size) const override {
        if (offset + length_ > buffer_size) {
            throw parser_error("Buffer too small to read FixedStringType");
        }
        
        // Find null terminator or use full length
        size_t actual_length = 0;
        for (size_t i = 0; i < length_; ++i) {
            if (buffer[offset + i] == 0) {
                break;
            }
            actual_length++;
        }
        
        std::string value(reinterpret_cast<const char*>(buffer + offset), actual_length);
        offset += length_;
        return json(value);
    }

    size_t get_byte_length() const override {
        return length_;
    }

    bool is_static_length() const override {
        return true;
    }

    size_t calculate_byte_length(const json&) const override {
        return length_;
    }

    size_t encode(const json& value, uint8_t* buffer, size_t offset, size_t buffer_size, bool unsafe = false) const {
        if (!unsafe) {
            validate(value);
        }
        
        if (offset + length_ > buffer_size) {
            throw parser_error("Buffer too small to encode FixedStringType");
        }
        
        std::string str = value.get<std::string>();
        
        // Copy string data
        size_t copy_length = std::min(str.length(), length_);
        std::memcpy(buffer + offset, str.c_str(), copy_length);
        
        // Null-terminate if shorter than max length
        if (copy_length < length_) {
            std::memset(buffer + offset + copy_length, 0, length_ - copy_length);
        }
        
        return length_;
    }

    bool validate(const json& value) const {
        throw_if_nullish_json(value, "FixedStringType");
        
        if (!value.is_string()) {
            throw parser_error("FixedStringType value must be a string");
        }
        
        std::string str = value.get<std::string>();
        if (str.length() > length_) {
            throw parser_error("FixedStringType length exceeds fixed length: " + 
                             std::to_string(str.length()) + " > " + std::to_string(length_));
        }
        
        return true;
    }

    json to_json() const {
        return json{{"type", "FixedStringType"}, {"length", length_}};
    }
};

class VarStringType : public Type {
private:
    size_t max_length_;
    size_t header_size_;


public:
    explicit VarStringType(size_t max_length = 65535) : max_length_(max_length) {
        if (max_length < 1 || max_length > 4294967295UL) {
            throw std::invalid_argument("max_length must be between 1 and 4294967295");
        }
        header_size_ = max_length_ < 256 ? 1 : (max_length_ < 65536 ? 2 : 4);
    }

    size_t get_header_size() const {
        return header_size_;
    }

    json deserialize(const uint8_t* buffer, size_t& offset, size_t buffer_size) const override {
        size_t header_size = get_header_size();
        
        if (offset + header_size > buffer_size) {
            throw parser_error("Buffer too small to read string length");
        }
        
        size_t length;
        if (header_size == 1) {
            length = buffer[offset];
        } else if (header_size == 2) {
            length = buffer[offset] | (static_cast<size_t>(buffer[offset + 1]) << 8);
        } else {
            length = buffer[offset] | 
                    (static_cast<size_t>(buffer[offset + 1]) << 8) |
                    (static_cast<size_t>(buffer[offset + 2]) << 16) |
                    (static_cast<size_t>(buffer[offset + 3]) << 24);
        }
        
        if (offset + header_size + length > buffer_size) {
            throw parser_error("Buffer too small to read string of length " + std::to_string(length));
        }
        
        std::string value(reinterpret_cast<const char*>(buffer + offset + header_size), length);
        offset += header_size + length;
        return json(value);
    }

    size_t get_byte_length() const override {
        return 0; // Variable length
    }

    bool is_static_length() const override {
        return false;
    }

    size_t calculate_byte_length(const json& value) const override {
        if (!value.is_string()) {
            throw parser_error("VarStringType value must be a string");
        }
        
        std::string str = value.get<std::string>();
        return get_header_size() + str.length();
    }

    size_t encode(const json& value, uint8_t* buffer, size_t offset, size_t buffer_size, bool unsafe = false) const {
        if (!unsafe) {
            validate(value);
        }
        
        std::string str = value.get<std::string>();
        size_t header_size = get_header_size();
        size_t total_bytes = header_size + str.length();
        
        if (offset + total_bytes > buffer_size) {
            throw parser_error("Buffer too small to encode string. Required: " + 
                             std::to_string(total_bytes) + ", Available: " + 
                             std::to_string(buffer_size - offset));
        }
        
        // Write length prefix
        if (header_size == 1) {
            buffer[offset] = static_cast<uint8_t>(str.length());
        } else if (header_size == 2) {
            buffer[offset] = static_cast<uint8_t>(str.length() & 0xFF);
            buffer[offset + 1] = static_cast<uint8_t>((str.length() >> 8) & 0xFF);
        } else {
            buffer[offset] = static_cast<uint8_t>(str.length() & 0xFF);
            buffer[offset + 1] = static_cast<uint8_t>((str.length() >> 8) & 0xFF);
            buffer[offset + 2] = static_cast<uint8_t>((str.length() >> 16) & 0xFF);
            buffer[offset + 3] = static_cast<uint8_t>((str.length() >> 24) & 0xFF);
        }
        
        // Write string
        std::memcpy(buffer + offset + header_size, str.c_str(), str.length());
        
        return total_bytes;
    }

    bool validate(const json& value) const {
        throw_if_nullish_json(value, "VarStringType");
        
        if (!value.is_string()) {
            throw parser_error("VarStringType value must be a string");
        }
        
        std::string str = value.get<std::string>();
        if (str.length() > max_length_) {
            throw parser_error("VarStringType byte length exceeds maximum: " + 
                             std::to_string(str.length()) + " > " + std::to_string(max_length_));
        }
        
        // Check header size limits
        size_t max_header_value = get_header_size() == 1 ? 255 : 
                                 (get_header_size() == 2 ? 65535 : 4294967295UL);
        if (str.length() > max_header_value) {
            throw parser_error("VarStringType byte length exceeds header maximum: " + 
                             std::to_string(str.length()) + " > " + std::to_string(max_header_value));
        }
        
        return true;
    }

    json to_json() const {
        return json{{"type", "VarStringType"}, {"max_length", max_length_}};
    }
};

class VarBufferType : public Type {
private:
    size_t max_length_;
    size_t header_size_;

public:
    explicit VarBufferType(size_t max_length = 65535) : max_length_(max_length) {
        if (max_length < 1 || max_length > 4294967295UL) {
            throw std::invalid_argument("max_length must be between 1 and 4294967295");
        }
        header_size_ = max_length_ < 256 ? 1 : (max_length_ < 65536 ? 2 : 4);
    }

    size_t get_header_size() const {
        return header_size_;
    }

    json deserialize(const uint8_t* buffer, size_t& offset, size_t buffer_size) const override {
        size_t header_size = get_header_size();
        
        if (offset + header_size > buffer_size) {
            throw parser_error("Buffer too small to read buffer length");
        }
        
        size_t length;
        if (header_size == 1) {
            length = buffer[offset];
        } else if (header_size == 2) {
            length = buffer[offset] | (static_cast<size_t>(buffer[offset + 1]) << 8);
        } else {
            length = buffer[offset] | 
                    (static_cast<size_t>(buffer[offset + 1]) << 8) |
                    (static_cast<size_t>(buffer[offset + 2]) << 16) |
                    (static_cast<size_t>(buffer[offset + 3]) << 24);
        }
        
        if (offset + header_size + length > buffer_size) {
            throw parser_error("Buffer too small to read buffer of length " + std::to_string(length));
        }
        
        // Return buffer data as a JSON array of bytes
        json buffer_data = json::array();
        for (size_t i = 0; i < length; ++i) {
            buffer_data.push_back(static_cast<int>(buffer[offset + header_size + i]));
        }
        
        offset += header_size + length;
        return buffer_data;
    }

    size_t get_byte_length() const override {
        return 0; // Variable length
    }

    bool is_static_length() const override {
        return false;
    }

    size_t calculate_byte_length(const json& value) const override {
        if (!value.is_array()) {
            throw parser_error("VarBufferType value must be an array");
        }
        
        return get_header_size() + value.size();
    }

    size_t encode(const json& value, uint8_t* buffer, size_t offset, size_t buffer_size, bool unsafe = false) const {
        if (!unsafe) {
            validate(value);
        }
        
        if (!value.is_array()) {
            throw parser_error("VarBufferType value must be an array");
        }
        
        size_t length = value.size();
        size_t header_size = get_header_size();
        size_t total_bytes = header_size + length;
        
        if (offset + total_bytes > buffer_size) {
            throw parser_error("Buffer too small to encode buffer. Required: " + 
                             std::to_string(total_bytes) + ", Available: " + 
                             std::to_string(buffer_size - offset));
        }
        
        // Write length prefix
        if (header_size == 1) {
            buffer[offset] = static_cast<uint8_t>(length);
        } else if (header_size == 2) {
            buffer[offset] = static_cast<uint8_t>(length & 0xFF);
            buffer[offset + 1] = static_cast<uint8_t>((length >> 8) & 0xFF);
        } else {
            buffer[offset] = static_cast<uint8_t>(length & 0xFF);
            buffer[offset + 1] = static_cast<uint8_t>((length >> 8) & 0xFF);
            buffer[offset + 2] = static_cast<uint8_t>((length >> 16) & 0xFF);
            buffer[offset + 3] = static_cast<uint8_t>((length >> 24) & 0xFF);
        }
        
        // Write buffer data
        for (size_t i = 0; i < length; ++i) {
            if (!value[i].is_number_integer()) {
                throw parser_error("VarBufferType array elements must be integers (0-255)");
            }
            int byte_value = value[i].get<int>();
            if (byte_value < 0 || byte_value > 255) {
                throw parser_error("VarBufferType array elements must be in range 0-255, got " + std::to_string(byte_value));
            }
            buffer[offset + header_size + i] = static_cast<uint8_t>(byte_value);
        }
        
        return total_bytes;
    }

    bool validate(const json& value) const {
        throw_if_nullish_json(value, "VarBufferType");
        
        if (!value.is_array()) {
            throw parser_error("VarBufferType value must be an array");
        }
        
        if (value.size() > max_length_) {
            throw parser_error("VarBufferType byte length exceeds maximum: " + 
                             std::to_string(value.size()) + " > " + std::to_string(max_length_));
        }
        
        // Check header size limits
        size_t max_header_value = get_header_size() == 1 ? 255 : 
                                 (get_header_size() == 2 ? 65535 : 4294967295UL);
        if (value.size() > max_header_value) {
            throw parser_error("VarBufferType byte length exceeds header maximum: " + 
                             std::to_string(value.size()) + " > " + std::to_string(max_header_value));
        }
        
        // Validate each byte value
        for (size_t i = 0; i < value.size(); ++i) {
            if (!value[i].is_number_integer()) {
                throw parser_error("VarBufferType array element at index " + std::to_string(i) + " must be an integer");
            }
            int byte_value = value[i].get<int>();
            if (byte_value < 0 || byte_value > 255) {
                throw parser_error("VarBufferType array element at index " + std::to_string(i) + 
                                 " must be in range 0-255, got " + std::to_string(byte_value));
            }
        }
        
        return true;
    }

    json to_json() const {
        return json{{"type", "VarBufferType"}, {"max_length", max_length_}};
    }
};

class JSONType : public Type {
private:
    size_t max_length_;
    size_t header_size_;

public:
    explicit JSONType(size_t max_length = 65535) : max_length_(max_length) {
        if (max_length < 1 || max_length > 4294967295UL) {
            throw std::invalid_argument("max_length must be between 1 and 4294967295");
        }
        header_size_ = max_length_ < 256 ? 1 : (max_length_ < 65536 ? 2 : 4);
    }

    size_t get_header_size() const {
        return header_size_;
    }

    json deserialize(const uint8_t* buffer, size_t& offset, size_t buffer_size) const override {
        size_t header_size = get_header_size();
        
        if (offset + header_size > buffer_size) {
            throw parser_error("Buffer too small to read JSON string length");
        }
        
        size_t length;
        if (header_size == 1) {
            length = buffer[offset];
        } else if (header_size == 2) {
            length = buffer[offset] | (static_cast<size_t>(buffer[offset + 1]) << 8);
        } else {
            length = buffer[offset] | 
                    (static_cast<size_t>(buffer[offset + 1]) << 8) |
                    (static_cast<size_t>(buffer[offset + 2]) << 16) |
                    (static_cast<size_t>(buffer[offset + 3]) << 24);
        }
        
        if (offset + header_size + length > buffer_size) {
            throw parser_error("Buffer too small to read JSON string of length " + std::to_string(length));
        }
        
        std::string json_string(reinterpret_cast<const char*>(buffer + offset + header_size), length);
        offset += header_size + length;
        
        try {
            return json::parse(json_string);
        } catch (const json::parse_error& e) {
            throw parser_error("Invalid JSON string: " + std::string(e.what()));
        }
    }

    size_t get_byte_length() const override {
        return 0; // Variable length
    }

    bool is_static_length() const override {
        return false;
    }

    size_t calculate_byte_length(const json& value) const override {
        std::string json_string = value.dump();
        return get_header_size() + json_string.length();
    }

    size_t encode(const json& value, uint8_t* buffer, size_t offset, size_t buffer_size, bool unsafe = false) const {
        std::string json_string = value.dump();
        
        if (!unsafe) {
            validate_json_string(json_string);
        }
        
        size_t header_size = get_header_size();
        size_t total_bytes = header_size + json_string.length();
        
        if (offset + total_bytes > buffer_size) {
            throw parser_error("Buffer too small to encode JSON. Required: " + 
                             std::to_string(total_bytes) + ", Available: " + 
                             std::to_string(buffer_size - offset));
        }
        
        // Write length prefix
        if (header_size == 1) {
            buffer[offset] = static_cast<uint8_t>(json_string.length());
        } else if (header_size == 2) {
            buffer[offset] = static_cast<uint8_t>(json_string.length() & 0xFF);
            buffer[offset + 1] = static_cast<uint8_t>((json_string.length() >> 8) & 0xFF);
        } else {
            buffer[offset] = static_cast<uint8_t>(json_string.length() & 0xFF);
            buffer[offset + 1] = static_cast<uint8_t>((json_string.length() >> 8) & 0xFF);
            buffer[offset + 2] = static_cast<uint8_t>((json_string.length() >> 16) & 0xFF);
            buffer[offset + 3] = static_cast<uint8_t>((json_string.length() >> 24) & 0xFF);
        }
        
        // Write JSON string
        std::memcpy(buffer + offset + header_size, json_string.c_str(), json_string.length());
        
        return total_bytes;
    }

    bool validate(const json& value) const {
        // Any valid JSON value is acceptable for JSONType
        std::string json_string = value.dump();
        validate_json_string(json_string);
        return true;
    }

private:
    void validate_json_string(const std::string& json_string) const {
        if (json_string.length() > max_length_) {
            throw parser_error("JSONType byte length exceeds maximum: " + 
                             std::to_string(json_string.length()) + " > " + std::to_string(max_length_));
        }
        
        // Check header size limits
        size_t max_header_value = get_header_size() == 1 ? 255 : 
                                 (get_header_size() == 2 ? 65535 : 4294967295UL);
        if (json_string.length() > max_header_value) {
            throw parser_error("JSONType byte length exceeds header maximum: " + 
                             std::to_string(json_string.length()) + " > " + std::to_string(max_header_value));
        }
    }

public:
    json to_json() const {
        return json{{"type", "JSONType"}, {"max_length", max_length_}};
    }
};

class ArrayType : public Type {
private:
    std::unique_ptr<Type> element_type_;
    size_t fixed_length_;
    bool is_variable_length_;

public:
    ArrayType(std::unique_ptr<Type> element_type, size_t fixed_length = 0, bool is_variable_length = true) 
        : element_type_(std::move(element_type)), fixed_length_(fixed_length), is_variable_length_(is_variable_length) {}

    json deserialize(const uint8_t* buffer, size_t& offset, size_t buffer_size) const override {
        json arr = json::array();
        
        if (is_variable_length_) {
            // Variable-length array: read length prefix first
            if (offset + 4 > buffer_size) {
                throw parser_error("Buffer too small to read array length");
            }
            
            size_t array_length = buffer[offset] | 
                                (static_cast<size_t>(buffer[offset + 1]) << 8) |
                                (static_cast<size_t>(buffer[offset + 2]) << 16) |
                                (static_cast<size_t>(buffer[offset + 3]) << 24);
            offset += 4;
            
            for (size_t i = 0; i < array_length; ++i) {
                arr.push_back(element_type_->deserialize(buffer, offset, buffer_size));
            }
        } else {
            // Fixed-length array
            for (size_t i = 0; i < fixed_length_; ++i) {
                arr.push_back(element_type_->deserialize(buffer, offset, buffer_size));
            }
        }
        
        return arr;
    }

    size_t get_byte_length() const override {
        if (is_variable_length_) {
            return 0; // Variable length
        }
        if (element_type_->get_byte_length() == 0) {
            return 0; // Variable length elements
        }
        return element_type_->get_byte_length() * fixed_length_;
    }

    bool is_static_length() const override {
        return !is_variable_length_ && element_type_->is_static_length();
    }

    size_t calculate_byte_length(const json& value) const override {
        if (!value.is_array()) {
            throw parser_error("ArrayType value must be an array");
        }
        
        size_t total_length = 0;
        
        // Add header for variable-length arrays
        if (is_variable_length_) {
            total_length += 4; // UInt32 length prefix
        }
        
        // Calculate total size of all elements
        for (const auto& element : value) {
            total_length += element_type_->calculate_byte_length(element);
        }
        
        return total_length;
    }

    size_t encode(const json& value, uint8_t* buffer, size_t offset, size_t buffer_size, bool unsafe = false) const {
        if (!unsafe) {
            validate(value);
        }
        
        size_t start_offset = offset;
        
        if (is_variable_length_) {
            // Variable-length array: write length prefix, then elements
            if (offset + 4 > buffer_size) {
                throw parser_error("Buffer too small to encode array length");
            }
            
            size_t array_length = value.size();
            buffer[offset] = static_cast<uint8_t>(array_length & 0xFF);
            buffer[offset + 1] = static_cast<uint8_t>((array_length >> 8) & 0xFF);
            buffer[offset + 2] = static_cast<uint8_t>((array_length >> 16) & 0xFF);
            buffer[offset + 3] = static_cast<uint8_t>((array_length >> 24) & 0xFF);
            offset += 4;
            
            // Write each element
            for (const auto& element : value) {
                size_t bytes_written = element_type_->encode(element, buffer, offset, buffer_size, false);
                offset += bytes_written;
            }
        } else {
            // Fixed-length array
            for (size_t i = 0; i < fixed_length_; ++i) {
                size_t bytes_written = element_type_->encode(value[i], buffer, offset, buffer_size, false);
                offset += bytes_written;
            }
        }
        
        return offset - start_offset;
    }

    bool validate(const json& value) const {
        throw_if_nullish_json(value, "ArrayType");
        
        if (!value.is_array()) {
            throw parser_error("ArrayType value must be an array");
        }
        
        // For fixed-length arrays, check length matches
        if (!is_variable_length_ && value.size() != fixed_length_) {
            throw parser_error("ArrayType length mismatch: expected " + 
                             std::to_string(fixed_length_) + ", got " + std::to_string(value.size()));
        }
        
        // Validate each element in the array
        for (size_t i = 0; i < value.size(); ++i) {
            try {
                element_type_->validate(value[i]);
            } catch (const parser_error& error) {
                throw parser_error("ArrayType element at index " + std::to_string(i) + 
                                 " is invalid: " + error.what());
            }
        }
        
        return true;
    }

    json to_json() const {
        json result = json::object();
        result["type"] = "ArrayType";
        result["element_type"] = element_type_->to_json();
        if (is_variable_length_) {
            result["length"] = nullptr;
        } else {
            result["length"] = fixed_length_;
        }
        return result;
    }
};

class TupleType : public Type {
private:
    std::vector<std::unique_ptr<Type>> element_types_;

public:
    // C++11 compatible constructor - use explicit vector constructor
    explicit TupleType(std::vector<std::unique_ptr<Type>> element_types) 
        : element_types_(std::move(element_types)) {}

    json deserialize(const uint8_t* buffer, size_t& offset, size_t buffer_size) const override {
        json tuple = json::array();
        
        for (const auto& element_type : element_types_) {
            tuple.push_back(element_type->deserialize(buffer, offset, buffer_size));
        }
        
        return tuple;
    }

    size_t get_byte_length() const override {
        size_t total_length = 0;
        for (const auto& element_type : element_types_) {
            if (element_type->get_byte_length() == 0) {
                return 0; // Variable length tuple if any element is variable
            }
            total_length += element_type->get_byte_length();
        }
        return total_length;
    }

    bool is_static_length() const override {
        // TupleType is static only if ALL elements are static
        for (const auto& element_type : element_types_) {
            if (!element_type->is_static_length()) {
                return false;
            }
        }
        return true;
    }

    size_t calculate_byte_length(const json& value) const override {
        if (!value.is_array()) {
            throw parser_error("TupleType value must be an array");
        }
        
        if (value.size() != element_types_.size()) {
            throw parser_error("TupleType length mismatch: expected " + 
                             std::to_string(element_types_.size()) + ", got " + std::to_string(value.size()));
        }

        size_t total_length = 0;
        for (size_t i = 0; i < element_types_.size(); ++i) {
            total_length += element_types_[i]->calculate_byte_length(value[i]);
        }
        
        return total_length;
    }

    size_t encode(const json& value, uint8_t* buffer, size_t offset, size_t buffer_size, bool unsafe = false) const override {
        if (!unsafe) {
            validate(value);
        }
        
        size_t start_offset = offset;
        for (size_t i = 0; i < element_types_.size(); ++i) {
            size_t bytes_written = element_types_[i]->encode(value[i], buffer, offset, buffer_size, false);
            offset += bytes_written;
        }
        
        return offset - start_offset;
    }

    bool validate(const json& value) const {
        throw_if_nullish_json(value, "TupleType");
        
        if (!value.is_array()) {
            throw parser_error("TupleType value must be an array");
        }
        
        if (value.size() != element_types_.size()) {
            throw parser_error("TupleType length mismatch: expected " + 
                             std::to_string(element_types_.size()) + ", got " + std::to_string(value.size()));
        }
        
        // Validate each element in the tuple
        for (size_t i = 0; i < element_types_.size(); ++i) {
            try {
                element_types_[i]->validate(value[i]);
            } catch (const parser_error& error) {
                throw parser_error("TupleType element at index " + std::to_string(i) + 
                                 " is invalid: " + error.what());
            }
        }
        
        return true;
    }

    json to_json() const {
        json element_types_json = json::array();
        for (const auto& element_type : element_types_) {
            element_types_json.push_back(element_type->to_json());
        }
        
        return json{{"type", "TupleType"}, {"element_types", element_types_json}};
    }
};

class MapType : public Type {
private:
    std::vector<std::pair<std::string, std::unique_ptr<Type>>> fields_;
    std::map<std::string, Type*> field_lookup_;

public:
    explicit MapType(std::vector<std::pair<std::string, std::unique_ptr<Type>>> fields) 
        : fields_(std::move(fields)) {
        // Build lookup map
        for (const auto& field : fields_) {
            field_lookup_[field.first] = field.second.get();
        }
    }

    json deserialize(const uint8_t* buffer, size_t& offset, size_t buffer_size) const override {
        json map = json::object();
        
        for (const auto& field : fields_) {
            map[field.first] = field.second->deserialize(buffer, offset, buffer_size);
        }
        
        return map;
    }

    size_t get_byte_length() const override {
        size_t total_length = 0;
        for (const auto& field : fields_) {
            if (field.second->get_byte_length() == 0) {
                return 0; // Variable length map if any field is variable
            }
            total_length += field.second->get_byte_length();
        }
        return total_length;
    }

    bool is_static_length() const override {
        // MapType is static only if ALL fields are static
        for (const auto& field : fields_) {
            if (!field.second->is_static_length()) {
                return false;
            }
        }
        return true;
    }

    size_t calculate_byte_length(const json& value) const override {
        if (!value.is_object()) {
            throw parser_error("MapType value must be an object");
        }

        size_t total_length = 0;
        for (const auto& field : fields_) {
            try {
                total_length += field.second->calculate_byte_length(value[field.first]);
            } catch (const parser_error& error) {
                throw parser_error("MapType field '" + field.first + "' is invalid: " + error.what());
            }
        }
        
        return total_length;
    }

    size_t encode(const json& value, uint8_t* buffer, size_t offset, size_t buffer_size, bool unsafe = false) const override {
        if (!unsafe) {
            validate(value);
        }
        
        size_t start_offset = offset;
        for (const auto& field : fields_) {
            size_t bytes_written = field.second->encode(value[field.first], buffer, offset, buffer_size, unsafe);
            offset += bytes_written;
        }
        
        return offset - start_offset;
    }

    bool validate(const json& value) const {
        throw_if_nullish_json(value, "MapType");
        
        if (!value.is_object()) {
            throw parser_error("MapType value must be an object");
        }
        
        // Validate each field in the map
        for (const auto& field : fields_) {
            try {
                field.second->validate(value[field.first]);
            } catch (const parser_error& error) {
                throw parser_error("MapType field '" + field.first + "' is invalid: " + error.what());
            }
        }
        
        return true;
    }

    json to_json() const {
        json field_pairs = json::array();
        for (const auto& field : fields_) {
            field_pairs.push_back(json::array({field.first, field.second->to_json()}));
        }
        
        return json{{"type", "MapType"}, {"field_pairs", field_pairs}};
    }
};

class EnumType : public Type {
private:
    std::vector<std::string> options_;
    size_t value_size_;

public:
    explicit EnumType(const std::vector<std::string>& options) : options_(options) {
        if (options.empty()) {
            throw std::invalid_argument("EnumType options cannot be empty");
        }
        value_size_ = options.size() <= 256 ? 1 : (options.size() <= 65536 ? 2 : 4);
    }

    json deserialize(const uint8_t* buffer, size_t& offset, size_t buffer_size) const override {
        if (offset + value_size_ > buffer_size) {
            throw parser_error("Buffer too small to read EnumType");
        }
        
        size_t index;
        if (value_size_ == 1) {
            index = buffer[offset];
        } else if (value_size_ == 2) {
            index = buffer[offset] | (static_cast<size_t>(buffer[offset + 1]) << 8);
        } else {
            index = buffer[offset] | 
                   (static_cast<size_t>(buffer[offset + 1]) << 8) |
                   (static_cast<size_t>(buffer[offset + 2]) << 16) |
                   (static_cast<size_t>(buffer[offset + 3]) << 24);
        }
        
        if (index >= options_.size()) {
            throw parser_error("EnumType index out of range: " + std::to_string(index) + 
                             " >= " + std::to_string(options_.size()));
        }
        
        offset += value_size_;
        return json(options_[index]);
    }

    size_t get_byte_length() const override {
        return value_size_;
    }

    bool is_static_length() const override {
        return true;
    }

    size_t calculate_byte_length(const json&) const override {
        return value_size_;
    }

    size_t encode(const json& value, uint8_t* buffer, size_t offset, size_t buffer_size, bool unsafe = false) const override {
        if (!unsafe) {
            validate(value);
        }
        
        if (offset + value_size_ > buffer_size) {
            throw parser_error("Buffer too small to encode EnumType");
        }
        
        std::string str = value.get<std::string>();
        auto it = std::find(options_.begin(), options_.end(), str);
        if (!unsafe && it == options_.end()) {
            throw parser_error("EnumType value not found: " + str);
        }
        
        size_t index = std::distance(options_.begin(), it);
        
        if (value_size_ == 1) {
            buffer[offset] = static_cast<uint8_t>(index);
        } else if (value_size_ == 2) {
            buffer[offset] = static_cast<uint8_t>(index & 0xFF);
            buffer[offset + 1] = static_cast<uint8_t>((index >> 8) & 0xFF);
        } else {
            buffer[offset] = static_cast<uint8_t>(index & 0xFF);
            buffer[offset + 1] = static_cast<uint8_t>((index >> 8) & 0xFF);
            buffer[offset + 2] = static_cast<uint8_t>((index >> 16) & 0xFF);
            buffer[offset + 3] = static_cast<uint8_t>((index >> 24) & 0xFF);
        }
        
        return value_size_;
    }

    bool validate(const json& value) const {
        throw_if_nullish_json(value, "EnumType");
        
        if (!value.is_string()) {
            throw parser_error("EnumType value must be a string");
        }
        
        std::string str = value.get<std::string>();
        auto it = std::find(options_.begin(), options_.end(), str);
        if (it == options_.end()) {
            std::string valid_options;
            for (size_t i = 0; i < options_.size(); ++i) {
                if (i > 0) valid_options += ", ";
                valid_options += options_[i];
            }
            throw parser_error("EnumType value not found: " + str + ". Valid options: " + valid_options);
        }
        
        return true;
    }

    json to_json() const {
        return json{{"type", "EnumType"}, {"options", options_}};
    }
};

class OptionalType : public Type {
private:
    std::unique_ptr<Type> base_type_;

public:
    explicit OptionalType(std::unique_ptr<Type> base_type) : base_type_(std::move(base_type)) {}

    json deserialize(const uint8_t* buffer, size_t& offset, size_t buffer_size) const override {
        if (offset + 1 > buffer_size) {
            throw parser_error("Buffer too small to read OptionalType presence flag");
        }
        
        bool is_present = buffer[offset] != 0;
        offset += 1;
        
        if (!is_present) {
            if (!base_type_->is_static_length()) {
                // Variable-length base type - null only consumes 1 byte
                return json(nullptr);
            } else {
                // Fixed-length base type - always consume full space for alignment
                offset += base_type_->get_byte_length();
                return json(nullptr);
            }
        }
        
        return base_type_->deserialize(buffer, offset, buffer_size);
    }

    size_t get_byte_length() const override {
        if (!base_type_->is_static_length()) {
            return 0; // Variable length if base type is variable
        }
        return 1 + base_type_->get_byte_length();
    }

    bool is_static_length() const override {
        return base_type_->is_static_length();
    }

    size_t calculate_byte_length(const json& value) const override {
        if (value.is_null()) {
            if (!base_type_->is_static_length()) {
                // Variable-length base type - null only takes 1 byte
                return 1;
            } else {
                // Fixed-length base type - always consume full space for alignment
                return 1 + base_type_->get_byte_length();
            }
        }
        return 1 + base_type_->calculate_byte_length(value);
    }

    size_t encode(const json& value, uint8_t* buffer, size_t offset, size_t buffer_size, bool unsafe = false) const override {
        if (!unsafe) {
            validate(value);
        }
        
        if (offset + 1 > buffer_size) {
            throw parser_error("Buffer too small to encode OptionalType presence flag");
        }
        
        if (value.is_null()) {
            buffer[offset] = 0;
            if (!base_type_->is_static_length()) {
                // Variable-length base type - null only takes 1 byte
                return 1;
            } else {
                // Fixed-length base type - always consume full space for alignment
                // Fill with zeros (though they won't be read)
                std::memset(buffer + offset + 1, 0, base_type_->get_byte_length());
                return 1 + base_type_->get_byte_length();
            }
        } else {
            buffer[offset] = 1;
            if (!base_type_->is_static_length()) {
                // Variable-length base type - encode returns bytes written
                size_t bytes_written = base_type_->encode(value, buffer, offset + 1, buffer_size, false);
                return 1 + bytes_written;
            } else {
                // Fixed-length base type
                base_type_->encode(value, buffer, offset + 1, buffer_size, false);
                return 1 + base_type_->get_byte_length();
            }
        }
    }

    bool validate(const json& value) const {
        // null is always valid for OptionalType
        if (value.is_null()) {
            return true;
        }
        
        // If value is present, validate it against the base type
        return base_type_->validate(value);
    }

    json to_json() const {
        return json{{"type", "OptionalType"}, {"base_type", base_type_->to_json()}};
    }
};

// Schema class
class Schema {
private:
    std::unique_ptr<Type> type_;

public:
    explicit Schema(const json& schema_json) {
        type_ = Type::from_json(schema_json);
    }
    
    explicit Schema(std::unique_ptr<Type> type) : type_(std::move(type)) {}
    
    json deserialize(const std::vector<uint8_t>& buffer, size_t offset = 0) const {
        size_t pos = offset;
        return type_->deserialize(buffer.data(), pos, buffer.size());
    }
    
    json deserialize(const uint8_t* buffer, size_t buffer_size, size_t offset = 0) const {
        size_t pos = offset;
        return type_->deserialize(buffer, pos, buffer_size);
    }
    
    std::vector<uint8_t> serialize(const json& value, bool unsafe = false) const {
        size_t total_size = type_->calculate_byte_length(value);
        std::vector<uint8_t> buffer(total_size);
        size_t bytes_written = type_->encode(value, buffer.data(), 0, buffer.size(), unsafe);
        buffer.resize(bytes_written); // In case actual size differs
        return buffer;
    }
    
    size_t serialize_into(const json& value, uint8_t* buffer, size_t buffer_size, size_t offset = 0, bool unsafe = false) const {
        return type_->encode(value, buffer, offset, buffer_size, unsafe);
    }
    
    size_t get_byte_length() const {
        return type_->get_byte_length();
    }
    
    bool is_static_length() const {
        return type_->is_static_length();
    }
    
    size_t calculate_byte_length(const json& value) const {
        return type_->calculate_byte_length(value);
    }
    
    bool validate(const json& value) const {
        return type_->validate(value);
    }
    
    json to_json() const {
        return type_->to_json();
    }
};

// Type factory implementation
inline std::unique_ptr<Type> Type::from_json(const json& type_def) {
    if (!type_def.contains("type") || !type_def["type"].is_string()) {
        throw std::invalid_argument("Type definition must contain a 'type' field");
    }
    
    std::string type_name = type_def["type"];
    
    if (type_name == "UInt") {
        if (!type_def.contains("byte_length")) {
            throw std::invalid_argument("UInt type requires 'byte_length' field");
        }
        return make_unique_ptr<UInt>(type_def["byte_length"]);
    } else if (type_name == "Int") {
        if (!type_def.contains("byte_length")) {
            throw std::invalid_argument("Int type requires 'byte_length' field");
        }
        return make_unique_ptr<Int>(type_def["byte_length"]);
    } else if (type_name == "Float") {
        if (!type_def.contains("byte_length")) {
            throw std::invalid_argument("Float type requires 'byte_length' field");
        }
        return make_unique_ptr<Float>(type_def["byte_length"]);
    } else if (type_name == "UInt8") {
        return make_unique_ptr<UInt8>();
    } else if (type_name == "UInt16") {
        return make_unique_ptr<UInt16>();
    } else if (type_name == "UInt32") {
        return make_unique_ptr<UInt32>();
    } else if (type_name == "Int8") {
        return make_unique_ptr<Int8>();
    } else if (type_name == "Int16") {
        return make_unique_ptr<Int16>();
    } else if (type_name == "Int32") {
        return make_unique_ptr<Int32>();
    } else if (type_name == "Float32") {
        return make_unique_ptr<Float32>();
    } else if (type_name == "Float64") {
        return make_unique_ptr<Float64>();
    } else if (type_name == "BooleanType") {
        return make_unique_ptr<BooleanType>();
    } else if (type_name == "Char") {
        return make_unique_ptr<Char>();
    } else if (type_name == "ArrayType") {
        if (!type_def.contains("element_type")) {
            throw std::invalid_argument("ArrayType requires 'element_type' field");
        }
        auto element_type = from_json(type_def["element_type"]);
        if (type_def.contains("length") && !type_def["length"].is_null()) {
            size_t length = type_def["length"];
            return make_unique_ptr<ArrayType>(std::move(element_type), length, false);
        } else {
            return make_unique_ptr<ArrayType>(std::move(element_type), 0, true);
        }
    } else if (type_name == "FixedStringType") {
        if (!type_def.contains("length")) {
            throw std::invalid_argument("FixedStringType requires 'length' field");
        }
        return make_unique_ptr<FixedStringType>(type_def["length"]);
    } else if (type_name == "VarStringType") {
        size_t max_length = 65535; // default
        if (type_def.contains("max_length")) {
            max_length = type_def["max_length"];
        }
        return make_unique_ptr<VarStringType>(max_length);
    } else if (type_name == "VarBufferType") {
        size_t max_length = 65535; // default
        if (type_def.contains("max_length")) {
            max_length = type_def["max_length"];
        }
        return make_unique_ptr<VarBufferType>(max_length);
    } else if (type_name == "JSONType") {
        size_t max_length = 65535; // default
        if (type_def.contains("max_length")) {
            max_length = type_def["max_length"];
        }
        return make_unique_ptr<JSONType>(max_length);
    } else if (type_name == "EnumType") {
        if (!type_def.contains("options")) {
            throw std::invalid_argument("EnumType requires 'options' field");
        }
        std::vector<std::string> options = type_def["options"];
        return make_unique_ptr<EnumType>(options);
    } else if (type_name == "OptionalType") {
        if (!type_def.contains("base_type")) {
            throw std::invalid_argument("OptionalType requires 'base_type' field");
        }
        auto base_type = from_json(type_def["base_type"]);
        return make_unique_ptr<OptionalType>(std::move(base_type));
    } else if (type_name == "TupleType") {
        if (!type_def.contains("element_types")) {
            throw std::invalid_argument("TupleType requires 'element_types' field");
        }
        std::vector<std::unique_ptr<Type>> element_types;
        for (const auto& element_type_def : type_def["element_types"]) {
            element_types.push_back(from_json(element_type_def));
        }
        return make_unique_ptr<TupleType>(std::move(element_types));
    } else if (type_name == "MapType") {
        if (!type_def.contains("field_pairs")) {
            throw std::invalid_argument("MapType requires 'field_pairs' field");
        }
        std::vector<std::pair<std::string, std::unique_ptr<Type>>> fields;
        for (const auto& field_pair : type_def["field_pairs"]) {
            if (!field_pair.is_array() || field_pair.size() != 2) {
                throw std::invalid_argument("MapType field_pairs must be arrays of [key, type]");
            }
            std::string key = field_pair[0];
            auto field_type = from_json(field_pair[1]);
            fields.push_back(std::make_pair(key, std::move(field_type)));
        }
        return make_unique_ptr<MapType>(std::move(fields));
    } else {
        throw std::invalid_argument("Unknown type: " + type_name);
    }
}

} // namespace obj2buf
