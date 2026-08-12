import { GurusthalamLogger } from './logger.js';
import type { LoggerContext } from './logger.types.js';

describe('GurusthalamLogger', () => {
  const logger = new GurusthalamLogger({
    service: 'gurusthalam-test',
    environment: 'test',
  });

  it('creates a logger with valid options', () => {
    expect(logger).toBeInstanceOf(GurusthalamLogger);
  });

  it('supports log methods', () => {
    const testLogger = new GurusthalamLogger({
      service: 'gurusthalam-test',
      environment: 'test',
    });

    expect(() =>
      testLogger.debug('Debug message'),
    ).not.toThrow();

    expect(() =>
      testLogger.info('Info message'),
    ).not.toThrow();

    expect(() =>
      testLogger.warn('Warning message'),
    ).not.toThrow();

    expect(() =>
      testLogger.error(
        'Error message',
        new Error('Test error'),
      ),
    ).not.toThrow();
  });

  it('supports logger context without undefined optional properties', () => {
    const context: LoggerContext = {
      requestId: 'request-123',
      userId: 'user-123',
      organizationId: 'organization-123',
      tenantId: 'tenant-123',
      service: 'gurusthalam-test',
      operation: 'test-operation',
    };

    expect(context.requestId).toBe('request-123');
    expect(context.userId).toBe('user-123');
    expect(context.organizationId).toBe('organization-123');
    expect(context.tenantId).toBe('tenant-123');
    expect(context.service).toBe('gurusthalam-test');
    expect(context.operation).toBe('test-operation');
  });

  it('supports a partial logger context', () => {
    const context: LoggerContext = {
      requestId: 'request-123',
      userId: 'user-123',
    };

    expect(context.requestId).toBe('request-123');
    expect(context.userId).toBe('user-123');
    expect(context.operation).toBeUndefined();
  });

  it('allows an empty logger context', () => {
    const context: LoggerContext = {};

    expect(context).toEqual({});
  });

  it('does not explicitly assign undefined to optional context properties', () => {
    const context: LoggerContext = {
      requestId: 'request-123',
      userId: 'user-123',
    };

    expect('operation' in context).toBe(false);
    expect('organizationId' in context).toBe(false);
    expect('tenantId' in context).toBe(false);
    expect('service' in context).toBe(false);
  });
});