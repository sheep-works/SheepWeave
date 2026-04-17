import { parseStringPromise } from 'xml2js';

async function test() {
    let content = `
    <xliff>
      <file>
        <body>
          <trans-unit id="1">
            <source>Hello <b id="1">bold</b> and <ph id="2"/> world.</source>
            <target>Hola <b id="1">audaz</b> y <ph id="2"/> mundo.</target>
          </trans-unit>
        </body>
      </file>
    </xliff>`;

    let globalId = 0;
    const globalPlaceholders: Record<string, Record<number, string>> = {};

    content = content.replace(/(<(?:source|target)[^>]*>)([\s\S]*?)(<\/(?:source|target)>)/g, (match, open, inner, close) => {
        let placeholders: Record<number, string> = {};
        let counter = 0;
        const newInner = inner.replace(/<[^>]+>/g, (tagMatch) => {
            placeholders[counter] = tagMatch;
            const replaceString = `{${counter}}`;
            counter++;
            return replaceString;
        });
        
        const id = `__SHEEP_${globalId++}__`;
        globalPlaceholders[id] = placeholders;
        return `${open}${id}${newInner}${close}`;
    });

    console.log("Preprocessed XML:\n", content);

    const data = await parseStringPromise(content);
    
    const tu = data.xliff.file[0].body[0]['trans-unit'][0];
    
    let src = tu.source[0];
    const srcMatch = src.match(/^__SHEEP_(\d+)__/);
    let srcPlaceholders = {};
    if (srcMatch) {
        src = src.substring(srcMatch[0].length);
        srcPlaceholders = globalPlaceholders[srcMatch[0]];
    }

    let tgt = tu.target[0];
    const tgtMatch = tgt.match(/^__SHEEP_(\d+)__/);
    let tgtPlaceholders = {};
    if (tgtMatch) {
        tgt = tgt.substring(tgtMatch[0].length);
        tgtPlaceholders = globalPlaceholders[tgtMatch[0]];
    }

    console.log("Parsed Src:", src);
    console.log("Src Placeholders:", srcPlaceholders);
    
    console.log("Parsed Tgt:", tgt);
    console.log("Tgt Placeholders:", tgtPlaceholders);
}

test();
