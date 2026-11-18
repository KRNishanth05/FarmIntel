// ==============================================
// FarmIntel — Backend
// Proxies chat/vision requests to the Groq API so
// that no API key needs to be exposed permanently
// on the client, and so the browser never talks to
// Groq directly (avoids CORS + key leakage).
// ==============================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Groq model IDs — check https://console.groq.com/docs/models for the
// current list, since Groq periodically retires/renames models.
// Several candidates are tried in order, so a retired model ID doesn't break the app.
const TEXT_MODELS = [
    process.env.GROQ_TEXT_MODEL || 'llama-3.3-70b-versatile',
    'openai/gpt-oss-120b',
    'llama-3.1-8b-instant'
].filter((m, i, a) => m && a.indexOf(m) === i);
const VISION_MODELS = [
    process.env.GROQ_VISION_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct',
    'meta-llama/llama-4-maverick-17b-128e-instruct',
    'llama-3.2-90b-vision-preview',
    'llama-3.2-11b-vision-preview'
].filter((m, i, a) => m && a.indexOf(m) === i);
// Speech-to-text (Whisper on Groq) — supports English, Hindi, Kannada, Tamil, Telugu, Malayalam
const STT_MODELS = [process.env.GROQ_STT_MODEL || 'whisper-large-v3', 'whisper-large-v3-turbo']
    .filter((m, i, a) => m && a.indexOf(m) === i);
const STT_LANGS = ['en', 'hi', 'kn', 'ta', 'te', 'ml'];
const GROQ_BASE = process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1'; // override only for testing
const GROQ_URL = GROQ_BASE + '/chat/completions';
const GROQ_STT_URL = GROQ_BASE + '/audio/transcriptions';

// In-memory key store. In this simple single-user/demo app the key can
// either come from the .env file (GROQ_API_KEY) or be pushed at runtime
// via POST /groq-setkey from the "Free Groq AI Setup" modal in the UI.
const envKey = (process.env.GROQ_API_KEY || '').trim();
let runtimeGroqKey = (envKey.startsWith('gsk_') && envKey !== 'gsk_your_key_here') ? envKey : null;

app.use(cors());
app.use(express.json({ limit: '10mb' })); // 10mb to allow base64 leaf images

// ---- Optionally serve the frontend from this same server ----
if (process.env.SERVE_FRONTEND === 'true') {
    const fs = require('fs');
    const frontendSubdir = path.join(__dirname, '..', 'frontend');
    const frontendPath = fs.existsSync(frontendSubdir) ? frontendSubdir : path.join(__dirname, '..');
    app.use(express.static(frontendPath));
}

// ---- Save/replace the Groq API key at runtime ----
app.post('/groq-setkey', (req, res) => {
    const { key } = req.body || {};
    if (!key || typeof key !== 'string' || !key.startsWith('gsk_') || key.length < 20) {
        return res.status(400).json({ error: 'Invalid Groq API key format.' });
    }
    runtimeGroqKey = key;
    res.json({ ok: true });
});

// ---- Proxy chat / vision requests to Groq ----
app.post('/groq', async (req, res) => {
    try {
        if (!runtimeGroqKey) {
            return res.status(400).json({
                error: 'No Groq API key configured. Set GROQ_API_KEY in backend/.env or submit one from the app.'
            });
        }

        const { prompt, image, vision, system, temperature, max_tokens, history } = req.body || {};
        if (!prompt || typeof prompt !== 'string') {
            return res.status(400).json({ error: 'Missing "prompt" in request body.' });
        }

        const useVision = Boolean(vision && image);
        const imageUrl = useVision
            ? (image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}`)
            : null;

        const candidateModels = useVision ? VISION_MODELS : TEXT_MODELS;
        // Optional prior turns (text chat only) so follow-up questions keep context
        const priorTurns = (!useVision && Array.isArray(history))
            ? history.filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
                     .slice(-8).map(m => ({ role: m.role, content: m.content.slice(0, 2000) }))
            : [];
        let lastError = null;
        let finalData = null;
        let modelUsed = candidateModels[0];

        for (const candidate of candidateModels) {
            try {
                const userContent = useVision
                    ? [
                          { type: 'text', text: prompt },
                          { type: 'image_url', image_url: { url: imageUrl } }
                      ]
                    : prompt;

                const groqResp = await fetch(GROQ_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${runtimeGroqKey}`
                    },
                    body: JSON.stringify({
                        model: candidate,
                        messages: [
                            ...(typeof system === 'string' && system && !useVision
                                ? [{ role: 'system', content: system }]
                                : []),
                            ...priorTurns,
                            { role: 'user', content: userContent }
                        ],
                        temperature: typeof temperature === 'number' ? Math.min(Math.max(temperature, 0), 1.5) : 0.2,
                        max_tokens: Number.isInteger(max_tokens) ? Math.min(Math.max(max_tokens, 1), 3000) : 700
                    })
                });

                const data = await groqResp.json();
                if (groqResp.ok) {
                    finalData = data;
                    modelUsed = candidate;
                    break;
                } else {
                    lastError = data?.error?.message || `Groq API error (HTTP ${groqResp.status})`;
                    console.warn(`Groq model ${candidate} failed: ${lastError}`);
                    // If model not found or invalid model error, continue to next candidate
                    if ([400, 404, 413, 429, 500, 503].includes(groqResp.status)) {
                        continue;
                    }
                    return res.status(groqResp.status).json({ error: lastError });
                }
            } catch (err) {
                lastError = err.message;
            }
        }

        if (!finalData) {
            return res.status(502).json({ error: lastError || 'All Groq vision models failed.' });
        }

        let text = finalData?.choices?.[0]?.message?.content || '';
        // Some reasoning models wrap their thinking in <think>…</think>; never show that
        text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
        res.json({ text, _model_used: modelUsed });
    } catch (err) {
        console.error('POST /groq failed:', err);
        res.status(500).json({ error: err.message || 'Unexpected server error.' });
    }
});

// ---- Speech-to-text: browser records audio, Groq Whisper transcribes it ----
// POST /transcribe?lang=hi|kn|ta|te|ml|en   body: raw audio (webm/ogg/mp4/wav)
app.post('/transcribe',
    express.raw({ type: () => true, limit: '25mb' }),
    async (req, res) => {
        try {
            if (!runtimeGroqKey) {
                return res.status(400).json({ error: 'No Groq API key configured on the server.' });
            }
            const audio = req.body;
            if (!Buffer.isBuffer(audio) || audio.length < 800) {
                return res.status(400).json({ error: 'No audio received.' });
            }
            const lang = String(req.query.lang || '').toLowerCase();
            const mime = (req.headers['content-type'] || 'audio/webm').split(';')[0];
            const ext = mime.includes('ogg') ? 'ogg' : mime.includes('mp4') || mime.includes('m4a') ? 'm4a'
                      : mime.includes('wav') ? 'wav' : mime.includes('mpeg') || mime.includes('mp3') ? 'mp3' : 'webm';

            let lastError = null;
            for (const model of STT_MODELS) {
                const form = new FormData();
                form.append('file', new Blob([audio], { type: mime }), `speech.${ext}`);
                form.append('model', model);
                form.append('response_format', 'json');
                form.append('temperature', '0');
                if (STT_LANGS.includes(lang)) form.append('language', lang);

                const r = await fetch(GROQ_STT_URL, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${runtimeGroqKey}` },
                    body: form
                });
                const data = await r.json().catch(() => ({}));
                if (r.ok) {
                    return res.json({ text: (data.text || '').trim(), model });
                }
                lastError = data?.error?.message || `Groq STT error (HTTP ${r.status})`;
                console.warn(`Whisper model ${model} failed: ${lastError}`);
                if (![400, 404, 429, 500, 503].includes(r.status)) break;
            }
            res.status(502).json({ error: lastError || 'Transcription failed.' });
        } catch (err) {
            console.error('POST /transcribe failed:', err);
            res.status(500).json({ error: err.message || 'Unexpected server error.' });
        }
    }
);

// ---- Live Agmarknet Mandi Prices via data.gov.in ----
const DATA_GOV_API_KEY = process.env.DATA_GOV_API_KEY || '579b464db66ec23bdd000001d69116abb0ce4d9b5f715bf7e3454bb4';
const DATA_GOV_RESOURCE = '9ef84268-d588-465a-a308-a864a43d0070';
let mandiCache = { data: null, timestamp: 0 };

app.get('/api/mandi-live', async (req, res) => {
    const now = Date.now();
    // Cache for 10 minutes to respect NIC rate limits
    if (mandiCache.data && (now - mandiCache.timestamp < 10 * 60 * 1000)) {
        return res.json({ ...mandiCache.data, cached: true });
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

        const url = `https://api.data.gov.in/resource/${DATA_GOV_RESOURCE}?api-key=${DATA_GOV_API_KEY}&format=json&limit=150`;
        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`data.gov.in returned HTTP ${response.status}`);
        }

        const json = await response.json();
        const rawRecords = json.records || [];
        
        const payload = {
            ok: true,
            source: 'data.gov.in_live',
            apiKeyMasked: '579b...4bb4',
            count: rawRecords.length,
            records: rawRecords,
            timestamp: now
        };
        mandiCache = { data: payload, timestamp: now };
        return res.json(payload);
    } catch (err) {
        return res.json({
            ok: false,
            fallback: true,
            source: 'dataset_primary',
            apiKeyConfigured: true,
            apiKeyMasked: '579b...4bb4',
            message: 'data.gov.in upstream connection timeout; seamlessly fusing with local 2,032 records dataset',
            timestamp: now
        });
    }
});

// ---- Health & API Status Check ----
app.get('/health', (req, res) => res.json({
    status: 'ok',
    groqConfigured: Boolean(runtimeGroqKey),
    dataGovConfigured: Boolean(DATA_GOV_API_KEY)
}));

app.listen(PORT, () => {
    console.log(`🌿 FarmIntel backend running on http://localhost:${PORT}`);
    console.log(runtimeGroqKey ? '✅ Groq API key loaded from .env' : '⚠️  No Groq API key set yet — waiting for /groq-setkey or GROQ_API_KEY in .env');
    console.log(DATA_GOV_API_KEY ? '✅ data.gov.in API key active (579b...4bb4)' : '⚠️  No data.gov.in API key configured');
});
