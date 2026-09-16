/**
 * Canonical content modalities supported by the Course content abstraction.
 *
 * These values describe the content category only. Storage providers,
 * processing pipelines, AI metadata and delivery mechanics remain outside
 * this domain contract.
 */
export const ContentType = Object.freeze({
  VIDEO: 'VIDEO',
  AUDIO: 'AUDIO',
  DOCUMENT: 'DOCUMENT',
  PDF: 'PDF',
  NOTE: 'NOTE',
  PRESENTATION: 'PRESENTATION',
  INTERACTIVE: 'INTERACTIVE',
  CODE_EXERCISE: 'CODE_EXERCISE',
  SIMULATION: 'SIMULATION',
  EXTERNAL_RESOURCE: 'EXTERNAL_RESOURCE',
  AI_GENERATED_CONTENT: 'AI_GENERATED_CONTENT',
} as const);

export type ContentType = (typeof ContentType)[keyof typeof ContentType];

export const CONTENT_TYPES: readonly ContentType[] = Object.freeze(
  Object.values(ContentType),
);

const CONTENT_TYPE_SET: ReadonlySet<string> = new Set(CONTENT_TYPES);

export function isContentType(value: unknown): value is ContentType {
  return typeof value === 'string' && CONTENT_TYPE_SET.has(value);
}
