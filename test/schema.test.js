/**
 * @fileoverview Tests for Schema class functionality
 */

const { expect } = require('chai');
const Schema = require('../lib/Schema');
const { 
    UInt8, UInt16, UInt32, FixedStringType, VarStringType, ArrayType, 
    EnumType, OptionalType, BooleanType, ParserError, MapType, TupleType 
} = require('../lib/types');

describe('Schema', function() {
    describe('Constructor', function() {
        it('should create a schema with a Type', function() {
            const type = new UInt8();
            const schema = new Schema(type);
            
            expect(schema.byte_length).to.equal(1);
            expect(schema.is_static_length).to.be.true;
        });

        it('should throw error if no type provided', function() {
            expect(() => new Schema()).to.throw(ParserError, 'Schema requires a Type');
            expect(() => new Schema(null)).to.throw(ParserError, 'Schema requires a Type');
        });

        it('should work with MapType for structured data', function() {
            const mapType = new MapType([
                ['age', new UInt8()],
                ['score', new UInt16()],
                ['name', new FixedStringType(10)]
            ]);
            const schema = new Schema(mapType);
            
            expect(schema.byte_length).to.equal(13); // 1 + 2 + 10
            expect(schema.is_static_length).to.be.true;
        });

        it('should work with variable-length types', function() {
            const varType = new VarStringType(20);
            const schema = new Schema(varType);
            
            expect(schema.byte_length).to.be.null;
            expect(schema.is_static_length).to.be.false;
        });
    });

    describe('Properties', function() {
        it('should calculate byte_length correctly for static types', function() {
            const tupleType = new TupleType(new UInt8(), new UInt16(), new BooleanType());
            const schema = new Schema(tupleType);
            
            expect(schema.byte_length).to.equal(4); // 1 + 2 + 1
        });

        it('should return null for variable-length schemas', function() {
            const mapType = new MapType([
                ['id', new UInt16()],
                ['data', new VarStringType(50)]
            ]);
            const schema = new Schema(mapType);
            
            expect(schema.byte_length).to.be.null;
        });

        it('should calculate_byte_length for specific values', function() {
            const varType = new VarStringType(20);
            const schema = new Schema(varType);
            
            expect(schema.calculate_byte_length('hello')).to.equal(6); // 1 + 5
            expect(schema.calculate_byte_length('test')).to.equal(5); // 1 + 4
        });
    });

    describe('Validation', function() {
        it('should validate values through wrapped type', function() {
            const schema = new Schema(new UInt8());
            
            expect(() => schema.validate(100)).to.not.throw();
            expect(() => schema.validate(300)).to.throw(ParserError, 'Schema validation failed');
        });

        it('should validate complex structured data', function() {
            const mapType = new MapType([
                ['id', new UInt8()],
                ['name', new FixedStringType(10)],
                ['active', new BooleanType()]
            ]);
            const schema = new Schema(mapType);
            
            const validData = { id: 42, name: 'Alice', active: true };
            const invalidData = { id: 300, name: 'Alice', active: true };
            
            expect(() => schema.validate(validData)).to.not.throw();
            expect(() => schema.validate(invalidData)).to.throw(ParserError, 'Schema validation failed');
        });
    });

    describe('Encoding', function() {
        it('should encode simple values', function() {
            const schema = new Schema(new UInt16());
            const buffer = Buffer.alloc(10);
            
            const bytesWritten = schema.encode(1234, buffer, 0);
            expect(bytesWritten).to.equal(2);
            expect(buffer.readUInt16LE(0)).to.equal(1234);
        });

        it('should encode structured data with MapType', function() {
            const mapType = new MapType([
                ['id', new UInt8()],
                ['score', new UInt16()]
            ]);
            const schema = new Schema(mapType);
            
            const data = { id: 42, score: 1500 };
            const buffer = Buffer.alloc(10);
            
            const bytesWritten = schema.encode(data, buffer, 0);
            expect(bytesWritten).to.equal(3);
            expect(buffer.readUInt8(0)).to.equal(42);
            expect(buffer.readUInt16LE(1)).to.equal(1500);
        });

        it('should require buffer parameter for encode', function() {
            const schema = new Schema(new UInt8());
            expect(() => schema.encode(123)).to.throw(ParserError, 'Buffer is required for encode()');
        });

        it('should serialize to new buffer with serialize method', function() {
            const schema = new Schema(new UInt8());
            const buffer = schema.serialize(123);
            expect(Buffer.isBuffer(buffer)).to.be.true;
            expect(buffer.length).to.equal(1);
            expect(buffer.readUInt8(0)).to.equal(123);
        });

        it('should serialize with offset padding', function() {
            const schema = new Schema(new UInt8());
            const buffer = schema.serialize(123, 5);
            expect(buffer.length).to.equal(6); // 1 byte data + 5 bytes offset
            expect(buffer.readUInt8(5)).to.equal(123);
            // Check padding is zeros
            for (let i = 0; i < 5; i++) {
                expect(buffer.readUInt8(i)).to.equal(0);
            }
        });

        it('should handle variable-length data', function() {
            const schema = new Schema(new VarStringType(20));
            const data = 'hello';
            const buffer = Buffer.alloc(10);
            
            const bytesWritten = schema.encode(data, buffer, 0);
            expect(bytesWritten).to.equal(6); // 1 + 5
        });

        it('should throw error if buffer too small', function() {
            const schema = new Schema(new UInt16());
            const buffer = Buffer.alloc(1); // Too small
            
            expect(() => schema.encode(1234, buffer)).to.throw('Buffer is too small');
        });
    });

    describe('Decoding', function() {
        it('should decode simple values', function() {
            const schema = new Schema(new UInt16());
            const buffer = Buffer.alloc(2);
            buffer.writeUInt16LE(1234, 0);
            
            const result = schema.decode(buffer, 0);
            expect(result.value).to.equal(1234);
            expect(result.bytes_read).to.equal(2);
        });

        it('should decode structured data with MapType', function() {
            const mapType = new MapType([
                ['id', new UInt8()],
                ['name', new FixedStringType(5)],
                ['active', new BooleanType()]
            ]);
            const schema = new Schema(mapType);
            
            const originalData = { id: 42, name: 'Alice', active: true };
            const buffer = Buffer.alloc(20);
            schema.encode(originalData, buffer, 0);
            
            const result = schema.decode(buffer, 0);
            expect(result.value).to.deep.equal(originalData);
            expect(result.bytes_read).to.equal(7); // 1 + 5 + 1
        });

        it('should decode with offset', function() {
            const schema = new Schema(new UInt8());
            const buffer = Buffer.alloc(10);
            buffer.writeUInt8(123, 5);
            
            const result = schema.decode(buffer, 5);
            expect(result.value).to.equal(123);
            expect(result.bytes_read).to.equal(1);
        });

        it('should deserialize directly to value without wrapper', function() {
            const schema = new Schema(new UInt8());
            const buffer = Buffer.alloc(1);
            buffer.writeUInt8(123, 0);
            
            const value = schema.deserialize(buffer);
            expect(value).to.equal(123); // Direct value, not wrapped
        });

        it('should deserialize with offset', function() {
            const schema = new Schema(new UInt8());
            const buffer = Buffer.alloc(10);
            buffer.writeUInt8(123, 5);
            
            const value = schema.deserialize(buffer, 5);
            expect(value).to.equal(123);
        });
    });

    describe('Round-trip encoding/decoding', function() {
        it('should maintain data integrity for complex structures', function() {
            const mapType = new MapType([
                ['header', new TupleType(new UInt8(), new UInt16())],
                ['metadata', new MapType([
                    ['version', new UInt8()],
                    ['flags', new ArrayType(new BooleanType(), 3)]
                ])],
                ['payload', new VarStringType(100)]
            ]);
            const schema = new Schema(mapType);
            
            const originalData = {
                header: [42, 1234],
                metadata: {
                    version: 2,
                    flags: [true, false, true]
                },
                payload: 'Hello, World!'
            };
            
            const buffer = Buffer.alloc(100);
            const bytesWritten = schema.encode(originalData, buffer, 0);
            const result = schema.decode(buffer, 0);
            
            expect(result.value).to.deep.equal(originalData);
            expect(result.bytes_read).to.equal(bytesWritten);
        });

        it('should work with different type combinations', function() {
            const tupleType = new TupleType(
                new UInt8(),
                new VarStringType(20),
                new OptionalType(new UInt16()),
                new EnumType(['red', 'green', 'blue'])
            );
            const schema = new Schema(tupleType);
            
            const originalData = [255, 'test', 12345, 'blue'];
            
            const buffer = Buffer.alloc(50);
            const bytesWritten = schema.encode(originalData, buffer, 0);
            const result = schema.decode(buffer, 0);
            
            expect(result.value).to.deep.equal(originalData);
            expect(result.bytes_read).to.equal(bytesWritten);
        });
    });

    describe('JSON Serialization', function() {
        it('should serialize and deserialize schema', function() {
            const mapType = new MapType([
                ['id', new UInt8()],
                ['name', new FixedStringType(10)]
            ]);
            const schema = new Schema(mapType);
            
            const json = schema.to_json();
            expect(json.type).to.equal('Schema');
            expect(json.root_type.type).to.equal('MapType');
            
            const reconstructed = Schema.from_json(json);
            expect(reconstructed.byte_length).to.equal(schema.byte_length);
            expect(reconstructed.is_static_length).to.equal(schema.is_static_length);
        });

        it('should maintain functionality after JSON round-trip', function() {
            const tupleType = new TupleType(
                new UInt16(),
                new VarStringType(30)
            );
            const schema = new Schema(tupleType);
            
            const json = schema.to_json();
            const reconstructed = Schema.from_json(json);
            
            const testData = [42, 'hello world'];
            
            // Test both schemas produce same results
            const buffer1 = Buffer.alloc(50);
            const buffer2 = Buffer.alloc(50);
            
            const bytes1 = schema.encode(testData, buffer1, 0);
            const bytes2 = reconstructed.encode(testData, buffer2, 0);
            
            expect(bytes1).to.equal(bytes2);
            expect(buffer1.slice(0, bytes1).equals(buffer2.slice(0, bytes2))).to.be.true;
            
            const result1 = schema.decode(buffer1, 0);
            const result2 = reconstructed.decode(buffer2, 0);
            
            expect(result1.value).to.deep.equal(result2.value);
            expect(result1.value).to.deep.equal(testData);
        });
    });

    describe('Edge Cases', function() {
        it('should handle empty MapType', function() {
            const emptyMap = new MapType([]);
            const schema = new Schema(emptyMap);
            
            expect(schema.byte_length).to.equal(0);
            expect(schema.is_static_length).to.be.true;
            
            const buffer = Buffer.alloc(1);
            const bytesWritten = schema.encode({}, buffer, 0);
            expect(bytesWritten).to.equal(0);
            
            const result = schema.decode(buffer, 0);
            expect(result.value).to.deep.equal({});
            expect(result.bytes_read).to.equal(0);
        });

        it('should handle empty TupleType', function() {
            const emptyTuple = new TupleType();
            const schema = new Schema(emptyTuple);
            
            expect(schema.byte_length).to.equal(0);
            expect(schema.is_static_length).to.be.true;
            
            const buffer = Buffer.alloc(1);
            const bytesWritten = schema.encode([], buffer, 0);
            expect(bytesWritten).to.equal(0);
            
            const result = schema.decode(buffer, 0);
            expect(result.value).to.deep.equal([]);
            expect(result.bytes_read).to.equal(0);
        });

        it('should handle mixed static/variable-length fields', function() {
            const mixedMap = new MapType([
                ['fixed_id', new UInt32()],
                ['variable_text', new VarStringType(100)],
                ['fixed_flag', new BooleanType()]
            ]);
            const schema = new Schema(mixedMap);
            
            expect(schema.byte_length).to.be.null; // Variable due to VarStringType
            
            const testData = { fixed_id: 123456, variable_text: 'dynamic', fixed_flag: false };
            const calculatedLength = schema.calculate_byte_length(testData);
            expect(calculatedLength).to.equal(4 + 1 + 7 + 1); // 4 + (1+7) + 1 = 13
            
            const buffer = Buffer.alloc(20);
            const bytesWritten = schema.encode(testData, buffer, 0);
            expect(bytesWritten).to.equal(calculatedLength);
            
            const result = schema.decode(buffer, 0);
            expect(result.value).to.deep.equal(testData);
        });
    });
});
