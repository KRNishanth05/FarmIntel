const http = require('http');
const { execSync } = require('child_process');

async function testWithCDP() {
    // Start Chrome in headless mode with remote debugging port
    const { requireChrome, waitForCDPPort } = require('./chrome_path.js');
    const chromePath = requireChrome();
    const port = 9222;
    const proc = require('child_process').spawn(chromePath, [
        '--headless',
        '--remote-debugging-port=' + port,
        '--disable-gpu',
        '--no-sandbox',
        'http://localhost:8080/index.html'
    ]);

    // Wait (with retry) until Chrome's DevTools endpoint answers
    await waitForCDPPort(port);

    // Get list of targets
    const listRes = await fetch(`http://127.0.0.1:${port}/json`);
    const targets = await listRes.json();
    const pageTarget = targets.find(t => t.type === 'page');
    console.log('Target found:', pageTarget.title, pageTarget.webSocketDebuggerUrl);

    const WebSocket = require('node:events'); // check if ws is available
    // Alternatively, use curl to test or evaluate
    proc.kill();
}
