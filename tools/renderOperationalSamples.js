const fs = require('fs');
const path = require('path');
const vm = require('vm');
const babel = require('@babel/core');

const sourcePath = path.join(__dirname, '../src/export/operational/buildOperationalHtml.js');
const source = fs.readFileSync(sourcePath, 'utf8');
const transformed = babel.transformSync(source, {
  plugins: ['@babel/plugin-transform-modules-commonjs'],
  filename: sourcePath,
}).code;

const moduleObject = { exports: {} };
const sandbox = {
  module: moduleObject,
  exports: moduleObject.exports,
  require: (id) => {
    if (id === 'expo-asset') return { Asset: { fromModule: (assetPath) => ({ downloadAsync: async () => {}, localUri: assetPath, uri: assetPath }) } };
    if (id === 'expo-file-system/legacy') return {
      EncodingType: { Base64: 'base64' },
      cacheDirectory: '/tmp/',
      readAsStringAsync: async (filePath) => fs.readFileSync(filePath, 'base64'),
      downloadAsync: async () => { throw new Error('Remote assets are not used in sample rendering'); },
    };
    if (/\.(png|jpg|jpeg)$/.test(id)) return path.resolve(path.dirname(sourcePath), id);
    throw new Error(`Unsupported sample dependency: ${id}`);
  },
  console,
};
vm.runInNewContext(transformed, sandbox, { filename: sourcePath });

const checklistSource = fs.readFileSync(path.join(__dirname, '../src/constants/s501ChecklistItems.js'), 'utf8');
const checklistBlock = checklistSource.match(/S501_CHECKLIST_ITEMS\s*=\s*\[([\s\S]*?)\];/)[1];
const checklistLabels = [...checklistBlock.matchAll(/'([^']+)'/g)].map((match) => match[1]);
const checks = checklistLabels.map((label, index) => ({
  label,
  status: index === 4 ? 'Damaged' : 'OK',
  remarks: index === 4 ? 'Minor damage recorded for repair before travel.' : '',
}));

const s501 = {
  date: '14/07/2026', vehicleMake: 'Toyota Hilux', registration: '123 ABC', odometer: '85214', completedBy: 'Patrick Carroll', checks,
};
const riskLabels = ['Unfamiliar with route', 'Unfamiliar with vehicle', 'Vehicle service up to date', 'Person travelling alone', 'Health issues', 'Poor weather conditions'];
const s506 = {
  date: '14/07/2026', vehicleRegistration: '123 ABC', jobNumber: 'MR105610', drivers: 'Patrick Carroll', buddyContact: 'Office - 07 0000 0000', purpose: 'Detail survey', kilometresOneWay: '185', destination: 'Gladstone project site', travellers: 'PC', departureFrom: 'Brisbane office', expectedDepartureTime: '06:30', expectedArrivalTime: '09:15', other: 'Buddy contact to call if arrival is not confirmed by 10:15.', risks: Object.fromEntries(riskLabels.map((label) => [label, label === 'Poor weather conditions' ? 'No' : 'Yes'])),
};

Promise.all([moduleObject.exports.buildS501Html(s501), moduleObject.exports.buildS506Html(s506)]).then(([vehicle, journey]) => {
  fs.mkdirSync('/tmp/pdfs/operational', { recursive: true });
  fs.writeFileSync('/tmp/pdfs/operational/s501-sample.html', vehicle);
  fs.writeFileSync('/tmp/pdfs/operational/s506-sample.html', journey);
});
