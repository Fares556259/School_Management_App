import { describe, expect, it } from "@jest/globals";
import {
  getMonthsBetween,
  getNextMonth,
  getPreviousMonth,
  getSchoolYearMonths,
  isMonthBefore,
  parseMonthYear,
} from "../lib/dateUtils";

describe("parseMonthYear", () => {
  it.each([
    ["September 2026", 9],
    ["Septembre 2026", 9],
    ["Février 2026", 2],
    ["سبتمبر 2026", 9],
    ["2026-09", 9],
    ["09/2026", 9],
  ])("parses %s to month %i of 2026", (input, month) => {
    const result = parseMonthYear(input);

    expect(result.month).toBe(month);
    expect(result.year).toBe(2026);
  });

  it("creates canonical English and French month keys from object input", () => {
    expect(parseMonthYear({ month: 2, year: 2026 })).toEqual({
      month: 2,
      year: 2026,
      monthKey: "February 2026",
      fullFrench: "Février 2026",
    });
  });
});

describe("month navigation", () => {
  it("moves from December to January of the next year", () => {
    expect(getNextMonth("December 2026")).toBe("January 2027");
  });

  it("moves from January to December of the previous year", () => {
    expect(getPreviousMonth("January 2026")).toBe("December 2025");
  });

  it("compares months across year boundaries", () => {
    expect(isMonthBefore("December 2025", "January 2026")).toBe(true);
    expect(isMonthBefore("January 2026", "January 2026")).toBe(false);
  });

  it("returns months up to but excluding the end month", () => {
    expect(getMonthsBetween("November 2025", "February 2026")).toEqual([
      "November 2025",
      "December 2025",
      "January 2026",
    ]);
  });
});

describe("getSchoolYearMonths", () => {
  it("returns September through June for the school year containing the date", () => {
    expect(getSchoolYearMonths(new Date(2026, 3, 15))).toEqual([
      "September 2025",
      "October 2025",
      "November 2025",
      "December 2025",
      "January 2026",
      "February 2026",
      "March 2026",
      "April 2026",
      "May 2026",
      "June 2026",
    ]);
  });
});
