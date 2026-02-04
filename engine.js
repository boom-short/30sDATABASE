/**
 * WinGo 30S Prediction Engine - Fixed Version
 * Developer: King Soikat Bahi
 */

// WinGoDB Object Definition (এটি আগে ছিল না, তাই এরর আসত)
const WinGoDB = {
    data: typeof initialData !== 'undefined' ? initialData : [],
    
    patch: function(newList) {
        newList.forEach(item => {
            if (!this.data.find(d => d.issueNumber === item.issueNumber)) {
                this.data.unshift(item);
            }
        });
        // মেমোরি বাঁচাতে ডাটাবেজ বড় হলে পুরানোগুলো ডিলিট করতে পারেন
        if (this.data.length > 200) this.data = this.data.slice(0, 200);
    },
    
    getLatest: function(count) {
        return this.data.slice(0, count);
    }
};

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
        // মোবাইল ব্রাউজারে CORS এরর এড়াতে এবং লেটেস্ট ডাটা পেতে টাইমস্ট্যাম্প ব্যবহার
        const r = await fetch(`${API_URL}?t=${Date.now()}`);
        const d = await r.json();
        
        if (d.data && d.data.list) {
            WinGoDB.patch(d.data.list);

            const dbLatest = WinGoDB.getLatest(10);
            if (dbLatest.length === 0) return;

            const currentIssue = dbLatest[0].issueNumber;

            // রেজাল্ট চেক
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

            // নতুন প্রেডিকশন
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
    } catch (e) { 
        console.log("Syncing..."); // মোবাইল কনসোলে অপ্রয়োজনীয় এরর হাইড রাখতে
    }
}

function generatePrediction(history) {
    if (history.length < 5) return null;
    const lastNums = history.slice(0, 5).map(i => parseInt(i.number));
    const lastSizes = lastNums.map(n => n >= 5 ? 'BIG' : 'SMALL');
    
    // AI লজিক: ট্রেন্ড রিভার্সাল বা ফলো লজিক
    let nextSize = (lastSizes[0] === lastSizes[1]) ? (lastSizes[0] === 'BIG' ? 'SMALL' : 'BIG') : lastSizes[0];
    let nextNum = nextSize === 'BIG' ? [5,6,7,8,9][Math.floor(Math.random()*5)] : [0,1,2,3,4][Math.floor(Math.random()*5)];
    return { size: nextSize, num: nextNum };
}

function updateUI(issue, ai) {
    const visual = getVisualData(ai.num);
    const periodEl = document.getElementById('periodId');
    const pVal = document.getElementById('predValue');
    
    if(periodEl) periodEl.textContent = issue.slice(-4);
    if(pVal) {
        pVal.textContent = ai.size;
        pVal.style.color = (ai.size === 'BIG') ? '#ffa726' : '#29b6f6';
    }
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
    if(!body || !head) return;
    
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
        const timerEl = document.getElementById('timer');
        if(timerEl) timerEl.textContent = "00:" + (r < 10 ? "0" + r : r);
        
        // রেজাল্ট আসার ঠিক পর (১ম সেকেন্ডে) এবং শেষের দিকে ডাটা কল করা
        if (r === 29 || r === 1) syncData();
    }, 1000);
}

