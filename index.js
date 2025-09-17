
/**
 * @fileoverview obj2buf - A powerful, type-safe encoder/decoder for structured binary data
 * @version 1.0.0
 */

/**
 * Main module exports for obj2buf
 * @namespace obj2buf
 */
module.exports = {
    /** @type {typeof import("./lib/Schema.js")} Schema class for defining data structures */
    Schema: require("./lib/Schema.js"),
    /** @type {typeof import("./lib/types.js")} Type definitions and utilities */
    types: require("./lib/types.js")
}
