'use strict';
const fs = require('node:fs');
const path = require('node:path');
const PLAN = require('../js/plan.js');

const out = path.join(__dirname, '..', 'data', 'plano.csv');
fs.writeFileSync(out, PLAN.toCsv(), 'utf8');
console.log(`Plano exportado: ${path.relative(process.cwd(), out)}`);
