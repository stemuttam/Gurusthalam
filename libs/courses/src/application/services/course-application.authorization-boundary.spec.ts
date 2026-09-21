import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDirectory = dirname(fileURLToPath(import.meta.url));

const coursesSourceRoot = join(currentDirectory, '../../');

const forbiddenImportPatterns = [
  '@nestjs/',
  'express',
  'passport',
  'jsonwebtoken',
  'jwt',
  'AuthGuard',
  'RolesGuard',
  'PermissionGuard',
  'CanActivate',
  'AuthorizationService',
  'AuthorizationContext',
  'AuthenticationService',
  'AuthenticationContext',
  'RbacService',
  'Rbac',
  'AbacService',
  'Abac',
];

const sourceFileExtensions = new Set(['.ts']);

function collectTypeScriptFiles(directory: string): string[] {
  if (!existsSync(directory)) {
    return [];
  }

  return readdirSync(directory).flatMap((entry) => {
    const absolutePath = join(directory, entry);
    const stats = statSync(absolutePath);

    if (stats.isDirectory()) {
      return collectTypeScriptFiles(absolutePath);
    }

    if (
      stats.isFile() &&
      sourceFileExtensions.has(
        absolutePath.slice(absolutePath.lastIndexOf('.')),
      )
    ) {
      return [absolutePath];
    }

    return [];
  });
}

function extractImportDeclarations(source: string): string[] {
  const imports: string[] = [];

  const staticImportPattern =
    /(?:^|\n)\s*import(?:[\s\S]*?)from\s*['"]([^'"]+)['"]\s*;?/g;

  for (const match of source.matchAll(staticImportPattern)) {
    const moduleSpecifier = match[1];

    if (moduleSpecifier !== undefined) {
      imports.push(moduleSpecifier);
    }
  }

  const sideEffectImportPattern = /(?:^|\n)\s*import\s*['"]([^'"]+)['"]\s*;?/g;

  for (const match of source.matchAll(sideEffectImportPattern)) {
    const moduleSpecifier = match[1];

    if (moduleSpecifier !== undefined) {
      imports.push(moduleSpecifier);
    }
  }

  return imports;
}

function findForbiddenImports(sourceRoot: string): Array<{
  file: string;
  importPath: string;
  forbiddenPattern: string;
}> {
  const sourceFiles = collectTypeScriptFiles(sourceRoot);
  const violations: Array<{
    file: string;
    importPath: string;
    forbiddenPattern: string;
  }> = [];

  for (const file of sourceFiles) {
    const source = readFileSync(file, 'utf8');
    const imports = extractImportDeclarations(source);

    for (const importPath of imports) {
      for (const forbiddenPattern of forbiddenImportPatterns) {
        if (importPath.toLowerCase().includes(forbiddenPattern.toLowerCase())) {
          violations.push({
            file: relative(sourceRoot, file),
            importPath,
            forbiddenPattern,
          });
        }
      }
    }
  }

  return violations;
}

describe('Course application authorization boundary', () => {
  it('contains no framework, transport, authentication, or authorization imports', () => {
    const violations = findForbiddenImports(coursesSourceRoot);

    expect(violations).toEqual([]);
  });

  it('keeps authorization concerns out of Course application source imports', () => {
    const sourceFiles = collectTypeScriptFiles(coursesSourceRoot);

    const authorizationImportViolations: Array<{
      file: string;
      importPath: string;
    }> = [];

    const authorizationImportPatterns = [
      'authorization',
      'authentication',
      'permission',
      'rbac',
      'abac',
    ];

    for (const file of sourceFiles) {
      const source = readFileSync(file, 'utf8');
      const imports = extractImportDeclarations(source);

      for (const importPath of imports) {
        const normalizedImportPath = importPath.toLowerCase();

        if (
          authorizationImportPatterns.some((pattern) =>
            normalizedImportPath.includes(pattern),
          )
        ) {
          authorizationImportViolations.push({
            file: relative(coursesSourceRoot, file),
            importPath,
          });
        }
      }
    }

    expect(authorizationImportViolations).toEqual([]);
  });

  it('keeps CourseActorId as a domain identity rather than an authorization dependency', () => {
    const courseApplicationServicePath = join(
      coursesSourceRoot,
      'application/services/course-application.service.ts',
    );

    const courseApplicationServiceSource = readFileSync(
      courseApplicationServicePath,
      'utf8',
    );

    expect(courseApplicationServiceSource).toContain('CourseActorId');
    expect(courseApplicationServiceSource).toContain(
      'CourseActorId.from(value)',
    );

    expect(courseApplicationServiceSource).not.toContain(
      'AuthorizationService',
    );
    expect(courseApplicationServiceSource).not.toContain(
      'AuthorizationContext',
    );
    expect(courseApplicationServiceSource).not.toContain('PermissionGuard');
    expect(courseApplicationServiceSource).not.toContain('RolesGuard');
  });

  it('keeps authorization out of the CourseVersion application service', () => {
    const courseVersionApplicationServicePath = join(
      coursesSourceRoot,
      'application/services/course-version-application.service.ts',
    );

    const source = readFileSync(courseVersionApplicationServicePath, 'utf8');

    expect(source).not.toContain('AuthorizationService');
    expect(source).not.toContain('AuthorizationContext');
    expect(source).not.toContain('PermissionGuard');
    expect(source).not.toContain('RolesGuard');
    expect(source).not.toContain('AuthGuard');
    expect(source).not.toContain('CanActivate');
  });
});
