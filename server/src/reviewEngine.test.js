import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseAmount,
  autoReview,
  mapHeaders,
  summarizeKpi,
  matchKey,
  AMOUNT_KEYS,
} from './reviewEngine.js';

describe('parseAmount', () => {
  it('숫자 그대로', () => {
    assert.equal(parseAmount(120000), 120000);
  });
  it('콤마·원 제거', () => {
    assert.equal(parseAmount('1,250,000원'), 1250000);
  });
});

describe('autoReview', () => {
  it('저액·무해 가맹점은 정상', () => {
    const r = autoReview({ _amount: 10000, _merchant: '○○마트' });
    assert.equal(r.status, '정상');
    assert.ok(r.risk < 28);
  });
  it('고액만이면 검토 대기 구간(72 미만)', () => {
    const r = autoReview({ _amount: 2000000, _merchant: '사무용품' });
    assert.equal(r.status, '검토 대기');
  });
  it('고액+주의 키워드면 위반 의심', () => {
    const r = autoReview({ _amount: 2000000, _merchant: '○○유흥주점' });
    assert.equal(r.status, '위반 의심');
  });
  it('유흥 키워드 가산', () => {
    const r = autoReview({ _amount: 50000, _merchant: '△△유흥주점' });
    assert.ok(r.risk >= 28);
    assert.ok(r.reason.includes('유흥'));
  });
});

describe('mapHeaders', () => {
  it('한글 헤더 매칭', () => {
    const m = mapHeaders(['거래일시', '가맹점명', '이용금액']);
    assert.equal(m.idxAmount, 2);
    assert.equal(m.idxMerchant, 1);
    assert.equal(m.idxDate, 0);
  });
});

describe('matchKey', () => {
  it('부분 일치', () => {
    assert.equal(matchKey('승인금액(원)', AMOUNT_KEYS), true);
  });
});

describe('summarizeKpi', () => {
  it('건수 집계', () => {
    const objs = [
      { _amount: 1000, _merchant: 'A' },
      { _amount: 2000000, _merchant: '유흥업소' },
      { _amount: 1000000, _merchant: '사무용품' },
    ];
    const k = summarizeKpi(objs);
    assert.equal(k.total, 3);
    assert.equal(k.violation, 1);
    assert.equal(k.reviewPending, 1);
    assert.equal(k.ok, 1);
  });
});
