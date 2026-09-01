import { describe, expect, it } from 'vitest';

import { courses } from './courses.js';

describe('courses', () => {
  it('should return the courses identifier', () => {
    expect(courses()).toBe('courses');
  });
});