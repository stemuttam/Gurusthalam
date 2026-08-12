import type { LoggerContext } from './logger.types.js';

export function serializeContext(
  context?: LoggerContext,
): Record<string, unknown> {
  if (!context) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(context).filter(
      ([, value]) => value !== undefined,
    ),
  );
}