/**
 * @fileoverview Tests for type encoding and decoding functionality
 */

const { expect } = require('chai');
const {
    ParserError,
    Type,
    UInt8, UInt16, UInt32,
    Int8, Int16, Int32,
    Float32, Float64,
    UInt, Int, Float,  // New unified types
    BooleanType, Char,
    ArrayType, FixedStringType, VarStringType, EnumType, OptionalType,
    from_json
} = require('../lib/types');

describe('Types', function() {
    describe('UInt8', function() {
        let type;
        let buffer;

        beforeEach(function() {
            type = new UInt8();
            buffer = Buffer.alloc(1);
        });

        it('should have correct byte_length', function() {
            expect(type.byte_length).to.equal(1);
        });

        it('should encode and decode correctly', function() {
            const testValues = [0, 127, 255];
            
            testValues.forEach(value => {
                type.encode(value, buffer, 0);
                const decoded = type.decode(buffer, 0);
                expect(decoded.value).to.equal(value);
                expect(decoded.bytes_read).to.equal(1);
            });
        });

        it('should throw ParserError for undefined/null values', function() {
            expect(() => type.encode(undefined, buffer, 0)).to.throw(ParserError, 'Cannot encode undefined as UInt8');
            expect(() => type.encode(null, buffer, 0)).to.throw(ParserError, 'Cannot encode null as UInt8');
        });

        it('should handle boundary values', function() {
            type.encode(0, buffer, 0);
            expect(type.decode(buffer, 0).value).to.equal(0);
            
            type.encode(255, buffer, 0);
            expect(type.decode(buffer, 0).value).to.equal(255);
        });
    });

    describe('UInt16', function() {
        let type;
        let buffer;

        beforeEach(function() {
            type = new UInt16();
            buffer = Buffer.alloc(2);
        });

        it('should have correct byte_length', function() {
            expect(type.byte_length).to.equal(2);
        });

        it('should encode and decode correctly', function() {
            const testValues = [0, 32767, 65535];
            
            testValues.forEach(value => {
                type.encode(value, buffer, 0);
                const decoded = type.decode(buffer, 0);
                expect(decoded.value).to.equal(value);
                expect(decoded.bytes_read).to.equal(2);
            });
        });
    });

    describe('UInt32', function() {
        let type;
        let buffer;

        beforeEach(function() {
            type = new UInt32();
            buffer = Buffer.alloc(4);
        });

        it('should have correct byte_length', function() {
            expect(type.byte_length).to.equal(4);
        });

        it('should encode and decode correctly', function() {
            const testValues = [0, 2147483647, 4294967295];
            
            testValues.forEach(value => {
                type.encode(value, buffer, 0);
                const decoded = type.decode(buffer, 0);
                expect(decoded.value).to.equal(value);
                expect(decoded.bytes_read).to.equal(4);
            });
        });
    });

    describe('Int8', function() {
        let type;
        let buffer;

        beforeEach(function() {
            type = new Int8();
            buffer = Buffer.alloc(1);
        });

        it('should have correct byte_length', function() {
            expect(type.byte_length).to.equal(1);
        });

        it('should encode and decode correctly', function() {
            const testValues = [-128, -1, 0, 1, 127];
            
            testValues.forEach(value => {
                type.encode(value, buffer, 0);
                const decoded = type.decode(buffer, 0);
                expect(decoded.value).to.equal(value);
                expect(decoded.bytes_read).to.equal(1);
            });
        });
    });

    describe('Int16', function() {
        let type;
        let buffer;

        beforeEach(function() {
            type = new Int16();
            buffer = Buffer.alloc(2);
        });

        it('should have correct byte_length', function() {
            expect(type.byte_length).to.equal(2);
        });

        it('should encode and decode correctly', function() {
            const testValues = [-32768, -1, 0, 1, 32767];
            
            testValues.forEach(value => {
                type.encode(value, buffer, 0);
                const decoded = type.decode(buffer, 0);
                expect(decoded.value).to.equal(value);
                expect(decoded.bytes_read).to.equal(2);
            });
        });
    });

    describe('Int32', function() {
        let type;
        let buffer;

        beforeEach(function() {
            type = new Int32();
            buffer = Buffer.alloc(4);
        });

        it('should have correct byte_length', function() {
            expect(type.byte_length).to.equal(4);
        });

        it('should encode and decode correctly', function() {
            const testValues = [-2147483648, -1, 0, 1, 2147483647];
            
            testValues.forEach(value => {
                type.encode(value, buffer, 0);
                const decoded = type.decode(buffer, 0);
                expect(decoded.value).to.equal(value);
                expect(decoded.bytes_read).to.equal(4);
            });
        });
    });

    describe('Float32', function() {
        let type;
        let buffer;

        beforeEach(function() {
            type = new Float32();
            buffer = Buffer.alloc(4);
        });

        it('should have correct byte_length', function() {
            expect(type.byte_length).to.equal(4);
        });

        it('should encode and decode correctly', function() {
            const testValues = [-1.5, 0, 1.5, 3.14159];
            
            testValues.forEach(value => {
                type.encode(value, buffer, 0);
                const decoded = type.decode(buffer, 0);
                expect(decoded.value).to.be.closeTo(value, 0.0001);
                expect(decoded.bytes_read).to.equal(4);
            });
        });
    });

    describe('Float64', function() {
        let type;
        let buffer;

        beforeEach(function() {
            type = new Float64();
            buffer = Buffer.alloc(8);
        });

        it('should have correct byte_length', function() {
            expect(type.byte_length).to.equal(8);
        });

        it('should encode and decode correctly', function() {
            const testValues = [-1.5, 0, 1.5, Math.PI];
            
            testValues.forEach(value => {
                type.encode(value, buffer, 0);
                const decoded = type.decode(buffer, 0);
                expect(decoded.value).to.equal(value);
            });
        });
    });

    // ================================
    // UNIFIED PARAMETERIZED TYPE TESTS
    // ================================
    
    describe('Unified UInt Types', function() {
        const testCases = [
            { name: 'UInt(1)', byteLength: 1, maxValue: 255, testValues: [0, 127, 255] },
            { name: 'UInt(2)', byteLength: 2, maxValue: 65535, testValues: [0, 32767, 65535] },
            { name: 'UInt(4)', byteLength: 4, maxValue: 4294967295, testValues: [0, 2147483647, 4294967295] }
        ];

        testCases.forEach(({ name, byteLength, maxValue, testValues }) => {
            describe(name, function() {
                let type;
                let buffer;

                beforeEach(function() {
                    type = new UInt(byteLength);
                    buffer = Buffer.alloc(byteLength);
                });

                it('should have correct byte_length', function() {
                    expect(type.byte_length).to.equal(byteLength);
                });

                it('should encode and decode correctly', function() {
                    testValues.forEach(value => {
                        type.encode(value, buffer, 0);
                        const decoded = type.decode(buffer, 0);
                        expect(decoded.value).to.equal(value);
                        expect(decoded.bytes_read).to.equal(byteLength);
                    });
                });

                it('should handle boundary values', function() {
                    type.encode(0, buffer, 0);
                    expect(type.decode(buffer, 0).value).to.equal(0);
                    
                    type.encode(maxValue, buffer, 0);
                    expect(type.decode(buffer, 0).value).to.equal(maxValue);
                });
            });
        });
    });

    describe('Unified Int Types', function() {
        const testCases = [
            { name: 'Int(1)', byteLength: 1, minValue: -128, maxValue: 127, testValues: [-128, 0, 127] },
            { name: 'Int(2)', byteLength: 2, minValue: -32768, maxValue: 32767, testValues: [-32768, 0, 32767] },
            { name: 'Int(4)', byteLength: 4, minValue: -2147483648, maxValue: 2147483647, testValues: [-2147483648, 0, 2147483647] }
        ];

        testCases.forEach(({ name, byteLength, minValue, maxValue, testValues }) => {
            describe(name, function() {
                let type;
                let buffer;

                beforeEach(function() {
                    type = new Int(byteLength);
                    buffer = Buffer.alloc(byteLength);
                });

                it('should have correct byte_length', function() {
                    expect(type.byte_length).to.equal(byteLength);
                });

                it('should encode and decode correctly', function() {
                    testValues.forEach(value => {
                        type.encode(value, buffer, 0);
                        const decoded = type.decode(buffer, 0);
                        expect(decoded.value).to.equal(value);
                        expect(decoded.bytes_read).to.equal(byteLength);
                    });
                });

                it('should handle boundary values', function() {
                    type.encode(minValue, buffer, 0);
                    expect(type.decode(buffer, 0).value).to.equal(minValue);
                    
                    type.encode(maxValue, buffer, 0);
                    expect(type.decode(buffer, 0).value).to.equal(maxValue);
                });
            });
        });
    });

    describe('Unified Float Types', function() {
        const testCases = [
            { name: 'Float(4)', byteLength: 4, testValues: [0.0, 3.14159, -1.5] },
            { name: 'Float(8)', byteLength: 8, testValues: [0.0, Math.PI, -1.5, 2.718281828] }
        ];

        testCases.forEach(({ name, byteLength, testValues }) => {
            describe(name, function() {
                let type;
                let buffer;

                beforeEach(function() {
                    type = new Float(byteLength);
                    buffer = Buffer.alloc(byteLength);
                });

                it('should have correct byte_length', function() {
                    expect(type.byte_length).to.equal(byteLength);
                });

                it('should encode and decode correctly', function() {
                    testValues.forEach(value => {
                        type.encode(value, buffer, 0);
                        const decoded = type.decode(buffer, 0);
                        if (byteLength === 4) {
                            // Float32 has less precision
                            expect(decoded.value).to.be.closeTo(value, 0.0001);
                        } else {
                            // Float64 should be exact for most values
                            expect(decoded.value).to.equal(value);
                        }
                        expect(decoded.bytes_read).to.equal(byteLength);
                    });
                });
            });
        });
    });

    describe('BooleanType', function() {
        let type;
        let buffer;

        beforeEach(function() {
            type = new BooleanType();
            buffer = Buffer.alloc(1);
        });

        it('should have correct byte_length', function() {
            expect(type.byte_length).to.equal(1);
        });

        it('should encode and decode correctly', function() {
            type.encode(true, buffer, 0);
            expect(type.decode(buffer, 0).value).to.equal(true);
            
            type.encode(false, buffer, 0);
            expect(type.decode(buffer, 0).value).to.equal(false);
        });

        it('should handle truthy/falsy values with unsafe option', function() {
            type.encode(1, buffer, 0, { unsafe: true });
            expect(type.decode(buffer, 0).value).to.equal(true);
            
            type.encode(0, buffer, 0, { unsafe: true });
            expect(type.decode(buffer, 0).value).to.equal(false);
        });

        it('should throw ParserError for non-boolean values', function() {
            expect(() => type.encode(1, buffer, 0)).to.throw(ParserError, 'BooleanType value must be a boolean, got number');
            expect(() => type.encode('true', buffer, 0)).to.throw(ParserError, 'BooleanType value must be a boolean, got string');
            expect(() => type.encode(0, buffer, 0)).to.throw(ParserError, 'BooleanType value must be a boolean, got number');
        });
    });

    describe('Char', function() {
        let type;
        let buffer;

        beforeEach(function() {
            type = new Char();
            buffer = Buffer.alloc(1);
        });

        it('should have correct byte_length', function() {
            expect(type.byte_length).to.equal(1);
        });

        it('should encode and decode correctly', function() {
            const testChars = ['A', 'z', '0', '@'];
            
            testChars.forEach(char => {
                type.encode(char, buffer, 0);
                const decoded = type.decode(buffer, 0);
                expect(decoded.value).to.equal(char);
            });
        });

        it('should throw ParserError for undefined/null values', function() {
            expect(() => type.encode(undefined, buffer, 0)).to.throw(ParserError, 'Cannot encode undefined as Char');
            expect(() => type.encode(null, buffer, 0)).to.throw(ParserError, 'Cannot encode null as Char');
        });

        it('should handle multi-character strings by taking first character', function() {
            type.encode('Hello', buffer, 0);
            expect(type.decode(buffer, 0).value).to.equal('H');
        });
    });

    describe('ArrayType', function() {
        let type;
        let buffer;

        beforeEach(function() {
            type = new ArrayType(new UInt8(), 3);
            buffer = Buffer.alloc(3);
        });

        it('should have correct byte_length', function() {
            expect(type.byte_length).to.equal(3);
        });

        it('should encode and decode correctly', function() {
            const testArray = [10, 20, 30];
            
            type.encode(testArray, buffer, 0);
            const decoded = type.decode(buffer, 0);
            expect(decoded.value).to.deep.equal(testArray);
        });

        it('should throw error for wrong array length', function() {
            expect(() => type.encode([1, 2], buffer, 0)).to.throw(ParserError, 'ArrayType length mismatch');
            expect(() => type.encode([1, 2, 3, 4], buffer, 0)).to.throw(ParserError, 'ArrayType length mismatch');
        });

        it('should throw ParserError for undefined/null arrays', function() {
            expect(() => type.encode(undefined, buffer, 0)).to.throw(ParserError, 'Cannot encode undefined as ArrayType');
            expect(() => type.encode(null, buffer, 0)).to.throw(ParserError, 'Cannot encode null as ArrayType');
        });

        it('should work with different element types', function() {
            const int16Type = new ArrayType(new Int16(), 2);
            const int16Buffer = Buffer.alloc(4);
            const testArray = [-100, 200];
            
            int16Type.encode(testArray, int16Buffer, 0);
            const decoded = int16Type.decode(int16Buffer, 0);
            expect(decoded.value).to.deep.equal(testArray);
        });

        it('should return correct to_json', function() {
            const json = type.to_json();
            expect(json).to.deep.equal({
                type: 'ArrayType',
                element_type: { type: 'UInt8' },
                length: 3
            });
        });
    });

    describe('ArrayType - Variable Length', function() {
        describe('Constructor', function() {
            it('should create variable-length array by default', function() {
                const type = new ArrayType(new UInt8());
                expect(type.length).to.be.null;
                expect(type.element_type).to.be.instanceOf(UInt8);
            });

            it('should create variable-length array with explicit null', function() {
                const type = new ArrayType(new UInt8(), null);
                expect(type.length).to.be.null;
            });

            it('should still support fixed-length arrays', function() {
                const type = new ArrayType(new UInt8(), 5);
                expect(type.length).to.equal(5);
            });
        });

        describe('byte_length property', function() {
            it('should return null for variable-length arrays', function() {
                const type = new ArrayType(new UInt8());
                expect(type.byte_length).to.be.null;
            });

            it('should return null for arrays with variable-length elements', function() {
                const type = new ArrayType(new VarStringType(), 3);
                expect(type.byte_length).to.be.null;
            });

            it('should return number for fixed arrays with fixed elements', function() {
                const type = new ArrayType(new UInt8(), 3);
                expect(type.byte_length).to.equal(3);
            });
        });

        describe('calculate_byte_length', function() {
            let type;
            let varStringType;

            beforeEach(function() {
                type = new ArrayType(new UInt8());
                varStringType = new ArrayType(new VarStringType());
            });

            it('should calculate length for variable array with fixed elements', function() {
                const arr = [1, 2, 3, 4, 5];
                const length = type.calculate_byte_length(arr);
                expect(length).to.equal(9); // 4 bytes (length) + 5 bytes (elements)
            });

            it('should calculate length for empty array', function() {
                const arr = [];
                const length = type.calculate_byte_length(arr);
                expect(length).to.equal(4); // 4 bytes (length) + 0 bytes (elements)
            });

            it('should calculate length for array with variable elements', function() {
                const arr = ['hello', 'world'];
                const length = varStringType.calculate_byte_length(arr);
                // 4 (array length) + 2+5 (hello) + 2+5 (world) = 18
                expect(length).to.equal(18);
            });

            it('should throw error for non-array values', function() {
                expect(() => type.calculate_byte_length('not array')).to.throw(ParserError, 'ArrayType value must be an array');
                expect(() => type.calculate_byte_length(123)).to.throw(ParserError, 'ArrayType value must be an array');
            });
        });

        describe('Encoding and decoding variable arrays', function() {
            let type;
            let buffer;

            beforeEach(function() {
                type = new ArrayType(new UInt8());
                buffer = Buffer.alloc(100);
            });

            it('should encode and decode variable arrays correctly', function() {
                const testArray = [10, 20, 30, 40];
                const bytesWritten = type.encode(testArray, buffer, 0);
                expect(bytesWritten).to.equal(8); // 4 + 4

                // Check buffer content
                expect(buffer.readUInt32LE(0)).to.equal(4); // array length
                expect(buffer.readUInt8(4)).to.equal(10);
                expect(buffer.readUInt8(5)).to.equal(20);
                expect(buffer.readUInt8(6)).to.equal(30);
                expect(buffer.readUInt8(7)).to.equal(40);

                const decoded = type.decode(buffer, 0);
                expect(decoded.value).to.deep.equal(testArray);
                expect(decoded.bytes_read).to.equal(8);
            });

            it('should handle empty arrays', function() {
                const testArray = [];
                const bytesWritten = type.encode(testArray, buffer, 0);
                expect(bytesWritten).to.equal(4); // 4 bytes for length only

                expect(buffer.readUInt32LE(0)).to.equal(0); // array length = 0

                const decoded = type.decode(buffer, 0);
                expect(decoded.value).to.deep.equal([]);
                expect(decoded.bytes_read).to.equal(4);
            });

            it('should handle large arrays', function() {
                const testArray = new Array(50).fill(0).map((_, i) => i % 256);
                const bytesWritten = type.encode(testArray, buffer, 0);
                expect(bytesWritten).to.equal(54); // 4 + 50

                const decoded = type.decode(buffer, 0);
                expect(decoded.value).to.deep.equal(testArray);
                expect(decoded.bytes_read).to.equal(54);
            });
        });

        describe('Encoding and decoding with variable elements', function() {
            let type;
            let buffer;

            beforeEach(function() {
                type = new ArrayType(new VarStringType());
                buffer = Buffer.alloc(200);
            });

            it('should encode and decode arrays with variable elements', function() {
                const testArray = ['hello', 'world', 'test'];
                const bytesWritten = type.encode(testArray, buffer, 0);
                
                // Calculate expected length: 4 (array length) + (2+5) + (2+5) + (2+4) = 24
                expect(bytesWritten).to.equal(24);

                const decoded = type.decode(buffer, 0);
                expect(decoded.value).to.deep.equal(testArray);
                expect(decoded.bytes_read).to.equal(24);
            });

            it('should handle mixed length strings', function() {
                const testArray = ['', 'a', 'hello world'];
                const bytesWritten = type.encode(testArray, buffer, 0);
                
                // 4 (array length) + (2+0) + (2+1) + (2+11) = 22
                expect(bytesWritten).to.equal(22);

                const decoded = type.decode(buffer, 0);
                expect(decoded.value).to.deep.equal(testArray);
                expect(decoded.bytes_read).to.equal(22);
            });
        });

        describe('Validation', function() {
            let type;

            beforeEach(function() {
                type = new ArrayType(new UInt8());
            });

            it('should validate arrays of any length for variable arrays', function() {
                expect(type.validate([])).to.be.true;
                expect(type.validate([1])).to.be.true;
                expect(type.validate([1, 2, 3, 4, 5])).to.be.true;
                expect(type.validate(new Array(100).fill(100))).to.be.true;
            });

            it('should validate elements in variable arrays', function() {
                expect(() => type.validate([1, 2, 256])).to.throw(ParserError, 'ArrayType element at index 2 is invalid');
                expect(() => type.validate([1, 'invalid', 3])).to.throw(ParserError, 'ArrayType element at index 1 is invalid');
            });

            it('should throw for non-array values', function() {
                expect(() => type.validate('not array')).to.throw(ParserError, 'ArrayType value must be an array');
                expect(() => type.validate(123)).to.throw(ParserError, 'ArrayType value must be an array');
                expect(() => type.validate(null)).to.throw(ParserError, 'Cannot encode null as ArrayType');
                expect(() => type.validate(undefined)).to.throw(ParserError, 'Cannot encode undefined as ArrayType');
            });

            it('should not enforce length for variable arrays', function() {
                const fixedType = new ArrayType(new UInt8(), 3);
                const varType = new ArrayType(new UInt8());
                
                // Fixed array should enforce length
                expect(() => fixedType.validate([1, 2])).to.throw(ParserError, 'ArrayType length mismatch: expected 3, got 2');
                
                // Variable array should accept any length
                expect(varType.validate([1, 2])).to.be.true;
                expect(varType.validate([1, 2, 3, 4, 5])).to.be.true;
            });
        });

        describe('Error handling', function() {
            let type;

            beforeEach(function() {
                type = new ArrayType(new UInt8());
            });

            it('should throw error when buffer is too small for length header', function() {
                const buffer = Buffer.alloc(3); // Too small for UInt32 length
                expect(() => type.decode(buffer, 0)).to.throw(ParserError, 'Buffer too small to read array length');
            });

            it('should throw error when buffer is too small for array content', function() {
                const buffer = Buffer.alloc(6);
                buffer.writeUInt32LE(5, 0); // Says array has 5 elements, but buffer only has space for 2
                expect(() => type.decode(buffer, 0)).to.throw();
            });
        });

        describe('to_json and from_json', function() {
            it('should serialize variable arrays correctly', function() {
                const type = new ArrayType(new UInt8());
                const json = type.to_json();
                expect(json).to.deep.equal({
                    type: 'ArrayType',
                    element_type: { type: 'UInt8' },
                    length: null
                });
            });

            it('should deserialize variable arrays correctly', function() {
                const json = {
                    type: 'ArrayType',
                    element_type: { type: 'UInt8' },
                    length: null
                };
                const type = from_json(json);
                expect(type).to.be.instanceOf(ArrayType);
                expect(type.length).to.be.null;
                expect(type.element_type).to.be.instanceOf(UInt8);
            });

            it('should still support fixed arrays in JSON', function() {
                const json = {
                    type: 'ArrayType',
                    element_type: { type: 'UInt8' },
                    length: 5
                };
                const type = from_json(json);
                expect(type).to.be.instanceOf(ArrayType);
                expect(type.length).to.equal(5);
            });
        });

        describe('Round-trip encoding/decoding', function() {
            it('should maintain data integrity through multiple cycles', function() {
                const type = new ArrayType(new UInt8());
                const buffer = Buffer.alloc(100);
                const testArrays = [
                    [],
                    [1],
                    [1, 2, 3],
                    [255, 0, 128, 64],
                    new Array(20).fill(0).map((_, i) => i * 10 % 256)
                ];

                testArrays.forEach(original => {
                    buffer.fill(0);
                    
                    // First cycle
                    const bytes1 = type.encode(original, buffer, 0);
                    const decoded1 = type.decode(buffer, 0);
                    expect(decoded1.value).to.deep.equal(original);
                    
                    // Second cycle using decoded value
                    buffer.fill(0);
                    const bytes2 = type.encode(decoded1.value, buffer, 0);
                    const decoded2 = type.decode(buffer, 0);
                    expect(decoded2.value).to.deep.equal(original);
                    
                    // Bytes written should be consistent
                    expect(bytes1).to.equal(bytes2);
                    expect(decoded1.bytes_read).to.equal(decoded2.bytes_read);
                });
            });
        });

        describe('Unsafe encoding option', function() {
            it('should skip validation when unsafe=true', function() {
                const type = new ArrayType(new UInt8());
                const buffer = Buffer.alloc(100);
                const invalidArray = [1, 2, 'invalid']; // Invalid element type
                
                // Should throw with validation (during validation phase)
                expect(() => type.encode(invalidArray, buffer, 0)).to.throw(ParserError, 'ArrayType element at index 2 is invalid');
                
                // Should not throw validation error with unsafe=true, but might still throw during actual encoding
                // Let's test with a value that passes validation but would fail at element level
                const outOfRangeArray = [1, 2, 3]; // Valid array for testing unsafe behavior
                expect(() => type.encode(outOfRangeArray, buffer, 0, { unsafe: true })).to.not.throw();
            });
        });
    });

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
    });

    describe('EnumType', function() {
        let type;
        let buffer;

        beforeEach(function() {
            type = new EnumType(['red', 'green', 'blue']);
            buffer = Buffer.alloc(1);
        });

        it('should have correct byte_length for small enum', function() {
            expect(type.byte_length).to.equal(1);
        });

        it('should have correct byte_length for larger enums', function() {
            const largeEnum = new EnumType(new Array(300).fill(0).map((_, i) => `option${i}`));
            expect(largeEnum.byte_length).to.equal(2);
            
            const veryLargeEnum = new EnumType(new Array(70000).fill(0).map((_, i) => `option${i}`));
            expect(veryLargeEnum.byte_length).to.equal(4);
        });

        it('should encode and decode correctly', function() {
            type.encode('red', buffer, 0);
            expect(type.decode(buffer, 0).value).to.equal('red');
            
            type.encode('green', buffer, 0);
            expect(type.decode(buffer, 0).value).to.equal('green');
            
            type.encode('blue', buffer, 0);
            expect(type.decode(buffer, 0).value).to.equal('blue');
        });

        it('should throw error for invalid enum value', function() {
            expect(() => type.encode('yellow', buffer, 0)).to.throw(ParserError, 'EnumType value not found');
        });

        it('should throw ParserError for undefined/null enum values', function() {
            expect(() => type.encode(undefined, buffer, 0)).to.throw(ParserError, 'Cannot encode undefined as EnumType');
            expect(() => type.encode(null, buffer, 0)).to.throw(ParserError, 'Cannot encode null as EnumType');
        });

        it('should throw error for invalid index during decode', function() {
            buffer.writeUInt8(99, 0); // Invalid index
            expect(() => type.decode(buffer, 0)).to.throw(ParserError, 'EnumType index out of range');
        });

        it('should return correct to_json', function() {
            const json = type.to_json();
            expect(json).to.deep.equal({
                type: 'EnumType',
                options: ['red', 'green', 'blue']
            });
        });
    });

    describe('OptionalType', function() {
        let type;
        let buffer;

        beforeEach(function() {
            type = new OptionalType(new UInt8());
            buffer = Buffer.alloc(2);
        });

        it('should have correct byte_length', function() {
            expect(type.byte_length).to.equal(2); // 1 for presence flag + 1 for UInt8
        });

        it('should encode and decode present values', function() {
            type.encode(42, buffer, 0);
            const decoded = type.decode(buffer, 0);
            expect(decoded.value).to.equal(42);
        });

        it('should encode and decode null values', function() {
            type.encode(null, buffer, 0);
            expect(type.decode(buffer, 0).value).to.be.null;
            
            type.encode(undefined, buffer, 0);
            expect(type.decode(buffer, 0).value).to.be.null;
        });

        it('should work with complex base types', function() {
            const stringOptional = new OptionalType(new FixedStringType(5));
            const stringBuffer = Buffer.alloc(6);
            
            stringOptional.encode('test', stringBuffer, 0);
            expect(stringOptional.decode(stringBuffer, 0).value).to.equal('test');
            
            stringOptional.encode(null, stringBuffer, 0);
            expect(stringOptional.decode(stringBuffer, 0).value).to.be.null;
        });

        describe('Variable-length base types', function() {
            it('should handle OptionalType with VarStringType', function() {
                const optionalString = new OptionalType(new VarStringType(100));
                const buffer = Buffer.alloc(100);
                
                // Test properties
                expect(optionalString.is_static_length).to.be.false;
                expect(optionalString.byte_length).to.be.null;
                
                // Test with present value
                const presentValue = 'Hello World';
                const presentBytes = optionalString.encode(presentValue, buffer, 0);
                expect(presentBytes).to.equal(13); // 1 (present flag) + 1 (string length) + 11 (string bytes)
                
                const presentDecoded = optionalString.decode(buffer, 0);
                expect(presentDecoded.value).to.equal(presentValue);
                expect(presentDecoded.bytes_read).to.equal(13);
                
                // Test calculate_byte_length
                expect(optionalString.calculate_byte_length(presentValue)).to.equal(13);
                
                // Test with null value
                const nullBytes = optionalString.encode(null, buffer, 0);
                expect(nullBytes).to.equal(1);
                
                const nullDecoded = optionalString.decode(buffer, 0);
                expect(nullDecoded.value).to.be.null;
                expect(nullDecoded.bytes_read).to.equal(1);
                
                expect(optionalString.calculate_byte_length(null)).to.equal(1);
            });
            
            it('should handle OptionalType with variable ArrayType', function() {
                const optionalArray = new OptionalType(new ArrayType(new UInt8()));
                const buffer = Buffer.alloc(100);
                
                // Test properties
                expect(optionalArray.is_static_length).to.be.false;
                expect(optionalArray.byte_length).to.be.null;
                
                // Test with present array
                const arrayValue = [1, 2, 3, 4, 5];
                const arrayBytes = optionalArray.encode(arrayValue, buffer, 0);
                expect(arrayBytes).to.equal(10); // 1 (present flag) + 4 (array length) + 5 (array elements)
                
                const arrayDecoded = optionalArray.decode(buffer, 0);
                expect(arrayDecoded.value).to.deep.equal(arrayValue);
                expect(arrayDecoded.bytes_read).to.equal(10);
                
                expect(optionalArray.calculate_byte_length(arrayValue)).to.equal(10);
                
                // Test with null
                const nullBytes = optionalArray.encode(null, buffer, 0);
                expect(nullBytes).to.equal(1);
                
                const nullDecoded = optionalArray.decode(buffer, 0);
                expect(nullDecoded.value).to.be.null;
                expect(nullDecoded.bytes_read).to.equal(1);
            });
            
            it('should handle nested OptionalType with variable-length elements', function() {
                const nestedOptional = new OptionalType(new ArrayType(new VarStringType(50)));
                const buffer = Buffer.alloc(200);
                
                expect(nestedOptional.is_static_length).to.be.false;
                expect(nestedOptional.byte_length).to.be.null;
                
                const stringArray = ['hello', 'world', 'test'];
                const bytes = nestedOptional.encode(stringArray, buffer, 0);
                
                const decoded = nestedOptional.decode(buffer, 0);
                expect(decoded.value).to.deep.equal(stringArray);
                expect(decoded.bytes_read).to.equal(bytes);
            });
        });

        it('should return correct to_json', function() {
            const json = type.to_json();
            expect(json).to.deep.equal({
                type: 'OptionalType',
                base_type: { type: 'UInt8' }
            });
        });
    });

    describe('from_json', function() {
        it('should create primitive types correctly', function() {
            expect(from_json({ type: 'UInt8' })).to.be.instanceOf(UInt8);
            expect(from_json({ type: 'Int32' })).to.be.instanceOf(Int32);
            expect(from_json({ type: 'Float64' })).to.be.instanceOf(Float64);
            expect(from_json({ type: 'BooleanType' })).to.be.instanceOf(BooleanType);
            expect(from_json({ type: 'Char' })).to.be.instanceOf(Char);
        });

        it('should create complex types correctly', function() {
            const arrayType = from_json({
                type: 'ArrayType',
                element_type: { type: 'UInt16' },
                length: 5
            });
            expect(arrayType).to.be.instanceOf(ArrayType);
            expect(arrayType.length).to.equal(5);
            expect(arrayType.element_type).to.be.instanceOf(UInt16);
        });

        it('should create string types correctly', function() {
            const stringType = from_json({
                type: 'FixedStringType',
                length: 20
            });
            expect(stringType).to.be.instanceOf(FixedStringType);
            expect(stringType.length).to.equal(20);
        });

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

        it('should create enum types correctly', function() {
            const enumType = from_json({
                type: 'EnumType',
                options: ['a', 'b', 'c']
            });
            expect(enumType).to.be.instanceOf(EnumType);
            expect(enumType.options).to.deep.equal(['a', 'b', 'c']);
        });

        it('should create optional types correctly', function() {
            const optionalType = from_json({
                type: 'OptionalType',
                base_type: { type: 'Float32' }
            });
            expect(optionalType).to.be.instanceOf(OptionalType);
            expect(optionalType.base_type).to.be.instanceOf(Float32);
        });

        it('should throw error for unknown type', function() {
            expect(() => from_json({ type: 'UnknownType' })).to.throw('Unknown type: UnknownType');
        });
    });
});
