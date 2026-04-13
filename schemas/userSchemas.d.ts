import { z } from "zod";
export declare const listUsersSchema: z.ZodObject<{
    role: z.ZodOptional<z.ZodEnum<{
        user: "user";
        guest: "guest";
        manager: "manager";
        admin: "admin";
    }>>;
    group: z.ZodOptional<z.ZodString>;
    search: z.ZodOptional<z.ZodString>;
    page: z.ZodDefault<z.ZodOptional<z.ZodCoercedNumber<unknown>>>;
    limit: z.ZodDefault<z.ZodOptional<z.ZodCoercedNumber<unknown>>>;
}, z.core.$strip>;
export declare const updateUserSchema: z.ZodObject<{
    role: z.ZodOptional<z.ZodEnum<{
        user: "user";
        guest: "guest";
        manager: "manager";
        admin: "admin";
    }>>;
    groups: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export type ListUsersQuery = z.infer<typeof listUsersSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
//# sourceMappingURL=userSchemas.d.ts.map