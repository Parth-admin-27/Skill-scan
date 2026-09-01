const fs = require('fs');
const PDFDocument = require('pdfkit');

async function createPDF(path) {
    return new Promise((resolve) => {
        const doc = new PDFDocument();
        const stream = fs.createWriteStream(path);
        doc.pipe(stream);
        doc.text('John Doe\nSoftware Engineer with 5 years experience in React and Node.js.');
        doc.end();
        stream.on('finish', resolve);
    });
}

async function run() {
    console.log("Creating dummy PDF...");
    await createPDF('dummy.pdf');
    
    console.log("Registering user...");
    const email = `test${Date.now()}@test.com`;
    let res = await fetch('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test', email, password: 'password123' })
    });
    
    // Login
    console.log("Logging in...");
    res = await fetch('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'password123' })
    });
    const { token } = await res.json();
    console.log("Got token:", token);
    
    // Upload PDF
    console.log("Uploading PDF...");
    const FormData = require('form-data');
    const form = new FormData();
    form.append('resume', fs.createReadStream('dummy.pdf'));
    
    res = await fetch('http://localhost:3000/api/resume/analyze', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`
        },
        body: form
    });
    
    const text = await res.text();
    console.log("RESPONSE:", text);
}

run().catch(console.error);
