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

export const htmlRow = (label, value) => {
  return `
    <tr>
      <td class="label">${label}</td>
      <td>${safe(value)}</td>
    </tr>
  `;
};
