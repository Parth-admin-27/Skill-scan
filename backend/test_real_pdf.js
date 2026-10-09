const fs = require('fs');
const PDFDocument = require('pdfkit');
const { PDFParse } = require('pdf-parse');

async function test() {
    console.log("Creating PDF...");
    await new Promise((resolve) => {
        const doc = new PDFDocument();
        const stream = fs.createWriteStream('valid.pdf');
        doc.pipe(stream);
        doc.text('John Doe');
        doc.text('Software Engineer with 5 years experience in React and Node.js.');
        doc.end();
        stream.on('finish', resolve);
    });

    console.log("Parsing PDF...");
    const buffer = fs.readFileSync('valid.pdf');
    const uint8 = new Uint8Array(buffer);
    const parser = new PDFParse(uint8);
    await parser.load();
    const result = await parser.getText();
    
    console.log("RESULT TYPE:", typeof result);
    console.log("RESULT:", result);
    
    let resumeText = "";
    if (typeof result === 'string') {
        resumeText = result;
    } else if (result && result.pages) {
        resumeText = result.pages.map(p => p.text).join('\n');
    } else {
        resumeText = String(result);
    }
    console.log("EXTRACTED TEXT:", resumeText);
}

test().catch(console.error);
