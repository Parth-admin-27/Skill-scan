const assert = require("node:assert/strict");
const { buildExplainableScore, buildJobMatches, runEvaluationBenchmark } = require("./lib/resumeScoring");

const analysis = {
    currentSkills: ["React", "Node.js", "SQL", "Git"],
    missingSkills: ["Docker"],
    improvements: ["Add measurable outcomes"],
    skillEvidence: [
        { skill: "React", evidenceType: "Project", evidenceStrength: "Strong" },
        { skill: "Node.js", evidenceType: "Experience", evidenceStrength: "Strong" }
    ]
};
const resumeText = "Education Bachelor degree. Experience: developed and deployed a React and Node.js project using SQL and Git for 2 years.";
const breakdown = buildExplainableScore({ analysis, resumeText, jobDescription: "React Node.js SQL Docker Git" });

assert.equal(breakdown.categories.length, 5);
assert.equal(breakdown.categories.reduce((sum, item) => sum + item.weight, 0), 100);
assert.ok(breakdown.totalScore >= 0 && breakdown.totalScore <= 100);
assert.deepEqual(breakdown.missingKeywords, ["Docker"]);

const matches = buildJobMatches({
    resumeText,
    analysis,
    jobs: [
        { title: "Full-stack Developer", description: "React Node.js SQL Git" },
        { title: "Data Scientist", description: "Python TensorFlow NLP" }
    ]
});
assert.equal(matches.length, 2);
assert.equal(matches[0].title, "Full-stack Developer");
assert.equal(matches[0].isBestMatch, true);
assert.ok(matches[0].compatibility > matches[1].compatibility);

const benchmark = runEvaluationBenchmark();
assert.equal(benchmark.sampleCount, 40);
assert.ok(benchmark.metrics.skillExtractionAccuracy >= 90);
assert.ok(benchmark.metrics.invalidDocumentAccuracy >= 90);

console.log("Resume scoring tests passed.");
