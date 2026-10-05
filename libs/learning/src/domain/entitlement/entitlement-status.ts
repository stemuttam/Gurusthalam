export const EntitlementStatus = {
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  REVOKED: 'REVOKED',
  EXPIRED: 'EXPIRED',
} as const;

export type EntitlementStatus =
  (typeof EntitlementStatus)[keyof typeof EntitlementStatus];

export const ENTITLEMENT_STATUSES = Object.freeze([
  EntitlementStatus.ACTIVE,
  EntitlementStatus.SUSPENDED,
  EntitlementStatus.REVOKED,
  EntitlementStatus.EXPIRED,
] as const);

export function isEntitlementStatus(
  value: unknown,
): value is EntitlementStatus {
  return (
    typeof value === 'string' &&
    ENTITLEMENT_STATUSES.includes(value as EntitlementStatus)
  );
}
