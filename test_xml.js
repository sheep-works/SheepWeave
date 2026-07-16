const fs = require('fs');
const { DOMParser } = require('@xmldom/xmldom');

let content = fs.readFileSync('D:\\shwv_trans\\Working\\03_XLF_JSON\\【本地化】笔记（见闻部分） のコピー.xlsx_jpn.mqxliff', 'utf-8');
if (content.charCodeAt(0) === 0xFEFF) {
  content = content.slice(1);
}

const parser = new DOMParser({
  onError: (level, msg, context) => console.log(level, msg)
});
try {
  parser.parseFromString(content, 'text/xml');
  console.log("Parsing finished.");
} catch (e) {
  console.error("Exception:", e);
}
