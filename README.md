# 🗳️ Biometric Web3 Blockchain Voting System

A production-ready, tamper-proof biometric voting system bridging **ESP32 Edge IoT hardware** (R307 optical fingerprint sensor, tactile push-buttons, 16x2 LCD) to the **Ethereum Sepolia Blockchain** via an optimized **Node.js Web3 Bridge** and modern glassmorphic monitoring dashboard.

---

## 🌟 Key Architecture & Highlights

```
+-----------------------------------------------------------------------------------------+
|                                    1. EDGE HARDWARE LAYER                               |
|   [R307 Fingerprint Sensor]  +  [Push Buttons]  -->  [ESP32 MCU]  -->  [16x2 LCD Display] |
+-------------------------------------------+---------------------------------------------+
                                            | HTTP POST (voterID, party)
                                            v
+-----------------------------------------------------------------------------------------+
|                               2. NODE.JS WEB3 MIDDLEWARE                                |
|   * Multi-format Ingestion: Accepts raw voterID, pre-hashed voterHash, or sensor packets|
|   * SHA-256 Anonymization: voterHash = sha256(voterID + salt)                           |
|   * Pre-Flight Gas Guard: Verifies contract.hasVoted() before broadcasting transaction  |
|   * Transaction Queue: Serializes EVM transactions to prevent nonce collisions           |
|   * Resilient Fallback: Auto-switches to backup RPCs and hybrid high-fidelity simulation |
+-------------------------------------------+---------------------------------------------+
                                            | Signed EVM Transaction (castVote)
                                            v
+-----------------------------------------------------------------------------------------+
|                             3. ETHEREUM BLOCKCHAIN (SEPOLIA)                            |
|   * VotingRegistry.sol: Enforces single-vote validation per anonymized hash             |
|   * Immutably increments political party / candidate tallies                            |
|   * Emits VoteSecured(voterHash, party, timestamp) events for public auditing           |
+-----------------------------------------------------------------------------------------+
```

---

## 📟 ESP32 Edge Device Setup & Wiring Guide

The ESP32 firmware is located in [`esp32/hardware.ino`](esp32/hardware.ino).

### Pin Mapping Table

| Component | Pin on Component | ESP32 GPIO Pin | Details |
|---|---|---|---|
| **R307 Fingerprint Sensor** | Red (VCC) | 5V / VIN | Power |
| | Black (GND) | GND | Ground |
| | Green (TX) | **GPIO 16** (RX2) | Hardware Serial 2 Receive |
| | White (RX) | **GPIO 17** (TX2) | Hardware Serial 2 Transmit |
| **16x2 I2C LCD Display** | VCC | 5V / VIN | Display Power |
| | GND | GND | Ground |
| | SDA | **GPIO 21** | I2C Data |
| | SCL | **GPIO 22** | I2C Clock |
| **Party A Button** | Terminal 1 | **GPIO 13** | Configured as `INPUT` (BJP) |
| | Terminal 2 | GND | Connect to Ground |
| **Party B Button** | Terminal 1 | **GPIO 14** | Configured as `INPUT` (UBT) |
| | Terminal 2 | GND | Connect to Ground |
| **Party C Button** | Terminal 1 | **GPIO 25** | Configured as `INPUT` (Congress) |
| | Terminal 2 | GND | Connect to Ground |
| **Party D Button** | Terminal 1 | **GPIO 26** | Configured as `INPUT` (AIMIM) |
| | Terminal 2 | GND | Connect to Ground |
| **Results Button** | Terminal 1 | **GPIO 27** | Configured as `INPUT_PULLUP` (Inspect Results) |
| | Terminal 2 | GND | Connect to Ground |
| **Enroll Voter Button** | Terminal 1 | **GPIO 32** | Configured as `INPUT_PULLUP` (Register New Citizen) |
| | Terminal 2 | GND | Connect to Ground |
| **Active Buzzer** | Positive (+) | **GPIO 33** | Audio Feedback |
| | Negative (-) | GND | Ground |

### Configuring the ESP32 Code
Open [`esp32/hardware/hardware.ino`](esp32/hardware/hardware.ino) in the Arduino IDE and configure Section 2:
```cpp
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// Update ONLY this IP to your computer's local Wi-Fi IPv4 address (from 'ipconfig'):
const char* SERVER_IP     = "10.62.75.167";
const int   SERVER_PORT   = 3000;
```

### Arduino IDE Libraries Required:
- `Adafruit Fingerprint Sensor Library` (by Adafruit)
- `LiquidCrystal I2C` (by Frank de Brabander or Marco Schwartz)
- `WiFi` & `HTTPClient` (Built into ESP32 Arduino Core)

---

## 🚀 Server Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
# In Windows PowerShell:
Copy-Item .env.example .env
```
Key configuration parameters in `.env`:
- `PORT`: HTTP server port (default: `3000`)
- `RPC_URL`: Primary Sepolia RPC endpoint
- `FALLBACK_RPC_URL`: Backup RPC endpoint
- `PRIVATE_KEY` or `MNEMONIC`: Relayer wallet credentials
- `CONTRACT_ADDRESS`: Deployed `VotingRegistry` smart contract address
- `VOTER_HASH_SALT`: Cryptographic salt for SHA-256 hashing

### 3. Compile Smart Contract
```bash
npm run compile
```

### 4. Deploy to Sepolia (Optional)
```bash
npm run deploy
```

### 5. Start the Server & Web Dashboard
```bash
npm start
# Or for live hot-reload development:
npm run dev
```

Visit the interactive dashboard in your browser:  
👉 **http://localhost:3000**

---

## 📡 REST API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/blockchain/vote` | Cast verified vote. Accepts `{ voterID, party }` or `{ voterHash, party }`. |
| `GET` | `/api/blockchain/votes` | Query tallies for all active political parties. |
| `GET` | `/api/blockchain/votes/:party` | Query total votes for a specific party. |
| `GET` | `/api/blockchain/hasVoted/:voterHash` | Query if an anonymized hash has already cast a vote. |
| `POST` | `/api/blockchain/hash` | Preview SHA-256 anonymized hash for a given voter ID. |
| `GET` | `/api/blockchain/recent` | Fetch recent confirmed on-chain audit ledger. |
| `GET` | `/api/health` | Network health, latency, block height, relayer balance, contract state. |
| `POST` | `/webhook-test/voters` | Mock webhook endpoint for direct ESP32 hardware testing. |

---

## 🗂️ Clean Project Structure

```
projectserver/
├── contract/
│   └── VotingRegistry.sol       # Optimized Solidity 0.8.24 Smart Contract
├── esp32/
│   └── hardware.ino             # Production ESP32 Web3 Terminal Firmware
├── scripts/
│   └── deploy.js                # ESM Sepolia Deployment Script
├── public/                      # Web Dashboard & Architecture Visualizer
│   ├── index.html               # Multi-tab Dashboard UI
│   ├── css/style.css            # Dark Glassmorphism Design System
│   └── js/app.js                # Live Telemetry & Simulation Engine
├── legacy/                      # Archived redundant prototype server scripts
│   ├── server_LATEST.js
│   ├── server_auto.js
│   ├── server_local.js
│   └── server_old.js
├── .env                         # Local environment configuration (git ignored)
├── .env.example                 # Documented template for environment config
├── .gitignore                   # Ignores secrets, node_modules, and artifacts
├── hardhat.config.js            # Hardhat 3 ESM configuration with optimizer
├── package.json                 # Project scripts and dependencies
├── server.js                    # Production-grade Express & Web3 Bridge Server
└── README.md                    # Project documentation & wiring guide
```

---

## 🛡️ Security Features
1. **Raw Biometrics Never Leave Edge/Middleware**: Fingerprint minutiae is anonymized using SHA-256 + secret salt before touching the blockchain.
2. **Double-Voting Prevention**: Smart contract strictly checks `require(!hasVoted[voterHash])`.
3. **Pre-Flight Gas Guard**: The Node.js bridge performs zero-cost static view calls to verify eligibility before spending gas on a state-changing transaction.
4. **Nonce Collision Protection**: In-memory async queue serializes simultaneous voting transactions from multiple physical voting booths.
5. **Secret Sanitization**: Private keys and seed phrases are purged from source code and kept strictly in `.env`.
#   B l o c k c h a i n - B a s e d - V o t i n g - S y s t e m  
 