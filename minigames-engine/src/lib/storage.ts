// 사생활 보호 모드나 저장 공간 부족으로 localStorage 접근이 실패해도 게임은 계속되어야 한다.
// localStorage는 이 파일의 함수로만 다룬다.

/** 저장된 값. 없거나 읽을 수 없으면 null */
export function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** 값을 저장한다. 실패해도 오류를 던지지 않는다(플레이에는 영향이 없다). */
export function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* 저장하지 못해도 플레이에는 영향이 없다 */
  }
}
