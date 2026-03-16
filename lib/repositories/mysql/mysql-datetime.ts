export function toMysqlDateTime(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid datetime value: ${String(value)}`);
  }
  return date.toISOString().slice(0, 19).replace("T", " ");
}
