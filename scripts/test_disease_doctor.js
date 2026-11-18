// Test script for Disease Doctor & Plant Health Analysis
const fs = require('fs');
const path = require('path');

console.log('Testing Plant Health, Leaf & Branch Diagnostic Engine...');

// Read script.js and extract the diseaseDB and normalize function.
// Resolve relative to this file so the test runs from any working directory.
const scriptContent = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');

// Use a mock DOM environment to verify renderPlantHealthAnalysisCard
const mockDOM = {
    elements: {
        'disease-result-area': { innerHTML: '' },
        'image-preview': { innerHTML: '' },
        'disease-results-card': { querySelector: () => ({ style: {} }) }
    },
    getElementById(id) {
        if (!this.elements[id]) this.elements[id] = { innerHTML: '', style: {} };
        return this.elements[id];
    },
    querySelector(sel) {
        return { style: {} };
    },
    addEventListener() {},
    removeEventListener() {}
};

global.document = mockDOM;
global.window = {
    addEventListener() {},
    removeEventListener() {}
};
global.speakText = () => {};
global.showToast = () => {};
global.t = (k) => k;

// Evaluate script.js in context
eval(scriptContent);

// Test 1: Verify diseaseDB
const db = window.diseaseDB;
console.log('Available Presets:', Object.keys(db));

const requiredPresets = ['healthy', 'leaf_blight', 'branch_canker', 'rust', 'powdery_mildew'];
for (const p of requiredPresets) {
    if (!db[p]) throw new Error(`Missing preset: ${p}`);
    if (typeof db[p].isHealthy !== 'boolean') throw new Error(`Preset ${p} missing boolean isHealthy`);
    if (!Array.isArray(db[p].defectsFound) || db[p].defectsFound.length === 0) throw new Error(`Preset ${p} missing defectsFound`);
    if (!Array.isArray(db[p].diseaseReductionSuggestions) || db[p].diseaseReductionSuggestions.length === 0) throw new Error(`Preset ${p} missing diseaseReductionSuggestions`);
    if (!Array.isArray(db[p].growthBetterSuggestions) || db[p].growthBetterSuggestions.length === 0) throw new Error(`Preset ${p} missing growthBetterSuggestions`);
}
console.log('✓ All 5 presets validated with healthy status, defects, disease reduction and growth suggestions.');

// Test 2: Verify renderPlantHealthAnalysisCard on Healthy preset
window.demoDisease('healthy');
let html = mockDOM.elements['disease-result-area'].innerHTML;
if (!html.includes('HEALTHY PLANT')) throw new Error('Missing HEALTHY PLANT badge in healthy rendering');
if (!html.includes('Defects &amp; Pathology Symptoms Found in Image') && !html.includes('Defects & Pathology Symptoms Found in Image')) {
    throw new Error('Missing Defects section in healthy rendering');
}
if (!html.includes('Suggestions to Reduce &amp; Eliminate Disease') && !html.includes('Suggestions to Reduce & Eliminate Disease')) {
    throw new Error('Missing Disease Reduction section in healthy rendering');
}
if (!html.includes('Suggestions to Help Crops Grow Better')) {
    throw new Error('Missing Crop Growth section in healthy rendering');
}
console.log('✓ Healthy Plant diagnosis renders all 4 required sections.');

// Test 3: Verify renderPlantHealthAnalysisCard on Branch Canker preset
window.demoDisease('branch_canker');
html = mockDOM.elements['disease-result-area'].innerHTML;
if (!html.includes('NOT HEALTHY — DEFECTS FOUND')) throw new Error('Missing NOT HEALTHY badge in branch_canker rendering');
if (!html.includes('Woody Branches, Stems &amp; Twigs') && !html.includes('Woody Branches, Stems & Twigs')) {
    throw new Error('Missing branch plant part in branch_canker rendering');
}
if (!html.includes('Suggestions to Reduce &amp; Eliminate Disease') && !html.includes('Suggestions to Reduce & Eliminate Disease')) {
    throw new Error('Missing Disease Reduction section in branch_canker rendering');
}
if (!html.includes('Suggestions to Help Crops Grow Better')) {
    throw new Error('Missing Crop Growth section in branch_canker rendering');
}
console.log('✓ Branch Canker diagnosis renders all 4 required sections.');

// Test 4: Verify custom AI Vision result format
const mockVisionResult = {
    isHealthy: false,
    displayName: "Bacterial Stem Rot & Branch Blight",
    plantPart: "Branches & Stems",
    confidence: 94,
    severity: "Severe",
    symptoms: "Water-soaked dark lesions on branch nodes with foul-smelling bacterial ooze.",
    defectsFound: [
        "Water-soaked black soft rot along lower branch junctions",
        "Vascular browning inside stem xylem",
        "Total collapse of foliage supported by diseased branch"
    ],
    diseaseReductionSuggestions: [
        "Excise infected branch 3 inches below lesion and burn debris immediately",
        "Spray Streptocycline (0.5g/L) + Copper Oxychloride (2.5g/L) to arrest bacterial spread",
        "Sterilize cutting tools with 5% Lysol or 70% alcohol between cuts"
    ],
    growthBetterSuggestions: [
        "Drench root rhizosphere with Trichoderma viride & Bacillus subtilis consortium",
        "Apply Potassium Sulphate (0:0:50 @ 5g/L) to strengthen woody stem tissue",
        "Avoid flood irrigation and improve soil drainage away from tree trunk"
    ]
};

window.renderPlantHealthAnalysisCard(mockVisionResult);
html = mockDOM.elements['disease-result-area'].innerHTML;
if (!html.includes('NOT HEALTHY — DEFECTS FOUND')) throw new Error('Missing NOT HEALTHY badge for Vision result');
if (!html.includes('Bacterial Stem Rot &amp; Branch Blight') && !html.includes('Bacterial Stem Rot & Branch Blight')) throw new Error('Missing disease name');
if (!html.includes('Water-soaked black soft rot')) throw new Error('Missing custom defect in output');
if (!html.includes('Streptocycline')) throw new Error('Missing custom disease reduction suggestion');
if (!html.includes('Potassium Sulphate')) throw new Error('Missing custom growth suggestion');
console.log('✓ Custom Vision analysis renders all defects, disease reduction steps, and crop growth recommendations perfectly!');

console.log('\n🎉 ALL PLANT HEALTH & DEFECT DETECTION TESTS PASSED SUCCESSFULLY!');
