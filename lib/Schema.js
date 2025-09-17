
/**
 * @fileoverview Schema class for wrapping and managing a single Type
 */

const { ParserError } = require('./types');

/**
 * Schema class for wrapping a single Type with encoding/decoding capabilities
 * @class
 */
module.exports = class Schema {
    /**
     * Create a new Schema instance
     * @constructor
     * @param {import('./types').Type} type - The root type for this schema
     */
    constructor(type) {
        if (!type) {
            throw new ParserError('Schema requires a Type');
        }
        
        /**
         * The root type for this schema
         * @type {import('./types').Type}
         * @private
         */
        this._type = type;
    }

    /**
     * Get the total byte length required for the schema
     * Returns null if the type has variable length
     * @type {number|null}
     * @readonly
     */
    get byte_length() {
        return this._type.byte_length;
    }

    /**
     * Calculate the total byte length for a specific value
     * @param {*} value - The value to calculate length for
     * @returns {number} The total byte length required for encoding this value
     */
    calculate_byte_length(value) {
        return this._type.calculate_byte_length(value);
    }

    /**
     * Get whether the schema has a static (fixed) length
     * @type {boolean}
     * @readonly
     */
    get is_static_length() {
        return this._type.is_static_length;
    }
    
    /**
     * Validates a value against this schema
     * @param {*} value - The value to validate
     * @throws {ParserError} If validation fails
     */
    validate(value) {
        try {
            this._type.validate(value);
        } catch (error) {
            if (error instanceof ParserError) {
                throw new ParserError(`Schema validation failed: ${error.message}`);
            }
            throw error;
        }
    }

    /**
     * Encode a value into a provided buffer according to the schema
     * @param {*} value - The value to encode
     * @param {Buffer} buffer - Buffer to write to (required)
     * @param {number} [offset=0] - Offset in the buffer to start writing at
     * @param {Object} [options={}] - Encoding options
     * @param {boolean} [options.unsafe=false] - Skip validation for performance
     * @returns {number} The number of bytes written
     * @throws {ParserError} If buffer is not provided or is too small
     */
    encode(value, buffer, offset = 0, options = {}) {
        if (!buffer) {
            throw new ParserError('Buffer is required for encode(). Use serialize() to auto-allocate a buffer.');
        }
        
        if (!options.unsafe) {
            if (!Buffer.isBuffer(buffer)) {
                throw new ParserError('Provided buffer must be a Buffer instance');
            }
            
            const byte_length = this.calculate_byte_length(value);
            if ((buffer.length - offset) < byte_length) {
                throw new ParserError(`Buffer is too small. Required: ${byte_length}, Available: ${buffer.length - offset}`);
            }
        }

        return this._type.encode(value, buffer, offset, options);
    }

    /**
     * Serialize a value into a new buffer according to the schema
     * @param {*} value - The value to serialize
     * @param {number} [offset=0] - Number of bytes to pad at the start of the buffer
     * @param {Object} [options={}] - Encoding options
     * @param {boolean} [options.unsafe=false] - Skip validation for performance
     * @returns {Buffer} A new buffer containing the encoded data
     */
    serialize(value, offset = 0, options = {}) {
        const byte_length = this.calculate_byte_length(value);
        const buffer = Buffer.alloc(byte_length + offset);
        
        this._type.encode(value, buffer, offset, options);
        
        return buffer;
    }

    /**
     * Decode a buffer into a value according to the schema
     * @param {Buffer} buffer - The buffer to decode
     * @param {number} [offset=0] - Offset in the buffer to start reading from
     * @returns {{value: *, bytes_read: number}} The decoded value and bytes read
     * @throws {ParserError} If the buffer is too small for the schema
     */
    decode(buffer, offset = 0) {
        return this._type.decode(buffer, offset);
    }

    /**
     * Deserialize a buffer into a value according to the schema
     * @param {Buffer} buffer - The buffer to deserialize
     * @param {number} [offset=0] - Offset in the buffer to start reading from
     * @returns {*} The deserialized value (without wrapper)
     * @throws {ParserError} If the buffer is too small for the schema
     */
    deserialize(buffer, offset = 0) {
        const result = this._type.decode(buffer, offset);
        return result.value;
    }

    /**
     * Convert the schema to a JSON representation (non-snake_case alias)
     * @returns {Object} JSON representation of the schema
     */
    toJSON() {
        return this.to_json();
    }

    /**
     * Convert the schema to a JSON representation
     * @returns {Object} JSON representation of the schema
     */
    to_json() {
        return {
            type: 'Schema',
            root_type: this._type.to_json()
        };
    }

    /**
     * Create a Schema instance from a JSON representation
     * @param {Object} obj - JSON representation of the schema
     * @returns {Schema} A new Schema instance
     * @static
     */
    static from_json(obj) {
        const { from_json } = require('./types');
        return new Schema(from_json(obj.root_type));
    }
}
