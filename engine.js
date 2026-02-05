/**
 * WinGo 30S Pro Engine - Dual DB High-Speed Search
 * Developer: King Soikat Bahi
 */

const DB_CONFIG = {
    // আপনার GitHub এর raw JSON লিংক এখানে দিন
    PRIMARY_URL: 'https://raw.githubusercontent.com/boom-short/30sDATABASE/main/data.json',
    LIVE_URL: 'https://draw.ar-lottery01.com/WinGo/WinGo_30S/GetHistoryIssuePage.json'
};

let primaryData = []; // ৯০ হাজার ডাটাবেজ
let liveData = [];    // এপিআই থেকে আসা লাইভ ডাটা
let state = { 
    predictions: [], 
    lastPeriod: null, 
    stats: { w: 0, l: 0 }, 
    streak: 0, 
    currentTab: 'mine' 
};

// Binary Search: ১ সেকেন্ডের কম সময়ে ৯০ হাজার ডাটা থেকে নির্দিষ্ট পিরিয়ড খুঁজে বের করবে
function findRecord(issueNumber) {
    // প্রথমে লাইভ ডাটাতে সার্চ (ছোট ডাটাবেজ)
    let record = liveData.find(d => d.issueNumber === issueNumber);
    if (record) return record;

    // না পেলে প্রাইমারি ডাটাতে Binary Search (বড় ডাটাবেজ)
    let low = 0;
    let high = primaryData.length - 1;
    while (low <= high) {
        let mid = Math.floor((low + high) / 2);
        if (primaryData[mid].issueNumber === issueNumber) return primaryData[mid];
        
        // ডেসেন্ডিং অর্ডার (বড় থেকে ছোট) চেক
        if (primaryData[mid].issueNumber < issueNumber) high = mid - 1;
        else low = mid + 1;
    }
    return null;
}

async function syncDatabases() {
    try {
        // ১. প্রাইমারি ডাটাবেজ লোড (GitHub) - শুধু একবারই লোড হবে
        if (primaryData.length === 0) {
            const pRes = await fetch(`${DB_CONFIG.PRIMARY_URL}?t=${Date.now()}`);
            primaryData = await pRes.json();
            // সার্চ স্পিড ঠিক রাখতে সর্টিং নিশ্চিত করা
            primaryData.sort((a, b) => b.issueNumber.localeCompare(a.issueNumber));
        }

        // ২. লাইভ ডাটাবেজ লোড (API) - গ্যাপ পূরণ করার জন্য
        const lRes = await fetch(`${DB_CONFIG.LIVE_URL}?t=${Date.now()}`, { cache: 'no-store' });
        const lJson = await lRes.json();
        if (lJson.data && lJson.data.list) {
            liveData = lJson.data.list;
        }

        runCoreLogic();
    } catch (e) {
        console.log("Syncing...");
    }
}

function runCoreLogic() {
    // দুই ডাটাবেজ মিলিয়ে লেটেস্ট ডাটা সেট তৈরি (ভিজ্যুয়াল হিস্ট্রির জন্য)
    let combined = [...liveData, ...primaryData.slice(0, 20)];
    let uniqueLatest = Array.from(new Map(combined.map(item => [item['issueNumber'], item])).values())
                            .sort((a, b) => b.issueNumber.localeCompare(a.issueNumber));

    if (uniqueLatest.length === 0) return;

    const currentIssue = uniqueLatest[0].issueNumber;

    // রেজাল্ট চেক ও স্ট্যাটাস আপডেট
    state.predictions.forEach(p => {
        if (p.status === 'PENDING') {
            const match = findRecord(p.period);
            if (match) {
                const actualNum = parseInt(match.number);
                const actualSize = actualNum >= 5 ? 'BIG' : 'SMALL';
                p.actualNum = actualNum;
                p.status = (p.size === actualSize) ? 'WIN' : 'LOSS';
                
                if (p.status === 'WIN') {
                    state.stats.w++; state.streak = 0;
                } else {
                    state.stats.l++; state.streak++;
                }
                updateStats();
            }
        }
    });

    // নতুন প্রেডিকশন জেনারেশন (ডাটাবেজে ডাটা থাকলে)
    if (currentIssue !== state.lastPeriod) {
        if (uniqueLatest.length > 5) {
            const nextIssue = String(BigInt(currentIssue) + 1n);
            const ai = generateAI(uniqueLatest);
            
            if (ai && !state.predictions.find(p => p.period === nextIssue)) {
                state.predictions.unshift({ 
                    period: nextIssue, size: ai.size, num: ai.num, status: 'PENDING', actualNum: '?' 
                });
                updateUI(nextIssue, ai);
            }
        }
        state.lastPeriod = currentIssue;
    }
    render(uniqueLatest);
}

function generateAI(history) {
    const last = parseInt(history[0].number);
    // ট্রেন্ড এনালাইসিস লজিক
    let nextSize = last >= 5 ? 'SMALL' : 'BIG';
    let nextNum = nextSize === 'BIG' ? [6, 7, 8][Math.floor(Math.random()*3)] : [1, 2, 3][Math.floor(Math.random()*3)];
    return { size: nextSize, num: nextNum };
}

function updateUI(issue, ai) {
    document.getElementById('periodId').textContent = issue.slice(-4);
    const pVal = document.getElementById('predValue');
    pVal.textContent = ai.size;
    pVal.style.color = ai.size === 'BIG' ? '#ffa726' : '#29b6f6';
    
    const v = getVisual(ai.num);
    document.getElementById('colorHint').innerHTML = `Target: ${ai.num} ${v.dots}`;
}

function getVisual(n) {
    n = parseInt(n);
    if (n === 0) return { dots: '<span class="dot dot-red"></span><span class="dot dot-violet"></span>' };
    if (n === 5) return { dots: '<span class="dot dot-green"></span><span class="dot dot-violet"></span>' };
    if ([1,3,7,9].includes(n)) return { dots: '<span class="dot dot-green"></span>' };
    return { dots: '<span class="dot dot-red"></span>' };
}

function render(historyData) {
    const body = document.getElementById('hBody');
    const head = document.getElementById('hHead');
    if(!body || !head) return;
    
    body.innerHTML = "";
    if (state.currentTab === 'mine') {
        head.innerHTML = "<tr><th>Period</th><th>Prediction</th><th>Result</th><th>Status</th></tr>";
        state.predictions.slice(0, 15).forEach(i => {
            body.innerHTML += `<tr><td>${i.period.slice(-4)}</td><td style="color:var(--primary)">${i.size}</td><td>${i.actualNum}</td><td><span class="${i.status === 'WIN' ? 'badge-win' : (i.status === 'LOSS' ? 'badge-loss' : '')}">${i.status}</span></td></tr>`;
        });
    } else {
        head.innerHTML = "<tr><th>Period</th><th>Number</th><th>Size</th><th>Color</th></tr>";
        historyData.slice(0, 15).forEach(m => {
            const sz = parseInt(m.number) >= 5 ? 'BIG' : 'SMALL';
            const v = getVisual(m.number);
            body.innerHTML += `<tr><td>${m.issueNumber.slice(-4)}</td><td>${m.number}</td><td style="color:${sz==='BIG'?'#ffa726':'#29b6f6'}">${sz}</td><td>${v.dots}</td></tr>`;
        });
    }
}

function updateStats() {
    const total = state.stats.w + state.stats.l;
    document.getElementById('stW').textContent = state.stats.w;
    document.getElementById('stL').textContent = state.stats.l;
    document.getElementById('stS').textContent = state.streak;
    document.getElementById('stA').textContent = total > 0 ? Math.round((state.stats.w/total)*100)+'%' : '0%';
}

function switchTab(t) {
    state.currentTab = t;
    document.getElementById('tMine').classList.toggle('active', t === 'mine');
    document.getElementById('tMarket').classList.toggle('active', t === 'market');
    syncDatabases(); 
}

function initEngine() {
    syncDatabases();
    setInterval(() => {
        const s = new Date().getSeconds();
        const r = 30 - (s % 30);
        document.getElementById('timer').textContent = "00:" + (r < 10 ? "0" + r : r);
        // এপিআই প্যাচিং এবং গ্যাপ ফিলিং (সেকেন্ডের শুরুতে ও শেষে)
        if (r === 29 || r === 1) syncDatabases();
    }, 1000);
}
