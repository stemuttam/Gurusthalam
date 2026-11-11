import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

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

import {
  QUESTION_BANK_ERROR_CONTRACT,
  type QuestionBankErrorContract,
} from './question-bank-error.contract.js';

export function getQuestionBankPrismaErrorContract(
  error: PrismaRepositoryError,
): QuestionBankErrorContract {
  switch (error.code) {
    case PrismaRepositoryErrorCode.AUTHORIZATION_DENIED:
      return QUESTION_BANK_ERROR_CONTRACT.accessDenied;

    case PrismaRepositoryErrorCode.RECORD_NOT_FOUND:
      return QUESTION_BANK_ERROR_CONTRACT.resourceNotFound;

    case PrismaRepositoryErrorCode.CONCURRENT_MODIFICATION:
      return QUESTION_BANK_ERROR_CONTRACT.concurrentModification;

    case PrismaRepositoryErrorCode.UNIQUE_CONSTRAINT:
    case PrismaRepositoryErrorCode.FOREIGN_KEY_CONSTRAINT:
      return QUESTION_BANK_ERROR_CONTRACT.resourceConflict;

    case PrismaRepositoryErrorCode.PERSISTENCE_FAILURE:
    default:
      return QUESTION_BANK_ERROR_CONTRACT.internalError;
  }
}

/**
 * Maps known Question Bank application and repository failures
 * to stable HTTP exceptions.
 *
 * Unknown exceptions deliberately return null. They remain unexpected
 * failures and are handled by the global exception filter.
 */
export function mapQuestionBankError(error: unknown): HttpException | null {
  if (
    error instanceof QuestionLifecycleAuthenticationError ||
    error instanceof QuestionAssignmentAuthenticationError
  ) {
    return new UnauthorizedException(
      QUESTION_BANK_ERROR_CONTRACT.authenticationRequired,
    );
  }

  if (error instanceof QuestionAssignmentValidationError) {
    return new BadRequestException({
      ...QUESTION_BANK_ERROR_CONTRACT.validationFailed,
      message: error.message,
    });
  }

  if (error instanceof QuestionLifecycleNotFoundError) {
    return new NotFoundException(QUESTION_BANK_ERROR_CONTRACT.resourceNotFound);
  }

  if (error instanceof PrismaRepositoryError) {
    return mapPrismaRepositoryError(error);
  }

  return null;
}

function mapPrismaRepositoryError(error: PrismaRepositoryError): HttpException {
  const contract = getQuestionBankPrismaErrorContract(error);

  switch (contract.statusCode) {
    case 401:
      return new UnauthorizedException(contract);

    case 403:
      return new ForbiddenException(contract);

    case 404:
      return new NotFoundException(contract);

    case 409:
      return new ConflictException(contract);

    case 500:
    default:
      return new InternalServerErrorException(contract);
  }
}
