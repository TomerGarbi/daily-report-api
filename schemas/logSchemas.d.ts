import { z } from "zod";
export declare const listLogsSchema: z.ZodObject<{
    level: z.ZodOptional<z.ZodEnum<{
        info: "info";
        warn: "warn";
        error: "error";
        debug: "debug";
    }>>;
    user: z.ZodOptional<z.ZodString>;
    context: z.ZodOptional<z.ZodString>;
    search: z.ZodOptional<z.ZodString>;
    from: z.ZodOptional<z.ZodString>;
    to: z.ZodOptional<z.ZodString>;
    page: z.ZodDefault<z.ZodOptional<z.ZodCoercedNumber<unknown>>>;
    limit: z.ZodDefault<z.ZodOptional<z.ZodCoercedNumber<unknown>>>;
}, z.core.$strip>;
export type ListLogsQuery = z.infer<typeof listLogsSchema>;
//# sourceMappingURL=logSchemas.d.ts.map