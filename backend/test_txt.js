const fs = require('fs');

async function run() {    
    console.log("Registering user...");
    const email = `test${Date.now()}@test.com`;
    let res = await fetch('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test', email, password: 'password123' })
    });
    
    console.log("Logging in...");
    res = await fetch('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'password123' })
    });
    const { token } = await res.json();
    console.log("Got token:", token);
    
    console.log("Uploading TXT...");
    const form = new FormData();
    form.append('resume', new Blob(['John Doe\nSoftware Engineer with 5 years experience in React and Node.js.'], { type: 'text/plain' }), 'resume.txt');
    
    res = await fetch('http://localhost:3000/api/resume/analyze', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`
        },
        body: form
    });
    
    const text = await res.text();
    console.log("TXT RESPONSE:", text);
}

run().catch(console.error);
