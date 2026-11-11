import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DROP_HEIGHT, fallingHeight, GROUND_HEIGHT, heightAt, peakOf } from './motion.ts';
import { kickTimeMs, MIN_PERIOD_MS, START_PERIOD_MS } from './rules.ts';

test('차는 시각에 제기가 발등 높이에 닿는다', () => {
  for (const index of [0, 1, 5, 40]) {
    assert.ok(Math.abs(heightAt({ elapsedMs: kickTimeMs(index), index })) < 1e-9);
  }
});

test('첫 킥 전에는 위에서 떨어지고, 이후에는 올라갔다 내려온다', () => {
  assert.equal(heightAt({ elapsedMs: 0, index: 0 }), DROP_HEIGHT);
  const middleMs = (kickTimeMs(1) + kickTimeMs(2)) / 2;
  assert.ok(heightAt({ elapsedMs: middleMs, index: 2 }) > 0);
});

test('주기가 길수록 높이 올라간다', () => {
  assert.ok(peakOf(START_PERIOD_MS) > peakOf(MIN_PERIOD_MS));
});

test('놓친 제기는 땅 높이에서 멈춘다', () => {
  assert.equal(fallingHeight({ fromHeight: 80, sinceMs: 0 }), 80);
  assert.equal(fallingHeight({ fromHeight: 80, sinceMs: 5_000 }), GROUND_HEIGHT);
});
