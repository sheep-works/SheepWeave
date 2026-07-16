const fs = require('fs');
const { DOMParser } = require('@xmldom/xmldom');

let buf = fs.readFileSync('D:\\shwv_trans\\Working\\01_REF\\TM\\ルナリウムTM.tmx');
let content;
if (buf.length >= 2 && buf[0] === 0xFF && buf[1] === 0xFE) {
  content = buf.toString('utf16le');
} else {
  content = buf.toString('utf8');
}

if (typeof content === 'string' && content.charCodeAt(0) === 0xFEFF) {
  content = content.slice(1);
}

const parserOpts = { onError: (level, msg) => console.log(`[DOMParser ${level}]`, msg) };
const parser = new DOMParser(parserOpts);

try {
  parser.parseFromString(content, 'text/xml');
  console.log("Parsing finished without throwing!");
} catch (e) {
  console.error("Caught error:", e.message);
}
