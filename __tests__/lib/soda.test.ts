import {
  soqlString,
  monthFilter,
  dateRangeFilter,
  parseYearMonth,
  isValidPlate,
} from '@/lib/soda';

describe('soda helpers', () => {
  it('escapes single quotes in SoQL strings', () => {
    expect(soqlString("O'FARRELL ST")).toBe("'O''FARRELL ST'");
  });

  it('builds a single-month filter that rolls over December', () => {
    expect(monthFilter(2025, 12)).toBe(
      "citation_issued_datetime >= '2025-12-01T00:00:00.000' AND citation_issued_datetime < '2026-01-01T00:00:00.000'"
    );
  });

  it('builds a multi-month range filter', () => {
    expect(dateRangeFilter(2025, 11, 2026, 2)).toContain("< '2026-02-01T00:00:00.000'");
  });

  it('accepts valid year/month and rejects bad input', () => {
    const p = (q: string) => parseYearMonth(new URLSearchParams(q));
    expect(p('year=2025&month=3')).toEqual({ year: 2025, month: 3 });
    expect(p('year=2025&month=13')).toBeNull();
    expect(p('year=2024&month=12')).toBeNull();
    expect(p('year=2025.5&month=1')).toBeNull();
    expect(p('year=3000&month=1')).toBeNull();
    expect(p('')).toBeNull();
  });

  it('validates plate format', () => {
    expect(isValidPlate('7ABC123')).toBe(true);
    expect(isValidPlate("X' OR '1'='1")).toBe(false);
    expect(isValidPlate('')).toBe(false);
  });
});
