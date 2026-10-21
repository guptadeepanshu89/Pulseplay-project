import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { readApiError, readableErrorMessage } from './errorMessage';

describe('mobile API error messages', () => {
  it('reads a string error', () => {
    assert.equal(readApiError({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' }, 401).message, 'Invalid credentials');
    assert.equal(readApiError({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' }, 401).code, 'INVALID_CREDENTIALS');
  });

  it('reads a nested error object and validation details', () => {
    const nested = readApiError({ error: { message: 'Email is already used' } }, 409);
    assert.equal(nested.message, 'Email is already used');
    assert.notEqual(nested.message, '[object Object]');

    const details = readApiError(
      { error: 'Validation failed', code: 'VALIDATION_ERROR', details: [{ path: 'password', message: 'Password must contain a digit' }] },
      400,
    );
    assert.equal(details.message, 'Validation failed Password must contain a digit');
    assert.equal(details.code, 'VALIDATION_ERROR');
  });

  it('uses a fallback when the body has no readable message', () => {
    assert.equal(readableErrorMessage({ error: { status: 500 } }), 'Something went wrong. Please try again.');
    assert.equal(readApiError(undefined, 502).message, 'Request failed (502)');
    assert.equal(readableErrorMessage('[object Object]'), 'Something went wrong. Please try again.');
  });

  it('turns a generic HTTP 404 into a readable message and keeps a specific one', () => {
    assert.equal(readApiError({ message: 'Not Found' }, 404).message, 'The requested service was not found. Check the API address.');
    assert.equal(readApiError(undefined, 404).message, 'The requested service was not found. Check the API address.');
    assert.equal(readApiError({ error: 'Wallet not found', code: 'NOT_FOUND' }, 404).message, 'Wallet not found');
  });
});
