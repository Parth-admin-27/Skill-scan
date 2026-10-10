const express = require("express");
const router = express.Router();
const multer = require("multer");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");

require("dotenv").config();

const allowedMimeTypes = new Set([
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain"
]);

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    fileFilter: (req, file, callback) => {
        callback(allowedMimeTypes.has(file.mimetype) ? null : new Error("Only PDF, DOCX and TXT resumes are allowed"), allowedMimeTypes.has(file.mimetype));
    }
});

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
const supabase = require("../config/supabase");
const { buildExplainableScore, buildJobMatches, runEvaluationBenchmark } = require("../lib/resumeScoring");

const CURRENT_YEAR = new Date().getFullYear();

function uniqueSkills(skills = []) {
    return [...new Set(skills.map(skill => String(skill).trim()).filter(Boolean))];
}

function extractFirstJsonObject(value) {
    const text = String(value || "");
    const start = text.indexOf("{");
    if (start === -1) return null;

    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = start; index < text.length; index += 1) {
        const character = text[index];
        if (inString) {
            if (escaped) escaped = false;
            else if (character === "\\") escaped = true;
            else if (character === '"') inString = false;
            continue;
        }
        if (character === '"') inString = true;
        else if (character === "{") depth += 1;
        else if (character === "}") {
            depth -= 1;
            if (depth === 0) return text.slice(start, index + 1);
        }
    }
    return null;
}

function buildSkillInsights(analysis = {}) {
    const evidenceBySkill = new Map(
        (analysis.skillEvidence || []).map(item => [String(item.skill || "").toLowerCase(), item])
    );

    const evidence = uniqueSkills(analysis.currentSkills).map(skill => {
        const source = evidenceBySkill.get(skill.toLowerCase()) || {};
        const parsedYear = Number.parseInt(source.lastUsedYear, 10);
        const lastUsedYear = Number.isFinite(parsedYear) && parsedYear >= 1980 && parsedYear <= CURRENT_YEAR ? parsedYear : null;
        const evidenceText = String(source.evidence || "Listed in the resume's skills section").trim();
        const evidenceType = String(source.evidenceType || "Skills section").trim();
        const isAppliedEvidence = /project|experience|internship|employment|achievement/i.test(evidenceType);
        const evidenceStrength = isAppliedEvidence && evidenceText.length >= 35 ? "Strong" : evidenceText.length >= 20 ? "Moderate" : "Weak";
        return { skill, evidence: evidenceText, evidenceType, lastUsedYear, evidenceStrength };
    });

    const skillHealth = evidence.map(item => {
        if (!item.lastUsedYear) {
            return { ...item, yearsSinceUse: null, status: "Confirm recency", priority: "Medium", recommendation: `Add a recent project, certificate, or last-used year for ${item.skill}.` };
        }
        const yearsSinceUse = Math.max(0, CURRENT_YEAR - item.lastUsedYear);
        if (yearsSinceUse <= 1) {
            return { ...item, yearsSinceUse, status: "Active", priority: "Low", recommendation: `Keep using ${item.skill} in projects and document measurable results.` };
        }
        if (yearsSinceUse <= 2) {
            return { ...item, yearsSinceUse, status: "Refresh soon", priority: "Medium", recommendation: `Complete a short refresher or mini-project using ${item.skill}.` };
        }
        return { ...item, yearsSinceUse, status: "Refresh recommended", priority: "High", recommendation: `Review current ${item.skill} practices and build a recent proof-of-work project.` };
    });

    return { evidence, skillHealth };
}

function compareVersions(previous, current) {
    if (!previous) {
        return { hasPreviousVersion: false, scoreDelta: 0, addedSkills: uniqueSkills(current.currentSkills), removedSkills: [], resolvedRecommendations: [], summary: "This is your baseline resume. Upload an improved version to measure progress." };
    }

    const previousSkills = uniqueSkills(previous.currentSkills);
    const currentSkills = uniqueSkills(current.currentSkills);
    const previousLookup = new Set(previousSkills.map(skill => skill.toLowerCase()));
    const currentLookup = new Set(currentSkills.map(skill => skill.toLowerCase()));
    const scoreDelta = Number(current.overallScore || 0) - Number(previous.overallScore || 0);
    const currentImprovementText = (current.improvements || []).join(" ").toLowerCase();
    const resolvedRecommendations = (previous.improvements || []).map(String).filter(item => {
        const keywords = item.toLowerCase().split(/\W+/).filter(word => word.length > 5);
        return keywords.length > 0 && !keywords.some(word => currentImprovementText.includes(word));
    }).slice(0, 3);

    return {
        hasPreviousVersion: true,
        scoreDelta,
        addedSkills: currentSkills.filter(skill => !previousLookup.has(skill.toLowerCase())),
        removedSkills: previousSkills.filter(skill => !currentLookup.has(skill.toLowerCase())),
        resolvedRecommendations,
        summary: scoreDelta > 0 ? `Your resume score improved by ${scoreDelta} points.` : scoreDelta < 0 ? `Your score changed by ${scoreDelta} points. Review the comparison before replacing your previous version.` : "Your score is unchanged; use the evidence and skill-health feedback for the next revision."
    };
}

function parseJobs(value, fallbackDescription = "") {
    let jobs = [];
    try {
        jobs = value ? JSON.parse(value) : [];
    } catch (_error) {
        jobs = [];
    }
    if (!Array.isArray(jobs)) jobs = [];
    jobs = jobs
        .map((job, index) => ({
            title: String(job?.title || `Job ${index + 1}`).slice(0, 100),
            description: String(job?.description || "").slice(0, 5000)
        }))
        .filter(job => job.description.trim())
        .slice(0, 5);
    if (!jobs.length && fallbackDescription) jobs.push({ title: "Target role", description: fallbackDescription.slice(0, 5000) });
    return jobs;
}

router.post("/analyze", authMiddleware, upload.single("resume"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });

        let resumeText = "";

        if (req.file.mimetype === "application/pdf") {
            const result = await pdfParse(req.file.buffer);
            resumeText = result.text;
        } else if (req.file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || req.file.originalname.endsWith(".docx")) {
            const result = await mammoth.extractRawText({ buffer: req.file.buffer });
            resumeText = result.value;
        } else {
            resumeText = req.file.buffer.toString("utf-8");
        }

        if (!resumeText.trim()) return res.status(400).json({ error: "Could not extract text from resume" });

        const submittedJobs = parseJobs(req.body.jobDescriptions, req.body.jobDescription || "");
        const jd = submittedJobs[0]?.description || req.body.jobDescription || "";
        const prompt = `You are a resume screening system. Analyze the provided text.
First, verify if the provided text is a resume or contains resume-like information (e.g. professional experience, education, skills, projects, or work history). Be lenient with short or incomplete resumes.
If the text is clearly NOT a resume (for example: a recipe, grocery list, news article, book chapter, random text, syllabus, exam paper, or general document), you MUST return a JSON object with this format:
{"isResume": false, "errorReason": "A clear explanation of why the document is not recognized as a resume (e.g. 'The uploaded document appears to be a recipe, not a resume.')"}

If it is a resume, return a JSON object with "isResume": true, and complete the analysis with these exact fields:
Additionally include "skillEvidence": [{"skill":"one current skill","evidence":"exact short resume phrase or where the skill appears","evidenceType":"Project, Experience, Education, Certification, or Skills section","lastUsedYear":2020-2026 or null}]. Create one entry for every currentSkills item. Never invent a date; use null when no reliable year is present.
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
        const jsonObject = extractFirstJsonObject(text);
        if (!jsonObject) throw new Error("Invalid AI response format: No complete JSON object found.");
        
        let parsedResult;
        try {
            parsedResult = JSON.parse(jsonObject);
        } catch (e) {
            console.error("JSON parse error on AI response:", e.message);
            // Fallback: try to clean up trailing commas or cut-offs
            text = jsonObject.replace(/,\s*([}\]])/g, '$1');
            parsedResult = JSON.parse(text);
        }

        if (parsedResult.isResume === false) {
            console.log("❌ Uploaded document was validated as NOT a resume");
            return res.status(400).json({ error: parsedResult.errorReason || "The uploaded document does not appear to be a resume. Please upload a valid resume." });
        }

        console.log("✅ Resume analyzed with Groq AI");

        const previousRows = await supabase.select(
            "resume_versions",
            `select=*&user_id=eq.${req.user.id}&order=created_at.desc&limit=1`
        );
        const previousResume = previousRows[0] || null;
        const versionNumber = (previousResume?.version_number || 0) + 1;
        const { evidence, skillHealth } = buildSkillInsights(parsedResult);
        const scoredAnalysis = { ...parsedResult, skillEvidence: evidence };
        const atsBreakdown = buildExplainableScore({ analysis: scoredAnalysis, resumeText, jobDescription: jd });
        const jobMatches = buildJobMatches({ resumeText, jobs: submittedJobs, analysis: scoredAnalysis });
        const enrichedResult = {
            ...parsedResult,
            overallScore: atsBreakdown.totalScore,
            scoreLabel: atsBreakdown.totalScore >= 75 ? "Strong ATS readiness" : atsBreakdown.totalScore >= 55 ? "Good foundation — targeted improvements recommended" : "Needs targeted improvement",
            atsBreakdown,
            jobMatches,
            bestJob: jobMatches[0] || null,
            skillEvidence: evidence,
            skillHealth,
            improvementComparison: compareVersions(previousResume?.analysis_result || null, { ...parsedResult, overallScore: atsBreakdown.totalScore }),
            versionNumber,
            analyzedAt: new Date().toISOString()
        };

        // Save this analysis as a new resume version
        await supabase.insert("resume_versions", {
            user_id: req.user.id,
            job_description: jd,
            file_name: req.file.originalname,
            version_number: versionNumber,
            analysis_result: enrichedResult
        });
        console.log(`💾 Resume version ${versionNumber} saved for user:`, req.user.id);

        return res.json(enrichedResult);

    } catch (error) {
        console.error("Resume analysis error:", error.message);
        res.status(500).json({ error: "Analysis failed: " + error.message });
    }
});

router.get("/insights", authMiddleware, async (req, res) => {
    try {
        const resumes = await supabase.select(
            "resume_versions",
            `select=*&user_id=eq.${req.user.id}&order=created_at.desc`
        );
        const versions = resumes.map(resume => ({
            id: resume.id,
            versionNumber: resume.version_number || 1,
            fileName: resume.file_name || "Resume",
            createdAt: resume.created_at,
            score: Number(resume.analysis_result?.overallScore || 0),
            targetRole: resume.analysis_result?.targetRole || "Not specified",
            currentSkills: uniqueSkills(resume.analysis_result?.currentSkills),
            improvementComparison: resume.analysis_result?.improvementComparison || null
        }));

        if (!resumes.length) {
            return res.json({ latest: null, versions: [], evaluation: runEvaluationBenchmark() });
        }

        const latest = resumes[0].analysis_result;
        const fallbackInsights = buildSkillInsights(latest);
        return res.json({
            latest: {
                ...latest,
                skillEvidence: latest.skillEvidence?.length ? latest.skillEvidence : fallbackInsights.evidence,
                skillHealth: latest.skillHealth?.length ? latest.skillHealth : fallbackInsights.skillHealth
            },
            versions,
            evaluation: runEvaluationBenchmark()
        });
    } catch (error) {
        console.error("Resume insights error:", error.message);
        return res.status(500).json({ error: "Unable to load resume insights" });
    }
});

module.exports = router;
