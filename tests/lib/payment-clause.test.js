import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAgreementPaymentClause } from '../../server/lib/payment-clause.js';

test('buildAgreementPaymentClause uses schedule and payment method together', () => {
  const clause = buildAgreementPaymentClause('PayPal', 'split_30_script_70_live');

  assert.match(clause, /30% of the total fee will be paid after the draft video is reviewed and approved\./);
  assert.match(clause, /remaining 70% will be paid after the video goes live and a valid invoice is received\./);
  assert.match(clause, /Available payment method: PayPal\./);
});

test('buildAgreementPaymentClause falls back cleanly when schedule is missing', () => {
  const clause = buildAgreementPaymentClause('Bank Transfer', '');

  assert.equal(clause, 'Available payment method: Bank Transfer.');
});
