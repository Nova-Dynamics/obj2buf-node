# obj2buf

A type-safe encoder/decoder for structured binary data with snake_case API design.

Transform JavaScript objects into compact binary buffers and back with zero data loss. Suitable for network protocols, file formats, and high-performance data exchange.

## Features

- **Simple API**: Clean snake_case interface with MapType for structured data
- **High Performance**: Efficient little-endian encoding with optional unsafe mode (4-5x faster)
- **Type Safety**: Comprehensive type system with strict validation
- **Variable Length Support**: VarStringType and variable-length arrays with automatic header optimization
- **JSON Serialization**: Full schema persistence with consistent naming
- **Well Documented**: Complete JSDoc documentation for IDE support
- **Tested**: 243+ tests covering real-world scenarios
- **Cross-Language**: C++ bindings available for native applications

## Installation

### JavaScript/Node.js
```bash
npm install obj2buf
```

### C++ Bindings
The package includes C++11 header-only bindings for deserializing data in native applications. See [`bindings/cpp/README.md`](bindings/cpp/README.md) for details.

## Quick Start

```javascript
const { Schema, types } = require('obj2buf');

// Define structured data using MapType
const user_type = new types.MapType([
    ['id', new types.UInt32()],
    ['username', new types.FixedStringType(20)],
    ['email', new types.VarStringType(100)],
    ['age', new types.UInt8()],
    ['is_active', new types.BooleanType()],
    ['score', new types.OptionalType(new types.Float32())]
]);

// Create schema with the type
const user_schema = new Schema(user_type);

// Your data
const user_data = {
    id: 12345,
    username: 'john_doe',
    email: 'john@example.com',
    age: 28,
    is_active: true,
    score: 95.5
};

// Serialize to binary
const buffer = user_schema.serialize(user_data);
console.log('Encoded size:', buffer.length, 'bytes');

// Deserialize back to object
const decoded = user_schema.deserialize(buffer);
console.log('Decoded:', decoded);
```

## Type System

### Primitive Types
- **`UInt8`, `UInt16`, `UInt32`** - Unsigned integers (1, 2, 4 bytes)
- **`Int8`, `Int16`, `Int32`** - Signed integers (1, 2, 4 bytes)
- **`Float32`, `Float64`** - IEEE 754 floating point (4, 8 bytes)
- **`BooleanType`** - True/false values (1 byte)
- **`Char`** - Single UTF-8 character (1 byte)

### Unified Types (Alternative Syntax)
- **`UInt(bytes)`, `Int(bytes)`, `Float(bytes)`** - Generic constructors

### String Types
- **`FixedStringType(length)`** - Fixed-length strings with null padding
- **`VarStringType(max_length?)`** - Variable-length strings with automatic header optimization
  - Uses 1-byte header for max_length < 256
  - Uses 2-byte header for max_length ≥ 256
  - Default max_length: 65535

### Container Types
- **`ArrayType(element_type, length?)`** - Arrays (fixed or variable length)
- **`TupleType(...element_types)`** - Fixed-structure tuples
- **`MapType(field_pairs)`** - Structured objects with named fields
- **`EnumType(options)`** - String enumerations with automatic sizing
- **`OptionalType(base_type)`** - Nullable values with presence flag

## Advanced Examples

### Complex Nested Structures

```javascript
const { Schema, types } = require('obj2buf');

// Game state with nested structures
const game_state_type = new types.MapType([
    ['player_id', new types.UInt32()],
    ['position', new types.TupleType(new types.Float32(), new types.Float32())],
    ['health', new types.UInt8()],
    ['inventory', new types.ArrayType(new types.UInt16(), 10)],
    ['weapon', new types.EnumType(['sword', 'bow', 'staff', 'dagger'])],
    ['magic_points', new types.OptionalType(new types.UInt16())],
    ['metadata', new types.MapType([
        ['version', new types.UInt8()],
        ['timestamp', new types.UInt32()],
        ['notes', new types.VarStringType(500)]
    ])]
]);

const game_schema = new Schema(game_state_type);

const game_state = {
    player_id: 1337,
    position: [123.45, 678.90],
    health: 85,
    inventory: [1001, 1002, 1003, 0, 0, 0, 0, 0, 0, 0],
    weapon: 'sword',
    magic_points: 150,
    metadata: {
        version: 2,
        timestamp: 1632847200,
        notes: 'Player reached level 45'
    }
};

const buffer = game_schema.serialize(game_state);
const decoded = game_schema.deserialize(buffer);
```

### Variable-Length Data

```javascript
// Dynamic arrays and strings
const dynamic_type = new types.MapType([
    ['message', new types.VarStringType(1000)],
    ['tags', new types.ArrayType(new types.VarStringType(50))], // Variable-length array
    ['scores', new types.ArrayType(new types.UInt16(), 20)],     // Fixed-length array
    ['metadata', new types.OptionalType(new types.VarStringType(200))]
]);

const dynamic_schema = new Schema(dynamic_type);

const data = {
    message: 'Hello, world!',
    tags: ['important', 'user-generated', 'reviewed'], // Any length array
    scores: [100, 95, 87, 92, 88, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    metadata: 'Created by automated system'
};

// Calculate exact size needed
const needed_bytes = dynamic_schema.calculate_byte_length(data);
console.log('Needs', needed_bytes, 'bytes');

const buffer = dynamic_schema.serialize(data);
```

### Performance Mode

For high-throughput scenarios, skip validation for maximum speed:

```javascript
// Up to 5x faster encoding
const fast_buffer = schema.serialize(data, 0, { unsafe: true });

// ⚠️ WARNING: Only use unsafe mode when you guarantee:
// - No null/undefined values for required fields
// - Correct data types
// - Valid enum values
// - String lengths within bounds
```

## Advanced Usage

### Choosing the Right API

**High-Level Methods (Recommended):**
- `serialize(data)` - Creates and returns a buffer automatically
- `deserialize(buffer)` - Returns the decoded value directly
- Use these for most applications - they're simple and handle memory management

**Low-Level Methods (For Performance/Control):**
- `encode(data, buffer, offset)` - Write to an existing buffer, returns bytes written
- `decode(buffer, offset)` - Returns `{value, bytes_read}` for precise control
- Use these when you need to manage your own buffers or process streams

### Buffer Management Examples

```javascript
const schema = new Schema({ name: 'string', age: 'uint8' });
const data = { name: 'Alice', age: 30 };

// High-level: Simple and clean
const buffer = schema.serialize(data);
const decoded = schema.deserialize(buffer);

// Low-level: Manual buffer control
const my_buffer = Buffer.alloc(100);
const bytes_written = schema.encode(data, my_buffer, 0);
const result = schema.decode(my_buffer, 0);
console.log('Value:', result.value, 'Read:', result.bytes_read, 'bytes');
```

### Streaming Operations

```javascript
// High-level: Each message gets its own buffer
const messages = [
    { type: 'login', user: 'alice' },
    { type: 'message', text: 'Hello!' },
    { type: 'logout', user: 'alice' }
];

const buffers = messages.map(msg => message_schema.serialize(msg));
const decoded = buffers.map(buf => message_schema.deserialize(buf));

// Low-level: Pack multiple messages into one buffer
const stream_buffer = Buffer.alloc(1024);
let offset = 0;

for (const message of messages) {
    offset += message_schema.encode(message, stream_buffer, offset);
}

// Read them back
offset = 0;
const decoded_messages = [];
while (offset < stream_buffer.length) {
    const result = message_schema.decode(stream_buffer, offset);
    if (result.bytes_read === 0) break; // End of data
    decoded_messages.push(result.value);
    offset += result.bytes_read;
}
```

## Schema Properties & Methods

### Properties (snake_case API)
```javascript
// Static analysis
schema.byte_length          // Total bytes (null if variable-length)
schema.is_static_length     // true if all fields are fixed-length

// Dynamic calculation
schema.calculate_byte_length(data)  // Exact bytes needed for specific data
```

### Encoding & Decoding
```javascript
// High-level methods (recommended)
const buffer = schema.serialize(data)                 // Auto-allocate buffer
const buffer = schema.serialize(data, offset)         // With offset padding
const value = schema.deserialize(buffer)              // Direct value
const value = schema.deserialize(buffer, offset)      // With offset

// Low-level methods (for performance/control)
const bytes = schema.encode(data, buffer, offset)     // Requires buffer, returns bytes written
const { value, bytes_read } = schema.decode(buffer, offset)  // Returns wrapped result
```

### JSON Serialization
```javascript
// Export schema
const json = schema.to_json()

// Import schema  
const new_schema = Schema.from_json(json)

// Type consistency: obj.type matches class names
// ArrayType ↔ "ArrayType" (not "Array")
// FixedStringType ↔ "FixedStringType" (not "String")
// etc.
```

## Type Features

### Automatic Header Optimization
```javascript
// VarStringType automatically chooses header size
new types.VarStringType(100)    // 1-byte header (max < 256)
new types.VarStringType(1000)   // 2-byte header (max ≥ 256)
```

### Enum Auto-Sizing
```javascript
// EnumType automatically chooses storage size
new types.EnumType(['a', 'b'])                    // 1 byte (2 options)
new types.EnumType([...Array(300).keys()])        // 2 bytes (300 options)
new types.EnumType([...Array(70000).keys()])      // 4 bytes (70k options)
```

### Empty Type Support
```javascript
// Edge cases handled gracefully
new types.MapType([])           // Empty map
new types.TupleType()           // Empty tuple
new types.ArrayType(type, 0)    // Zero-length array
```

## Error Handling

All validation errors throw `ParserError` with descriptive messages:

```javascript
const { ParserError } = require('obj2buf');

try {
    schema.encode({ username: null }); // Required field is null
} catch (error) {
    console.log(error instanceof ParserError); // true
    console.log(error.message); // "Cannot encode null as FixedStringType"
}
```

## Real-World Example: API Message Format

```javascript
const api_message_type = new types.MapType([
    ['version', new types.UInt8()],
    ['message_type', new types.EnumType(['request', 'response', 'error', 'notification'])],
    ['correlation_id', new types.VarStringType(36)], // UUID length
    ['timestamp', new types.UInt32()],
    ['payload_size', new types.UInt32()],
    ['payload', new types.VarStringType(1048576)], // 1MB max
    ['headers', new types.ArrayType(new types.TupleType(
        new types.VarStringType(100), // key
        new types.VarStringType(500)  // value
    ))],
    ['signature', new types.OptionalType(new types.FixedStringType(64))]
]);

const message_schema = new Schema(api_message_type);

// Usage in API
function serialize_message(msg) {
    return message_schema.encode(msg);
}

function deserialize_message(buffer) {
    return message_schema.decode(buffer).value;
}
```

## Testing

Run the comprehensive test suite:

```bash
npm test
```

**Coverage includes:**
- 243+ tests with complete coverage
- All primitive and complex types
- Edge cases and error conditions  
- Real-world usage scenarios
- JSON serialization round-trips
- Performance benchmarks
- Memory efficiency tests

## License

ISC
