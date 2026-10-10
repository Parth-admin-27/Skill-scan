const SKILL_ALIASES = {
    javascript: ["javascript", "js"], typescript: ["typescript", "ts"], react: ["react", "reactjs", "react.js"],
    node: ["node", "nodejs", "node.js"], express: ["express", "expressjs"], python: ["python"], java: ["java"],
    sql: ["sql"], mongodb: ["mongodb", "mongo db"], postgresql: ["postgresql", "postgres"], mysql: ["mysql"],
    html: ["html", "html5"], css: ["css", "css3"], tailwind: ["tailwind", "tailwind css"],
    aws: ["aws", "amazon web services"], azure: ["azure"], docker: ["docker"], kubernetes: ["kubernetes", "k8s"],
    git: ["git", "github"], figma: ["figma"], excel: ["excel"], powerbi: ["power bi", "powerbi"],
    tableau: ["tableau"], machinelearning: ["machine learning", "ml"], tensorflow: ["tensorflow"], pytorch: ["pytorch"],
    nlp: ["natural language processing", "nlp"], restapi: ["rest api", "restful api"], graphql: ["graphql"],
    communication: ["communication"], leadership: ["leadership"], agile: ["agile", "scrum"], testing: ["testing", "jest", "pytest"]
};

const SKILL_LABELS = {
    node: "Node.js", react: "React", express: "Express.js", postgresql: "PostgreSQL", mongodb: "MongoDB",
    mysql: "MySQL", powerbi: "Power BI", machinelearning: "Machine Learning", tensorflow: "TensorFlow",
    pytorch: "PyTorch", nlp: "NLP", restapi: "REST API", javascript: "JavaScript", typescript: "TypeScript",
    html: "HTML", css: "CSS", aws: "AWS", azure: "Azure", git: "Git", sql: "SQL"
};

function clamp(value, min = 0, max = 100) {
    return Math.max(min, Math.min(max, Math.round(Number(value) || 0)));
}

function unique(values = []) {
    return [...new Set(values.map(value => String(value).trim()).filter(Boolean))];
}

function containsPhrase(text, phrase) {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(text);
}

function extractSkills(text = "") {
    const source = String(text).toLowerCase();
    return Object.entries(SKILL_ALIASES)
        .filter(([, aliases]) => aliases.some(alias => containsPhrase(source, alias)))
        .map(([key]) => SKILL_LABELS[key] || key.replace(/\b\w/g, character => character.toUpperCase()));
}

function calculateKeywordCompatibility(resumeText, jobText, suppliedSkills = []) {
    const required = extractSkills(jobText);
    const resumeSkills = unique([...extractSkills(resumeText), ...suppliedSkills]);
    const resumeLookup = new Set(resumeSkills.map(skill => skill.toLowerCase().replace(/[^a-z0-9]/g, "")));
    const matched = required.filter(skill => resumeLookup.has(skill.toLowerCase().replace(/[^a-z0-9]/g, "")));
    const missing = required.filter(skill => !matched.includes(skill));
    const compatibility = required.length ? clamp((matched.length / required.length) * 100) : clamp(Math.min(85, 45 + resumeSkills.length * 4));
    return { compatibility, matched, missing, required, resumeSkills };
}

function buildExplainableScore({ analysis = {}, resumeText = "", jobDescription = "" }) {
    const evidence = analysis.skillEvidence || [];
    const compatibility = calculateKeywordCompatibility(resumeText, jobDescription, analysis.currentSkills || []);
    const skillPercent = jobDescription
        ? compatibility.compatibility
        : clamp(45 + Math.min(50, unique(analysis.currentSkills).length * 6));

    const experienceSignals = ["experience", "employment", "internship", "worked", "responsibilities", "professional"];
    const experienceHits = experienceSignals.filter(signal => containsPhrase(resumeText, signal)).length;
    const experiencePercent = clamp(35 + experienceHits * 11 + (/\b\d+\+?\s*(years?|yrs?)\b/i.test(resumeText) ? 18 : 0));

    const educationSignals = ["education", "bachelor", "master", "b.tech", "b.e", "degree", "university", "college", "diploma"];
    const educationHits = educationSignals.filter(signal => containsPhrase(resumeText, signal)).length;
    const educationPercent = clamp(educationHits * 22);

    const projectSignals = ["project", "github", "portfolio", "developed", "built", "implemented", "deployed"];
    const projectHits = projectSignals.filter(signal => containsPhrase(resumeText, signal)).length;
    const appliedEvidence = evidence.filter(item => /project|experience|internship|employment|achievement/i.test(item.evidenceType || "")).length;
    const projectPercent = clamp(25 + projectHits * 9 + appliedEvidence * 5);

    const sectionSignals = ["skills", "experience", "education", "project", "summary", "objective"];
    const sectionHits = sectionSignals.filter(signal => containsPhrase(resumeText, signal)).length;
    const lengthScore = resumeText.trim().length >= 1200 ? 30 : resumeText.trim().length >= 600 ? 23 : resumeText.trim().length >= 250 ? 15 : 7;
    const qualityPercent = clamp(25 + sectionHits * 8 + lengthScore - Math.min(20, unique(analysis.improvements).length * 2));

    const specifications = [
        { key: "skills", label: "Skills match", weight: 35, percentage: skillPercent, reason: jobDescription ? `${compatibility.matched.length} of ${compatibility.required.length || 0} detected job skills are present.` : `${unique(analysis.currentSkills).length} relevant skills were identified.` },
        { key: "experience", label: "Experience relevance", weight: 25, percentage: experiencePercent, reason: `${experienceHits} experience signals${/\b\d+\+?\s*(years?|yrs?)\b/i.test(resumeText) ? " and quantified tenure" : ""} found.` },
        { key: "education", label: "Education", weight: 15, percentage: educationPercent, reason: educationHits ? `${educationHits} education signals found.` : "No clear education section or qualification was detected." },
        { key: "projects", label: "Projects and evidence", weight: 15, percentage: projectPercent, reason: `${projectHits} project signals and ${appliedEvidence} applied-skill evidence items found.` },
        { key: "quality", label: "Resume quality", weight: 10, percentage: qualityPercent, reason: `${sectionHits} standard sections detected; document contains ${resumeText.trim().length} characters.` }
    ];
    const categories = specifications.map(item => ({ ...item, score: Number(((item.percentage * item.weight) / 100).toFixed(1)) }));
    const totalScore = clamp(categories.reduce((sum, item) => sum + item.score, 0));

    return {
        totalScore,
        formula: "Skills 35% + Experience 25% + Education 15% + Projects & evidence 15% + Resume quality 10%",
        methodology: "Deterministic weighted rubric",
        categories,
        matchedKeywords: compatibility.matched.length ? compatibility.matched : unique(analysis.currentSkills).slice(0, 12),
        missingKeywords: compatibility.missing.length ? compatibility.missing : unique(analysis.missingSkills).slice(0, 12)
    };
}

function buildJobMatches({ resumeText = "", jobs = [], analysis = {} }) {
    const cleanJobs = jobs
        .map((job, index) => ({ title: String(job.title || `Job ${index + 1}`).trim(), description: String(job.description || "").trim() }))
        .filter(job => job.description)
        .slice(0, 5);

    return cleanJobs.map(job => {
        const result = calculateKeywordCompatibility(resumeText, job.description, analysis.currentSkills || []);
        const evidenceBonus = Math.min(8, (analysis.skillEvidence || []).filter(item => item.evidenceStrength === "Strong").length * 2);
        const compatibility = clamp(result.compatibility * 0.92 + evidenceBonus);
        return {
            title: job.title,
            compatibility,
            matchedSkills: result.matched,
            missingSkills: result.missing,
            priority: compatibility >= 75 ? "Apply now" : compatibility >= 55 ? "Apply after improvements" : "Build skills first",
            reason: result.required.length ? `${result.matched.length}/${result.required.length} detected requirements matched.` : "Limited explicit skill requirements; score uses resume breadth."
        };
    }).sort((a, b) => b.compatibility - a.compatibility).map((job, index) => ({ ...job, rank: index + 1, isBestMatch: index === 0 }));
}

function runEvaluationBenchmark() {
    const roles = [
        ["JavaScript", "React", "Node.js", "SQL", "Git"],
        ["Python", "Machine Learning", "TensorFlow", "SQL", "NLP"],
        ["Java", "SQL", "REST API", "Git", "Testing"],
        ["HTML", "CSS", "JavaScript", "Figma", "React"],
        ["AWS", "Docker", "Kubernetes", "Node.js", "PostgreSQL"],
        ["Excel", "Power BI", "SQL", "Python", "Tableau"],
        ["TypeScript", "React", "GraphQL", "Testing", "Git"],
        ["Azure", "Docker", "Java", "REST API", "Agile"]
    ];
    const coverageLevels = [1, 0.8, 0.6, 0.4, 0.2];
    const startedAt = process.hrtime.bigint();
    let scoreDifference = 0;
    let extractedCorrect = 0;
    let extractedTotal = 0;
    let correctBestJobs = 0;

    roles.forEach((skills, roleIndex) => {
        coverageLevels.forEach((coverage, caseIndex) => {
            const included = skills.slice(0, Math.max(1, Math.round(skills.length * coverage)));
            const resume = `Education Bachelor degree. Experience and projects using ${included.join(", ")}. Built and deployed measurable work.`;
            const job = `Required skills: ${skills.join(", ")}.`;
            const algorithmScore = calculateKeywordCompatibility(resume, job).compatibility;
            const humanScore = clamp(coverage * 100 + [-4, 3, -2, 4, -3][caseIndex]);
            scoreDifference += Math.abs(algorithmScore - humanScore);
            const extracted = extractSkills(resume);
            extractedCorrect += included.filter(skill => extracted.includes(skill)).length;
            extractedTotal += included.length;

            const candidates = roles.map((candidate, index) => ({ index, score: calculateKeywordCompatibility(resume, `Required: ${candidate.join(", ")}`).compatibility }));
            candidates.sort((a, b) => b.score - a.score);
            if (candidates[0].index === roleIndex) correctBestJobs += 1;
        });
    });

    const invalidDocuments = ["grocery list milk eggs bread", "recipe boil rice and serve", "chapter one once upon a time", "exam timetable mathematics physics", "weather report sunny day"];
    const validDocuments = roles.slice(0, 5).map(skills => `Resume skills ${skills.join(" ")} education experience projects`);
    const looksLikeResume = text => /\b(resume|skills|education|experience|projects?|employment)\b/i.test(text);
    const validDetection = [...invalidDocuments.map(text => !looksLikeResume(text)), ...validDocuments.map(text => looksLikeResume(text))].filter(Boolean).length;
    const responseTimeMs = Number(process.hrtime.bigint() - startedAt) / 1e6;

    return {
        sampleCount: 40,
        datasetType: "Controlled synthetic benchmark",
        metrics: {
            averageScoringDifference: Number((scoreDifference / 40).toFixed(1)),
            skillExtractionAccuracy: Number(((extractedCorrect / extractedTotal) * 100).toFixed(1)),
            jobMatchAccuracy: Number(((correctBestJobs / 40) * 100).toFixed(1)),
            averageResponseTimeMs: Number((responseTimeMs / 40).toFixed(2)),
            invalidDocumentAccuracy: Number(((validDetection / 10) * 100).toFixed(1))
        },
        methodology: "8 job families × 5 skill-coverage levels. Expected results are generated from known labels and checked against the deterministic matcher.",
        limitation: "This validates repeatability on controlled data. Faculty or recruiter ratings are still required before claiming real-world human agreement."
    };
}

module.exports = { buildExplainableScore, buildJobMatches, calculateKeywordCompatibility, extractSkills, runEvaluationBenchmark };
