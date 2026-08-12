export interface Success<T> {
  readonly success: true;
  readonly value: T;
}

export interface Failure<E> {
  readonly success: false;
  readonly error: E;
}

export type Result<T, E = Error> =
  | Success<T>
  | Failure<E>;

export function success<T>(value: T): Success<T> {
  return {
    success: true,
    value,
  };
}

export function failure<E>(error: E): Failure<E> {
  return {
    success: false,
    error,
  };
}