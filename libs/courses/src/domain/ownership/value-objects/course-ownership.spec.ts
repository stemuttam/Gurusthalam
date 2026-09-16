import { describe, expect, it } from 'vitest';

import { CourseOwnershipRole } from '../enums/course-ownership-role.js';
import { CourseActorId } from '../identifiers/course-actor-id.js';
import { createCourseOwnershipAssignment } from './course-ownership-assignment.js';
import { CourseOwnership } from './course-ownership.js';

describe('CourseOwnership', () => {
  const owner = CourseActorId.from('user-owner');
  const author = CourseActorId.from('user-author');
  const editor = CourseActorId.from('user-editor');

  const ownerAssignment = createCourseOwnershipAssignment({
    principalId: owner,
    role: CourseOwnershipRole.OWNER,
  });

  const authorAssignment = createCourseOwnershipAssignment({
    principalId: author,
    role: CourseOwnershipRole.AUTHOR,
  });

  const editorAssignment = createCourseOwnershipAssignment({
    principalId: editor,
    role: CourseOwnershipRole.EDITOR,
  });

  it('creates an empty ownership collection', () => {
    const ownership = CourseOwnership.create();

    expect(ownership.size).toBe(0);
    expect(ownership.getAssignments()).toEqual([]);
    expect(ownership.hasOwner()).toBe(false);
    expect(ownership.getOwner()).toBeNull();
    expect(Object.isFrozen(ownership)).toBe(true);
  });

  it('creates and preserves ownership assignments', () => {
    const ownership = CourseOwnership.create([
      ownerAssignment,
      authorAssignment,
      editorAssignment,
    ]);

    expect(ownership.size).toBe(3);
    expect(ownership.getAssignments()).toEqual([
      ownerAssignment,
      authorAssignment,
      editorAssignment,
    ]);
  });

  it('allows one OWNER assignment', () => {
    const ownership = CourseOwnership.create([ownerAssignment]);

    expect(ownership.hasOwner()).toBe(true);
    expect(ownership.getOwner()).toEqual(ownerAssignment);
  });

  it('rejects multiple OWNER assignments', () => {
    const anotherOwner = CourseActorId.from('user-owner-2');

    const anotherOwnerAssignment = createCourseOwnershipAssignment({
      principalId: anotherOwner,
      role: CourseOwnershipRole.OWNER,
    });

    expect(() =>
      CourseOwnership.create([ownerAssignment, anotherOwnerAssignment]),
    ).toThrow('Course ownership contains multiple Owners.');
  });

  it('rejects duplicate principal-role assignments', () => {
    expect(() =>
      CourseOwnership.create([
        authorAssignment,
        createCourseOwnershipAssignment({
          principalId: author,
          role: CourseOwnershipRole.AUTHOR,
        }),
      ]),
    ).toThrow('Course ownership contains duplicate assignments.');
  });

  it('allows one principal to hold different roles', () => {
    const ownership = CourseOwnership.create([
      createCourseOwnershipAssignment({
        principalId: author,
        role: CourseOwnershipRole.AUTHOR,
      }),
      createCourseOwnershipAssignment({
        principalId: author,
        role: CourseOwnershipRole.EDITOR,
      }),
    ]);

    expect(ownership.size).toBe(2);
    expect(ownership.getForPrincipal(author)).toHaveLength(2);
  });

  it('checks an assignment by principal and role', () => {
    const ownership = CourseOwnership.create([
      ownerAssignment,
      authorAssignment,
    ]);

    expect(ownership.has(owner, CourseOwnershipRole.OWNER)).toBe(true);

    expect(ownership.has(owner, CourseOwnershipRole.AUTHOR)).toBe(false);
  });

  it('returns assignments for a principal', () => {
    const ownership = CourseOwnership.create([
      createCourseOwnershipAssignment({
        principalId: author,
        role: CourseOwnershipRole.AUTHOR,
      }),
      createCourseOwnershipAssignment({
        principalId: author,
        role: CourseOwnershipRole.CO_AUTHOR,
      }),
      editorAssignment,
    ]);

    expect(ownership.getForPrincipal(author)).toEqual([
      expect.objectContaining({
        role: CourseOwnershipRole.AUTHOR,
      }),
      expect.objectContaining({
        role: CourseOwnershipRole.CO_AUTHOR,
      }),
    ]);
  });

  it('returns assignments for a role', () => {
    const ownership = CourseOwnership.create([
      ownerAssignment,
      authorAssignment,
      editorAssignment,
    ]);

    expect(ownership.getForRole(CourseOwnershipRole.EDITOR)).toEqual([
      editorAssignment,
    ]);
  });

  it('adds an assignment immutably', () => {
    const initial = CourseOwnership.create([ownerAssignment]);

    const updated = initial.add(authorAssignment);

    expect(initial.size).toBe(1);
    expect(updated.size).toBe(2);

    expect(initial.has(author, CourseOwnershipRole.AUTHOR)).toBe(false);

    expect(updated.has(author, CourseOwnershipRole.AUTHOR)).toBe(true);
  });

  it('rejects adding a duplicate assignment', () => {
    const ownership = CourseOwnership.create([authorAssignment]);

    expect(() => ownership.add(authorAssignment)).toThrow(
      'Course ownership assignment already exists.',
    );
  });

  it('rejects adding a second Owner', () => {
    const ownership = CourseOwnership.create([ownerAssignment]);

    const anotherOwner = CourseActorId.from('user-owner-2');

    expect(() =>
      ownership.add(
        createCourseOwnershipAssignment({
          principalId: anotherOwner,
          role: CourseOwnershipRole.OWNER,
        }),
      ),
    ).toThrow('Course ownership already has an Owner.');
  });

  it('removes an assignment immutably', () => {
    const initial = CourseOwnership.create([ownerAssignment, authorAssignment]);

    const updated = initial.remove(author, CourseOwnershipRole.AUTHOR);

    expect(initial.size).toBe(2);
    expect(updated.size).toBe(1);
    expect(updated.has(author, CourseOwnershipRole.AUTHOR)).toBe(false);
  });

  it('treats removal of a missing assignment as a no-op', () => {
    const initial = CourseOwnership.create([ownerAssignment]);

    const updated = initial.remove(author, CourseOwnershipRole.AUTHOR);

    expect(updated.equals(initial)).toBe(true);
    expect(updated).not.toBe(initial);
  });

  it('rehydrates deterministically', () => {
    const first = CourseOwnership.rehydrate([
      ownerAssignment,
      authorAssignment,
    ]);

    const second = CourseOwnership.rehydrate([
      ownerAssignment,
      authorAssignment,
    ]);

    expect(second.equals(first)).toBe(true);
  });

  it('compares ownership collections by value and order', () => {
    const first = CourseOwnership.create([ownerAssignment, authorAssignment]);

    const same = CourseOwnership.create([
      createCourseOwnershipAssignment({
        principalId: owner,
        role: CourseOwnershipRole.OWNER,
      }),
      createCourseOwnershipAssignment({
        principalId: author,
        role: CourseOwnershipRole.AUTHOR,
      }),
    ]);

    const reordered = CourseOwnership.create([
      authorAssignment,
      ownerAssignment,
    ]);

    expect(first.equals(same)).toBe(true);
    expect(first.equals(reordered)).toBe(false);
  });

  it('freezes the ownership collection and assignments', () => {
    const ownership = CourseOwnership.create([
      ownerAssignment,
      authorAssignment,
    ]);

    expect(Object.isFrozen(ownership)).toBe(true);

    for (const assignment of ownership.getAssignments()) {
      expect(Object.isFrozen(assignment)).toBe(true);
    }
  });
});
