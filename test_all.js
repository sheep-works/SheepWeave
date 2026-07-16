const fs = require('fs');
const { DOMParser } = require('@xmldom/xmldom');

function readTextFile(p) {
    const buf = fs.readFileSync(p);
    if (buf.length >= 2 && buf[0] === 0xFF && buf[1] === 0xFE) {
        return buf.toString('utf16le');
    }
    return buf.toString('utf8');
}

const files = [
  'D:\\shwv_trans\\Working\\03_XLF_JSON\\【本地化】笔记（见闻部分） のコピー.xlsx_jpn.mqxliff',
  'D:\\shwv_trans\\Working\\01_REF\\TM\\ルナリウムTM.tmx'
];

const parserOpts = { onError: (level, msg) => console.log(`[DOMParser ${level}]`, msg) };
const parser = new DOMParser(parserOpts);

for (const file of files) {
  console.log(`\nTesting ${file}...`);
  let content = readTextFile(file);
  
  if (typeof content === 'string' && content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
  }
  
  try {
    parser.parseFromString(content, 'text/xml');
    console.log(`✅ Success: ${file}`);
  } catch (e) {
    console.error(`❌ Failed: ${file}`);
    console.error(e.message);
  }
}
