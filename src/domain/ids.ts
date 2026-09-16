const PROJECT_CODE = /^GE-\d{4}-\d{4}$/;

export function isProjectCode(value: string): boolean {
  return PROJECT_CODE.test(value);
}

export function formatProjectCode(year: number, seq: number): string {
  return `GE-${year}-${String(seq).padStart(4, "0")}`;
}
