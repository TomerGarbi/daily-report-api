"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeRequest = exports.blockSsti = exports.blockXxe = exports.blockNullByte = exports.blockCrlfInjection = exports.blockCommandInjection = exports.blockPathTraversal = exports.blockPrototypePollution = exports.blockLdapInjection = exports.sanitizeXss = exports.blockJsFuck = exports.blockNoSqlInjection = exports.blockSqlInjection = void 0;
const xss_1 = __importDefault(require("xss"));
const mongo_sanitize_1 = __importDefault(require("mongo-sanitize"));
// ─── Patterns ────────────────────────────────────────────────────────────────
/**
 * SQL injection: common keywords, comment sequences, and operator abuse.
 */
const SQL_INJECTION_PATTERN = /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|EXEC|EXECUTE|UNION|CAST|CONVERT|DECLARE|FETCH|CURSOR|KILL|SHUTDOWN)\b)|(-{2}|\/\*|\*\/|;|\bOR\b\s+['"\d]|'\s*(OR|AND)\s*')/gi;
/**
 * NoSQL injection: MongoDB operator keys such as $where, $gt, $ne, etc.
 */
const NOSQL_INJECTION_PATTERN = /(\$where|\$gt|\$lt|\$gte|\$lte|\$ne|\$in|\$nin|\$exists|\$regex|\$expr|\$jsonSchema)/gi;
/**
 * JSFuck: code using only the six characters []()!+
 * A run of 8+ such characters is a strong signal.
 */
const JSFUCK_PATTERN = /^[\[\]\(\)!+]{8,}$/;
/**
 * Harmful content: script tags, event handlers, javascript: URIs,
 * data URIs with scripting, and iframe/object embeds.
 */
const HARMFUL_CONTENT_PATTERN = /<\s*script[\s\S]*?>[\s\S]*?<\s*\/\s*script\s*>|<\s*script[^>]*>|on\w+\s*=\s*["'][^"']*["']|javascript\s*:|data\s*:\s*[^,]*script|<\s*(iframe|object|embed|applet)[^>]*>/gi;
/**
 * LDAP injection: common LDAP special characters and filter manipulation sequences.
 * Targets attacks like *)(|(cn=*) or )(uid=*) used to manipulate AD/LDAP queries. *
 * Note: `&` and `|` are only matched when followed by `(`, so everyday values
 * like "R&D" or "A|B" do NOT trigger a false positive. */
const LDAP_INJECTION_PATTERN = /([*()\\\x00]|\)\s*\(|\|\s*\(|&\s*\(|!\s*\(|\)\s*\||\)\s*&)/g;
/**
 * Prototype pollution: key names that target JavaScript object prototype chain.
 */
const PROTOTYPE_POLLUTION_PATTERN = /(__proto__|constructor|prototype)\s*[:[{]/gi;
/**
 * Path traversal: sequences that walk up the directory tree.
 * Covers both Unix (../) and Windows (..\) variants, URL-encoded forms,
 * and double-encoded variants (%2e%2e).
 */
const PATH_TRAVERSAL_PATTERN = /(\.\.[/\\]|\.\.%2f|\.\.%5c|%2e%2e[/\\%]|%252e%252e)/gi;
/**
 * Command injection: shell metacharacters used to chain or inject OS commands.
 */
const COMMAND_INJECTION_PATTERN = /([;&|`]|\$\(|\${|>\s*\/|\|\s*\w)/g;
/**
 * CRLF injection: carriage-return / line-feed sequences that can split HTTP responses.
 * NOTE: only applied to query-string parameters and route params, NOT the body.
 * JSON body fields can legitimately contain newlines (e.g. multi-line report text);
 * CRLF injection is only dangerous in URL-derived values and headers.
 */
const CRLF_INJECTION_PATTERN = /(%0d%0a|%0d|%0a|\r\n|\r|\n)/gi;
/**
 * Null byte injection: null characters that truncate strings in C-backed libraries.
 */
const NULL_BYTE_PATTERN = /\x00|%00/g;
/**
 * XXE (XML External Entity): DOCTYPE and ENTITY declarations used in XML attacks.
 */
const XXE_PATTERN = /<!(\s*)(DOCTYPE|ENTITY)[^>]*>/gi;
/**
 * SSTI (Server-Side Template Injection): common template expression delimiters.
 * Covers Handlebars/Jinja {{ }}, EJS/ERB <%= %>, and Twig/Pebble {% %}.
 */
const SSTI_PATTERN = /(\{\{[\s\S]*?\}\}|\{%[\s\S]*?%\}|<%[\s\S]*?%>)/g;
// ─── Helpers ──────────────────────────────────────────────────────────────────
/**
 * Recursively walk any value (object, array, string) and run a checker on
 * every string leaf. Returns true as soon as a violation is found.
 */
function deepCheck(value, checker) {
    if (typeof value === "string")
        return checker(value);
    if (Array.isArray(value))
        return value.some((item) => deepCheck(item, checker));
    if (value !== null && typeof value === "object") {
        return Object.values(value).some((v) => deepCheck(v, checker));
    }
    return false;
}
/**
 * Recursively check both keys and values of an object for a pattern match.
 * Used specifically for prototype pollution where the danger is in the key name.
 */
function deepCheckKeys(value, checker) {
    if (value !== null && typeof value === "object") {
        for (const [k, v] of Object.entries(value)) {
            if (checker(k))
                return true;
            if (deepCheckKeys(v, checker))
                return true;
        }
    }
    if (Array.isArray(value)) {
        return value.some((item) => deepCheckKeys(item, checker));
    }
    return false;
}
/**
 * Recursively walk any value and sanitize every string leaf with the given
 * sanitizer, returning the sanitized clone.
 */
function deepSanitize(value, sanitizer) {
    if (typeof value === "string")
        return sanitizer(value);
    if (Array.isArray(value))
        return value.map((item) => deepSanitize(item, sanitizer));
    if (value !== null && typeof value === "object") {
        const cleaned = {};
        for (const [k, v] of Object.entries(value)) {
            cleaned[k] = deepSanitize(v, sanitizer);
        }
        return cleaned;
    }
    return value;
}
/**
 * Mutate an existing plain object in-place with sanitized values.
 * Used instead of reassignment for Express 5 read-only properties like req.query.
 */
function mutateSanitize(target, sanitizer) {
    for (const key of Object.keys(target)) {
        target[key] = deepSanitize(target[key], sanitizer);
    }
}
/** Reset lastIndex and test — safe for global regexes. */
function testPattern(pattern, s) {
    pattern.lastIndex = 0;
    return pattern.test(s);
}
// ─── Individual guard checks ──────────────────────────────────────────────────
function hasSqlInjection(value) {
    return deepCheck(value, (s) => testPattern(SQL_INJECTION_PATTERN, s));
}
function hasNoSqlInjection(value) {
    return deepCheck(value, (s) => testPattern(NOSQL_INJECTION_PATTERN, s));
}
function hasJsFuck(value) {
    return deepCheck(value, (s) => JSFUCK_PATTERN.test(s.trim()));
}
function hasHarmfulContent(value) {
    return deepCheck(value, (s) => testPattern(HARMFUL_CONTENT_PATTERN, s));
}
function hasLdapInjection(value) {
    return deepCheck(value, (s) => testPattern(LDAP_INJECTION_PATTERN, s));
}
function hasPrototypePollution(value) {
    // Check both key names and string values
    return (deepCheckKeys(value, (k) => /^(__proto__|constructor|prototype)$/.test(k)) ||
        deepCheck(value, (s) => testPattern(PROTOTYPE_POLLUTION_PATTERN, s)));
}
function hasPathTraversal(value) {
    return deepCheck(value, (s) => testPattern(PATH_TRAVERSAL_PATTERN, s));
}
function hasCommandInjection(value) {
    return deepCheck(value, (s) => testPattern(COMMAND_INJECTION_PATTERN, s));
}
function hasCrlfInjection(value) {
    return deepCheck(value, (s) => testPattern(CRLF_INJECTION_PATTERN, s));
}
function hasNullByte(value) {
    return deepCheck(value, (s) => testPattern(NULL_BYTE_PATTERN, s));
}
function hasXxe(value) {
    return deepCheck(value, (s) => testPattern(XXE_PATTERN, s));
}
function hasSsti(value) {
    return deepCheck(value, (s) => testPattern(SSTI_PATTERN, s));
}
// ─── Middleware ───────────────────────────────────────────────────────────────
/**
 * Blocks requests that contain SQL injection patterns in body, query, or params.
 */
const blockSqlInjection = (req, res, next) => {
    const sources = [req.body, req.query, req.params];
    if (sources.some(hasSqlInjection)) {
        res.status(400).json({ status: 400, message: "Potential SQL injection detected." });
        return;
    }
    next();
};
exports.blockSqlInjection = blockSqlInjection;
/**
 * Sanitizes MongoDB operator keys from body, query, and params using
 * mongo-sanitize, and blocks requests that still contain NoSQL operator patterns
 * embedded inside string values.
 */
const blockNoSqlInjection = (req, res, next) => {
    if (req.body)
        req.body = (0, mongo_sanitize_1.default)(req.body);
    // Express 5: req.query is a read-only getter — mutate in-place
    if (req.query) {
        const sanitized = (0, mongo_sanitize_1.default)({ ...req.query });
        for (const key of Object.keys(req.query))
            delete req.query[key];
        Object.assign(req.query, sanitized);
    }
    if (req.params)
        req.params = (0, mongo_sanitize_1.default)(req.params);
    const sources = [req.body, req.query, req.params];
    if (sources.some(hasNoSqlInjection)) {
        res.status(400).json({ status: 400, message: "Potential NoSQL injection detected." });
        return;
    }
    next();
};
exports.blockNoSqlInjection = blockNoSqlInjection;
/**
 * Blocks requests that contain JSFuck-encoded payloads.
 */
const blockJsFuck = (req, res, next) => {
    const sources = [req.body, req.query, req.params];
    if (sources.some(hasJsFuck)) {
        res.status(400).json({ status: 400, message: "Obfuscated / JSFuck payload detected." });
        return;
    }
    next();
};
exports.blockJsFuck = blockJsFuck;
/**
 * Blocks requests that contain harmful HTML/script content, then sanitizes
 * any remaining XSS vectors from all string values using the `xss` library.
 */
const sanitizeXss = (req, res, next) => {
    const sources = [req.body, req.query, req.params];
    if (sources.some(hasHarmfulContent)) {
        res.status(400).json({ status: 400, message: "Harmful content detected." });
        return;
    }
    if (req.body)
        req.body = deepSanitize(req.body, (s) => (0, xss_1.default)(s));
    // Express 5: req.query is a read-only getter — mutate in-place
    if (req.query)
        mutateSanitize(req.query, (s) => (0, xss_1.default)(s));
    if (req.params)
        req.params = deepSanitize(req.params, (s) => (0, xss_1.default)(s));
    next();
};
exports.sanitizeXss = sanitizeXss;
/**
 * Blocks requests that contain LDAP injection patterns.
 * Critical for Active Directory / LDAP query integrity.
 */
const blockLdapInjection = (req, res, next) => {
    const sources = [req.body, req.query, req.params];
    if (sources.some(hasLdapInjection)) {
        res.status(400).json({ status: 400, message: "Potential LDAP injection detected." });
        return;
    }
    next();
};
exports.blockLdapInjection = blockLdapInjection;
/**
 * Blocks requests that attempt prototype pollution via dangerous key names
 * (__proto__, constructor, prototype) or embedded patterns in string values.
 */
const blockPrototypePollution = (req, res, next) => {
    const sources = [req.body, req.query, req.params];
    if (sources.some(hasPrototypePollution)) {
        res.status(400).json({ status: 400, message: "Potential prototype pollution detected." });
        return;
    }
    next();
};
exports.blockPrototypePollution = blockPrototypePollution;
/**
 * Blocks requests that contain path traversal sequences (../, ..\, URL-encoded forms).
 */
const blockPathTraversal = (req, res, next) => {
    const sources = [req.body, req.query, req.params];
    if (sources.some(hasPathTraversal)) {
        res.status(400).json({ status: 400, message: "Potential path traversal detected." });
        return;
    }
    next();
};
exports.blockPathTraversal = blockPathTraversal;
/**
 * Blocks requests that contain shell metacharacters used for command injection.
 */
const blockCommandInjection = (req, res, next) => {
    const sources = [req.body, req.query, req.params];
    if (sources.some(hasCommandInjection)) {
        res.status(400).json({ status: 400, message: "Potential command injection detected." });
        return;
    }
    next();
};
exports.blockCommandInjection = blockCommandInjection;
/**
 * Blocks requests that contain CRLF sequences that could split HTTP responses.
 */
const blockCrlfInjection = (req, res, next) => {
    // Intentionally excludes req.body — JSON body fields can legitimately contain
    // newline characters (e.g. multi-line text). CRLF injection is only dangerous
    // in URL-derived values, not inside an already-parsed JSON payload.
    const sources = [req.query, req.params];
    if (sources.some(hasCrlfInjection)) {
        res.status(400).json({ status: 400, message: "Potential CRLF injection detected." });
        return;
    }
    next();
};
exports.blockCrlfInjection = blockCrlfInjection;
/**
 * Blocks requests that contain null bytes, which can truncate strings
 * in C-backed native libraries or file path operations.
 */
const blockNullByte = (req, res, next) => {
    const sources = [req.body, req.query, req.params];
    if (sources.some(hasNullByte)) {
        res.status(400).json({ status: 400, message: "Null byte injection detected." });
        return;
    }
    next();
};
exports.blockNullByte = blockNullByte;
/**
 * Blocks requests that contain XXE (XML External Entity) declarations.
 */
const blockXxe = (req, res, next) => {
    const sources = [req.body, req.query, req.params];
    if (sources.some(hasXxe)) {
        res.status(400).json({ status: 400, message: "Potential XXE payload detected." });
        return;
    }
    next();
};
exports.blockXxe = blockXxe;
/**
 * Blocks requests that contain Server-Side Template Injection expressions
 * ({{ }}, {% %}, <%= %>).
 */
const blockSsti = (req, res, next) => {
    const sources = [req.body, req.query, req.params];
    if (sources.some(hasSsti)) {
        res.status(400).json({ status: 400, message: "Potential template injection detected." });
        return;
    }
    next();
};
exports.blockSsti = blockSsti;
/**
 * Composite middleware that applies ALL security checks in one call.
 *
 * Execution order (cheapest / most critical first):
 *   1. Null byte & CRLF           — cheap string scans, stop garbage early
 *   2. Prototype pollution         — key-level check before any object traversal
 *   3. NoSQL sanitize + block      — strips $-keys before other checks see them
 *   4. SQL injection block
 *   5. LDAP injection block        — important for AD integration
 *   6. Path traversal block
 *   7. Command injection block
 *   8. XXE block
 *   9. SSTI block
 *  10. JSFuck block
 *  11. XSS sanitize + harmful block
 *
 * Usage in app.ts:
 *   import { sanitizeRequest } from "./middleware/sanitize";
 *   app.use(sanitizeRequest);
 */
exports.sanitizeRequest = [
    exports.blockNullByte,
    exports.blockCrlfInjection,
    exports.blockPrototypePollution,
    exports.blockNoSqlInjection,
    exports.blockSqlInjection,
    exports.blockLdapInjection,
    exports.blockPathTraversal,
    exports.blockCommandInjection,
    exports.blockXxe,
    exports.blockSsti,
    exports.blockJsFuck,
    exports.sanitizeXss,
];
//# sourceMappingURL=sanitize.js.map