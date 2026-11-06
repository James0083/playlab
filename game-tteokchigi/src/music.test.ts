import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeBackgroundMusic } from './music.ts';

test('떡 치는 순간마다 북과 멜로디, 떡메가 가장 높을 때(반박자)마다 북 가장자리가 나온다', () => {
  const events = composeBackgroundMusic([1_000, 2_000]);
  assert.deepEqual(
    events.map(({ voice, atMs }) => [voice, atMs]),
    [
      ['ka', 500],
      ['donAccent', 1_000],
      ['melody', 1_000],
      ['ka', 1_500],
      ['don', 2_000],
      ['melody', 2_000],
    ],
  );
});

test('4박마다 마디 첫 박을 세게 친다', () => {
  const beats = Array.from({ length: 8 }, (_, i) => (i + 1) * 1_000);
  const accents = composeBackgroundMusic(beats)
    .filter((event) => event.voice === 'donAccent')
    .map((event) => event.atMs);
  assert.deepEqual(accents, [1_000, 5_000]);
});
