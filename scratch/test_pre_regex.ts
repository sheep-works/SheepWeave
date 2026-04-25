import { parseStringPromise } from 'xml2js';

async function test() {
    let content = `
    <xliff>
      <file>
        <body>
          <trans-unit id="1">
            <source>Hello &lt;b id="1"&gt;bold&lt;/b&gt; and &lt;ph id="2"/&gt; world.</source>
          </trans-unit>
        </body>
      </file>
    </xliff>`;

    let globalId = 0;
    const globalPlaceholders: Record<string, Record<number, string>> = {};

    // Improved regex to catch <tag> and &lt;tag&gt;
    // Also including target
    content = content.replace(/(<(?:source|target)[^>]*>)([\s\S]*?)(<\/(?:source|target)>)/g, (match, open, inner, close) => {
        let placeholders: Record<number, string> = {};
        let counter = 0;
        // Updated regex to catch both raw and escaped tags
        const newInner = inner.replace(/(<[^>]+>|&lt;[\s\S]*?&gt;)/g, (tagMatch) => {
            placeholders[counter] = tagMatch;
            const replaceString = `{@${counter}}`;
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

    console.log("Parsed Src:", src);
    console.log("Src Placeholders:", srcPlaceholders);
}

test();
