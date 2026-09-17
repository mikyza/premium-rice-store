const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'ken_admin_boundaries.xlsx');

// Load the workbook and access sheet 2
const workbook = XLSX.readFile(filePath);
const sheet = workbook.Sheets['ken_admin2'];

// Parse sheet rows into JSON objects
const rawRows = XLSX.utils.sheet_to_json(sheet);

const locationHierarchy = {};

rawRows.forEach((row) => {
  const county = row.adm1_name;
  const subCounty = row.adm2_name;

  if (county && subCounty) {
    const cleanCounty = county.toString().trim();
    const cleanSubCounty = subCounty.toString().trim();

    if (!locationHierarchy[cleanCounty]) {
      locationHierarchy[cleanCounty] = [];
    }
    if (!locationHierarchy[cleanCounty].includes(cleanSubCounty)) {
      locationHierarchy[cleanCounty].push(cleanSubCounty);
    }
  }
});

// Sort towns/sub-counties alphabetically for clean UI rendering
Object.keys(locationHierarchy).forEach((county) => {
  locationHierarchy[county].sort();
});

// Write the output file
fs.writeFileSync(
  path.join(__dirname, 'kenya_locations.json'),
  JSON.stringify(locationHierarchy, null, 2)
);

console.log('Success! Created kenya_locations.json in your project folder.');
