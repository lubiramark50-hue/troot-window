export function normalizeSalaryParam(value: string | null | undefined): string;
export function parseSalaryParam(value: string | null | undefined): number | undefined;
export function localDateKey(date: Date): string;
export function isValidDateKey(value: string): boolean;
export function isDateKeyBeforeToday(value: string, today?: string): boolean;
export function safeHttpUrl(value: string | null | undefined): string | undefined;
