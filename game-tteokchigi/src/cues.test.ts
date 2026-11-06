import assert from 'node:assert/strict';
import { test } from 'node:test';
import { callAt, speedUpNoticeAt } from './cues.ts';

const beats = [1_000, 2_000, 3_000];

test('떡메가 내려오는 동안 よーい가 한 글자씩 드러난다', () => {
  // 1000~2000 사이 꼭대기는 1500. 2000에 떡을 친다
  assert.equal(callAt(beats, 1_550).text, 'よ');
  assert.equal(callAt(beats, 1_750).text, 'よー');
  assert.equal(callAt(beats, 1_890).text, 'よーい');
});

test('떡을 치는 순간 전후 PERFECT 구간에서는 강조된다', () => {
  assert.deepEqual(callAt(beats, 1_900), { text: 'よーい!', isPeak: true });
  assert.deepEqual(callAt(beats, 2_100), { text: 'よーい!', isPeak: true });
});

test('떡메를 들어 올리는 동안은 말풍선을 숨긴다', () => {
  assert.equal(callAt(beats, 2_300).text, '');
});

test('첫 박자 전에는 시작부터 올라가는 중으로 본다', () => {
  assert.equal(callAt(beats, 0).text, 'よ');
});

test('BPM이 오른 직후에만 속도 알림을 보여준다', () => {
  assert.equal(speedUpNoticeAt(5_000), null);
  assert.equal(speedUpNoticeAt(10_200), '빨라져요! ♩=65');
  assert.equal(speedUpNoticeAt(11_500), null);
  assert.equal(speedUpNoticeAt(50_000), '빨라져요! ♩=85');
});
