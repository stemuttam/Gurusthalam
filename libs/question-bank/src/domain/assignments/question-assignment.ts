
export const QuestionAssignmentRole = Object.freeze({
  OWNER: 'OWNER',
  AUTHOR: 'AUTHOR',
  CO_AUTHOR: 'CO_AUTHOR',
  EDITOR: 'EDITOR',
} as const);

export type QuestionAssignmentRole =
  (typeof QuestionAssignmentRole)[keyof typeof QuestionAssignmentRole];

const VALID_ROLES = new Set<string>(
  Object.values(QuestionAssignmentRole),
);

function assertIdentifier(value: unknown, field: string): asserts value is string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.trim() !== value
  ) {
    throw new TypeError(`${field} must be a non-empty canonical identifier.`);
  }
}

export interface QuestionAssignmentInput {
  readonly questionId: string;
  readonly tenantId: string;
  readonly principalId: string;
  readonly role: QuestionAssignmentRole;
  readonly assignedByPrincipalId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * Immutable domain representation of a Question collaboration assignment.
 * Active membership and authorization are revalidated by persistence.
 */
export class QuestionAssignment {
  readonly questionId: string;
  readonly tenantId: string;
  readonly principalId: string;
  readonly role: QuestionAssignmentRole;
  readonly assignedByPrincipalId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(input: QuestionAssignmentInput) {
    this.questionId = input.questionId;
    this.tenantId = input.tenantId;
    this.principalId = input.principalId;
    this.role = input.role;
    this.assignedByPrincipalId = input.assignedByPrincipalId;
    this.createdAt = new Date(input.createdAt.getTime());
    this.updatedAt = new Date(input.updatedAt.getTime());

    Object.freeze(this);
  }

  static create(input: QuestionAssignmentInput): QuestionAssignment {
    assertIdentifier(input.questionId, 'questionId');
    assertIdentifier(input.tenantId, 'tenantId');
    assertIdentifier(input.principalId, 'principalId');
    assertIdentifier(input.assignedByPrincipalId, 'assignedByPrincipalId');

    if (!VALID_ROLES.has(input.role)) {
      throw new TypeError('Unsupported Question assignment role.');
    }

    if (
      !(input.createdAt instanceof Date) ||
      !Number.isFinite(input.createdAt.getTime()) ||
      !(input.updatedAt instanceof Date) ||
      !Number.isFinite(input.updatedAt.getTime())
    ) {
      throw new TypeError('Question assignment timestamps must be valid Dates.');
    }

    if (input.updatedAt.getTime() < input.createdAt.getTime()) {
      throw new TypeError('Question assignment updatedAt cannot precede createdAt.');
    }

    return new QuestionAssignment(input);
  }
}
