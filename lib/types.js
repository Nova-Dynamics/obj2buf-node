
/**
 * @fileoverview Type definitions for binary encoding and decoding
 */

/**
 * Custom error class for parsing errors
 * @class
 * @extends Error
 */
class ParserError extends Error {}


/**
 * Global helper function to validate non-nullish values
 * @param {*} value - The value to check
 * @param {string} typeName - The type name for error messages
 * @throws {ParserError} If value is undefined or null
 */
function _throw_if_nullish(value, typeName) {
    if (value === undefined || value === null) {
        throw new ParserError(`Cannot encode ${value} as ${typeName}. Expected a valid value.`);
    }
}


/**
 * Base class for all data types
 * @abstract
 * @class
 */
class Type {
    /**
     * Create a new Type instance
     * @constructor
     */
    constructor() {}

    /**
     * Static byte length for the type
     * @type {number}
     * @static
     */
    static byte_length = 0;

    /**
     * Get the byte length for this type instance
     * @type {number}
     * @readonly
     */
    get byte_length() {
        return this.constructor.byte_length;
    }

    /**
     * Check if this type has a static (compile-time known) length
     * @type {boolean}
     * @readonly
     */
    get is_static_length() {
        return this.byte_length !== null && this.byte_length !== undefined;
    }

    /**
     * Calculate the byte length for a specific value (for variable-length types)
     * @param {*} value - The value to calculate length for
     * @returns {number} The byte length for the given value
     * @throws {Error} For fixed-length types that don't support value-specific calculation
     */
    calculate_byte_length(value) {
        // Default implementation for fixed-length types
        if (this.is_static_length) {
            return this.byte_length;
        }
        throw new Error("Variable-length types must implement calculate_byte_length");
    }

    /**
     * Decode data from a buffer
     * @abstract
     * @param {Buffer} buffer - The buffer to decode from
     * @param {number} offset - The offset in the buffer to start decoding
     * @returns {{value: *, bytes_read: number}} Object containing the decoded value and number of bytes read
     * @throws {Error} Always throws as this is an abstract method
     */
    decode(buffer, offset) {
        throw new Error("Not implemented");
    }

    /**
     * Encode a value into a buffer at the given offset
     * @abstract
     * @param {*} value - The value to encode
     * @param {Buffer} buffer - The buffer to encode into
     * @param {number} offset - The offset in the buffer to start encoding
     * @returns {number} The number of bytes written
     * @throws {Error} Always throws as this is an abstract method
     */
    encode(value, buffer, offset) {
        throw new Error("Not implemented");
    }
    
    /**
     * Validate a value without encoding it
     * @abstract
     * @param {*} value - The value to validate
     * @returns {boolean} True if valid
     * @throws {ParserError} If value is invalid
     */
    validate(value) {
        throw new Error("Not implemented");
    }

    /**
     * Convert the type to a JSON representation
     * @returns {{type: string}} JSON representation of the type
     */
    to_json() {
        return { type: this.constructor.name };
    }

    /**
     * Convert the type to a JSON representation (non-snake_case alias)
     * @returns {{type: string}} JSON representation of the type
     */
    toJSON() {
        return this.to_json();
    }
}

/**
 * Unified unsigned integer type with configurable byte length
 * @class
 * @extends Type
 */
class UInt extends Type {
    /**
     * Create a new unsigned integer type
     * @param {number} byte_length - The number of bytes (1, 2, or 4)
     */
    constructor(byte_length) {
        super();
        if (![1, 2, 4].includes(byte_length)) {
            throw new Error(`UInt byte_length must be 1, 2, or 4, got ${byte_length}`);
        }
        this._byte_length = byte_length;
        this._max_value = Math.pow(2, byte_length * 8) - 1;
    }

    /** @type {number} */
    get byte_length() {
        return this._byte_length;
    }

    /**
     * Decode an unsigned integer from buffer
     * @param {Buffer} buffer - The buffer to decode from
     * @param {number} offset - The offset in the buffer
     * @returns {{value: number, bytes_read: number}} Object containing the decoded value and bytes read
     */
    decode(buffer, offset) {
        let value;
        switch (this._byte_length) {
            case 1: value = buffer.readUInt8(offset); break;
            case 2: value = buffer.readUInt16LE(offset); break;
            case 4: value = buffer.readUInt32LE(offset); break;
        }
        return { value, bytes_read: this._byte_length };
    }

    /**
     * Encode an unsigned integer into buffer
     * @param {number} value - The value to encode
     * @param {Buffer} buffer - The buffer to encode into
     * @param {number} offset - The offset in the buffer
     * @param {Object} [options={}] - Encoding options
     * @param {boolean} [options.unsafe=false] - Skip validation for performance
     * @returns {number} The number of bytes written
     * @throws {ParserError} If value is invalid (unless unsafe=true)
     */
    encode(value, buffer, offset, { unsafe = false } = {}) {
        if (!unsafe) {
            this.validate(value);
        }
        switch (this._byte_length) {
            case 1: buffer.writeUInt8(value, offset); break;
            case 2: buffer.writeUInt16LE(value, offset); break;
            case 4: buffer.writeUInt32LE(value, offset); break;
        }
        return this._byte_length;
    }

    /**
     * Validate an unsigned integer value
     * @param {number} value - The value to validate
     * @returns {boolean} True if valid
     * @throws {ParserError} If value is invalid
     */
    validate(value) {
        _throw_if_nullish(value, `UInt${this._byte_length * 8}`);
        
        if (typeof value !== 'number') {
            throw new ParserError(`UInt${this._byte_length * 8} value must be a number, got ${typeof value}`);
        }
        
        if (!Number.isInteger(value)) {
            throw new ParserError(`UInt${this._byte_length * 8} value must be an integer, got ${value}`);
        }
        
        if (value < 0 || value > this._max_value) {
            throw new ParserError(`UInt${this._byte_length * 8} value must be between 0 and ${this._max_value}, got ${value}`);
        }
        
        return true;
    }

    to_json() {
        return { type: 'UInt', byte_length: this._byte_length };
    }
}

/**
 * Unified signed integer type with configurable byte length
 * @class
 * @extends Type
 */
class Int extends Type {
    /**
     * Create a new signed integer type
     * @param {number} byte_length - The number of bytes (1, 2, or 4)
     */
    constructor(byte_length) {
        super();
        if (![1, 2, 4].includes(byte_length)) {
            throw new Error(`Int byte_length must be 1, 2, or 4, got ${byte_length}`);
        }
        this._byte_length = byte_length;
        this._max_value = Math.pow(2, byte_length * 8 - 1) - 1;
        this._min_value = -Math.pow(2, byte_length * 8 - 1);
    }

    /** @type {number} */
    get byte_length() {
        return this._byte_length;
    }

    /**
     * Decode a signed integer from buffer
     * @param {Buffer} buffer - The buffer to decode from
     * @param {number} offset - The offset in the buffer
     * @returns {{value: number, bytes_read: number}} Object containing the decoded value and bytes read
     */
    decode(buffer, offset) {
        let value;
        switch (this._byte_length) {
            case 1: value = buffer.readInt8(offset); break;
            case 2: value = buffer.readInt16LE(offset); break;
            case 4: value = buffer.readInt32LE(offset); break;
        }
        return { value, bytes_read: this._byte_length };
    }

    /**
     * Encode a signed integer into buffer
     * @param {number} value - The value to encode
     * @param {Buffer} buffer - The buffer to encode into
     * @param {number} offset - The offset in the buffer
     * @param {Object} [options={}] - Encoding options
     * @param {boolean} [options.unsafe=false] - Skip validation for performance
     * @returns {number} The number of bytes written
     * @throws {ParserError} If value is invalid (unless unsafe=true)
     */
    encode(value, buffer, offset, { unsafe = false } = {}) {
        if (!unsafe) {
            this.validate(value);
        }
        switch (this._byte_length) {
            case 1: buffer.writeInt8(value, offset); break;
            case 2: buffer.writeInt16LE(value, offset); break;
            case 4: buffer.writeInt32LE(value, offset); break;
        }
        return this._byte_length;
    }

    /**
     * Validate a signed integer value
     * @param {number} value - The value to validate
     * @returns {boolean} True if valid
     * @throws {ParserError} If value is invalid
     */
    validate(value) {
        _throw_if_nullish(value, `Int${this._byte_length * 8}`);
        
        if (typeof value !== 'number') {
            throw new ParserError(`Int${this._byte_length * 8} value must be a number, got ${typeof value}`);
        }
        
        if (!Number.isInteger(value)) {
            throw new ParserError(`Int${this._byte_length * 8} value must be an integer, got ${value}`);
        }
        
        if (value < this._min_value || value > this._max_value) {
            throw new ParserError(`Int${this._byte_length * 8} value must be between ${this._min_value} and ${this._max_value}, got ${value}`);
        }
        
        return true;
    }

    to_json() {
        return { type: 'Int', byte_length: this._byte_length };
    }
}

/**
 * Unified floating point type with configurable byte length
 * @class
 * @extends Type
 */
class Float extends Type {
    /**
     * Create a new floating point type
     * @param {number} byte_length - The number of bytes (4 or 8)
     */
    constructor(byte_length) {
        super();
        if (![4, 8].includes(byte_length)) {
            throw new Error(`Float byte_length must be 4 or 8, got ${byte_length}`);
        }
        this._byte_length = byte_length;
    }

    /** @type {number} */
    get byte_length() {
        return this._byte_length;
    }

    /**
     * Decode a floating point number from buffer
     * @param {Buffer} buffer - The buffer to decode from
     * @param {number} offset - The offset in the buffer
     * @returns {{value: number, bytes_read: number}} Object containing the decoded value and bytes read
     */
    decode(buffer, offset) {
        let value;
        switch (this._byte_length) {
            case 4: value = buffer.readFloatLE(offset); break;
            case 8: value = buffer.readDoubleLE(offset); break;
        }
        return { value, bytes_read: this._byte_length };
    }

    /**
     * Encode a floating point number into buffer
     * @param {number} value - The value to encode
     * @param {Buffer} buffer - The buffer to encode into
     * @param {number} offset - The offset in the buffer
     * @param {Object} [options={}] - Encoding options
     * @param {boolean} [options.unsafe=false] - Skip validation for performance
     * @returns {number} The number of bytes written
     * @throws {ParserError} If value is invalid (unless unsafe=true)
     */
    encode(value, buffer, offset, { unsafe = false } = {}) {
        if (!unsafe) {
            this.validate(value);
        }
        switch (this._byte_length) {
            case 4: buffer.writeFloatLE(value, offset); break;
            case 8: buffer.writeDoubleLE(value, offset); break;
        }
        return this._byte_length;
    }

    /**
     * Validate a floating point value
     * @param {number} value - The value to validate
     * @returns {boolean} True if valid
     * @throws {ParserError} If value is invalid
     */
    validate(value) {
        _throw_if_nullish(value, `Float${this._byte_length * 8}`);
        
        if (typeof value !== 'number') {
            throw new ParserError(`Float${this._byte_length * 8} value must be a number, got ${typeof value}`);
        }
        
        if (!Number.isFinite(value)) {
            throw new ParserError(`Float${this._byte_length * 8} value must be finite, got ${value}`);
        }
        
        return true;
    }

    to_json() {
        return { type: 'Float', byte_length: this._byte_length };
    }
}

/**
 * Unsigned 8-bit integer type (0-255)
 * @class
 * @extends UInt
 */
class UInt8 extends UInt {
    constructor() {
        super(1);
    }
    
    /**
     * Convert to JSON representation (backward compatibility)
     * @returns {{type: string}} JSON representation
     */
    to_json() {
        return { type: 'UInt8' };
    }
}

/**
 * Unsigned 16-bit integer type (0-65535)
 * @class
 * @extends UInt
 */
class UInt16 extends UInt {
    constructor() {
        super(2);
    }
    
    /**
     * Convert to JSON representation (backward compatibility)
     * @returns {{type: string}} JSON representation
     */
    to_json() {
        return { type: 'UInt16' };
    }
}

/**
 * Unsigned 32-bit integer type (0-4294967295)
 * @class
 * @extends UInt
 */
class UInt32 extends UInt {
    constructor() {
        super(4);
    }
    
    /**
     * Convert to JSON representation (backward compatibility)
     * @returns {{type: string}} JSON representation
     */
    to_json() {
        return { type: 'UInt32' };
    }
}

/**
 * Signed 8-bit integer type (-128 to 127)
 * @class
 * @extends Int
 */
class Int8 extends Int {
    constructor() {
        super(1);
    }
    
    /**
     * Convert to JSON representation (backward compatibility)
     * @returns {{type: string}} JSON representation
     */
    to_json() {
        return { type: 'Int8' };
    }
}

/**
 * Signed 16-bit integer type (-32768 to 32767)
 * @class
 * @extends Int
 */
class Int16 extends Int {
    constructor() {
        super(2);
    }
    
    /**
     * Convert to JSON representation (backward compatibility)
     * @returns {{type: string}} JSON representation
     */
    to_json() {
        return { type: 'Int16' };
    }
}

/**
 * Signed 32-bit integer type (-2147483648 to 2147483647)
 * @class
 * @extends Int
 */
class Int32 extends Int {
    constructor() {
        super(4);
    }
    
    /**
     * Convert to JSON representation (backward compatibility)
     * @returns {{type: string}} JSON representation
     */
    to_json() {
        return { type: 'Int32' };
    }
}

/**
 * 32-bit floating point type
 * @class
 * @extends Float
 */
class Float32 extends Float {
    constructor() {
        super(4);
    }
    
    /**
     * Convert to JSON representation (backward compatibility)
     * @returns {{type: string}} JSON representation
     */
    to_json() {
        return { type: 'Float32' };
    }
}

/**
 * 64-bit floating point type
 * @class
 * @extends Float
 */
class Float64 extends Float {
    constructor() {
        super(8);
    }
    
    /**
     * Convert to JSON representation (backward compatibility)
     * @returns {{type: string}} JSON representation
     */
    to_json() {
        return { type: 'Float64' };
    }
}

class BooleanType extends Type {
    /** @type {number} @static */
    static byte_length = 1;

    /**
     * Decode a boolean from buffer (0 = false, non-zero = true)
     * @param {Buffer} buffer - The buffer to decode from
     * @param {number} offset - The offset in the buffer
     * @returns {{value: boolean, bytes_read: number}} Object containing the decoded value and bytes read
     */
    decode(buffer, offset) {
        return {
            value: buffer.readUInt8(offset) !== 0,
            bytes_read: 1
        };
    }

    /**
     * Encode a boolean into buffer (false = 0, true = 1)
     * @param {boolean} value - The boolean value to encode
     * @param {Buffer} buffer - The buffer to encode into
     * @param {number} offset - The offset in the buffer
     * @param {Object} [options={}] - Encoding options
     * @param {boolean} [options.unsafe=false] - Skip validation for performance
     * @returns {number} Number of bytes written
     * @throws {ParserError} If value is undefined or null (unless unsafe=true)
     */
    encode(value, buffer, offset, { unsafe = false } = {}) {
        if (!unsafe) {
            this.validate(value);
        }
        buffer.writeUInt8(value ? 1 : 0, offset);
        return 1;
    }

    /**
     * Validate a boolean value
     * @param {*} value - The value to validate (must be strictly boolean)
     * @returns {boolean} True if valid
     * @throws {ParserError} If value is invalid
     */
    validate(value) {
        _throw_if_nullish(value, 'BooleanType');
        
        if (typeof value !== 'boolean') {
            throw new ParserError(`BooleanType value must be a boolean, got ${typeof value}`);
        }
        
        return true;
    }
}

/**
 * Single character type
 * @class
 * @extends Type
 */
class Char extends Type {
    static byte_length = 1;

    /**
     * Decode a single character from buffer
     * @param {Buffer} buffer - The buffer to decode from
     * @param {number} offset - The offset in the buffer
     * @returns {{value: string, bytes_read: number}} Object containing the decoded value and bytes read
     */
    decode(buffer, offset) {
        return {
            value: String.fromCharCode(buffer.readUInt8(offset)),
            bytes_read: 1
        };
    }

    /**
     * Encode a single character into buffer
     * @param {string} value - The character to encode (uses first character if multi-character string)
     * @param {Buffer} buffer - The buffer to encode into
     * @param {number} offset - The offset in the buffer
     * @param {Object} [options={}] - Encoding options
     * @param {boolean} [options.unsafe=false] - Skip validation for performance
     * @returns {number} Number of bytes written
     * @throws {ParserError} If value is undefined or null (unless unsafe=true)
     */
    encode(value, buffer, offset, { unsafe = false } = {}) {
        if (!unsafe) {
            this.validate(value);
        }
        // Take first character if string is longer than 1
        const char = value.length > 0 ? value[0] : '\0';
        buffer.writeUInt8(char.charCodeAt(0), offset);
        return 1;
    }

    /**
     * Validate a character value
     * @param {string} value - The value to validate
     * @returns {boolean} True if valid
     * @throws {ParserError} If value is invalid
     */
    validate(value) {
        _throw_if_nullish(value, 'Char');
        
        if (typeof value !== 'string') {
            throw new ParserError(`Char value must be a string, got ${typeof value}`);
        }
        
        return true;
    }

}

class ArrayType extends Type {
    /**
     * Create a new ArrayType instance
     * @param {Type} element_type - The type of elements in the array
     * @param {number|null} [length=null] - The fixed length of the array, or null for variable length
     */
    constructor(element_type, length = null) {
        super();
        /**
         * The type of elements in the array
         * @type {Type}
         * @private
         */
        this.element_type = element_type;
        /**
         * The fixed length of the array, or null for variable length
         * @type {number|null}
         * @private
         */
        this.length = length;
    }

    /**
     * Get the total byte length for the array
     * Returns null for variable-length arrays
     * @type {number|null}
     * @readonly
     */
    get byte_length() {
        if (this.length === null) {
            return null; // Variable length array
        }
        // For fixed-length arrays, also check if element type is variable length
        if (this.element_type.byte_length === null) {
            return null; // ArrayType contains variable-length elements
        }
        return this.element_type.byte_length * this.length;
    }

    /**
     * Check if this type has a static (compile-time known) length
     * @type {boolean}
     * @readonly
     */
    get is_static_length() {
        // ArrayType is static only if it has fixed length AND elements are static
        return this.length !== null && this.element_type.is_static_length;
    }

    /**
     * Calculate the byte length for a specific array value
     * @param {Array} value - The array value to calculate length for
     * @returns {number} The total byte length for encoding this array
     */
    calculate_byte_length(value) {
        if (!Array.isArray(value)) {
            throw new ParserError(`ArrayType value must be an array, got ${typeof value}`);
        }

        let totalLength = 0;
        
        // Add header for variable-length arrays (UInt32 for array length)
        if (this.length === null) {
            totalLength += 4; // 4 bytes for UInt32 length prefix
        }
        
        // Calculate total size of all elements
        for (const element of value) {
            totalLength += this.element_type.calculate_byte_length(element);
        }
        
        return totalLength;
    }

    /**
     * Decode an array from buffer
     * @param {Buffer} buffer - The buffer to decode from
     * @param {number} offset - The offset in the buffer
     * @returns {{value: Array, bytes_read: number}} Object with decoded array and bytes read
     */
    decode(buffer, offset) {
        if (this.length === null) {
            // Variable-length array: read length prefix first
            if (buffer.length < offset + 4) {
                throw new ParserError('Buffer too small to read array length');
            }
            
            const arrayLength = buffer.readUInt32LE(offset);
            let currentOffset = offset + 4;
            const arr = [];
            
            for (let i = 0; i < arrayLength; i++) {
                const decoded = this.element_type.decode(buffer, currentOffset);
                arr.push(decoded.value);
                currentOffset += decoded.bytes_read;
            }
            
            return { value: arr, bytes_read: currentOffset - offset };
        } else {
            // Fixed-length array: decode exactly 'length' elements
            const arr = [];
            let currentOffset = offset;
            for (let i = 0; i < this.length; i++) {
                const decoded = this.element_type.decode(buffer, currentOffset);
                arr.push(decoded.value);
                currentOffset += decoded.bytes_read;
            }
            return { value: arr, bytes_read: currentOffset - offset };
        }
    }

    /**
     * Encode an array into buffer
     * @param {Array} value - The array to encode
     * @param {Buffer} buffer - The buffer to encode into
     * @param {number} offset - The offset in the buffer
     * @param {Object} [options={}] - Encoding options
     * @param {boolean} [options.unsafe=false] - Skip validation for performance
     * @returns {number} Number of bytes written
     * @throws {ParserError} If value is invalid (unless unsafe=true)
     */
    encode(value, buffer, offset, { unsafe = false } = {}) {
        if (!unsafe) {
            this.validate(value);
        }
        
        if (this.length === null) {
            // Variable-length array: write length prefix, then elements
            let currentOffset = offset;
            
            // Write array length as UInt32
            buffer.writeUInt32LE(value.length, currentOffset);
            currentOffset += 4;
            
            // Write each element
            for (const element of value) {
                if (this.element_type.byte_length === null) {
                    // Variable-length elements
                    const bytesWritten = this.element_type.encode(element, buffer, currentOffset, { unsafe });
                    currentOffset += bytesWritten;
                } else {
                    // Fixed-length elements
                    this.element_type.encode(element, buffer, currentOffset, { unsafe });
                    currentOffset += this.element_type.byte_length;
                }
            }
            
            return currentOffset - offset; // Return total bytes written
        } else {
            // Fixed-length array: encode exactly 'length' elements
            for (let i = 0; i < this.length; i++) {
                this.element_type.encode(value[i], buffer, offset + i * this.element_type.byte_length, { unsafe:false }); // Can skip validation, because we already handled it above
            }
            // Return total bytes written for fixed arrays too
            return this.byte_length;
        }
    }

    /**
     * Validate an array value
     * @param {Array} value - The array to validate
     * @returns {boolean} True if valid
     * @throws {ParserError} If value is invalid
     */
    validate(value) {
        _throw_if_nullish(value, 'ArrayType');
        
        if (!Array.isArray(value)) {
            throw new ParserError(`ArrayType value must be an array, got ${typeof value}`);
        }
        
        // For fixed-length arrays, check length matches
        if (this.length !== null && value.length !== this.length) {
            throw new ParserError(`ArrayType length mismatch: expected ${this.length}, got ${value.length}`);
        }
        
        // Validate each element in the array
        for (let i = 0; i < value.length; i++) {
            try {
                this.element_type.validate(value[i]);
            } catch (error) {
                throw new ParserError(`ArrayType element at index ${i} is invalid: ${error.message}`);
            }
        }
        
        return true;
    }

    /**
     * Convert the array type to JSON representation
     * @returns {{type: string, element_type: Object, length: number|null}} JSON representation
     */
    to_json() {
        return {
            type: "ArrayType",
            element_type: this.element_type.to_json(),
            length: this.length
        };
    }
}

/**
 * Fixed-length string type with UTF-8 encoding
 * @class
 * @extends Type
 */
class FixedStringType extends Type {
    /**
     * Create a new FixedStringType instance
     * @param {number} length - The maximum byte length of the string
     */
    constructor(length) {
        super();
        /**
         * The maximum byte length of the string
         * @type {number}
         * @private
         */
        this.length = length;
    }

    /**
     * Get the byte length for the string
     * @type {number}
     * @readonly
     */
    get byte_length() {
        return this.length;
    }

    /**
     * Decode a null-terminated string from buffer
     * @param {Buffer} buffer - The buffer to decode from
     * @param {number} offset - The offset in the buffer
     * @returns {{value: string, bytes_read: number}} Object containing the decoded value and bytes read
     */
    decode(buffer, offset) {
        return {
            value: buffer.toString('utf8', offset, offset + this.length).replace(/\0.*$/g,''),
            bytes_read: this.length
        };
    }

    /**
     * Encode a string into buffer with null-termination if shorter than max length
     * @param {string} value - The string to encode
     * @param {Buffer} buffer - The buffer to encode into
     * @param {number} offset - The offset in the buffer
     * @param {Object} [options={}] - Encoding options
     * @param {boolean} [options.unsafe=false] - Skip validation for performance
     * @returns {number} The number of bytes written
     * @throws {ParserError} If value is undefined/null or string length exceeds maximum length (unless unsafe=true)
     */
    encode(value, buffer, offset, { unsafe = false } = {}) {
        if (!unsafe) {
            this.validate(value);
        }
        
        buffer.write(value, offset, this.length, 'utf8');
        // Null-terminate if shorter
        if (value.length < this.length) {
            buffer.fill(0, offset + value.length, offset + this.length);
        }
        return this.length;
    }

    /**
     * Validate a string value
     * @param {string} value - The string to validate
     * @returns {boolean} True if valid
     * @throws {ParserError} If value is invalid
     */
    validate(value) {
        _throw_if_nullish(value, 'FixedStringType');
        
        if (typeof value !== 'string') {
            throw new ParserError(`FixedStringType value must be a string, got ${typeof value}`);
        }
        
        if (value.length > this.length) {
            throw new ParserError(`FixedStringType length exceeds fixed length: ${value.length} > ${this.length}`);
        }
        
        return true;
    }

    /**
     * Convert the string type to JSON representation
     * @returns {{type: string, length: number}} JSON representation
     */
    to_json() {
        return {
            type: "FixedStringType",
            length: this.length
        };
    }
}

/**
 * Variable-length string type that uses a length prefix (Default: UInt16)
 * @class
 * @extends Type
 */
class VarStringType extends Type {
    /**
     * Create a new VarStringType instance
     * @param {number} [max_length=65535] - The maximum byte length of the string
     */
    constructor(max_length = 65535) {
        super();
        if ( max_length < 1 || max_length > 4294967295 ) {
            throw new Error("max_length must be between 1 and 4294967296");
        }
        /**
         * The maximum byte length of the string
         * @type {number}
         * @private
         */
        this.max_length = max_length;

        /**
         * Bytes used for length prefix
         * @type {number}
         * @private
         */
        this._header_size = this.max_length < 256 ? 1 : (this.max_length < 65536 ? 2 : 4);
    }

    /**
     * Get the byte length for this type (returns null for variable length types)
     * @type {number|null}
     * @readonly
     */
    get byte_length() {
        return null; // Variable length type
    }

    /**
     * Check if this type has a static (compile-time known) length
     * @type {boolean}
     * @readonly
     */
    get is_static_length() {
        return false; // Variable length type
    }

    /**
     * Calculate the byte length for a specific string value
     * @param {string} value - The string value to calculate length for
     * @returns {number} The total byte length (header size + string bytes)
     */
    calculate_byte_length(value) {
        if (typeof value !== 'string') {
            throw new ParserError(`VarStringType value must be a string, got ${typeof value}`);
        }
        const string_bytes = Buffer.byteLength(value, 'utf8');
        return this._header_size + string_bytes;
    }

    /**
     * Decode a variable-length string from buffer
     * @param {Buffer} buffer - The buffer to decode from
     * @param {number} offset - The offset in the buffer
     * @returns {{value: string, bytes_read: number}} The decoded string and bytes consumed
     */
    decode(buffer, offset) {
        const header_size = this._header_size;
        
        if (buffer.length < offset + header_size) {
            throw new ParserError('Buffer too small to read string length');
        }

        const length = header_size === 1 
            ? buffer.readUInt8(offset)
            : header_size === 2
                ? buffer.readUInt16LE(offset)
                : buffer.readUInt32LE(offset);
            
        if (buffer.length < offset + header_size + length) {
            throw new ParserError(`Buffer too small to read string of length ${length}`);
        }

        const value = buffer.toString('utf8', offset + header_size, offset + header_size + length);
        return { value, bytes_read: header_size + length };
    }

    /**
     * Encode a string into buffer with length prefix
     * @param {string} value - The string to encode
     * @param {Buffer} buffer - The buffer to encode into
     * @param {number} offset - The offset in the buffer
     * @param {Object} [options={}] - Encoding options
     * @param {boolean} [options.unsafe=false] - Skip validation for performance
     * @returns {number} The number of bytes written
     * @throws {ParserError} If value is invalid (unless unsafe=true)
     */
    encode(value, buffer, offset, { unsafe = false } = {}) {
        if (!unsafe) {
            this.validate(value);
        }

        const string_bytes = Buffer.byteLength(value, 'utf8');
        const header_size = this._header_size;
        const total_bytes = header_size + string_bytes;

        if (buffer.length < offset + total_bytes) {
            throw new ParserError(`Buffer too small to encode string. Required: ${total_bytes}, Available: ${buffer.length - offset}`);
        }

        // Write length prefix
        if (header_size === 1) {
            buffer.writeUInt8(string_bytes, offset);
        } else if (header_size === 2) {
            buffer.writeUInt16LE(string_bytes, offset);
        } else {
            buffer.writeUInt32LE(string_bytes, offset);
        }
        
        // Write string
        buffer.write(value, offset + header_size, string_bytes, 'utf8');

        return total_bytes;
    }

    /**
     * Validate a string value
     * @param {string} value - The string to validate
     * @returns {boolean} True if valid
     * @throws {ParserError} If value is invalid
     */
    validate(value) {
        _throw_if_nullish(value, 'VarStringType');
        
        if (typeof value !== 'string') {
            throw new ParserError(`VarStringType value must be a string, got ${typeof value}`);
        }
        
        const string_bytes = Buffer.byteLength(value, 'utf8');
        if (string_bytes > this.max_length) {
            throw new ParserError(`FixedStringType byte length exceeds maximum: ${string_bytes} > ${this.max_length}`);
        }
        
        // Check header size limits
        const max_header_value = this._header_size === 1 ? 255 : (this._header_size == 2 ? 65535 : 4294967295);
        if (string_bytes > max_header_value) {
            throw new ParserError(`FixedStringType byte length exceeds header maximum: ${string_bytes} > ${max_header_value}`);
        }
        
        return true;
    }

    /**
     * Convert the string type to JSON representation
     * @returns {{type: string, max_length: number}} JSON representation
     */
    to_json() {
        return {
            type: "VarStringType",
            max_length: this.max_length
        };
    }
}

/**
 * Variable-length buffer type that uses a length prefix (Default: UInt16)
 * @class
 * @extends Type
 */
class VarBufferType extends Type {
    /**
     * Create a new VarBufferType instance
     * @param {number} [max_length=65535] - The maximum byte length of the string
     */
    constructor(max_length = 65535) {
        super();
        if ( max_length < 1 || max_length > 4294967295 ) {
            throw new Error("max_length must be between 1 and 4294967296");
        }
        /**
         * The maximum byte length of the string
         * @type {number}
         * @private
         */
        this.max_length = max_length;

        /**
         * Bytes used for length prefix
         * @type {number}
         * @private
         */
        this._header_size = this.max_length < 256 ? 1 : (this.max_length < 65536 ? 2 : 4);
    }

    /**
     * Get the byte length for this type (returns null for variable length types)
     * @type {number|null}
     * @readonly
     */
    get byte_length() {
        return null; // Variable length type
    }

    /**
     * Check if this type has a static (compile-time known) length
     * @type {boolean}
     * @readonly
     */
    get is_static_length() {
        return false; // Variable length type
    }

    /**
     * Calculate the byte length for a specific string value
     * @param {string} value - The string value to calculate length for
     * @returns {number} The total byte length (header size + string bytes)
     */
    calculate_byte_length(value) {
        if ( !Buffer.isBuffer(value) ) {
            throw new ParserError(`VarBufferType value must be a Buffer, got ${typeof value}`);
        }
        return this._header_size + value.length;
    }

    /**
     * Decode a variable-length string from buffer
     * @param {Buffer} buffer - The buffer to decode from
     * @param {number} offset - The offset in the buffer
     * @returns {{value: string, bytes_read: number}} The decoded string and bytes consumed
     */
    decode(buffer, offset) {
        const header_size = this._header_size;
        
        if (buffer.length < offset + header_size) {
            throw new ParserError('Buffer too small to read buffer length');
        }

        const length = header_size === 1 
            ? buffer.readUInt8(offset)
            : header_size === 2
                ? buffer.readUInt16LE(offset)
                : buffer.readUInt32LE(offset);
            
        if (buffer.length < offset + header_size + length) {
            throw new ParserError(`Buffer too small to read buffer of length ${length}`);
        }

        return {
            value: buffer.slice(offset + header_size, offset + header_size + length),
            bytes_read: header_size + length
        };
    }

    /**
     * Encode a buffer into buffer with length prefix
     * @param {Buffer} value - The buffer to encode
     * @param {Buffer} buffer - The buffer to encode into
     * @param {number} offset - The offset in the buffer
     * @param {Object} [options={}] - Encoding options
     * @param {boolean} [options.unsafe=false] - Skip validation for performance
     * @returns {number} The number of bytes written
     * @throws {ParserError} If value is invalid (unless unsafe=true)
     */
    encode(value, buffer, offset, { unsafe = false } = {}) {
        if (!unsafe) {
            this.validate(value);
        }

        const length = value.length;
        const header_size = this._header_size;
        const total_bytes = header_size + length;

        if (buffer.length < offset + total_bytes) {
            throw new ParserError(`Buffer too small to encode buffer. Required: ${total_bytes}, Available: ${buffer.length - offset}`);
        }

        // Write length prefix
        if (header_size === 1) {
            buffer.writeUInt8(length, offset);
        } else if (header_size === 2) {
            buffer.writeUInt16LE(length, offset);
        } else {
            buffer.writeUInt32LE(length, offset);
        }
        
        // Write string
        value.copy(buffer, offset + header_size);

        return total_bytes;
    }

    /**
     * Validate a buffer value
     * @param {Buffer} value - The Buffer to validate
     * @returns {boolean} True if valid
     * @throws {ParserError} If value is invalid
     */
    validate(value) {
        _throw_if_nullish(value, 'VarBufferType');
        
        if (!Buffer.isBuffer(value)) {
            throw new ParserError(`VarBufferType value must be a buffer, got ${typeof value}`);
        }
        
        const length = value.length;
        if (length > this.max_length) {
            throw new ParserError(`VarBufferType byte length exceeds maximum: ${length} > ${this.max_length}`);
        }
        
        // Check header size limits
        const max_header_value = this._header_size === 1 ? 255 : (this._header_size == 2 ? 65535 : 4294967295);
        if (length > max_header_value) {
            throw new ParserError(`VarBufferType byte length exceeds header maximum: ${length} > ${max_header_value}`);
        }
        
        return true;
    }

    /**
     * Convert the buffer type to JSON representation
     * @returns {{type: string, max_length: number}} JSON representation
     */
    to_json() {
        return {
            type: "VarBufferType",
            max_length: this.max_length
        };
    }
}

/**
 * Arbitrary Objects encoded as JSON strings (Requires mcx character length, UInt16)
 * @class
 * @extends Type
 */
class JSONType extends Type {
    /**
     * Create a new JSONType instance
     * @param {number} [max_length=65535] - The maximum number of characters in the JSON string
     */
    constructor(max_length = 65535) {
        super();
        if ( max_length < 1 || max_length > 4294967295 ) {
            throw new Error("max_length must be between 1 and 4294967296");
        }
        /**
         * The maximum byte length of the string
         * @type {number}
         * @private
         */
        this.max_length = max_length;

        /**
         * Bytes used for length prefix
         * @type {number}
         * @private
         */
        this._header_size = this.max_length < 256 ? 1 : (this.max_length < 65536 ? 2 : 4);
    }

    /**
     * Get the byte length for this type (returns null for variable length types)
     * @type {number|null}
     * @readonly
     */
    get byte_length() {
        return null; // Variable length type
    }

    /**
     * Check if this type has a static (compile-time known) length
     * @type {boolean}
     * @readonly
     */
    get is_static_length() {
        return false; // Variable length type
    }

    /**
     * Calculate the byte length for a specific string value
     * @param {string} value - The string value to calculate length for
     * @returns {number} The total byte length (header size + string bytes)
     */
    calculate_byte_length(value) {
        const string_bytes = Buffer.byteLength(JSON.stringify(value), 'utf8');
        return this._header_size + string_bytes;
    }

    /**
     * Decode a json-encoded object from buffer
     * @param {Buffer} buffer - The buffer to decode from
     * @param {number} offset - The offset in the buffer
     * @returns {{value: string, bytes_read: number}} The decoded string and bytes consumed
     */
    decode(buffer, offset) {
        const header_size = this._header_size;
        
        if (buffer.length < offset + header_size) {
            throw new ParserError('Buffer too small to read string length');
        }

        const length = header_size === 1 
            ? buffer.readUInt8(offset)
            : header_size === 2
                ? buffer.readUInt16LE(offset)
                : buffer.readUInt32LE(offset);
            
        if (buffer.length < offset + header_size + length) {
            throw new ParserError(`Buffer too small to read string of length ${length}`);
        }

        const value = JSON.parse(buffer.toString('utf8', offset + header_size, offset + header_size + length));
        return { value, bytes_read: header_size + length };
    }

    /**
     * Encode a string into buffer with length prefix
     * @param {string} value - The string to encode
     * @param {Buffer} buffer - The buffer to encode into
     * @param {number} offset - The offset in the buffer
     * @param {Object} [options={}] - Encoding options
     * @param {boolean} [options.unsafe=false] - Skip validation for performance
     * @returns {number} The number of bytes written
     * @throws {ParserError} If value is invalid (unless unsafe=true)
     */
    encode(value, buffer, offset, { unsafe = false } = {}) {
        const stringified = JSON.stringify(value);

        if (!unsafe) {
            this.validate(value, stringified);
        }

        const string_bytes = Buffer.byteLength(stringified, 'utf8');
        const header_size = this._header_size;
        const total_bytes = header_size + string_bytes;

        if (buffer.length < offset + total_bytes) {
            throw new ParserError(`Buffer too small to encode string. Required: ${total_bytes}, Available: ${buffer.length - offset}`);
        }

        // Write length prefix
        if (header_size === 1) {
            buffer.writeUInt8(string_bytes, offset);
        } else if (header_size === 2) {
            buffer.writeUInt16LE(string_bytes, offset);
        } else {
            buffer.writeUInt32LE(string_bytes, offset);
        }
        
        // Write string
        buffer.write(stringified, offset + header_size, string_bytes, 'utf8');

        return total_bytes;
    }

    /**
     * Validate a string value
     * @param {string} value - The string to validate
     * @param {string|null} stringified - Pre-stringified value for efficiency (optional)
     * @returns {boolean} True if valid
     * @throws {ParserError} If value is invalid
     */
    validate(value, stringified=null) {
        if ( !stringified ) stringified = JSON.stringify(value);

        const string_bytes = Buffer.byteLength(stringified, 'utf8');
        if (string_bytes > this.max_length) {
            throw new ParserError(`JSONType character length exceeds maximum: ${string_bytes} > ${this.max_length}`);
        }
        
        // Check header size limits
        const max_header_value = this._header_size === 1 ? 255 : (this._header_size == 2 ? 65535 : 4294967295);
        if (string_bytes > max_header_value) {
            throw new ParserError(`JSONType character length exceeds header maximum: ${string_bytes} > ${max_header_value}`);
        }
        
        return true;
    }

    /**
     * Convert the string type to JSON representation
     * @returns {{type: string, max_length: number}} JSON representation
     */
    to_json() {
        return {
            type: "JSONType",
            max_length: this.max_length
        };
    }
}

/**
 * Enumeration type for representing a fixed set of string options
 * @class
 * @extends Type
 */
class EnumType extends Type {
    constructor(options=[]) {
        super();
        /**
         * Array of string options for the enum
         * @type {string[]}
         * @private
         */
        this.options = options;
        /**
         * Number of bytes needed to store the enum index (1, 2, or 4 bytes)
         * @type {number}
         * @private
         */
        this._bytes_length = options.length <= 256 ? 1 : options.length <= 65536 ? 2 : 4;
    }

    /**
     * Get the byte length needed for this enum type
     * @type {number}
     * @readonly
     */
    get byte_length() {
        return this._bytes_length;
    }

    /**
     * Decode an enum value from buffer by reading its index
     * @param {Buffer} buffer - The buffer to decode from
     * @param {number} offset - The offset in the buffer
     * @returns {{value: string, bytes_read: number}} Object containing the decoded value and bytes read
     * @throws {ParserError} If the index is out of range
     */
    decode(buffer, offset) {
        let index;
        if (this._bytes_length === 1) {
            index = buffer.readUInt8(offset);
        } else if (this._bytes_length === 2) {
            index = buffer.readUInt16LE(offset);
        } else {
            index = buffer.readUInt32LE(offset);
        }
        if (index >= this.options.length) {
            throw new ParserError(`EnumType index out of range: ${index} >= ${this.options.length}`);
        }
        return {
            value: this.options[index],
            bytes_read: this._bytes_length
        };
    }

    /**
     * Encode an enum value into buffer by writing its index
     * @param {string} value - The enum option string to encode
     * @param {Buffer} buffer - The buffer to encode into
     * @param {number} offset - The offset in the buffer
     * @param {Object} [options={}] - Encoding options
     * @param {boolean} [options.unsafe=false] - Skip validation for performance
     * @returns {void}
     * @throws {ParserError} If value is undefined/null or not found in enum options (unless unsafe=true)
     */
    encode(value, buffer, offset, { unsafe = false } = {}) {
        if (!unsafe) {
            this.validate(value);
        }
        
        const index = this.options.indexOf(value);
        if (!unsafe && index === -1) {
            throw new ParserError(`EnumType value not found: ${value}`);
        }
        if (this._bytes_length === 1) {
            buffer.writeUInt8(index, offset);
        } else if (this._bytes_length === 2) {
            buffer.writeUInt16LE(index, offset);
        } else {
            buffer.writeUInt32LE(index, offset);
        }
        return this._bytes_length;
    }

    /**
     * Validate an enum value
     * @param {string} value - The enum value to validate
     * @returns {boolean} True if valid
     * @throws {ParserError} If value is invalid
     */
    validate(value) {
        _throw_if_nullish(value, 'EnumType');
        
        if (typeof value !== 'string') {
            throw new ParserError(`EnumType value must be a string, got ${typeof value}`);
        }
        
        if (this.options.indexOf(value) === -1) {
            throw new ParserError(`EnumType value not found: ${value}. Valid options: ${this.options.join(', ')}`);
        }
        
        return true;
    }

    /**
     * Convert the enum type to JSON representation
     * @returns {{type: string, options: string[]}} JSON representation
     */
    to_json() {
        return {
            type: "EnumType",
            options: this.options
        };
    }
}

/**
 * OptionalType type wrapper that can represent null/undefined values
 * @class
 * @extends Type
 */
class OptionalType extends Type {
    /**
     * Create a new OptionalType instance
     * @param {Type} base_type - The base type to wrap as optional
     */
    constructor(base_type) {
        super();
        /**
         * The base type that this optional type wraps
         * @type {Type}
         * @private
         */
        this.base_type = base_type;
    }

    /**
     * Get the byte length (1 byte for presence flag + base type length)
     * Returns null if base type has variable length
     * @type {number|null}
     * @readonly
     */
    get byte_length() {
        if (!this.base_type.is_static_length) {
            return null; // Variable length if base type is variable
        }
        return 1 + this.base_type.byte_length;
    }

    /**
     * Check if this type has a static (compile-time known) length
     * @type {boolean}
     * @readonly
     */
    get is_static_length() {
        return this.base_type.is_static_length;
    }

    /**
     * Calculate the byte length for a specific optional value
     * @param {*} value - The value to calculate length for
     * @returns {number} The total byte length for encoding this optional value
     */
    calculate_byte_length(value) {
        if (value === null || value === undefined) {
            if (!this.base_type.is_static_length) {
                // Variable-length base type - null only takes 1 byte
                return 1;
            } else {
                // Fixed-length base type - always consume full space for alignment
                return 1 + this.base_type.byte_length;
            }
        }
        return 1 + this.base_type.calculate_byte_length(value);
    }

    /**
     * Decode an optional value from buffer
     * @param {Buffer} buffer - The buffer to decode from
     * @param {number} offset - The offset in the buffer
     * @returns {{value: *, bytes_read: number}} Object containing the decoded value (or null) and bytes read
     */
    decode(buffer, offset) {
        const is_present = buffer.readUInt8(offset) !== 0;
        if (!is_present) {
            if (!this.base_type.is_static_length) {
                // Variable-length base type - null only consumes 1 byte
                return { value: null, bytes_read: 1 };
            } else {
                // Fixed-length base type - always consume full space for alignment
                return { value: null, bytes_read: 1 + this.base_type.byte_length };
            }
        }
        
        const decoded = this.base_type.decode(buffer, offset + 1);
        return { value: decoded.value, bytes_read: 1 + decoded.bytes_read };
    }

    /**
     * Encode an optional value into buffer
     * @param {*|null|undefined} value - The value to encode (null/undefined for absent)
     * @param {Buffer} buffer - The buffer to encode into
     * @param {number} offset - The offset in the buffer
     * @param {Object} [options={}] - Encoding options
     * @param {boolean} [options.unsafe=false] - Skip validation for performance
     * @returns {number} The number of bytes written
     * @throws {ParserError} If value is invalid (unless unsafe=true)
     */
    encode(value, buffer, offset, { unsafe = false } = {}) {
        if (!unsafe) {
            this.validate(value);
        }
        if (value === null || value === undefined) {
            buffer.writeUInt8(0, offset);
            if (!this.base_type.is_static_length) {
                // Variable-length base type - null only takes 1 byte
                return 1;
            } else {
                // Fixed-length base type - always consume full space for alignment
                // Fill with zeros (though they won't be read)
                buffer.fill(0, offset + 1, offset + 1 + this.base_type.byte_length);
                return 1 + this.base_type.byte_length;
            }
        } else {
            buffer.writeUInt8(1, offset);
            if (!this.base_type.is_static_length) {
                // Variable-length base type - encode returns bytes written
                const bytesWritten = this.base_type.encode(value, buffer, offset + 1, { unsafe:false }); // Can skip validation, because we already handled it above
                return 1 + bytesWritten;
            } else {
                // Fixed-length base type
                this.base_type.encode(value, buffer, offset + 1, { unsafe:false }); // Can skip validation, because we already handled it above
                return 1 + this.base_type.byte_length;
            }
        }
    }

    /**
     * Validate an optional value
     * @param {*|null|undefined} value - The value to validate
     * @returns {boolean} True if valid
     * @throws {ParserError} If value is invalid
     */
    validate(value) {
        // null and undefined are always valid for OptionalType
        if (value === null || value === undefined) {
            return true;
        }
        
        // If value is present, validate it against the base type
        return this.base_type.validate(value);
    }

    /**
     * Convert the optional type to JSON representation
     * @returns {{type: string, base_type: Object}} JSON representation
     */
    to_json() {
        return {
            type: "OptionalType",
            base_type: this.base_type.to_json()
        };
    }
}


/**
 * TupleType type for fixed-length sequences of heterogeneous types
 * @class
 * @extends Type
 */
class TupleType extends Type {
    /**
     * Create a new TupleType instance
     * @param {...Type} element_types - The types for each element in the tuple
     */
    constructor(...element_types) {
        super();
        // Allow empty tuples for edge cases
        /**
         * Array of types for each tuple element
         * @type {Type[]}
         * @private
         */
        this.element_types = element_types;
    }

    /**
     * Get the total byte length for the tuple
     * Returns null if any element type has variable length
     * @type {number|null}
     * @readonly
     */
    get byte_length() {
        let totalLength = 0;
        for (const elementType of this.element_types) {
            if (elementType.byte_length === null) {
                return null; // Variable length tuple if any element is variable
            }
            totalLength += elementType.byte_length;
        }
        return totalLength;
    }

    /**
     * Check if this type has a static (compile-time known) length
     * @type {boolean}
     * @readonly
     */
    get is_static_length() {
        // TupleType is static only if ALL elements are static
        return this.element_types.every(elementType => elementType.is_static_length);
    }

    /**
     * Calculate the byte length for a specific tuple value
     * @param {Array} value - The tuple value to calculate length for
     * @returns {number} The total byte length for encoding this tuple
     */
    calculate_byte_length(value) {
        if (!Array.isArray(value)) {
            throw new ParserError(`TupleType value must be an array, got ${typeof value}`);
        }
        
        if (value.length !== this.element_types.length) {
            throw new ParserError(`TupleType length mismatch: expected ${this.element_types.length}, got ${value.length}`);
        }

        let totalLength = 0;
        for (let i = 0; i < this.element_types.length; i++) {
            totalLength += this.element_types[i].calculate_byte_length(value[i]);
        }
        
        return totalLength;
    }

    /**
     * Decode a tuple from buffer
     * @param {Buffer} buffer - The buffer to decode from
     * @param {number} offset - The offset in the buffer
     * @returns {{value: Array, bytes_read: number}} Object with decoded tuple and bytes read
     */
    decode(buffer, offset) {
        const tuple = [];
        let currentOffset = offset;
        
        for (let i = 0; i < this.element_types.length; i++) {
            const decoded = this.element_types[i].decode(buffer, currentOffset);
            tuple.push(decoded.value);
            currentOffset += decoded.bytes_read;
        }
        
        return { value: tuple, bytes_read: currentOffset - offset };
    }

    /**
     * Encode a tuple into buffer
     * @param {Array} value - The tuple to encode
     * @param {Buffer} buffer - The buffer to encode into
     * @param {number} offset - The offset in the buffer
     * @param {Object} [options={}] - Encoding options
     * @param {boolean} [options.unsafe=false] - Skip validation for performance
     * @returns {number} Number of bytes written
     * @throws {ParserError} If value is invalid (unless unsafe=true)
     */
    encode(value, buffer, offset, { unsafe = false } = {}) {
        if (!unsafe) {
            this.validate(value);
        }
        
        let currentOffset = offset;
        for (let i = 0; i < this.element_types.length; i++) {
            const bytesWritten = this.element_types[i].encode(value[i], buffer, currentOffset, { unsafe: false }); // Can skip validation, because we already handled it above
            currentOffset += bytesWritten;
        }
        
        return currentOffset - offset;
    }

    /**
     * Validate a tuple value
     * @param {Array} value - The tuple to validate
     * @returns {boolean} True if valid
     * @throws {ParserError} If value is invalid
     */
    validate(value) {
        _throw_if_nullish(value, 'TupleType');
        
        if (!Array.isArray(value)) {
            throw new ParserError(`TupleType value must be an array, got ${typeof value}`);
        }
        
        if (value.length !== this.element_types.length) {
            throw new ParserError(`TupleType length mismatch: expected ${this.element_types.length}, got ${value.length}`);
        }
        
        // Validate each element in the tuple
        for (let i = 0; i < this.element_types.length; i++) {
            try {
                this.element_types[i].validate(value[i]);
            } catch (error) {
                throw new ParserError(`TupleType element at index ${i} is invalid: ${error.message}`);
            }
        }
        
        return true;
    }

    /**
     * Convert the tuple type to JSON representation
     * @returns {{type: string, element_types: Object[]}} JSON representation
     */
    to_json() {
        return {
            type: "TupleType",
            element_types: this.element_types.map(elementType => elementType.to_json())
        };
    }
}


/**
 * MapType type for key-value pairs with defined value types
 * @class
 * @extends Type
 */
class MapType extends Type {
    /**
     * Create a new MapType instance
     * @param {Array<[string, Type]>} field_pairs - Array of [key, Type] pairs
     */
    constructor(field_pairs) {
        super();
        if (!Array.isArray(field_pairs)) {
            throw new ParserError('MapType requires an array of [key, Type] pairs');
        }
        // Allow empty maps for edge cases
        
        // Validate each pair
        for (let i = 0; i < field_pairs.length; i++) {
            const pair = field_pairs[i];
            if (!Array.isArray(pair) || pair.length !== 2) {
                throw new ParserError(`Field pair at index ${i} must be [key, Type] array`);
            }
            if (typeof pair[0] !== 'string') {
                throw new ParserError(`Field key at index ${i} must be a string`);
            }
            if (!pair[1] || typeof pair[1].encode !== 'function') {
                throw new ParserError(`Field type at index ${i} must be a valid Type instance`);
            }
        }
        
        /**
         * Array of [key, Type] pairs in insertion order
         * @type {Array<[string, Type]>}
         * @private
         */
        this.field_pairs = field_pairs;
        /**
         * Object mapping field names to their types (for quick lookup)
         * @type {Object<string, Type>}
         * @private
         */
        this.field_types = {};
        /**
         * Array of field names in insertion order
         * @type {string[]}
         * @private
         */
        this.field_names = [];
        
        // Build lookup objects
        for (const [key, type] of field_pairs) {
            this.field_types[key] = type;
            this.field_names.push(key);
        }
    }

    /**
     * Get the total byte length for the map
     * Returns null if any field type has variable length
     * @type {number|null}
     * @readonly
     */
    get byte_length() {
        let totalLength = 0;
        for (const fieldName of this.field_names) {
            const fieldType = this.field_types[fieldName];
            if (fieldType.byte_length === null) {
                return null; // Variable length map if any field is variable
            }
            totalLength += fieldType.byte_length;
        }
        return totalLength;
    }

    /**
     * Check if this type has a static (compile-time known) length
     * @type {boolean}
     * @readonly
     */
    get is_static_length() {
        // MapType is static only if ALL fields are static
        return this.field_names.every(fieldName => this.field_types[fieldName].is_static_length);
    }

    /**
     * Calculate the byte length for a specific map value
     * @param {Object} value - The map value to calculate length for
     * @returns {number} The total byte length for encoding this map
     */
    calculate_byte_length(value) {
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
            throw new ParserError(`MapType value must be an object, got ${typeof value}`);
        }

        let totalLength = 0;
        for (const fieldName of this.field_names) {
            try {
                totalLength += this.field_types[fieldName].calculate_byte_length(value[fieldName]);
            } catch (error) {
                throw new ParserError(`MapType field '${fieldName}' is invalid: ${error.message}`);
            }
        }
        
        return totalLength;
    }

    /**
     * Decode a map from buffer
     * @param {Buffer} buffer - The buffer to decode from
     * @param {number} offset - The offset in the buffer
     * @returns {{value: Object, bytes_read: number}} Object with decoded map and bytes read
     */
    decode(buffer, offset) {
        const map = {};
        let currentOffset = offset;
        
        for (const fieldName of this.field_names) {
            const decoded = this.field_types[fieldName].decode(buffer, currentOffset);
            map[fieldName] = decoded.value;
            currentOffset += decoded.bytes_read;
        }
        
        return { value: map, bytes_read: currentOffset - offset };
    }

    /**
     * Encode a map into buffer
     * @param {Object} value - The map to encode
     * @param {Buffer} buffer - The buffer to encode into
     * @param {number} offset - The offset in the buffer
     * @param {Object} [options={}] - Encoding options
     * @param {boolean} [options.unsafe=false] - Skip validation for performance
     * @returns {number} Number of bytes written
     * @throws {ParserError} If value is invalid (unless unsafe=true)
     */
    encode(value, buffer, offset, { unsafe = false } = {}) {
        if (!unsafe) {
            this.validate(value);
        }
        
        let currentOffset = offset;
        for (const fieldName of this.field_names) {
            const bytesWritten = this.field_types[fieldName].encode(value[fieldName], buffer, currentOffset, { unsafe });
            currentOffset += bytesWritten;
        }
        
        return currentOffset - offset;
    }

    /**
     * Validate a map value
     * @param {Object} value - The map to validate
     * @returns {boolean} True if valid
     * @throws {ParserError} If value is invalid
     */
    validate(value) {
        _throw_if_nullish(value, 'MapType');
        
        if (typeof value !== 'object' || Array.isArray(value)) {
            throw new ParserError(`MapType value must be an object, got ${typeof value}`);
        }
        
        // Validate each field in the map
        for (const fieldName of this.field_names) {
            try {
                this.field_types[fieldName].validate(value[fieldName]);
            } catch (error) {
                throw new ParserError(`MapType field '${fieldName}' is invalid: ${error.message}`);
            }
        }
        
        return true;
    }

    /**
     * Convert the map type to JSON representation
     * @returns {{type: string, field_pairs: Array<[string, Object]>}} JSON representation
     */
    to_json() {
        return {
            type: "MapType",
            field_pairs: this.field_pairs.map(([key, type]) => [key, type.to_json()])
        };
    }
}


/**
 * Create a Type instance from a JSON representation
 * @param {Object} obj - JSON representation of a type
 * @param {string} obj.type - The type name
 * @returns {Type} A new Type instance
 * @throws {Error} If the type is unknown
 * @example
 * // Create a UInt32 type
 * const uint32Type = from_json({ type: "UInt32" });
 * 
 * // Create an array of 5 UInt8 values
 * const arrayType = from_json({
 *   type: "ArrayType",
 *   element_type: { type: "UInt8" },
 *   length: 5
 * });
 * 
 * // Create an optional string
 * const optionalString = from_json({
 *   type: "OptionalType",
 *   base_type: { type: "FixedStringType", length: 10 }
 * });
 */
function from_json(obj) {
    switch (obj.type) {
        case "UInt": return new UInt(obj.byte_length);
        case "Int": return new Int(obj.byte_length);
        case "Float": return new Float(obj.byte_length);
        case "UInt8": return new UInt8();
        case "UInt16": return new UInt16();
        case "UInt32": return new UInt32();
        case "Int8": return new Int8();
        case "Int16": return new Int16();
        case "Int32": return new Int32();
        case "Float32": return new Float32();
        case "Float64": return new Float64();
        case "BooleanType": return new BooleanType();
        case "Char": return new Char();
        case "ArrayType":
            return new ArrayType(from_json(obj.element_type), obj.length);
        case "FixedStringType":
            return new FixedStringType(obj.length);
        case "VarStringType":
            return new VarStringType(obj.max_length);
        case "VarBufferType":
            return new VarBufferType(obj.max_length);
        case "JSONType":
            return new JSONType(obj.max_length);
        case "EnumType":
            return new EnumType(obj.options);
        case "OptionalType":
            return new OptionalType(from_json(obj.base_type));
        case "TupleType":
            return new TupleType(...obj.element_types.map(elementType => from_json(elementType)));
        case "MapType":
            return new MapType(obj.field_pairs.map(([key, typeObj]) => [key, from_json(typeObj)]));
        default:
            throw new Error(`Unknown type: ${obj.type}`);
    }
}

/**
 * Module exports for type definitions and utilities
 * @namespace
 */
module.exports = {
    /** @type {typeof ParserError} Custom error class for parsing operations */
    ParserError,
    /** @type {typeof Type} Base class for all data types */
    Type,
    /** @type {typeof UInt} Unified unsigned integer type */
    UInt,
    /** @type {typeof Int} Unified signed integer type */
    Int,
    /** @type {typeof Float} Unified floating point type */
    Float,
    /** @type {typeof UInt8} Unsigned 8-bit integer type */
    UInt8,
    /** @type {typeof UInt16} Unsigned 16-bit integer type */
    UInt16,
    /** @type {typeof UInt32} Unsigned 32-bit integer type */
    UInt32,
    /** @type {typeof Int8} Signed 8-bit integer type */
    Int8,
    /** @type {typeof Int16} Signed 16-bit integer type */
    Int16,
    /** @type {typeof Int32} Signed 32-bit integer type */
    Int32,
    /** @type {typeof Float32} 32-bit floating point type */
    Float32,
    /** @type {typeof Float64} 64-bit floating point type */
    Float64,
    /** @type {typeof BooleanType} BooleanType type */
    BooleanType,
    /** @type {typeof Char} Single character type */
    Char,
    /** @type {typeof ArrayType} Fixed-length array type */
    ArrayType,
    /** @type {typeof FixedStringType} Fixed-length string type */
    FixedStringType,
    /** @type {typeof VarStringType} Variable-length string type */
    VarStringType,
    /** @type {typeof VarBufferType} Variable-length buffer type */
    VarBufferType,
    /** @type {typeof JSONType} JSON-endoded object type */
    JSONType,
    /** @type {typeof EnumType} Enumeration type */
    EnumType,
    /** @type {typeof OptionalType} OptionalType value wrapper type */
    OptionalType,
    /** @type {typeof TupleType} Fixed-length tuple of heterogeneous types */
    TupleType,
    /** @type {typeof MapType} Key-value map type with defined field types */
    MapType,
    /** @type {typeof from_json} Function to create types from JSON */
    from_json
}
