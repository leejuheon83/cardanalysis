import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  timingSafeStringEqual,
  isUuidParam,
} from './security.js';

describe('timingSafeStringEqual', () => {
  it('일치하면 true', () => {
    assert.equal(timingSafeStringEqual('admin', 'admin'), true);
  });
  it('불일치하면 false', () => {
    assert.equal(timingSafeStringEqual('admin', 'adminx'), false);
  });
  it('빈 기대값은 false', () => {
    assert.equal(timingSafeStringEqual('', ''), false);
  });
});

describe('isUuidParam', () => {
  it('UUID v4 형식 허용', () => {
    assert.equal(
      isUuidParam('550e8400-e29b-41d4-a716-446655440000'),
      true,
    );
  });
  it('잘못된 형식 거부', () => {
    assert.equal(isUuidParam('../../../etc/passwd'), false);
    assert.equal(isUuidParam("'; DROP--"), false);
  });
});
