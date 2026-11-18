global.window = global;
require('../agricultural_db.js');

const cropAliases = {
    rice: ['rice', 'paddy', 'धान', 'ಭತ್ತ', 'ನೆಲ್ಲ್', 'அரிசி', 'వరి', 'dhan', 'bhatta', 'nellu', 'vari'],
    wheat: ['wheat', 'गेहूं', 'ಗೋಧಿ', 'ഗോതമ്പ്', 'கோதுமை', 'గోధుమలు', 'gehun', 'godhi', 'godhumalu'],
    cotton: ['cotton', 'कपास', 'ಹತ್ತಿ', 'പരുത്തി', 'பருத்தி', 'పత్తి', 'kapas', 'hatti', 'patti'],
    sugarcane: ['sugarcane', 'गन्ना', 'ಕಬ್ಬು', 'കരിമ്പ്', 'கரும்பு', 'చెరకు', 'ganna', 'kabbu', 'cheraku'],
    maize: ['maize', 'corn', 'मक्का', 'ಮೆಕ್ಕೆಜೋಳ', 'ചോളം', 'மக்காச்சோளம்', 'మొక్కజొన్న', 'makka', 'cholam', 'mokkajonna'],
    tomato: ['tomato', 'टमाटर', 'ಟೊಮೆಟೊ', 'തക്കാളി', 'தக்காளி', 'టమోటా', 'tamatar', 'thakkali'],
    onion: ['onion', 'प्याज', 'ಈರುಳ್ಳಿ', 'സവാള', 'வெங்காயம்', 'ఉల్లిపాయ', 'pyaz', 'eerulli', 'ullipaya'],
    potato: ['potato', 'आलू', 'ಆಲೂಗಡ್ಡೆ', 'ഉരുളക്കിഴങ്ങ്', 'உருளைக்கிழங்கு', 'బంగాళాదుంప', 'aloo', 'aaloo', 'bangaladumpa'],
    groundnut: ['groundnut', 'peanut', 'मूंगफली', 'ಕಡಲೆಕಾಯಿ', 'നിലക്കടല', 'வேர்க்கடலை', 'వేరుశనగ', 'mungfali', 'kadlekai', 'verusenaga'],
    banana: ['banana', 'केला', 'ಬಾಳೆಹಣ್ಣು', 'ಬಾಳೆ', 'വാഴപ്പഴം', 'வாழைப்பழம்', 'అరటి', 'kela', 'balehannu', 'arati'],
    mango: ['mango', 'आम', 'ಮಾವಿನಹಣ್ಣು', 'മാങ്ങ', 'மாம்பழம்', 'మామిడి', 'aam', 'mavu', 'mamidi'],
    grapes: ['grapes', 'grape', 'अंगूर', 'ದ್ರಾಕ್ಷಿ', 'മുന്തിരി', 'திராட்சை', 'ద్రాక్ష', 'angoor', 'drakshi'],
    pomegranate: ['pomegranate', 'अनार', 'ದಾಳಿಂಬೆ', 'മാതളനാരകം', 'மாதுளை', 'దానిమ్మ', 'anaar', 'dalimbe', 'danimma'],
    turmeric: ['turmeric', 'हल्दी', 'ಅರಿಶಿನ', 'മഞ്ഞൾ', 'மஞ்சள்', 'పసుపు', 'haldi', 'arishina', 'pasupu'],
    ginger: ['ginger', 'अदरक', 'ಶುಂಠಿ', 'ഇഞ്ചി', 'இஞ்சி', 'అల్లం', 'adrak', 'shunti', 'allam'],
    chilli: ['chilli', 'chili', 'मिर्च', 'ಮೆಣಸಿನಕಾಯಿ', 'മുളക്', 'மிளகாய்', 'మిరపకాయ', 'mirchi', 'menasinakai'],
    soybean: ['soybean', 'soya', 'सोयाबीन', 'ಸೋಯಾಬೀನ್', 'സോയാബീൻ', 'சோயாபீன்', 'సోయాబీన్'],
    ragi: ['ragi', 'finger millet', 'रागी', 'ರಾಗಿ', 'റാഗി', 'கேழ்வரகு', 'ರಾಗುలు'],
    bajra: ['bajra', 'pearl millet', 'बाजरा', 'ಸಜ್ಜೆ', 'കമ്പ്', 'கம்பு', 'సజ్జలు'],
    jowar: ['jowar', 'sorghum', 'ज्वार', 'ಜೋಳ', 'ജോള', 'சோளம்', 'జొన్నలు']
};

function detectCropInMessage(msg) {
    const lower = msg.toLowerCase();
    for (const [cropKey, aliases] of Object.entries(cropAliases)) {
        for (const alias of aliases) {
            const isNonAscii = /[^\u0000-\u007F]/.test(alias);
            if (isNonAscii) {
                if (lower.includes(alias)) return cropKey;
            } else {
                const regex = new RegExp('(^|[^a-zA-Z0-9_])' + alias + '($|[^a-zA-Z0-9_])', 'i');
                if (regex.test(lower)) return cropKey;
            }
        }
    }
    // Check direct ID or name matches in CROP_ECONOMICS
    for (const [key, c] of Object.entries(window.CROP_ECONOMICS || {})) {
        const isNonAscii = /[^\u0000-\u007F]/.test(c.name);
        if (isNonAscii) {
            if (lower.includes(c.name.toLowerCase())) return key;
        } else {
            const regex = new RegExp('(^|[^a-zA-Z0-9_])' + c.name.toLowerCase() + '($|[^a-zA-Z0-9_])', 'i');
            if (regex.test(lower)) return key;
        }
    }
    return null;
}

function generateLocalSmartResponse(userMessage, currentLanguage = 'en') {
    const msg = userMessage.trim();
    const lower = msg.toLowerCase();
    const lang = currentLanguage;
    const cropKey = detectCropInMessage(msg);
    const crop = cropKey ? window.CROP_ECONOMICS?.[cropKey] : null;

    const isFertilizer = /(fertilizer|fert|urea|dap|npk|dose|manure|nutrients|गोंबर|ಗೊಬ್ಬರ|ಯೂರಿಯಾ|यूरिया|खाद|உரம்|ఎరువు|ఎరువులు)/i.test(lower);
    const isWater = /(water|irrigation|rain|drip|moisture|ನೀರು|ನೀರಾವರಿ|पानी|सिंचाई|பாசனம்|నీరు|నీటి)/i.test(lower);
    const isPrice = /(price|cost|market|rate|mandi|apmc|profit|income|ಬೆಲೆ|ದರ|ಭಾವ|भाव|मंडी|விலை|ధర|ఖరీదు)/i.test(lower);
    const isYield = /(yield|production|output|harvest|tons|quintal|ಇಳುವರಿ|उपज|पैदावार|விளைச்சல்|దిగుబడి)/i.test(lower);
    const isDisease = /(disease|pest|insect|spray|fungus|blight|rot|spots|worm|protection|ರೋಗ|ಕೀಟ|औषधि|रोग|कीट|நோய்|தெగులు|పురుగు)/i.test(lower);
    const isSeason = /(season|sow|sowing|plant|time|month|duration|when to grow|ಖಾರಿಫ್|ರಬಿ|ಹಂಗಾಮು|मौसम|बुवाई|பருவம்|కాలం)/i.test(lower);
    const isGuide = /(how to grow|guide|process|farming|package of practices|ಬೆಳೆಯುವುದು ಹೇಗೆ|खेती|சாகுபடி|సాగు)/i.test(lower);
    const isCropRecommend = /(crop|grow|recommend|suggest|what should i plant|which crop|ಯಾವ ಬೆಳೆ|ಬೆಳೆ ಶಿಫಾರಸು|कौन सी फसल|எந்த பயிர்|ఏ పంట)/i.test(lower);
    const isGreeting = /^(hi|hello|hey|namaste|good\s*(morning|evening|afternoon)|ನಮಸ್ಕಾರ|नमस्ते|வணக்கம்|నమస్కారం|നമസ്കാരം)/i.test(lower);
    const isHelp = /(help|what can you do|features|options|ಯಾವ ಸಹಾಯ|मदद|உதவி|సహాయం)/i.test(lower);

    const getCropName = (c) => {
        if (!c) return '';
        if (lang === 'kn') return c.kannadaName ? `${c.kannadaName} (${c.name})` : c.name;
        if (lang === 'hi') return c.hindiName ? `${c.hindiName} (${c.name})` : c.name;
        if (lang === 'ta') return c.tamilName ? `${c.tamilName} (${c.name})` : c.name;
        if (lang === 'te') return c.teluguName ? `${c.teluguName} (${c.name})` : c.name;
        if (lang === 'ml') return c.malayalamName ? `${c.malayalamName} (${c.name})` : c.name;
        return c.name;
    };

    // 1. SPECIFIC CROP + INTENT
    if (crop) {
        const cName = getCropName(crop);
        const guide = crop.growingGuide || {};

        if (isFertilizer) {
            const doseAcre = (crop.fertilizerDoseKgHa * 0.404686).toFixed(1);
            return `🌱 <b>Fertilizer Advice for ${cName}:</b><br>` +
                `• <b>Primary Fertilizer:</b> ${crop.recommendedFertilizer || 'NPK Balanced'}<br>` +
                `• <b>Recommended Dose:</b> <b>${crop.fertilizerDoseKgHa} kg/ha</b> (~${doseAcre} kg/acre)<br>` +
                `• <b>Target Nutrients:</b> N:${crop.recommendedN || 80} | P:${crop.recommendedP || 40} | K:${crop.recommendedK || 40} kg/ha<br>` +
                `• <b>Soil Amendment:</b> ${crop.soilAmendment || 'Farmyard manure (FYM) @ 5 t/acre'}<br>` +
                `💡 <i>Apply 50% N + full P & K as basal dose, and top-dress remaining N at active vegetative and flowering stages.</i>`;
        }

        if (isWater) {
            return `💧 <b>Irrigation & Water Management for ${cName}:</b><br>` +
                `• <b>Water Requirement:</b> <b>${(crop.waterNeed || 'moderate').toUpperCase()}</b><br>` +
                `• <b>Irrigation Advice:</b> ${crop.irrigationAdvice || 'Maintain scheduled irrigation at critical growth stages'}<br>` +
                `• <b>Schedule:</b> ${guide.irrigation || 'Irrigate every 7-10 days depending on weather and soil moisture'}<br>` +
                `💡 <i>Using drip irrigation can save 40-50% water while improving fertilizer efficiency.</i>`;
        }

        if (isPrice) {
            return `💰 <b>APMC Mandi Economics for ${cName}:</b><br>` +
                `• <b>Modal Mandi Price:</b> <b>₹${crop.mandiPriceModal.toLocaleString('en-IN')}/quintal</b><br>` +
                `• <b>Trading Range:</b> ₹${crop.mandiPriceMin.toLocaleString('en-IN')} – ₹${crop.mandiPriceMax.toLocaleString('en-IN')}/quintal<br>` +
                `• <b>Estimated Cultivation Cost:</b> ₹${crop.costMin.toLocaleString('en-IN')} – ₹${crop.costMax.toLocaleString('en-IN')}/acre<br>` +
                `• <b>Estimated Net Profit:</b> <b>${crop.profitRangeText || 'High'}</b> per acre<br>` +
                `📈 <i>Market trend indicates strong demand. Check the Market tab for daily live updates.</i>`;
        }

        if (isYield) {
            const yieldHa = (crop.yieldMax * 2.471).toFixed(1);
            return `📊 <b>Expected Yield for ${cName}:</b><br>` +
                `• <b>Average Expected Yield:</b> <b>${crop.yieldMin} – ${crop.yieldMax} tonnes/acre</b> (~${yieldHa} tonnes/ha)<br>` +
                `• <b>Crop Duration:</b> ${crop.durationMonths || 4} months (${guide.season || 'Kharif/Rabi'})<br>` +
                `• <b>Key Yield Factors:</b> Certified seed rate (${guide.seedRate || 'standard'}), adequate spacing, and balanced NPK nutrition.<br>` +
                `💡 <i>Check the Yield Prediction tab to simulate your exact soil NPK response!</i>`;
        }

        if (isDisease) {
            return `🛡️ <b>Crop Protection & Pest Management for ${cName}:</b><br>` +
                `• <b>General Strategy:</b> ${guide.plantProtection || 'Monitor weekly for regional pest thresholds. Use bio-pesticides preventatively.'}<br>` +
                `• <b>Organic Remedy:</b> Spray Neem oil (1500 ppm @ 3-5 ml/L) during early pest onset.<br>` +
                `• <b>Leaf Diagnosis:</b> Upload a close-up photo of the affected leaf in the <b>Disease Detection</b> tab for deep AI visual diagnostics.`;
        }

        if (isSeason || isGuide) {
            return `🌾 <b>Cultivation Guide for ${cName}:</b><br>` +
                `• <b>Optimal Season:</b> <b>${guide.season || crop.seasons?.join(', ') || 'Kharif / Rabi'}</b> (Duration: ${guide.duration || crop.durationMonths + ' Months'})<br>` +
                `• <b>Seed Rate & Spacing:</b> ${guide.seedRate || 'Certified seed rate'} | ${guide.spacing || 'Standard spacing'}<br>` +
                `• <b>Land Preparation:</b> ${guide.landPrep || 'Fine tilth with FYM addition'}<br>` +
                `• <b>Fertilizer Plan:</b> ${crop.recommendedFertilizer} @ ${crop.fertilizerDoseKgHa} kg/ha (Target N:${crop.recommendedN}:P:${crop.recommendedP}:K:${crop.recommendedK})<br>` +
                `• <b>Harvesting:</b> ${guide.harvesting || 'Harvest when 80-85% produce reaches physiological maturity.'}`;
        }

        // Default crop summary
        return `🌿 <b>Overview for ${cName}:</b><br>` +
            `• <b>Season:</b> ${guide.season || crop.seasons?.join(', ') || 'Kharif/Rabi'} (${crop.durationMonths || 4} months)<br>` +
            `• <b>Expected Yield:</b> ${crop.yieldMin} – ${crop.yieldMax} t/acre | <b>Mandi Price:</b> ₹${crop.mandiPriceModal.toLocaleString('en-IN')}/quintal<br>` +
            `• <b>Fertilizer:</b> ${crop.recommendedFertilizer} @ ${crop.fertilizerDoseKgHa} kg/ha (N:${crop.recommendedN} P:${crop.recommendedP} K:${crop.recommendedK})<br>` +
            `• <b>Water Need:</b> ${(crop.waterNeed || 'moderate').toUpperCase()}<br>` +
            `💬 <i>Ask me specifically about fertilizer dose, irrigation schedule, mandi rates, or pest control for ${cName}!</i>`;
    }

    // 2. GENERAL TOPIC QUERIES (NO SPECIFIC CROP MENTIONED)
    const isSoilCard = /(soil card|health card|shc|soil test|soil report|ಮಣ್ಣು ಕಾರ್ಡ್|मृदा कार्ड|மண் அட்டை|మట్టి కార్డ్|മണ്ണ് കാർഡ്)/i.test(lower);
    if (isSoilCard) {
        return `📄 <b>Automated Soil Health Card Extraction:</b><br>` +
            `With JeevanMitra AI, you don't need to manually enter technical parameters like NPK, pH, or humidity!<br>` +
            `1. Open the <b>Disease Detection / Image Upload</b> tab on the left.<br>` +
            `2. Take a photo of your official <b>Soil Health Card (SHC)</b> or lab report and upload it.<br>` +
            `3. Our vision AI automatically extracts your Available N, P, K, and pH, auto-configures your farm soil baseline, and updates your crop recommendations!<br>` +
            `💡 <i>You can also tell me your N, P, K and pH values here, and I'll calibrate your farm profile immediately.</i>`;
    }

    if (isCropRecommend) {
        return `🌱 <b>“What Should I Grow?” — Top Recommendations:</b><br>` +
            `• <b>Expected Yield:</b> High-yield crop options calibrated with local district history.<br>` +
            `• <b>Est. Investment:</b> Clear production cost per acre and farm total.<br>` +
            `• <b>Expected Net Profit:</b> Profit prediction based on modal mandi prices.<br>` +
            `• <b>Market Trend & Water:</b> Evaluated against APMC demand and your water source.<br>` +
            `⚖️ <i><b>Farmer's Decision:</b> This AI platform provides data-driven options — the final decision always rests with you, the farmer!</i>`;
    }

    if (isPrice) {
        const topSamples = ['tomato', 'onion', 'cotton', 'rice', 'wheat', 'grapes'].map(k => window.CROP_ECONOMICS?.[k]).filter(Boolean);
        const lines = topSamples.slice(0, 4).map(c => `• <b>${c.name}:</b> ₹${c.mandiPriceModal.toLocaleString('en-IN')}/quintal (${c.priceTrend === 'up' ? '📈 Rising' : '⚖️ Steady'})`).join('<br>');
        return `💰 <b>Current APMC Mandi Modal Prices:</b><br>${lines}<br><br>💡 <i>Ask for any specific crop (e.g. "price of cotton" or "tomato mandi rate") or check the Market tab for live charts!</i>`;
    }

    if (isDisease) {
        return `🔍 <b>Crop Disease & Pest Diagnostics:</b><br>` +
            `You can identify plant diseases instantly:<br>` +
            `1. Open the <b>Disease Detection</b> tab on the left menu.<br>` +
            `2. Upload or take a clear photo of an affected leaf.<br>` +
            `3. Get instant disease classification, confidence score, and certified treatment recommendations! 🧪`;
    }

    if (isGreeting) {
        return `🙏 <b>Namaste! I am JeevanMitra AI</b>, your intelligent agricultural advisor.<br><br>` +
            `I can help you with:<br>` +
            `• 🌾 <b>Crop Recommendations</b> tailored to your soil & district<br>` +
            `• 🧪 <b>Fertilizer Doses & Soil Amendments</b> (N-P-K, Urea, FYM)<br>` +
            `• 💧 <b>Irrigation Schedules</b> (Drip & Flood)<br>` +
            `• 💰 <b>APMC Mandi Rates</b> & Profitability Estimates<br>` +
            `• 🔍 <b>Pest & Disease Diagnosis</b><br><br>` +
            `What crop or farming topic would you like advice on today?`;
    }

    if (isHelp) {
        return `📋 <b>How JeevanMitra AI Can Help You:</b><br>` +
            `• Ask about any of <b>49 supported crops</b> (e.g., <i>"What fertilizer for cotton?"</i> or <i>"How to grow sugarcane?"</i>)<br>` +
            `• Check market rates (e.g., <i>"Tomato mandi price"</i>)<br>` +
            `• Inquire about irrigation (e.g., <i>"Water requirement for rice"</i>)<br>` +
            `• Sowing seasons (e.g., <i>"When to sow groundnut?"</i>)<br>` +
            `• Click <b>Get Crop Recommendations</b> on your farm details to get full farm analysis!`;
    }

    // Default friendly fallback
    return `🌾 <b>JeevanMitra Agricultural Assistant:</b><br>` +
        `I specialize in precision farming, crop nutrition, market economics, and pest protection.<br><br>` +
        `You can ask me questions like:<br>` +
        `• <i>"What fertilizer dose for cotton?"</i><br>` +
        `• <i>"How much water does sugarcane need?"</i><br>` +
        `• <i>"Current mandi price for tomato?"</i><br>` +
        `• <i>"Expected yield for maize per acre?"</i><br>` +
        `• <i>"How to control pests in groundnut?"</i>`;
}

// Test queries
const tests = [
    'what fertilizer for cotton?',
    'how to grow sugarcane?',
    'what is the price of tomato?',
    'sugarcane water requirement',
    'how to control pests in groundnut',
    'what crop should I grow?',
    'how do I use my soil health card?',
    'ಕಬ್ಬು ಬೆಳೆಯುವುದು ಹೇಗೆ?',
    'rice fertilizer',
    'hi',
    'random query about tractors'
];

tests.forEach(t => {
    console.log('\n================================');
    console.log('QUERY:', t);
    console.log('ANSWER:\n' + generateLocalSmartResponse(t, 'en'));
});
