export interface LoggerContext {
  readonly requestId?: string;
  readonly userId?: string;
  readonly organizationId?: string;
  readonly tenantId?: string;
  readonly service?: string;
  readonly operation?: string;
}

export interface LoggerOptions {
  readonly service: string;
  readonly environment: string;
}