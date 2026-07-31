import * as FileSystem from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';

import { S500_PPE_ITEMS } from '../../constants/s500PpeItems';
import { S500_HAZARD_ROWS } from '../../constants/s500HazardRows';

const NG_LOGO = require('../../../assets/ng_logo_white.png');
const TOPO_BANNER = require('../../../assets/topo-bg.png');

const safe = (value) => {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  if (value === null || value === undefined || value === '') return '';
  return String(value);
};

const imageAssetToBase64 = async (assetModule) => {
  try {
    const asset = Asset.fromModule(assetModule);
    await asset.downloadAsync();

    let uri = asset.localUri || asset.uri;

    if (!uri) {
      return null;
    }

    if (uri.startsWith('http://') || uri.startsWith('https://')) {
      const downloadTarget = `${FileSystem.cacheDirectory}ng_logo_export.jpg`;
      const downloaded = await FileSystem.downloadAsync(uri, downloadTarget);
      uri = downloaded.uri;
    }

    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    return base64;
  } catch (error) {
    console.log('Could not load logo for PDF export:', error);
    return null;
  }
};

const escapeHtml = (value) => {
  return safe(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\n/g, '<br/>');
};


const signatureFontFamily = (style) => {
  if (['signature', 'signature1'].includes(style)) return "'Snell Roundhand', 'Brush Script MT', cursive";
  if (['handwritten', 'signature2'].includes(style)) return "'Noteworthy', 'Segoe Print', cursive";
  if (['classic', 'signature3'].includes(style)) return "Georgia, 'Times New Roman', serif";
  return "Arial, Helvetica, sans-serif";
};

const isPlainSignature = (style) => !style || style === 'original' || style === 'plain';

const yesNo = (value) => {
  return value ? '<span class="yes">YES</span>' : '<span class="no">NO</span>';
};

const tickBox = (checked) => {
  return checked
    ? '<span class="tick-box checked">X</span>'
    : '<span class="tick-box"></span>';
};
const riskClass = (value) => {
  const risk = Number(value);

  if (!risk) return '';

  if (risk >= 1 && risk <= 6) return 'risk-low';
  if (risk >= 7 && risk <= 9) return 'risk-moderate';
  if (risk >= 10 && risk <= 12) return 'risk-high';
  if (risk >= 13) return 'risk-acute';

  return '';
};
const ppeCell = (label, checked) => {
  return `
    <td>
      ${tickBox(checked)}
      <span>${escapeHtml(label)}</span>
    </td>
  `;
};
const ppeTableRows = (s500) => {
  const rows = [];
  const customPpeItems = (Array.isArray(s500.customPpeItems) ? s500.customPpeItems : [])
    .filter((item) => String(item.label || '').trim())
    .map((item) => ({
      key: item.id,
      label: item.label,
      customSelected: !!item.selected,
    }));
  const ppeItems = [
    ...S500_PPE_ITEMS,
    ...customPpeItems,
  ];

  for (let i = 0; i < ppeItems.length; i += 4) {
    const rowItems = ppeItems.slice(i, i + 4);

    while (rowItems.length < 4) {
      rowItems.push(null);
    }

    rows.push(`
      <tr>
        ${rowItems
          .map((item) => {
            if (!item) {
              return '<td></td>';
            }

            return ppeCell(item.label, item.customSelected ?? !!s500[item.key]);
          })
          .join('')}
      </tr>
    `);
  }

  return rows.join('');
};

const hazardRow = (hazard, control, applies, p, c, r) => {
  const rClass = riskClass(r);

  return `
    <tr>
      <td class="hazard-cell">${escapeHtml(hazard)}</td>
      <td class="control-cell">${escapeHtml(control)}</td>
      <td class="risk-cell applies-cell">${yesNo(applies)}</td>
      <td class="risk-cell">${escapeHtml(p)}</td>
      <td class="risk-cell">${escapeHtml(c)}</td>
      <td class="risk-cell risk-rating-cell ${rClass}">${escapeHtml(r)}</td>
    </tr>
  `;
};
const hazardTableRows = (s500) => {
  return S500_HAZARD_ROWS
    .filter((row) => String(s500[row.hazardKey] || '').trim() || String(s500[row.controlKey] || '').trim())
    .map((row) =>
      hazardRow(
        s500[row.hazardKey],
        s500[row.controlKey],
        s500[row.includeKey] === true,
        s500[row.pKey],
        s500[row.cKey],
        s500[row.rKey]
      )
    )
    .join('');
};
export const buildS500Html = async (s500) => {
  const wmsRequired = !!s500.wmsRequired;
  const wmsSigned = wmsRequired ? !!s500.wmsSigned : false;

  const logoBase64 = await imageAssetToBase64(NG_LOGO);
  const bannerBase64 = await imageAssetToBase64(TOPO_BANNER);

  const logoHtml = logoBase64
    ? `<img class="ng-logo" src="data:image/png;base64,${logoBase64}" />`
    : `<div class="brand">NorthGroup Consulting</div>`;

  const bannerHtml = bannerBase64
    ? `<img class="topo-banner-image" src="data:image/jpeg;base64,${bannerBase64}" />`
    : '';

  return `
    <html>
      <head>
        <style>
          @page {
            size: A4;
            margin: 0;
          }

          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          html {
            margin: 0;
            padding: 0;
            width: 210mm;
            min-height: 286mm;
            background-color: #061A2D;
          }

          body {
            margin: 0;
            padding: 0;
            width: 210mm;
            min-height: 297mm;
            font-family: Arial, Helvetica, sans-serif;
            color: #061A2D;
            font-size: 8.4px;
            line-height: 1.12;
            background-color: #061A2D;
          }

          .page-break {
            page-break-before: always;
          }
          .page {
            background-color: #061A2D;
            width: 210mm;
            padding: 4mm;
            position: relative;
            overflow: hidden;
          }
          .header {
            border: 1.5px solid #D6A84F;
            margin-bottom: 4px;
            overflow: hidden;
            background-color: #FFFFFF;
          }

          .brand-row {
            padding: 4px 10px 3px 10px;
            background-color: #061A2D;
            border-bottom: 1.5px solid #D6A84F;
            display: grid;
            grid-template-columns: 32% 68%;
            align-items: end;
          }

          .brand {
            font-size: 27px;
            line-height: 1;
            font-weight: 900;
            font-style: italic;
            color: #06325A;
            letter-spacing: -1px;
          }

          .ng-logo {
            display: block;
            width: 170px;
            height: auto;
            max-height: 32px;
            object-fit: contain;
            object-position: left center;
          }

          .tagline {
            text-align: right;
            font-size: 8.2px;
            font-style: italic;
            color: #FFFFFF;
            margin-top: 0;
            padding-bottom: 2px;
          }

          .doc-row {
            display: grid;
            grid-template-columns: 24% 56% 20%;
            background-color: #FFFFFF;
          }

          .doc-cell {
            padding: 4px 6px;
            border-right: 1.5px solid #061A2D;
            text-align: center;
            font-weight: 800;
            min-height: 24px;
            background-color: #FFFFFF;
            color: #061A2D;
          }

          .doc-cell:last-child {
            border-right: none;
          }

          .doc-title {
            font-size: 15px;
            line-height: 1.05;
            color: #061A2D;
          }
          .topo-banner {
            height: 11mm;
            margin-bottom: 4px;
            border: 1.2px solid #D6A84F;
            overflow: hidden;
            background-color: #061A2D;
          }

          .topo-banner-image {
            display: block;
            width: 100%;
            height: 100%;
            object-fit: cover;
            object-position: center center;
          }
          .top-grid {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 5px;
            margin-bottom: 4px;
          }

          .field-box {
            border: 1.5px solid #061A2D;
            display: grid;
            grid-template-columns: 39% 61%;
            min-height: 27px;
            background-color: #FFFFFF;
          }

          .field-label {
            background-color: #A9D3F0;
            border-right: 1.5px solid #061A2D;
            padding: 6px 6px;
            font-weight: 900;
            color: #061A2D;
          }

          .field-value {
            padding: 6px 7px;
            font-size: 10px;
            background-color: #FFFFFF;
          }

          .wms-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 5px;
            margin-bottom: 5px;
          }

          .wms-box {
            border: 1.5px solid #061A2D;
            display: grid;
            grid-template-columns: 42% 58%;
            min-height: 27px;
            background-color: #FFFFFF;
          }

          .wms-value {
            padding: 5px 8px;
            text-align: center;
            font-size: 11px;
            font-weight: 900;
            background-color: #F7FBFE;
          }

          .yes {
            display: inline-block;
            color: #0B6B2A;
            font-weight: 900;
            letter-spacing: 0.5px;
          }

          .no {
            display: inline-block;
            color: #B00020;
            font-weight: 900;
            letter-spacing: 0.5px;
          }

          table {
            width: 100%;
            border-collapse: collapse;
          }

          .hazard-table {
            table-layout: fixed;
            margin-bottom: 4px;
            border: 1.2px solid #061A2D;
            background-color: #FFFFFF;
          }

          .hazard-table th {
            background-color: #A9D3F0;
            border: 1.2px solid #061A2D;
            padding: 2.5px 2px;
            text-align: center;
            font-size: 7.3px;
            font-weight: 900;
            line-height: 1.05;
            color: #061A2D;
          }

          .hazard-table td {
            border: 1.2px solid #061A2D;
            padding: 2px 3px;
            vertical-align: top;
            height: 19px;
            font-size: 6.8px;
            line-height: 1.05;
            background-color: #FFFFFF;
          }

          .hazard-table tr:nth-child(even) td {
            background-color: #F7FBFE;
          }

          .hazard-cell {
            width: 20%;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 7px;
            font-weight: 700;
            line-height: 1.12;
            letter-spacing: 0.05px;
            color: #061A2D;
          }

          .yn-cell {
            width: 4.5%;
            text-align: center;
          }

          .control-cell {
            width: 54%;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 7px;
            font-weight: 400;
            line-height: 1.12;
            letter-spacing: 0.02px;
            color: #10283D;
          }

          .risk-cell {
            width: 5.6%;
            text-align: center;
            vertical-align: middle;
            font-family: Arial, Helvetica, sans-serif;
            font-weight: 700;
            font-size: 7.8px;
            line-height: 1;
            letter-spacing: 0.15px;
            background-color: #FFFFFF !important;
          }

          .applies-cell {
            white-space: nowrap;
          }

          .risk-rating-cell {
            color: #061A2D;
            font-weight: 900;
            font-size: 8.4px;
            letter-spacing: 0.2px;
          }

          .risk-low {
            background-color: #92D050 !important;
          }

          .risk-moderate {
            background-color: #FFFF00 !important;
          }

          .risk-high {
            background-color: #FFC000 !important;
          }

          .risk-acute {
            background-color: #FF0000 !important;
            color: #FFFFFF !important;
          }
          .section-title {
            background-color: #A9D3F0;
            border: 1.2px solid #061A2D;
            padding: 2.5px 6px;
            text-align: center;
            font-size: 9.5px;
            font-weight: 900;
            color: #061A2D;
          }

          .ppe-table {
            table-layout: fixed;
            margin-bottom: 8px;
            border: 1.5px solid #061A2D;
            background-color: #FFFFFF;
          }

          .ppe-table td {
            border: 1.2px solid #061A2D;
            padding: 2px 3.5px;
            width: 25%;
            height: 14px;
            vertical-align: middle;
            font-size: 7.2px;
            white-space: nowrap;
            background-color: #FFFFFF;
          }

          .ppe-table tr:nth-child(even) td {
            background-color: #F7FBFE;
          }

          .tick-box {
            display: inline-block;
            width: 9px;
            height: 9px;
            border: 1.1px solid #061A2D;
            margin-right: 3px;
            text-align: center;
            line-height: 8px;
            font-size: 7px;
            font-weight: 900;
            vertical-align: -1px;
            color: #061A2D;
            background-color: #FFFFFF;
          }

          .checked {
            background-color: #FFF3CD;
          }

          .complete-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 6px;
            margin-top: 4px;
          }

          .single-complete {
            grid-template-columns: 1fr;
          }

          .complete-box {
            border: 1.5px solid #061A2D;
            display: grid;
            grid-template-columns: 38% 62%;
            min-height: 29px;
            background-color: #FFFFFF;
          }

          .footer {
            margin-top: 4px;
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            font-size: 7px;
            color: #FFFFFF;
          }

          .center {
            text-align: center;
          }

          .right {
            text-align: right;
          }

          .page2 .header {
            margin-bottom: 12px;
          }

          .page2 h2 {
            margin: 10px 0 7px 0;
            font-size: 14px;
            color: #FFFFFF;
            border-bottom: 2px solid #D6A84F;
            padding-bottom: 3px;
            font-weight: 900;
          }

          .control-list {
            margin: 0 0 12px 22px;
            font-size: 11px;
            line-height: 1.45;
            color: #FFFFFF;
          }

          .control-list div {
            margin-bottom: 2.5px;
          }

          .instructions {
            font-size: 10.5px;
            line-height: 1.35;
            margin-top: 0;
            margin-bottom: 12px;
            color: #FFFFFF;
          }

          .instructions li {
            margin-bottom: 3px;
          }

          .matrix-title {
            text-align: center;
            font-size: 13px;
            font-weight: 900;
            margin: 7px 0 4px 0;
            color: #FFFFFF;
          }

          .matrix {
            table-layout: fixed;
            font-size: 7px;
            border: 1px solid #061A2D;
          }

          .matrix th,
          .matrix td {
            border: 1px solid #061A2D;
            padding: 2.8px 2px;
            text-align: center;
            vertical-align: middle;
          }

          .matrix th {
            font-weight: 900;
            background-color: #A9D3F0;
          }

          .matrix .side {
            background-color: #F7DFA6;
            font-weight: 900;
            width: 18%;
          }

          .matrix .rating {
            width: 7%;
            font-weight: 900;
            background-color: #F7DFA6;
          }

          .matrix .low {
            background-color: #92D050 !important;
          }

          .matrix .moderate {
            background-color: #FFFF00 !important;
          }

          .matrix .high {
            background-color: #FFC000 !important;
          }

          .matrix .acute {
            background-color: #FF0000 !important;
            color: #111111;
          }

          .legend {
            margin-top: 4px;
            table-layout: fixed;
            font-size: 7.2px;
          }

          .legend td {
            border: 1px solid #061A2D;
            padding: 3px;
            text-align: center;
            font-weight: 900;
          }

          .legend .low {
            background-color: #92D050 !important;
          }

          .legend .moderate {
            background-color: #FFFF00 !important;
          }

          .legend .high {
            background-color: #FFC000 !important;
          }

          .legend .acute {
            background-color: #FF0000 !important;
            color: #111111;
          }
        </style>
      </head>

      <body>
        <div class="page">
          <div class="header">
            <div class="brand-row">
              ${logoHtml}
              <div class="tagline">Creating exceptional value in delivering Surveying, Scanning &amp; Town Planning Solutions</div>
            </div>

            <div class="doc-row">
              <div class="doc-cell">Document: S-500 Rev11</div>
              <div class="doc-cell doc-title">Pre-Start Risk Assessment</div>
              <div class="doc-cell">Issue Date:<br/>07/07/2026</div>
            </div>
          </div>

          <div class="topo-banner">
            ${bannerHtml}
          </div>

          <div class="top-grid">
            <div class="field-box">
              <div class="field-label">Date:</div>
              <div class="field-value">${escapeHtml(s500.date)}</div>
            </div>

            <div class="field-box">
              <div class="field-label">Job number:</div>
              <div class="field-value">${escapeHtml(s500.jobNumber)}</div>
            </div>

            <div class="field-box">
              <div class="field-label">Activity:</div>
              <div class="field-value">${escapeHtml(s500.activity)}</div>
            </div>
          </div>

          <div class="wms-grid">
            <div class="wms-box">
              <div class="field-label">WMS required:</div>
              <div class="wms-value">${yesNo(wmsRequired)}</div>
            </div>

            <div class="wms-box">
              <div class="field-label">WMS signed:</div>
              <div class="wms-value">${yesNo(wmsSigned)}</div>
            </div>
          </div>

          <table class="hazard-table">
<colgroup>
  <col style="width: 22%;" />
  <col style="width: 52%;" />
  <col style="width: 8%;" />
  <col style="width: 6%;" />
  <col style="width: 6%;" />
  <col style="width: 6%;" />
</colgroup>

<tr>
  <th>Hazard / Environmental</th>
  <th>Control Measures to Reduce the Risk</th>
  <th>Applies</th>
  <th>P</th>
  <th>C</th>
  <th>R</th>
</tr>

${hazardTableRows(s500)}
          </table>

          <div class="section-title">PPE required for this work</div>

          <table class="ppe-table">
            ${ppeTableRows(s500)}
          </table>

          <div class="complete-grid single-complete">
            <div class="complete-box">
              <div class="field-label">Completed by:</div>
              <div class="field-value" style="font-family: ${signatureFontFamily(s500.employeeProfile?.signatureStyle)}; font-size: ${isPlainSignature(s500.employeeProfile?.signatureStyle) ? '12px' : '18px'}; font-style: italic;">${escapeHtml(s500.employeeProfile?.signature || s500.completedBy)}</div>
            </div>
          </div>


          <div class="footer">
            <div>NorthGroup Consulting</div>
            <div class="center">The Safe Day - Everyday</div>
            <div class="right">Page 1 of 2</div>
          </div>

        </div>

        <div class="page page-break page2">
          <div class="header">
            <div class="brand-row">
              ${logoHtml}
              <div class="tagline">Creating exceptional value in delivering Surveying, Scanning &amp; Town Planning Solutions</div>
            </div>

            <div class="doc-row">
              <div class="doc-cell">Document: S-500 Rev11</div>
              <div class="doc-cell doc-title">Pre-Start Risk Assessment</div>
              <div class="doc-cell">Issue Date:<br/>07/07/2026</div>
            </div>
          </div>

          <div class="topo-banner">
            ${bannerHtml}
          </div>

          <h2>Hierarchy of Control</h2>

          <div class="control-list">
            <div><b>1. Eliminate</b> - Modify the process or method to eliminate the hazard</div>
            <div><b>2. Substitute</b> - Replace material or process with a less hazardous one</div>
            <div><b>3. Isolate</b> - Separate the hazard from the person or the person from the hazard</div>
            <div><b>4. Engineer</b> - Redesign the workplace, equipment, or process</div>
            <div><b>5. Administrative</b> - Implement training or develop procedures</div>
            <div><b>6. PPE</b> - Use protective equipment properly fitted to control risk</div>
          </div>

          <h2>How to use this form</h2>

          <ul class="instructions">
            <li>Identify hazards, including environmental hazards, by observing, inspecting, investigating, and communicating.</li>
            <li>Implement control measures to reduce the risk.</li>
            <li>Use the Risk Assessment Matrix to assess the residual risk after control measures are implemented.</li>
            <li><b>P</b> - Probability: how likely it is to happen.</li>
            <li><b>C</b> - Consequence: severity if it happens.</li>
            <li><b>R</b> - Risk Rating: risk factor.</li>
            <li>Ensure residual risk is ALARP. If the residual risk factor is High or Acute, STOP and contact the Safety Manager.</li>
            <li>Each member of the survey crew is to fill out their own Pre-Start Risk Assessment form.</li>
            <li>If the survey crew leaves the job site or work conditions change, hazards need to be reviewed and the assessment updated.</li>
          </ul>

          <div class="matrix-title">Risk Assessment Matrix</div>

          <table class="matrix">
            <tr>
              <th class="side" rowspan="2">Consequence</th>
              <th class="rating" rowspan="2">Rating</th>
              <th colspan="5">Probability</th>
            </tr>
            <tr>
              <th>Rare<br/>1</th>
              <th>Unlikely<br/>2</th>
              <th>Moderate<br/>3</th>
              <th>Probable<br/>4</th>
              <th>Almost Certain<br/>5</th>
            </tr>
            <tr>
              <td class="side">Minor</td>
              <td class="rating">1</td>
              <td class="low">1</td>
              <td class="low">2</td>
              <td class="low">3</td>
              <td class="low">4</td>
              <td class="low">5</td>
            </tr>
            <tr>
              <td class="side">First aid / minor damage</td>
              <td class="rating">2</td>
              <td class="low">2</td>
              <td class="low">4</td>
              <td class="low">6</td>
              <td class="moderate">8</td>
              <td class="high">10</td>
            </tr>
            <tr>
              <td class="side">Medical treatment / moderate damage</td>
              <td class="rating">3</td>
              <td class="low">3</td>
              <td class="low">6</td>
              <td class="moderate">9</td>
              <td class="high">12</td>
              <td class="acute">15</td>
            </tr>
            <tr>
              <td class="side">Major injury / major damage</td>
              <td class="rating">4</td>
              <td class="low">4</td>
              <td class="moderate">8</td>
              <td class="high">12</td>
              <td class="acute">16</td>
              <td class="acute">20</td>
            </tr>
            <tr>
              <td class="side">Permanent incapacity / extensive damage</td>
              <td class="rating">5</td>
              <td class="low">5</td>
              <td class="high">10</td>
              <td class="acute">15</td>
              <td class="acute">20</td>
              <td class="acute">25</td>
            </tr>
          </table>

          <table class="legend">
            <tr>
              <td class="low">1 - 6 LOW - OK</td>
              <td class="moderate">7 - 9 MODERATE</td>
              <td class="high">10 - 12 HIGH</td>
              <td class="acute">13 - 25 ACUTE DANGER</td>
            </tr>
          </table>


                   <div class="footer">
            <div>NorthGroup Consulting</div>
            <div class="center">The Safe Day - Everyday</div>
            <div class="right">Page 2 of 2</div>
          </div>
        </div>
      </body>
    </html>
  `;
};
