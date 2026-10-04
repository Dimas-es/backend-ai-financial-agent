export function getFinancialPeriod(date: Date = new Date(), cycleStartDay: number = 25) {
  const currentDay = date.getDate();
  const currentMonth = date.getMonth();
  const currentYear = date.getFullYear();

  if (currentDay >= cycleStartDay) {
    if (currentMonth === 11) {
      return { month: 1, year: currentYear + 1 };
    } else {
      return { month: currentMonth + 2, year: currentYear };
    }
  } else {
    return { month: currentMonth + 1, year: currentYear };
  }
}

export function getFinancialDateRange(financialMonth: number, financialYear: number, cycleStartDay: number = 25) {
  let startMonth = financialMonth - 2;
  let startYear = financialYear;
  
  if (startMonth < 0) {
    startMonth = 11;
    startYear -= 1;
  }
  
  const startDate = new Date(startYear, startMonth, cycleStartDay, 0, 0, 0, 0);
  
  let endMonth = financialMonth - 1;
  let endYear = financialYear;
  
  // End date is one day before the next cycle start
  // Note: if cycleStartDay is 1, then cycleStartDay - 1 is 0. 
  // new Date(year, month, 0) gives the last day of the PREVIOUS month.
  // So if financialMonth is 2 (Feb), endMonth is 1 (Feb 0-indexed).
  // If cycleStartDay = 1, end is new Date(endYear, endMonth, 0) -> Jan 31st.
  // Wait, if cycleStartDay is 1, startMonth is 0 (Jan). startDate is Jan 1st.
  // endDate should be Jan 31st.
  // endMonth is 1 (Feb). new Date(endYear, 1, 0) is Jan 31st. This logic works perfectly for any day!
  const endDate = new Date(endYear, endMonth, cycleStartDay - 1, 23, 59, 59, 999);
  
  return { startDate, endDate };
}
