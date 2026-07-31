import * as FileSystem from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';

const NG_LOGO = require('../../../assets/ng_logo_white.png');
const TOPO_BANNER = require('../../../assets/topo-bg.png');
const MEASUREMENT_DIAGRAM = require('../../../assets/se14-measurement-diagram.png');

const START_PHOTOS = [
  ['photoStartMarkId', '1. Mark ID'],
  ['photoStartReceiverSerial', '2. Receiver serial number'],
  ['photoStartHeightMeasurement', '3. Height measurement'],
  ['photoStartBubble', '4. Bubble'],
  ['photoStartPlummet', '5. Plummet (optional)'],
  ['photoStartObstructions', '6. Obstructions'],
];

const END_PHOTOS = [
  ['photoEndMarkId', '7. Mark ID'],
  ['photoEndHeightMeasurement', '8. Height measurement'],
];

const safe = (value) => {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
};

const escapeHtml = (value) =>
  safe(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\n/g, '<br/>');

const uriToDataUri = async (uri, mimeType = 'image/jpeg') => {
  if (!uri) return null;
  try {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    console.log('Could not load SE-14 export image:', error);
    return null;
  }
};

const assetToDataUri = async (assetModule, mimeType) => {
  try {
    const asset = Asset.fromModule(assetModule);
    await asset.downloadAsync();
    return uriToDataUri(asset.localUri || asset.uri, mimeType);
  } catch (error) {
    console.log('Could not load SE-14 export asset:', error);
    return null;
  }
};

const field = (label, value, wide = false) => `
  <div class="field ${wide ? 'wide' : ''}">
    <div class="field-label">${escapeHtml(label)}</div>
    <div class="field-value">${escapeHtml(value)}</div>
  </div>`;

const check = (label, answer) => `
  <div class="check-row">
    <span class="check-answer ${answer === true ? 'yes' : answer === false ? 'no' : ''}">${
      answer === true ? 'YES' : answer === false ? 'NO' : '—'
    }</span>
    <span>${escapeHtml(label)}</span>
  </div>`;

const formatCapturedAt = (value) => {
  if (!value) return 'Capture time unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-AU', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

const header = (logo, banner, pageLabel) => `
  <header class="header">
    <div class="brand-row">
      ${logo ? `<img class="logo" src="${logo}" />` : '<b>NorthGroup Consulting</b>'}
      <span>Engineering • Surveying • Spatial</span>
    </div>
    <div class="title-row">
      <b>SE-14</b>
      <h1>GNSS Single Static Session Observation Record</h1>
      <b>${escapeHtml(pageLabel)}</b>
    </div>
  </header>
  ${banner ? `<div class="topo"><img src="${banner}" /></div>` : ''}`;

const footer = (se14, page) => `
  <footer>${escapeHtml(se14.projectNumber || 'Project')} • ${escapeHtml(
    se14.markId || 'Mark'
  )} • Session ${escapeHtml(se14.sessionNumber || '—')} <span>Page ${page} of 4</span></footer>`;

const photoCard = (photo, large = false) => `
  <article class="photo-card ${large ? 'large' : ''}">
    <h3>${escapeHtml(photo.label)}</h3>
    <div class="photo-frame">
      ${photo.dataUri ? `<img src="${photo.dataUri}" />` : '<div class="missing">No photo captured</div>'}
    </div>
    <div class="photo-meta">
      <strong>${escapeHtml(photo.markId || 'No Mark ID')}</strong>
      <span>Session ${escapeHtml(photo.sessionNumber || '—')}</span>
      <span>${escapeHtml(formatCapturedAt(photo.capturedAt))}</span>
    </div>
  </article>`;

const loadPhotos = async (se14, definitions) => {
  const photos = [];
  for (const [key, label] of definitions) {
    const source = se14[key] || {};
    photos.push({
      ...source,
      label,
      dataUri: source.uri ? await uriToDataUri(source.uri) : null,
      markId: source.markId || se14.markId,
      sessionNumber: source.sessionNumber || se14.sessionNumber,
    });
  }
  return photos;
};

export const buildSE14Html = async (se14) => {
  const [logo, banner, diagram, startPhotos, endPhotos] = await Promise.all([
    assetToDataUri(NG_LOGO, 'image/png'),
    assetToDataUri(TOPO_BANNER, 'image/jpeg'),
    assetToDataUri(MEASUREMENT_DIAGRAM, 'image/png'),
    loadPhotos(se14, START_PHOTOS),
    loadPhotos(se14, END_PHOTOS),
  ]);

  const receiver = [se14.receiverModel, se14.receiverSerial].filter(Boolean).join(' / ');

  return `<!DOCTYPE html>
  <html><head><meta charset="utf-8" /><style>
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    html, body { margin: 0; padding: 0; background: #fff; color: #061A2D; font-family: Arial, Helvetica, sans-serif; }
    body { width: 100%; }
    .page { padding: 5mm 7mm 8mm; background: #fff; position: relative; page-break-after: always; break-after: page; }
    .page:last-child { page-break-after: auto; break-after: auto; }
    .header { border: 1.2px solid #D6A84F; overflow: hidden; }
    .brand-row { height: 11mm; padding: 2mm 4mm; background: #061A2D; color: #fff; display: flex; align-items: center; justify-content: space-between; font-size: 7.5px; }
    .logo { width: 43mm; max-height: 8mm; object-fit: contain; object-position: left center; }
    .title-row { min-height: 11mm; display: grid; grid-template-columns: 18% 64% 18%; align-items: center; text-align: center; }
    .title-row > * { margin: 0; padding: 1.7mm; border-right: 1px solid #061A2D; }
    .title-row > *:last-child { border-right: 0; }
    .title-row h1 { font-size: 13px; line-height: 1.12; }
    .title-row b { font-size: 9px; }
    .title-row b:first-child { color: #D6A84F; background: #09233C; align-self: stretch; display: flex; align-items: center; justify-content: center; }
    .topo { height: 8mm; margin: 1.5mm 0; overflow: hidden; border: 1px solid #D6A84F; }
    .topo img { width: 100%; height: 100%; object-fit: cover; }
    .section-title { margin-top: 1.6mm; padding: 1.6mm 2.5mm; background: #09233C; color: #D6A84F; font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: .3px; border-left: 3px solid #D6A84F; }
    .field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1mm; margin-top: 1mm; }
    .field { min-height: 8.5mm; border: .8px solid #73808d; display: grid; grid-template-columns: 41% 59%; background: #fff; }
    .field.wide { grid-column: 1 / -1; }
    .field-label { padding: 1.7mm; background: #e7f1f8; border-right: .8px solid #73808d; font-size: 8.5px; font-weight: 800; }
    .field-value { padding: 1.7mm; font-size: 9.5px; font-weight: 600; overflow-wrap: anywhere; }
    .two-col { display: grid; grid-template-columns: 1.36fr .64fr; gap: 2mm; align-items: start; }
    .diagram { width: 100%; height: 60mm; object-fit: contain; border: .8px solid #b8c4d0; margin-top: 1mm; }
    .note { margin-top: 1mm; padding: 1.5mm 2mm; background: #fff8e8; border: .8px solid #D6A84F; font-size: 8.5px; line-height: 1.3; }
    .check-grid { display: grid; grid-template-columns: repeat(3, 1fr); border: .8px solid #73808d; border-right: 0; margin-top: 1mm; }
    .check-row { min-height: 8.5mm; padding: 1.4mm; border-right: .8px solid #73808d; display: flex; align-items: center; gap: 1.5mm; font-size: 8.5px; font-weight: 700; }
    .check-answer { flex: 0 0 9mm; min-width: 9mm; min-height: 4.8mm; border: .8px solid #73808d; border-radius: 2mm; display: inline-flex; align-items: center; justify-content: center; color: #64748b; font-size: 7px; font-weight: 900; }
    .check-answer.yes { background: #16753a; border-color: #16753a; color: #fff; }
    .check-answer.no { background: #b42318; border-color: #b42318; color: #fff; }
    .comments { min-height: 22mm; border: .8px solid #73808d; padding: 2mm; font-size: 9px; line-height: 1.35; }
    .photo-grid { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: repeat(3, 1fr); gap: 2mm; margin-top: 1.5mm; }
    .end-grid { display: grid; grid-template-rows: 1fr 1fr; gap: 3mm; margin-top: 1.5mm; }
    .photo-card { border: 1px solid #D6A84F; padding: 1.2mm; background: #fff; break-inside: avoid; }
    .photo-card h3 { margin: 0 0 1mm; font-size: 9px; }
    .photo-frame { height: 46mm; border: .8px solid #73808d; background: #eef2f5; overflow: hidden; display: flex; align-items: center; justify-content: center; }
    .photo-card.large .photo-frame { height: 76mm; }
    .photo-frame img { width: 100%; height: 100%; object-fit: contain; }
    .missing { color: #7b8791; font-size: 9px; font-weight: 700; }
    .photo-meta { padding: 1.2mm 1.5mm; background: #09233C; color: #fff; display: flex; justify-content: space-between; gap: 2mm; font-size: 7px; }
    .photo-meta strong { color: #D6A84F; }
    footer { margin-top: 2mm; padding-top: 1mm; border-top: .6px solid #b8c4d0; font-size: 7px; color: #64727f; }
    footer span { float: right; }
  </style></head><body>

  <section class="page">
    ${header(logo, banner, 'Start Details')}
    <div class="section-title">Project Details</div>
    <div class="field-grid">
      ${field('Project Number', se14.projectNumber)} ${field('Observer', se14.observer)}
      ${field('Mark ID', se14.markId)} ${field('Mark Type', se14.markType)}
      ${field('Session Number', se14.sessionNumber)} ${field('Receiver / S/N', receiver)}
    </div>
    <div class="two-col"><div>
      <div class="section-title">Session Start</div>
      <div class="field-grid">
        ${field('Start Date', se14.startDate)} ${field('Start Time', se14.startTime)}
        ${field('Height (HMP)', se14.hmpStart)} ${field('Measured To', se14.measuredToStart)}
        ${field('Height (BQR)', se14.bqrStart)} ${field('ARP–BQR Check', se14.arpBqr)}
      </div>
      <div class="note"><b>HMP:</b> Height Measurement Point<br/><b>BQR:</b> Bottom of Quick Release<br/><b>ARP:</b> Antenna Reference Point<br/><b>Required tolerance:</b> ARP–BQR within ±0.005 m</div>
    </div><div>
      <div class="section-title">Height Guide</div>
      ${diagram ? `<img class="diagram" src="${diagram}" />` : ''}
    </div></div>
    <div class="section-title">Start Setup Checklist</div>
    <div class="check-grid">${check('Levelled & centred', se14.levelledStart)}${check('Antenna oriented north', se14.antennaNorth)}${check('External power connected', se14.externalPower)}</div>
    <div class="section-title">Start Photo Checklist</div>
    <div class="check-grid">${START_PHOTOS.slice(0, 3).map(([key, label]) => check(label, !!se14[key]?.uri)).join('')}</div>
    <div class="check-grid">${START_PHOTOS.slice(3).map(([key, label]) => check(label, !!se14[key]?.uri)).join('')}</div>
    ${footer(se14, 1)}
  </section>

  <section class="page">
    ${header(logo, banner, 'Session End')}
    <div class="section-title">Session End</div>
    <div class="field-grid">
      ${field('End Date', se14.endDate)} ${field('End Time', se14.endTime)}
      ${field('Height (HMP)', se14.hmpEnd)} ${field('Measured To', se14.measuredToEnd)}
    </div>
    <div class="note"><b>HMP:</b> Height Measurement Point</div>
    <div class="section-title">End Setup Checklist</div>
    <div class="check-grid">${check('Levelled & centred', se14.levelledEnd)}${check('Power still on', se14.powerStillOn)}${check('Mark ID confirmed', se14.markConfirmed)}</div>
    <div class="section-title">End Photo Checklist</div>
    <div class="check-grid">${END_PHOTOS.map(([key, label]) => check(label, !!se14[key]?.uri)).join('')}${check('Photo evidence attached', END_PHOTOS.some(([key]) => !!se14[key]?.uri))}</div>
    <div class="section-title">Comments & Notes</div>
    <div class="comments">${escapeHtml(se14.comments)}</div>
    ${footer(se14, 2)}
  </section>

  <section class="page">
    ${header(logo, banner, 'Start Photos')}
    <div class="section-title">Start Photo Evidence</div>
    <div class="photo-grid">${startPhotos.map((photo) => photoCard(photo)).join('')}</div>
    ${footer(se14, 3)}
  </section>

  <section class="page">
    ${header(logo, banner, 'End Photos')}
    <div class="section-title">End Photo Evidence</div>
    <div class="end-grid">${endPhotos.map((photo) => photoCard(photo, true)).join('')}</div>
    ${footer(se14, 4)}
  </section>
  </body></html>`;
};
