/**
 * @fileoverview Tests for type encoding and decoding functionality
 */

const { expect } = require('chai');
const {
    ParserError, FixedStringType, VarStringType,
    from_json
} = require('../lib/types');


describe('FixedStringType', function() {
    let type;
    let buffer;

    beforeEach(function() {
        type = new FixedStringType(10);
        buffer = Buffer.alloc(10);
    });

    it('should have correct byte_length', function() {
        expect(type.byte_length).to.equal(10);
    });

    it('should encode and decode correctly', function() {
        const testString = 'Hello';
        
        type.encode(testString, buffer, 0);
        const decoded = type.decode(buffer, 0);
        expect(decoded.value).to.equal(testString);
    });

    it('should handle null termination for short strings', function() {
        const shortString = 'Hi';
        
        type.encode(shortString, buffer, 0);
        const decoded = type.decode(buffer, 0);
        expect(decoded.value).to.equal(shortString);
    });

    it('should throw error for strings too long', function() {
        const longString = 'This string is way too long for the buffer';
        expect(() => type.encode(longString, buffer, 0)).to.throw(ParserError, 'FixedStringType length exceeds fixed length');
    });

    it('should handle empty strings', function() {
        type.encode('', buffer, 0);
        const decoded = type.decode(buffer, 0);
        expect(decoded.value).to.equal('');
    });

    it('should throw ParserError for undefined/null strings', function() {
        expect(() => type.encode(undefined, buffer, 0)).to.throw(ParserError, 'Cannot encode undefined as FixedStringType');
        expect(() => type.encode(null, buffer, 0)).to.throw(ParserError, 'Cannot encode null as FixedStringType');
    });

    it('should return correct to_json', function() {
        const json = type.to_json();
        expect(json).to.deep.equal({
            type: 'FixedStringType',
            length: 10
        });
    });

    describe('from_json', function() {
        it('should create string types correctly', function() {
            const stringType = from_json({
                type: 'FixedStringType',
                length: 20
            });
            expect(stringType).to.be.instanceOf(FixedStringType);
            expect(stringType.length).to.equal(20);
        });
    });

});

describe('VarStringType', function() {
    describe('Constructor', function() {
        it('should create with default max_length', function() {
            const type = new VarStringType();
            expect(type.max_length).to.equal(65535);
        });

        it('should create with custom max_length', function() {
            const type = new VarStringType(1000);
            expect(type.max_length).to.equal(1000);
        });

        it('should throw error for invalid max_length', function() {
            expect(() => new VarStringType(0)).to.throw(Error, 'max_length must be between 1 and 4294967296');
            expect(() => new VarStringType(4294967296)).to.throw(Error, 'max_length must be between 1 and 4294967296');
            expect(() => new VarStringType(-1)).to.throw(Error, 'max_length must be between 1 and 4294967296');
        });
    });

    describe('Header size optimization', function() {
        it('should use 1-byte header for max_length < 256', function() {
            const type = new VarStringType(255);
            expect(type._header_size).to.equal(1);
            
            const type2 = new VarStringType(100);
            expect(type2._header_size).to.equal(1);
        });

        it('should use 2-byte header for max_length >= 256', function() {
            const type = new VarStringType(256);
            expect(type._header_size).to.equal(2);
            
            const type2 = new VarStringType(1000);
            expect(type2._header_size).to.equal(2);
            
            const type3 = new VarStringType();
            expect(type3._header_size).to.equal(2);
        });
    });

    describe('byte_length property', function() {
        it('should return null for variable length type', function() {
            const type = new VarStringType();
            expect(type.byte_length).to.be.null;
        });
    });

    describe('calculate_byte_length', function() {
        it('should calculate correct length with 1-byte header', function() {
            const type = new VarStringType(255);
            expect(type.calculate_byte_length('hello')).to.equal(6); // 1 + 5
            expect(type.calculate_byte_length('')).to.equal(1); // 1 + 0
            expect(type.calculate_byte_length('a')).to.equal(2); // 1 + 1
        });

        it('should calculate correct length with 2-byte header', function() {
            const type = new VarStringType(1000);
            expect(type.calculate_byte_length('hello')).to.equal(7); // 2 + 5
            expect(type.calculate_byte_length('')).to.equal(2); // 2 + 0
            expect(type.calculate_byte_length('a')).to.equal(3); // 2 + 1
        });

        it('should handle UTF-8 strings correctly', function() {
            const type = new VarStringType(1000);
            const utf8String = 'héllo 🌍';
            const utf8Bytes = Buffer.byteLength(utf8String, 'utf8');
            expect(type.calculate_byte_length(utf8String)).to.equal(2 + utf8Bytes);
        });

        it('should throw error for non-string values', function() {
            const type = new VarStringType();
            expect(() => type.calculate_byte_length(123)).to.throw(ParserError, 'VarStringType value must be a string, got number');
            expect(() => type.calculate_byte_length(null)).to.throw(ParserError, 'VarStringType value must be a string, got object');
            expect(() => type.calculate_byte_length(undefined)).to.throw(ParserError, 'VarStringType value must be a string, got undefined');
        });
    });

    describe('Encoding and decoding with 1-byte header', function() {
        let type;
        let buffer;

        beforeEach(function() {
            type = new VarStringType(200);
            buffer = Buffer.alloc(100);
        });

        it('should encode and decode short strings correctly', function() {
            const testString = 'Hello!';
            const bytesWritten = type.encode(testString, buffer, 0);
            expect(bytesWritten).to.equal(7); // 1 + 6

            // Check buffer content
            expect(buffer.readUInt8(0)).to.equal(6); // length
            expect(buffer.toString('utf8', 1, 7)).to.equal(testString);

            const decoded = type.decode(buffer, 0);
            expect(decoded.value).to.equal(testString);
            expect(decoded.bytes_read).to.equal(7);
        });

        it('should encode and decode empty strings', function() {
            const testString = '';
            const bytesWritten = type.encode(testString, buffer, 0);
            expect(bytesWritten).to.equal(1); // 1 + 0

            expect(buffer.readUInt8(0)).to.equal(0); // length

            const decoded = type.decode(buffer, 0);
            expect(decoded.value).to.equal(testString);
            expect(decoded.bytes_read).to.equal(1);
        });

        it('should handle maximum length strings for 1-byte header', function() {
            const testString = 'a'.repeat(200);
            const largeBuffer = Buffer.alloc(250); // Make buffer large enough
            const bytesWritten = type.encode(testString, largeBuffer, 0);
            expect(bytesWritten).to.equal(201); // 1 + 200

            const decoded = type.decode(largeBuffer, 0);
            expect(decoded.value).to.equal(testString);
            expect(decoded.bytes_read).to.equal(201);
        });
    });

    describe('Encoding and decoding with 2-byte header', function() {
        let type;
        let buffer;

        beforeEach(function() {
            type = new VarStringType(1000);
            buffer = Buffer.alloc(1100);
        });

        it('should encode and decode strings correctly', function() {
            const testString = 'This is a longer test string';
            const bytesWritten = type.encode(testString, buffer, 0);
            expect(bytesWritten).to.equal(30); // 2 + 28

            // Check buffer content
            expect(buffer.readUInt16LE(0)).to.equal(28); // length
            expect(buffer.toString('utf8', 2, 30)).to.equal(testString);

            const decoded = type.decode(buffer, 0);
            expect(decoded.value).to.equal(testString);
            expect(decoded.bytes_read).to.equal(30);
        });

        it('should handle long strings', function() {
            const testString = 'a'.repeat(500);
            const bytesWritten = type.encode(testString, buffer, 0);
            expect(bytesWritten).to.equal(502); // 2 + 500

            const decoded = type.decode(buffer, 0);
            expect(decoded.value).to.equal(testString);
            expect(decoded.bytes_read).to.equal(502);
        });
    });

    describe('Validation', function() {
        it('should validate correct strings', function() {
            const type = new VarStringType(100);
            expect(type.validate('hello')).to.be.true;
            expect(type.validate('')).to.be.true;
            expect(type.validate('a'.repeat(100))).to.be.true;
        });

        it('should throw ParserError for null/undefined values', function() {
            const type = new VarStringType();
            expect(() => type.validate(undefined)).to.throw(ParserError, 'Cannot encode undefined as VarStringType');
            expect(() => type.validate(null)).to.throw(ParserError, 'Cannot encode null as VarStringType');
        });

        it('should throw ParserError for non-string values', function() {
            const type = new VarStringType();
            expect(() => type.validate(123)).to.throw(ParserError, 'VarStringType value must be a string, got number');
            expect(() => type.validate({})).to.throw(ParserError, 'VarStringType value must be a string, got object');
            expect(() => type.validate([])).to.throw(ParserError, 'VarStringType value must be a string, got object');
        });

        it('should throw ParserError for strings exceeding max_length', function() {
            const type = new VarStringType(10);
            expect(() => type.validate('a'.repeat(11))).to.throw(ParserError, 'FixedStringType byte length exceeds maximum: 11 > 10');
        });

        it('should enforce header size limits correctly', function() {
            // Test 1-byte header limit (max 255 bytes)
            const type1 = new VarStringType(100); // 1-byte header, max_length = 100
            expect(type1._header_size).to.equal(1);
            expect(type1.validate('a'.repeat(100))).to.be.true; // Valid
            
            // Test 2-byte header capacity
            const type2 = new VarStringType(1000); // 2-byte header, max_length = 1000  
            expect(type2._header_size).to.equal(2);
            expect(type2.validate('a'.repeat(1000))).to.be.true; // Valid
            
            // Test maximum 2-byte header capacity
            const type3 = new VarStringType(65535); // 2-byte header, max at limit
            expect(type3._header_size).to.equal(2);
            expect(type3.validate('a'.repeat(65535))).to.be.true; // Valid at maximum
        });
    });

    describe('Error handling', function() {
        let type;

        beforeEach(function() {
            type = new VarStringType();
        });

        it('should throw error when buffer is too small for header', function() {
            const buffer = Buffer.alloc(1); // Too small for 2-byte header
            expect(() => type.decode(buffer, 0)).to.throw(ParserError, 'Buffer too small to read string length');
        });

        it('should throw error when buffer is too small for string content', function() {
            const buffer = Buffer.alloc(5);
            buffer.writeUInt16LE(10, 0); // Says string is 10 bytes, but buffer only has 3 remaining
            expect(() => type.decode(buffer, 0)).to.throw(ParserError, 'Buffer too small to read string of length 10');
        });

        it('should throw error when encoding to too small buffer', function() {
            const type = new VarStringType();
            const buffer = Buffer.alloc(5);
            const longString = 'This string is too long for the buffer';
            expect(() => type.encode(longString, buffer, 0)).to.throw(ParserError, 'Buffer too small to encode string');
        });
    });

    describe('UTF-8 support', function() {
        let type;
        let buffer;

        beforeEach(function() {
            type = new VarStringType();
            buffer = Buffer.alloc(100);
        });

        it('should handle UTF-8 characters correctly', function() {
            const testStrings = [
                'héllo',
                'привет',
                '你好',
                '🌍🚀',
                'café ☕',
                'naïve résumé'
            ];

            testStrings.forEach(str => {
                buffer.fill(0); // Clear buffer
                const bytesWritten = type.encode(str, buffer, 0);
                const decoded = type.decode(buffer, 0);
                
                expect(decoded.value).to.equal(str);
                expect(decoded.bytes_read).to.equal(bytesWritten);
            });
        });
    });

    describe('to_json', function() {
        it('should return correct JSON representation', function() {
            const type1 = new VarStringType(100);
            const json1 = type1.to_json();
            expect(json1).to.deep.equal({
                type: 'VarStringType',
                max_length: 100
            });

            const type2 = new VarStringType();
            const json2 = type2.to_json();
            expect(json2).to.deep.equal({
                type: 'VarStringType',
                max_length: 65535
            });
        });
    });

    describe('Round-trip encoding/decoding', function() {
        it('should maintain data integrity through multiple encode/decode cycles', function() {
            const type = new VarStringType();
            const buffer = Buffer.alloc(1000);
            const testStrings = [
                '',
                'a',
                'hello world',
                'a'.repeat(100),
                'UTF-8: héllo 🌍 café',
                'Mixed: 123 ABC 你好 🚀☕'
            ];

            testStrings.forEach(original => {
                buffer.fill(0);
                
                // First cycle
                const bytes1 = type.encode(original, buffer, 0);
                const decoded1 = type.decode(buffer, 0);
                expect(decoded1.value).to.equal(original);
                
                // Second cycle using decoded value
                buffer.fill(0);
                const bytes2 = type.encode(decoded1.value, buffer, 0);
                const decoded2 = type.decode(buffer, 0);
                expect(decoded2.value).to.equal(original);
                
                // Bytes written should be consistent
                expect(bytes1).to.equal(bytes2);
                expect(decoded1.bytes_read).to.equal(decoded2.bytes_read);
            });
        });
    });

    describe('Unsafe encoding option', function() {
        it('should skip validation when unsafe=true', function() {
            const type = new VarStringType(5);
            const buffer = Buffer.alloc(100);
            const longString = 'This string exceeds max_length';
            
            // Should throw with validation
            expect(() => type.encode(longString, buffer, 0)).to.throw(ParserError);
            
            // Should not throw with unsafe=true
            expect(() => type.encode(longString, buffer, 0, { unsafe: true })).to.not.throw();
        });
    });

    describe('from_json', function() {

        it('should create VarStringType types correctly', function() {
            const varStringType1 = from_json({
                type: 'VarStringType',
                max_length: 100
            });
            expect(varStringType1).to.be.instanceOf(VarStringType);
            expect(varStringType1.max_length).to.equal(100);
            expect(varStringType1._header_size).to.equal(1);

            const varStringType2 = from_json({
                type: 'VarStringType',
                max_length: 1000
            });
            expect(varStringType2).to.be.instanceOf(VarStringType);
            expect(varStringType2.max_length).to.equal(1000);
            expect(varStringType2._header_size).to.equal(2);

            // Test default max_length
            const varStringType3 = from_json({
                type: 'VarStringType'
            });
            expect(varStringType3).to.be.instanceOf(VarStringType);
            expect(varStringType3.max_length).to.equal(65535);
        });
    });
});



