export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'restore'
  | 'login'
  | 'logout'
  | 'export'
  | 'import'
  | 'approve'
  | 'reject';

export interface AuditEvent {
  readonly action: AuditAction;
  readonly actorId?: string;
  readonly organizationId?: string;
  readonly tenantId?: string;
  readonly resourceType: string;
  readonly resourceId?: string;
  readonly requestId?: string;
  readonly timestamp: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}