import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDirectory = dirname(fileURLToPath(import.meta.url));

const courseControllerPath = join(currentDirectory, 'course.controller.ts');

const coursesApplicationModulePath = join(
  currentDirectory,
  'courses-application.module.ts',
);

const readSource = (path: string): string => readFileSync(path, 'utf8');

const getImportLines = (source: string): readonly string[] =>
  source.split('\n').filter((line) => line.trim().startsWith('import '));

describe('Course API authorization boundary', () => {
  it('keeps authentication and authorization out of CourseController', () => {
    const source = readSource(courseControllerPath);

    expect(source).not.toContain('InternalApiKeyGuard');
    expect(source).not.toContain('AuthGuard');
    expect(source).not.toContain('RolesGuard');
    expect(source).not.toContain('PermissionGuard');
    expect(source).not.toContain('AuthorizationService');
    expect(source).not.toContain('AuthorizationContext');
    expect(source).not.toContain('CanActivate');
  });

  it('does not introduce authentication framework imports into CourseController', () => {
    const source = readSource(courseControllerPath);
    const importLines = getImportLines(source);

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

  it('keeps authentication and authorization out of CoursesApplicationModule', () => {
    const source = readSource(coursesApplicationModulePath);

    expect(source).not.toContain('InternalApiKeyGuard');
    expect(source).not.toContain('AuthGuard');
    expect(source).not.toContain('RolesGuard');
    expect(source).not.toContain('PermissionGuard');
    expect(source).not.toContain('AuthorizationService');
    expect(source).not.toContain('AuthorizationContext');
    expect(source).not.toContain('CanActivate');
    expect(source).not.toContain('@UseGuards');
  });

  it('does not introduce authentication framework imports into CoursesApplicationModule', () => {
    const source = readSource(coursesApplicationModulePath);
    const importLines = getImportLines(source);

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

  it('keeps CoursesApplicationModule focused on application and persistence composition', () => {
    const source = readSource(coursesApplicationModulePath);

    expect(source).toContain('DefaultCourseApplicationService');
    expect(source).toContain('DefaultCourseVersionApplicationService');
    expect(source).toContain('CoursesPersistenceModule');
    expect(source).toContain('COURSE_REPOSITORY');
    expect(source).toContain('COURSE_VERSION_REPOSITORY');

    expect(source).not.toContain('@Controller');
  });

  it('does not attach internal API-key authentication to CourseController', () => {
    const source = readSource(courseControllerPath);

    expect(source).not.toContain('x-internal-api-key');
    expect(source).not.toContain('INTERNAL_API_KEY');
    expect(source).not.toContain('Internal API key');
  });

  it('keeps the Course HTTP adapter limited to transport-to-application delegation', () => {
    const source = readSource(courseControllerPath);

    expect(source).toContain('DefaultCourseApplicationService');
    expect(source).toContain('DefaultCourseVersionApplicationService');

    expect(source).not.toContain('PrismaService');
    expect(source).not.toContain('CourseRepository');
    expect(source).not.toContain('CourseVersionRepository');
  });
});
