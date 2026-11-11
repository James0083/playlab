// 판과 팽이 그림이 함께 쓰는 크기. 바로 위에서 내려다본 시점이라 좌표는 viewBox(240×240) 기준이고
// 판 가운데가 (120, 120)이다. 화면 좌표와 바닥 좌표가 같아 입력 변환이 단순하다.

/** 판 가운데 */
export const CENTER = 120;
export const VIEWBOX = '0 0 240 240';
/** 판(윗면) 반지름 */
export const DISH_RADIUS = 104;
/** 팽이 위치 1(판 가장자리, 쓰러짐)이 그림에서 가운데로부터 떨어진 거리 */
export const POSITION_SCALE = DISH_RADIUS - 16;
