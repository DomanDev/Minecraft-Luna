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
 *
 * 정책:
 * - 양수는 소수점 버림
 * - 음수는 절댓값 기준으로 버림 후 다시 음수 부호 부여
 *   예: -1234.9 -> "-1,234"
 */
export function formatCell(value: number): string {
  const truncated =
    value < 0 ? -Math.floor(Math.abs(value)) : Math.floor(value);

  return truncated.toLocaleString("ko-KR");
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