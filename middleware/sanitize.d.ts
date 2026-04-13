import { Request, Response, NextFunction } from "express";
/**
 * Blocks requests that contain SQL injection patterns in body, query, or params.
 */
export declare const blockSqlInjection: (req: Request, res: Response, next: NextFunction) => void;
/**
 * Sanitizes MongoDB operator keys from body, query, and params using
 * mongo-sanitize, and blocks requests that still contain NoSQL operator patterns
 * embedded inside string values.
 */
export declare const blockNoSqlInjection: (req: Request, res: Response, next: NextFunction) => void;
/**
 * Blocks requests that contain JSFuck-encoded payloads.
 */
export declare const blockJsFuck: (req: Request, res: Response, next: NextFunction) => void;
/**
 * Blocks requests that contain harmful HTML/script content, then sanitizes
 * any remaining XSS vectors from all string values using the `xss` library.
 */
export declare const sanitizeXss: (req: Request, res: Response, next: NextFunction) => void;
/**
 * Blocks requests that contain LDAP injection patterns.
 * Critical for Active Directory / LDAP query integrity.
 */
export declare const blockLdapInjection: (req: Request, res: Response, next: NextFunction) => void;
/**
 * Blocks requests that attempt prototype pollution via dangerous key names
 * (__proto__, constructor, prototype) or embedded patterns in string values.
 */
export declare const blockPrototypePollution: (req: Request, res: Response, next: NextFunction) => void;
/**
 * Blocks requests that contain path traversal sequences (../, ..\, URL-encoded forms).
 */
export declare const blockPathTraversal: (req: Request, res: Response, next: NextFunction) => void;
/**
 * Blocks requests that contain shell metacharacters used for command injection.
 */
export declare const blockCommandInjection: (req: Request, res: Response, next: NextFunction) => void;
/**
 * Blocks requests that contain CRLF sequences that could split HTTP responses.
 */
export declare const blockCrlfInjection: (req: Request, res: Response, next: NextFunction) => void;
/**
 * Blocks requests that contain null bytes, which can truncate strings
 * in C-backed native libraries or file path operations.
 */
export declare const blockNullByte: (req: Request, res: Response, next: NextFunction) => void;
/**
 * Blocks requests that contain XXE (XML External Entity) declarations.
 */
export declare const blockXxe: (req: Request, res: Response, next: NextFunction) => void;
/**
 * Blocks requests that contain Server-Side Template Injection expressions
 * ({{ }}, {% %}, <%= %>).
 */
export declare const blockSsti: (req: Request, res: Response, next: NextFunction) => void;
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
export declare const sanitizeRequest: ((req: Request, res: Response, next: NextFunction) => void)[];
//# sourceMappingURL=sanitize.d.ts.map