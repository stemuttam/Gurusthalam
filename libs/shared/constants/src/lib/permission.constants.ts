export const PERMISSION = {
  USERS_READ: 'users:read',
  USERS_CREATE: 'users:create',
  USERS_UPDATE: 'users:update',
  USERS_DELETE: 'users:delete',

  COURSES_READ: 'courses:read',
  COURSES_CREATE: 'courses:create',
  COURSES_UPDATE: 'courses:update',
  COURSES_DELETE: 'courses:delete',
  COURSES_PUBLISH: 'courses:publish',

  ASSESSMENTS_READ: 'assessments:read',
  ASSESSMENTS_CREATE: 'assessments:create',
  ASSESSMENTS_UPDATE: 'assessments:update',
  ASSESSMENTS_DELETE: 'assessments:delete',

  REPORTS_READ: 'reports:read',
  REPORTS_EXPORT: 'reports:export',

  SETTINGS_READ: 'settings:read',
  SETTINGS_UPDATE: 'settings:update',
} as const;

export type Permission =
  (typeof PERMISSION)[keyof typeof PERMISSION];