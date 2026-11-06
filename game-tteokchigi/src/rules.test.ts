import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bpmAt, judge, nearestBeatIndex, pestleHeight, scheduleBeats } from './rules.ts';

test('판정 경계: ±100 PERFECT, ±200 GOOD, 그 외 MISS', () => {
  assert.equal(judge(0), 'PERFECT');
  assert.equal(judge(-100), 'PERFECT');
  assert.equal(judge(101), 'GOOD');
  assert.equal(judge(-200), 'GOOD');
  assert.equal(judge(201), 'MISS');
});

test('BPM은 10초마다 5씩 오른다', () => {
  assert.equal(bpmAt(0), 60);
  assert.equal(bpmAt(9_999), 60);
  assert.equal(bpmAt(10_000), 65);
  assert.equal(bpmAt(59_999), 85);
});

test('박자는 시간 범위 안에서 증가하고 간격이 줄어든다', () => {
  const beats = scheduleBeats();
  assert.equal(beats[0], 1000);
  const [first, second] = [beats[0] ?? 0, beats[1] ?? 0];
  const [beforeLast, last] = [beats.at(-2) ?? 0, beats.at(-1) ?? 0];
  assert.ok(last < 60_000);
  assert.ok(last - beforeLast < second - first);
});

test('가장 가까운 박자를 찾는다', () => {
  assert.equal(nearestBeatIndex([1000, 2000, 3000], 1400), 0);
  assert.equal(nearestBeatIndex([1000, 2000, 3000], 1600), 1);
  assert.equal(nearestBeatIndex([1000, 2000, 3000], 9000), 2);
});

test('절굿공이는 박자에 정점, 박자 사이 중간에 바닥이다', () => {
  assert.equal(pestleHeight([1000, 2000], 1000), 1);
  assert.equal(pestleHeight([1000, 2000], 1500), 0);
});
