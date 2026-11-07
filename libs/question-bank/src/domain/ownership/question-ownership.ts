
/**
 * Immutable tenant ownership for a Question.
 *
 * Both identifiers must originate from the authenticated application
 * context. This value object validates their representation only;
 * active membership and authorization are application concerns.
 *
 * Legacy Questions without verified ownership are deliberately not
 * represented by this type.
 */
export class QuestionOwnership {
  readonly tenantId: string;
  readonly createdByPrincipalId: string;

  private constructor(tenantId: string, createdByPrincipalId: string) {
    this.tenantId = tenantId;
    this.createdByPrincipalId = createdByPrincipalId;

    Object.freeze(this);
  }

  static create(
    tenantId: string,
    createdByPrincipalId: string,
  ): QuestionOwnership {
    QuestionOwnership.assertIdentifier(tenantId, 'tenantId');
    QuestionOwnership.assertIdentifier(
      createdByPrincipalId,
      'createdByPrincipalId',
    );

    return new QuestionOwnership(tenantId, createdByPrincipalId);
  }

  equals(other: QuestionOwnership): boolean {
    return (
      other instanceof QuestionOwnership &&
      this.tenantId === other.tenantId &&
      this.createdByPrincipalId === other.createdByPrincipalId
    );
  }

  private static assertIdentifier(
    value: unknown,
    field: string,
  ): asserts value is string {
    if (
      typeof value !== 'string' ||
      value.length === 0 ||
      value.trim().length === 0 ||
      value.trim() !== value
    ) {
      throw new TypeError(
        `QuestionOwnership.${field} must be a non-empty canonical identifier.`,
      );
    }
  }
}
