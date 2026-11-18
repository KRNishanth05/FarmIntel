const { spawn } = require('child_process');
const { requireChrome, waitForCDPPort } = require('./chrome_path.js');

async function testConsole() {
    const chromePath = requireChrome();
    const port = 9334;
    const chromeProc = spawn(chromePath, [
        '--headless',
        `--remote-debugging-port=${port}`,
        '--disable-gpu',
        '--no-sandbox',
        'http://localhost:8080/index.html'
    ]);

    try {
        await waitForCDPPort(port);
        const res = await fetch(`http://127.0.0.1:${port}/json`);
        const pages = await res.json();
        const page = pages.find(p => p.type === 'page');

        const ws = new WebSocket(page.webSocketDebuggerUrl);
        let msgId = 1;
        const pending = new Map();
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.method === 'Runtime.consoleAPICalled') {
                console.log('BROWSER LOG:', data.params.type, data.params.args.map(a => a.value || a.description).join(' '));
            }
            if (data.method === 'Runtime.exceptionThrown') {
                console.error('BROWSER EXCEPTION:', data.params.exceptionDetails);
            }
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

        await send('Runtime.enable');

        console.log('Calling generateFarmPlan()...');
        const evalRes = await send('Runtime.evaluate', {
            expression: `
                try {
                    generateFarmPlan();
                    "generateFarmPlan executed successfully";
                } catch(e) {
                    "ERROR in generateFarmPlan: " + e.stack;
                }
            `,
            returnByValue: true
        });
        console.log('Result:', evalRes.result?.result?.value);

        const cardHtml = await send('Runtime.evaluate', {
            expression: `document.getElementById('crop-result-area')?.innerHTML?.slice(0, 300)`,
            returnByValue: true
        });
        console.log('crop-result-area content:\n', cardHtml.result?.result?.value);

        console.log('\nTesting chat message...');
        const chatRes = await send('Runtime.evaluate', {
            expression: `
                try {
                    document.getElementById('chatInput').value = "what fertilizer for cotton?";
                    sendChatMessage();
                    "sendChatMessage called";
                } catch(e) {
                    "ERROR in sendChatMessage: " + e.stack;
                }
            `,
            returnByValue: true
        });
        console.log('Chat send result:', chatRes.result?.result?.value);

        await new Promise(r => setTimeout(r, 1200));

        const messages = await send('Runtime.evaluate', {
            expression: `
                Array.from(document.querySelectorAll('#chatMessages .chat-bubble'))
                    .map(el => el.textContent.trim())
            `,
            returnByValue: true
        });
        console.log('Chat messages:', messages.result?.result?.value);

        ws.close();
    } finally {
        chromeProc.kill();
    }
}

testConsole().catch(console.error);
