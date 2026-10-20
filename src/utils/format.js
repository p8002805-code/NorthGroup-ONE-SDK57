export const safe = (value) => {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  if (value === null || value === undefined || value === '') return '-';
  return String(value);
};

export const fileSafe = (value) => {
  return safe(value)
    .replace(/[^a-z0-9_\- ]/gi, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
};

export const dateForFilename = (value) => {
  const cleaned = safe(value).replace(/[^0-9]/g, '');

  if (cleaned.length === 8) {
    const day = cleaned.slice(0, 2);
    const month = cleaned.slice(2, 4);
    const year = cleaned.slice(4, 8);
    return `${year}-${month}-${day}`;
  }

  const fallbackDate = new Date().toISOString().slice(0, 10);
  const result = fileSafe(value);

  return result || fallbackDate;
};

export const compactDateForFilename = (value = new Date()) => {
  const pad = (number) => String(number).padStart(2, '0');
  const fromParts = (year, month, day) =>
    `${String(year).slice(-2)}${pad(month)}${pad(day)}`;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return fromParts(
      value.getFullYear(),
      value.getMonth() + 1,
      value.getDate(),
    );
  }

  const raw = String(value || '').trim();
  const ymd = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:\D|$)/);
  if (ymd) return fromParts(ymd[1], ymd[2], ymd[3]);

  const dmy = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\D|$)/);
  if (dmy) return fromParts(dmy[3], dmy[2], dmy[1]);

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return fromParts(
      parsed.getFullYear(),
      parsed.getMonth() + 1,
      parsed.getDate(),
    );
  }

  const now = new Date();
  return fromParts(now.getFullYear(), now.getMonth() + 1, now.getDate());
};

export const htmlRow = (label, value) => {
  return `
    <tr>
      <td class="label">${label}</td>
      <td>${safe(value)}</td>
    </tr>
  `;
};
