export function parseBusinessDate(value: string) {
  return new Date(
    /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00-05:00` : value,
  );
}
