/**
 * Trigger recency filter — classifies account triggers by age relative to today.
 *
 * Recency levels:
 *   strong     — < 6 months old, reference prominently
 *   supporting — 6-12 months old, corroborating evidence only
 *   excluded   — > 12 months old or unparseable, do not reference
 */

export type RecencyLevel = 'strong' | 'supporting' | 'excluded';

export interface AccountTrigger {
  title: string;
  detail: string;
  source: string;
  dateLabel: string;
}

export interface RecencyAnnotatedTrigger extends AccountTrigger {
  recencyLevel: RecencyLevel;
  monthsOld?: number;
}

// Month name -> 0-indexed month number
const MONTH_MAP: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, september: 8, sept: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

/**
 * Parse a human-readable date label into a Date.
 * Handles: "Mar 2025", "April 2024", "22 Jan 2025", "Q1 2025", "2025", "Jan 22, 2025"
 * Returns null if unparseable.
 */
export function parseTriggerDate(dateLabel: string): Date | null {
  if (!dateLabel || !dateLabel.trim()) return null;

  const s = dateLabel.trim();

  // Quarter format: "Q1 2025", "Q2 2024"
  const quarterMatch = s.match(/^Q([1-4])\s+(\d{4})$/i);
  if (quarterMatch) {
    const quarter = parseInt(quarterMatch[1], 10);
    const year = parseInt(quarterMatch[2], 10);
    // Mid-quarter: Q1=Feb, Q2=May, Q3=Aug, Q4=Nov
    const midMonth = (quarter - 1) * 3 + 1;
    return new Date(year, midMonth, 15);
  }

  // "Month Year": "Mar 2025", "April 2024"
  const monthYearMatch = s.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (monthYearMatch) {
    const month = MONTH_MAP[monthYearMatch[1].toLowerCase()];
    if (month !== undefined) {
      return new Date(parseInt(monthYearMatch[2], 10), month, 15);
    }
  }

  // "Day Month Year": "22 Jan 2025", "5 March 2024"
  const dayMonthYearMatch = s.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (dayMonthYearMatch) {
    const month = MONTH_MAP[dayMonthYearMatch[2].toLowerCase()];
    if (month !== undefined) {
      return new Date(
        parseInt(dayMonthYearMatch[3], 10),
        month,
        parseInt(dayMonthYearMatch[1], 10)
      );
    }
  }

  // "Month Day, Year": "Jan 22, 2025", "March 5, 2024"
  const monthDayYearMatch = s.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (monthDayYearMatch) {
    const month = MONTH_MAP[monthDayYearMatch[1].toLowerCase()];
    if (month !== undefined) {
      return new Date(
        parseInt(monthDayYearMatch[3], 10),
        month,
        parseInt(monthDayYearMatch[2], 10)
      );
    }
  }

  // Year only: "2025"
  const yearOnlyMatch = s.match(/^(\d{4})$/);
  if (yearOnlyMatch) {
    return new Date(parseInt(yearOnlyMatch[1], 10), 6, 1); // Mid-year
  }

  // Try native Date.parse as fallback for ISO-style dates
  const parsed = Date.parse(s);
  if (!isNaN(parsed)) {
    return new Date(parsed);
  }

  return null;
}

/**
 * Classify a trigger date into a recency level relative to currentDate.
 */
export function calculateRecencyLevel(
  triggerDate: Date,
  currentDate: Date = new Date()
): RecencyLevel {
  const diffMs = currentDate.getTime() - triggerDate.getTime();
  const monthsOld = diffMs / (1000 * 60 * 60 * 24 * 30.44);

  if (monthsOld < 6) return 'strong';
  if (monthsOld < 12) return 'supporting';
  return 'excluded';
}

/**
 * Calculate months old for a trigger date.
 */
function getMonthsOld(triggerDate: Date, currentDate: Date): number {
  const diffMs = currentDate.getTime() - triggerDate.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24 * 30.44));
}

/**
 * Filter and annotate triggers by recency, excluding anything older than 12 months
 * or with an unparseable date.
 */
export function filterAndAnnotateTriggers(
  triggers: AccountTrigger[],
  currentDate: Date = new Date()
): RecencyAnnotatedTrigger[] {
  return triggers
    .map((trigger) => {
      const parsed = parseTriggerDate(trigger.dateLabel);
      if (!parsed) {
        return { ...trigger, recencyLevel: 'excluded' as RecencyLevel, monthsOld: undefined };
      }
      const level = calculateRecencyLevel(parsed, currentDate);
      return {
        ...trigger,
        recencyLevel: level,
        monthsOld: getMonthsOld(parsed, currentDate),
      };
    })
    .filter((t) => t.recencyLevel !== 'excluded');
}
