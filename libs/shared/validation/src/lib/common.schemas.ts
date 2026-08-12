import { z } from 'zod';

export const emailSchema = z
  .string()
  .trim()
  .email();

export const uuidSchema = z
  .string()
  .uuid();

export const urlSchema = z
  .string()
  .trim()
  .url();

export const nonEmptyStringSchema = z
  .string()
  .trim()
  .min(1);

export const positiveIntegerSchema = z
  .number()
  .int()
  .positive();