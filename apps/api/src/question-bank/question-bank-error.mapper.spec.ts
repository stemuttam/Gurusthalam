import { HttpStatus } from '@nestjs/common';

import {
  QuestionAssignmentAuthenticationError,
  QuestionAssignmentValidationError,
  QuestionLifecycleAuthenticationError,
  QuestionLifecycleNotFoundError,
} from '@gurusthalam/question-bank';

import {
  PrismaRepositoryError,
  PrismaRepositoryErrorCode,
} from '../database/prisma/repositories/prisma-repository.error.js';

import { QUESTION_BANK_ERROR_CONTRACT } from './question-bank-error.contract.js';

import {
  getQuestionBankPrismaErrorContract,
  mapQuestionBankError,
} from './question-bank-error.mapper.js';

import { describe, expect, it } from 'vitest';

describe('Question Bank error contract', () => {
  describe('application errors', () => {
    it.each([
      new QuestionLifecycleAuthenticationError('Authentication failed.'),
      new QuestionAssignmentAuthenticationError('Authentication failed.'),
    ])('maps authentication failures to HTTP 401', (error) => {
      const mapped = mapQuestionBankError(error);

      expect(mapped).not.toBeNull();
      expect(mapped?.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
      expect(mapped?.getResponse()).toEqual(
        QUESTION_BANK_ERROR_CONTRACT.authenticationRequired,
      );
    });

    it('maps assignment validation failures to HTTP 400', () => {
      const mapped = mapQuestionBankError(
        new QuestionAssignmentValidationError('Invalid assignment role.'),
      );

      expect(mapped?.getStatus()).toBe(HttpStatus.BAD_REQUEST);
      expect(mapped?.getResponse()).toEqual({
        ...QUESTION_BANK_ERROR_CONTRACT.validationFailed,
        message: 'Invalid assignment role.',
      });
    });

    it('maps lifecycle not-found failures to HTTP 404', () => {
      const mapped = mapQuestionBankError(
        new QuestionLifecycleNotFoundError('Internal lookup details.'),
      );

      expect(mapped?.getStatus()).toBe(HttpStatus.NOT_FOUND);
      expect(mapped?.getResponse()).toEqual(
        QUESTION_BANK_ERROR_CONTRACT.resourceNotFound,
      );
    });
  });

  describe('repository errors', () => {
    it.each([
      [
        PrismaRepositoryErrorCode.AUTHORIZATION_DENIED,
        HttpStatus.FORBIDDEN,
        QUESTION_BANK_ERROR_CONTRACT.accessDenied,
      ],
      [
        PrismaRepositoryErrorCode.RECORD_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        QUESTION_BANK_ERROR_CONTRACT.resourceNotFound,
      ],
      [
        PrismaRepositoryErrorCode.CONCURRENT_MODIFICATION,
        HttpStatus.CONFLICT,
        QUESTION_BANK_ERROR_CONTRACT.concurrentModification,
      ],
      [
        PrismaRepositoryErrorCode.UNIQUE_CONSTRAINT,
        HttpStatus.CONFLICT,
        QUESTION_BANK_ERROR_CONTRACT.resourceConflict,
      ],
      [
        PrismaRepositoryErrorCode.FOREIGN_KEY_CONSTRAINT,
        HttpStatus.CONFLICT,
        QUESTION_BANK_ERROR_CONTRACT.resourceConflict,
      ],
      [
        PrismaRepositoryErrorCode.PERSISTENCE_FAILURE,
        HttpStatus.INTERNAL_SERVER_ERROR,
        QUESTION_BANK_ERROR_CONTRACT.internalError,
      ],
    ] as const)(
      'maps repository code %s to its public contract',
      (repositoryCode, expectedStatus, expectedContract) => {
        const error = new PrismaRepositoryError(
          'Sensitive database message.',
          repositoryCode,
          {
            prismaCode: 'P1001',
            cause: new Error('Sensitive underlying cause.'),
          },
        );

        const mapped = mapQuestionBankError(error);

        expect(mapped?.getStatus()).toBe(expectedStatus);
        expect(mapped?.getResponse()).toEqual(expectedContract);
        expect(getQuestionBankPrismaErrorContract(error)).toEqual(
          expectedContract,
        );

        const response = mapped?.getResponse();

        expect(JSON.stringify(response)).not.toContain(
          'Sensitive database message.',
        );
        expect(JSON.stringify(response)).not.toContain('P1001');
        expect(JSON.stringify(response)).not.toContain(
          'Sensitive underlying cause.',
        );
      },
    );
  });

  describe('unknown errors', () => {
    it('does not translate unexpected errors', () => {
      const error = new TypeError('Unexpected programming failure.');

      expect(mapQuestionBankError(error)).toBeNull();
    });

    it('does not translate arbitrary thrown values', () => {
      expect(mapQuestionBankError('unexpected')).toBeNull();
      expect(mapQuestionBankError(null)).toBeNull();
      expect(mapQuestionBankError(undefined)).toBeNull();
    });
  });
});
