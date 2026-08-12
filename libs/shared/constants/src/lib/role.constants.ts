export const USER_ROLE = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  INSTRUCTOR: 'instructor',
  CONTENT_MANAGER: 'content_manager',
  MODERATOR: 'moderator',
  SUPPORT: 'support',
  LEARNER: 'learner',
} as const;

export type UserRole =
  (typeof USER_ROLE)[keyof typeof USER_ROLE];