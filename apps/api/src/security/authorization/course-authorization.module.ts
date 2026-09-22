import { Module } from '@nestjs/common';

import { CourseAuthorizationPolicy } from './course-authorization.policy.js';

import { CourseAuthorizationService } from './course-authorization.service.js';

import { RequestPrincipalResolver } from './request-principal.resolver.js';

@Module({
  providers: [
    CourseAuthorizationPolicy,
    CourseAuthorizationService,
    RequestPrincipalResolver,
  ],

  exports: [
    CourseAuthorizationPolicy,
    CourseAuthorizationService,
    RequestPrincipalResolver,
  ],
})
export class CourseAuthorizationModule {}
