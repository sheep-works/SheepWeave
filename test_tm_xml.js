const fs = require('fs');
const { DOMParser } = require('@xmldom/xmldom');

let content = fs.readFileSync('D:\\shwv_trans\\Working\\01_REF\\TM\\ルナリウムTM.tmx', 'utf-8');
if (content.charCodeAt(0) === 0xFEFF) {
  content = content.slice(1);
}

const parser = new DOMParser(); 
try {
  parser.parseFromString(content, 'text/xml');
  console.log("Parsing finished successfully.");
} catch (e) {
  console.error("Caught error:", e);
}
