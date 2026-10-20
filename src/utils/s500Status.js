import { S500_PPE_ITEMS } from '../constants/s500PpeItems';
import {
  S500_BASE_HAZARD_COUNT,
  S500_HAZARD_ROWS,
  S500_MAX_HAZARD_COUNT,
} from '../constants/s500HazardRows';
import { emptyS500 } from '../data/emptyForms';
import { profileFullName } from '../features/account/accountProfile';

const S500_DRAFT_META_KEYS = new Set([
  'jobNumber',
  'completedBy',
  'hazardRowCount',
  'deletedHazardRows',
  'deletedPpeKeys',
  'customPpeItems',
]);

export const hasMeaningfulS500Draft = (form) => (
  Boolean(form) && Object.keys(emptyS500).some((key) => {
    if (S500_DRAFT_META_KEYS.has(key)) return false;

    const value = form?.[key];
    const baseline = emptyS500[key];
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'boolean') return value && value !== baseline;
    return String(value ?? '').trim() !== String(baseline ?? '').trim();
  })
);

const isHazardPopulated = (form, row) => !!(
  String(form?.[row.hazardKey] || '').trim()
  || String(form?.[row.controlKey] || '').trim()
  || form?.[row.pKey]
  || form?.[row.cKey]
  || form?.[row.rKey]
);

export const isS500Complete = (form, accountProfile) => {
  if (!form) return false;

  const deletedHazardRows = Array.isArray(form.deletedHazardRows)
    ? form.deletedHazardRows
    : [];
  const customPpeItems = Array.isArray(form.customPpeItems)
    ? form.customPpeItems
    : [];
  const highestUsedHazard = S500_HAZARD_ROWS.reduce((highest, row, index) => (
    isHazardPopulated(form, row) ? index + 1 : highest
  ), 0);
  const visibleHazardCount = Math.min(
    S500_MAX_HAZARD_COUNT,
    Math.max(
      S500_BASE_HAZARD_COUNT,
      Number(form.hazardRowCount) || 0,
      highestUsedHazard
    )
  );
  const visibleHazardRows = S500_HAZARD_ROWS
    .slice(0, visibleHazardCount)
    .filter((row) => !deletedHazardRows.includes(row.number));
  const populatedHazards = visibleHazardRows.filter((row) => isHazardPopulated(form, row));
  const pendingHazardDecisions = populatedHazards.filter((row) => (
    form[row.includeKey] !== true && form[row.includeKey] !== false
  ));
  const incompleteYesHazards = populatedHazards.filter((row) => (
    form[row.includeKey] === true && (
      !String(form[row.hazardKey] || '').trim()
      || !String(form[row.controlKey] || '').trim()
      || !form[row.pKey]
      || !form[row.cKey]
      || !form[row.rKey]
    )
  ));
  const selectedPpe = S500_PPE_ITEMS.filter((item) => !!form[item.key]).length
    + customPpeItems.filter((item) => item.selected && String(item.label || '').trim()).length;

  return Boolean(
    form.date
    && form.jobNumber
    && (form.wmsRequired === true || form.wmsRequired === false)
    && (form.wmsRequired !== true || form.wmsSigned === true || form.wmsSigned === false)
    && form.activity
    && populatedHazards.length > 0
    && pendingHazardDecisions.length === 0
    && incompleteYesHazards.length === 0
    && selectedPpe > 0
    && profileFullName(accountProfile)
  );
};
