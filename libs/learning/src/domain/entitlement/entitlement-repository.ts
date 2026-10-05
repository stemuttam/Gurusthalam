import type { Entitlement } from './entitlement.js';

export interface EntitlementRepository {
  findById(id: string): Promise<Entitlement | null>;

  findActiveByEnrollmentId(enrollmentId: string): Promise<Entitlement | null>;

  save(entitlement: Entitlement): Promise<void>;
}
