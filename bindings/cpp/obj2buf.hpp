#pragma once

#include <nlohmann/json.hpp>
#include <string>
#include <vector>
#include <cstring>
#include <stdexcept>
#include <memory>
#include <map>

namespace obj2buf {

using json = nlohmann::json;

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

// Primitive Types
class UInt8 : public Type {
public:
    json deserialize(const uint8_t* buffer, size_t& offset, size_t buffer_size) const override {
        if (offset >= buffer_size) {
            throw parser_error("Buffer underflow reading UInt8");
        }
        uint8_t value = buffer[offset++];
        return json(static_cast<uint32_t>(value));
    }
    
    size_t get_byte_length() const override { return 1; }
    bool is_static_length() const override { return true; }
    size_t calculate_byte_length(const json&) const override { return 1; }
};

class UInt16 : public Type {
public:
    json deserialize(const uint8_t* buffer, size_t& offset, size_t buffer_size) const override {
        if (offset + 2 > buffer_size) {
            throw parser_error("Buffer underflow reading UInt16");
        }
        uint16_t value = buffer[offset] | (buffer[offset + 1] << 8);
        offset += 2;
        return json(static_cast<uint32_t>(value));
    }
    
    size_t get_byte_length() const override { return 2; }
    bool is_static_length() const override { return true; }
    size_t calculate_byte_length(const json&) const override { return 2; }
};

class UInt32 : public Type {
public:
    json deserialize(const uint8_t* buffer, size_t& offset, size_t buffer_size) const override {
        if (offset + 4 > buffer_size) {
            throw parser_error("Buffer underflow reading UInt32");
        }
        uint32_t value = buffer[offset] | (buffer[offset + 1] << 8) | 
                        (buffer[offset + 2] << 16) | (buffer[offset + 3] << 24);
        offset += 4;
        return json(value);
    }
    
    size_t get_byte_length() const override { return 4; }
    bool is_static_length() const override { return true; }
    size_t calculate_byte_length(const json&) const override { return 4; }
};

class Int8 : public Type {
public:
    json deserialize(const uint8_t* buffer, size_t& offset, size_t buffer_size) const override {
        if (offset >= buffer_size) {
            throw parser_error("Buffer underflow reading Int8");
        }
        int8_t value = static_cast<int8_t>(buffer[offset++]);
        return json(static_cast<int32_t>(value));
    }
    
    size_t get_byte_length() const override { return 1; }
    bool is_static_length() const override { return true; }
    size_t calculate_byte_length(const json&) const override { return 1; }
};

class Int16 : public Type {
public:
    json deserialize(const uint8_t* buffer, size_t& offset, size_t buffer_size) const override {
        if (offset + 2 > buffer_size) {
            throw parser_error("Buffer underflow reading Int16");
        }
        int16_t value = static_cast<int16_t>(buffer[offset] | (buffer[offset + 1] << 8));
        offset += 2;
        return json(static_cast<int32_t>(value));
    }
    
    size_t get_byte_length() const override { return 2; }
    bool is_static_length() const override { return true; }
    size_t calculate_byte_length(const json&) const override { return 2; }
};

class Int32 : public Type {
public:
    json deserialize(const uint8_t* buffer, size_t& offset, size_t buffer_size) const override {
        if (offset + 4 > buffer_size) {
            throw parser_error("Buffer underflow reading Int32");
        }
        int32_t value = static_cast<int32_t>(buffer[offset] | (buffer[offset + 1] << 8) | 
                                           (buffer[offset + 2] << 16) | (buffer[offset + 3] << 24));
        offset += 4;
        return json(value);
    }
    
    size_t get_byte_length() const override { return 4; }
    bool is_static_length() const override { return true; }
    size_t calculate_byte_length(const json&) const override { return 4; }
};

class Float32 : public Type {
public:
    json deserialize(const uint8_t* buffer, size_t& offset, size_t buffer_size) const override {
        if (offset + 4 > buffer_size) {
            throw parser_error("Buffer underflow reading Float32");
        }
        uint32_t bits = buffer[offset] | (buffer[offset + 1] << 8) | 
                       (buffer[offset + 2] << 16) | (buffer[offset + 3] << 24);
        float value;
        std::memcpy(&value, &bits, sizeof(float));
        offset += 4;
        return json(static_cast<double>(value));
    }
    
    size_t get_byte_length() const override { return 4; }
    bool is_static_length() const override { return true; }
    size_t calculate_byte_length(const json&) const override { return 4; }
};

class Float64 : public Type {
public:
    json deserialize(const uint8_t* buffer, size_t& offset, size_t buffer_size) const override {
        if (offset + 8 > buffer_size) {
            throw parser_error("Buffer underflow reading Float64");
        }
        uint64_t bits = static_cast<uint64_t>(buffer[offset]) | 
                       (static_cast<uint64_t>(buffer[offset + 1]) << 8) |
                       (static_cast<uint64_t>(buffer[offset + 2]) << 16) |
                       (static_cast<uint64_t>(buffer[offset + 3]) << 24) |
                       (static_cast<uint64_t>(buffer[offset + 4]) << 32) |
                       (static_cast<uint64_t>(buffer[offset + 5]) << 40) |
                       (static_cast<uint64_t>(buffer[offset + 6]) << 48) |
                       (static_cast<uint64_t>(buffer[offset + 7]) << 56);
        double value;
        std::memcpy(&value, &bits, sizeof(double));
        offset += 8;
        return json(value);
    }
    
    size_t get_byte_length() const override { return 8; }
    bool is_static_length() const override { return true; }
    size_t calculate_byte_length(const json&) const override { return 8; }
};

// Unified Types
class UInt : public Type {
private:
    size_t bytes_;

public:
    explicit UInt(size_t bytes) : bytes_(bytes) {
        if (bytes != 1 && bytes != 2 && bytes != 4) {
            throw parser_error("UInt only supports 1, 2, or 4 bytes");
        }
    }
    
    json deserialize(const uint8_t* buffer, size_t& offset, size_t buffer_size) const override {
        if (offset + bytes_ > buffer_size) {
            throw parser_error("Buffer underflow reading UInt(" + std::to_string(bytes_) + ")");
        }
        
        uint32_t value = 0;
        for (size_t i = 0; i < bytes_; ++i) {
            value |= (static_cast<uint32_t>(buffer[offset + i]) << (i * 8));
        }
        offset += bytes_;
        return json(value);
    }
    
    size_t get_byte_length() const override { return bytes_; }
    bool is_static_length() const override { return true; }
    size_t calculate_byte_length(const json&) const override { return bytes_; }
};

class Int : public Type {
private:
    size_t bytes_;

public:
    explicit Int(size_t bytes) : bytes_(bytes) {
        if (bytes != 1 && bytes != 2 && bytes != 4) {
            throw parser_error("Int only supports 1, 2, or 4 bytes");
        }
    }
    
    json deserialize(const uint8_t* buffer, size_t& offset, size_t buffer_size) const override {
        if (offset + bytes_ > buffer_size) {
            throw parser_error("Buffer underflow reading Int(" + std::to_string(bytes_) + ")");
        }
        
        int32_t value = 0;
        for (size_t i = 0; i < bytes_; ++i) {
            value |= (static_cast<int32_t>(buffer[offset + i]) << (i * 8));
        }
        
        // Sign extend for smaller types
        if (bytes_ == 1 && (value & 0x80)) {
            value |= 0xFFFFFF00;
        } else if (bytes_ == 2 && (value & 0x8000)) {
            value |= 0xFFFF0000;
        }
        
        offset += bytes_;
        return json(value);
    }
    
    size_t get_byte_length() const override { return bytes_; }
    bool is_static_length() const override { return true; }
    size_t calculate_byte_length(const json&) const override { return bytes_; }
};

class Float : public Type {
private:
    size_t bytes_;

public:
    explicit Float(size_t bytes) : bytes_(bytes) {
        if (bytes != 4 && bytes != 8) {
            throw parser_error("Float only supports 4 or 8 bytes");
        }
    }
    
    json deserialize(const uint8_t* buffer, size_t& offset, size_t buffer_size) const override {
        if (offset + bytes_ > buffer_size) {
            throw parser_error("Buffer underflow reading Float(" + std::to_string(bytes_) + ")");
        }
        
        if (bytes_ == 4) {
            uint32_t bits = buffer[offset] | (buffer[offset + 1] << 8) | 
                           (buffer[offset + 2] << 16) | (buffer[offset + 3] << 24);
            float value;
            std::memcpy(&value, &bits, sizeof(float));
            offset += 4;
            return json(static_cast<double>(value));
        } else { // bytes_ == 8
            uint64_t bits = static_cast<uint64_t>(buffer[offset]) | 
                           (static_cast<uint64_t>(buffer[offset + 1]) << 8) |
                           (static_cast<uint64_t>(buffer[offset + 2]) << 16) |
                           (static_cast<uint64_t>(buffer[offset + 3]) << 24) |
                           (static_cast<uint64_t>(buffer[offset + 4]) << 32) |
                           (static_cast<uint64_t>(buffer[offset + 5]) << 40) |
                           (static_cast<uint64_t>(buffer[offset + 6]) << 48) |
                           (static_cast<uint64_t>(buffer[offset + 7]) << 56);
            double value;
            std::memcpy(&value, &bits, sizeof(double));
            offset += 8;
            return json(value);
        }
    }
    
    size_t get_byte_length() const override { return bytes_; }
    bool is_static_length() const override { return true; }
    size_t calculate_byte_length(const json&) const override { return bytes_; }
};

class BooleanType : public Type {
public:
    json deserialize(const uint8_t* buffer, size_t& offset, size_t buffer_size) const override {
        if (offset >= buffer_size) {
            throw parser_error("Buffer underflow reading BooleanType");
        }
        bool value = buffer[offset++] != 0;
        return json(value);
    }
    
    size_t get_byte_length() const override { return 1; }
    bool is_static_length() const override { return true; }
    size_t calculate_byte_length(const json&) const override { return 1; }
};

class Char : public Type {
public:
    json deserialize(const uint8_t* buffer, size_t& offset, size_t buffer_size) const override {
        if (offset >= buffer_size) {
            throw parser_error("Buffer underflow reading Char");
        }
        char value = static_cast<char>(buffer[offset++]);
        return json(std::string(1, value));
    }
    
    size_t get_byte_length() const override { return 1; }
    bool is_static_length() const override { return true; }
    size_t calculate_byte_length(const json&) const override { return 1; }
};

class FixedStringType : public Type {
private:
    size_t length_;

public:
    explicit FixedStringType(size_t length) : length_(length) {}
    
    json deserialize(const uint8_t* buffer, size_t& offset, size_t buffer_size) const override {
        if (offset + length_ > buffer_size) {
            throw parser_error("Buffer underflow reading FixedStringType");
        }
        
        // Find null terminator or use full length
        size_t str_len = 0;
        for (size_t i = 0; i < length_; ++i) {
            if (buffer[offset + i] == 0) {
                str_len = i;
                break;
            }
            str_len = i + 1;
        }
        
        std::string value(reinterpret_cast<const char*>(buffer + offset), str_len);
        offset += length_;
        return json(value);
    }
    
    size_t get_byte_length() const override { return length_; }
    bool is_static_length() const override { return true; }
    size_t calculate_byte_length(const json&) const override { return length_; }
};

class VarStringType : public Type {
private:
    size_t max_length_;
    bool use_two_byte_header_;

public:
    explicit VarStringType(size_t max_length = 65535) 
        : max_length_(max_length), use_two_byte_header_(max_length >= 256) {}
    
    json deserialize(const uint8_t* buffer, size_t& offset, size_t buffer_size) const override {
        // Read length header
        size_t str_length;
        if (use_two_byte_header_) {
            if (offset + 2 > buffer_size) {
                throw parser_error("Buffer underflow reading VarStringType header (2-byte)");
            }
            str_length = buffer[offset] | (buffer[offset + 1] << 8);
            offset += 2;
        } else {
            if (offset >= buffer_size) {
                throw parser_error("Buffer underflow reading VarStringType header (1-byte)");
            }
            str_length = buffer[offset++];
        }
        
        // Read string data
        if (offset + str_length > buffer_size) {
            throw parser_error("Buffer underflow reading VarStringType data");
        }
        
        std::string value(reinterpret_cast<const char*>(buffer + offset), str_length);
        offset += str_length;
        return json(value);
    }
    
    size_t get_byte_length() const override { return 0; } // Variable length
    bool is_static_length() const override { return false; }
    size_t calculate_byte_length(const json& value) const override {
        size_t str_len = value.get<std::string>().length();
        return (use_two_byte_header_ ? 2 : 1) + str_len;
    }
};

class ArrayType : public Type {
private:
    std::unique_ptr<Type> element_type_;
    size_t fixed_length_;
    bool is_variable_length_;

public:
    ArrayType(std::unique_ptr<Type> element_type, size_t length = 0) 
        : element_type_(std::move(element_type)), fixed_length_(length), 
          is_variable_length_(length == 0) {}
    
    json deserialize(const uint8_t* buffer, size_t& offset, size_t buffer_size) const override {
        size_t array_length;
        
        if (is_variable_length_) {
            // Read length header (2 bytes for variable arrays)
            if (offset + 2 > buffer_size) {
                throw parser_error("Buffer underflow reading ArrayType length");
            }
            array_length = buffer[offset] | (buffer[offset + 1] << 8);
            offset += 2;
        } else {
            array_length = fixed_length_;
        }
        
        json result = json::array();
        for (size_t i = 0; i < array_length; ++i) {
            result.push_back(element_type_->deserialize(buffer, offset, buffer_size));
        }
        
        return result;
    }
    
    size_t get_byte_length() const override { 
        if (is_variable_length_ || !element_type_->is_static_length()) {
            return 0; // Variable length
        }
        return fixed_length_ * element_type_->get_byte_length();
    }
    
    bool is_static_length() const override { 
        return !is_variable_length_ && element_type_->is_static_length(); 
    }
    
    size_t calculate_byte_length(const json& value) const override {
        size_t total = is_variable_length_ ? 2 : 0; // Length header for variable arrays
        for (const auto& item : value) {
            total += element_type_->calculate_byte_length(item);
        }
        return total;
    }
};

class TupleType : public Type {
private:
    std::vector<std::unique_ptr<Type>> element_types_;

public:
    explicit TupleType(std::vector<std::unique_ptr<Type>> element_types) 
        : element_types_(std::move(element_types)) {}
    
    json deserialize(const uint8_t* buffer, size_t& offset, size_t buffer_size) const override {
        json result = json::array();
        for (const auto& element_type : element_types_) {
            result.push_back(element_type->deserialize(buffer, offset, buffer_size));
        }
        return result;
    }
    
    size_t get_byte_length() const override {
        size_t total = 0;
        for (const auto& element_type : element_types_) {
            if (!element_type->is_static_length()) {
                return 0; // Variable length
            }
            total += element_type->get_byte_length();
        }
        return total;
    }
    
    bool is_static_length() const override {
        for (const auto& element_type : element_types_) {
            if (!element_type->is_static_length()) {
                return false;
            }
        }
        return true;
    }
    
    size_t calculate_byte_length(const json& value) const override {
        size_t total = 0;
        for (size_t i = 0; i < element_types_.size(); ++i) {
            total += element_types_[i]->calculate_byte_length(value[i]);
        }
        return total;
    }
};

class MapType : public Type {
private:
    std::vector<std::pair<std::string, std::unique_ptr<Type>>> fields_;

public:
    explicit MapType(std::vector<std::pair<std::string, std::unique_ptr<Type>>> fields) 
        : fields_(std::move(fields)) {}
    
    json deserialize(const uint8_t* buffer, size_t& offset, size_t buffer_size) const override {
        json result = json::object();
        for (const auto& field : fields_) {
            result[field.first] = field.second->deserialize(buffer, offset, buffer_size);
        }
        return result;
    }
    
    size_t get_byte_length() const override {
        size_t total = 0;
        for (const auto& field : fields_) {
            if (!field.second->is_static_length()) {
                return 0; // Variable length
            }
            total += field.second->get_byte_length();
        }
        return total;
    }
    
    bool is_static_length() const override {
        for (const auto& field : fields_) {
            if (!field.second->is_static_length()) {
                return false;
            }
        }
        return true;
    }
    
    size_t calculate_byte_length(const json& value) const override {
        size_t total = 0;
        for (const auto& field : fields_) {
            total += field.second->calculate_byte_length(value[field.first]);
        }
        return total;
    }
};

class EnumType : public Type {
private:
    std::vector<std::string> options_;
    size_t value_size_;

public:
    explicit EnumType(std::vector<std::string> options) : options_(std::move(options)) {
        if (options_.size() <= 256) {
            value_size_ = 1;
        } else if (options_.size() <= 65536) {
            value_size_ = 2;
        } else {
            value_size_ = 4;
        }
    }
    
    json deserialize(const uint8_t* buffer, size_t& offset, size_t buffer_size) const override {
        if (offset + value_size_ > buffer_size) {
            throw parser_error("Buffer underflow reading EnumType");
        }
        
        size_t index = 0;
        for (size_t i = 0; i < value_size_; ++i) {
            index |= (static_cast<size_t>(buffer[offset + i]) << (i * 8));
        }
        offset += value_size_;
        
        if (index >= options_.size()) {
            throw parser_error("Invalid enum index: " + std::to_string(index));
        }
        
        return json(options_[index]);
    }
    
    size_t get_byte_length() const override { return value_size_; }
    bool is_static_length() const override { return true; }
    size_t calculate_byte_length(const json&) const override { return value_size_; }
};

class OptionalType : public Type {
private:
    std::unique_ptr<Type> base_type_;

public:
    explicit OptionalType(std::unique_ptr<Type> base_type) 
        : base_type_(std::move(base_type)) {}
    
    json deserialize(const uint8_t* buffer, size_t& offset, size_t buffer_size) const override {
        if (offset >= buffer_size) {
            throw parser_error("Buffer underflow reading OptionalType presence flag");
        }
        
        bool is_present = buffer[offset++] != 0;
        if (is_present) {
            return base_type_->deserialize(buffer, offset, buffer_size);
        } else {
            return json(nullptr);
        }
    }
    
    size_t get_byte_length() const override {
        if (!base_type_->is_static_length()) {
            return 0; // Variable length
        }
        return 1 + base_type_->get_byte_length();
    }
    
    bool is_static_length() const override { return base_type_->is_static_length(); }
    
    size_t calculate_byte_length(const json& value) const override {
        if (value.is_null()) {
            return 1; // Just the presence flag
        }
        return 1 + base_type_->calculate_byte_length(value);
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
    std::string type_name = type_def["type"];
    
    if (type_name == "UInt8") {
        return std::unique_ptr<UInt8>(new UInt8());
    } else if (type_name == "UInt16") {
        return std::unique_ptr<UInt16>(new UInt16());
    } else if (type_name == "UInt32") {
        return std::unique_ptr<UInt32>(new UInt32());
    } else if (type_name == "Int8") {
        return std::unique_ptr<Int8>(new Int8());
    } else if (type_name == "Int16") {
        return std::unique_ptr<Int16>(new Int16());
    } else if (type_name == "Int32") {
        return std::unique_ptr<Int32>(new Int32());
    } else if (type_name == "Float32") {
        return std::unique_ptr<Float32>(new Float32());
    } else if (type_name == "Float64") {
        return std::unique_ptr<Float64>(new Float64());
    } else if (type_name == "UInt") {
        size_t bytes = type_def["byte_length"];
        return std::unique_ptr<UInt>(new UInt(bytes));
    } else if (type_name == "Int") {
        size_t bytes = type_def["byte_length"];
        return std::unique_ptr<Int>(new Int(bytes));
    } else if (type_name == "Float") {
        size_t bytes = type_def["byte_length"];
        return std::unique_ptr<Float>(new Float(bytes));
    } else if (type_name == "BooleanType") {
        return std::unique_ptr<BooleanType>(new BooleanType());
    } else if (type_name == "Char") {
        return std::unique_ptr<Char>(new Char());
    } else if (type_name == "FixedStringType") {
        size_t length = type_def["length"];
        return std::unique_ptr<FixedStringType>(new FixedStringType(length));
    } else if (type_name == "VarStringType") {
        size_t max_length = type_def.value("max_length", 65535);
        return std::unique_ptr<VarStringType>(new VarStringType(max_length));
    } else if (type_name == "ArrayType") {
        auto element_type = from_json(type_def["element_type"]);
        size_t length = type_def.value("length", 0);
        return std::unique_ptr<ArrayType>(new ArrayType(std::move(element_type), length));
    } else if (type_name == "TupleType") {
        std::vector<std::unique_ptr<Type>> element_types;
        for (const auto& elem_def : type_def["element_types"]) {
            element_types.push_back(from_json(elem_def));
        }
        return std::unique_ptr<TupleType>(new TupleType(std::move(element_types)));
    } else if (type_name == "MapType") {
        std::vector<std::pair<std::string, std::unique_ptr<Type>>> fields;
        for (const auto& field_def : type_def["field_pairs"]) {
            std::string field_name = field_def[0];
            auto field_type = from_json(field_def[1]);
            fields.emplace_back(field_name, std::move(field_type));
        }
        return std::unique_ptr<MapType>(new MapType(std::move(fields)));
    } else if (type_name == "EnumType") {
        std::vector<std::string> options = type_def["options"];
        return std::unique_ptr<EnumType>(new EnumType(std::move(options)));
    } else if (type_name == "OptionalType") {
        auto base_type = from_json(type_def["base_type"]);
        return std::unique_ptr<OptionalType>(new OptionalType(std::move(base_type)));
    } else {
        throw parser_error("Unknown type: " + type_name);
    }
}

} // namespace obj2buf
