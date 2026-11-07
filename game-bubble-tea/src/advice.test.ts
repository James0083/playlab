import assert from 'node:assert/strict';
import { test } from 'node:test';
import { adviceFor } from './advice.ts';
import type { SecondRating, ShakeResult } from './rules.ts';

/** 평가 10칸을 주어 만든 결과(점수·흔들기 양은 팁에 쓰지 않는다) */
function resultWith(ratings: SecondRating[], mixPercent = 100): ShakeResult {
  return {
    score: 0,
    mixPercent,
    steadySeconds: ratings.filter((rating) => rating === 'steady').length,
    spills: ratings.filter((rating) => rating === 'spill').length,
    ratings,
    buckets: ratings.map(() => 0),
  };
}

const steady = (): SecondRating[] => Array.from({ length: 10 }, () => 'steady');

test('넘쳤으면 처음 넘친 초를 알려 준다(다른 문제보다 먼저)', () => {
  const ratings = steady();
  ratings[0] = 'weak';
  ratings[6] = 'spill';
  assert.match(adviceFor(resultWith(ratings, 80)), /^7초에 넘쳤어요/);
});

test('덜 섞였으면 더 힘차게 흔들라고 한다', () => {
  assert.match(adviceFor(resultWith(steady(), 95)), /힘차게/);
});

test('처음 2초가 약했으면 시작하자마자 흔들라고 한다', () => {
  const ratings = steady();
  ratings[1] = 'weak';
  assert.match(adviceFor(resultWith(ratings)), /처음이 약했어요/);
});

test('마지막 2초가 약했으면 끝까지 흔들라고 한다', () => {
  const ratings = steady();
  ratings[9] = 'weak';
  assert.match(adviceFor(resultWith(ratings)), /끝까지/);
});

test('센 구간이 있으면 살살 일정하게 흔들라고 한다', () => {
  const ratings = steady();
  ratings[4] = 'strong';
  assert.match(adviceFor(resultWith(ratings)), /살살/);
});

test('모두 적정이고 넘치지 않았으면 칭찬한다', () => {
  assert.match(adviceFor(resultWith(steady())), /완벽해요/);
});
