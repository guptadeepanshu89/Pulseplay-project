export function parseId(value: string): number | undefined {
  const id = Number(value);
  return Number.isInteger(id) ? id : undefined;
}
