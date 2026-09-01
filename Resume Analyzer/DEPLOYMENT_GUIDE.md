# Deploy Backend to Render.com - Step by Step Guide

This guide will help you deploy your backend so anyone can login from anywhere!

---

## STEP 1: Create MongoDB Atlas Account (Free Database)

### 1.1 Go to MongoDB Atlas
- Open your browser and go to: https://www.mongodb.com/cloud/atlas
- Click "Try Free" button

### 1.2 Create Account
- Sign up with Google or enter your email/password
- Complete the verification

### 1.3 Create Free Cluster
- After login, click "Create" button
- Choose "Free" (M0) tier
- Select cloud provider (AWS or Google)
- Select nearest region
- Click "Create Cluster"

### 1.4 Create Database User
- Click "Database Access" in left menu
- Click "Add New Database User"
- Username: `skillscan`
- Password: `skillscan123` (or your choice, remember it!)
- Click "Add User"

### 1.5 Network Access
- Click "Network Access" in left menu
- Click "Add IP Address"
- Click "Allow Access from Anywhere" (0.0.0.0/0)
- Click "Confirm"

### 1.6 Get Connection String
- Click "Database" in left menu
- Click "Connect" button on your cluster
- Choose "Connect your application"
- Copy the connection string
- It looks like: `mongodb+srv://skillscan:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`
- Replace `<password>` with your database password (skillscan123)
- **Save this connection string!**

---

## STEP 2: Deploy Backend to Render.com

### 2.1 Prepare Your Backend Code
Make sure your backend folder has these files:
- server.js
- package.json
- config/db.js
- models/User.js
- routes/auth.js

### 2.2 Create GitHub Repository
- Go to https://github.com
- Create a new repository named "skillscan-backend"
- Upload all your backend files to this repository
- The structure should be:
  ```
  skillscan-backend/
  ├── server.js
  ├── package.json
  ├── config/
  │   └── db.js
  ├── models/
  │   └── User.js
  └── routes/
      └── auth.js
  ```

### 2.3 Deploy to Render
- Go to https://render.com
- Sign up with GitHub
- Click "New +" and select "Web Service"
- Connect your GitHub repository (skillscan-backend)
- Configure:
  - Name: `skillscan-backend`
  - Environment: `Node`
  - Build Command: `npm install`
  - Start Command: `node server.js`
  
### 2.4 Add Environment Variables
In Render dashboard, click "Environment" and add:
- `MONGO_URI` = your MongoDB Atlas connection string (from step 1.6)
- `EMAIL_USER` = your Gmail email (skillscan54@gmail.com)
- `EMAIL_PASS` = your Gmail App Password (16 character password)

### 2.5 Deploy
- Click "Create Web Service"
- Wait for deployment (2-5 minutes)
- Once deployed, you'll get a URL like: `https://skillscan-backend.onrender.com`

**SAVE THIS URL!**

---

## STEP 3: Update Frontend Code

### 3.1 Update signup.html
Find this line:
```javascript
const API_URL = 'http://localhost:3000/api/auth';
```
Replace with:
```javascript
const API_URL = 'https://YOUR-RENDER-URL.onrender.com/api/auth';
```

### 3.2 Update login.html
Same change - find and replace the API_URL line.

### 3.3 Redeploy to Netlify
- Go to Netlify dashboard
- Upload the updated frontend files
- Your site will now work on all devices!

---

## Summary

After completing these steps:
1. Backend runs on Render.com (public)
2. Database is on MongoDB Atlas (public)
3. Frontend is on Netlify (public)
4. Anyone can login from anywhere!

---

## Troubleshooting

**Issue:** "Failed to connect to server"
- Check that your Render backend is deployed and running
- Verify the API_URL in your HTML files matches your Render URL

**Issue:** "MongoDB connection error"
- Check MONGO_URI is correct in Render environment variables
- Verify Network Access allows all IPs (0.0.0.0/0)

**Issue:** Emails not sending
- Verify EMAIL_USER and EMAIL_PASS are correct in Render
- Make sure you created a Gmail App Password (not your regular password)

