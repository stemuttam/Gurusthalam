/**
 * Strongly typed reference to a taxonomy Skill.
 *
 * A Skill is deliberately represented as its own value-object type
 * because a skill is a learner capability rather than a content topic.
 */
export class SkillReference {
  readonly value: string;

  private constructor(value: string) {
    this.value = value;

    Object.freeze(this);
  }

  /**
   * Creates a SkillReference from a canonical identifier.
   */
  static from(value: string): SkillReference {
    if (!SkillReference.isValid(value)) {
      throw new TypeError(
        'SkillReference must be a non-empty string without leading or trailing whitespace.',
      );
    }

    return new SkillReference(value);
  }

  /**
   * Determines whether a primitive value can represent a valid
   * SkillReference.
   */
  static isValid(value: unknown): value is string {
    return (
      typeof value === 'string' &&
      value.length > 0 &&
      value.trim().length > 0 &&
      value.trim() === value
    );
  }

  /**
   * Returns the primitive taxonomy identifier.
   */
  toString(): string {
    return this.value;
  }

  /**
   * Compares SkillReference instances by their primitive value.
   */
  equals(other: SkillReference): boolean {
    return other instanceof SkillReference && this.value === other.value;
  }
}
