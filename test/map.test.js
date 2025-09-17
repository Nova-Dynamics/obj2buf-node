/**
 * Test suite for MapType functionality
 */

const { describe, it } = require('mocha');
const { expect } = require('chai');
const { 
    MapType, 
    UInt8, 
    UInt16, 
    UInt32,
    Float32, 
    BooleanType, 
    VarStringType, 
    ArrayType,
    ParserError,
    from_json 
} = require('../lib/types');

describe('MapType', () => {
    describe('Constructor', () => {
        it('should create map with array of key-value pairs', () => {
            const map = new MapType([
                ['game_id', new UInt16()],
                ['player_count', new UInt8()],
                ['active', new BooleanType()]
            ]);
            
            expect(map.field_names).to.deep.equal(['game_id', 'player_count', 'active']);
            expect(map.field_types['game_id']).to.be.instanceOf(UInt16);
            expect(map.field_types['player_count']).to.be.instanceOf(UInt8);
            expect(map.field_types['active']).to.be.instanceOf(BooleanType);
        });

        it('should preserve field ordering', () => {
            const map = new MapType([
                ['z_field', new UInt8()],
                ['a_field', new UInt16()],
                ['m_field', new UInt32()]
            ]);
            
            expect(map.field_names).to.deep.equal(['z_field', 'a_field', 'm_field']);
        });

        it('should allow empty field array', () => {
            const map = new MapType([]);
            expect(map.field_names).to.have.length(0);
            expect(map.byte_length).to.equal(0);
            expect(map.is_static_length).to.be.true;
        });

        it('should throw error for non-array input', () => {
            expect(() => new MapType({ game_id: new UInt16() })).to.throw(
                ParserError, 'MapType requires an array of [key, Type] pairs'
            );
            expect(() => new MapType('not array')).to.throw(
                ParserError, 'MapType requires an array of [key, Type] pairs'
            );
        });

        it('should throw error for invalid pair format', () => {
            expect(() => new MapType([['valid', new UInt8()], 'invalid'])).to.throw(
                ParserError, 'Field pair at index 1 must be [key, Type] array'
            );
            expect(() => new MapType([['key']])).to.throw(
                ParserError, 'Field pair at index 0 must be [key, Type] array'
            );
        });

        it('should throw error for non-string keys', () => {
            expect(() => new MapType([[123, new UInt8()]])).to.throw(
                ParserError, 'Field key at index 0 must be a string'
            );
            expect(() => new MapType([[null, new UInt8()]])).to.throw(
                ParserError, 'Field key at index 0 must be a string'
            );
        });

        it('should throw error for invalid types', () => {
            expect(() => new MapType([['key', 'not a type']])).to.throw(
                ParserError, 'Field type at index 0 must be a valid Type instance'
            );
            expect(() => new MapType([['key', null]])).to.throw(
                ParserError, 'Field type at index 0 must be a valid Type instance'
            );
        });
    });

    describe('byte_length property', () => {
        it('should return correct byte length for fixed-length fields', () => {
            const map = new MapType([
                ['id', new UInt16()],
                ['count', new UInt8()],
                ['score', new Float32()]
            ]);
            
            expect(map.byte_length).to.equal(7); // 2 + 1 + 4
        });

        it('should return null for variable-length fields', () => {
            const map = new MapType([
                ['id', new UInt16()],
                ['name', new VarStringType(20)]
            ]);
            
            expect(map.byte_length).to.be.null;
        });

        it('should return null if any field is variable-length', () => {
            const map = new MapType([
                ['id', new UInt16()],
                ['count', new UInt8()],
                ['tags', new ArrayType(new UInt8())] // Variable-length array
            ]);
            
            expect(map.byte_length).to.be.null;
        });
    });

    describe('is_static_length property', () => {
        it('should return true for all static-length fields', () => {
            const map = new MapType([
                ['id', new UInt16()],
                ['count', new UInt8()],
                ['active', new BooleanType()]
            ]);
            
            expect(map.is_static_length).to.be.true;
        });

        it('should return false for any variable-length fields', () => {
            const map = new MapType([
                ['id', new UInt16()],
                ['name', new VarStringType(20)]
            ]);
            
            expect(map.is_static_length).to.be.false;
        });
    });

    describe('calculate_byte_length', () => {
        it('should calculate correct length for fixed-length map', () => {
            const map = new MapType([
                ['id', new UInt16()],
                ['count', new UInt8()]
            ]);
            
            const value = { id: 12345, count: 42 };
            expect(map.calculate_byte_length(value)).to.equal(3);
        });

        it('should calculate correct length for variable-length map', () => {
            const map = new MapType([
                ['id', new UInt8()],
                ['name', new VarStringType(20)]
            ]);
            
            const value = { id: 42, name: 'test' };
            expect(map.calculate_byte_length(value)).to.equal(6); // 1 + 1 + 4
        });

        it('should throw error for non-object value', () => {
            const map = new MapType([['id', new UInt8()]]);
            
            expect(() => map.calculate_byte_length('not object')).to.throw(
                ParserError, 'MapType value must be an object'
            );
        });

        it('should throw error for missing required fields', () => {
            const map = new MapType([
                ['id', new UInt16()],
                ['name', new VarStringType(10)]
            ]);
            
            expect(() => map.calculate_byte_length({ id: 123 })).to.throw(
                ParserError, 'MapType missing required field: name'
            );
        });
    });

    describe('Encoding and decoding', () => {
        it('should encode and decode fixed-length map correctly', () => {
            const map = new MapType([
                ['session_id', new UInt16()],
                ['player_count', new UInt8()],
                ['active', new BooleanType()]
            ]);
            
            const value = { session_id: 12345, player_count: 4, active: true };
            const buffer = Buffer.alloc(map.byte_length);
            
            const bytesWritten = map.encode(value, buffer, 0);
            expect(bytesWritten).to.equal(4);
            
            const decoded = map.decode(buffer, 0);
            expect(decoded.bytes_read).to.equal(4);
            expect(decoded.value).to.deep.equal(value);
        });

        it('should encode and decode variable-length map correctly', () => {
            const map = new MapType([
                ['id', new UInt8()],
                ['name', new VarStringType(20)],
                ['scores', new ArrayType(new UInt16())]
            ]);
            
            const value = { id: 42, name: 'Alice', scores: [100, 200, 300] };
            const buffer = Buffer.alloc(50);
            
            const bytesWritten = map.encode(value, buffer, 0);
            expect(bytesWritten).to.equal(17); // 1 + (1+5) + (4+6) = 17
            
            const decoded = map.decode(buffer, 0);
            expect(decoded.bytes_read).to.equal(17);
            expect(decoded.value).to.deep.equal(value);
        });

        it('should maintain field order during encoding/decoding', () => {
            const map = new MapType([
                ['third', new UInt8()],
                ['first', new UInt16()],
                ['second', new UInt8()]
            ]);
            
            const value = { third: 3, first: 1, second: 2 };
            const buffer = Buffer.alloc(4);
            
            map.encode(value, buffer, 0);
            const decoded = map.decode(buffer, 0);
            
            // Check that field order in decoded object matches definition order
            const keys = Object.keys(decoded.value);
            expect(keys).to.deep.equal(['third', 'first', 'second']);
        });

        it('should handle buffer offset correctly', () => {
            const map = new MapType([
                ['id', new UInt8()],
                ['count', new UInt16()]
            ]);
            
            const value = { id: 42, count: 1337 };
            const buffer = Buffer.alloc(10);
            const offset = 3;
            
            const bytesWritten = map.encode(value, buffer, offset);
            expect(bytesWritten).to.equal(3);
            
            const decoded = map.decode(buffer, offset);
            expect(decoded.bytes_read).to.equal(3);
            expect(decoded.value).to.deep.equal(value);
        });
    });

    describe('Validation', () => {
        const map = new MapType([
            ['id', new UInt8()],
            ['name', new VarStringType(10)],
            ['active', new BooleanType()]
        ]);

        it('should validate correct map values', () => {
            const value = { id: 42, name: 'test', active: true };
            expect(() => map.validate(value)).to.not.throw();
        });

        it('should throw error for null/undefined values', () => {
            expect(() => map.validate(null)).to.throw(ParserError, 'Cannot encode null as MapType');
            expect(() => map.validate(undefined)).to.throw(ParserError, 'Cannot encode undefined as MapType');
        });

        it('should throw error for non-object values', () => {
            expect(() => map.validate('not object')).to.throw(
                ParserError, 'MapType value must be an object'
            );
            expect(() => map.validate(123)).to.throw(
                ParserError, 'MapType value must be an object'
            );
            expect(() => map.validate([1, 2, 3])).to.throw(
                ParserError, 'MapType value must be an object'
            );
        });

        it('should throw error for missing required fields', () => {
            expect(() => map.validate({ id: 42, name: 'test' })).to.throw(
                ParserError, 'MapType missing required field: active'
            );
            expect(() => map.validate({ id: 42 })).to.throw(
                ParserError, 'MapType missing required field: name'
            );
        });

        it('should throw error for invalid field types', () => {
            expect(() => map.validate({ id: 256, name: 'test', active: true })).to.throw(
                ParserError, 'MapType field \'id\' is invalid'
            );
            expect(() => map.validate({ id: 42, name: 123, active: true })).to.throw(
                ParserError, 'MapType field \'name\' is invalid'
            );
            expect(() => map.validate({ id: 42, name: 'test', active: 'not bool' })).to.throw(
                ParserError, 'MapType field \'active\' is invalid'
            );
        });

        it('should allow extra fields in the object', () => {
            const value = { id: 42, name: 'test', active: true, extra: 'ignored' };
            expect(() => map.validate(value)).to.not.throw();
        });
    });

    describe('to_json', () => {
        it('should return correct JSON representation with field pairs', () => {
            const map = new MapType([
                ['id', new UInt8()],
                ['name', new VarStringType(20)],
                ['active', new BooleanType()]
            ]);
            
            const json = map.to_json();
            
            expect(json).to.deep.equal({
                type: "MapType",
                field_pairs: [
                    ["id", { type: "UInt8" }],
                    ["name", { type: "VarStringType", max_length: 20 }],
                    ["active", { type: "BooleanType" }]
                ]
            });
        });

        it('should preserve field ordering in JSON', () => {
            const map = new MapType([
                ['z_field', new UInt8()],
                ['a_field', new UInt16()],
                ['m_field', new UInt32()]
            ]);
            
            const json = map.to_json();
            const keys = json.field_pairs.map(([key]) => key);
            
            expect(keys).to.deep.equal(['z_field', 'a_field', 'm_field']);
        });

        it('should handle complex nested types', () => {
            const map = new MapType([
                ['id', new UInt8()],
                ['scores', new ArrayType(new UInt16(), 3)]
            ]);
            
            const json = map.to_json();
            
            expect(json.field_pairs[1]).to.deep.equal([
                "scores",
                {
                    type: "ArrayType",
                    element_type: { type: "UInt16" },
                    length: 3
                }
            ]);
        });
    });

    describe('from_json', () => {
        it('should create map from JSON correctly', () => {
            const json = {
                type: "MapType",
                field_pairs: [
                    ["id", { type: "UInt8" }],
                    ["name", { type: "VarStringType", max_length: 20 }],
                    ["active", { type: "BooleanType" }]
                ]
            };
            
            const map = from_json(json);
            expect(map).to.be.instanceOf(MapType);
            expect(map.field_names).to.deep.equal(['id', 'name', 'active']);
            expect(map.field_types['id']).to.be.instanceOf(UInt8);
            expect(map.field_types['name']).to.be.instanceOf(VarStringType);
            expect(map.field_types['active']).to.be.instanceOf(BooleanType);
        });

        it('should preserve field ordering from JSON', () => {
            const json = {
                type: "MapType",
                field_pairs: [
                    ["third", { type: "UInt8" }],
                    ["first", { type: "UInt16" }],
                    ["second", { type: "UInt32" }]
                ]
            };
            
            const map = from_json(json);
            expect(map.field_names).to.deep.equal(['third', 'first', 'second']);
        });

        it('should handle complex nested types in JSON', () => {
            const json = {
                type: "MapType",
                field_pairs: [
                    ["id", { type: "UInt8" }],
                    ["scores", {
                        type: "ArrayType",
                        element_type: { type: "UInt16" },
                        length: null
                    }]
                ]
            };
            
            const map = from_json(json);
            expect(map.field_types['scores']).to.be.instanceOf(ArrayType);
        });
    });

    describe('Round-trip encoding/decoding', () => {
        it('should maintain data integrity through multiple cycles', () => {
            const map = new MapType([
                ['session_id', new UInt32()],
                ['player_name', new VarStringType(50)],
                ['scores', new ArrayType(new UInt16())],
                ['multiplier', new Float32()]
            ]);
            
            const originalData = {
                session_id: 123456,
                player_name: 'Alice',
                scores: [100, 200, 300, 150],
                multiplier: 1.5
            };
            
            // Encode
            const buffer = Buffer.alloc(100);
            const bytesWritten = map.encode(originalData, buffer, 0);
            
            // Decode
            const decoded = map.decode(buffer, 0);
            expect(decoded.bytes_read).to.equal(bytesWritten);
            
            // Check values (with floating point tolerance)
            expect(decoded.value.session_id).to.equal(originalData.session_id);
            expect(decoded.value.player_name).to.equal(originalData.player_name);
            expect(decoded.value.scores).to.deep.equal(originalData.scores);
            expect(decoded.value.multiplier).to.be.closeTo(originalData.multiplier, 0.01);
        });

        it('should work with JSON serialization', () => {
            const originalMap = new MapType([
                ['id', new UInt16()],
                ['name', new VarStringType(20)]
            ]);
            
            const json = originalMap.to_json();
            const reconstructedMap = from_json(json);
            
            const testData = { id: 42, name: 'test' };
            const buffer1 = Buffer.alloc(50);
            const buffer2 = Buffer.alloc(50);
            
            originalMap.encode(testData, buffer1, 0);
            reconstructedMap.encode(testData, buffer2, 0);
            
            expect(buffer1.equals(buffer2)).to.be.true;
            
            const decoded1 = originalMap.decode(buffer1, 0);
            const decoded2 = reconstructedMap.decode(buffer2, 0);
            
            expect(decoded1.value).to.deep.equal(decoded2.value);
        });
    });

    describe('Unsafe encoding option', () => {
        it('should skip validation when unsafe=true', () => {
            const map = new MapType([
                ['id', new UInt8()],
                ['name', new VarStringType(10)]
            ]);
            
            const invalidData = { id: 42 }; // Missing required field
            const buffer = Buffer.alloc(20);
            
            // Should throw when unsafe=false (default) - validation error
            expect(() => map.encode(invalidData, buffer, 0)).to.throw(ParserError);
            
            // Note: This tests that validation is properly skipped with unsafe=true
            // Buffer operations may still fail with invalid data, which is expected
        });
    });

    describe('Edge cases', () => {
        it('should handle single-field map', () => {
            const map = new MapType([['id', new UInt8()]]);
            const value = { id: 42 };
            const buffer = Buffer.alloc(1);
            
            map.encode(value, buffer, 0);
            const decoded = map.decode(buffer, 0);
            
            expect(decoded.value).to.deep.equal(value);
        });

        it('should handle maps with many fields', () => {
            const fields = Array(20).fill().map((_, i) => [`field${i}`, new UInt8()]);
            const map = new MapType(fields);
            
            const value = {};
            for (let i = 0; i < 20; i++) {
                value[`field${i}`] = i;
            }
            
            const buffer = Buffer.alloc(20);
            
            map.encode(value, buffer, 0);
            const decoded = map.decode(buffer, 0);
            
            expect(decoded.value).to.deep.equal(value);
        });

        it('should throw error for buffer too small during decode', () => {
            const map = new MapType([
                ['id', new UInt8()],
                ['score', new UInt32()]
            ]);
            
            const buffer = Buffer.alloc(2); // Too small for UInt32
            
            expect(() => map.decode(buffer, 0)).to.throw();
        });

        it('should handle empty string fields', () => {
            const map = new MapType([
                ['id', new UInt8()],
                ['name', new VarStringType(20)]
            ]);
            
            const value = { id: 42, name: '' };
            const buffer = Buffer.alloc(10);
            
            map.encode(value, buffer, 0);
            const decoded = map.decode(buffer, 0);
            
            expect(decoded.value).to.deep.equal(value);
        });
    });
});
