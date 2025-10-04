/**
 * @fileoverview Tests for JSON object encoding and decoding functionality
 */

const { expect } = require('chai');
const {
    ParserError, JSONType,
    from_json
} = require('../lib/types');


describe('JSONType', function() {
    describe('Constructor', function() {
        it('should create with default max_length', function() {
            const type = new JSONType();
            expect(type.max_length).to.equal(65535);
        });

        it('should create with custom max_length', function() {
            const type = new JSONType(1000);
            expect(type.max_length).to.equal(1000);
        });

        it('should throw error for invalid max_length', function() {
            expect(() => new JSONType(0)).to.throw(Error, 'max_length must be between 1 and 4294967296');
            expect(() => new JSONType(4294967296)).to.throw(Error, 'max_length must be between 1 and 4294967296');
            expect(() => new JSONType(-1)).to.throw(Error, 'max_length must be between 1 and 4294967296');
        });
    });

    describe('Header size optimization', function() {
        it('should use 1-byte header for max_length < 256', function() {
            const type = new JSONType(255);
            expect(type._header_size).to.equal(1);
            
            const type2 = new JSONType(100);
            expect(type2._header_size).to.equal(1);
        });

        it('should use 2-byte header for max_length >= 256', function() {
            const type = new JSONType(256);
            expect(type._header_size).to.equal(2);
            
            const type2 = new JSONType(1000);
            expect(type2._header_size).to.equal(2);
            
            const type3 = new JSONType();
            expect(type3._header_size).to.equal(2);
        });

        it('should use 4-byte header for max_length >= 65536', function() {
            const type = new JSONType(65536);
            expect(type._header_size).to.equal(4);
            
            const type2 = new JSONType(1000000);
            expect(type2._header_size).to.equal(4);
        });
    });

    describe('byte_length property', function() {
        it('should return null for variable length type', function() {
            const type = new JSONType();
            expect(type.byte_length).to.be.null;
        });
    });

    describe('calculate_byte_length', function() {
        it('should calculate correct length with 1-byte header', function() {
            const type = new JSONType(255);
            const obj1 = { hello: 'world' };
            const obj2 = {};
            const obj3 = 42;

            expect(type.calculate_byte_length(obj1)).to.equal(1 + Buffer.byteLength(JSON.stringify(obj1), 'utf8'));
            expect(type.calculate_byte_length(obj2)).to.equal(1 + Buffer.byteLength(JSON.stringify(obj2), 'utf8'));
            expect(type.calculate_byte_length(obj3)).to.equal(1 + Buffer.byteLength(JSON.stringify(obj3), 'utf8'));
        });

        it('should calculate correct length with 2-byte header', function() {
            const type = new JSONType(1000);
            const obj1 = { hello: 'world', count: 42 };
            const obj2 = null;
            const obj3 = [1, 2, 3];

            expect(type.calculate_byte_length(obj1)).to.equal(2 + Buffer.byteLength(JSON.stringify(obj1), 'utf8'));
            expect(type.calculate_byte_length(obj2)).to.equal(2 + Buffer.byteLength(JSON.stringify(obj2), 'utf8'));
            expect(type.calculate_byte_length(obj3)).to.equal(2 + Buffer.byteLength(JSON.stringify(obj3), 'utf8'));
        });

        it('should calculate correct length with 4-byte header', function() {
            const type = new JSONType(100000);
            const obj1 = { nested: { deep: { value: 'test' } } };
            const obj2 = false;
            const obj3 = 'simple string';

            expect(type.calculate_byte_length(obj1)).to.equal(4 + Buffer.byteLength(JSON.stringify(obj1), 'utf8'));
            expect(type.calculate_byte_length(obj2)).to.equal(4 + Buffer.byteLength(JSON.stringify(obj2), 'utf8'));
            expect(type.calculate_byte_length(obj3)).to.equal(4 + Buffer.byteLength(JSON.stringify(obj3), 'utf8'));
        });

        it('should handle UTF-8 characters in JSON correctly', function() {
            const type = new JSONType(1000);
            const obj = { message: 'héllo 🌍', café: 'naïve' };
            const jsonString = JSON.stringify(obj);
            const utf8Bytes = Buffer.byteLength(jsonString, 'utf8');
            expect(type.calculate_byte_length(obj)).to.equal(2 + utf8Bytes);
        });
    });

    describe('Encoding and decoding with 1-byte header', function() {
        let type;
        let buffer;

        beforeEach(function() {
            type = new JSONType(200);
            buffer = Buffer.alloc(250);
        });

        it('should encode and decode simple objects correctly', function() {
            const testObj = { name: 'test', value: 42 };
            const bytesWritten = type.encode(testObj, buffer, 0);
            
            const jsonString = JSON.stringify(testObj);
            const expectedBytes = 1 + Buffer.byteLength(jsonString, 'utf8');
            expect(bytesWritten).to.equal(expectedBytes);

            // Check buffer content
            expect(buffer.readUInt8(0)).to.equal(Buffer.byteLength(jsonString, 'utf8')); // length
            expect(buffer.toString('utf8', 1, bytesWritten)).to.equal(jsonString);

            const decoded = type.decode(buffer, 0);
            expect(decoded.value).to.deep.equal(testObj);
            expect(decoded.bytes_read).to.equal(bytesWritten);
        });

        it('should encode and decode primitive values', function() {
            const testValues = [
                42,
                'hello',
                true,
                false,
                null
            ];

            testValues.forEach(testValue => {
                buffer.fill(0); // Clear buffer
                const bytesWritten = type.encode(testValue, buffer, 0);
                
                const decoded = type.decode(buffer, 0);
                expect(decoded.value).to.deep.equal(testValue);
                expect(decoded.bytes_read).to.equal(bytesWritten);
            });
        });

        it('should encode and decode arrays correctly', function() {
            const testArray = [1, 'two', { three: 3 }, [4, 5]];
            const bytesWritten = type.encode(testArray, buffer, 0);

            const decoded = type.decode(buffer, 0);
            expect(decoded.value).to.deep.equal(testArray);
            expect(decoded.bytes_read).to.equal(bytesWritten);
        });
    });

    describe('Encoding and decoding with 2-byte header', function() {
        let type;
        let buffer;

        beforeEach(function() {
            type = new JSONType(1000);
            buffer = Buffer.alloc(1100);
        });

        it('should encode and decode complex objects correctly', function() {
            const testObj = {
                user: {
                    id: 123,
                    name: 'John Doe',
                    active: true,
                    tags: ['admin', 'user'],
                    metadata: {
                        created: '2023-01-01',
                        lastLogin: null
                    }
                }
            };
            
            const bytesWritten = type.encode(testObj, buffer, 0);
            
            const jsonString = JSON.stringify(testObj);
            const expectedBytes = 2 + Buffer.byteLength(jsonString, 'utf8');
            expect(bytesWritten).to.equal(expectedBytes);

            // Check buffer content
            expect(buffer.readUInt16LE(0)).to.equal(Buffer.byteLength(jsonString, 'utf8')); // length
            expect(buffer.toString('utf8', 2, bytesWritten)).to.equal(jsonString);

            const decoded = type.decode(buffer, 0);
            expect(decoded.value).to.deep.equal(testObj);
            expect(decoded.bytes_read).to.equal(bytesWritten);
        });

        it('should handle large objects', function() {
            const largeObj = {
                data: new Array(25).fill(0).map((_, i) => ({ id: i, value: `item_${i}` }))
            };
            
            const bytesWritten = type.encode(largeObj, buffer, 0);

            const decoded = type.decode(buffer, 0);
            expect(decoded.value).to.deep.equal(largeObj);
            expect(decoded.bytes_read).to.equal(bytesWritten);
        });
    });

    describe('Encoding and decoding with 4-byte header', function() {
        let type;
        let buffer;

        beforeEach(function() {
            type = new JSONType(100000);
            buffer = Buffer.alloc(110000);
        });

        it('Actually has a 4-byte header', function() {
            expect(type._header_size).to.equal(4);
        });

        it('should encode and decode objects correctly', function() {
            const testObj = {
                config: {
                    database: {
                        host: 'localhost',
                        port: 5432,
                        ssl: true
                    },
                    cache: {
                        enabled: true,
                        ttl: 3600
                    }
                }
            };
            
            const bytesWritten = type.encode(testObj, buffer, 0);
            
            const jsonString = JSON.stringify(testObj);
            const expectedBytes = 4 + Buffer.byteLength(jsonString, 'utf8');
            expect(bytesWritten).to.equal(expectedBytes);

            // Check buffer content
            expect(buffer.readUInt32LE(0)).to.equal(Buffer.byteLength(jsonString, 'utf8')); // length
            expect(buffer.toString('utf8', 4, bytesWritten)).to.equal(jsonString);

            const decoded = type.decode(buffer, 0);
            expect(decoded.value).to.deep.equal(testObj);
            expect(decoded.bytes_read).to.equal(bytesWritten);
        });

        it('should handle very large objects', function() {
            const veryLargeObj = {
                records: new Array(1000).fill(0).map((_, i) => ({
                    id: i,
                    name: `Record ${i}`,
                    data: {
                        timestamp: Date.now(),
                        values: [i, i * 2, i * 3]
                    }
                }))
            };
            
            const largeBuffer = Buffer.alloc(200000);
            const bytesWritten = type.encode(veryLargeObj, largeBuffer, 0);

            const decoded = type.decode(largeBuffer, 0);
            expect(decoded.value).to.deep.equal(veryLargeObj);
            expect(decoded.bytes_read).to.equal(bytesWritten);
        });
    });

    describe('Validation', function() {
        it('should validate objects that produce valid JSON within max_length', function() {
            const type = new JSONType(100);
            expect(type.validate({ hello: 'world' })).to.be.true;
            expect(type.validate(42)).to.be.true;
            expect(type.validate('test')).to.be.true;
            expect(type.validate([])).to.be.true;
            expect(type.validate(null)).to.be.true;
            expect(type.validate(true)).to.be.true;
        });

        it('should throw ParserError for objects exceeding max_length', function() {
            const type = new JSONType(10);
            const largeObj = { data: 'This is a very long string that will exceed the limit' };
            const jsonString = JSON.stringify(largeObj);
            const byteLength = Buffer.byteLength(jsonString, 'utf8');
            
            expect(() => type.validate(largeObj)).to.throw(ParserError, `JSONType character length exceeds maximum: ${byteLength} > 10`);
        });

        it('should enforce header size limits correctly', function() {
            // Test 1-byte header limit (max 255 bytes)
            const type1 = new JSONType(100); // 1-byte header, max_length = 100
            expect(type1._header_size).to.equal(1);
            expect(type1.validate({ small: 'object' })).to.be.true; // Valid
            
            // Test 2-byte header capacity
            const type2 = new JSONType(1000); // 2-byte header, max_length = 1000  
            expect(type2._header_size).to.equal(2);
            expect(type2.validate({ medium: 'object', with: 'more data' })).to.be.true; // Valid
            
            // Test maximum 2-byte header capacity
            const type3 = new JSONType(65535); // 2-byte header, max at limit
            expect(type3._header_size).to.equal(2);
            expect(type3.validate({ large: 'object' })).to.be.true; // Valid
            
            // Test 4-byte header capacity
            const type4 = new JSONType(100000); // 4-byte header
            expect(type4._header_size).to.equal(4);
            expect(type4.validate({ very: { large: 'object' } })).to.be.true; // Valid
        });

        it('should handle objects that stringify to large JSON', function() {
            const type = new JSONType(50);
            const obj = {
                longPropertyNameThatTakesUpSpace: 'with a long value that also takes up space'
            };
            
            const jsonLength = Buffer.byteLength(JSON.stringify(obj), 'utf8');
            expect(() => type.validate(obj)).to.throw(ParserError, `JSONType character length exceeds maximum: ${jsonLength} > 50`);
        });
    });

    describe('Error handling', function() {
        let type;

        beforeEach(function() {
            type = new JSONType();
        });

        it('should throw error when buffer is too small for header', function() {
            const buffer = Buffer.alloc(1); // Too small for 2-byte header
            expect(() => type.decode(buffer, 0)).to.throw(ParserError, 'Buffer too small to read string length');
        });

        it('should throw error when buffer is too small for JSON content', function() {
            const buffer = Buffer.alloc(5);
            buffer.writeUInt16LE(10, 0); // Says JSON is 10 bytes, but buffer only has 3 remaining
            expect(() => type.decode(buffer, 0)).to.throw(ParserError, 'Buffer too small to read string of length 10');
        });

        it('should throw error when encoding to too small buffer', function() {
            const type = new JSONType();
            const buffer = Buffer.alloc(5);
            const largeObj = { data: 'This object creates a JSON string that is too long for the buffer' };
            expect(() => type.encode(largeObj, buffer, 0)).to.throw(ParserError, 'Buffer too small to encode string');
        });

        it('should handle invalid JSON during decode gracefully', function() {
            const buffer = Buffer.alloc(20);
            buffer.writeUInt16LE(10, 0); // Length = 10
            buffer.write('{"invalid}', 2, 10, 'utf8'); // Invalid JSON
            
            expect(() => type.decode(buffer, 0)).to.throw(); // Should throw JSON parse error
        });
    });

    describe('JSON serialization features', function() {
        let type;
        let buffer;

        beforeEach(function() {
            type = new JSONType();
            buffer = Buffer.alloc(1000);
        });

        it('should handle various JSON data types correctly', function() {
            const testValues = [
                // Primitives
                null,
                true,
                false,
                42,
                3.14159,
                'string',
                
                // Arrays
                [],
                [1, 2, 3],
                ['a', 'b', 'c'],
                [null, true, 42, 'mixed'],
                
                // Objects
                {},
                { key: 'value' },
                { nested: { object: true } },
                { array: [1, 2, 3], bool: false, num: 42 }
            ];

            testValues.forEach(testValue => {
                buffer.fill(0); // Clear buffer
                const bytesWritten = type.encode(testValue, buffer, 0);
                const decoded = type.decode(buffer, 0);
                
                expect(decoded.value).to.deep.equal(testValue);
                expect(decoded.bytes_read).to.equal(bytesWritten);
            });
        });

        it('should handle UTF-8 characters in JSON strings', function() {
            const testObjects = [
                { message: 'héllo 🌍' },
                { café: 'naïve résumé' },
                { unicode: '你好世界' },
                { emoji: '🚀☕🌟' },
                { mixed: ['ASCII', 'café', '🎉', '测试'] }
            ];

            testObjects.forEach(testObj => {
                buffer.fill(0); // Clear buffer
                const bytesWritten = type.encode(testObj, buffer, 0);
                const decoded = type.decode(buffer, 0);
                
                expect(decoded.value).to.deep.equal(testObj);
                expect(decoded.bytes_read).to.equal(bytesWritten);
            });
        });

        it('should handle special numeric values correctly', function() {
            const testValues = [
                0,
                -0, // Note: JSON.stringify(-0) becomes "0"
                42,
                -42,
                3.14159,
                -3.14159,
                Number.MAX_SAFE_INTEGER,
                Number.MIN_SAFE_INTEGER
            ];

            testValues.forEach(testValue => {
                buffer.fill(0); // Clear buffer
                const bytesWritten = type.encode(testValue, buffer, 0);
                const decoded = type.decode(buffer, 0);
                
                // Handle -0 case
                const expected = testValue === -0 ? 0 : testValue;
                expect(decoded.value).to.equal(expected);
                expect(decoded.bytes_read).to.equal(bytesWritten);
            });
        });
    });

    describe('to_json', function() {
        it('should return correct JSON representation', function() {
            const type1 = new JSONType(100);
            const json1 = type1.to_json();
            expect(json1).to.deep.equal({
                type: 'JSONType',
                max_length: 100
            });

            const type2 = new JSONType();
            const json2 = type2.to_json();
            expect(json2).to.deep.equal({
                type: 'JSONType',
                max_length: 65535
            });
        });
    });

    describe('Round-trip encoding/decoding', function() {
        it('should maintain data integrity through multiple encode/decode cycles', function() {
            const type = new JSONType();
            const testObjects = [
                null,
                { simple: 'object' },
                { number: 42, string: 'test', bool: true },
                { array: [1, 2, { nested: 'value' }] },
                {
                    complex: {
                        user: {
                            id: 123,
                            profile: {
                                name: 'John',
                                settings: { theme: 'dark', notifications: true }
                            }
                        },
                        data: [1, 2, 3, null, 'end']
                    }
                },
                { unicode: 'Testing UTF-8: café 🌍 你好' }
            ];

            testObjects.forEach(original => {
                const workBuffer = Buffer.alloc(2000); // Fresh buffer for each test
                
                // First cycle
                const bytes1 = type.encode(original, workBuffer, 0);
                const decoded1 = type.decode(workBuffer, 0);
                expect(decoded1.value).to.deep.equal(original);
                
                // Second cycle using decoded value
                const workBuffer2 = Buffer.alloc(2000); // Fresh buffer for second cycle
                const bytes2 = type.encode(decoded1.value, workBuffer2, 0);
                const decoded2 = type.decode(workBuffer2, 0);
                expect(decoded2.value).to.deep.equal(original);
                
                // Bytes written should be consistent
                expect(bytes1).to.equal(bytes2);
                expect(decoded1.bytes_read).to.equal(decoded2.bytes_read);
            });
        });
    });

    describe('Unsafe encoding option', function() {
        it('should skip validation when unsafe=true', function() {
            const type = new JSONType(5);
            const buffer = Buffer.alloc(100);
            const largeObj = { data: 'This object will create a JSON string that exceeds max_length' };
            
            // Should throw with validation
            expect(() => type.encode(largeObj, buffer, 0)).to.throw(ParserError);
            
            // Should not throw with unsafe=true
            expect(() => type.encode(largeObj, buffer, 0, { unsafe: true })).to.not.throw();
        });
    });

    describe('from_json', function() {
        it('should create JSONType types correctly', function() {
            const jsonType1 = from_json({
                type: 'JSONType',
                max_length: 100
            });
            expect(jsonType1).to.be.instanceOf(JSONType);
            expect(jsonType1.max_length).to.equal(100);
            expect(jsonType1._header_size).to.equal(1);

            const jsonType2 = from_json({
                type: 'JSONType',
                max_length: 1000
            });
            expect(jsonType2).to.be.instanceOf(JSONType);
            expect(jsonType2.max_length).to.equal(1000);
            expect(jsonType2._header_size).to.equal(2);

            const jsonType3 = from_json({
                type: 'JSONType',
                max_length: 100000
            });
            expect(jsonType3).to.be.instanceOf(JSONType);
            expect(jsonType3.max_length).to.equal(100000);
            expect(jsonType3._header_size).to.equal(4);

            // Test default max_length
            const jsonType4 = from_json({
                type: 'JSONType'
            });
            expect(jsonType4).to.be.instanceOf(JSONType);
            expect(jsonType4.max_length).to.equal(65535);
        });
    });

    describe('Edge cases and object offsets', function() {
        it('should work correctly with non-zero offsets', function() {
            const type = new JSONType();
            const buffer = Buffer.alloc(100);
            const testObj = { test: 'data', number: 42 };
            const offset = 10;

            const bytesWritten = type.encode(testObj, buffer, offset);
            const expectedBytes = 2 + Buffer.byteLength(JSON.stringify(testObj), 'utf8');
            expect(bytesWritten).to.equal(expectedBytes);

            const decoded = type.decode(buffer, offset);
            expect(decoded.value).to.deep.equal(testObj);
            expect(decoded.bytes_read).to.equal(bytesWritten);
        });

        it('should handle maximum size JSON at buffer boundaries', function() {
            // Test with 1-byte header at its limit
            const type1 = new JSONType(255);
            // Create object that when stringified is close to limit
            const obj1 = { data: 'x'.repeat(240) }; // Should be under 255 bytes when stringified
            const json1 = JSON.stringify(obj1);
            const buffer1 = Buffer.alloc(300); // Enough space
            
            const bytesWritten1 = type1.encode(obj1, buffer1, 0);
            expect(bytesWritten1).to.equal(1 + Buffer.byteLength(json1, 'utf8'));
            
            const decoded1 = type1.decode(buffer1, 0);
            expect(decoded1.value).to.deep.equal(obj1);

            // Test with 2-byte header
            const type2 = new JSONType(65535);
            const obj2 = { message: 'test', id: 123 };
            const json2 = JSON.stringify(obj2);
            const buffer2 = Buffer.alloc(100); // Enough space
            
            const bytesWritten2 = type2.encode(obj2, buffer2, 0);
            expect(bytesWritten2).to.equal(2 + Buffer.byteLength(json2, 'utf8'));
            
            const decoded2 = type2.decode(buffer2, 0);
            expect(decoded2.value).to.deep.equal(obj2);
        });

        it('should handle empty objects and arrays', function() {
            const type = new JSONType();
            const buffer = Buffer.alloc(100);
            const testValues = [
                {},
                [],
                { empty: {} },
                { emptyArray: [] }
            ];

            testValues.forEach(testValue => {
                buffer.fill(0); // Clear buffer
                const bytesWritten = type.encode(testValue, buffer, 0);
                const decoded = type.decode(buffer, 0);
                
                expect(decoded.value).to.deep.equal(testValue);
                expect(decoded.bytes_read).to.equal(bytesWritten);
            });
        });
    });
});