/** 将 Date 格式化为本地时区的 YYYY-MM-DD */
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** 获取今天本地时区的 YYYY-MM-DD */
export function getTodayLocal(): string {
  return formatLocalDate(new Date());
}
