/**
 * @fileoverview Integration tests for the entire obj2buf module
 */

const { expect } = require('chai');
const { Schema, types } = require('../index');

describe('Integration Tests', function() {
    describe('Module exports', function() {
        it('should export Schema and types', function() {
            expect(Schema).to.be.a('function');
            expect(types).to.be.an('object');
        });

        it('should have all expected type exports', function() {
            const expectedTypes = [
                'ParserError', 'Type', 'UInt8', 'UInt16', 'UInt32',
                'Int8', 'Int16', 'Int32', 'Float32', 'Float64',
                'BooleanType', 'Char', 'ArrayType', 'FixedStringType',
                'VarStringType', 'EnumType', 'OptionalType', 'TupleType', 
                'MapType', 'from_json'
            ];
            
            expectedTypes.forEach(typeName => {
                expect(types[typeName]).to.exist;
            });
        });
    });

    describe('Real-world usage scenarios', function() {
        it('should handle a user profile schema with MapType', function() {
            // Define a user profile structure using MapType
            const userMapType = new types.MapType([
                ['id', new types.UInt32()],
                ['username', new types.FixedStringType(20)],
                ['email', new types.FixedStringType(50)],
                ['age', new types.UInt8()],
                ['is_active', new types.BooleanType()],
                ['score', new types.Float32()],
                ['permissions', new types.ArrayType(new types.UInt8(), 5)],
                ['role', new types.EnumType(['admin', 'user', 'moderator'])],
                ['last_login', new types.OptionalType(new types.UInt32())]
            ]);
            
            const userSchema = new Schema(userMapType);
            
            const userData = {
                id: 12345,
                username: 'john_doe',
                email: 'john@example.com',
                age: 28,
                is_active: true,
                score: 1234.5,
                permissions: [1, 2, 3, 4, 5],
                role: 'admin',
                last_login: 1609459200 // Unix timestamp
            };
            
            // Test encoding
            const buffer = Buffer.alloc(200);
            const bytesWritten = userSchema.encode(userData, buffer, 0);
            expect(bytesWritten).to.be.greaterThan(0);
            
            // Test decoding
            const decoded = userSchema.decode(buffer, 0);
            expect(decoded.value).to.deep.equal(userData);
            expect(decoded.bytes_read).to.equal(bytesWritten);
            
            // Test byte length calculation
            expect(userSchema.byte_length).to.equal(91); // Fixed size
            expect(userSchema.calculate_byte_length(userData)).to.equal(91);
        });

        it('should handle a game state schema with nested structures', function() {
            // Complex nested structure
            const gameMapType = new types.MapType([
                ['player_id', new types.UInt16()],
                ['level', new types.UInt8()],
                ['position', new types.TupleType(new types.Float32(), new types.Float32())],
                ['health', new types.UInt8()],
                ['inventory', new types.ArrayType(new types.UInt16(), 10)],
                ['weapon', new types.EnumType(['sword', 'bow', 'staff', 'none'])],
                ['magic_points', new types.OptionalType(new types.UInt16())]
            ]);
            
            const gameSchema = new Schema(gameMapType);
            
            const gameData = {
                player_id: 1001,
                level: 45,
                position: [123.45, 678.90],
                health: 85,
                inventory: [1, 2, 3, 4, 5, 0, 0, 0, 0, 0],
                weapon: 'sword',
                magic_points: 150
            };
            
            // Test round-trip
            const buffer = Buffer.alloc(100);
            const bytesWritten = gameSchema.encode(gameData, buffer, 0);
            const decoded = gameSchema.decode(buffer, 0);
            
            // Check non-float fields exactly
            expect(decoded.value.player_id).to.equal(gameData.player_id);
            expect(decoded.value.level).to.equal(gameData.level);
            expect(decoded.value.health).to.equal(gameData.health);
            expect(decoded.value.inventory).to.deep.equal(gameData.inventory);
            expect(decoded.value.weapon).to.equal(gameData.weapon);
            expect(decoded.value.magic_points).to.equal(gameData.magic_points);
            
            // Check float fields with tolerance for IEEE 754 precision
            expect(decoded.value.position[0]).to.be.closeTo(gameData.position[0], 0.01);
            expect(decoded.value.position[1]).to.be.closeTo(gameData.position[1], 0.01);
            
            expect(decoded.bytes_read).to.equal(bytesWritten);
        });

        it('should handle complex nested schemas with mixed types', function() {
            // Deeply nested structure using multiple type combinations
            const metadataType = new types.MapType([
                ['version', new types.UInt8()],
                ['flags', new types.ArrayType(new types.BooleanType(), 4)]
            ]);
            
            const headerType = new types.TupleType(
                new types.UInt32(), // timestamp
                new types.VarStringType(50), // description
                metadataType
            );
            
            const complexMapType = new types.MapType([
                ['header', headerType],
                ['payload_size', new types.UInt16()],
                ['checksums', new types.ArrayType(new types.UInt32(), 3)],
                ['optional_data', new types.OptionalType(new types.VarStringType(100))]
            ]);
            
            const complexSchema = new Schema(complexMapType);
            
            const complexData = {
                header: [
                    1609459200,
                    'Test message',
                    {
                        version: 2,
                        flags: [true, false, true, false]
                    }
                ],
                payload_size: 1024,
                checksums: [0x12345678, 0x87654321, 0xABCDEF00],
                optional_data: 'Some additional information'
            };
            
            // Since this contains variable-length strings, byte_length should be null
            expect(complexSchema.byte_length).to.be.null;
            
            // But we can calculate specific length
            const calculatedLength = complexSchema.calculate_byte_length(complexData);
            expect(calculatedLength).to.be.greaterThan(0);
            
            // Test round-trip
            const buffer = Buffer.alloc(200);
            const bytesWritten = complexSchema.encode(complexData, buffer, 0);
            const decoded = complexSchema.decode(buffer, 0);
            
            expect(decoded.value).to.deep.equal(complexData);
            expect(decoded.bytes_read).to.equal(bytesWritten);
            expect(bytesWritten).to.equal(calculatedLength);
        });

        it('should handle variable-length data with performance considerations', function() {
            // Schema with both fixed and variable parts
            const mixedMapType = new types.MapType([
                ['fixed_header', new types.TupleType(
                    new types.UInt32(), // id
                    new types.UInt16(), // version
                    new types.UInt8()   // status
                )],
                ['variable_content', new types.VarStringType(1000)],
                ['fixed_footer', new types.UInt32()] // checksum
            ]);
            
            const mixedSchema = new Schema(mixedMapType);
            
            // Test with different content sizes
            const testCases = [
                { content: 'short', expectedExtra: 7 }, // 2 + 5 (2-byte header due to max_length 1000)
                { content: 'medium length content here', expectedExtra: 28 }, // 2 + 26
                { content: 'very long content that should test the variable length encoding properly and ensure everything works as expected', expectedExtra: 114 } // 2 + 112
            ];
            
            testCases.forEach(({ content, expectedExtra }) => {
                const data = {
                    fixed_header: [12345, 1, 200],
                    variable_content: content,
                    fixed_footer: 0xDEADBEEF
                };
                
                const expectedLength = 7 + expectedExtra + 4; // fixed_header + variable + fixed_footer
                expect(mixedSchema.calculate_byte_length(data)).to.equal(expectedLength);
                
                const buffer = Buffer.alloc(1200);
                const bytesWritten = mixedSchema.encode(data, buffer, 0);
                const decoded = mixedSchema.decode(buffer, 0);
                
                expect(decoded.value).to.deep.equal(data);
                expect(bytesWritten).to.equal(expectedLength);
            });
        });
    });

    describe('Schema JSON serialization integration', function() {
        it('should maintain full functionality through JSON round-trip', function() {
            // Create a complex schema
            const originalMapType = new types.MapType([
                ['basic_fields', new types.TupleType(
                    new types.UInt8(),
                    new types.UInt16(),
                    new types.BooleanType()
                )],
                ['text_data', new types.VarStringType(100)],
                ['optional_array', new types.OptionalType(
                    new types.ArrayType(new types.UInt8(), 5)
                )],
                ['status', new types.EnumType(['pending', 'processing', 'completed', 'failed'])]
            ]);
            
            const originalSchema = new Schema(originalMapType);
            
            // Serialize to JSON and reconstruct
            const schemaJson = originalSchema.to_json();
            const reconstructedSchema = Schema.from_json(schemaJson);
            
            // Test data
            const testData = {
                basic_fields: [255, 65535, true],
                text_data: 'Hello, integration test!',
                optional_array: [1, 2, 3, 4, 5],
                status: 'completed'
            };
            
            // Both schemas should produce identical results
            const buffer1 = Buffer.alloc(200);
            const buffer2 = Buffer.alloc(200);
            
            const bytes1 = originalSchema.encode(testData, buffer1, 0);
            const bytes2 = reconstructedSchema.encode(testData, buffer2, 0);
            
            expect(bytes1).to.equal(bytes2);
            expect(buffer1.slice(0, bytes1).equals(buffer2.slice(0, bytes2))).to.be.true;
            
            // Decode both and verify
            const decoded1 = originalSchema.decode(buffer1, 0);
            const decoded2 = reconstructedSchema.decode(buffer2, 0);
            
            expect(decoded1.value).to.deep.equal(decoded2.value);
            expect(decoded1.value).to.deep.equal(testData);
        });
    });

    describe('Error handling and edge cases', function() {
        it('should handle validation errors gracefully', function() {
            const strictMapType = new types.MapType([
                ['id', new types.UInt8()], // max 255
                ['name', new types.FixedStringType(5)], // max 5 chars
                ['active', new types.BooleanType()]
            ]);
            
            const strictSchema = new Schema(strictMapType);
            
            // Valid data
            const validData = { id: 100, name: 'Alice', active: true };
            expect(() => strictSchema.validate(validData)).to.not.throw();
            
            // Invalid data - id too large
            const invalidData1 = { id: 300, name: 'Alice', active: true };
            expect(() => strictSchema.validate(invalidData1)).to.throw(types.ParserError);
            
            // Invalid data - name too long
            const invalidData2 = { id: 100, name: 'VeryLongName', active: true };
            expect(() => strictSchema.validate(invalidData2)).to.throw(types.ParserError);
        });

        it('should handle buffer size errors', function() {
            const largeMapType = new types.MapType([
                ['data', new types.ArrayType(new types.UInt32(), 10)]
            ]);
            
            const largeSchema = new Schema(largeMapType);
            const testData = { data: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] };
            
            // Buffer too small
            const smallBuffer = Buffer.alloc(10);
            expect(() => largeSchema.encode(testData, smallBuffer)).to.throw('Buffer is too small');
            
            // Correct size
            const correctBuffer = Buffer.alloc(40);
            expect(() => largeSchema.encode(testData, correctBuffer)).to.not.throw();
        });

        it('should handle empty and minimal schemas', function() {
            // Empty MapType
            const emptySchema = new Schema(new types.MapType([]));
            
            expect(emptySchema.byte_length).to.equal(0);
            expect(emptySchema.is_static_length).to.be.true;
            
            const buffer = Buffer.alloc(1);
            const bytesWritten = emptySchema.encode({}, buffer, 0);
            expect(bytesWritten).to.equal(0);
            
            const decoded = emptySchema.decode(buffer, 0);
            expect(decoded.value).to.deep.equal({});
            expect(decoded.bytes_read).to.equal(0);
        });
    });

    describe('Performance and scalability', function() {
        it('should handle large data structures efficiently', function() {
            // Create a schema with many fields
            const fields = [];
            for (let i = 0; i < 50; i++) {
                fields.push([`field_${i}`, new types.UInt8()]);
            }
            
            const largeMapType = new types.MapType(fields);
            const largeSchema = new Schema(largeMapType);
            
            // Create test data
            const testData = {};
            for (let i = 0; i < 50; i++) {
                testData[`field_${i}`] = i % 256;
            }
            
            expect(largeSchema.byte_length).to.equal(50);
            
            const buffer = Buffer.alloc(100);
            const start = process.hrtime();
            
            const bytesWritten = largeSchema.encode(testData, buffer, 0);
            const decoded = largeSchema.decode(buffer, 0);
            
            const [seconds, nanoseconds] = process.hrtime(start);
            const milliseconds = seconds * 1000 + nanoseconds / 1000000;
            
            expect(decoded.value).to.deep.equal(testData);
            expect(bytesWritten).to.equal(50);
            expect(milliseconds).to.be.lessThan(10); // Should be very fast
        });

        it('should handle nested structures with good performance', function() {
            // Deeply nested structure
            const innerType = new types.MapType([
                ['a', new types.UInt8()],
                ['b', new types.UInt16()]
            ]);
            
            const middleType = new types.MapType([
                ['inner1', innerType],
                ['inner2', innerType],
                ['value', new types.UInt32()]
            ]);
            
            const outerType = new types.MapType([
                ['middle1', middleType],
                ['middle2', middleType],
                ['timestamp', new types.UInt32()]
            ]);
            
            const nestedSchema = new Schema(outerType);
            
            const nestedData = {
                middle1: {
                    inner1: { a: 1, b: 100 },
                    inner2: { a: 2, b: 200 },
                    value: 1000
                },
                middle2: {
                    inner1: { a: 3, b: 300 },
                    inner2: { a: 4, b: 400 },
                    value: 2000
                },
                timestamp: 1609459200
            };
            
            const buffer = Buffer.alloc(100);
            const bytesWritten = nestedSchema.encode(nestedData, buffer, 0);
            const decoded = nestedSchema.decode(buffer, 0);
            
            expect(decoded.value).to.deep.equal(nestedData);
            expect(nestedSchema.byte_length).to.equal(24); // All fixed-size: 3+3+4 + 3+3+4 + 4 = 24
        });
    });
});
