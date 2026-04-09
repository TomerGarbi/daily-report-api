import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

// Refresh and logout no longer carry the token in the body —
// it arrives via the HttpOnly cookie instead.
export const refreshSchema = z.object({});
export const logoutSchema = z.object({});

export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type LogoutInput = z.infer<typeof logoutSchema>;
