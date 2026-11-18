const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { requireChrome, waitForCDPPort } = require('./chrome_path.js');

async function runE2E() {
    console.log('🚀 Starting Chrome in headless mode with remote debugging...');
    const chromePath = requireChrome();
    const port = 9333;
    const chromeProc = spawn(chromePath, [
        '--headless',
        `--remote-debugging-port=${port}`,
        '--disable-gpu',
        '--no-sandbox',
        '--window-size=1280,960',
        'http://localhost:8080/index.html'
    ]);

    try {
        await waitForCDPPort(port);
        const res = await fetch(`http://127.0.0.1:${port}/json`);
        const pages = await res.json();
        const page = pages.find(p => p.type === 'page');
        if (!page) throw new Error('No page target found');

        console.log('Connecting to WebSocket:', page.webSocketDebuggerUrl);
        const ws = new WebSocket(page.webSocketDebuggerUrl);

        let msgId = 1;
        const pending = new Map();
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.id && pending.has(data.id)) {
                pending.get(data.id)(data);
                pending.delete(data.id);
            }
        };

        await new Promise((resolve) => ws.onopen = resolve);

        function send(method, params = {}) {
            return new Promise((resolve) => {
                const id = msgId++;
                pending.set(id, resolve);
                ws.send(JSON.stringify({ id, method, params }));
            });
        }

        async function evaluate(expression) {
            const res = await send('Runtime.evaluate', {
                expression,
                returnByValue: true,
                awaitPromise: true
            });
            return res.result?.result?.value;
        }

        console.log('--- TEST 1: Initial Page State ---');
        const badgeExists = await evaluate('!!document.getElementById("datasetBadge")');
        console.log('Dataset badge exists:', badgeExists); // should be false

        const districtOptionText = await evaluate(`
            const s = document.getElementById("farm-district");
            s ? s.options[s.selectedIndex]?.text : null;
        `);
        console.log('Selected district option text:', districtOptionText); // clean name, no "(36 dataset records)"

        const hasEmptyCard = await evaluate('!!document.querySelector(".empty-rec-card")');
        console.log('Initial empty state card shown:', hasEmptyCard); // true

        const hasRecCard = await evaluate('!!document.querySelector(".rec-result-card")');
        console.log('Full recommendation card shown initially:', hasRecCard); // false

        console.log('--- TEST 2: Click Get Crop Recommendations ---');
        await evaluate('document.getElementById("recommendBtn").click()');
        await new Promise(r => setTimeout(r, 1000));

        const recCardAfterClick = await evaluate('!!document.querySelector(".top-rec-card")');
        console.log('Recommendation card displayed after click:', recCardAfterClick); // true

        const topCropTitle = await evaluate('document.querySelector(".rec-crop-name")?.textContent?.trim()');
        console.log('Top recommended crop title:', topCropTitle);

        const recProfit = await evaluate('document.querySelector(".profit-range")?.textContent?.trim()');
        console.log('Expected net profit:', recProfit);

        console.log('--- TEST 3: AI Chat Box Verification ---');
        // Open chat panel
        await evaluate('toggleChat()');
        await new Promise(r => setTimeout(r, 500));

        const isChatOpen = await evaluate('document.getElementById("chatPanel")?.classList.contains("open")');
        console.log('Chat panel open:', isChatOpen);

        // Send a question: "what fertilizer for cotton?"
        await evaluate(`
            document.getElementById('chatInput').value = "what fertilizer for cotton?";
            sendChatMessage();
        `);

        // Wait 1.5 seconds for typing indicator and response
        await new Promise(r => setTimeout(r, 1500));

        const chatBotResponses = await evaluate(`
            Array.from(document.querySelectorAll('#chatMessages .chat-message.bot .chat-bubble'))
                .map(el => el.innerHTML);
        `);
        console.log('Bot messages count:', chatBotResponses.length);
        console.log('Bot answer:\n', chatBotResponses[chatBotResponses.length - 1]);

        // Send a second question: "how to grow sugarcane?"
        await evaluate(`
            document.getElementById('chatInput').value = "how to grow sugarcane?";
            sendChatMessage();
        `);
        await new Promise(r => setTimeout(r, 1500));

        const chatBotResponses2 = await evaluate(`
            Array.from(document.querySelectorAll('#chatMessages .chat-message.bot .chat-bubble'))
                .map(el => el.innerHTML);
        `);
        console.log('Bot answer 2:\n', chatBotResponses2[chatBotResponses2.length - 1]);

        // Capture screenshot of recommended card and chat
        const shot = await send('Page.captureScreenshot', { format: 'png' });
        const screenshotPath = path.join(__dirname, '..', 'scratch', 'preview_recommendation_fixed.png');
        fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
        fs.writeFileSync(screenshotPath, Buffer.from(shot.result.data, 'base64'));
        console.log('✅ Screenshot saved to preview_recommendation_fixed.png');

        ws.close();
    } finally {
        chromeProc.kill();
    }
}

runE2E().catch(err => {
    console.error('E2E test failed:', err);
    process.exit(1);
});
