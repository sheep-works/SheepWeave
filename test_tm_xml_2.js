const fs = require('fs');
const { DOMParser } = require('@xmldom/xmldom');

let content = fs.readFileSync('D:\\shwv_trans\\Working\\01_REF\\TM\\ルナリウムTM.tmx');
if (content.length >= 2 && content[0] === 0xFF && content[1] === 0xFE) {
  content = content.toString('utf16le');
} else {
  content = content.toString('utf-8');
}

const parserOpts = { onError: (level, msg) => console.log(`[DOMParser ${level}]`, msg) };
const parser = new DOMParser(parserOpts);

try {
  parser.parseFromString(content, 'text/xml');
  console.log("Parsing finished without throwing!");
} catch (e) {
  console.error("Caught error:", e.message);
}
