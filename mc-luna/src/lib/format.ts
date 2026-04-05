/**
 * =========================
 * 공통 숫자 포맷 유틸
 * =========================
 *
 * 목적:
 * - 페이지마다 흩어진 숫자 포맷 로직 통일
 * - 경험치, 셀, 일반 수량을 모두 천 단위 콤마로 표시
 */

/**
 * 일반 정수 표시
 * 예: 12345 -> "12,345"
 */
export function formatInteger(value: number): string {
  return Math.floor(Math.max(value, 0)).toLocaleString("ko-KR");
}

/**
 * 셀 전용 표시
 * 현재는 일반 정수와 동일하지만,
 * 추후 "셀" 단위 특수 규칙이 생기면 여기서만 바꾸면 됨
 */
export function formatCell(value: number): string {
  return Math.floor(Math.max(value, 0)).toLocaleString("ko-KR");
}

/**
 * 소수 포함 일반 숫자 표시
 * 예: 1234.567 -> "1,234.57"
 */
export function formatDecimal(value: number, digits = 2): string {
  return value.toLocaleString("ko-KR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

/**
 * 비율(0~1)을 퍼센트 문자열로 변환
 * 예: 0.1234 -> "12.34%"
 */
export function formatPercentFromRatio(value: number, digits = 2): string {
  return `${(value * 100).toLocaleString("ko-KR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  })}%`;
}

/**
 * 퍼센트 숫자를 그대로 표시
 * 예: 12.345 -> "12.35%"
 */
export function formatPercent(value: number, digits = 2): string {
  return `${value.toLocaleString("ko-KR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  })}%`;
}