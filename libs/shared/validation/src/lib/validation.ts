import { z } from 'zod';

export function validate<T>(
  schema: z.ZodType<T>,
  value: unknown,
): T {
  return schema.parse(value);
}

export function safeValidate<T>(
  schema: z.ZodType<T>,
  value: unknown,
): ReturnType<typeof schema.safeParse> {
  return schema.safeParse(value);
}