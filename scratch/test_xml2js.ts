import { parseStringPromise } from 'xml2js';

async function test() {
    const xml = `<source>Hello <b>bold</b> and <i>italic</i> world.</source>`;
    const r = await parseStringPromise(xml);
    console.log(JSON.stringify(r, null, 2));
}

test();
