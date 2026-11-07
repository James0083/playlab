import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { getLocalBest, getPlayerId, saveLocalBest } from './score.ts';

/** 브라우저 localStorage 대신 쓰는 메모리 저장소 */
function installStorage(storage: Pick<Storage, 'getItem' | 'setItem'>) {
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
}

function memoryStorage() {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  };
}

beforeEach(() => installStorage(memoryStorage()));

test('최고기록은 더 높은 점수일 때만 바뀐다', () => {
  assert.equal(getLocalBest({ slug: 'tteokchigi' }), 0);
  saveLocalBest({ slug: 'tteokchigi' }, 30);
  saveLocalBest({ slug: 'tteokchigi' }, 20);
  assert.equal(getLocalBest({ slug: 'tteokchigi' }), 30);
});

test('최고기록은 게임마다 따로 저장된다', () => {
  saveLocalBest({ slug: 'tteokchigi' }, 30);
  assert.equal(getLocalBest({ slug: 'dalgona' }), 0);
});

test('플레이어 ID는 한 번 만들면 계속 같은 값을 쓴다', () => {
  assert.equal(getPlayerId(), getPlayerId());
});

test('저장소에 접근할 수 없어도(사생활 보호 모드 등) 오류 없이 동작한다', () => {
  installStorage({
    getItem: () => {
      throw new Error('SecurityError');
    },
    setItem: () => {
      throw new Error('QuotaExceededError');
    },
  });
  assert.doesNotThrow(() => saveLocalBest({ slug: 'tteokchigi' }, 10));
  assert.equal(getLocalBest({ slug: 'tteokchigi' }), 0);
  assert.match(getPlayerId(), /^[0-9a-f-]{36}$/);
});

test('보드(예: 달고나 모양)마다 최고기록이 따로 저장된다', () => {
  saveLocalBest({ slug: 'dalgona', board: 'umbrella' }, 700);
  assert.equal(getLocalBest({ slug: 'dalgona', board: 'circle' }), 0);
  assert.equal(getLocalBest({ slug: 'dalgona', board: 'umbrella' }), 700);
});
