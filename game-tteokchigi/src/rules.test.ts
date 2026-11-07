import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  bpmAt,
  idleBeatsAt,
  judge,
  nearestBeatIndex,
  malletHeight,
  scheduleBeats,
} from './rules.ts';

test('판정 경계: ±40 PERFECT, ±100 GREAT, ±200 GOOD, 그 외 MISS', () => {
  assert.equal(judge(0), 'PERFECT');
  assert.equal(judge(-40), 'PERFECT');
  assert.equal(judge(41), 'GREAT');
  assert.equal(judge(-100), 'GREAT');
  assert.equal(judge(101), 'GOOD');
  assert.equal(judge(-200), 'GOOD');
  assert.equal(judge(201), 'MISS');
});

test('BPM은 10초마다 10씩 오른다 (60 → 110)', () => {
  assert.equal(bpmAt(0), 60);
  assert.equal(bpmAt(9_999), 60);
  assert.equal(bpmAt(10_000), 70);
  assert.equal(bpmAt(59_999), 110);
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

test('떡메는 박자에 떡에 닿고(0), 박자 사이 중간에 가장 높다(1)', () => {
  const at = (elapsedMs: number) => malletHeight([1000, 2000], { elapsedMs, lastStrikeMs: null });
  assert.equal(at(1000), 0);
  assert.equal(at(1500), 1);
});

test('떡메는 떡에 가까울수록 빠르다 (GREAT 구간 밖에서는 눈에 띄게 떠 있다)', () => {
  const at = (elapsedMs: number) => malletHeight([1000, 2000], { elapsedMs, lastStrikeMs: null });
  // 박자 120ms 전(GREAT 범위 밖)에는 떡메가 최고 높이의 40% 이상 떠 있어야 한다
  assert.ok(at(880) > 0.4);
  // 같은 시간(100ms) 동안 떡 근처에서 움직이는 거리가 꼭대기 근처보다 크다
  assert.ok(at(1100) - at(1000) > at(1500) - at(1400));
});

test('탭한 직후에는 박자와 관계없이 떡메가 떡에 닿아 있다', () => {
  const beats = [1000, 2000];
  assert.equal(malletHeight(beats, { elapsedMs: 1500, lastStrikeMs: 1450 }), 0);
  assert.equal(malletHeight(beats, { elapsedMs: 1500, lastStrikeMs: 1300 }), 1);
});

test('탭 없이 지나간 박자를 센다 (판정 구간이 끝나야 지나간 것)', () => {
  const beats = [1000, 2000, 3000, 4000];
  assert.equal(idleBeatsAt(beats, { elapsedMs: 1100, lastTapMs: null }), 0); // 아직 GOOD 구간 안
  assert.equal(idleBeatsAt(beats, { elapsedMs: 3300, lastTapMs: null }), 3);
});

test('마지막 탭 이후의 박자만 센다. 박자 직전에 친 탭은 그 박자를 시도한 것으로 본다', () => {
  const beats = [1000, 2000, 3000, 4000];
  assert.equal(idleBeatsAt(beats, { elapsedMs: 4300, lastTapMs: 1950 }), 2); // 3000, 4000
  assert.equal(idleBeatsAt(beats, { elapsedMs: 4300, lastTapMs: 1500 }), 3); // 2000, 3000, 4000
});
