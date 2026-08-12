import {
  failure,
  success,
} from './result.js';

describe('Result', () => {
  it('creates a successful result', () => {
    expect(success('Gurusthalam')).toEqual({
      success: true,
      value: 'Gurusthalam',
    });
  });

  it('creates a failure result', () => {
    const error = new Error('Something went wrong');

    expect(failure(error)).toEqual({
      success: false,
      error,
    });
  });
});