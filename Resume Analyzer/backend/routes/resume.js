const express = require("express");
const router = express.Router();
const multer = require("multer");
const { PDFParse } = require("pdf-parse");
const mammoth = require("mammoth");

require("dotenv").config();

const upload = multer({ storage: multer.memoryStorage() });

const GROQ_API_KEY = process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY; // Fallback in case they pasted the groq key into GEMINI_API_KEY
const Groq = require("groq-sdk");
const groq = GROQ_API_KEY ? new Groq({ apiKey: GROQ_API_KEY }) : null;

const DEFAULT_GROQ_MODELS = [
    process.env.GROQ_MODEL,
    "openai/gpt-oss-20b",
    "qwen/qwen3.6-27b",
    "openai/gpt-oss-120b",
    "groq/compound",
    "groq/compound-mini"
].filter(Boolean);

async function getGroqModels() {
    const knownModels = [...new Set(DEFAULT_GROQ_MODELS)];

    if (!groq) {
        return knownModels;
    }

    try {
        const response = await groq.models.list();
        const available = new Set((response?.data || []).map(model => model.id).filter(Boolean));
        const filtered = knownModels.filter(model => available.has(model));
        return filtered.length ? filtered : knownModels;
    } catch (error) {
        console.warn("⚠️ Unable to fetch available Groq models, using configured fallback list.");
        return knownModels;
    }
}

async function callGroqWithFallback(request) {
    if (!groq) {
        throw new Error("Groq API key is not configured");
    }

    let lastError;

    for (const model of await getGroqModels()) {
        try {
            return await groq.chat.completions.create({
                ...request,
                model
            });
        } catch (error) {
            const message = error?.message || "";
            const isModelMissing = error?.status === 404 || error?.code === "model_not_found" || /does not exist|not found|model.*invalid/i.test(message);

            if (isModelMissing) {
                console.warn(`⚠️ Groq model unavailable: ${model}. Trying next available model.`);
                lastError = error;
                continue;
            }

            throw error;
        }
    }

    throw lastError || new Error("No Groq model was available for the request");
}

const authMiddleware = require("../middleware/authMiddleware");
const Resume = require("../models/Resume");

router.post("/analyze", authMiddleware, upload.single("resume"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });

        let resumeText = "";

        if (req.file.mimetype === "application/pdf") {
            const uint8 = new Uint8Array(req.file.buffer);
            const parser = new PDFParse(uint8);
            await parser.load();
            const result = await parser.getText();
            if (typeof result === 'string') {
                resumeText = result;
            } else if (result && result.pages) {
                resumeText = result.pages.map(p => p.text).join('\n');
            } else {
                resumeText = String(result);
            }
        } else if (req.file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || req.file.originalname.endsWith(".docx")) {
            const result = await mammoth.extractRawText({ buffer: req.file.buffer });
            resumeText = result.value;
        } else {
            resumeText = req.file.buffer.toString("utf-8");
        }

        if (!resumeText.trim()) return res.status(400).json({ error: "Could not extract text from resume" });

        const jd = req.body.jobDescription || "";
        const prompt = `You are a resume screening system. Analyze the provided text.
First, verify if the provided text is a resume or contains resume-like information (e.g. professional experience, education, skills, projects, or work history). Be lenient with short or incomplete resumes.
If the text is clearly NOT a resume (for example: a recipe, grocery list, news article, book chapter, random text, syllabus, exam paper, or general document), you MUST return a JSON object with this format:
{"isResume": false, "errorReason": "A clear explanation of why the document is not recognized as a resume (e.g. 'The uploaded document appears to be a recipe, not a resume.')"}

If it is a resume, return a JSON object with "isResume": true, and complete the analysis with these exact fields:
{"isResume": true, "overallScore":0-100,"scoreLabel":"short label","strengths":[3 items],"improvements":[3 items],"currentSkills":[list],"missingSkills":[list for ${jd ? "the requirements in the Job Description" : "detected role"}],"targetRole":"${jd ? "Role from Job Description" : "role name"}","roadmap":[{"step":1,"title":"t","description":"d"},{"step":2,"title":"t","description":"d"},{"step":3,"title":"t","description":"d"}],"aiSuggestions":[4 items]}

${jd ? `Job Description:\n${jd.slice(0, 1000)}\n\n` : ""}Resume Text:
${resumeText.slice(0, 2000)}`;

        const completion = await callGroqWithFallback({
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.4,
            max_tokens: 4000,
            response_format: { type: "json_object" }
        });

        let text = completion.choices[0].message.content.trim();
        const match = text.match(/\{[\s\S]*\}/);
        if (!match) throw new Error("Invalid AI response format: No JSON object found.");
        
        let parsedResult;
        try {
            parsedResult = JSON.parse(match[0]);
        } catch (e) {
            console.error("JSON parse error on AI response:", e.message);
            // Fallback: try to clean up trailing commas or cut-offs
            text = match[0].replace(/,\s*([}\]])/g, '$1');
            parsedResult = JSON.parse(text);
        }

        if (parsedResult.isResume === false) {
            console.log("❌ Uploaded document was validated as NOT a resume");
            return res.status(400).json({ error: parsedResult.errorReason || "The uploaded document does not appear to be a resume. Please upload a valid resume." });
        }

        console.log("✅ Resume analyzed with Groq AI");

        // Save to database
        const newResume = new Resume({
            userId: req.user.id,
            jobDescription: jd,
            analysisResult: parsedResult
        });
        await newResume.save();
        console.log("💾 Analysis saved to database for user:", req.user.id);

        return res.json(parsedResult);

    } catch (error) {
        console.error("Resume analysis error:", error.message);
        res.status(500).json({ error: "Analysis failed: " + error.message });
    }
});

module.exports = router;
