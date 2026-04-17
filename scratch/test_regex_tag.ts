import * as fs from 'fs';

function extractTags(text: string): { newText: string, placeholders: Record<number, string> } {
    let placeholders: Record<number, string> = {};
    let counter = 0;
    
    // Match any XML tag
    const newText = text.replace(/<[^>]+>/g, (match) => {
        placeholders[counter] = match;
        const replaceString = `{${counter}}`;
        counter++;
        return replaceString;
    });

    return { newText, placeholders };
}

const input = `<source xml:lang="en">Hello <b id="1">bold</b> and <ph id="2"/> world.</source>`;

// In practice, we only want to do this to the INSIDE of <source> and <target>.
// So first, let's match <source ...>...</source> and replace its inner content.
const result = input.replace(/(<source[^>]*>)([\s\S]*?)(<\/source>)/g, (match, open, inner, close) => {
    const { newText, placeholders } = extractTags(inner);
    console.log("Placeholders:", placeholders);
    return `${open}${newText}${close}`;
});

console.log("Result:", result);
