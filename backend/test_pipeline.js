const fs = require('fs');

async function run() {
    console.log("Setting user to verified...");
    const mongoose = require("mongoose");
    await mongoose.connect("mongodb://127.0.0.1:27017/skillscan");
    const User = require("./models/User");
    
    const email = `test_verified_${Date.now()}@test.com`;
    const bcrypt = require("bcryptjs");
    const hashedPassword = await bcrypt.hash('password123', 10);
    const user = new User({
        name: 'Test',
        email,
        password: hashedPassword,
        isVerified: true
    });
    await user.save();
    
    console.log("Logging in...");
    let res = await fetch('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'password123' })
    });
    const { token } = await res.json();
    console.log("Got token:", token);
    
    console.log("Uploading PDF...");
    const form = new FormData();
    // Create a very basic PDF string (not valid but let's see if multer handles it)
    // Actually pdf-parse might fail if it's not a valid pdf. So let's send a txt.
    form.append('resume', new Blob(['John Doe\nSoftware Engineer with 5 years experience in React and Node.js.'], { type: 'text/plain' }), 'resume.txt');
    
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
