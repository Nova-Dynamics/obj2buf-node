/**
 * @fileoverview Tests for buffer encoding and decoding functionality
 */

const { expect } = require('chai');
const {
    ParserError, VarBufferType,
    from_json
} = require('../lib/types');


describe('VarBufferType', function() {
    describe('Constructor', function() {
        it('should create with default max_length', function() {
            const type = new VarBufferType();
            expect(type.max_length).to.equal(65535);
        });

        it('should create with custom max_length', function() {
            const type = new VarBufferType(1000);
            expect(type.max_length).to.equal(1000);
        });

        it('should throw error for invalid max_length', function() {
            expect(() => new VarBufferType(0)).to.throw(Error, 'max_length must be between 1 and 4294967296');
            expect(() => new VarBufferType(4294967296)).to.throw(Error, 'max_length must be between 1 and 4294967296');
            expect(() => new VarBufferType(-1)).to.throw(Error, 'max_length must be between 1 and 4294967296');
        });
    });

    describe('Header size optimization', function() {
        it('should use 1-byte header for max_length < 256', function() {
            const type = new VarBufferType(255);
            expect(type._header_size).to.equal(1);
            
            const type2 = new VarBufferType(100);
            expect(type2._header_size).to.equal(1);
        });

        it('should use 2-byte header for max_length >= 256', function() {
            const type = new VarBufferType(256);
            expect(type._header_size).to.equal(2);
            
            const type2 = new VarBufferType(1000);
            expect(type2._header_size).to.equal(2);
            
            const type3 = new VarBufferType();
            expect(type3._header_size).to.equal(2);
        });

        it('should use 4-byte header for max_length >= 65536', function() {
            const type = new VarBufferType(65536);
            expect(type._header_size).to.equal(4);
            
            const type2 = new VarBufferType(1000000);
            expect(type2._header_size).to.equal(4);
        });
    });

    describe('byte_length property', function() {
        it('should return null for variable length type', function() {
            const type = new VarBufferType();
            expect(type.byte_length).to.be.null;
        });
    });

    describe('calculate_byte_length', function() {
        it('should calculate correct length with 1-byte header', function() {
            const type = new VarBufferType(255);
            const buffer1 = Buffer.from([1, 2, 3, 4, 5]);
            const buffer2 = Buffer.alloc(0);
            const buffer3 = Buffer.from([42]);

            expect(type.calculate_byte_length(buffer1)).to.equal(6); // 1 + 5
            expect(type.calculate_byte_length(buffer2)).to.equal(1); // 1 + 0
            expect(type.calculate_byte_length(buffer3)).to.equal(2); // 1 + 1
        });

        it('should calculate correct length with 2-byte header', function() {
            const type = new VarBufferType(1000);
            const buffer1 = Buffer.from([1, 2, 3, 4, 5]);
            const buffer2 = Buffer.alloc(0);
            const buffer3 = Buffer.from([42]);

            expect(type.calculate_byte_length(buffer1)).to.equal(7); // 2 + 5
            expect(type.calculate_byte_length(buffer2)).to.equal(2); // 2 + 0
            expect(type.calculate_byte_length(buffer3)).to.equal(3); // 2 + 1
        });

        it('should calculate correct length with 4-byte header', function() {
            const type = new VarBufferType(100000);
            const buffer1 = Buffer.from([1, 2, 3, 4, 5]);
            const buffer2 = Buffer.alloc(0);
            const buffer3 = Buffer.from([42]);

            expect(type.calculate_byte_length(buffer1)).to.equal(9); // 4 + 5
            expect(type.calculate_byte_length(buffer2)).to.equal(4); // 4 + 0
            expect(type.calculate_byte_length(buffer3)).to.equal(5); // 4 + 1
        });

        it('should throw error for non-buffer values', function() {
            const type = new VarBufferType();
            expect(() => type.calculate_byte_length(123)).to.throw(ParserError, 'VarBufferType value must be a Buffer, got number');
            expect(() => type.calculate_byte_length('hello')).to.throw(ParserError, 'VarBufferType value must be a Buffer, got string');
            expect(() => type.calculate_byte_length(null)).to.throw(ParserError, 'VarBufferType value must be a Buffer, got object');
            expect(() => type.calculate_byte_length(undefined)).to.throw(ParserError, 'VarBufferType value must be a Buffer, got undefined');
            expect(() => type.calculate_byte_length([])).to.throw(ParserError, 'VarBufferType value must be a Buffer, got object');
        });
    });

    describe('Encoding and decoding with 1-byte header', function() {
        let type;
        let buffer;

        beforeEach(function() {
            type = new VarBufferType(200);
            buffer = Buffer.alloc(250);
        });

        it('should encode and decode short buffers correctly', function() {
            const testBuffer = Buffer.from([1, 2, 3, 4, 5, 6]);
            const bytesWritten = type.encode(testBuffer, buffer, 0);
            expect(bytesWritten).to.equal(7); // 1 + 6

            // Check buffer content
            expect(buffer.readUInt8(0)).to.equal(6); // length
            expect(buffer.slice(1, 7)).to.deep.equal(testBuffer);

            const decoded = type.decode(buffer, 0);
            expect(decoded.value).to.deep.equal(testBuffer);
            expect(decoded.bytes_read).to.equal(7);
        });

        it('should encode and decode empty buffers', function() {
            const testBuffer = Buffer.alloc(0);
            const bytesWritten = type.encode(testBuffer, buffer, 0);
            expect(bytesWritten).to.equal(1); // 1 + 0

            expect(buffer.readUInt8(0)).to.equal(0); // length

            const decoded = type.decode(buffer, 0);
            expect(decoded.value).to.deep.equal(testBuffer);
            expect(decoded.bytes_read).to.equal(1);
        });

        it('should handle maximum length buffers for 1-byte header', function() {
            const testBuffer = Buffer.alloc(200, 0xAB);
            const largeBuffer = Buffer.alloc(250); // Make buffer large enough
            const bytesWritten = type.encode(testBuffer, largeBuffer, 0);
            expect(bytesWritten).to.equal(201); // 1 + 200

            const decoded = type.decode(largeBuffer, 0);
            expect(decoded.value).to.deep.equal(testBuffer);
            expect(decoded.bytes_read).to.equal(201);
        });
    });

    describe('Encoding and decoding with 2-byte header', function() {
        let type;
        let buffer;

        beforeEach(function() {
            type = new VarBufferType(1000);
            buffer = Buffer.alloc(1100);
        });

        it('should encode and decode buffers correctly', function() {
            const testBuffer = Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]);
            const bytesWritten = type.encode(testBuffer, buffer, 0);
            expect(bytesWritten).to.equal(10); // 2 + 8

            // Check buffer content
            expect(buffer.readUInt16LE(0)).to.equal(8); // length
            expect(buffer.slice(2, 10)).to.deep.equal(testBuffer);

            const decoded = type.decode(buffer, 0);
            expect(decoded.value).to.deep.equal(testBuffer);
            expect(decoded.bytes_read).to.equal(10);
        });

        it('should handle large buffers', function() {
            const testBuffer = Buffer.alloc(500, 0xFF);
            const bytesWritten = type.encode(testBuffer, buffer, 0);
            expect(bytesWritten).to.equal(502); // 2 + 500

            const decoded = type.decode(buffer, 0);
            expect(decoded.value).to.deep.equal(testBuffer);
            expect(decoded.bytes_read).to.equal(502);
        });
    });

    describe('Encoding and decoding with 4-byte header', function() {
        let type;
        let buffer;

        beforeEach(function() {
            type = new VarBufferType(100000);
            buffer = Buffer.alloc(110000);
        });

        it('should encode and decode buffers correctly', function() {
            const testBuffer = Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]);
            const bytesWritten = type.encode(testBuffer, buffer, 0);
            expect(bytesWritten).to.equal(12); // 4 + 8

            // Check buffer content
            expect(buffer.readUInt32LE(0)).to.equal(8); // length
            expect(buffer.slice(4, 12)).to.deep.equal(testBuffer);

            const decoded = type.decode(buffer, 0);
            expect(decoded.value).to.deep.equal(testBuffer);
            expect(decoded.bytes_read).to.equal(12);
        });

        it('should handle very large buffers', function() {
            const testBuffer = Buffer.alloc(70000, 0xCC);
            const largeBuffer = Buffer.alloc(80000);
            const bytesWritten = type.encode(testBuffer, largeBuffer, 0);
            expect(bytesWritten).to.equal(70004); // 4 + 70000

            const decoded = type.decode(largeBuffer, 0);
            expect(decoded.value).to.deep.equal(testBuffer);
            expect(decoded.bytes_read).to.equal(70004);
        });
    });

    describe('Validation', function() {
        it('should validate correct buffers', function() {
            const type = new VarBufferType(100);
            expect(type.validate(Buffer.from([1, 2, 3]))).to.be.true;
            expect(type.validate(Buffer.alloc(0))).to.be.true;
            expect(type.validate(Buffer.alloc(100, 0xAA))).to.be.true;
        });

        it('should throw ParserError for null/undefined values', function() {
            const type = new VarBufferType();
            expect(() => type.validate(undefined)).to.throw(ParserError, 'Cannot encode undefined as VarBufferType');
            expect(() => type.validate(null)).to.throw(ParserError, 'Cannot encode null as VarBufferType');
        });

        it('should throw ParserError for non-buffer values', function() {
            const type = new VarBufferType();
            expect(() => type.validate(123)).to.throw(ParserError, 'VarBufferType value must be a buffer, got number');
            expect(() => type.validate('hello')).to.throw(ParserError, 'VarBufferType value must be a buffer, got string');
            expect(() => type.validate({})).to.throw(ParserError, 'VarBufferType value must be a buffer, got object');
            expect(() => type.validate([])).to.throw(ParserError, 'VarBufferType value must be a buffer, got object');
        });

        it('should throw ParserError for buffers exceeding max_length', function() {
            const type = new VarBufferType(10);
            const longBuffer = Buffer.alloc(11, 0xAB);
            expect(() => type.validate(longBuffer)).to.throw(ParserError, 'VarBufferType byte length exceeds maximum: 11 > 10');
        });

        it('should enforce header size limits correctly', function() {
            // Test 1-byte header limit (max 255 bytes)
            const type1 = new VarBufferType(100); // 1-byte header, max_length = 100
            expect(type1._header_size).to.equal(1);
            expect(type1.validate(Buffer.alloc(100, 0xFF))).to.be.true; // Valid
            
            // Test 2-byte header capacity
            const type2 = new VarBufferType(1000); // 2-byte header, max_length = 1000  
            expect(type2._header_size).to.equal(2);
            expect(type2.validate(Buffer.alloc(1000, 0xFF))).to.be.true; // Valid
            
            // Test maximum 2-byte header capacity
            const type3 = new VarBufferType(65535); // 2-byte header, max at limit
            expect(type3._header_size).to.equal(2);
            expect(type3.validate(Buffer.alloc(65535, 0xFF))).to.be.true; // Valid at maximum
            
            // Test 4-byte header capacity
            const type4 = new VarBufferType(100000); // 4-byte header
            expect(type4._header_size).to.equal(4);
            expect(type4.validate(Buffer.alloc(100000, 0xFF))).to.be.true; // Valid
        });
    });

    describe('Error handling', function() {
        let type;

        beforeEach(function() {
            type = new VarBufferType();
        });

        it('should throw error when buffer is too small for header', function() {
            const buffer = Buffer.alloc(1); // Too small for 2-byte header
            expect(() => type.decode(buffer, 0)).to.throw(ParserError, 'Buffer too small to read buffer length');
        });

        it('should throw error when buffer is too small for buffer content', function() {
            const buffer = Buffer.alloc(5);
            buffer.writeUInt16LE(10, 0); // Says buffer is 10 bytes, but buffer only has 3 remaining
            expect(() => type.decode(buffer, 0)).to.throw(ParserError, 'Buffer too small to read buffer of length 10');
        });

        it('should throw error when encoding to too small buffer', function() {
            const type = new VarBufferType();
            const buffer = Buffer.alloc(5);
            const longBuffer = Buffer.alloc(20, 0xAB);
            expect(() => type.encode(longBuffer, buffer, 0)).to.throw(ParserError, 'Buffer too small to encode buffer');
        });
    });

    describe('Binary data support', function() {
        let type;
        let buffer;

        beforeEach(function() {
            type = new VarBufferType();
            buffer = Buffer.alloc(1000);
        });

        it('should handle various binary patterns correctly', function() {
            const testBuffers = [
                Buffer.from([0x00, 0x01, 0x02, 0x03]),
                Buffer.from([0xFF, 0xFE, 0xFD, 0xFC]),
                Buffer.from([0xAA, 0x55, 0xAA, 0x55]),
                Buffer.from([0x00, 0x00, 0x00, 0x00]),
                Buffer.from([0xFF, 0xFF, 0xFF, 0xFF]),
                Buffer.alloc(0) // Empty buffer
            ];

            testBuffers.forEach(testBuf => {
                buffer.fill(0); // Clear buffer
                const bytesWritten = type.encode(testBuf, buffer, 0);
                const decoded = type.decode(buffer, 0);
                
                expect(decoded.value).to.deep.equal(testBuf);
                expect(decoded.bytes_read).to.equal(bytesWritten);
            });
        });

        it('should preserve exact byte values', function() {
            // Test all possible byte values
            const testBuffer = Buffer.alloc(256);
            for (let i = 0; i < 256; i++) {
                testBuffer[i] = i;
            }

            const largeBuffer = Buffer.alloc(300);
            const bytesWritten = type.encode(testBuffer, largeBuffer, 0);
            const decoded = type.decode(largeBuffer, 0);
            
            expect(decoded.value).to.deep.equal(testBuffer);
            expect(decoded.bytes_read).to.equal(bytesWritten);
            
            // Verify each byte
            for (let i = 0; i < 256; i++) {
                expect(decoded.value[i]).to.equal(i);
            }
        });
    });

    describe('to_json', function() {
        it('should return correct JSON representation', function() {
            const type1 = new VarBufferType(100);
            const json1 = type1.to_json();
            expect(json1).to.deep.equal({
                type: 'VarBufferType',
                max_length: 100
            });

            const type2 = new VarBufferType();
            const json2 = type2.to_json();
            expect(json2).to.deep.equal({
                type: 'VarBufferType',
                max_length: 65535
            });
        });
    });

    describe('Round-trip encoding/decoding', function() {
        it('should maintain data integrity through multiple encode/decode cycles', function() {
            const type = new VarBufferType();
            const testBuffers = [
                Buffer.alloc(0),
                Buffer.from([0x42]),
                Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05]),
                Buffer.from(Array(100).fill(0xAB)), // Create buffer with 100 bytes of 0xAB
                Buffer.from([0x00, 0xFF, 0x00, 0xFF, 0x00, 0xFF]),
                Buffer.from([0x68, 0x65, 0x6C, 0x6C, 0x6F, 0x20, 0x77, 0x6F, 0x72, 0x6C, 0x64]), // 'hello world' as bytes
                Buffer.from([0x80, 0x81, 0x82, 0x83]) // High bit values
            ];

            testBuffers.forEach(original => {
                const workBuffer = Buffer.alloc(1000); // Fresh buffer for each test
                
                // First cycle
                const bytes1 = type.encode(original, workBuffer, 0);
                const decoded1 = type.decode(workBuffer, 0);
                expect(decoded1.value).to.deep.equal(original);
                
                // Second cycle using decoded value
                const workBuffer2 = Buffer.alloc(1000); // Fresh buffer for second cycle
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
            const type = new VarBufferType(5);
            const buffer = Buffer.alloc(100);
            const longBuffer = Buffer.alloc(20, 0xCC);
            
            // Should throw with validation
            expect(() => type.encode(longBuffer, buffer, 0)).to.throw(ParserError);
            
            // Should not throw with unsafe=true
            expect(() => type.encode(longBuffer, buffer, 0, { unsafe: true })).to.not.throw();
        });
    });

    describe('from_json', function() {
        it('should create VarBufferType types correctly', function() {
            const varBufferType1 = from_json({
                type: 'VarBufferType',
                max_length: 100
            });
            expect(varBufferType1).to.be.instanceOf(VarBufferType);
            expect(varBufferType1.max_length).to.equal(100);
            expect(varBufferType1._header_size).to.equal(1);

            const varBufferType2 = from_json({
                type: 'VarBufferType',
                max_length: 1000
            });
            expect(varBufferType2).to.be.instanceOf(VarBufferType);
            expect(varBufferType2.max_length).to.equal(1000);
            expect(varBufferType2._header_size).to.equal(2);

            const varBufferType3 = from_json({
                type: 'VarBufferType',
                max_length: 100000
            });
            expect(varBufferType3).to.be.instanceOf(VarBufferType);
            expect(varBufferType3.max_length).to.equal(100000);
            expect(varBufferType3._header_size).to.equal(4);

            // Test default max_length
            const varBufferType4 = from_json({
                type: 'VarBufferType'
            });
            expect(varBufferType4).to.be.instanceOf(VarBufferType);
            expect(varBufferType4.max_length).to.equal(65535);
        });
    });

    describe('Edge cases and buffer offsets', function() {
        it('should work correctly with non-zero offsets', function() {
            const type = new VarBufferType();
            const buffer = Buffer.alloc(100);
            const testBuffer = Buffer.from([0x01, 0x02, 0x03, 0x04]);
            const offset = 10;

            const bytesWritten = type.encode(testBuffer, buffer, offset);
            expect(bytesWritten).to.equal(6); // 2 + 4

            const decoded = type.decode(buffer, offset);
            expect(decoded.value).to.deep.equal(testBuffer);
            expect(decoded.bytes_read).to.equal(6);
        });

        it('should handle maximum size buffers at buffer boundaries', function() {
            // Test with 1-byte header at its limit
            const type1 = new VarBufferType(255);
            const testBuffer1 = Buffer.alloc(255, 0xAA);
            const buffer1 = Buffer.alloc(256); // Exactly enough space
            
            const bytesWritten1 = type1.encode(testBuffer1, buffer1, 0);
            expect(bytesWritten1).to.equal(256); // 1 + 255
            
            const decoded1 = type1.decode(buffer1, 0);
            expect(decoded1.value).to.deep.equal(testBuffer1);

            // Test with 2-byte header
            const type2 = new VarBufferType(65535);
            const testBuffer2 = Buffer.alloc(1000, 0xBB);
            const buffer2 = Buffer.alloc(1002); // Exactly enough space
            
            const bytesWritten2 = type2.encode(testBuffer2, buffer2, 0);
            expect(bytesWritten2).to.equal(1002); // 2 + 1000
            
            const decoded2 = type2.decode(buffer2, 0);
            expect(decoded2.value).to.deep.equal(testBuffer2);
        });
    });
});
