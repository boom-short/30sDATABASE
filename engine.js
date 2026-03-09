const PASS = "Soikat2580";
const LIVE_API = "https://draw.ar-lottery01.com/WinGo/WinGo_30S/GetHistoryIssuePage.json";

let bigDatabase = []; 
let lastPrediction = null;
let lastTargetPeriod = null;
let winLossHistory = {}; 
let movementMode = "NORMAL";

async function checkLogin() {
  const pass = document.getElementById('passInput').value;
  if(pass === PASS) {
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    
    try {
      const res = await fetch('data.json');
      const data = await res.json();
      bigDatabase = data.list || data;
    } catch (e) { console.error("Database error"); }

    startEngine();
  } else {
    document.getElementById('error').style.display = 'block';
  }
}

function startEngine() {
  fetchLive();
  setInterval(fetchLive, 4000);
  setInterval(() => { if(window.currentLiveHistory) runDeepScan(window.currentLiveHistory); }, 1000);
  setInterval(() => {
    let r = 30 - (new Date().getSeconds() % 30);
    document.getElementById('timer').innerText = r + "s";
  }, 1000);
}

async function fetchLive() {
  try {
    const res = await fetch(`${LIVE_API}?t=${Date.now()}`);
    const json = await res.json();
    if(json.data && json.data.list) {
      const history = json.data.list;
      window.currentLiveHistory = history;
      updateWinLossLogic(history);
    }
  } catch (e) {}
}

function updateWinLossLogic(history) {
    const latestResult = history[0];
    const period = latestResult.issueNumber;
    const actual = parseInt(latestResult.number) >= 5 ? "BIG" : "SMALL";

    if (lastTargetPeriod === period && lastPrediction !== null) {
        winLossHistory[period] = (lastPrediction === actual) ? "WIN" : "LOSS";
    }

    let recent = history.slice(0, 10).map(item => winLossHistory[item.issueNumber]);
    let tracked = recent.filter(s => s !== undefined);
    let winCount = tracked.filter(s => s === "WIN").length;
    let lossCount = tracked.filter(s => s === "LOSS").length;

    document.getElementById('winCount').innerText = winCount;
    document.getElementById('lossCount').innerText = lossCount;

    const candle = document.getElementById('candleBodyH');
    const statusText = document.getElementById('sentimentStatus');
    
    if (tracked.length > 0) {
        let diff = winCount - lossCount;
        let width = Math.min(Math.abs(diff) * 10, 50); 
        candle.style.width = width + "%";

        if (diff > 0) {
            candle.className = "candle-h up-h";
            statusText.innerText = "BULLISH (GOOD)";
            statusText.style.color = "#00ff88";
            movementMode = "NORMAL";
        } else if (diff < 0) {
            candle.className = "candle-h down-h";
            statusText.innerText = "BEARISH (BAD)";
            statusText.style.color = "#ff4444";
            movementMode = "REVERSE";
        } else {
            candle.style.width = "0%";
            statusText.innerText = "NEUTRAL";
            statusText.style.color = "#888";
            movementMode = "NORMAL";
        }
    }
}

function runDeepScan(history) {
  const latest = history[0];
  const nextPeriod = (BigInt(latest.issueNumber) + 1n).toString();
  document.getElementById('periodDisplay').innerText = nextPeriod.slice(-4);

  const currentKey = history.slice(0, 5).map(x => parseInt(x.number) >= 5 ? 'B' : 'S').join('');
  let bCount = 0, sCount = 0, matchCount = 0;
  
  if(bigDatabase.length > 0) {
    for (let i = 0; i < bigDatabase.length - 6; i++) {
      let pKey = "";
      for(let j=0; j<5; j++) {
        pKey += parseInt(bigDatabase[i+j+1].number) >= 5 ? 'B' : 'S';
      }
      if(pKey === currentKey) {
        matchCount++;
        if(parseInt(bigDatabase[i].number) >= 5) bCount++; else sCount++;
      }
    }
  }

  let rawPred = "WAIT";
  let conf = 0;

  if (matchCount > 0) {
    if (bCount > sCount) { rawPred = "BIG"; conf = (bCount/matchCount)*100; }
    else if (sCount > bCount) { rawPred = "SMALL"; conf = (sCount/matchCount)*100; }
  }

  let finalPred = rawPred;
  if (movementMode === "REVERSE" && rawPred !== "WAIT") {
      finalPred = (rawPred === "BIG") ? "SMALL" : "BIG";
  }

  if (lastTargetPeriod !== nextPeriod && finalPred !== "WAIT") {
      lastPrediction = finalPred;
      lastTargetPeriod = nextPeriod;
  }

  const pDiv = document.getElementById('prediction');
  pDiv.innerText = finalPred;
  pDiv.style.color = finalPred === "BIG" ? "#ff9900" : (finalPred === "SMALL" ? "#00aaff" : "#00ffea");
  
  document.getElementById('confPercent').innerText = Math.round(conf) + "%";
  document.getElementById('matchFound').innerText = movementMode;
  
  renderTable(history);
}

function renderTable(history) {
  let html = "";
  history.slice(0, 10).forEach(item => {
    const isB = parseInt(item.number) >= 5;
    const status = winLossHistory[item.issueNumber] || "---";
    const statusClass = status === "WIN" ? "green" : (status === "LOSS" ? "red" : "");
    html += `<tr>
      <td>${item.issueNumber.slice(-4)}</td>
      <td class="gold">${item.number}</td>
      <td class="${isB ? 'red' : 'green'}">${isB ? 'BIG' : 'SMALL'}</td>
      <td class="${statusClass}">${status}</td>
    </tr>`;
  });
  document.getElementById('logTable').innerHTML = html;
              }
    
