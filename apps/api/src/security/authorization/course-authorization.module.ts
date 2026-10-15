import { Module } from '@nestjs/common';

import { CourseAuthorizationPolicy } from './course-authorization.policy.js';

import { CourseAuthorizationService } from './course-authorization.service.js';

import { RequestLearnerPrincipalResolver } from './request-learner-principal.resolver.js';

import { RequestPrincipalResolver } from './request-principal.resolver.js';

@Module({
  providers: [
    CourseAuthorizationPolicy,
    CourseAuthorizationService,
    RequestPrincipalResolver,
    RequestLearnerPrincipalResolver,
  ],

  exports: [
    CourseAuthorizationPolicy,
    CourseAuthorizationService,
    RequestPrincipalResolver,
    RequestLearnerPrincipalResolver,
  ],
})
export class CourseAuthorizationModule {}
