const fs = require('fs');

async function run() {
    const mongoose = require("mongoose");
    await mongoose.connect("mongodb://127.0.0.1:27017/skillscan");
    const User = require("./models/User");
    const user = await User.findOne({ isVerified: true });
    
    let res = await fetch('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, password: 'password123' })
    });
    const { token } = await res.json();
    
    console.log("Creating dummy PDF...");
    const PDFDocument = require('pdfkit');
    await new Promise((resolve) => {
        const doc = new PDFDocument();
        const stream = fs.createWriteStream('dummy.pdf');
        doc.pipe(stream);
        doc.text('John Doe\nSoftware Engineer with 5 years experience in React and Node.js.');
        doc.end();
        stream.on('finish', resolve);
    });
    
    console.log("Uploading PDF...");
    // Read the dummy.pdf
    const fileBuffer = fs.readFileSync('dummy.pdf');
    const form = new FormData();
    form.append('resume', new Blob([fileBuffer], { type: 'application/pdf' }), 'dummy.pdf');
    
    res = await fetch('http://localhost:3000/api/resume/analyze', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`
        },
        body: form
    });
    
    const text = await res.text();
    console.log("API RESPONSE:", res.status, text);
    process.exit(0);
}

run().catch(console.error);
