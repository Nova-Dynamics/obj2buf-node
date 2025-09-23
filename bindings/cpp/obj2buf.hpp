#pragma once

/*
 * obj2buf C++ Bindings v1.0.0
 * 
 * Header-only C++11 library for deserializing binary data created by obj2buf JavaScript library.
 * Compatible with obj2buf JavaScript library v1.0.0+
 * 
 * GitHub: https://github.com/Nova-Dynamics/obj2buf-node
 * License: ISC
 */

#define OBJ2BUF_VERSION_MAJOR 1
#define OBJ2BUF_VERSION_MINOR 0
#define OBJ2BUF_VERSION_PATCH 0
#define OBJ2BUF_VERSION "1.0.0"

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
    virtual size_t calculate_byte_length(const json& value) const = 0;
    
    static std::unique_ptr<Type> from_json(const json& type_def);
};

// Unified Types
class UInt : public Type {
private:
    size_t bytes_;

public:
    // TODO: Implement methods
};

class Int : public Type {
private:
    size_t bytes_;

public:
    // TODO: Implement methods
};

class Float : public Type {
private:
    size_t bytes_;

public:
    // TODO: Implement methods
};

// Primitive Types
class UInt8 : public UInt {
public:
    // TODO: Implement methods
};

class UInt16 : public UInt {
public:
    // TODO: Implement methods
};

class UInt32 : public UInt {
public:
    // TODO: Implement methods
};

class Int8 : public Int {
public:
    // TODO: Implement methods
};

class Int16 : public Int {
public:
    // TODO: Implement methods
};

class Int32 : public Int {
public:
    // TODO: Implement methods
};

class Float32 : public Float {
public:
    // TODO: Implement methods
};

class Float64 : public Float {
public:
    // TODO: Implement methods
};



class BooleanType : public Type {
public:
    // TODO: Implement methods
};

class Char : public Type {
public:
    // TODO: Implement methods
};

class FixedStringType : public Type {
private:
    size_t length_;

public:
    explicit FixedStringType(size_t length) : length_(length) {}
    // TODO: Implement methods
};

class VarStringType : public Type {
private:
    size_t max_length_;

public:
    // TODO: Implement methods
};

class ArrayType : public Type {
private:
    std::unique_ptr<Type> element_type_;
    size_t fixed_length_;
    bool is_variable_length_;

public:
    // TODO: Implement methods
};

class TupleType : public Type {
private:
    std::vector<std::unique_ptr<Type>> element_types_;

public:
    // TODO: Implement methods
};

class MapType : public Type {
private:
    std::vector<std::pair<std::string, std::unique_ptr<Type>>> fields_;

public:
    // TODO: Implement methods
};

class EnumType : public Type {
private:
    std::vector<std::string> options_;
    size_t value_size_;

public:
    // TODO: Implement methods
};

class OptionalType : public Type {
private:
    std::unique_ptr<Type> base_type_;

public:
    // TODO: Implement methods
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
    
    size_t get_byte_length() const {
        return type_->get_byte_length();
    }
    
    bool is_static_length() const {
        return type_->is_static_length();
    }
    
    size_t calculate_byte_length(const json& value) const {
        return type_->calculate_byte_length(value);
    }
};

// Type factory implementation
std::unique_ptr<Type> Type::from_json(const json& type_def) {
    // TODO : Implement factory logic based on type_def
}

} // namespace obj2buf
