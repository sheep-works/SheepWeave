import { parseStringPromise } from 'xml2js';

async function test() {
    const xml = `<source>Hello <b id="1">bold</b> and <ph id="2"/> world.</source>`;
    const r = await parseStringPromise(xml, {
        explicitChildren: true,
        preserveChildrenOrder: true,
        charsAsChildren: true
    });
    console.log(JSON.stringify(r.source.$$, null, 2));
}

test();
