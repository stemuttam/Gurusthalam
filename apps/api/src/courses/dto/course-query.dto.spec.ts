import { describe, expect, it } from 'vitest';

import type { CourseQueryResultPage } from '@gurusthalam/courses';

import {
  mapCourseQueryDtoToApplicationRequest,
  mapCourseQueryResultPageToResponseDto,
  type CourseQueryDto,
} from './course-query.dto.js';

describe('Course query DTO mapping', () => {
  describe('mapCourseQueryDtoToApplicationRequest', () => {
    it('preserves HTTP query-string values without applying defaults', () => {
      const request: CourseQueryDto = {
        page: '2',
        limit: '50',
        query: ' physics ',
        status: 'DRAFT',
        visibility: 'PRIVATE',
        level: 'BEGINNER',
        type: 'SELF_PACED',
        instructorId: ' instructor-001 ',
        sortBy: 'title',
        sortOrder: 'asc',
      };

      expect(
        mapCourseQueryDtoToApplicationRequest(request),
      ).toEqual(request);
    });

    it('preserves an empty HTTP request as an empty application input', () => {
      expect(
        mapCourseQueryDtoToApplicationRequest({}),
      ).toEqual({});
    });

    it('does not apply pagination defaults', () => {
      expect(
        mapCourseQueryDtoToApplicationRequest({
          query: 'physics',
        }),
      ).toEqual({
        query: 'physics',
      });
    });

    it('does not perform enum validation', () => {
      const request: CourseQueryDto = {
        status: 'INVALID_STATUS',
        visibility: 'INVALID_VISIBILITY',
        level: 'INVALID_LEVEL',
        type: 'INVALID_TYPE',
        sortBy: 'INVALID_SORT',
        sortOrder: 'INVALID_ORDER',
      };

      expect(
        mapCourseQueryDtoToApplicationRequest(request),
      ).toEqual(request);
    });

    it('preserves invalid numeric values for the application validation boundary', () => {
      const request: CourseQueryDto = {
        page: 'abc',
        limit: 'xyz',
      };

      expect(
        mapCourseQueryDtoToApplicationRequest(request),
      ).toEqual({
        page: 'abc',
        limit: 'xyz',
      });
    });
  });

  describe('mapCourseQueryResultPageToResponseDto', () => {
    it('maps the complete application result into an HTTP response', () => {
      const result: CourseQueryResultPage = {
        items: [
          {
            id: 'course-001',
            title: 'Physics',
            description: 'Introduction to physics',
            level: 'BEGINNER',
            type: 'SELF_PACED',
            visibility: 'PUBLIC',
            status: 'PUBLISHED',
            instructorId: 'instructor-001',
            createdAt: new Date(
              '2026-09-01T00:00:00.000Z',
            ),
            updatedAt: new Date(
              '2026-09-02T00:00:00.000Z',
            ),
          },
        ],
        meta: {
          page: 2,
          limit: 10,
          total: 11,
          totalPages: 2,
          hasNextPage: false,
          hasPreviousPage: true,
        },
      };

      const response =
        mapCourseQueryResultPageToResponseDto(result);

      expect(response).toEqual(result);
      expect(response).not.toBe(result);
      expect(response.items).not.toBe(result.items);
      expect(response.meta).not.toBe(result.meta);
      expect(response.items[0]).not.toBe(result.items[0]);
    });

    it('preserves empty result pagination metadata', () => {
      const result: CourseQueryResultPage = {
        items: [],
        meta: {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      };

      expect(
        mapCourseQueryResultPageToResponseDto(result),
      ).toEqual(result);
    });
  });
});