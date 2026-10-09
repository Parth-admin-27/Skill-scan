const express = require("express");
const router = express.Router();
const supabase = require("../config/supabase");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const otpGenerator = require("otp-generator");
const jwt = require("jsonwebtoken");

require("dotenv").config();

async function findUser(email) {
    const users = await supabase.select("users", `select=*&email=eq.${encodeURIComponent(email.toLowerCase())}&limit=1`);
    return users[0] || null;
}

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

async function sendOtpEmail(email, otp) {
    try {
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: "SkillScan OTP Verification",
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
                    <div style="background: linear-gradient(135deg, #4F46E5, #7C3AED); padding: 30px; border-radius: 10px; text-align: center;">
                        <h1 style="color: white; margin: 0;">SkillScan</h1>
                    </div>
                    <div style="padding: 30px; background: #f9fafb; border-radius: 0 0 10px 10px;">
                        <h2 style="color: #1F2937; margin-top: 0;">Verify Your Email</h2>
                        <p style="color: #6B7280; line-height: 1.6;">
                            Thank you for signing up with <strong>SkillScan</strong>!
                        </p>
                        <p style="color: #6B7280; line-height: 1.6;">
                            Your One-Time Password (OTP) for email verification is:
                        </p>
                        <div style="background: #FFFFFF; border: 2px dashed #4F46E5; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
                            <span style="font-size: 32px; font-weight: bold; color: #4F46E5; letter-spacing: 8px;">${otp}</span>
                        </div>
                        <p style="color: #6B7280; font-size: 14px;">
                            This OTP will expire in <strong>5 minutes</strong>.
                        </p>
                        <p style="color: #6B7280; font-size: 14px;">
                            If you didn't create an account with SkillScan, please ignore this email.
                        </p>
                        <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 20px 0;">
                        <p style="color: #9CA3AF; font-size: 12px; text-align: center;">
                            © 2024 SkillScan. All rights reserved.<br>
                            Building Your Career Roadmap
                        </p>
                    </div>
                </div>
            `
        });
        return true;
    } catch (error) {
        console.warn("Email delivery failed, returning OTP in dev response:", error.message);
        return false;
    }
}

// Signup - Send OTP
router.post("/signup", async (req, res) => {
    const { name, password } = req.body;
    const email = String(req.body.email || "").trim().toLowerCase();

    if (!name || !email || !password || password.length < 6) {
        return res.status(400).json({ message: "Name, email and a 6-character password are required" });
    }

    try {
        const user = await findUser(email);

        if (user && user.is_verified) {
            return res.status(400).json({ message: "User already exists" });
        }

        const otp = otpGenerator.generate(6, {
            digits: true,
            lowerCaseAlphabets: false,
            upperCaseAlphabets: false,
            specialChars: false
        });

        const hashedPassword = await bcrypt.hash(password, 10);

        const values = {
            name,
            email,
            password_hash: hashedPassword,
            otp,
            otp_expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString()
        };

        if (user) {
            await supabase.update("users", `id=eq.${user.id}`, values);
        } else {
            await supabase.insert("users", {
                name,
                email,
                password_hash: hashedPassword,
                otp,
                otp_expires_at: values.otp_expires_at
            });
        }

        const emailSent = await sendOtpEmail(email, otp);

        const response = { message: "OTP sent" };
        if (!emailSent || process.env.NODE_ENV !== "production") {
            response.devOtp = otp;
            response.note = emailSent
                ? "Local development mode: devOtp is included for testing."
                : "Email delivery failed in local mode; use devOtp to verify the account.";
        }

        res.json(response);

    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Server error" });
    }
});

// Verify OTP
router.post("/verify-otp", async (req, res) => {
    const email = String(req.body.email || "").trim().toLowerCase();
    const otp = String(req.body.otp || "").trim();

    try {
        const user = await findUser(email);

        if (!user) return res.status(400).json({ message: "User not found" });

        if (user.otp !== otp || new Date(user.otp_expires_at).getTime() < Date.now()) {
            return res.status(400).json({ message: "Invalid OTP" });
        }

        await supabase.update("users", `id=eq.${user.id}`, {
            is_verified: true,
            otp: null,
            otp_expires_at: null
        });

        res.json({ message: "Account verified" });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Server error" });
    }
});

// Resend OTP
router.post("/resend-otp", async (req, res) => {
    const email = String(req.body.email || "").trim().toLowerCase();

    try {
        const user = await findUser(email);

        if (!user) return res.status(400).json({ message: "User not found" });

        const otp = otpGenerator.generate(6, {
            digits: true,
            lowerCaseAlphabets: false,
            upperCaseAlphabets: false,
            specialChars: false
        });

        await supabase.update("users", `id=eq.${user.id}`, {
            otp,
            otp_expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString()
        });

        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: "SkillScan OTP Resend",
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
                    <div style="background: linear-gradient(135deg, #4F46E5, #7C3AED); padding: 30px; border-radius: 10px; text-align: center;">
                        <h1 style="color: white; margin: 0;">SkillScan</h1>
                    </div>
                    <div style="padding: 30px; background: #f9fafb; border-radius: 0 0 10px 10px;">
                        <h2 style="color: #1F2937; margin-top: 0;">Resend OTP Request</h2>
                        <p style="color: #6B7280; line-height: 1.6;">
                            You requested a new OTP for your <strong>SkillScan</strong> account.
                        </p>
                        <p style="color: #6B7280; line-height: 1.6;">
                            Your new One-Time Password is:
                        </p>
                        <div style="background: #FFFFFF; border: 2px dashed #4F46E5; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
                            <span style="font-size: 32px; font-weight: bold; color: #4F46E5; letter-spacing: 8px;">${otp}</span>
                        </div>
                        <p style="color: #6B7280; font-size: 14px;">
                            This OTP will expire in <strong>5 minutes</strong>.
                        </p>
                        <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 20px 0;">
                        <p style="color: #9CA3AF; font-size: 12px; text-align: center;">
                            © 2024 SkillScan. All rights reserved.<br>
                            Building Your Career Roadmap
                        </p>
                    </div>
                </div>
            `
        });

        res.json({ message: "OTP resent" });

    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Server error" });
    }
});

// Login
router.post("/login", async (req, res) => {
    const password = String(req.body.password || "");
    const email = String(req.body.email || "").trim().toLowerCase();

    try {
        const user = await findUser(email);

        if (!user || !user.is_verified) {
            return res.status(400).json({ message: "Account not verified" });
        }

        const match = await bcrypt.compare(password, user.password_hash);

        if (!match) {
            return res.status(400).json({ message: "Invalid password" });
        }

        const token = jwt.sign(
            { id: user.id }, 
            process.env.JWT_SECRET || "fallback_secret_key_123", 
            { expiresIn: "7d" }
        );

        res.json({
            message: "Login success",
            token,
            user: {
                name: user.name,
                email: user.email
            }
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;

