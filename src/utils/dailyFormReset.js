export const getLocalDateKey = (date = new Date()) => {
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) return '';
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getS500DateKey = (value) => {
  const match = String(value || '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : '';
};

export const isS500FormFromDate = (form, date = new Date()) => (
  Boolean(form) && getS500DateKey(form.date) === getLocalDateKey(date)
);

export const operationalFormForToday = (form, date = new Date()) => (
  Boolean(form)
  && String(form.workDateKey || getS500DateKey(form.date)) === getLocalDateKey(date)
);

export const stampOperationalForm = (form, date = new Date()) => ({
  ...form,
  workDateKey: getLocalDateKey(date),
});
