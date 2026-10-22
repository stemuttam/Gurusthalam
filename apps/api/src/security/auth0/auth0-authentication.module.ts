import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../database/database.module.js';

import {
  AUTH0_CONFIGURATION,
  loadAuth0Configuration,
} from './auth0-configuration.js';
import { Auth0AuthenticationMiddleware } from './auth0-authentication.middleware.js';
import { Auth0IdentityResolver } from './auth0-identity-resolver.js';

@Module({
  imports: [DatabaseModule],
  providers: [
    {
      provide: AUTH0_CONFIGURATION,
      useFactory: loadAuth0Configuration,
    },
    Auth0IdentityResolver,
    Auth0AuthenticationMiddleware,
  ],
  exports: [
    AUTH0_CONFIGURATION,
    Auth0IdentityResolver,
    Auth0AuthenticationMiddleware,
  ],
})
export class Auth0AuthenticationModule {}
