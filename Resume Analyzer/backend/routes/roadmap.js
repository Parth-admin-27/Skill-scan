const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");


require("dotenv").config();

let roadmapData = {};

try {
    const data = fs.readFileSync(path.join(__dirname, "../roadmaps.json"), "utf8");
    roadmapData = JSON.parse(data);
} catch (error) {
    console.error("Error loading roadmaps.json:", error);
}

const GROQ_API_KEY = process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY;
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

if (groq) {
    console.log("✅ Groq API configured successfully");
} else {
    console.log("⚠️ Groq API not configured - using generic roadmaps");
}

async function generateAIRoadmap(career) {
    if (!groq) {
        console.log("⚠️ Groq not configured, using generic roadmap for:", career);
        return generateGenericRoadmap(career);
    }

    console.log("🤖 Generating AI roadmap for:", career);
    try {
        const prompt = `Create a 6-step career roadmap for "${career}". Return ONLY valid JSON:
{"title":"${career}","description":"short inspiring desc","steps":[{"title":"Step with emoji","description":"What to learn","level":"Beginner/Intermediate/Expert","duration":"Time","tags":["tag1","tag2"],"icon":"font-awesome-icon-name-no-prefix"}]}
Make it highly actionable.`;

        const completion = await callGroqWithFallback({
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
            max_tokens: 1200
        });

        const responseText = completion.choices[0].message.content.trim();
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        
        if (jsonMatch) {
            const roadmap = JSON.parse(jsonMatch[0]);
            
            // Ensure icons have fa- prefix
            if (roadmap.steps) {
                roadmap.steps = roadmap.steps.map(step => ({
                    ...step,
                    icon: step.icon.startsWith('fa-') ? step.icon : `fa-${step.icon}`
                }));
            }
            
            return roadmap;
        } else {
            throw new Error("Invalid JSON response from Groq/Llama");
        }
    } catch (error) {
        console.error("❌ Groq API Error:", error.message);
        console.log("🔄 Falling back to generic roadmap");
        return generateGenericRoadmap(career);
    }
}

function generateGenericRoadmap(career) {
    const careerTitle = career.charAt(0).toUpperCase() + career.slice(1);
    const careerLower = career.toLowerCase();
    
    // Enhanced roadmap with more detailed and attractive steps
    const roadmapSteps = [
        {
            title: "🎯 Discover & Explore",
            description: `Begin your journey into ${career} by exploring what the role entails, understanding industry trends, and identifying the key skills required. Research successful professionals and learn from their career paths.`,
            level: "Beginner",
            duration: "2-4 Weeks",
            tags: ["Research", "Career Planning", "Industry Insights"],
            icon: "fa-compass"
        },
        {
            title: "📚 Master the Fundamentals",
            description: `Build a strong foundation by learning core concepts, terminology, and essential knowledge for ${career}. Take online courses, read books, and follow industry leaders to understand the basics thoroughly.`,
            level: "Beginner",
            duration: "2-3 Months",
            tags: ["Basics", "Foundation", "Learning"],
            icon: "fa-book-open"
        },
        {
            title: "💪 Develop Core Skills",
            description: `Focus on building technical and practical skills specific to ${career}. Practice daily, work on tutorials, and complete structured courses to strengthen your capabilities.`,
            level: "Intermediate",
            duration: "3-4 Months",
            tags: ["Skills Development", "Practice", "Training"],
            icon: "fa-dumbbell"
        },
        {
            title: "🛠️ Build Real Projects",
            description: `Apply your knowledge by creating real-world projects that solve actual problems. Build a portfolio showcasing your work, contribute to open-source, or take on freelance projects to gain hands-on experience.`,
            level: "Intermediate",
            duration: "4-6 Months",
            tags: ["Projects", "Portfolio", "Hands-on"],
            icon: "fa-hammer"
        },
        {
            title: "🚀 Master Advanced Concepts",
            description: `Deep dive into advanced topics, specialized areas, and cutting-edge technologies in ${career}. Learn industry best practices, optimization techniques, and stay updated with latest trends.`,
            level: "Advanced",
            duration: "3-5 Months",
            tags: ["Advanced", "Specialization", "Expertise"],
            icon: "fa-rocket"
        },
        {
            title: "🎓 Get Certified & Network",
            description: `Obtain relevant professional certifications to validate your skills. Attend conferences, join communities, connect with industry professionals on LinkedIn, and build meaningful relationships.`,
            level: "Advanced",
            duration: "2-3 Months",
            tags: ["Certification", "Networking", "Community"],
            icon: "fa-award"
        },
        {
            title: "💼 Land Your Dream Job",
            description: `Polish your resume, create an impressive LinkedIn profile, prepare for technical and behavioral interviews, and start applying for ${career} positions. Practice mock interviews and negotiate your offers confidently.`,
            level: "Ready",
            duration: "1-2 Months",
            tags: ["Job Search", "Interview Prep", "Career Launch"],
            icon: "fa-briefcase"
        },
        {
            title: "📈 Continuous Growth",
            description: `Keep learning and evolving in your ${career} journey. Stay updated with industry changes, mentor others, contribute to the community, and continuously improve your skills to advance in your career.`,
            level: "Expert",
            duration: "Ongoing",
            tags: ["Growth", "Mentorship", "Leadership"],
            icon: "fa-chart-line"
        }
    ];
    
    return {
        title: careerTitle,
        description: `🌟 A comprehensive, step-by-step learning path designed to help you become a successful ${career}. Follow this roadmap to transform your career aspirations into reality!`,
        steps: roadmapSteps
    };
}

router.get("/", async (req, res) => {
    const { career } = req.query;

    if (!career) {
        return res.status(400).json({ error: "Career parameter is required" });
    }

    const careerKey = career.trim();
    let roadmap = roadmapData[careerKey];

    if (!roadmap) {
        const lowerKey = Object.keys(roadmapData).find(k => k.toLowerCase() === careerKey.toLowerCase());
        if (lowerKey) {
            roadmap = roadmapData[lowerKey];
        }
    }

    if (!roadmap) {
        // Use AI to generate roadmap if OpenAI is configured
        roadmap = await generateAIRoadmap(career);
    }

    res.json(roadmap);
});

module.exports = router;
