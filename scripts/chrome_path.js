// ==============================================
// Cross-platform Chrome/Chromium/Edge locator
// Works on Windows, macOS, and Linux.
// Override with the CHROME_PATH environment
// variable if your browser is installed elsewhere:
//   Windows (PowerShell): $env:CHROME_PATH="C:\Path\to\chrome.exe"
//   macOS/Linux:          export CHROME_PATH="/path/to/chrome"
// ==============================================

const fs = require('fs');
const os = require('os');
const path = require('path');

function chromeCandidates() {
    const list = [];

    if (process.env.CHROME_PATH) {
        list.push(process.env.CHROME_PATH);
    }

    if (process.platform === 'win32') {
        // Standard install locations on Windows. Chromium and Edge are
        // included as fallbacks since they speak the same DevTools protocol.
        const programFiles = [
            process.env.PROGRAMFILES,
            process.env['PROGRAMFILES(X86)'],
            'C:\\Program Files',
            'C:\\Program Files (x86)'
        ].filter(Boolean);

        for (const base of programFiles) {
            list.push(path.join(base, 'Google', 'Chrome', 'Application', 'chrome.exe'));
            list.push(path.join(base, 'Chromium', 'Application', 'chrome.exe'));
            list.push(path.join(base, 'Microsoft', 'Edge', 'Application', 'msedge.exe'));
        }

        // Per-user Chrome install (no admin rights)
        if (process.env.LOCALAPPDATA) {
            list.push(path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe'));
            list.push(path.join(process.env.LOCALAPPDATA, 'Chromium', 'Application', 'chrome.exe'));
        }
    } else if (process.platform === 'darwin') {
        list.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
        list.push(path.join(os.homedir(), 'Applications', 'Google Chrome.app', 'Contents', 'MacOS', 'Google Chrome'));
        list.push('/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary');
        list.push('/Applications/Chromium.app/Contents/MacOS/Chromium');
        list.push('/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge');
    } else {
        // Linux
        list.push(
            '/usr/bin/google-chrome',
            '/usr/bin/google-chrome-stable',
            '/usr/bin/chromium',
            '/usr/bin/chromium-browser',
            '/snap/bin/chromium',
            '/usr/bin/microsoft-edge',
            '/usr/bin/microsoft-edge-stable'
        );
    }

    return list;
}

/**
 * Returns the full path of the first installed Chrome-compatible browser,
 * or null if none was found.
 */
function findChrome() {
    for (const candidate of chromeCandidates()) {
        try {
            if (fs.existsSync(candidate)) return candidate;
        } catch (_) {
            // Ignore unreadable/unusual paths and keep looking
        }
    }
    return null;
}

/**
 * Like findChrome(), but prints a helpful message and exits if nothing
 * was found. Use this from test scripts.
 */
function requireChrome() {
    const chromePath = findChrome();
    if (!chromePath) {
        console.error('❌ Could not find Google Chrome, Chromium, or Microsoft Edge on this system.');
        console.error('   Searched the standard install locations for ' + process.platform + '.');
        console.error('   Install Chrome, or point the CHROME_PATH env variable at your browser:');
        console.error('   Windows (PowerShell): $env:CHROME_PATH="C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"');
        console.error('   macOS / Linux:        export CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"');
        process.exit(1);
    }
    return chromePath;
}

/**
 * Waits until Chrome's DevTools endpoint answers on the given port.
 * Replaces fixed `setTimeout` sleeps, which are flaky on slower
 * Windows cold starts. Retries every 250ms until the timeout.
 */
async function waitForCDPPort(port, timeoutMs = 20000) {
    const deadline = Date.now() + timeoutMs;
    let lastError = null;
    while (Date.now() < deadline) {
        try {
            const res = await fetch(`http://127.0.0.1:${port}/json/version`);
            if (res.ok) return true;
        } catch (err) {
            lastError = err;
        }
        await new Promise(r => setTimeout(r, 250));
    }
    throw new Error(`Chrome DevTools endpoint on port ${port} did not become ready within ${timeoutMs}ms` +
        (lastError ? ` (last error: ${lastError.message})` : ''));
}

module.exports = { findChrome, requireChrome, waitForCDPPort };
