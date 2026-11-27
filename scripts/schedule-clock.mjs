const localDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
});

export function dateInSaoPaulo(now) {
  const parts = Object.fromEntries(localDate.formatToParts(now).map(({ type, value }) => [type, value]));
  return [parts.year, parts.month, parts.day].join('-');
}

export function addDays(date, days) {
  const day = new Date(date);
  day.setUTCDate(day.getUTCDate() + days);
  return day.toISOString().slice(0, 10);
}

export function weekStart(date) {
  const weekday = new Date(date).getUTCDay();
  return addDays(date, -((weekday + 6) % 7));
}
