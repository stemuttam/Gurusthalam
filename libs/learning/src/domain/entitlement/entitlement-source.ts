export const EntitlementSource = {
  DIRECT: 'DIRECT',
  COHORT: 'COHORT',
  ORGANIZATION: 'ORGANIZATION',
  SUBSCRIPTION: 'SUBSCRIPTION',
} as const;

export type EntitlementSource =
  (typeof EntitlementSource)[keyof typeof EntitlementSource];

export const ENTITLEMENT_SOURCES = Object.freeze([
  EntitlementSource.DIRECT,
  EntitlementSource.COHORT,
  EntitlementSource.ORGANIZATION,
  EntitlementSource.SUBSCRIPTION,
] as const);

export function isEntitlementSource(
  value: unknown,
): value is EntitlementSource {
  return (
    typeof value === 'string' &&
    ENTITLEMENT_SOURCES.includes(value as EntitlementSource)
  );
}
