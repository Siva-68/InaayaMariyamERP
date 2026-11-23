/**
 * Asia/Kolkata timezone utilities for HINAYA MARIYAM ERP.
 * Standard Indian business day runs from 00:00:00 to 23:59:59.999 IST (UTC +05:30).
 */

const IST_OFFSET_MINUTES = 330; // +05:30 = 330 minutes

/**
 * Returns a Date object shifted to IST components
 */
export function getIstDate(date: Date = new Date()): Date {
  const utc = date.getTime() + date.getTimezoneOffset() * 60000;
  return new Date(utc + IST_OFFSET_MINUTES * 60000);
}

/**
 * Returns UTC Date representing start of day (00:00:00.000) in Asia/Kolkata
 */
export function getStartOfDayIst(date: Date = new Date()): Date {
  const ist = getIstDate(date);
  const year = ist.getFullYear();
  const month = ist.getMonth();
  const day = ist.getDate();

  // Create Date at midnight IST: (year, month, day, 0, 0, 0, 0 IST)
  // In UTC, this is midnight minus 5h 30m
  const utcMidnight = Date.UTC(year, month, day, 0, 0, 0, 0) - IST_OFFSET_MINUTES * 60000;
  return new Date(utcMidnight);
}

/**
 * Returns UTC Date representing end of day (23:59:59.999) in Asia/Kolkata
 */
export function getEndOfDayIst(date: Date = new Date()): Date {
  const ist = getIstDate(date);
  const year = ist.getFullYear();
  const month = ist.getMonth();
  const day = ist.getDate();

  const utcEndOfDay = Date.UTC(year, month, day, 23, 59, 59, 999) - IST_OFFSET_MINUTES * 60000;
  return new Date(utcEndOfDay);
}

/**
 * Returns UTC Date range [start, end] for a given period preset in Asia/Kolkata
 */
export function getPeriodRange(
  period: 'today' | 'yesterday' | 'week' | 'month' | 'custom',
  customStart?: string,
  customEnd?: string
): { start: Date; end: Date; label: string } {
  const now = new Date();
  const istNow = getIstDate(now);

  if (period === 'today') {
    return {
      start: getStartOfDayIst(now),
      end: getEndOfDayIst(now),
      label: 'Today',
    };
  }

  if (period === 'yesterday') {
    const yesterdayIst = new Date(istNow);
    yesterdayIst.setDate(yesterdayIst.getDate() - 1);
    const start = new Date(
      Date.UTC(yesterdayIst.getFullYear(), yesterdayIst.getMonth(), yesterdayIst.getDate(), 0, 0, 0, 0) -
        IST_OFFSET_MINUTES * 60000
    );
    const end = new Date(
      Date.UTC(yesterdayIst.getFullYear(), yesterdayIst.getMonth(), yesterdayIst.getDate(), 23, 59, 59, 999) -
        IST_OFFSET_MINUTES * 60000
    );
    return { start, end, label: 'Yesterday' };
  }

  if (period === 'week') {
    // Current week starting from Monday in IST
    const dayOfWeek = istNow.getDay(); // 0 is Sunday, 1 is Monday
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const mondayIst = new Date(istNow);
    mondayIst.setDate(mondayIst.getDate() - diffToMonday);

    const start = new Date(
      Date.UTC(mondayIst.getFullYear(), mondayIst.getMonth(), mondayIst.getDate(), 0, 0, 0, 0) -
        IST_OFFSET_MINUTES * 60000
    );
    const end = getEndOfDayIst(now);
    return { start, end, label: 'This Week' };
  }

  if (period === 'month') {
    // 1st of current month in IST
    const start = new Date(
      Date.UTC(istNow.getFullYear(), istNow.getMonth(), 1, 0, 0, 0, 0) - IST_OFFSET_MINUTES * 60000
    );
    const end = getEndOfDayIst(now);
    return { start, end, label: 'This Month' };
  }

  // Custom date range
  if (customStart && customEnd) {
    const [sY, sM, sD] = customStart.split('-').map(Number);
    const [eY, eM, eD] = customEnd.split('-').map(Number);

    const start = new Date(Date.UTC(sY, sM - 1, sD, 0, 0, 0, 0) - IST_OFFSET_MINUTES * 60000);
    const end = new Date(Date.UTC(eY, eM - 1, eD, 23, 59, 59, 999) - IST_OFFSET_MINUTES * 60000);
    return { start, end, label: `${customStart} to ${customEnd}` };
  }

  // Default fallback to today
  return {
    start: getStartOfDayIst(now),
    end: getEndOfDayIst(now),
    label: 'Today',
  };
}

/**
 * Formats a date into Asia/Kolkata date string 'YYYY-MM-DD'
 */
export function formatIstDate(date: Date): string {
  const ist = getIstDate(date);
  const y = ist.getFullYear();
  const m = String(ist.getMonth() + 1).padStart(2, '0');
  const d = String(ist.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Formats a date into readable Asia/Kolkata string 'DD MMM YYYY, hh:mm A'
 */
export function formatIstDateTime(date: Date): string {
  const ist = getIstDate(date);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = String(ist.getDate()).padStart(2, '0');
  const month = months[ist.getMonth()];
  const year = ist.getFullYear();

  let hours = ist.getHours();
  const minutes = String(ist.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;

  return `${day} ${month} ${year}, ${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
}
