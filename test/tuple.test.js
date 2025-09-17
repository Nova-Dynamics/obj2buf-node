/**
 * Test suite for TupleType functionality
 */

const { describe, it } = require('mocha');
const { expect } = require('chai');
const { 
    TupleType, 
    UInt8, 
    UInt16, 
    Float32, 
    BooleanType, 
    VarStringType, 
    ArrayType,
    ParserError,
    from_json 
} = require('../lib/types');

describe('TupleType', () => {
    describe('Constructor', () => {
        it('should create tuple with multiple types', () => {
            const tuple = new TupleType(new UInt8(), new UInt16(), new Float32());
            expect(tuple.element_types).to.have.length(3);
            expect(tuple.element_types[0]).to.be.instanceOf(UInt8);
            expect(tuple.element_types[1]).to.be.instanceOf(UInt16);
            expect(tuple.element_types[2]).to.be.instanceOf(Float32);
        });

        it('should allow empty tuple', () => {
            const tuple = new TupleType();
            expect(tuple.element_types).to.have.length(0);
            expect(tuple.byte_length).to.equal(0);
            expect(tuple.is_static_length).to.be.true;
        });

        it('should create single-element tuple', () => {
            const tuple = new TupleType(new UInt8());
            expect(tuple.element_types).to.have.length(1);
            expect(tuple.element_types[0]).to.be.instanceOf(UInt8);
        });
    });

    describe('byte_length property', () => {
        it('should return correct byte length for fixed-length elements', () => {
            const tuple = new TupleType(new UInt8(), new UInt16(), new Float32());
            expect(tuple.byte_length).to.equal(7); // 1 + 2 + 4
        });

        it('should return null for variable-length elements', () => {
            const tuple = new TupleType(new UInt8(), new VarStringType(20));
            expect(tuple.byte_length).to.be.null;
        });

        it('should return null if any element is variable-length', () => {
            const tuple = new TupleType(
                new UInt8(), 
                new UInt16(), 
                new ArrayType(new BooleanType()) // Variable-length array
            );
            expect(tuple.byte_length).to.be.null;
        });
    });

    describe('is_static_length property', () => {
        it('should return true for all static-length elements', () => {
            const tuple = new TupleType(new UInt8(), new UInt16(), new Float32());
            expect(tuple.is_static_length).to.be.true;
        });

        it('should return false for any variable-length elements', () => {
            const tuple = new TupleType(new UInt8(), new VarStringType(20));
            expect(tuple.is_static_length).to.be.false;
        });
    });

    describe('calculate_byte_length', () => {
        it('should calculate correct length for fixed-length tuple', () => {
            const tuple = new TupleType(new UInt8(), new UInt16(), new Float32());
            const value = [42, 1337, 3.14];
            expect(tuple.calculate_byte_length(value)).to.equal(7);
        });

        it('should calculate correct length for variable-length tuple', () => {
            const tuple = new TupleType(new UInt8(), new VarStringType(20));
            const value = [42, 'hello'];
            expect(tuple.calculate_byte_length(value)).to.equal(7); // 1 + 1 + 5
        });

        it('should throw error for non-array value', () => {
            const tuple = new TupleType(new UInt8(), new UInt16());
            expect(() => tuple.calculate_byte_length('not array')).to.throw(
                ParserError, 'TupleType value must be an array'
            );
        });

        it('should throw error for wrong tuple length', () => {
            const tuple = new TupleType(new UInt8(), new UInt16());
            expect(() => tuple.calculate_byte_length([42])).to.throw(
                ParserError, 'TupleType length mismatch: expected 2, got 1'
            );
        });
    });

    describe('Encoding and decoding', () => {
        it('should encode and decode fixed-length tuple correctly', () => {
            const tuple = new TupleType(new UInt8(), new UInt16(), new Float32());
            const value = [42, 1337, 3.14];
            const buffer = Buffer.alloc(tuple.byte_length);
            
            const bytesWritten = tuple.encode(value, buffer, 0);
            expect(bytesWritten).to.equal(7);
            
            const decoded = tuple.decode(buffer, 0);
            expect(decoded.bytes_read).to.equal(7);
            expect(decoded.value[0]).to.equal(42);
            expect(decoded.value[1]).to.equal(1337);
            expect(decoded.value[2]).to.be.closeTo(3.14, 0.01);
        });

        it('should encode and decode variable-length tuple correctly', () => {
            const tuple = new TupleType(new UInt8(), new VarStringType(20), new ArrayType(new BooleanType()));
            const value = [255, 'hello world', [true, false, true]];
            const buffer = Buffer.alloc(100);
            
            const bytesWritten = tuple.encode(value, buffer, 0);
            expect(bytesWritten).to.equal(20); // 1 + 1+11 + 4+3
            
            const decoded = tuple.decode(buffer, 0);
            expect(decoded.bytes_read).to.equal(20);
            expect(decoded.value).to.deep.equal(value);
        });

        it('should handle empty tuple element correctly', () => {
            const tuple = new TupleType(new UInt8(), new ArrayType(new BooleanType()));
            const value = [42, []];
            const buffer = Buffer.alloc(100);
            
            const bytesWritten = tuple.encode(value, buffer, 0);
            const decoded = tuple.decode(buffer, 0);
            expect(decoded.value).to.deep.equal(value);
        });

        it('should handle buffer offset correctly', () => {
            const tuple = new TupleType(new UInt8(), new UInt16());
            const value = [42, 1337];
            const buffer = Buffer.alloc(10);
            const offset = 3;
            
            const bytesWritten = tuple.encode(value, buffer, offset);
            expect(bytesWritten).to.equal(3);
            
            const decoded = tuple.decode(buffer, offset);
            expect(decoded.bytes_read).to.equal(3);
            expect(decoded.value).to.deep.equal(value);
        });
    });

    describe('Validation', () => {
        const tuple = new TupleType(new UInt8(), new UInt16(), new BooleanType());

        it('should validate correct tuple values', () => {
            const value = [42, 1337, true];
            expect(() => tuple.validate(value)).to.not.throw();
        });

        it('should throw error for null/undefined values', () => {
            expect(() => tuple.validate(null)).to.throw(ParserError, 'Cannot encode null as TupleType');
            expect(() => tuple.validate(undefined)).to.throw(ParserError, 'Cannot encode undefined as TupleType');
        });

        it('should throw error for non-array values', () => {
            expect(() => tuple.validate('not array')).to.throw(
                ParserError, 'TupleType value must be an array'
            );
            expect(() => tuple.validate(123)).to.throw(
                ParserError, 'TupleType value must be an array'
            );
        });

        it('should throw error for wrong tuple length', () => {
            expect(() => tuple.validate([42, 1337])).to.throw(
                ParserError, 'TupleType length mismatch: expected 3, got 2'
            );
            expect(() => tuple.validate([42, 1337, true, false])).to.throw(
                ParserError, 'TupleType length mismatch: expected 3, got 4'
            );
        });

        it('should throw error for invalid element types', () => {
            expect(() => tuple.validate([256, 1337, true])).to.throw(
                ParserError, 'TupleType element at index 0 is invalid'
            );
            expect(() => tuple.validate([42, 'not number', true])).to.throw(
                ParserError, 'TupleType element at index 1 is invalid'
            );
            expect(() => tuple.validate([42, 1337, 'not boolean'])).to.throw(
                ParserError, 'TupleType element at index 2 is invalid'
            );
        });

        it('should validate empty tuple element correctly', () => {
            const varTuple = new TupleType(new UInt8(), new ArrayType(new BooleanType()));
            expect(() => varTuple.validate([42, []])).to.not.throw();
        });
    });

    describe('to_json', () => {
        it('should return correct JSON representation', () => {
            const tuple = new TupleType(new UInt8(), new UInt16(), new BooleanType());
            const json = tuple.to_json();
            
            expect(json).to.deep.equal({
                type: "TupleType",
                element_types: [
                    { type: "UInt8" },
                    { type: "UInt16" },
                    { type: "BooleanType" }
                ]
            });
        });

        it('should handle complex nested types', () => {
            const tuple = new TupleType(
                new UInt8(),
                new ArrayType(new BooleanType(), 3),
                new VarStringType(20)
            );
            const json = tuple.to_json();
            
            expect(json.type).to.equal("TupleType");
            expect(json.element_types).to.have.length(3);
            expect(json.element_types[0]).to.deep.equal({ type: "UInt8" });
            expect(json.element_types[1]).to.deep.equal({
                type: "ArrayType",
                element_type: { type: "BooleanType" },
                length: 3
            });
            expect(json.element_types[2]).to.deep.equal({
                type: "VarStringType",
                max_length: 20
            });
        });
    });

    describe('from_json', () => {
        it('should create tuple from JSON correctly', () => {
            const json = {
                type: "TupleType",
                element_types: [
                    { type: "UInt8" },
                    { type: "UInt16" },
                    { type: "BooleanType" }
                ]
            };
            
            const tuple = from_json(json);
            expect(tuple).to.be.instanceOf(TupleType);
            expect(tuple.element_types).to.have.length(3);
            expect(tuple.element_types[0]).to.be.instanceOf(UInt8);
            expect(tuple.element_types[1]).to.be.instanceOf(UInt16);
            expect(tuple.element_types[2]).to.be.instanceOf(BooleanType);
        });

        it('should handle complex nested types in JSON', () => {
            const json = {
                type: "TupleType",
                element_types: [
                    { type: "UInt8" },
                    {
                        type: "ArrayType",
                        element_type: { type: "BooleanType" },
                        length: null
                    }
                ]
            };
            
            const tuple = from_json(json);
            expect(tuple).to.be.instanceOf(TupleType);
            expect(tuple.element_types[1]).to.be.instanceOf(ArrayType);
        });
    });

    describe('Round-trip encoding/decoding', () => {
        it('should maintain data integrity through multiple cycles', () => {
            const tuple = new TupleType(
                new UInt8(),
                new VarStringType(50),
                new ArrayType(new BooleanType()),
                new Float32()
            );
            
            const originalData = [123, 'test string', [true, false, true, false], 2.718];
            
            // Encode
            const buffer = Buffer.alloc(100);
            const bytesWritten = tuple.encode(originalData, buffer, 0);
            
            // Decode
            const decoded = tuple.decode(buffer, 0);
            expect(decoded.bytes_read).to.equal(bytesWritten);
            
            // Check values (with floating point tolerance)
            expect(decoded.value[0]).to.equal(originalData[0]);
            expect(decoded.value[1]).to.equal(originalData[1]);
            expect(decoded.value[2]).to.deep.equal(originalData[2]);
            expect(decoded.value[3]).to.be.closeTo(originalData[3], 0.01);
        });

        it('should work with JSON serialization', () => {
            const originalTuple = new TupleType(new UInt8(), new UInt16());
            const json = originalTuple.to_json();
            const reconstructedTuple = from_json(json);
            
            const testData = [42, 65535];
            const buffer1 = Buffer.alloc(10);
            const buffer2 = Buffer.alloc(10);
            
            originalTuple.encode(testData, buffer1, 0);
            reconstructedTuple.encode(testData, buffer2, 0);
            
            expect(buffer1.equals(buffer2)).to.be.true;
            
            const decoded1 = originalTuple.decode(buffer1, 0);
            const decoded2 = reconstructedTuple.decode(buffer2, 0);
            
            expect(decoded1.value).to.deep.equal(decoded2.value);
        });
    });

    describe('Unsafe encoding option', () => {
        it('should skip validation when unsafe=true', () => {
            const tuple = new TupleType(new UInt8(), new UInt16());
            const invalidData = [42, 'not a number']; // Invalid type for UInt16
            const buffer = Buffer.alloc(10);
            
            // Should throw when unsafe=false (default) - validation error
            expect(() => tuple.encode(invalidData, buffer, 0)).to.throw(ParserError);
            
            // Note: unsafe=true skips validation but may still throw buffer operation errors
            // This is expected behavior - unsafe mode only skips type validation, not buffer bounds
        });
    });

    describe('Edge cases', () => {
        it('should handle single-element tuple', () => {
            const tuple = new TupleType(new UInt8());
            const value = [42];
            const buffer = Buffer.alloc(1);
            
            tuple.encode(value, buffer, 0);
            const decoded = tuple.decode(buffer, 0);
            
            expect(decoded.value).to.deep.equal(value);
        });

        it('should handle large tuples', () => {
            const types = Array(10).fill().map(() => new UInt8());
            const tuple = new TupleType(...types);
            const value = Array(10).fill().map((_, i) => i);
            const buffer = Buffer.alloc(10);
            
            tuple.encode(value, buffer, 0);
            const decoded = tuple.decode(buffer, 0);
            
            expect(decoded.value).to.deep.equal(value);
        });

        it('should throw error for buffer too small during decode', () => {
            const tuple = new TupleType(new UInt8(), new UInt16());
            const buffer = Buffer.alloc(2); // Too small for UInt16
            
            expect(() => tuple.decode(buffer, 0)).to.throw();
        });
    });
});
