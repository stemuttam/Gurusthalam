import { z } from 'zod';

export const grantEntitlementInputSchema = z.object({
  enrollmentId: z.string().trim().min(1),
  source: z.enum(['DIRECT', 'COHORT', 'ORGANIZATION', 'SUBSCRIPTION']),
  startsAt: z.iso.datetime().optional(),
  expiresAt: z.iso.datetime().nullable().optional(),
});

export const getEntitlementInputSchema = z.object({
  entitlementId: z.string().trim().min(1),
});

export const suspendEntitlementInputSchema = z.object({
  entitlementId: z.string().trim().min(1),
});

export const restoreEntitlementInputSchema = z.object({
  entitlementId: z.string().trim().min(1),
});

export const revokeEntitlementInputSchema = z.object({
  entitlementId: z.string().trim().min(1),
});

export const expireEntitlementInputSchema = z.object({
  entitlementId: z.string().trim().min(1),
});

export const checkEntitlementAccessInputSchema = z.object({
  enrollmentId: z.string().trim().min(1),
  now: z.iso.datetime().optional(),
});
