import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDirectory = dirname(fileURLToPath(import.meta.url));

const coursesApplicationModulePath = join(
  currentDirectory,
  'courses-application.module.ts',
);

describe('Courses API authorization boundary', () => {
  it('keeps authorization implementation outside CoursesApplicationModule', () => {
    const source = readFileSync(coursesApplicationModulePath, 'utf8');

    expect(source).not.toContain('AuthGuard');
    expect(source).not.toContain('RolesGuard');
    expect(source).not.toContain('PermissionGuard');
    expect(source).not.toContain('AuthorizationService');
    expect(source).not.toContain('AuthorizationContext');
    expect(source).not.toContain('CanActivate');
  });

  it('does not introduce authentication or authorization imports into the Course application module', () => {
    const source = readFileSync(coursesApplicationModulePath, 'utf8');

    const importLines = source
      .split('\n')
      .filter((line) => line.trim().startsWith('import '));

    const forbiddenImports = [
      '@nestjs/passport',
      'passport',
      'jsonwebtoken',
      'authorization',
      'authentication',
      'permission',
      'rbac',
      'abac',
    ];

    const violations = importLines.filter((line) => {
      const normalizedLine = line.toLowerCase();

      return forbiddenImports.some((pattern) =>
        normalizedLine.includes(pattern.toLowerCase()),
      );
    });

    expect(violations).toEqual([]);
  });

  it('keeps CoursesApplicationModule focused on application services and persistence composition', () => {
    const source = readFileSync(coursesApplicationModulePath, 'utf8');

    expect(source).toContain('DefaultCourseApplicationService');
    expect(source).toContain('DefaultCourseVersionApplicationService');
    expect(source).toContain('CoursesPersistenceModule');
    expect(source).toContain('COURSE_REPOSITORY');
    expect(source).toContain('COURSE_VERSION_REPOSITORY');

    expect(source).not.toContain('@UseGuards');
    expect(source).not.toContain('@Controller');
  });
});
