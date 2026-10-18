// =========================================================
// BIOMETRIC BLOCKCHAIN VOTING DASHBOARD - CLIENT APP
// =========================================================

const API_BASE = window.location.origin;

// Party Accent Color Palette
const PARTY_COLORS = [
  "#06b6d4", // Cyan
  "#8b5cf6", // Purple
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#f43f5e", // Rose
  "#3b82f6"  // Blue
];

// App State
let appState = {
  health: null,
  votesData: null,
  recentVotes: [],
  autoRefresh: true,
  refreshTimer: null
};

// DOM Content Loaded
document.addEventListener("DOMContentLoaded", () => {
  initTabs();
  initSimulator();
  initAuditor();
  initArchitectureAnimation();
  fetchInitialData();

  // Auto-refresh every 8 seconds
  appState.refreshTimer = setInterval(() => {
    if (appState.autoRefresh) {
      refreshData(false);
    }
  }, 8000);
});

// =========================================================
// TAB NAVIGATION
// =========================================================
function initTabs() {
  const tabBtns = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");

  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const targetTab = btn.getAttribute("data-tab");

      tabBtns.forEach(b => b.classList.remove("active"));
      tabContents.forEach(c => c.classList.remove("active"));

      btn.classList.add("active");
      const targetContent = document.getElementById(targetTab);
      if (targetContent) targetContent.classList.add("active");
    });
  });
}

// =========================================================
// DATA FETCHING & UI UPDATES
// =========================================================
async function fetchInitialData() {
  await Promise.all([
    fetchHealth(),
    fetchVotes(),
    fetchRecentLedger()
  ]);
}

async function refreshData(showToastAlert = true) {
  try {
    await Promise.all([
      fetchHealth(),
      fetchVotes(),
      fetchRecentLedger()
    ]);
    if (showToastAlert) showToast("System telemetry refreshed", "success");
  } catch (err) {
    if (showToastAlert) showToast("Failed to refresh data", "error");
  }
}

async function fetchHealth() {
  try {
    const res = await fetch(`${API_BASE}/api/health`);
    const data = await res.json();
    appState.health = data;

    // Update Telemetry Header
    const blockEl = document.getElementById("telemetry-block");
    if (blockEl && data.network?.blockNumber) {
      blockEl.textContent = `#${data.network.blockNumber}`;
    }

    const latencyEl = document.getElementById("telemetry-latency");
    if (latencyEl && data.network?.latencyMs !== null) {
      latencyEl.textContent = `${data.network.latencyMs}ms`;
    }

    const contractEl = document.getElementById("telemetry-contract");
    if (contractEl && data.contract?.address) {
      const addr = data.contract.address;
      contractEl.textContent = `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
      contractEl.title = addr;
      const contractLink = document.getElementById("contract-etherscan-link");
      if (contractLink) contractLink.href = data.contract.etherscanUrl;
    }

    const relayerEl = document.getElementById("telemetry-relayer");
    if (relayerEl && data.relayer) {
      if (data.relayer.configured) {
        const bal = data.relayer.balanceEth ? Number(data.relayer.balanceEth).toFixed(4) : "0";
        relayerEl.textContent = `${bal} ETH`;
      } else {
        relayerEl.textContent = "Simulated";
      }
    }
  } catch (err) {
    console.error("Health check error:", err);
  }
}

async function fetchVotes() {
  try {
    const res = await fetch(`${API_BASE}/api/blockchain/votes`);
    const data = await res.json();
    if (data.success) {
      appState.votesData = data;
      renderTallies(data);
    }
  } catch (err) {
    console.error("Votes tally error:", err);
  }
}

async function fetchRecentLedger() {
  try {
    const res = await fetch(`${API_BASE}/api/blockchain/recent`);
    const data = await res.json();
    if (data.success) {
      appState.recentVotes = data.votes || [];
      renderRecentLedger(appState.recentVotes);
    }
  } catch (err) {
    console.error("Recent votes fetch error:", err);
  }
}

// =========================================================
// RENDERING
// =========================================================
function renderTallies(data) {
  const partyGrid = document.getElementById("party-cards-grid");
  const totalVotesEl = document.getElementById("stat-total-votes");
  const leadingPartyEl = document.getElementById("stat-leading-party");

  if (totalVotesEl) totalVotesEl.textContent = data.totalVotes || 0;

  const parties = Object.entries(data.parties || {});
  let maxVotes = -1;
  let leader = "N/A";

  parties.forEach(([party, count]) => {
    if (count > maxVotes && count > 0) {
      maxVotes = count;
      leader = party;
    }
  });

  if (leadingPartyEl) leadingPartyEl.textContent = leader;

  if (!partyGrid) return;

  partyGrid.innerHTML = "";

  if (parties.length === 0) {
    partyGrid.innerHTML = `<div class="empty-state">No registered parties yet.</div>`;
    return;
  }

  const total = data.totalVotes || 0;

  parties.forEach(([party, count], idx) => {
    const color = PARTY_COLORS[idx % PARTY_COLORS.length];
    const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : 0;

    const card = document.createElement("div");
    card.className = "party-card";
    card.style.setProperty("--party-color", color);
    card.innerHTML = `
      <div class="party-header">
        <h4 class="party-name">${escapeHtml(party)}</h4>
        <span class="party-badge" style="color: ${color}">On-Chain Verified</span>
      </div>
      <div class="party-count-wrap">
        <span class="party-count">${count}</span>
        <span class="party-share">${percentage}%</span>
      </div>
      <div class="progress-track">
        <div class="progress-fill" style="width: ${percentage}%"></div>
      </div>
    `;
    partyGrid.appendChild(card);
  });

  // Populate candidate dropdown in simulator if empty
  populateSimulatorCandidates(parties.map(p => p[0]));
}

function renderRecentLedger(votes) {
  const tbody = document.getElementById("ledger-tbody");
  if (!tbody) return;

  if (votes.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-state">No votes recorded in local session yet. Use the simulator or hardware to cast a vote!</td></tr>`;
    return;
  }

  tbody.innerHTML = votes.map((v, i) => {
    const shortHash = v.voterHash ? `${v.voterHash.substring(0, 10)}...${v.voterHash.substring(v.voterHash.length - 8)}` : "N/A";
    const shortTx = v.transactionHash ? `${v.transactionHash.substring(0, 8)}...${v.transactionHash.substring(v.transactionHash.length - 6)}` : "Pending";
    const timeFormatted = v.timestamp ? new Date(v.timestamp).toLocaleTimeString() : "Just now";

    return `
      <tr>
        <td><strong style="color: #fff">#${votes.length - i}</strong></td>
        <td>
          <span style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--accent-cyan);" title="${v.voterHash}">
            ${shortHash}
          </span>
        </td>
        <td>
          <span style="font-weight: 600; color: #fff;">${escapeHtml(v.party)}</span>
        </td>
        <td>
          <span style="font-family: var(--font-mono); color: var(--text-secondary);">
            Block #${v.blockNumber || "-"}
          </span>
        </td>
        <td>
          ${v.etherscanLink ? `<a href="${v.etherscanLink}" target="_blank" rel="noopener" class="tx-hash-link">${shortTx} ↗</a>` : shortTx}
          <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 2px;">${timeFormatted}</div>
        </td>
      </tr>
    `;
  }).join("");
}

function populateSimulatorCandidates(partyNames) {
  const select = document.getElementById("sim-candidate-select");
  if (!select) return;

  const currentVal = select.value;
  select.innerHTML = "";

  partyNames.forEach(name => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    select.appendChild(opt);
  });

  if (currentVal && partyNames.includes(currentVal)) {
    select.value = currentVal;
  }
}

// =========================================================
// ESP32 EDGE SIMULATOR & TESTING STATION
// =========================================================
function initSimulator() {
  const voterIdInput = document.getElementById("sim-voter-id");
  const randomBtn = document.getElementById("btn-random-voter");
  const submitBtn = document.getElementById("btn-submit-vote");
  const fraudBtn = document.getElementById("btn-test-fraud");
  const simConsole = document.getElementById("sim-console");

  if (randomBtn && voterIdInput) {
    randomBtn.addEventListener("click", () => {
      const randomId = `FP_UID_${Math.floor(100000 + Math.random() * 900000)}`;
      voterIdInput.value = randomId;
      logToSimConsole(`Generated random biometric sensor ID: ${randomId}`, "info");
    });
  }

  if (submitBtn) {
    submitBtn.addEventListener("click", async () => {
      const voterId = voterIdInput ? voterIdInput.value.trim() : "";
      const select = document.getElementById("sim-candidate-select");
      const party = select ? select.value : "";

      if (!voterId) {
        showToast("Please enter a Voter ID", "error");
        return;
      }
      if (!party) {
        showToast("Please select a candidate", "error");
        return;
      }

      await executeSimulatedVote(voterId, party, false);
    });
  }

  if (fraudBtn) {
    fraudBtn.addEventListener("click", async () => {
      const voterId = voterIdInput ? voterIdInput.value.trim() : "";
      const select = document.getElementById("sim-candidate-select");
      const party = select ? select.value : "";

      if (!voterId) {
        showToast("Please enter a Voter ID first", "error");
        return;
      }

      logToSimConsole(`\n🛡️ [FRAUD TEST TRIGGERED] Intentionally submitting duplicate vote for ID: ${voterId}...`, "warn");
      await executeSimulatedVote(voterId, party, true);
    });
  }
}

async function executeSimulatedVote(voterId, party, isFraudAttempt = false) {
  const submitBtn = document.getElementById("btn-submit-vote");
  const simConsole = document.getElementById("sim-console");

  if (submitBtn) submitBtn.disabled = true;

  logToSimConsole(`\n--- VOTE SUBMISSION PIPELINE START ---`, "info");
  logToSimConsole(`1. [Edge Hardware] Biometric Scanner captured Voter ID: "${voterId}"`, "info");
  logToSimConsole(`2. [Hardware -> Wi-Fi] Dispatching HTTP POST to /api/blockchain/vote...`, "info");

  // Step visual architecture flow
  triggerArchAnimation();

  try {
    const res = await fetch(`${API_BASE}/api/blockchain/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voterID: voterId, party })
    });

    const data = await res.json();

    if (res.status === 200 && data.success) {
      logToSimConsole(`3. [SHA-256 Engine] Anonymized Voter Hash: ${data.voterHash}`, "success");
      logToSimConsole(`4. [Pre-Flight Guard] Verified on Sepolia contract: Status = Unvoted`, "success");
      logToSimConsole(`5. [EVM Relayer] Signed transaction sent to Sepolia testnet!`, "success");
      logToSimConsole(`6. [Block Confirmation] Mined in Block #${data.blockNumber}`, "success");
      logToSimConsole(`🎉 [CONFIRMED] Tx: ${data.transactionHash}`, "success");
      logToSimConsole(`🔗 Public Etherscan: ${data.etherscanLink}`, "info");

      showToast("Vote successfully secured on Ethereum Sepolia!", "success");
      await refreshData(false);
    } else if (res.status === 409 || data.fraudAlert) {
      logToSimConsole(`🛑 [SECURITY ALERT] DOUBLE-VOTE FRAUD DETECTED!`, "error");
      logToSimConsole(`   • Error: ${data.error}`, "error");
      logToSimConsole(`   • Voter Hash: ${data.voterHash}`, "error");
      logToSimConsole(`   • Action: Blocked before consuming gas fees!`, "warn");

      showToast(data.error || "Fraud Alert: Voter already recorded!", "error");
    } else {
      logToSimConsole(`❌ [ERROR] ${data.error || "Failed to process transaction"}`, "error");
      showToast(data.error || "Transaction submission failed", "error");
    }
  } catch (err) {
    logToSimConsole(`❌ [NETWORK ERROR] ${err.message}`, "error");
    showToast("Network error submitting vote", "error");
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

function logToSimConsole(msg, type = "info") {
  const box = document.getElementById("sim-console");
  if (!box) return;

  const time = new Date().toLocaleTimeString();
  const line = document.createElement("div");

  if (type === "success") line.className = "log-success";
  else if (type === "warn") line.className = "log-warn";
  else if (type === "error") line.className = "log-error";
  else line.className = "";

  line.innerHTML = `<span class="log-time">[${time}]</span> ${escapeHtml(msg)}`;
  box.appendChild(line);
  box.scrollTop = box.scrollHeight;
}

// =========================================================
// VOTER FRAUD AUDITOR
// =========================================================
function initAuditor() {
  const auditInput = document.getElementById("audit-input");
  const auditBtn = document.getElementById("btn-audit-check");
  const auditResult = document.getElementById("audit-result");

  if (!auditBtn || !auditInput || !auditResult) return;

  auditBtn.addEventListener("click", async () => {
    const val = auditInput.value.trim();
    if (!val) {
      showToast("Enter a voter ID or SHA-256 hash", "error");
      return;
    }

    auditResult.innerHTML = `<div style="color: var(--text-muted);">Auditing on-chain registry state...</div>`;

    try {
      const isRaw = !val.startsWith("0x") && val.length < 64;
      const res = await fetch(`${API_BASE}/api/blockchain/hasVoted/${encodeURIComponent(val)}${isRaw ? "?isRawId=true" : ""}`);
      const data = await res.json();

      if (data.success) {
        if (data.hasVoted) {
          auditResult.innerHTML = `
            <div style="padding: 16px; background: rgba(244, 63, 94, 0.1); border: 1px solid var(--accent-rose); border-radius: var(--radius-sm);">
              <h4 style="color: var(--accent-rose); margin-bottom: 6px;">⚠️ VOTED STATUS: RECORDED ON-CHAIN</h4>
              <p style="font-size: 0.85rem; color: #fff;">This voter hash has ALREADY cast an immutable ballot. Any subsequent vote attempts will be rejected.</p>
              <div style="font-family: var(--font-mono); font-size: 0.78rem; margin-top: 8px; color: var(--accent-cyan); word-break: break-all;">
                Hash: ${data.voterHash}
              </div>
            </div>
          `;
        } else {
          auditResult.innerHTML = `
            <div style="padding: 16px; background: rgba(16, 185, 129, 0.1); border: 1px solid var(--accent-emerald); border-radius: var(--radius-sm);">
              <h4 style="color: var(--accent-emerald); margin-bottom: 6px;">✅ VOTED STATUS: ELIGIBLE (NOT RECORDED)</h4>
              <p style="font-size: 0.85rem; color: #fff;">This voter hash has NOT been recorded on the blockchain yet. Eligible to cast a single verified vote.</p>
              <div style="font-family: var(--font-mono); font-size: 0.78rem; margin-top: 8px; color: var(--accent-cyan); word-break: break-all;">
                Hash: ${data.voterHash}
              </div>
            </div>
          `;
        }
      } else {
        auditResult.innerHTML = `<div style="color: var(--accent-rose);">Error: ${data.error || "Lookup failed"}</div>`;
      }
    } catch (err) {
      auditResult.innerHTML = `<div style="color: var(--accent-rose);">Network error during audit</div>`;
    }
  });
}

// =========================================================
// ARCHITECTURE ANIMATION
// =========================================================
function initArchitectureAnimation() {
  const triggerBtn = document.getElementById("btn-trigger-arch-flow");
  if (triggerBtn) {
    triggerBtn.addEventListener("click", () => {
      triggerArchAnimation();
    });
  }
}

function triggerArchAnimation() {
  const nodes = [
    document.getElementById("node-hw-sensor"),
    document.getElementById("node-hw-esp32"),
    document.getElementById("pipe-hw-to-mw"),
    document.getElementById("node-mw-api"),
    document.getElementById("node-mw-crypto"),
    document.getElementById("node-mw-preflight"),
    document.getElementById("pipe-mw-to-bc"),
    document.getElementById("node-bc-evm"),
    document.getElementById("node-bc-contract")
  ];

  nodes.forEach((node, idx) => {
    if (!node) return;
    setTimeout(() => {
      node.classList.add("active-pulse", "active");
      setTimeout(() => {
        node.classList.remove("active-pulse", "active");
      }, 1200);
    }, idx * 280);
  });
}

// =========================================================
// UTILITIES
// =========================================================
function showToast(message, type = "info") {
  let toast = document.getElementById("global-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "global-toast";
    toast.className = "toast";
    document.body.appendChild(toast);
  }

  toast.className = `toast show ${type}`;
  toast.textContent = message;

  setTimeout(() => {
    toast.classList.remove("show");
  }, 3200);
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
