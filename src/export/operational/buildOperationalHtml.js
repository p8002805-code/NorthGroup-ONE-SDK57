import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';

const NG_LOGO = require('../../../assets/ng_logo_white.png');
const TOPO_BANNER = require('../../../assets/topo-bg.png');

const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#039;').replace(/\n/g, '<br/>');

const imageAssetToBase64 = async (assetModule) => {
  try {
    const asset = Asset.fromModule(assetModule);
    await asset.downloadAsync();
    let uri = asset.localUri || asset.uri;
    if (!uri) return null;
    if (uri.startsWith('https://')) {
      const downloaded = await FileSystem.downloadAsync(uri, `${FileSystem.cacheDirectory}operational-export-asset`);
      uri = downloaded.uri;
    }
    return FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  } catch (_) {
    return null;
  }
};

const styles = `
  @page { size: A4 portrait; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; width: 210mm; background: #061A2D; }
  body { font-family: Arial, Helvetica, sans-serif; color: #061A2D; font-size: 8px; line-height: 1.1; }
  .page { width: 210mm; padding: 4mm; background: #061A2D; position: relative; overflow: hidden; }
  .header { border: 1.4px solid #D6A84F; background: #FFFFFF; overflow: hidden; margin-bottom: 3px; }
  .brand-row { height: 12mm; padding: 3px 9px; background: #061A2D; border-bottom: 1.4px solid #D6A84F; display: grid; grid-template-columns: 32% 68%; align-items: center; }
  .logo { display: block; width: 43mm; max-height: 9mm; object-fit: contain; object-position: left center; }
  .brand-fallback { color: #FFFFFF; font-size: 10px; font-weight: 900; letter-spacing: 1px; }
  .tagline { text-align: right; color: #FFFFFF; font-size: 7.4px; font-style: italic; }
  .doc-row { display: grid; grid-template-columns: 24% 56% 20%; background: #FFFFFF; }
  .doc-cell { min-height: 8mm; padding: 3px 5px; border-right: 1.3px solid #061A2D; display: flex; align-items: center; justify-content: center; text-align: center; font-weight: 800; }
  .doc-cell:last-child { border-right: 0; }
  .doc-title { font-size: 13px; line-height: 1; font-weight: 900; }
  .topo-banner { height: 8mm; border: 1.2px solid #D6A84F; overflow: hidden; margin-bottom: 3px; background: #061A2D; }
  .topo-banner img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: center; }
  .meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 3px; margin-bottom: 3px; }
  .field { border: 1.2px solid #061A2D; display: grid; grid-template-columns: 42% 58%; min-height: 8mm; background: #FFFFFF; }
  .label { background: #A9D3F0; border-right: 1.2px solid #061A2D; padding: 4px; font-size: 7.2px; font-weight: 900; display: flex; align-items: center; }
  .value { padding: 4px 5px; font-size: 8.3px; font-weight: 700; display: flex; align-items: center; background: #FFFFFF; overflow-wrap: anywhere; }
  .section-title { background: #A9D3F0; border: 1.2px solid #061A2D; padding: 2px 5px; text-align: center; font-size: 8.5px; font-weight: 900; text-transform: uppercase; letter-spacing: .45px; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; background: #FFFFFF; }
  th { background: #A9D3F0; border: 1.1px solid #061A2D; padding: 2px 3px; text-align: center; font-size: 7px; font-weight: 900; }
  td { border: 1.1px solid #061A2D; padding: 1.45px 3px; vertical-align: middle; height: 7.55mm; font-size: 7.15px; line-height: 1.05; }
  tr:nth-child(even) td { background: #F7FBFE; }
  .number { width: 7mm; text-align: center; font-weight: 900; }
  .item { width: 84mm; font-weight: 700; }
  .status { width: 22mm; text-align: center; font-weight: 900; letter-spacing: .2px; }
  .remarks { width: auto; color: #31485A; }
  .ok { color: #0B6B2A; background: #EAF6EE !important; }
  .fault { color: #B00020; background: #FFF0F1 !important; }
  .completion { display: grid; grid-template-columns: 1fr 1fr; gap: 3px; margin-top: 3px; }
  .signature-value { font-size: 14px; line-height: 1; font-style: italic; }
  .footer { margin-top: 3px; padding: 3px 2px 0; border-top: 1px solid #D6A84F; color: #FFFFFF; display: grid; grid-template-columns: 1fr 1fr 1fr; font-size: 6.6px; }
  .footer span:nth-child(2) { text-align: center; }
  .footer span:last-child { text-align: right; }
  .journey-meta { grid-template-columns: repeat(3, 1fr); }
  .journey-meta .field { min-height: 10mm; }
  .journey-review { display: grid; grid-template-columns: 1fr 1fr; border-left: 1.2px solid #061A2D; border-top: 1.2px solid #061A2D; background: #FFFFFF; }
  .risk { min-height: 10mm; border-right: 1.2px solid #061A2D; border-bottom: 1.2px solid #061A2D; display: grid; grid-template-columns: 1fr 20mm; align-items: stretch; }
  .risk-label { padding: 4px 6px; display: flex; align-items: center; font-size: 8px; font-weight: 700; }
  .answer { border-left: 1.2px solid #061A2D; background: #FFF3CD; color: #061A2D; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 8px; }
  .notes { border: 1.2px solid #061A2D; border-top: 0; background: #FFFFFF; min-height: 18mm; padding: 5px 6px; font-size: 8px; white-space: normal; }
`;

const documentHeader = (logoBase64, bannerBase64, code, title, issueDate) => `
  <div class="header">
    <div class="brand-row">
      ${logoBase64 ? `<img class="logo" src="data:image/png;base64,${logoBase64}"/>` : '<div class="brand-fallback">NORTHGROUP CONSULTING</div>'}
      <div class="tagline">Creating exceptional value in delivering Surveying, Scanning &amp; Town Planning Solutions</div>
    </div>
    <div class="doc-row">
      <div class="doc-cell">Document: ${escapeHtml(code)}</div>
      <div class="doc-cell doc-title">${escapeHtml(title)}</div>
      <div class="doc-cell">Issue Date:<br/>${escapeHtml(issueDate)}</div>
    </div>
  </div>
  <div class="topo-banner">${bannerBase64 ? `<img src="data:image/jpeg;base64,${bannerBase64}"/>` : ''}</div>`;

const field = (label, value) => `<div class="field"><div class="label">${escapeHtml(label)}</div><div class="value">${escapeHtml(value) || '&nbsp;'}</div></div>`;
const signatureFontFamily = (style) => {
  if (['signature', 'signature1'].includes(style)) return "'Snell Roundhand', 'Brush Script MT', cursive";
  if (['handwritten', 'signature2'].includes(style)) return "'Noteworthy', 'Segoe Print', cursive";
  if (['classic', 'signature3'].includes(style)) return "Georgia, 'Times New Roman', serif";
  return 'Arial, Helvetica, sans-serif';
};
const signatureField = (label, value, style) => `
  <div class="field">
    <div class="label">${escapeHtml(label)}</div>
    <div
      class="value signature-value"
      style="font-family:${signatureFontFamily(style)};${style === 'original' || style === 'plain' ? 'font-size:11px;' : ''}"
    >${escapeHtml(value) || '&nbsp;'}</div>
  </div>`;
const footer = (code) => `<div class="footer"><span>NorthGroup Consulting</span><span>Digitally completed in NorthGroup One</span><span>${escapeHtml(code)} · Page 1 of 1</span></div>`;

const shell = (content) => `<!doctype html><html><head><meta charset="utf-8"><style>${styles}</style></head><body><div class="page">${content}</div></body></html>`;

export const buildS501Html = async (form) => {
  const [logo, banner] = await Promise.all([imageAssetToBase64(NG_LOGO), imageAssetToBase64(TOPO_BANNER)]);
  const rows = (form.checks || []).map((item, index) => {
    const ok = item.status === 'OK';
    return `<tr><td class="number">${index + 1}</td><td class="item">${escapeHtml(item.label)}</td><td class="status ${ok ? 'ok' : 'fault'}">${escapeHtml(item.status)}</td><td class="remarks">${escapeHtml(item.remarks) || '&nbsp;'}</td></tr>`;
  }).join('');
  return shell(`
    ${documentHeader(logo, banner, 'S-501 Rev3', 'Light Vehicle Pre-Start Checklist', '14/07/2026')}
    <div class="meta">${field('Date', form.date)}${field('Vehicle Make', form.vehicleMake)}${field('Registration', form.registration)}${field('Odometer', form.odometer)}</div>
    <div class="section-title">Vehicle Checklist</div>
    <table><colgroup><col style="width:7mm"><col style="width:84mm"><col style="width:22mm"><col></colgroup><thead><tr><th>#</th><th>Inspection Item</th><th>Status</th><th>Remarks / Fault</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="completion">${signatureField('Completed By', form.employeeProfile?.signature || form.completedBy, form.employeeProfile?.signatureStyle)}${field('Completion Date', form.date)}</div>
    ${footer('S-501 Rev3')}
  `);
};

export const buildS506Html = async (form) => {
  const [logo, banner] = await Promise.all([imageAssetToBase64(NG_LOGO), imageAssetToBase64(TOPO_BANNER)]);
  const risks = Object.entries(form.risks || {}).map(([label, value]) => `<div class="risk"><div class="risk-label">${escapeHtml(label)}</div><div class="answer">${escapeHtml(value)}</div></div>`).join('');
  return shell(`
    ${documentHeader(logo, banner, 'S-506 Rev3', 'Journey Management Plan', '14/07/2026')}
    <div class="meta journey-meta">${field('Date', form.date)}${field('Job Number', form.jobNumber)}${field('Vehicle Registration', form.vehicleRegistration)}${field('Driver(s)', form.drivers)}${field('Buddy Contact', form.buddyContact)}${field('Purpose of Travel', form.purpose)}${field('Kilometres - One Way', form.kilometresOneWay)}${field('Destination', form.destination)}${field('Driver + Passenger Initials', form.travellers)}${field('Departure From', form.departureFrom)}${field('Expected Departure', form.expectedDepartureTime)}${field('Expected Arrival', form.expectedArrivalTime)}</div>
    <div class="section-title">Journey Review</div><div class="journey-review">${risks}</div>
    <div class="section-title">Other Conditions / Arrangements</div><div class="notes">${escapeHtml(form.other) || '&nbsp;'}</div>
    ${footer('S-506 Rev3')}
  `);
};
