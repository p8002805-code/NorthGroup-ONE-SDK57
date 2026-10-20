import { compactDateForFilename, fileSafe } from '../utils/format';
import { resolveUserInitials } from '../utils/userInitials';

const cleanPart = (value, fallback = '') => {
  const raw = String(value || '').trim();
  const cleaned = raw ? fileSafe(raw) : '';
  return cleaned || fallback;
};

const formJobNumber = (form) => cleanPart(
  form?.jobNumber
    || form?.jobSnapshot?.number
    || form?.projectNumber,
  'Job',
);

const formDate = (form) => compactDateForFilename(
  String(form?.date || form?.startDate || '').trim() || new Date(),
);

const joinParts = (...parts) => parts
  .map((part) => String(part || '').trim())
  .filter(Boolean)
  .join('_');

export const formUserInitials = (form, initials = '') => resolveUserInitials({
  fullName: form?.employeeProfile?.fullName
    || form?.completedBy
    || form?.observer
    || form?.drivers,
  initials: initials || form?.employeeProfile?.initials,
});

const formExportSuffix = (form, userInitials = '') =>
  `${formDate(form)}${cleanPart(formUserInitials(form, userInitials), 'NG')}`;

export const buildFormExportName = ({
  form,
  formName,
  userInitials = '',
  extraParts = [],
} = {}) => `${joinParts(
  formJobNumber(form),
  cleanPart(formName, 'Form'),
  ...(Array.isArray(extraParts) ? extraParts : [extraParts])
    .map((part) => cleanPart(part, '')),
  formExportSuffix(form, userInitials),
)}.pdf`;

export const buildS500ExportName = (form, userInitials = '') => buildFormExportName({
  form,
  userInitials,
  formName: 'Pre-Start-Risk-Assessment',
});

export const buildOperationalExportName = (form, type, userInitials = '') => buildFormExportName({
  form,
  userInitials,
  formName: type === 's501'
    ? 'Vehicle-Pre-Start-Checklist'
    : 'Journey-Management-Plan',
});

const se14MarkId = (form) => {
  const mark = cleanPart(form?.markId, 'Mark');
  const compact = mark.replace(/[\s_-]+/g, '');

  if (/^\d+$/.test(compact)) return `PM${compact}`;

  const pmMatch = compact.match(/^PM(\d+)$/i);
  return pmMatch ? `PM${pmMatch[1]}` : mark;
};

export const buildSE14ExportName = (form, userInitials = '') => buildFormExportName({
  form,
  userInitials,
  formName: 'GNSS',
  extraParts: [
    se14MarkId(form),
    `Session-${cleanPart(form?.sessionNumber, '1')}`,
  ],
});
