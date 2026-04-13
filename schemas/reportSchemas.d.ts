import { z } from "zod";
export declare const createReportSchema: z.ZodObject<{
    title: z.ZodString;
    description: z.ZodString;
    content: z.ZodDefault<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    status: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        draft: "draft";
        published: "published";
    }>>>;
}, z.core.$strip>;
export declare const updateReportSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    content: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    status: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        draft: "draft";
        published: "published";
    }>>>;
}, z.core.$strip>;
export declare const listReportsSchema: z.ZodObject<{
    status: z.ZodOptional<z.ZodEnum<{
        draft: "draft";
        published: "published";
    }>>;
    search: z.ZodOptional<z.ZodString>;
    author: z.ZodOptional<z.ZodString>;
    createdAfter: z.ZodOptional<z.ZodString>;
    createdBefore: z.ZodOptional<z.ZodString>;
    page: z.ZodDefault<z.ZodOptional<z.ZodCoercedNumber<unknown>>>;
    limit: z.ZodDefault<z.ZodOptional<z.ZodCoercedNumber<unknown>>>;
}, z.core.$strip>;
export type CreateReportInput = z.infer<typeof createReportSchema>;
export type UpdateReportInput = z.infer<typeof updateReportSchema>;
export type ListReportsQuery = z.infer<typeof listReportsSchema>;
//# sourceMappingURL=reportSchemas.d.ts.map