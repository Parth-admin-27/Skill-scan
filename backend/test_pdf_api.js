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
    
    console.log("Uploading PDF...");
    const pdfBase64 = "JVBERi0xLjcKCjEgMCBvYmogICUgZW50cnkgcG9pbnQKPDwKICAvVHlwZSAvQ2F0YWxvZwogIC9QYWdlcyAyIDAgUgo+PgplbmRvYmoKCjIgMCBvYmoKPDwKICAvVHlwZSAvUGFnZXMKICAvTWVkaWFCb3ggWyAwIDAgMjAwIDIwMCBdCiAgL0NvdW50IDEKICAvS2lkcyBbIDMgMCBSIF0KPj4KZW5kb2JqCgozIDAgb2JqCjw8CiAgL1R5cGUgL1BhZ2UKICAvUGFyZW50IDIgMCBSCiAgL1Jlc291cmNlcyA8PAogICAgL0ZvbnQgPDwKICAgICAgL0YxIDQgMCBSCj4+CiAgPj4KICAvQ29udGVudHMgNSAwIFIKPj4KZW5kb2JqCgo0IDAgb2JqCjw8CiAgL1R5cGUgL0ZvbnQKICAvU3VidHlwZSAvVHlwZTExCiAgL0Jhc2VGb250IC9UaW1lcy1Sb21hbgo+PgplbmRvYmoKCjUgMCBvYmoKPDwKICAvTGVuZ3RoIDIyCj4+CnN0cmVhbQpCVEQzOSBUZzI1IHRkKFdvcmxkKVRqIEVUDQplbmRzdHJlYW0KZW5kb2JqCgp4cmVmCjAgNgowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMTAgMDAwMDAgbiAKMDAwMDAwMDA1OSAwMDAwMCBuIAowMDAwMDAwMTQwIDAwMDAwIG4gCjAwMDAwMDAwMjQ5IDAwMDAwIG4gCjAwMDAwMDAwMzM1IDAwMDAwIG4gCnRyYWlsZXIKPDwKICAvU2l6ZSA2CiAgL1Jvb3QgMSAwIFIKPj4Kc3RhcnR4cmVmCjQwMwolJUVPRgo=";
    const fileBuffer = Buffer.from(pdfBase64, 'base64');
    
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
