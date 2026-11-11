
import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../database/database.module.js';

import {
  AUTH0_CONFIGURATION,
  loadAuth0Configuration,
} from './auth0-configuration.js';

import { Auth0AuthenticationMiddleware } from './auth0-authentication.middleware.js';
import { Auth0IdentityResolver } from './auth0-identity-resolver.js';
import { Auth0AuthoringIdentityResolver } from './auth0-authoring-identity-resolver.js';
import { Auth0QuestionBankAuthenticationMiddleware } from './auth0-question-bank-authentication.middleware.js';
import { Auth0QuestionBankAssignmentScopeMiddleware } from './auth0-question-bank-assignment-scope.middleware.js';

@Module({
  imports: [DatabaseModule],
  providers: [
    {
      provide: AUTH0_CONFIGURATION,
      useFactory: loadAuth0Configuration,
    },
    Auth0IdentityResolver,
    Auth0AuthenticationMiddleware,
    Auth0AuthoringIdentityResolver,
    Auth0QuestionBankAuthenticationMiddleware,
    Auth0QuestionBankAssignmentScopeMiddleware,
  ],
  exports: [
    AUTH0_CONFIGURATION,
    Auth0IdentityResolver,
    Auth0AuthenticationMiddleware,
    Auth0AuthoringIdentityResolver,
    Auth0QuestionBankAuthenticationMiddleware,
    Auth0QuestionBankAssignmentScopeMiddleware,
  ],
})
export class Auth0AuthenticationModule {}
