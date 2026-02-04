/**
 * WinGo 30S Prediction Engine
 * Developer: King Soikat Bahi
 */

const API_URL = 'https://draw.ar-lottery01.com/WinGo/WinGo_30S/GetHistoryIssuePage.json';
let state = { 
    predictions: [], 
    lastPeriod: null, 
    stats: { w: 0, l: 0 }, 
    streak: 0, 
    currentTab: 'mine' 
};

async function syncData() {
    try {
        const r = await fetch(`${API_URL}?t=${Date.now()}`);
        const d = await r.json();
        
        if (d.data && d.data.list) {
            // ১. ডাটাবেজে নতুন ডাটা পাঠানো (প্যাচিং)
            WinGoDB.patch(d.data.list);

            const dbLatest = WinGoDB.getLatest(10);
            if (dbLatest.length === 0) return;

            const currentIssue = dbLatest[0].issueNumber;

            // ২. রেজাল্ট চেক করা (পেন্ডিং প্রেডিকশন থাকলে)
            state.predictions.forEach(p => {
                if (p.status === 'PENDING') {
                    const match = WinGoDB.data.find(i => i.issueNumber === p.period);
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

            // ৩. নতুন প্রেডিকশন জেনারেট করা
            if (currentIssue !== state.lastPeriod) {
                const nextIssue = String(BigInt(currentIssue) + 1n);
                const ai = generatePrediction(dbLatest);

                if (ai && !state.predictions.find(p => p.period === nextIssue)) {
                    state.predictions.unshift({ 
                        period: nextIssue, num: ai.num, size: ai.size, status: 'PENDING', actualNum: '?' 
                    });
                    updateUI(nextIssue, ai);
                }
                state.lastPeriod = currentIssue;
            }
            render();
        }
    } catch (e) { console.error("API Delay/Error"); }
}

function generatePrediction(history) {
    if (history.length < 5) return null;
    const lastNums = history.slice(0, 5).map(i => parseInt(i.number));
    const lastSizes = lastNums.map(n => n >= 5 ? 'BIG' : 'SMALL');
    
    let nextSize = (lastSizes[0] === lastSizes[1]) ? (lastSizes[0] === 'BIG' ? 'SMALL' : 'BIG') : lastSizes[0];
    let nextNum = nextSize === 'BIG' ? [5,7,8,9][Math.floor(Math.random()*4)] : [1,2,3,4][Math.floor(Math.random()*4)];
    return { size: nextSize, num: nextNum };
}

function updateUI(issue, ai) {
    const visual = getVisualData(ai.num);
    document.getElementById('periodId').textContent = issue.slice(-4);
    const pVal = document.getElementById('predValue');
    pVal.textContent = ai.size;
    pVal.style.color = (ai.size === 'BIG') ? '#ffa726' : '#29b6f6';
    document.getElementById('colorHint').textContent = `Target: ${ai.num} (${visual.name})`;
    document.getElementById('colorHint').style.color = visual.hex;
}

function getVisualData(n) {
    n = parseInt(n);
    if (n === 0) return { name: 'Red+V', hex: '#ff3e3e', dots: '<span class="dot dot-red"></span><span class="dot dot-violet"></span>' };
    if (n === 5) return { name: 'Green+V', hex: '#00f281', dots: '<span class="dot dot-green"></span><span class="dot dot-violet"></span>' };
    if ([1,3,7,9].includes(n)) return { name: 'Green', hex: '#00f281', dots: '<span class="dot dot-green"></span>' };
    return { name: 'Red', hex: '#ff3e3e', dots: '<span class="dot dot-red"></span>' };
}

function render() {
    const body = document.getElementById('hBody');
    const head = document.getElementById('hHead');
    body.innerHTML = "";
    
    if (state.currentTab === 'mine') {
        head.innerHTML = "<tr><th>Period</th><th>Prediction</th><th>Actual</th><th>Status</th></tr>";
        state.predictions.filter(p => p.status !== 'PENDING').slice(0, 10).forEach(i => {
            body.innerHTML += `<tr><td>${i.period.slice(-4)}</td><td style="color:var(--primary); font-weight:bold">${i.size}</td><td>${i.actualNum}</td><td><span class="${i.status === 'WIN' ? 'badge-win' : 'badge-loss'}">${i.status}</span></td></tr>`;
        });
    } else {
        head.innerHTML = "<tr><th>Period</th><th>Num</th><th>Size</th><th>Visual</th></tr>";
        WinGoDB.getLatest(10).forEach(m => {
            const v = getVisualData(m.number);
            const sz = parseInt(m.number) >= 5 ? 'BIG' : 'SMALL';
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
    render();
}

function initEngine() {
    syncData();
    setInterval(() => {
        const s = new Date().getSeconds();
        const r = 30 - (s % 30);
        document.getElementById('timer').textContent = "00:" + (r < 10 ? "0" + r : r);
        // পিরিয়ডের শুরুতে এবং শেষে ডাটা চেক যাতে কোনো গ্যাপ না থাকে
        if (r === 1 || r === 28 || r === 15) syncData();
    }, 1000);
                      }
        
