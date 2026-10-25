// ===============================================================================
// VOTECHAIN // SEPOLIA - ELECTORAL COMMISSION CLIENT APPLICATION
// Built with Luxury Monochrome Palette (Gray, Black & Crisp White)
// ===============================================================================

const API_BASE = window.location.origin;

// Party Accent Grading harmonized with luxury monochrome palette
const PARTY_SCHEMES = [
  {
    // BJP - Saffron / Warm Gold
    name: "BJP",
    gpio: "GPIO 13",
    gradient: "linear-gradient(90deg, #D97706 0%, #F59E0B 100%)",
    glow: "rgba(245, 158, 11, 0.45)",
    accent: "#F59E0B",
    badgeBg: "rgba(245, 158, 11, 0.14)",
    border: "rgba(245, 158, 11, 0.35)"
  },
  {
    // UBT - Royal Electric Azure
    name: "UBT",
    gpio: "GPIO 14",
    gradient: "linear-gradient(90deg, #0284C7 0%, #38BDF8 100%)",
    glow: "rgba(56, 189, 248, 0.45)",
    accent: "#38BDF8",
    badgeBg: "rgba(56, 189, 248, 0.14)",
    border: "rgba(56, 189, 248, 0.35)"
  },
  {
    // Congress - Emerald Slate
    name: "Congress",
    gpio: "GPIO 25",
    gradient: "linear-gradient(90deg, #059669 0%, #10B981 100%)",
    glow: "rgba(16, 185, 129, 0.45)",
    accent: "#10B981",
    badgeBg: "rgba(16, 185, 129, 0.14)",
    border: "rgba(16, 185, 129, 0.35)"
  },
  {
    // AIMIM - Royal Amethyst Violet
    name: "AIMIM",
    gpio: "GPIO 26",
    gradient: "linear-gradient(90deg, #7C3AED 0%, #A855F7 100%)",
    glow: "rgba(168, 85, 247, 0.45)",
    accent: "#A855F7",
    badgeBg: "rgba(168, 85, 247, 0.14)",
    border: "rgba(168, 85, 247, 0.35)"
  }
];

// View Titles Mapping
const VIEW_TITLES = {
  "tab-tallies": {
    title: "Executive Results Tabulation",
    subtitle: "Official Cryptographic Tally Confirmed by Ethereum Sepolia"
  },
  "tab-ledger": {
    title: "Permanent Consensus Audit Ledger",
    subtitle: "Publicly Auditable On-Chain Sequence of Mined Blocks"
  },
  "tab-simulator": {
    title: "Voting Enclave Terminal (Booth #01)",
    subtitle: "Direct Biometric Ingestion & Edge Hardware Simulator"
  },
  "tab-auditor": {
    title: "Voter Registry Status Verification",
    subtitle: "Cryptographic Query Engine for Single-Vote Compliance"
  },
  "tab-architecture": {
    title: "System Architecture & Engineering Blueprint",
    subtitle: "End-to-End Edge Hardware to EVM Blockchain Data Pipeline"
  },
  "tab-contract": {
    title: "Smart Contract & Security Specifications",
    subtitle: "Verified EVM Bytecode & On-Chain Consensus Rules"
  }
};

// Application State
let appState = {
  health: null,
  votesData: null,
  recentVotes: [],
  autoRefresh: true,
  refreshTimer: null,
  ledgerSearchQuery: ""
};

// ===============================================================================
// DOM INITIALIZATION
// ===============================================================================
document.addEventListener("DOMContentLoaded", () => {
  initSidebarTabs();
  initMobileMenu();
  initSimulator();
  initAuditor();
  initArchitectureAnimation();
  fetchInitialData();

  // Polling: Auto-sync telemetry every 8 seconds
  appState.refreshTimer = setInterval(() => {
    if (appState.autoRefresh) {
      refreshData(false);
    }
  }, 8000);
});

// ===============================================================================
// SIDEBAR & TAB NAVIGATION
// ===============================================================================
function initSidebarTabs() {
  const navItems = document.querySelectorAll(".nav-item");
  const tabPanes = document.querySelectorAll(".tab-pane");
  const titleEl = document.getElementById("view-title");
  const subtitleEl = document.getElementById("view-subtitle");

  navItems.forEach(item => {
    item.addEventListener("click", () => {
      const targetTab = item.getAttribute("data-tab");

      navItems.forEach(n => n.classList.remove("active"));
      tabPanes.forEach(p => p.classList.remove("active"));

      item.classList.add("active");
      const targetPane = document.getElementById(targetTab);
      if (targetPane) targetPane.classList.add("active");

      // Update Topbar View Title
      if (VIEW_TITLES[targetTab]) {
        if (titleEl) titleEl.textContent = VIEW_TITLES[targetTab].title;
        if (subtitleEl) subtitleEl.textContent = VIEW_TITLES[targetTab].subtitle;
      }

      // Close mobile sidebar if open
      const sidebar = document.getElementById("app-sidebar");
      if (sidebar) sidebar.classList.remove("mobile-open");
    });
  });
}

function initMobileMenu() {
  const toggleBtn = document.getElementById("mobile-toggle");
  const sidebar = document.getElementById("app-sidebar");

  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener("click", () => {
      sidebar.classList.toggle("mobile-open");
    });
  }
}

// ===============================================================================
// DATA INGESTION & SYNCHRONIZATION
// ===============================================================================
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
    if (showToastAlert) showToast("Consensus state synchronized", "success");
  } catch (err) {
    if (showToastAlert) showToast("Failed to refresh telemetry", "error");
  }
}

async function fetchHealth() {
  try {
    const res = await fetch(`${API_BASE}/api/health`);
    const data = await res.json();
    appState.health = data;

    // Topbar & Sidebar Block Number
    const blockNum = data.network?.blockNumber ? `#${data.network.blockNumber.toLocaleString()}` : "#...";
    const topBlockEl = document.getElementById("topbar-block");
    const sideBlockEl = document.getElementById("sidebar-block-number");
    if (topBlockEl) topBlockEl.textContent = blockNum;
    if (sideBlockEl) sideBlockEl.textContent = blockNum;

    // Latency
    const latencyEl = document.getElementById("topbar-latency");
    if (latencyEl && data.network?.latencyMs !== null) {
      latencyEl.textContent = `${data.network.latencyMs}ms`;
    }

    // Contract Address & Links
    if (data.contract?.address) {
      const addr = data.contract.address;
      const shortAddr = `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
      const topContractEl = document.getElementById("topbar-contract");
      const contractLinkEl = document.getElementById("contract-link");

      if (topContractEl) topContractEl.textContent = shortAddr;
      if (contractLinkEl) contractLinkEl.href = data.contract.etherscanUrl;
    }

    // Relayer Balance
    const sideBalEl = document.getElementById("sidebar-relayer-bal");
    const kpiBalEl = document.getElementById("kpi-relayer-bal");
    let balStr = "0.0500 ETH";

    if (data.relayer?.configured && data.relayer.balanceEth) {
      const balNum = Number(data.relayer.balanceEth);
      balStr = `${balNum.toFixed(4)} ETH`;
    }

    if (sideBalEl) sideBalEl.textContent = balStr;
    if (kpiBalEl) kpiBalEl.textContent = balStr;

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

// ===============================================================================
// RENDERING ENGINES
// ===============================================================================
function renderTallies(data) {
  const container = document.getElementById("candidate-cards-container");
  const totalVotesEl = document.getElementById("kpi-total-votes");
  const leadingPartyEl = document.getElementById("kpi-leading-party");

  const total = data.totalVotes || 0;
  if (totalVotesEl) totalVotesEl.textContent = total.toLocaleString();

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
  if (!container) return;

  container.innerHTML = "";

  if (parties.length === 0) {
    container.innerHTML = `
      <div style="padding: 40px; text-align: center; color: var(--c-silver); grid-column: span 2;">
        No certified candidates registered in the current electoral mapping.
      </div>
    `;
    return;
  }

  parties.forEach(([party, count], idx) => {
    // Find matching scheme by name or index fallback
    const matchedScheme = PARTY_SCHEMES.find(s => s.name.toLowerCase() === party.toLowerCase()) || PARTY_SCHEMES[idx % PARTY_SCHEMES.length];
    const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : "0.0";
    const gpioPin = matchedScheme.gpio || `GPIO ${[13, 14, 25, 26][idx % 4]}`;

    const card = document.createElement("div");
    card.className = "candidate-entry-card";
    card.style.setProperty("--entry-accent", matchedScheme.gradient);
    card.style.setProperty("--entry-glow", matchedScheme.glow);

    card.innerHTML = `
      <div>
        <div class="candidate-top">
          <div>
            <h4 class="candidate-name">${escapeHtml(party)}</h4>
            <span class="candidate-affiliation">Official Ballot Choice • Verified Enclave</span>
          </div>
          <span class="status-badge-mined" style="color: ${matchedScheme.accent}; background: ${matchedScheme.badgeBg}; border: 1px solid ${matchedScheme.border};">
            ${gpioPin}
          </span>
        </div>
        <div class="tally-digits">
          <span class="tally-number">${count.toLocaleString()}</span>
          <span class="tally-pct">${percentage}% of certified ballots</span>
        </div>
        <div class="meter-track">
          <div class="meter-fill" style="width: ${percentage}%;"></div>
        </div>
      </div>

      <div class="candidate-card-footer">
        <span style="font-size: 0.72rem; color: var(--c-silver); font-family: var(--font-mono);">
          Sepolia Verified
        </span>
        <button class="btn-card-vote" onclick="quickSelectParty('${escapeHtml(party)}')">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
          <span>Select in Enclave</span>
        </button>
      </div>
    `;
    container.appendChild(card);
  });

  // Populate candidate select in simulator
  populateSimulatorCandidates(parties.map(p => p[0]));
}

function renderRecentLedger(votes) {
  const tbody = document.getElementById("audit-table-body");
  const countEl = document.getElementById("ledger-count-val");
  if (!tbody) return;

  // Apply search query filter if user typed in search box
  const query = (appState.ledgerSearchQuery || "").toLowerCase().trim();
  const filtered = query
    ? votes.filter(v => (v.party && v.party.toLowerCase().includes(query)) || (v.voterHash && v.voterHash.toLowerCase().includes(query)) || (v.transactionHash && v.transactionHash.toLowerCase().includes(query)))
    : votes;

  if (countEl) countEl.textContent = filtered.length;

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 48px 24px; color: var(--c-silver);">
          ${query ? `No ledger records matching "${escapeHtml(query)}"` : "No ballots have been committed in the current operational session."}
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map((v, i) => {
    const seqNum = filtered.length - i;
    const shortHash = v.voterHash ? `${v.voterHash.substring(0, 10)}...${v.voterHash.substring(v.voterHash.length - 8)}` : "N/A";
    const shortTx = v.transactionHash ? `${v.transactionHash.substring(0, 8)}...${v.transactionHash.substring(v.transactionHash.length - 6)}` : "Pending";
    const timeFormatted = v.timestamp ? new Date(v.timestamp).toLocaleTimeString() : "Just now";

    return `
      <tr>
        <td><strong style="color: var(--c-pearl); font-family: var(--font-mono);">#${seqNum.toString().padStart(3, '0')}</strong></td>
        <td>
          <span class="hash-cell" title="${v.voterHash}">
            <span>${shortHash}</span>
            <button class="copy-mini-btn" onclick="copyToClipboard('${v.voterHash}')" title="Copy full SHA-256 hash">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
            </button>
          </span>
        </td>
        <td>
          <span style="font-weight: 700; color: var(--c-pearl);">${escapeHtml(v.party)}</span>
        </td>
        <td>
          <span style="font-family: var(--font-mono); color: var(--c-silver);">
            Block #${v.blockNumber ? v.blockNumber.toLocaleString() : "-"}
          </span>
        </td>
        <td>
          ${v.etherscanLink 
            ? `<a href="${v.etherscanLink}" target="_blank" rel="noopener" class="btn-icon-link" style="font-family: var(--font-mono); font-size: 0.8rem;">${shortTx} ↗</a>` 
            : `<span style="font-family: var(--font-mono); font-size: 0.8rem;">${shortTx}</span>`
          }
          <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 3px;">${timeFormatted}</div>
        </td>
        <td>
          <span class="status-badge-mined">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <span>Finalized</span>
          </span>
        </td>
      </tr>
    `;
  }).join("");
}

// Search filter for audit ledger table
function filterLedger(query) {
  appState.ledgerSearchQuery = query;
  renderRecentLedger(appState.recentVotes);
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

// Quick select party and switch to simulator tab
function quickSelectParty(partyName) {
  const select = document.getElementById("sim-candidate-select");
  if (select) select.value = partyName;

  const simTabBtn = document.querySelector('[data-tab="tab-simulator"]');
  if (simTabBtn) simTabBtn.click();

  showToast(`Selected ballot candidate: ${partyName}`, "info");
}

// Quick select citizen identifier
function setSimVoter(uid, btnEl) {
  const input = document.getElementById("sim-voter-id");
  if (input) input.value = uid;

  if (btnEl) {
    document.querySelectorAll(".citizen-preset-group .btn-preset-pill").forEach(b => b.classList.remove("active"));
    btnEl.classList.add("active");
  }

  logToSimConsole(`Loaded citizen template UID: ${uid}`, "info");
}

function setSimParty(partyName) {
  const select = document.getElementById("sim-candidate-select");
  if (select) {
    select.value = partyName;
    showToast(`Ballot selection: ${partyName}`, "info");
  }
}

function setAuditVoter(uid) {
  const input = document.getElementById("audit-input");
  if (input) input.value = uid;
  const btn = document.getElementById("btn-audit-check");
  if (btn) btn.click();
}

// ===============================================================================
// ENCLAVE SIMULATOR
// ===============================================================================
function initSimulator() {
  const voterIdInput = document.getElementById("sim-voter-id");
  const randomBtn = document.getElementById("btn-random-voter");
  const submitBtn = document.getElementById("btn-submit-vote");
  const fraudBtn = document.getElementById("btn-test-fraud");

  if (randomBtn && voterIdInput) {
    randomBtn.addEventListener("click", () => {
      const randomId = `FP_UID_${Math.floor(10000 + Math.random() * 90000)}`;
      voterIdInput.value = randomId;
      logToSimConsole(`Generated citizen biometric identifier: ${randomId}`, "info");
    });
  }

  if (submitBtn) {
    submitBtn.addEventListener("click", async () => {
      const voterId = voterIdInput ? voterIdInput.value.trim() : "";
      const select = document.getElementById("sim-candidate-select");
      const party = select ? select.value : "";

      if (!voterId) {
        showToast("Enter a citizen biometric identifier", "error");
        return;
      }
      if (!party) {
        showToast("Select a registered ballot candidate", "error");
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
        showToast("Enter a citizen identifier first", "error");
        return;
      }

      logToSimConsole(`\n🛑 [SECURITY AUDIT] Simulating double-voting attack for UID: ${voterId}...`, "warn");
      await executeSimulatedVote(voterId, party, true);
    });
  }
}

async function executeSimulatedVote(voterId, party, isFraudAttempt = false) {
  const submitBtn = document.getElementById("btn-submit-vote");
  if (submitBtn) submitBtn.disabled = true;

  logToSimConsole(`\n--- VOTING CONDUIT EXECUTION ---`, "info");
  logToSimConsole(`1. [Edge Terminal] Optical scanner captured minutiae for Citizen ID: "${voterId}"`, "info");
  logToSimConsole(`2. [Hardware -> Wi-Fi] Dispatching authenticated packet to /api/blockchain/vote...`, "info");

  triggerArchAnimation();

  try {
    const res = await fetch(`${API_BASE}/api/blockchain/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voterID: voterId, party })
    });

    const data = await res.json();

    if (res.status === 200 && data.success) {
      logToSimConsole(`3. [SHA-256 Engine] Cryptographic Anonymized Hash: ${data.voterHash}`, "success");
      logToSimConsole(`4. [Pre-Flight Guard] Verified contract state: Unvoted (hasVoted = false)`, "success");
      logToSimConsole(`5. [EVM Consensus] Transaction broadcasted and mined into Block #${data.blockNumber}`, "success");
      logToSimConsole(`✅ [FINALIZED] Tx Hash: ${data.transactionHash}`, "success");
      logToSimConsole(`🔗 Public Etherscan: ${data.etherscanLink}`, "info");

      showToast("Vote successfully committed to Sepolia ledger", "success");
      await refreshData(false);
    } else if (res.status === 409 || data.fraudAlert) {
      logToSimConsole(`🛑 [FRAUD DETECTED] DOUBLE-VOTING VIOLATION BLOCKED!`, "error");
      logToSimConsole(`   • Violation: ${data.error}`, "error");
      logToSimConsole(`   • Anonymized Hash: ${data.voterHash}`, "error");
      logToSimConsole(`   • Outcome: Pre-flight check rejected ballot. Zero gas consumed.`, "warn");

      showToast(data.error || "Fraud Alert: Voter already recorded!", "error");
    } else {
      logToSimConsole(`❌ [ERROR] ${data.error || "Transaction broadcast failed"}`, "error");
      showToast(data.error || "Transaction submission failed", "error");
    }
  } catch (err) {
    logToSimConsole(`❌ [NETWORK FAULT] ${err.message}`, "error");
    showToast("Network fault reaching consensus relayer", "error");
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

// ===============================================================================
// FRAUD AUDITOR
// ===============================================================================
function initAuditor() {
  const auditInput = document.getElementById("audit-input");
  const auditBtn = document.getElementById("btn-audit-check");
  const auditResult = document.getElementById("audit-result");

  if (!auditBtn || !auditInput || !auditResult) return;

  auditBtn.addEventListener("click", async () => {
    const val = auditInput.value.trim();
    if (!val) {
      showToast("Enter a citizen ID or 64-character SHA-256 hash", "error");
      return;
    }

    auditResult.innerHTML = `
      <div style="padding: 24px; text-align: center; color: var(--c-silver); font-size: 0.85rem;">
        Querying Ethereum Sepolia contract state...
      </div>
    `;

    try {
      const isRaw = !val.startsWith("0x") && val.length < 64;
      const res = await fetch(`${API_BASE}/api/blockchain/hasVoted/${encodeURIComponent(val)}${isRaw ? "?isRawId=true" : ""}`);
      const data = await res.json();

      if (data.success) {
        if (data.hasVoted) {
          auditResult.innerHTML = `
            <div style="padding: 24px; background: rgba(244, 63, 94, 0.08); border: 1px solid rgba(244, 63, 94, 0.4); border-radius: var(--radius-sm); box-shadow: var(--shadow-ambient);">
              <div style="display: flex; align-items: center; gap: 10px; color: #fb7185; font-weight: 800; font-size: 0.95rem; margin-bottom: 8px;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                </svg>
                <span>STATUS: BALLOT RECORDED (INELIGIBLE)</span>
              </div>
              <p style="font-size: 0.85rem; color: var(--c-pearl); line-height: 1.6;">
                This citizen biometric identity has already cast an immutable ballot on the Ethereum Sepolia ledger. Any duplicate submission will be rejected by the consensus rules.
              </p>
              <div style="font-family: var(--font-mono); font-size: 0.76rem; margin-top: 14px; color: var(--c-pearl); word-break: break-all; background: rgba(6,20,27,0.7); border: 1px solid var(--border-glass); padding: 8px 12px; border-radius: 6px;">
                Cryptographic Hash: ${data.voterHash}
              </div>
            </div>
          `;
        } else {
          auditResult.innerHTML = `
            <div style="padding: 24px; background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.4); border-radius: var(--radius-sm); box-shadow: var(--shadow-ambient);">
              <div style="display: flex; align-items: center; gap: 10px; color: var(--accent-emerald); font-weight: 800; font-size: 0.95rem; margin-bottom: 8px;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
                <span>STATUS: ELIGIBLE TO VOTE (UNVOTED)</span>
              </div>
              <p style="font-size: 0.85rem; color: var(--c-pearl); line-height: 1.6;">
                This identity does not currently exist in the mined consensus state. The citizen is authenticated and eligible to cast a single verified ballot.
              </p>
              <div style="font-family: var(--font-mono); font-size: 0.76rem; margin-top: 14px; color: var(--c-pearl); word-break: break-all; background: rgba(6,20,27,0.7); border: 1px solid var(--border-glass); padding: 8px 12px; border-radius: 6px;">
                Cryptographic Hash: ${data.voterHash}
              </div>
            </div>
          `;
        }
      } else {
        auditResult.innerHTML = `<div style="color: #fb7185; padding: 20px;">Error: ${data.error || "Lookup failed"}</div>`;
      }
    } catch (err) {
      auditResult.innerHTML = `<div style="color: #fb7185; padding: 20px;">Network fault during registry audit</div>`;
    }
  });
}

// ===============================================================================
// ARCHITECTURE ANIMATION
// ===============================================================================
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
      }, 1000);
    }, idx * 220);
  });
}

// ===============================================================================
// EXPORT AUDIT JSON
// ===============================================================================
function exportLedgerJSON() {
  if (!appState.recentVotes || appState.recentVotes.length === 0) {
    showToast("No audit records available to export", "error");
    return;
  }

  const exportData = {
    organization: "VOTECHAIN Electoral Commission",
    network: "Ethereum Sepolia (Chain ID: 11155111)",
    exportedAt: new Date().toISOString(),
    totalCertifiedVotes: appState.recentVotes.length,
    ledger: appState.recentVotes
  };

  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
  const downloadAnchor = document.createElement("a");
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `VOTECHAIN_Audit_Ledger_${Date.now()}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();

  showToast("Audit JSON exported successfully", "success");
}

// ===============================================================================
// UTILITIES
// ===============================================================================
function copyToClipboard(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => {
      showToast("Hash copied to clipboard", "success");
    });
  }
}

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
  }, 3000);
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
