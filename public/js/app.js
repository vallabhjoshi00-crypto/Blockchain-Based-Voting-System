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

// 4 State Regions and Sub-Regions (Districts)
const STATE_DISTRICTS = {
  Konkan: ["Mumbai", "Thane", "Raigad", "Palghar"],
  Vidarbha: ["Nagpur", "Amravati", "Akola", "Wardha"],
  Marathwada: ["Aurangabad", "Nanded", "Latur", "Jalna"],
  Paschim: ["Pune", "Kolhapur", "Satara", "Solapur"]
};

function updateDistrictOptions(selectedRegion, targetSelectId = "bio-enroll-district") {
  const select = document.getElementById(targetSelectId);
  if (!select) return;
  const list = STATE_DISTRICTS[selectedRegion] || STATE_DISTRICTS["Konkan"];
  select.innerHTML = "";
  list.forEach(d => {
    const opt = document.createElement("option");
    opt.value = d;
    opt.textContent = d;
    select.appendChild(opt);
  });
}

function updateSimRegion(region) {
  updateDistrictOptions(region, "sim-district-select");
  const indicator = document.getElementById("sim-regional-franchise-indicator");
  if (indicator) {
    indicator.textContent = `🌐 Remote Voting: Terminal dynamically adapts to voter's registered home region: ${region}`;
  }
}

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
  "tab-biometrics": {
    title: "Biometric Registry // MongoDB Datastore",
    subtitle: "Centralized Secure Storage for R307 512-Byte Optical Fingerprint Minutiae & Citizen IDs"
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
  currentRound: 1,
  autoRefresh: true,
  refreshTimer: null,
  ledgerSearchQuery: "",
  biometricVoters: [],
  biometricFilter: "all",
  biometricSearch: ""
};

// ===============================================================================
// DOM INITIALIZATION
// ===============================================================================
document.addEventListener("DOMContentLoaded", () => {
  initSidebarTabs();
  initMobileMenu();
  initSimulator();
  initAuditor();
  initBiometrics();
  initArchitectureAnimation();
  fetchInitialData();

  // Polling: Auto-sync telemetry every 2 seconds for near real-time hardware sync
  appState.refreshTimer = setInterval(() => {
    if (appState.autoRefresh) {
      refreshData(false);
      loadBiometricsData(false);
    }
  }, 2000);
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

    // Election Round
    if (data.electionRound) {
      const topRoundEl = document.getElementById("topbar-round");
      if (topRoundEl) topRoundEl.textContent = `#${data.electionRound} Active`;

      if (appState.currentRound && data.electionRound > appState.currentRound) {
        logToSimConsole(`🔄 [SYSTEM RESET] Election Round #${data.electionRound} initialized! All citizen voter IDs are eligible to vote.`, "success");
        showToast(`🔄 Round #${data.electionRound} started! Voter registry refreshed.`, "info");
      }
      appState.currentRound = data.electionRound;
    }

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

    // MongoDB Telemetry
    const sideMongoEl = document.getElementById("sidebar-mongo-status");
    if (sideMongoEl && data.mongodb) {
      if (data.mongodb.connected) {
        sideMongoEl.textContent = "Online";
        sideMongoEl.style.color = "#10B981";
      } else {
        sideMongoEl.textContent = "Buffer Mode";
        sideMongoEl.style.color = "#F59E0B";
      }
    }

    if (data.biometrics?.total !== undefined) {
      const bioCountEl = document.getElementById("sidebar-biometric-count");
      if (bioCountEl) bioCountEl.textContent = data.biometrics.total;
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
      if (data.electionRound) {
        const topRoundEl = document.getElementById("topbar-round");
        if (topRoundEl) topRoundEl.textContent = `#${data.electionRound} Active`;
        if (appState.currentRound && data.electionRound > appState.currentRound) {
          appState.currentRound = data.electionRound;
        }
      }
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

  // Render Regional Constituency Tabulation (4 State Regions)
  const regContainer = document.getElementById("regional-tallies-container");
  if (regContainer && data.regionalTallies) {
    regContainer.innerHTML = "";
    Object.entries(data.regionalTallies).forEach(([regName, partyVotes]) => {
      const regDistricts = STATE_DISTRICTS[regName] || [];
      const regCard = document.createElement("div");
      regCard.style.cssText = "background: rgba(14, 18, 27, 0.7); border: 1px solid var(--border-glass); border-radius: 8px; padding: 14px;";

      let totalRegVotes = Object.values(partyVotes).reduce((a, b) => a + b, 0);

      let rowsHtml = Object.entries(partyVotes).map(([p, count]) => `
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.78rem; padding: 4px 0; border-bottom: 1px dashed rgba(255,255,255,0.04);">
          <span style="color: var(--c-pearl); font-weight: 600;">${p}</span>
          <span style="font-family: var(--font-mono); color: #38BDF8; font-weight: 700;">${count}</span>
        </div>
      `).join("");

      regCard.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 8px;">
          <div>
            <h4 style="font-size: 0.96rem; font-weight: 700; color: #fff; margin: 0 0 2px 0;">${regName}</h4>
            <span style="font-size: 0.68rem; color: var(--mono-silver);">${regDistricts.join(", ")}</span>
          </div>
          <span class="badge" style="background: rgba(56, 189, 248, 0.15); color: #38BDF8; font-family: var(--font-mono); font-size: 0.72rem; padding: 2px 8px; border-radius: 4px;">${totalRegVotes} Votes</span>
        </div>
        <div>${rowsHtml}</div>
      `;
      regContainer.appendChild(regCard);
    });
  }
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

// Quick select citizen identifier with regional franchise support
function setSimVoter(uid, btnEl, region, district) {
  const input = document.getElementById("sim-voter-id");
  if (input) input.value = uid;

  if (btnEl) {
    document.querySelectorAll(".citizen-preset-group .btn-preset-pill").forEach(b => b.classList.remove("active"));
    btnEl.classList.add("active");
  }

  if (region) {
    const regSelect = document.getElementById("sim-region-select");
    if (regSelect) {
      regSelect.value = region;
      updateSimRegion(region);
    }
  }
  if (district) {
    const distSelect = document.getElementById("sim-district-select");
    if (distSelect) distSelect.value = district;
  }

  logToSimConsole(`Loaded citizen template UID: ${uid} [Constituency: ${region || "Auto"} - ${district || "Auto"}]`, "info");
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

  const region = document.getElementById("sim-region-select")?.value || "Konkan";
  const district = document.getElementById("sim-district-select")?.value || "Mumbai";

  logToSimConsole(`\n--- VOTING CONDUIT EXECUTION ---`, "info");
  logToSimConsole(`1. [Edge Terminal] Optical scanner captured minutiae for Citizen ID: "${voterId}"`, "info");
  logToSimConsole(`2. [Regional Franchise] Ingesting ballot for Region: [${region} - ${district}]`, "info");
  logToSimConsole(`3. [Hardware -> Wi-Fi] Dispatching authenticated packet to /api/blockchain/vote...`, "info");

  triggerArchAnimation();

  try {
    const res = await fetch(`${API_BASE}/api/blockchain/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        voterID: voterId,
        party,
        region,
        district,
        ballotRegion: region,
        terminalLocation: "Booth #01 Enclave"
      })
    });

    const data = await res.json();

    if (res.status === 200 && data.success) {
      if (data.biometric && data.biometric.citizenName) {
        logToSimConsole(`4. [MongoDB Datastore] Biometric Profile Synced: ${data.biometric.citizenName} (Slot #${data.biometric.slot}) [${data.region || region}] marked as Voted`, "success");
      }
      logToSimConsole(`5. [SHA-256 Engine] Cryptographic Anonymized Hash: ${data.voterHash}`, "success");
      logToSimConsole(`6. [Pre-Flight Guard] Verified contract state: Unvoted (hasVoted = false)`, "success");
      logToSimConsole(`7. [EVM Consensus] Transaction broadcasted and mined into Block #${data.blockNumber} for ${data.region || region}`, "success");
      logToSimConsole(`✅ [FINALIZED] Tx Hash: ${data.transactionHash}`, "success");
      logToSimConsole(`🔗 Public Etherscan: ${data.etherscanLink}`, "info");

      showToast(`Vote successfully committed to Sepolia ledger for ${data.region || region}!`, "success");
      await refreshData(false);
      loadBiometricsData(false);
    } else if (res.status === 403 || data.regionalViolation) {
      logToSimConsole(`🛑 [REGIONAL FRANCHISE VIOLATION] CROSS-CONSTITUENCY BALLOT BLOCKED!`, "error");
      logToSimConsole(`   • Violation: ${data.error}`, "error");
      logToSimConsole(`   • Registered Home Region: ${data.registeredRegion}`, "error");
      logToSimConsole(`   • Attempted Ballot Region: ${data.attemptedRegion}`, "error");
      logToSimConsole(`   • Rule: Voters can use ANY machine remotely, but can ONLY vote for their home region!`, "warn");
      showToast(data.error || "Regional Franchise Violation: Cannot vote in other regions!", "error");
      loadBiometricsData(false);
    } else if (res.status === 409 || data.fraudAlert) {
      logToSimConsole(`🛑 [FRAUD DETECTED] DOUBLE-VOTING VIOLATION BLOCKED!`, "error");
      logToSimConsole(`   • Violation: ${data.error}`, "error");
      logToSimConsole(`   • Anonymized Hash: ${data.voterHash}`, "error");
      logToSimConsole(`   • MongoDB Audit: FRAUD_REJECTED event logged in biometric_audit_logs`, "warn");
      logToSimConsole(`   • Outcome: Pre-flight check rejected ballot. Zero gas consumed.`, "warn");

      showToast(data.error || "Fraud Alert: Voter already recorded!", "error");
      loadBiometricsData(false);
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

// ===============================================================================
// RESULTS SHOWCASE & ELECTION RESET ENGINE
// ===============================================================================
async function showcaseResultsAndReset() {
  const btnTallies = document.getElementById("btn-showcase-tallies");
  const btnSim = document.getElementById("btn-sim-result");
  if (btnTallies) btnTallies.disabled = true;
  if (btnSim) btnSim.disabled = true;

  logToSimConsole(`\n📊 [RESULT KEY TRIGGERED] Concluding voting program & querying official tabulation...`, "warn");

  try {
    const res = await fetch(`${API_BASE}/api/election/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "WEB_DASHBOARD_RESULT_BUTTON" })
    });

    const data = await res.json();

    if (data.success) {
      const conc = data.concludedElection || {};
      const winnerName = conc.winner || "No Ballots Cast";
      const totalBallots = conc.totalVotes || 0;

      // Update Showcase Modal elements
      const modal = document.getElementById("modal-showcase");
      const winnerEl = document.getElementById("showcase-winner-name");
      const metaEl = document.getElementById("showcase-winner-meta");
      const roundBadgeEl = document.getElementById("showcase-round-badge");
      const talliesContainer = document.getElementById("showcase-tallies-list");

      if (winnerEl) winnerEl.textContent = winnerName;
      if (metaEl) metaEl.textContent = `${totalBallots} Total Certified Ballots Recorded`;
      if (roundBadgeEl) roundBadgeEl.textContent = `Round #${data.concludedRound} Certified Final`;

      if (talliesContainer && conc.tallies) {
        talliesContainer.innerHTML = "";
        const parties = Object.entries(conc.tallies);
        parties.forEach(([pName, pVotes]) => {
          const pct = totalBallots > 0 ? ((pVotes / totalBallots) * 100).toFixed(1) : "0.0";
          const row = document.createElement("div");
          row.className = "showcase-tally-row";
          row.innerHTML = `
            <div class="showcase-party-info">
              <span class="showcase-party-name">${escapeHtml(pName)}</span>
            </div>
            <div>
              <span class="showcase-party-count">${pVotes} Votes</span>
              <span class="showcase-party-pct">(${pct}%)</span>
            </div>
          `;
          talliesContainer.appendChild(row);
        });
      }

      if (modal) modal.style.display = "flex";

      // Log to Enclave Simulator Console
      logToSimConsole(`🏆 [RESULTS SHOWCASED] Round #${data.concludedRound} concluded! Victor: ${winnerName} (${totalBallots} votes)`, "success");
      logToSimConsole(`🔄 [SYSTEM RESET] Initialized Election Round #${data.newRound}!`, "success");
      logToSimConsole(`✨ [VOTER REGISTRY CLEARED] All citizen IDs (Vallabh, Payal, Prathamesh, Sanika...) have been reset.`, "info");
      logToSimConsole(`🗳️ Citizens who previously voted are now eligible to cast their ballot again for Round #${data.newRound}!`, "info");

      appState.currentRound = data.newRound;
      const topRoundEl = document.getElementById("topbar-round");
      if (topRoundEl) topRoundEl.textContent = `#${data.newRound} Active`;

      // Refresh telemetry & tallies
      await refreshData(false);
      showToast(`🏆 Results Showcased! System reset for Round #${data.newRound}. Citizens can vote again!`, "success");
    } else {
      showToast(data.error || "Failed to conclude election", "error");
    }
  } catch (err) {
    console.error("Showcase & Reset Error:", err);
    showToast("Network fault during election reset", "error");
  } finally {
    if (btnTallies) btnTallies.disabled = false;
    if (btnSim) btnSim.disabled = false;
  }
}

function closeShowcaseModal() {
  const modal = document.getElementById("modal-showcase");
  if (modal) modal.style.display = "none";
}

// ===============================================================================
// BIOMETRIC REGISTRY & MONGODB CLIENT LOGIC
// ===============================================================================

let lastSimulatedTemplate = "";

function initBiometrics() {
  loadBiometricsData(true);
}

/**
 * Fetches and updates live MongoDB biometric telemetry, voter directory, and audit logs
 */
async function loadBiometricsData(showLoading = false) {
  const cardsContainer = document.getElementById("voters-cards-list");
  if (showLoading && cardsContainer && !appState.biometricVoters.length) {
    cardsContainer.innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--mono-muted); font-size: 0.85rem;">
        Synchronizing with MongoDB biometric store...
      </div>
    `;
  }

  try {
    // 1. Fetch MongoDB Telemetry & Stats
    const statusRes = await fetch(`${API_BASE}/api/fingerprints/status`);
    const statusData = await statusRes.json();

    if (statusData.success) {
      const mongo = statusData.mongodb;
      const stats = statusData.stats;

      // Status Pill
      const pill = document.getElementById("mongo-status-pill");
      const text = document.getElementById("mongo-status-text");
      if (pill && text) {
        if (mongo.connected) {
          pill.className = "mongo-status-pill online";
          text.textContent = "MongoDB Connected";
        } else {
          pill.className = "mongo-status-pill offline";
          text.textContent = "MongoDB Buffer Mode";
        }
      }

      // KPIs
      const statTotalEl = document.getElementById("bio-stat-total");
      const statSlotsEl = document.getElementById("bio-stat-slots");
      const statVotedEl = document.getElementById("bio-stat-voted");
      const statTurnoutEl = document.getElementById("bio-stat-turnout");
      const statDbEl = document.getElementById("bio-stat-db");
      const statCollsEl = document.getElementById("bio-stat-colls");

      if (statTotalEl) statTotalEl.textContent = stats.total;
      if (statSlotsEl) statSlotsEl.textContent = `${stats.total} / 127`;
      if (statVotedEl) statVotedEl.textContent = stats.voted;
      if (statTurnoutEl) statTurnoutEl.textContent = `${stats.turnoutPct}% Turnout`;
      if (statDbEl) statDbEl.textContent = mongo.database || "biometric_voting";
      if (statCollsEl) statCollsEl.textContent = `Mode: ${mongo.mode}`;

      // Sidebar count
      const sideCount = document.getElementById("sidebar-biometric-count");
      if (sideCount) sideCount.textContent = stats.total;
    }

    // 2. Fetch Enrolled Voters List
    const votersRes = await fetch(`${API_BASE}/api/fingerprints`);
    const votersData = await votersRes.json();

    if (votersData.success) {
      appState.biometricVoters = votersData.voters || [];
      renderBiometricVoters(appState.biometricVoters);
      populateScannerSelect(appState.biometricVoters);
    }

    // 3. Fetch Biometric Audit Logs
    const auditRes = await fetch(`${API_BASE}/api/fingerprints/audit-logs?limit=25`);
    const auditData = await auditRes.json();
    if (auditData.success) {
      renderBiometricAuditLogs(auditData.logs || []);
    }

  } catch (err) {
    console.error("Biometrics fetch error:", err);
  }
}

/**
 * Renders voter cards into directory grid
 */
function renderBiometricVoters(voters) {
  const container = document.getElementById("voters-cards-list");
  if (!container) return;

  let filtered = [...voters];

  // Apply Filter
  if (appState.biometricFilter === "unvoted") {
    filtered = filtered.filter(v => !v.hasVoted);
  } else if (appState.biometricFilter === "voted") {
    filtered = filtered.filter(v => v.hasVoted);
  } else if (["konkan", "vidarbha", "marathwada", "paschim"].includes(appState.biometricFilter.toLowerCase())) {
    filtered = filtered.filter(v => v.region && v.region.toLowerCase() === appState.biometricFilter.toLowerCase());
  }

  // Apply Search
  if (appState.biometricSearch) {
    const q = appState.biometricSearch.toLowerCase();
    filtered = filtered.filter(v =>
      v.name.toLowerCase().includes(q) ||
      v.voterId.toLowerCase().includes(q) ||
      (v.constituency && v.constituency.toLowerCase().includes(q)) ||
      (v.region && v.region.toLowerCase().includes(q)) ||
      (v.district && v.district.toLowerCase().includes(q)) ||
      (v.nationalId && v.nationalId.toLowerCase().includes(q))
    );
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--mono-silver); font-size: 0.85rem;">
        No citizen biometric profiles matched your query.
      </div>
    `;
    return;
  }

  container.innerHTML = "";

  filtered.forEach(voter => {
    const card = document.createElement("div");
    card.className = "voter-card-item";

    const isVoted = voter.hasVoted;
    const statusBadge = isVoted
      ? `<span class="status-badge-mined" style="color: #fb7185; background: rgba(244,63,94,0.12); border: 1px solid rgba(244,63,94,0.3); font-size: 0.65rem;">Ballot Cast (Round #${voter.votedRound || 1})</span>`
      : `<span class="status-badge-mined" style="color: #10B981; background: rgba(16,185,129,0.12); border: 1px solid rgba(16,185,129,0.3); font-size: 0.65rem;">Ready to Vote</span>`;

    const regBadge = `<span class="badge" style="background: rgba(56,189,248,0.12); color: #38BDF8; border: 1px solid rgba(56,189,248,0.25); font-size: 0.65rem; padding: 1px 6px; border-radius: 4px;">${escapeHtml(voter.region || "Konkan")} • ${escapeHtml(voter.district || "Mumbai")}</span>`;

    const truncatedHash = voter.templateHash
      ? `${voter.templateHash.substring(0, 10)}...${voter.templateHash.substring(voter.templateHash.length - 8)}`
      : "Pending";

    card.innerHTML = `
      <div class="voter-avatar-slot">
        #${voter.fingerprintSlot}
        <span>Slot</span>
      </div>

      <div class="voter-item-info">
        <div class="voter-item-name" style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          <span>${escapeHtml(voter.name)}</span>
          ${regBadge}
          ${statusBadge}
        </div>
        <div class="voter-item-meta">
          <span><strong>UID:</strong> ${escapeHtml(voter.voterId)}</span>
          <span><strong>Constituency:</strong> ${escapeHtml(voter.constituency || (voter.region + " - " + voter.district))}</span>
          <span><strong>Age/Gender:</strong> ${voter.age || 25} / ${escapeHtml(voter.gender || "Undisclosed")}</span>
          <span><strong>Finger:</strong> ${escapeHtml(voter.fingerIndex || "Index")}</span>
        </div>
        <div class="voter-item-hash">
          Registered: <code>${new Date(voter.registrationAt || voter.registeredAt || Date.now()).toLocaleDateString()}</code>
        </div>
      </div>

      <div class="voter-actions-row">
        <button class="btn-icon-sm" onclick="testScanSpecificVoter('${escapeHtml(voter.voterId)}')" title="Test Scan on R307 Optical Sensor">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 004 11m0 0a8 8 0 00.99 7.132"/>
          </svg>
        </button>

        <button class="btn-icon-sm" onclick="loadCitizenIntoTerminal('${escapeHtml(voter.voterId)}', '${escapeHtml(voter.name)}', '${escapeHtml(voter.region || "Konkan")}', '${escapeHtml(voter.district || "Mumbai")}')" title="Authorize in Booth #01 Terminal">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>

        <button class="btn-icon-sm danger" onclick="deleteBiometricVoter('${escapeHtml(voter.voterId)}', '${escapeHtml(voter.name)}')" title="Remove Biometric Profile">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      </div>
    `;

    container.appendChild(card);
  });
}

/**
 * Populates optical scanner verification dropdown
 */
function populateScannerSelect(voters) {
  const select = document.getElementById("verify-select-voter");
  if (!select) return;

  const currentVal = select.value;
  select.innerHTML = `<option value="">Choose Enrolled Voter to Scan...</option>`;

  voters.forEach(v => {
    const opt = document.createElement("option");
    opt.value = v.voterId;
    opt.textContent = `Slot #${v.fingerprintSlot} — ${v.name} (${v.voterId})${v.hasVoted ? ' [VOTED]' : ' [READY]'}`;
    select.appendChild(opt);
  });

  if (currentVal) select.value = currentVal;
}

/**
 * Renders audit logs into real-time stream
 */
function renderBiometricAuditLogs(logs) {
  const container = document.getElementById("biometric-audit-stream");
  if (!container) return;

  if (logs.length === 0) {
    container.innerHTML = `
      <div style="padding: 16px; text-align: center; color: var(--mono-muted); font-size: 0.75rem;">
        Zero biometric audit events logged yet.
      </div>
    `;
    return;
  }

  container.innerHTML = "";

  logs.forEach(log => {
    const row = document.createElement("div");
    row.className = "audit-stream-row";

    const time = new Date(log.timestamp || log.createdAt).toLocaleTimeString();
    const actionClass = log.action || "INFO";

    row.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px;">
        <span class="audit-stream-badge ${actionClass}">${actionClass}</span>
        <span style="color: var(--mono-platinum); font-weight: 600;">
          ${escapeHtml(log.voterName || log.voterId || "System")}
        </span>
        <span style="color: var(--mono-silver); font-size: 0.72rem;">
          ${escapeHtml(log.details || "")}
        </span>
      </div>
      <span style="color: var(--mono-muted); font-family: var(--font-mono); font-size: 0.68rem;">
        ${time}
      </span>
    `;

    container.appendChild(row);
  });
}

/**
 * Filter directory buttons handler
 */
function filterVotersList(filter, btn) {
  appState.biometricFilter = filter;
  const parent = btn.parentElement;
  if (parent) {
    parent.querySelectorAll(".btn-preset-pill").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
  }
  renderBiometricVoters(appState.biometricVoters);
}

/**
 * Live search filter handler
 */
function handleVoterSearch(val) {
  appState.biometricSearch = (val || "").trim();
  renderBiometricVoters(appState.biometricVoters);
}

/**
 * Generates an authentic 512B AS608 template preview for enrollment form
 */
async function generateSimTemplatePreview() {
  const name = document.getElementById("bio-enroll-name")?.value || "Demo Citizen";
  const slot = document.getElementById("bio-enroll-slot")?.value || 1;

  try {
    const res = await fetch(`${API_BASE}/api/fingerprints/generate-template`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slot, name })
    });
    const data = await res.json();
    if (data.success) {
      lastSimulatedTemplate = data.fullTemplate;
      const previewEl = document.getElementById("minutiae-preview-text");
      const hashEl = document.getElementById("minutiae-hash-text");
      if (previewEl) previewEl.textContent = data.fullTemplate;
      if (hashEl) hashEl.textContent = `SHA-256 Hash: ${data.templateHash}`;
      showToast("512-Byte R307 AS608 Minutiae Template Generated!", "success");
    }
  } catch (err) {
    showToast("Failed to generate minutiae template", "error");
  }
}

/**
 * Handles enrollment form submission to MongoDB
 */
async function handleEnrollSubmit() {
  const name = document.getElementById("bio-enroll-name")?.value?.trim();
  const slotVal = document.getElementById("bio-enroll-slot")?.value?.trim();
  const uidVal = document.getElementById("bio-enroll-voterid")?.value?.trim();
  const nidVal = document.getElementById("bio-enroll-nid")?.value?.trim();
  const regionVal = document.getElementById("bio-enroll-region")?.value || "Konkan";
  const districtVal = document.getElementById("bio-enroll-district")?.value || "Mumbai";
  const fingerVal = document.getElementById("bio-enroll-finger")?.value;
  const genderVal = document.getElementById("bio-enroll-gender")?.value;
  const ageVal = document.getElementById("bio-enroll-age")?.value;
  const constVal = document.getElementById("bio-enroll-constituency")?.value;
  const submitBtn = document.getElementById("btn-submit-enroll");

  if (!name) {
    showToast("Citizen full name is required", "error");
    return;
  }

  if (submitBtn) submitBtn.disabled = true;

  try {
    const payload = {
      name,
      fingerprintSlot: slotVal ? Number(slotVal) : undefined,
      voterId: uidVal || undefined,
      nationalId: nidVal,
      region: regionVal,
      district: districtVal,
      fingerIndex: fingerVal,
      gender: genderVal,
      age: Number(ageVal) || 28,
      constituency: constVal || `${regionVal} - ${districtVal}`,
      fingerprintTemplate: lastSimulatedTemplate || undefined
    };

    const res = await fetch(`${API_BASE}/api/fingerprints/enroll`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (res.status === 201 && data.success) {
      showToast(`✅ ${data.message}`, "success");
      document.getElementById("form-enroll-citizen")?.reset();
      lastSimulatedTemplate = "";
      const previewEl = document.getElementById("minutiae-preview-text");
      const hashEl = document.getElementById("minutiae-hash-text");
      if (previewEl) previewEl.textContent = "EF01FFFFFFFF01020005C89F3A41B67D... (Click 'Simulate Extraction' to preview AS608 character file)";
      if (hashEl) hashEl.textContent = "SHA-256: Uncalculated";

      await loadBiometricsData(false);
    } else {
      showToast(data.error || "Failed to enroll citizen", "error");
    }
  } catch (err) {
    showToast(`Network fault enrolling citizen: ${err.message}`, "error");
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

/**
 * Optical sensor hardware test simulation
 */
async function executeBiometricScanTest() {
  const select = document.getElementById("verify-select-voter");
  const voterId = select ? select.value : "";
  const scanBtn = document.getElementById("btn-scan-test");
  const scannerDisplay = document.getElementById("optical-scanner-display");
  const scannerLabel = document.getElementById("scanner-state-label");
  const resultDiv = document.getElementById("verify-scan-result");

  if (!voterId) {
    showToast("Please choose an enrolled voter to scan", "error");
    return;
  }

  if (scanBtn) scanBtn.disabled = true;
  if (scannerDisplay) scannerDisplay.classList.add("scanning");
  if (scannerLabel) scannerLabel.textContent = "ACQUIRING RIDGES // DSP 1:N SEARCH...";
  if (resultDiv) resultDiv.style.display = "none";

  try {
    const res = await fetch(`${API_BASE}/api/fingerprints/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voterId })
    });

    const data = await res.json();

    setTimeout(() => {
      if (scannerDisplay) scannerDisplay.classList.remove("scanning");
      if (scannerLabel) scannerLabel.textContent = "PRISM READY // PLACE FINGER";
      if (scanBtn) scanBtn.disabled = false;

      if (!resultDiv) return;
      resultDiv.style.display = "block";

      if (data.success && data.matched) {
        const v = data.voter;
        if (v.hasVoted) {
          resultDiv.innerHTML = `
            <div style="padding: 16px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.35); border-radius: var(--radius-sm); margin-top: 14px;">
              <div style="display: flex; align-items: center; gap: 8px; color: #EF4444; font-weight: 700; font-size: 0.88rem; margin-bottom: 6px;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                <span>DOUBLE-VOTING FRAUD DETECTED</span>
              </div>
              <p style="font-size: 0.76rem; color: var(--mono-platinum); margin: 0; line-height: 1.5;">
                Citizen <strong>${escapeHtml(v.name)}</strong> (Slot #${v.fingerprintSlot}) matched with <strong>${v.qualityScore}% confidence</strong>, but has already recorded a ballot in Round #${v.votedRound || 1}.
              </p>
            </div>
          `;
          showToast(`🛑 Fraud Warning: ${v.name} has already cast a vote!`, "error");
        } else {
          resultDiv.innerHTML = `
            <div style="padding: 16px; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.35); border-radius: var(--radius-sm); margin-top: 14px;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                <div style="display: flex; align-items: center; gap: 8px; color: #10B981; font-weight: 700; font-size: 0.88rem;">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                  <span>BIOMETRIC AUTHENTICATION VERIFIED</span>
                </div>
                <button class="btn btn-primary btn-sm" onclick="loadCitizenIntoTerminal('${escapeHtml(v.voterId)}', '${escapeHtml(v.name)}')">
                  Authorize & Vote
                </button>
              </div>
              <p style="font-size: 0.76rem; color: var(--mono-platinum); margin: 0; line-height: 1.5;">
                Citizen <strong>${escapeHtml(v.name)}</strong> (Slot #${v.fingerprintSlot}) authenticated with <strong>${v.qualityScore}% score</strong>. Voter is unvoted & eligible.
              </p>
            </div>
          `;
          showToast(`✅ Biometric Match: ${v.name} is authenticated & eligible to vote!`, "success");
        }
      } else {
        resultDiv.innerHTML = `
          <div style="padding: 14px; background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.35); border-radius: var(--radius-sm); margin-top: 14px; color: #F59E0B; font-size: 0.8rem;">
            ⚠️ Biometric scan failed: Minutiae points did not match sensor database.
          </div>
        `;
        showToast("Biometric verification: No match found", "warn");
      }

      loadBiometricsData(false);
    }, 700);

  } catch (err) {
    if (scannerDisplay) scannerDisplay.classList.remove("scanning");
    if (scannerLabel) scannerLabel.textContent = "PRISM READY // PLACE FINGER";
    if (scanBtn) scanBtn.disabled = false;
    showToast("Sensor communication error", "error");
  }
}

/**
 * Triggers test scan for a specific voter card
 */
function testScanSpecificVoter(voterId) {
  const select = document.getElementById("verify-select-voter");
  if (select) {
    select.value = voterId;
    executeBiometricScanTest();
  }
}

/**
 * Deletes a citizen biometric profile from MongoDB
 */
async function deleteBiometricVoter(voterId, name) {
  if (!confirm(`Are you sure you want to remove ${name} (${voterId}) from MongoDB?`)) {
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/fingerprints/${encodeURIComponent(voterId)}`, {
      method: "DELETE"
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Voter ${name} de-registered from MongoDB`, "success");
      await loadBiometricsData(false);
    } else {
      showToast(data.error || "Failed to remove voter", "error");
    }
  } catch (err) {
    showToast("Network fault removing voter", "error");
  }
}

/**
 * Re-seeds default voters into MongoDB
 */
async function seedDefaultMongoVoters() {
  try {
    const res = await fetch(`${API_BASE}/api/fingerprints/seed`, {
      method: "POST"
    });
    const data = await res.json();
    if (data.success) {
      showToast("Default citizen biometric records seeded into MongoDB", "success");
      await loadBiometricsData(false);
    } else {
      showToast(data.error || "Failed to seed default voters", "error");
    }
  } catch (err) {
    showToast("Network error seeding MongoDB", "error");
  }
}

/**
 * Loads citizen into Enclave Terminal to vote immediately with Regional Franchise Binding
 */
function loadCitizenIntoTerminal(voterId, name, region = "Konkan", district = "Mumbai") {
  // Switch to simulator tab
  const simTabBtn = document.querySelector('.nav-item[data-tab="tab-simulator"]');
  if (simTabBtn) simTabBtn.click();

  const voterInput = document.getElementById("sim-voter-id");
  if (voterInput) {
    voterInput.value = voterId;
  }

  if (region) {
    const regSelect = document.getElementById("sim-region-select");
    if (regSelect) {
      regSelect.value = region;
      updateSimRegion(region);
    }
  }
  if (district) {
    const distSelect = document.getElementById("sim-district-select");
    if (distSelect) distSelect.value = district;
  }

  logToSimConsole(`\n📥 Loaded Citizen Biometric Profile from MongoDB: "${name}" (${voterId}) [Constituency: ${region} - ${district}]`, "success");
  logToSimConsole(`🌐 Anywhere Remote Voting: Terminal dynamically adapts to voter's registered home region [${region}].`, "info");
  showToast(`Loaded ${name} (${region}) into Booth #01 Terminal`, "success");
}

