import { Module } from '@nestjs/common';

import { CourseAuthorizationModule } from '../security/authorization/course-authorization.module.js';

import { LearningApplicationModule } from './learning-application.module.js';
import { LearningProgressQueryController } from './learning-progress-query.controller.js';

@Module({
  imports: [LearningApplicationModule, CourseAuthorizationModule],
  controllers: [LearningProgressQueryController],
})
export class LearningProgressQueryModule {}
