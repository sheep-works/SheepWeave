const { DOMParser } = require('@xmldom/xmldom');
const content = '<doc a="<"/>';
try {
  new DOMParser().parseFromString(content, 'text/xml');
  console.log("Success");
} catch (e) {
  console.error("Caught:", e);
}
