import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';

import {
  DefaultCourseApplicationService,
  DefaultCourseQueryApplicationService,
  DefaultCourseVersionApplicationService,
  type CourseQueryRequest,
} from '@gurusthalam/courses';

import type {
  AssignCourseOwnershipDto,
  CreateCourseDto,
  GetCourseDto,
  RemoveCourseOwnershipDto,
  ReplaceCourseOwnershipDto,
  UpdateCourseMetadataDto,
} from './dto/index.js';

/**
 * HTTP adapter for transactional Course commands and Course read/query
 * scenarios.
 *
 * This controller deliberately contains no Course business rules.
 *
 * Responsibilities:
 * - map HTTP route parameters and request bodies into application inputs;
 * - map Course query parameters into the read application boundary;
 * - delegate to the Course application services;
 * - return application-service results.
 *
 * Deliberately excluded:
 * - authentication;
 * - authorization;
 * - Course lifecycle rules;
 * - metadata invariants;
 * - persistence;
 * - domain-event publication;
 * - outbox processing;
 * - query execution details;
 * - read-model persistence implementation.
 *
 * Authentication and authorization remain owned by the dedicated
 * API security boundary.
 */
@Controller('courses')
export class CourseController {
  constructor(
    private readonly courseApplication: DefaultCourseApplicationService,
    private readonly courseVersionApplication: DefaultCourseVersionApplicationService,
    private readonly courseQueryApplication: DefaultCourseQueryApplicationService,
  ) {}

  /**
   * Lists/discovers Courses through the dedicated read/query boundary.
   *
   * Query execution deliberately does not use CourseApplicationService
   * because discovery/listing is a read-side concern and must return
   * projections rather than hydrated Course aggregates.
   *
   * Runtime validation is performed by DefaultCourseQueryApplicationService.
   */
  @Get()
  async query(@Query() request: CourseQueryRequest) {
    return this.courseQueryApplication.search(request);
  }

  /**
   * Creates a new Course.
   *
   * Transport DTO arrays are normalized into mutable application
   * contract arrays at this boundary. This keeps the HTTP DTO contract
   * immutable without changing the application-layer contract.
   */
  @Post()
  async create(@Body() request: CreateCourseDto) {
    return this.courseApplication.createCourse({
      title: request.title,
      description: request.description,
      level: request.level,
      type: request.type,
      visibility: request.visibility,
      instructorId: request.instructorId,
      ownership: request.ownership?.map((assignment) => ({
        principalId: assignment.principalId,
        role: assignment.role,
      })),
    });
  }

  /**
   * Retrieves one Course aggregate by identifier.
   *
   * This is intentionally separate from the collection query above:
   * GET /courses       -> read/query projection
   * GET /courses/:id   -> aggregate retrieval
   */
  @Get(':courseId')
  async get(@Param() params: GetCourseDto) {
    return this.courseApplication.getCourse({
      courseId: params.courseId,
    });
  }

  /**
   * Updates mutable Course metadata.
   *
   * The application service and Course aggregate remain responsible for:
   * - mutation validation;
   * - lifecycle eligibility;
   * - metadata invariants;
   * - timestamp mutation;
   * - semantic no-op handling;
   * - domain-event creation.
   */
  @Patch(':courseId')
  async update(
    @Param('courseId') courseId: string,
    @Body() request: UpdateCourseMetadataDto,
  ) {
    return this.courseApplication.updateCourse({
      courseId,
      ...request,
    });
  }

  /**
   * Assigns one ownership role to a Course participant.
   */
  @Post(':courseId/ownership')
  async assignOwnership(
    @Param('courseId') courseId: string,
    @Body() request: AssignCourseOwnershipDto,
  ) {
    return this.courseApplication.assignOwnership({
      courseId,
      principalId: request.principalId,
      role: request.role,
    });
  }

  /**
   * Removes one ownership role from a Course participant.
   */
  @Delete(':courseId/ownership')
  async removeOwnership(
    @Param('courseId') courseId: string,
    @Body() request: RemoveCourseOwnershipDto,
  ) {
    return this.courseApplication.removeOwnership({
      courseId,
      principalId: request.principalId,
      role: request.role,
    });
  }

  /**
   * Replaces the complete Course ownership assignment set.
   *
   * The transport DTO uses readonly assignments while the application
   * contract uses a mutable array. The mapping is intentionally performed
   * at the HTTP/application boundary.
   */
  @Put(':courseId/ownership')
  async replaceOwnership(
    @Param('courseId') courseId: string,
    @Body() request: ReplaceCourseOwnershipDto,
  ) {
    return this.courseApplication.replaceOwnership({
      courseId,
      assignments: request.assignments.map((assignment) => ({
        principalId: assignment.principalId,
        role: assignment.role,
      })),
    });
  }

  /**
   * Submits a Course for review.
   *
   * This command has no JSON body.
   */
  @Post(':courseId/submit-for-review')
  async submitForReview(@Param('courseId') courseId: string) {
    return this.courseApplication.submitForReview({
      courseId,
    });
  }

  /**
   * Requests changes on a Course currently under review.
   *
   * This command has no JSON body.
   */
  @Post(':courseId/request-changes')
  async requestChanges(@Param('courseId') courseId: string) {
    return this.courseApplication.requestChanges({
      courseId,
    });
  }

  /**
   * Publishes a Course.
   *
   * The Course aggregate remains responsible for publication eligibility.
   */
  @Post(':courseId/publish')
  async publish(@Param('courseId') courseId: string) {
    return this.courseApplication.publish({
      courseId,
    });
  }

  /**
   * Unpublishes a Course.
   *
   * This command has no JSON body.
   */
  @Post(':courseId/unpublish')
  async unpublish(@Param('courseId') courseId: string) {
    return this.courseApplication.unpublish({
      courseId,
    });
  }

  /**
   * Archives a Course.
   *
   * This command has no JSON body.
   */
  @Post(':courseId/archive')
  async archive(@Param('courseId') courseId: string) {
    return this.courseApplication.archive({
      courseId,
    });
  }

  /**
   * Creates the next CourseVersion for a Course.
   *
   * Version numbering and snapshot metadata remain application/domain
   * responsibilities and are not accepted from HTTP.
   *
   * This command has no JSON body.
   */
  @Post(':courseId/versions')
  async createVersion(@Param('courseId') courseId: string) {
    return this.courseVersionApplication.createVersion({
      courseId,
    });
  }
}

/**
 * CourseVersion publication is exposed under its own resource namespace.
 *
 * Keeping this route separate from CourseController's Course resource
 * avoids pretending that publishing a CourseVersion is the same operation
 * as publishing the parent Course aggregate.
 */
@Controller('course-versions')
export class CourseVersionController {
  constructor(
    private readonly courseVersionApplication: DefaultCourseVersionApplicationService,
  ) {}

  /**
   * Publishes an existing CourseVersion.
   *
   * Publication readiness and lifecycle validity remain owned by the
   * CourseVersion aggregate.
   *
   * This command has no JSON body.
   */
  @Post(':courseVersionId/publish')
  async publish(@Param('courseVersionId') courseVersionId: string) {
    return this.courseVersionApplication.publishVersion({
      courseVersionId,
    });
  }
}