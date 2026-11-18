// End-to-End Chrome DevTools Protocol (CDP) Automated Test Suite for FarmIntel
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const CDP_PORT = 9333;
const APP_URL = 'http://localhost:8080/index.html';

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        http.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); } catch (err) { reject(err); }
            });
        }).on('error', reject);
    });
}

async function runE2ETests() {
    console.log('🚀 Starting Chrome E2E DevTools Protocol (CDP) Test Suite...');

    if (!fs.existsSync(CHROME_PATH)) {
        throw new Error(`Chrome binary not found at ${CHROME_PATH}`);
    }

    const tempDir = path.join(os.tmpdir(), 'chrome_cdp_test_' + Date.now());
    fs.mkdirSync(tempDir, { recursive: true });

    const chrome = spawn(CHROME_PATH, [
        '--headless=new',
        `--remote-debugging-port=${CDP_PORT}`,
        '--disable-gpu',
        '--no-sandbox',
        `--user-data-dir=${tempDir}`
    ], { stdio: 'ignore' });

    // Ensure chrome is terminated on exit
    const cleanup = () => {
        try { chrome.kill(); } catch (_) {}
        try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (_) {}
    };
    process.on('exit', cleanup);
    process.on('SIGINT', () => { cleanup(); process.exit(1); });

    console.log(`Waiting for Chrome debugger on port ${CDP_PORT}...`);
    let pageTarget = null;
    for (let i = 0; i < 30; i++) {
        await sleep(300);
        try {
            const list = await fetchJson(`http://127.0.0.1:${CDP_PORT}/json/list`);
            if (Array.isArray(list) && list.length > 0) {
                pageTarget = list.find(t => t.type === 'page') || list[0];
                if (pageTarget && pageTarget.webSocketDebuggerUrl) break;
            }
        } catch (_) {}
    }

    if (!pageTarget || !pageTarget.webSocketDebuggerUrl) {
        cleanup();
        throw new Error('Failed to find page target in Chrome');
    }

    console.log('✓ Connected to Chrome CDP Page Target:', pageTarget.title || pageTarget.url);

    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
    let msgId = 1;
    const callbacks = new Map();

    ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id && callbacks.has(msg.id)) {
            const { resolve, reject } = callbacks.get(msg.id);
            callbacks.delete(msg.id);
            if (msg.error) reject(new Error(msg.error.message));
            else resolve(msg.result);
        }
    };

    await new Promise((resolve, reject) => {
        ws.onopen = resolve;
        ws.onerror = reject;
    });

    function send(method, params = {}) {
        return new Promise((resolve, reject) => {
            const id = msgId++;
            callbacks.set(id, { resolve, reject });
            ws.send(JSON.stringify({ id, method, params }));
        });
    }

    async function evaluate(expression, awaitPromise = false) {
        const res = await send('Runtime.evaluate', {
            expression,
            returnByValue: true,
            awaitPromise
        });
        if (res.exceptionDetails) {
            throw new Error(`CDP Eval error: ${JSON.stringify(res.exceptionDetails)}`);
        }
        return res.result ? res.result.value : undefined;
    }

    try {
        await send('Page.enable');
        await send('Runtime.enable');

        console.log(`Navigating to ${APP_URL}...`);
        await send('Page.navigate', { url: APP_URL });
        await sleep(2500);

        // TEST 1: Check Page Title and Global Environment
        const title = await evaluate('document.title');
        console.log(`✓ Page Loaded: "${title}"`);
        if (!title.toLowerCase().includes('farmintel')) {
            throw new Error(`Unexpected page title: ${title}`);
        }

        // TEST 2: Verify Disease Diagnostic Doctor functions and elements
        const doctorCheck = await evaluate(`
            ({
                hasDiseaseDB: Boolean(window.diseaseDB && Object.keys(window.diseaseDB).length >= 5),
                hasDetectDisease: typeof window.detectDisease === 'function',
                hasDemoDisease: typeof window.demoDisease === 'function',
                hasPreviewImage: typeof window.previewImage === 'function',
                hasClearUploadedImage: typeof window.clearUploadedImage === 'function',
                hasInitDropzone: typeof window.initLeafDropzone === 'function',
                dropzoneEl: Boolean(document.getElementById('leaf-dropzone')),
                fileInputEl: Boolean(document.getElementById('leaf-image')),
                previewEl: Boolean(document.getElementById('image-preview')),
                resultAreaEl: Boolean(document.getElementById('disease-result-area'))
            })
        `);
        console.log('✓ Component & Global Function Check:', doctorCheck);
        for (const [key, val] of Object.entries(doctorCheck)) {
            if (!val) throw new Error(`Missing expected element or function: ${key}`);
        }

        // TEST 3: Test Preset Buttons
        console.log('Testing Diagnostic Presets...');
        const presets = ['healthy', 'leaf_blight', 'branch_canker', 'rust', 'powdery_mildew'];
        for (const preset of presets) {
            await evaluate(`window.demoDisease('${preset}')`);
            await sleep(150);
            const cardInfo = await evaluate(`
                ({
                    html: document.getElementById('disease-result-area').innerHTML,
                    hasDefectsSection: document.getElementById('disease-result-area').innerHTML.includes('Defects'),
                    hasReductionSection: document.getElementById('disease-result-area').innerHTML.includes('Reduce'),
                    hasGrowthSection: document.getElementById('disease-result-area').innerHTML.includes('Grow Better'),
                    statusBadge: document.getElementById('disease-result-area').querySelector('span')?.innerText || ''
                })
            `);

            if (!cardInfo.hasDefectsSection || !cardInfo.hasReductionSection || !cardInfo.hasGrowthSection) {
                throw new Error(`Preset ${preset} failed to render all 4 sections`);
            }
            console.log(`  ✓ Preset [${preset}] rendered successfully.`);
        }

        // TEST 4: Test Real Image Ingestion with assets/tomato.jpg
        console.log('Testing Real Asset Ingestion (assets/tomato.jpg)...');
        const tomatoPath = path.join(__dirname, '..', 'assets', 'tomato.jpg');
        const tomatoBuffer = fs.readFileSync(tomatoPath);
        const tomatoBase64 = tomatoBuffer.toString('base64');
        const tomatoDataUrl = `data:image/jpeg;base64,${tomatoBase64}`;

        const uploadResult = await evaluate(`
            new Promise((resolve) => {
                const dataUrl = "${tomatoDataUrl}";

                // Construct real File from binary base64
                const binary = atob("${tomatoBase64}");
                const array = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
                const file = new File([array], "tomato.jpg", { type: "image/jpeg" });

                // Test Drop Event Simulation on #leaf-dropzone
                const dropzone = document.getElementById('leaf-dropzone');
                const dt = new DataTransfer();
                dt.items.add(file);
                const dropEv = new DragEvent('drop', {
                    bubbles: true,
                    cancelable: true,
                    dataTransfer: dt
                });
                dropzone.dispatchEvent(dropEv);

                setTimeout(() => {
                    const previewHtml = document.getElementById('image-preview').innerHTML;
                    const hasDropzoneClass = document.getElementById('leaf-dropzone').classList.contains('has-file');
                    resolve({
                        hasImg: previewHtml.includes('<img'),
                        hasFileName: previewHtml.includes('tomato.jpg'),
                        hasDropzoneClass: hasDropzoneClass
                    });
                }, 200);
            })
        `, true);

        console.log('✓ Image Preview Render Check:', uploadResult);
        if (!uploadResult.hasImg || !uploadResult.hasDropzoneClass) {
            throw new Error('Image preview failed to mount properly');
        }

        // TEST 5: Execute Disease Detection on Tomato Asset
        console.log('Running Scan Plant Health & Detect Defects on Tomato...');
        await evaluate(`window.detectDisease()`, true);
        await sleep(400);

        const diagnosticCard = await evaluate(`
            ({
                html: document.getElementById('disease-result-area').innerHTML,
                displayName: document.querySelector('#disease-result-area h3')?.innerText || '',
                isHealthyBadge: document.getElementById('disease-result-area').innerHTML.includes('HEALTHY PLANT'),
                isDefectsBadge: document.getElementById('disease-result-area').innerHTML.includes('NOT HEALTHY — DEFECTS FOUND'),
                hasDefectsList: document.getElementById('disease-result-area').innerHTML.includes('Defects &amp; Pathology Symptoms Found in Image') || document.getElementById('disease-result-area').innerHTML.includes('Defects & Pathology Symptoms Found in Image'),
                hasTreatmentList: document.getElementById('disease-result-area').innerHTML.includes('Suggestions to Reduce &amp; Eliminate Disease') || document.getElementById('disease-result-area').innerHTML.includes('Suggestions to Reduce & Eliminate Disease'),
                hasGrowthBoostList: document.getElementById('disease-result-area').innerHTML.includes('Suggestions to Help Crops Grow Better')
            })
        `);

        console.log('✓ Tomato Diagnostic Analysis Result:', {
            displayName: diagnosticCard.displayName,
            isHealthy: diagnosticCard.isHealthyBadge,
            hasDefects: diagnosticCard.hasDefectsList,
            hasTreatment: diagnosticCard.hasTreatmentList,
            hasGrowthBoost: diagnosticCard.hasGrowthBoostList
        });

        if (!diagnosticCard.displayName) throw new Error('Missing diagnosis title');
        if (!diagnosticCard.hasDefectsList || !diagnosticCard.hasTreatmentList || !diagnosticCard.hasGrowthBoostList) {
            throw new Error('Tomato diagnostic card missing required sections');
        }

        // TEST 5B: Test with Grapes Image (assets/grapes.jpg)
        console.log('Testing Real Asset Ingestion (assets/grapes.jpg)...');
        const grapesPath = path.join(__dirname, '..', 'assets', 'grapes.jpg');
        const grapesBuffer = fs.readFileSync(grapesPath);
        const grapesBase64 = grapesBuffer.toString('base64');
        const grapesDataUrl = `data:image/jpeg;base64,${grapesBase64}`;

        await evaluate(`
            new Promise((resolve) => {
                const dataUrl = "${grapesDataUrl}";
                window._activePlantImageDataUrl = dataUrl;
                window._activePlantImageFile = { name: "grapes.jpg", size: ${grapesBuffer.length} };
                window.previewImage(dataUrl);
                setTimeout(resolve, 150);
            })
        `, true);

        await evaluate(`window.detectDisease()`, true);
        await sleep(300);

        const grapesCard = await evaluate(`
            ({
                displayName: document.querySelector('#disease-result-area h3')?.innerText || '',
                isHealthy: document.getElementById('disease-result-area').innerHTML.includes('HEALTHY PLANT'),
                hasDefects: document.getElementById('disease-result-area').innerHTML.includes('Defects'),
                hasTreatment: document.getElementById('disease-result-area').innerHTML.includes('Suggestions to Reduce') || document.getElementById('disease-result-area').innerHTML.includes('Suggestions to Help')
            })
        `);
        console.log('✓ Grapes Diagnostic Result:', grapesCard);
        if (!grapesCard.displayName || !grapesCard.hasTreatment) {
            throw new Error('Grapes diagnostic analysis failed');
        }

        // TEST 6: Test Clear / Remove Image Button
        console.log('Testing Image Removal / Reset Workflow...');
        await evaluate(`window.clearUploadedImage()`);
        const clearedState = await evaluate(`
            ({
                previewEmpty: document.getElementById('image-preview').innerHTML === '',
                hasFileClass: document.getElementById('leaf-dropzone').classList.contains('has-file'),
                activeDataUrlNull: window._activePlantImageDataUrl === null,
                activeFileNull: window._activePlantImageFile === null
            })
        `);
        console.log('✓ Clear Image Reset Check:', clearedState);
        if (!clearedState.previewEmpty || clearedState.hasFileClass || !clearedState.activeDataUrlNull) {
            throw new Error('Clear image did not reset state completely');
        }

        // TEST 7: Test Soil Health Card Detection & Auto-Calibration
        console.log('Testing Soil Health Card Analysis & Auto-Configuration...');
        const shcResult = await evaluate(`
            new Promise(async (resolve) => {
                // Synthetic lab report document (white paper + high contrast text)
                const canvas = document.createElement('canvas');
                canvas.width = 128;
                canvas.height = 128;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#f8f9fa';
                ctx.fillRect(0, 0, 128, 128);
                ctx.fillStyle = '#0f172a';
                ctx.font = 'bold 12px sans-serif';
                ctx.fillText('GOVERNMENT OF INDIA', 8, 22);
                ctx.fillText('SOIL HEALTH CARD', 8, 42);
                ctx.fillText('N: 245 kg/ha P: 24 K: 215 pH: 6.8', 8, 64);
                ctx.fillText('SOIL TEST REPORT', 8, 86);
                ctx.fillText('ORGANIC CARBON: 0.58%', 8, 108);

                const dataUrl = canvas.toDataURL('image/png');
                window._activePlantImageDataUrl = dataUrl;
                window._activePlantImageFile = { name: "soil_health_card.png", size: 45000 };

                await window.detectDisease();

                const resultHtml = document.getElementById('disease-result-area').innerHTML;
                const nVal = document.getElementById('n') ? document.getElementById('n').value : null;
                const pVal = document.getElementById('p') ? document.getElementById('p').value : null;
                const kVal = document.getElementById('k') ? document.getElementById('k').value : null;
                const phVal = document.getElementById('ph') ? document.getElementById('ph').value : null;
                resolve({
                    hasShcTitle: resultHtml.includes('Soil Health Card Extracted Successfully'),
                    n: nVal,
                    p: pVal,
                    k: kVal,
                    ph: phVal
                });
            })
        `, true);

        console.log('✓ Soil Health Card Calibration Result:', shcResult);
        if (!shcResult.hasShcTitle) {
            throw new Error('Soil Health Card detection failed to trigger card rendering');
        }
        if (Number(shcResult.n) !== 245 || Number(shcResult.p) !== 24 || Number(shcResult.k) !== 215) {
            throw new Error(`Soil parameters not calibrated correctly: N=${shcResult.n}, P=${shcResult.p}, K=${shcResult.k}`);
        }

        console.log('\n🎉 ALL HEADLESS CHROME E2E CDP TESTS PASSED WITH 100% SUCCESS!');
    } finally {
        ws.close();
        cleanup();
    }
}

runE2ETests().catch(err => {
    console.error('❌ E2E Test Failed:', err);
    process.exit(1);
});
