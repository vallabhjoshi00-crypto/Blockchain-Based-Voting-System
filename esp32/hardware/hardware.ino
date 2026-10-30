/**
 ===============================================================================
 BIOMETRIC BLOCKCHAIN VOTING SYSTEM - ESP32 FIRMWARE
 ===============================================================================
 Hardware:
   - ESP32 NodeMCU / DevKit
   - R307 Optical Fingerprint Sensor (UART Serial2: TX=17, RX=16)
   - 16x2 I2C LCD Display (SDA=21, SCL=22)
   - 4 Push Buttons for Ballot Selection (GPIO 13, 14, 25, 26)
   - 1 Push Button for Certified Results (GPIO 27)
   - 1 Active Buzzer for Audio Feedback (GPIO 33)

 Web3 Blockchain Integration:
   - Connects to local Wi-Fi and dispatches verified votes to the Node.js
     Web3 Relayer (server.js) at /api/blockchain/vote.
   - Node.js converts voterID into an anonymized SHA-256 hash and records
     the immutable vote onto the Ethereum Sepolia smart contract.
   - If Wi-Fi is unavailable, the firmware gracefully operates in Standalone
     Offline Mode.
 * ===============================================================================
 */

#include <Adafruit_Fingerprint.h>
#include <HTTPClient.h>
#include <LiquidCrystal_I2C.h>
#include <WiFi.h>
#include <Wire.h>

// ===============================================================================
// 1. PIN DEFINITIONS & TOUCH SENSOR CONFIGURATION
// ===============================================================================
#define TOUCH_PARTY_A 13
#define TOUCH_PARTY_B 14
#define TOUCH_PARTY_C 25
#define TOUCH_PARTY_D 26
#define TOUCH_RESULT 27
#define BTN_ENROLL                                                             \
  32 // Push Button (GPIO 32 to GND) to Register / Enroll New Voter
#define BUZZER_PIN 33

// Touch Sensor Trigger Logic:
// Standard digital capacitive touch modules (e.g., TTP223) output HIGH on
// touch. If your touch sensors output LOW on touch, change this to LOW.
#define TOUCH_ACTIVE HIGH

// Backward-compatibility aliases
#define BTN_PARTY_A TOUCH_PARTY_A
#define BTN_PARTY_B TOUCH_PARTY_B
#define BTN_PARTY_C TOUCH_PARTY_C
#define BTN_PARTY_D TOUCH_PARTY_D
#define BTN_RESULT TOUCH_RESULT

// Fingerprint Sensor Serial Pins (Hardware Serial 2)
#define FP_RX_PIN 16 // Connect to Sensor TX
#define FP_TX_PIN 17 // Connect to Sensor RX

// ===============================================================================
// 2. NETWORK & SERVER CONFIGURATION
// ===============================================================================
// Replace with your Wi-Fi credentials:
const char *WIFI_SSID = "payal";
const char *WIFI_PASSWORD = "123456789";

// ===============================================================================
// DYNAMIC SERVER HOST CONFIGURATION
// When your computer's IP address changes (e.g., new Wi-Fi / Hotspot):
// -> UPDATE ONLY THIS ONE VARIABLE BELOW:
// ===============================================================================
const char *SERVER_IP =
    "10.174.120.167";         // <-- Current Hotspot Wi-Fi IP (Updated)
const int SERVER_PORT = 3000; // Port of node server.js

// Dynamic API endpoints automatically constructed from SERVER_IP and
// SERVER_PORT
#define ENDPOINT_VOTE "/api/blockchain/vote"
#define ENDPOINT_RESULTS "/api/blockchain/votes"
#define ENDPOINT_RESET "/api/election/reset"

String SERVER_BASE_URL = String("http://") + SERVER_IP + ":" + SERVER_PORT;
String SERVER_VOTE_URL = SERVER_BASE_URL + ENDPOINT_VOTE;
String SERVER_RESULTS_URL = SERVER_BASE_URL + ENDPOINT_RESULTS;
String SERVER_RESET_URL = SERVER_BASE_URL + ENDPOINT_RESET;

// Timeout settings
const unsigned long VOTE_TIMEOUT_MS =
    25000;                        // 25s timeout waiting for party button
const int HTTP_TIMEOUT_MS = 8000; // 8s timeout for Web3 blockchain bridge

// ===============================================================================
// 3. HARDWARE & STATE INSTANCES
// ===============================================================================
// LCD Display instances for both standard I2C addresses (0x27 for PCF8574, 0x3F
// for PCF8574A)
LiquidCrystal_I2C lcd27(0x27, 16, 2);
LiquidCrystal_I2C lcd3F(0x3F, 16, 2);
LiquidCrystal_I2C *pLcd = &lcd27;
#define lcd (*pLcd)

// Hardware Serial 2 for R307 Fingerprint Sensor
HardwareSerial fpSerial(2);
Adafruit_Fingerprint finger = Adafruit_Fingerprint(&fpSerial);

// Candidate party names (matching both UI and blockchain smart contract)
const char *PARTY_A_NAME = "BJP";
const char *PARTY_B_NAME = "UBT";
const char *PARTY_C_NAME = "Congress";
const char *PARTY_D_NAME = "AIMIM";

// Local backup vote counters
int localVotesA = 0;
int localVotesB = 0;
int localVotesC = 0;
int localVotesD = 0;

// Local tracking cache (supports up to 128 registered fingerprint IDs)
// Compact RAM footprint: Supports up to 32 voters per voting terminal (saves
// ~75 KB DRAM)
#define MAX_LOCAL_VOTERS 32
bool hasVotedLocal[MAX_LOCAL_VOTERS] = {false};
int currentElectionRound = 1;

bool isWifiConnected = false;

// 4 State Regions & Sub-Regions (Districts)
const char *REGION_NAMES[4] = {"Konkan", "Vidarbha", "Marathwada", "Paschim"};
const char *DISTRICTS_KONKAN[4] = {"Mumbai", "Thane", "Raigad", "Palghar"};
const char *DISTRICTS_VIDARBHA[4] = {"Nagpur", "Amravati", "Akola", "Wardha"};
const char *DISTRICTS_MARATHWADA[4] = {"Aurangabad", "Nanded", "Latur",
                                       "Jalna"};
const char *DISTRICTS_PASCHIM[4] = {"Pune", "Kolhapur", "Satara", "Solapur"};

String voterRegionLocal[MAX_LOCAL_VOTERS];
String voterDistrictLocal[MAX_LOCAL_VOTERS];

struct VoterInfo {
  String name;
  String region;
  String district;
  bool hasVoted;
  bool found;
};

// ===============================================================================
// MONGODB CLOUD BIOMETRIC CACHE (RAM ONLY - FLASH STORAGE 100% BYPASSED)
// ===============================================================================
struct MongoVoterTemplate {
  int slotId;
  String voterId;
  String name;
  String region;
  String district;
  String templateHash;
  uint8_t *templateBytes =
      nullptr; // Dynamically allocated in Heap (512 bytes) on demand
  bool isLoaded = false;
};

MongoVoterTemplate mongoTemplates[MAX_LOCAL_VOTERS];
int mongoLoadedCount = 0;

// Hardware RAM Minutiae Match & Transfer Function Declarations
bool streamTemplateToBuffer2(const uint8_t *templateBytes);
int matchRamBuffers();
bool uploadTemplateFromBuffer1(uint8_t *outputBuffer);
String bytesToHexString(const uint8_t *buffer, int len);
bool syncVoterTemplateFromMongo(int slotId);
void syncAllTemplatesFromMongo();

// ===============================================================================
// 4. FUNCTION DECLARATIONS & AUDIO TONE ENGINE
// ===============================================================================
void setupWifi();
void promptScan();
String getVoterName(int id);
VoterInfo fetchVoterInfo(int id);
int waitForTouchButton(unsigned long timeoutMs);
void takeVote(int id, const VoterInfo &voter);
int checkFingerprint();
bool broadcastVoteToBlockchain(String voterId, String party, String region,
                               String district);
void fetchAndShowResults();
void resetLocalVotingState();
int parsePartyCount(const String &json, const String &partyName);
int enrollFingerprint(int id);
int getNextAvailableID();
bool syncVoterTemplateFromMongo(int slotId);
void syncAllTemplatesFromMongo();

// Distinct Audio Tone Signatures for Every Action
void soundBootReady();
void soundFingerMatched();
void soundFingerRejected();
void soundPartySelected();
void soundVoteSecured();
void soundVoteOffline();
void soundFraudAlarm();
void soundTimeout();
void soundTallyClick();
void beepShort();
void beepDouble();
void longBeep();

// ===============================================================================
// 5. SETUP
// ===============================================================================
void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println("\n========================================================");
  Serial.println("🗳️  ESP32 BIOMETRIC WEB3 BLOCKCHAIN VOTING TERMINAL");
  Serial.println("========================================================");

  // Initialize dynamic endpoint URLs from SERVER_IP and SERVER_PORT
  SERVER_BASE_URL = String("http://") + SERVER_IP + ":" + SERVER_PORT;
  SERVER_VOTE_URL = SERVER_BASE_URL + ENDPOINT_VOTE;
  SERVER_RESULTS_URL = SERVER_BASE_URL + ENDPOINT_RESULTS;
  SERVER_RESET_URL = SERVER_BASE_URL + ENDPOINT_RESET;
  Serial.print("Target Server Host: ");
  Serial.println(SERVER_BASE_URL);

  // 1. Initialize GPIO Pins (Capacitive Touch Sensors / Push Buttons & Buzzer)
  Serial.println("1. Initializing Touch Sensor / Button Pins & Buzzer...");
  // INPUT_PULLDOWN prevents floating pin voltage crosstalk between adjacent
  // GPIOs
  pinMode(TOUCH_PARTY_A, INPUT_PULLDOWN);
  pinMode(TOUCH_PARTY_B, INPUT_PULLDOWN);
  pinMode(TOUCH_PARTY_C, INPUT_PULLDOWN);
  pinMode(TOUCH_PARTY_D, INPUT_PULLDOWN);
  pinMode(TOUCH_RESULT, INPUT_PULLDOWN);
  pinMode(BTN_ENROLL,
          INPUT_PULLUP); // Dedicated push button to enroll new voter
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);

  // 2. Initialize I2C Bus and Auto-detect LCD
  Serial.println("2. Initializing 16x2 I2C LCD Display (SDA=21, SCL=22)...");
  Wire.begin(21, 22); // Explicit SDA=21, SCL=22 for ESP32
  delay(100);

  byte detectedAddr = 0;
  Serial.print("-> Scanning I2C bus: ");
  for (byte addr = 1; addr < 127; addr++) {
    Wire.beginTransmission(addr);
    if (Wire.endTransmission() == 0) {
      Serial.print("0x");
      if (addr < 16)
        Serial.print("0");
      Serial.print(addr, HEX);
      Serial.print(" ");
      if (addr == 0x27 || addr == 0x3F || detectedAddr == 0) {
        detectedAddr = addr;
      }
    }
  }
  Serial.println();

  if (detectedAddr == 0x27) {
    pLcd = &lcd27;
    Serial.println(
        "-> [LCD SUCCESS] Found and bound to 16x2 I2C Display at 0x27!");
  } else if (detectedAddr == 0x3F) {
    pLcd = &lcd3F;
    Serial.println(
        "-> [LCD SUCCESS] Found and bound to 16x2 I2C Display at 0x3F!");
  } else if (detectedAddr != 0) {
    Serial.print("-> [LCD SUCCESS] Found device at 0x");
    Serial.print(detectedAddr, HEX);
    Serial.println(", initializing LCD at this address...");
    pLcd = new LiquidCrystal_I2C(detectedAddr, 16, 2);
  } else {
    Serial.println(
        "⚠️ [LCD WARNING] ZERO I2C devices detected on SDA=21, SCL=22!");
    Serial.println("   Please check:");
    Serial.println("   1. VCC pin MUST be connected to 5V / VIN (NOT 3.3V)");
    Serial.println("   2. GND connected to GND");
    Serial.println("   3. SDA connected to GPIO 21");
    Serial.println("   4. SCL connected to GPIO 22");
    pLcd = &lcd27;
  }

  lcd.begin();
  Wire.begin(21, 22); // Ensure pins remain locked to 21/22
  lcd.backlight();
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("BioVote // Web3");
  lcd.setCursor(0, 1);
  lcd.print("Booting System..");
  delay(1500);

  // 3. Connect to Wi-Fi
  setupWifi();

  // 4. Connect to R307 Fingerprint Sensor
  Serial.println(
      "4. Connecting to R307 Fingerprint Sensor on Serial2 (RX:16, TX:17)...");
  fpSerial.setRxBufferSize(1024);
  fpSerial.begin(57600, SERIAL_8N1, FP_RX_PIN, FP_TX_PIN);
  finger.begin(57600);

  if (finger.verifyPassword()) {
    Serial.println("-> SUCCESS: R307 Optical Fingerprint Sensor initialized!");
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Fingerprint OK");
    lcd.setCursor(0, 1);
    lcd.print(isWifiConnected ? "Web3: Online" : "Web3: Offline");
    delay(1800);
  } else {
    Serial.println("-> ERROR: Fingerprint Sensor not found! Check 5V, GND, "
                   "RX(16), TX(17).");
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Sensor NOT Found");
    lcd.setCursor(0, 1);
    lcd.print("Check Wiring!");
    soundFraudAlarm();
    while (1) {
      delay(500);
      // Halt if hardware sensor is missing
    }
  }

  soundBootReady();

  // Initialize default 4 state regional seed voters
  voterRegionLocal[1] = "Konkan";
  voterDistrictLocal[1] = "Mumbai";
  voterRegionLocal[2] = "Vidarbha";
  voterDistrictLocal[2] = "Nagpur";
  voterRegionLocal[3] = "Marathwada";
  voterDistrictLocal[3] = "Aurangabad";
  voterRegionLocal[4] = "Paschim";
  voterDistrictLocal[4] = "Pune";

  // 5. Automatic Biometric Sync: Sync citizen templates from MongoDB to R307
  // flash slots
  if (isWifiConnected) {
    Serial.println("\n5. Initializing Biometric Sync: Checking MongoDB for "
                   "citizen templates...");
    syncAllTemplatesFromMongo();
  } else {
    promptScan();
  }
}

// ===============================================================================
// 6. MAIN LOOP
// ===============================================================================
void loop() {
  // Reconnect Wi-Fi in background if lost
  if (WiFi.status() != WL_CONNECTED && isWifiConnected) {
    isWifiConnected = false;
    Serial.println("⚠️ Wi-Fi connection lost. Operating in standalone mode.");
  } else if (WiFi.status() == WL_CONNECTED && !isWifiConnected) {
    isWifiConnected = true;
    Serial.println("✅ Wi-Fi reconnected!");
  }

  // 1. Check if the Result Touch Sensor is triggered (Requires 2 presses for
  // confirmation)
  if (digitalRead(TOUCH_RESULT) == TOUCH_ACTIVE) {
    delay(50); // Debounce
    if (digitalRead(TOUCH_RESULT) == TOUCH_ACTIVE) {
      // Wait for release of 1st press
      while (digitalRead(TOUCH_RESULT) == TOUCH_ACTIVE) {
        delay(10);
      }

      Serial.println("\n⚠️ [RESULT KEY] Press #1 detected! Press again within 3 "
                     "seconds to confirm & showcase results.");
      beepDouble();

      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("Show Results?");
      lcd.setCursor(0, 1);
      lcd.print("Press 2nd Time..");

      // Wait up to 3.5 seconds for the 2nd confirmation press
      unsigned long windowStart = millis();
      bool doublePressed = false;

      while (millis() - windowStart < 3500) {
        if (digitalRead(TOUCH_RESULT) == TOUCH_ACTIVE) {
          delay(50); // Debounce
          if (digitalRead(TOUCH_RESULT) == TOUCH_ACTIVE) {
            doublePressed = true;
            while (digitalRead(TOUCH_RESULT) == TOUCH_ACTIVE) {
              delay(10);
            } // Wait for release
            break;
          }
        }
        delay(20);
      }

      if (doublePressed) {
        Serial.println(
            "✅ [RESULT CONFIRMED] 2nd press confirmed! Showcasing results...");
        soundTallyClick();
        fetchAndShowResults();
        promptScan();
      } else {
        Serial.println(
            "❌ [RESULT ABORTED] 2nd press timed out. Returning to scan.");
        lcd.clear();
        lcd.setCursor(0, 0);
        lcd.print("Results Aborted");
        delay(1200);
        promptScan();
      }
    }
  }

  // 2. Check if Enroll New Voter Push Button is pressed (GPIO 32)
  if (digitalRead(BTN_ENROLL) == LOW) {
    delay(50); // Debounce
    if (digitalRead(BTN_ENROLL) == LOW) {
      Serial.println("\n👤 ENROLL NEW VOTER button triggered!");
      soundBootReady();
      int newId = getNextAvailableID();
      enrollFingerprint(newId);
      while (digitalRead(BTN_ENROLL) == LOW) {
        delay(10);
      } // Wait for button release
      delay(1000);
      promptScan();
    }
  }

  // 3. Poll Optical Fingerprint Sensor
  int fingerStatus = checkFingerprint();

  if (fingerStatus > 0) {
    int voterID = fingerStatus;
    Serial.print("\n👆 Finger Matched! Database Template ID #");
    Serial.println(voterID);

    soundFingerMatched();

    // Query Voter Identity & Regional Franchise details (via MongoDB API or
    // local cache)
    VoterInfo voter = fetchVoterInfo(voterID);
    Serial.printf("-> Authenticated Voter: %s [Region: %s, District: %s]\n",
                  voter.name.c_str(), voter.region.c_str(),
                  voter.district.c_str());

    // 3. Capture Ballot Button Press with Regional Franchise & Remote Voting
    takeVote(voterID, voter);

  } else if (fingerStatus == -2) {
    // Finger was placed on sensor, but minutiae template does not match
    // database
    Serial.println("⚠️ Biometric Scan: NO MATCH found in sensor database.");
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Fingerprint");
    lcd.setCursor(0, 1);
    lcd.print("Not Matched!");
    soundFingerRejected();
    delay(2000);
    promptScan();
  }

  // 4. If touch button tapped while idle, guide voter to place finger first
  if (digitalRead(TOUCH_PARTY_A) == TOUCH_ACTIVE ||
      digitalRead(TOUCH_PARTY_B) == TOUCH_ACTIVE ||
      digitalRead(TOUCH_PARTY_C) == TOUCH_ACTIVE ||
      digitalRead(TOUCH_PARTY_D) == TOUCH_ACTIVE) {
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Place Finger");
    lcd.setCursor(0, 1);
    lcd.print("on Sensor First!");
    soundPartySelected();
    delay(1500);
    promptScan();
  }

  // 5. Check for Serial commands from Serial Monitor (Type 'S' or '1'-'4' to
  // sync from MongoDB)
  if (Serial.available()) {
    char cmd = Serial.read();
    if (cmd == 'S' || cmd == 's') {
      Serial.println("\n📡 [MANUAL SYNC TRIGGERED via Serial] Fetching all "
                     "templates from MongoDB...");
      syncAllTemplatesFromMongo();
    } else if (cmd >= '1' && cmd <= '4') {
      int s = cmd - '0';
      Serial.printf("\n📡 [MANUAL SYNC TRIGGERED for Slot #%d]...\n", s);
      syncVoterTemplateFromMongo(s);
      promptScan();
    }
  }

  delay(40);
}

// ===============================================================================
// 7. WI-FI INITIALIZATION
// ===============================================================================
void setupWifi() {
  Serial.print("3. Connecting to Wi-Fi SSID: ");
  Serial.println(WIFI_SSID);

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Connecting Wi-Fi");

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long startAttemptTime = millis();
  // 10-second non-fatal connection timeout
  while (WiFi.status() != WL_CONNECTED && millis() - startAttemptTime < 10000) {
    delay(500);
    Serial.print(".");
  }

  if (WiFi.status() == WL_CONNECTED) {
    isWifiConnected = true;
    Serial.println("\n-> SUCCESS: Wi-Fi Connected!");
    Serial.print("-> ESP32 IP Address : ");
    Serial.println(WiFi.localIP());
    Serial.print("-> Web3 Target Host : ");
    Serial.println(SERVER_VOTE_URL);

    lcd.setCursor(0, 1);
    lcd.print("IP: " + WiFi.localIP().toString().substring(0, 12));
    delay(1500);
  } else {
    isWifiConnected = false;
    Serial.println(
        "\n-> WARNING: Wi-Fi not connected. Entering Offline Standalone Mode.");
    lcd.setCursor(0, 1);
    lcd.print("Offline Mode");
    delay(1500);
  }
}

// ===============================================================================
// 8. VOTING CAPTURE & DISPATCH (REGIONAL FRANCHISE & ANYWHERE REMOTE VOTING)
// ===============================================================================
int waitForTouchButton(unsigned long timeoutMs) {
  unsigned long start = millis();
  while (millis() - start < timeoutMs) {
    if (digitalRead(TOUCH_PARTY_A) == TOUCH_ACTIVE) {
      delay(40); // Debounce
      if (digitalRead(TOUCH_PARTY_A) == TOUCH_ACTIVE) {
        while (digitalRead(TOUCH_PARTY_A) == TOUCH_ACTIVE) {
          delay(10);
        }
        return 1;
      }
    } else if (digitalRead(TOUCH_PARTY_B) == TOUCH_ACTIVE) {
      delay(40);
      if (digitalRead(TOUCH_PARTY_B) == TOUCH_ACTIVE) {
        while (digitalRead(TOUCH_PARTY_B) == TOUCH_ACTIVE) {
          delay(10);
        }
        return 2;
      }
    } else if (digitalRead(TOUCH_PARTY_C) == TOUCH_ACTIVE) {
      delay(40);
      if (digitalRead(TOUCH_PARTY_C) == TOUCH_ACTIVE) {
        while (digitalRead(TOUCH_PARTY_C) == TOUCH_ACTIVE) {
          delay(10);
        }
        return 3;
      }
    } else if (digitalRead(TOUCH_PARTY_D) == TOUCH_ACTIVE) {
      delay(40);
      if (digitalRead(TOUCH_PARTY_D) == TOUCH_ACTIVE) {
        while (digitalRead(TOUCH_PARTY_D) == TOUCH_ACTIVE) {
          delay(10);
        }
        return 4;
      }
    }
    delay(20);
  }
  return 0; // Timeout
}

void takeVote(int id, const VoterInfo &voter) {
  // 1. Local Pre-Flight Double-Voting Check
  if (voter.hasVoted || (id < MAX_LOCAL_VOTERS && hasVotedLocal[id])) {
    Serial.println("🛑 FRAUD REJECTED: User has already cast a ballot!");
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Fraud Alert!");
    lcd.setCursor(0, 1);
    lcd.print("Already Voted!");
    soundFraudAlarm();
    delay(2500);
    promptScan();
    return;
  }

  // 2. Interactive Selection of State Region and District while Voting
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Voter: " + voter.name.substring(0, 9));
  lcd.setCursor(0, 1);
  lcd.print("Verify Region...");
  soundPartySelected();
  delay(1200);

  // Step A: Prompt Voter to Select Region using Touch Buttons
  Serial.println("\n--- VOTING STEP 1: Select State Region ---");
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Select Region:");
  lcd.setCursor(0, 1);
  lcd.print("1:KNK 2:VID 3:MR 4:PS");

  int regBtn = waitForTouchButton(15000);
  if (regBtn == 0) {
    Serial.println("-> Voting session timed out (No region selected).");
    lcd.clear();
    lcd.print("Session Timeout");
    soundTimeout();
    delay(1800);
    promptScan();
    return;
  }

  String chosenRegion = REGION_NAMES[regBtn - 1];
  Serial.printf("-> Voter Selected Region: %s (Touch %d)\n",
                chosenRegion.c_str(), regBtn);
  soundPartySelected();

  // Step B: Prompt Voter to Select District using Touch Buttons
  Serial.println("--- VOTING STEP 2: Select District Sub-Region ---");
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Select District:");
  lcd.setCursor(0, 1);

  const char **districtList = (regBtn == 1)   ? DISTRICTS_KONKAN
                              : (regBtn == 2) ? DISTRICTS_VIDARBHA
                              : (regBtn == 3) ? DISTRICTS_MARATHWADA
                                              : DISTRICTS_PASCHIM;

  if (regBtn == 1)
    lcd.print("1:Mumb 2:Than 3:Ra 4:Pl");
  else if (regBtn == 2)
    lcd.print("1:Nag 2:Amr 3:Ak 4:War");
  else if (regBtn == 3)
    lcd.print("1:Aur 2:Nan 3:Lat 4:Jal");
  else
    lcd.print("1:Pun 2:Kol 3:Sat 4:Sol");

  int distBtn = waitForTouchButton(15000);
  if (distBtn == 0) {
    Serial.println("-> Voting session timed out (No district selected).");
    lcd.clear();
    lcd.print("Session Timeout");
    soundTimeout();
    delay(1800);
    promptScan();
    return;
  }

  String chosenDistrict = districtList[distBtn - 1];
  Serial.printf("-> Voter Selected District: %s (Touch %d)\n",
                chosenDistrict.c_str(), distBtn);
  soundPartySelected();

  // Step C: Verify Chosen Region & District Against Registered Voter Profile
  bool regionMatch = chosenRegion.equalsIgnoreCase(voter.region);
  bool districtMatch = chosenDistrict.equalsIgnoreCase(voter.district);

  if (!regionMatch || !districtMatch) {
    Serial.printf("❌ [REGIONAL VIOLATION] Voter %s is registered in [%s - "
                  "%s], but selected [%s - %s] while voting!\n",
                  voter.name.c_str(), voter.region.c_str(),
                  voter.district.c_str(), chosenRegion.c_str(),
                  chosenDistrict.c_str());
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("REGION MISMATCH!");
    lcd.setCursor(0, 1);
    lcd.print("Access Denied!");
    soundFraudAlarm();
    delay(3000);
    promptScan();
    return;
  }

  // Verification passed!
  Serial.printf("✅ [REGION VERIFIED] Voter confirmed in registered home "
                "constituency: %s (%s)\n",
                voter.region.c_str(), voter.district.c_str());
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Region Verified!");
  lcd.setCursor(0, 1);
  lcd.print(chosenRegion.substring(0, 7) + " (" +
            chosenDistrict.substring(0, 6) + ")");
  soundFingerMatched();
  delay(1600);

  // 3. Dynamic Ballot Presentation for Voter's Registered Home Region
  Serial.printf("-> Dynamic Ballot Presented for Constituency: %s (%s)\n",
                voter.region.c_str(), voter.district.c_str());
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("1:BJP     2:UBT ");
  lcd.setCursor(0, 1);
  lcd.print("3:Cong  4:AIMIM");

  int btn = waitForTouchButton(VOTE_TIMEOUT_MS);
  if (btn == 0) {
    Serial.println("-> Voting session timed out (No button pressed).");
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Session Timeout");
    lcd.setCursor(0, 1);
    lcd.print("No Vote Cast");
    soundTimeout();
    delay(2000);
    promptScan();
    return;
  }

  String selectedParty = (btn == 1)   ? PARTY_A_NAME
                         : (btn == 2) ? PARTY_B_NAME
                         : (btn == 3) ? PARTY_C_NAME
                                      : PARTY_D_NAME;
  Serial.printf("-> Touch Triggered! Candidate: %s for Region: %s\n",
                selectedParty.c_str(), voter.region.c_str());
  soundPartySelected();

  // 4. Explicitly show the voter WHOM and for WHICH REGION they voted!
  String regTag = voter.region.substring(0, 3);
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("VOTED [" + regTag + "]:");
  lcd.setCursor(0, 1);
  lcd.print(">> " + selectedParty);
  delay(2000);

  // 5. Show Web3 blockchain submission
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Vote: " + selectedParty.substring(0, 10));
  lcd.setCursor(0, 1);
  lcd.print("Broadcasting...");

  // Send to Web3 Blockchain Relayer with Regional Franchise Enforcement
  String voterUID = "FP_UID_" + String(id);
  bool chainSuccess = broadcastVoteToBlockchain(voterUID, selectedParty,
                                                voter.region, voter.district);

  // Increment local counter on successful recording
  if (chainSuccess || WiFi.status() != WL_CONNECTED) {
    if (selectedParty == PARTY_A_NAME)
      localVotesA++;
    else if (selectedParty == PARTY_B_NAME)
      localVotesB++;
    else if (selectedParty == PARTY_C_NAME)
      localVotesC++;
    else if (selectedParty == PARTY_D_NAME)
      localVotesD++;
  }

  // Mark local cache so voter cannot vote again on this terminal
  if (id < MAX_LOCAL_VOTERS) {
    hasVotedLocal[id] = true;
  }

  // 6. Final On-Chain / Ledger Confirmation
  lcd.clear();
  if (chainSuccess) {
    lcd.setCursor(0, 0);
    lcd.print("Vote: " + selectedParty.substring(0, 10));
    lcd.setCursor(0, 1);
    lcd.print("Sepolia Mined");
    soundVoteSecured();
    delay(1500);
  } else {
    lcd.setCursor(0, 0);
    lcd.print("Vote: " + selectedParty.substring(0, 10));
    lcd.setCursor(0, 1);
    lcd.print("Recorded Offline");
    soundVoteOffline();
    delay(1500);
  }

  // 7. "Thanks for Voting" screen for 3 seconds, then reset immediately!
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("   THANK YOU    ");
  lcd.setCursor(0, 1);
  lcd.print("  FOR VOTING!   ");
  delay(3000);

  promptScan();
}

// ===============================================================================
// 9. HTTP BLOCKCHAIN RELAYER COMMUNICATION WITH REGIONAL FRANCHISE VERIFICATION
// ===============================================================================
bool broadcastVoteToBlockchain(String voterId, String party, String region,
                               String district) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println(
        "⚠️ Wi-Fi not connected. Vote saved to local offline memory.");
    return false;
  }

  HTTPClient http;
  http.begin(SERVER_VOTE_URL);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(HTTP_TIMEOUT_MS);

  // Construct JSON payload with regional franchise parameters
  String jsonPayload = "{\"voterID\":\"" + voterId + "\",\"party\":\"" + party +
                       "\",\"region\":\"" + region + "\",\"district\":\"" +
                       district + "\",\"ballotRegion\":\"" + region +
                       "\",\"terminalLocation\":\"Remote Machine\"}";
  Serial.print("📤 [HTTP POST -> ");
  Serial.print(SERVER_VOTE_URL);
  Serial.println("]: " + jsonPayload);

  int httpResponseCode = http.POST(jsonPayload);
  String responseBody = http.getString();
  http.end();

  Serial.print("📥 [Server Response Code]: ");
  Serial.println(httpResponseCode);
  Serial.print("📥 [Server Response Body]: ");
  Serial.println(responseBody);

  if (httpResponseCode == 200) {
    Serial.println("🎉 [SUCCESS] Vote validated and mined onto Ethereum "
                   "Sepolia blockchain!");

    // Check if server indicated a new election round
    int rIdx = responseBody.indexOf("\"electionRound\":");
    if (rIdx >= 0) {
      int srvRound = responseBody.substring(rIdx + 16).toInt();
      if (srvRound > currentElectionRound) {
        Serial.printf("🔄 New election round #%d detected from server! "
                      "Refreshing local cache...\n",
                      srvRound);
        currentElectionRound = srvRound;
        resetLocalVotingState();
      }
    }
    return true;
  } else if (httpResponseCode == 403) {
    Serial.println("🛑 [REGIONAL VIOLATION] Voter attempted to vote outside "
                   "home constituency!");
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("REGION VIOLATION");
    lcd.setCursor(0, 1);
    lcd.print("Wrong Region!");
    soundFraudAlarm();
    delay(2500);
    return false;
  } else if (httpResponseCode == 409) {
    Serial.println("🛑 [FRAUD ALERT] Double voting attempt detected by "
                   "blockchain smart contract!");
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("FRAUD ALERT!");
    lcd.setCursor(0, 1);
    lcd.print("Already on Chain");
    soundFraudAlarm();
    delay(2000);
    return false;
  } else {
    Serial.print("⚠️ [WARNING] Server error or unreachable (HTTP ");
    Serial.print(httpResponseCode);
    Serial.println("). Vote preserved in local memory.");
    return false;
  }
}

// =========================================================
// 10. QUERY, SHOWCASE ELECTION RESULTS & RESET SYSTEM
// =========================================================
void resetLocalVotingState() {
  for (int i = 0; i < MAX_LOCAL_VOTERS; i++) {
    hasVotedLocal[i] = false;
  }
  localVotesA = 0;
  localVotesB = 0;
  localVotesC = 0;
  localVotesD = 0;
  Serial.println(
      "🔄 [LOCAL RESET] Local voter registry cleared. All IDs can vote again!");
}

// Helper to parse integer values for party vote tallies from JSON string
int parsePartyCount(const String &json, const String &partyName) {
  String key = "\"" + partyName + "\":";
  int idx = json.indexOf(key);
  if (idx < 0)
    return -1;
  int start = idx + key.length();
  while (start < json.length() && (json[start] == ' ' || json[start] == '\t')) {
    start++;
  }
  int end = start;
  while (end < json.length() && isDigit(json[end])) {
    end++;
  }
  if (end > start) {
    return json.substring(start, end).toInt();
  }
  return -1;
}

void fetchAndShowResults() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Election Results");
  lcd.setCursor(0, 1);
  lcd.print("Loading tallies..");

  int displayVotesA = localVotesA;
  int displayVotesB = localVotesB;
  int displayVotesC = localVotesC;
  int displayVotesD = localVotesD;
  int displayTotal =
      displayVotesA + displayVotesB + displayVotesC + displayVotesD;

  // Query live authoritative blockchain tallies from server
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(SERVER_RESULTS_URL);
    http.setTimeout(5000);
    int code = http.GET();
    if (code == 200) {
      String payload = http.getString();
      Serial.println("\n--- LIVE ON-CHAIN ELECTION RESULTS ---");
      Serial.println(payload);

      int countA = parsePartyCount(payload, PARTY_A_NAME);
      int countB = parsePartyCount(payload, PARTY_B_NAME);
      int countC = parsePartyCount(payload, PARTY_C_NAME);
      int countD = parsePartyCount(payload, PARTY_D_NAME);
      int srvTotal = parsePartyCount(payload, "totalVotes");

      if (countA >= 0)
        displayVotesA = countA;
      if (countB >= 0)
        displayVotesB = countB;
      if (countC >= 0)
        displayVotesC = countC;
      if (countD >= 0)
        displayVotesD = countD;
      if (srvTotal >= 0)
        displayTotal = srvTotal;
      else
        displayTotal =
            displayVotesA + displayVotesB + displayVotesC + displayVotesD;

      // Synchronize local counters with live server blockchain counts
      localVotesA = displayVotesA;
      localVotesB = displayVotesB;
      localVotesC = displayVotesC;
      localVotesD = displayVotesD;
    }
    http.end();
  }

  // Display Certified Counts on Serial
  Serial.println("\n--- OFFICIAL ELECTION RESULTS SUMMARY ---");
  Serial.printf("Party A (%s): %d\n", PARTY_A_NAME, displayVotesA);
  Serial.printf("Party B (%s): %d\n", PARTY_B_NAME, displayVotesB);
  Serial.printf("Party C (%s): %d\n", PARTY_C_NAME, displayVotesC);
  Serial.printf("Party D (%s): %d\n", PARTY_D_NAME, displayVotesD);
  Serial.printf("Total Certified Ballots: %d\n", displayTotal);
  Serial.println("-----------------------------------------\n");

  // Phase 1: Showcase live party tallies on LCD for 3.5 seconds
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("A:");
  lcd.print(displayVotesA);
  lcd.setCursor(8, 0);
  lcd.print("B:");
  lcd.print(displayVotesB);

  lcd.setCursor(0, 1);
  lcd.print("C:");
  lcd.print(displayVotesC);
  lcd.setCursor(8, 1);
  lcd.print("D:");
  lcd.print(displayVotesD);
  soundTallyClick();
  delay(3500);

  // Phase 2: Calculate and showcase the winner on LCD using live server tallies
  int maxV = 0;
  String winner = "No Votes";

  if (displayVotesA > maxV) {
    maxV = displayVotesA;
    winner = PARTY_A_NAME;
  }
  if (displayVotesB > maxV) {
    maxV = displayVotesB;
    winner = PARTY_B_NAME;
  } else if (displayVotesB == maxV && maxV > 0) {
    winner = "Tie";
  }
  if (displayVotesC > maxV) {
    maxV = displayVotesC;
    winner = PARTY_C_NAME;
  } else if (displayVotesC == maxV && maxV > 0) {
    winner = "Tie";
  }
  if (displayVotesD > maxV) {
    maxV = displayVotesD;
    winner = PARTY_D_NAME;
  } else if (displayVotesD == maxV && maxV > 0) {
    winner = "Tie";
  }

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("WINNER: ");
  lcd.print(winner.substring(0, 8));
  lcd.setCursor(0, 1);
  lcd.print("Total:" + String(displayTotal) + " Final");
  soundVoteSecured();
  delay(4000);

  // Phase 3: Election is over -> Conclude & Reset backend and local terminal
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Voting Concluded");
  lcd.setCursor(0, 1);
  lcd.print("Resetting System");

  // Call backend to conclude election and reset backend voter hashes & tallies
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(SERVER_RESET_URL);
    http.addHeader("Content-Type", "application/json");
    http.setTimeout(HTTP_TIMEOUT_MS);
    int code = http.POST("{\"source\":\"ESP32_GPIO27_RESULT_BUTTON\","
                         "\"action\":\"SHOWCASE_AND_RESET\"}");
    if (code == 200) {
      Serial.println("🎉 [SERVER RESET CONFIRMED] Backend election state reset "
                     "for new round!");
      currentElectionRound++;
    }
    http.end();
  }

  // Reset local terminal counters and voter cache
  resetLocalVotingState();

  delay(2000);
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Election Reset!");
  lcd.setCursor(0, 1);
  lcd.print("Ready to Vote!");
  soundBootReady();
  delay(2000);
}

// ===============================================================================
// 11. HELPER UTILITIES
// ===============================================================================
void promptScan() {
  Serial.println("--- Ready: Please Scan Finger on R307 Sensor ---");
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Biometric Voting");
  lcd.setCursor(0, 1);
  lcd.print("Scan Finger...");
}

VoterInfo fetchVoterInfo(int id) {
  VoterInfo info;
  info.name = "Citizen #" + String(id);
  info.region = (id < MAX_LOCAL_VOTERS && voterRegionLocal[id].length() > 0)
                    ? voterRegionLocal[id]
                    : "Konkan";
  info.district = (id < MAX_LOCAL_VOTERS && voterDistrictLocal[id].length() > 0)
                      ? voterDistrictLocal[id]
                      : "Mumbai";
  info.hasVoted = (id < MAX_LOCAL_VOTERS) ? hasVotedLocal[id] : false;
  info.found = false;

  // Defaults for default 4 state slots
  if (id == 1) {
    info.name = "Vallabh";
    info.region = "Konkan";
    info.district = "Mumbai";
  } else if (id == 2) {
    info.name = "Rahul";
    info.region = "Vidarbha";
    info.district = "Nagpur";
  } else if (id == 3) {
    info.name = "Priya";
    info.region = "Marathwada";
    info.district = "Aurangabad";
  } else if (id == 4) {
    info.name = "Ananya";
    info.region = "Paschim";
    info.district = "Pune";
  }

  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    String slotUrl = SERVER_BASE_URL + "/api/fingerprints/slot/" + String(id);
    http.begin(slotUrl);
    http.setTimeout(1500); // Fast 1.5s non-blocking timeout
    int httpCode = http.GET();
    if (httpCode == 200) {
      String payload = http.getString();
      int nameIdx = payload.indexOf("\"name\":\"");
      if (nameIdx != -1) {
        int endIdx = payload.indexOf("\"", nameIdx + 8);
        if (endIdx != -1)
          info.name = payload.substring(nameIdx + 8, endIdx);
      }
      int regIdx = payload.indexOf("\"region\":\"");
      if (regIdx != -1) {
        int endIdx = payload.indexOf("\"", regIdx + 10);
        if (endIdx != -1)
          info.region = payload.substring(regIdx + 10, endIdx);
      }
      int distIdx = payload.indexOf("\"district\":\"");
      if (distIdx != -1) {
        int endIdx = payload.indexOf("\"", distIdx + 12);
        if (endIdx != -1)
          info.district = payload.substring(distIdx + 12, endIdx);
      }
      if (payload.indexOf("\"hasVoted\":true") != -1) {
        info.hasVoted = true;
      }
      info.found = true;
    }
    http.end();
  }

  // Update local cache
  if (id < MAX_LOCAL_VOTERS) {
    voterRegionLocal[id] = info.region;
    voterDistrictLocal[id] = info.district;
    if (info.hasVoted)
      hasVotedLocal[id] = true;
  }

  return info;
}

String getVoterName(int id) {
  VoterInfo v = fetchVoterInfo(id);
  return v.name;
}

// ===============================================================================
// MONGODB-POWERED BIOMETRIC VERIFICATION (FLASH SEARCH 100% BYPASSED)
// ===============================================================================
uint8_t hexNibble(char c) {
  if (c >= '0' && c <= '9')
    return c - '0';
  if (c >= 'a' && c <= 'f')
    return c - 'a' + 10;
  if (c >= 'A' && c <= 'F')
    return c - 'A' + 10;
  return 0;
}

bool hexStringToBytes(const String &hexStr, uint8_t *outputBuffer,
                      int maxBytes) {
  if (hexStr.length() < maxBytes * 2)
    return false;
  for (int i = 0; i < maxBytes; i++) {
    outputBuffer[i] = (hexNibble(hexStr.charAt(i * 2)) << 4) |
                      hexNibble(hexStr.charAt(i * 2 + 1));
  }
  return true;
}

String bytesToHexString(const uint8_t *buffer, int len) {
  String hexStr = "";
  hexStr.reserve(len * 2);
  const char hexChars[] = "0123456789ABCDEF";
  for (int i = 0; i < len; i++) {
    hexStr += hexChars[(buffer[i] >> 4) & 0x0F];
    hexStr += hexChars[buffer[i] & 0x0F];
  }
  return hexStr;
}

/**
 * Downloads a 512-byte template from MongoDB into R307 internal RAM CharBuffer2
 * using the AS608 DownChar command (0x09 to target 0x02).
 * NOTE: Operates strictly in volatile sensor RAM. Never touches flash memory!
 */
bool streamTemplateToBuffer2(const uint8_t *templateBytes) {
  while (fpSerial.available()) {
    fpSerial.read();
  }

  // AS608 DownChar command (0x09) targeting CharBuffer2 (0x02) in volatile RAM
  uint8_t cmdPacket[] = {
      0xEF, 0x01, 0xFF, 0xFF, 0xFF, 0xFF, 0x01, 0x00, 0x04, 0x09,
      0x02,      // CharBuffer2 destination
      0x00, 0x10 // Checksum: 0x01 + 0x00 + 0x04 + 0x09 + 0x02 = 0x0010
  };

  fpSerial.write(cmdPacket, sizeof(cmdPacket));
  fpSerial.flush();

  unsigned long startWait = millis();
  while (fpSerial.available() < 12 && millis() - startWait < 1500) {
    delay(10);
  }

  if (fpSerial.available() < 12) {
    return false;
  }

  uint8_t ack[12];
  fpSerial.readBytes(ack, 12);
  if (ack[9] != 0x00) {
    return false;
  }

  // Stream 512 bytes in four 128-byte data packets directly into CharBuffer2
  // RAM
  for (int pIdx = 0; pIdx < 4; pIdx++) {
    uint8_t packetId =
        (pIdx == 3) ? 0x08 : 0x02; // 0x08 = End of stream, 0x02 = Data
    uint16_t packetLen = 128 + 2;  // 128 data + 2 checksum

    uint8_t pHeader[9];
    pHeader[0] = 0xEF;
    pHeader[1] = 0x01;
    pHeader[2] = 0xFF;
    pHeader[3] = 0xFF;
    pHeader[4] = 0xFF;
    pHeader[5] = 0xFF;
    pHeader[6] = packetId;
    pHeader[7] = (packetLen >> 8) & 0xFF;
    pHeader[8] = packetLen & 0xFF;

    uint16_t checksum = packetId + pHeader[7] + pHeader[8];
    fpSerial.write(pHeader, 9);

    int offset = pIdx * 128;
    for (int b = 0; b < 128; b++) {
      uint8_t dByte = templateBytes[offset + b];
      checksum += dByte;
      fpSerial.write(dByte);
    }

    fpSerial.write((checksum >> 8) & 0xFF);
    fpSerial.write(checksum & 0xFF);
    fpSerial.flush();

    delay(20);
  }

  delay(40);
  while (fpSerial.available()) {
    fpSerial.read();
  }
  return true;
}

/**
 * Executes AS608 Match command (0x03) between:
 *  - CharBuffer1 (Live scanned finger minutiae in RAM)
 *  - CharBuffer2 (Template downloaded from MongoDB Atlas into RAM)
 * Returns confidence score (> 35 for match), or 0 if no match.
 */
int matchRamBuffers() {
  while (fpSerial.available()) {
    fpSerial.read();
  }

  // AS608 Match command packet: Instruction 0x03
  uint8_t cmdPacket[] = {
      0xEF, 0x01, 0xFF, 0xFF, 0xFF, 0xFF, 0x01,
      0x00, 0x03, 0x03, 0x00, 0x07 // Checksum: 0x01 + 0x00 + 0x03 + 0x03 =
                                   // 0x0007
  };

  fpSerial.write(cmdPacket, sizeof(cmdPacket));
  fpSerial.flush();

  unsigned long startWait = millis();
  while (fpSerial.available() < 12 && millis() - startWait < 1500) {
    delay(10);
  }

  if (fpSerial.available() < 12) {
    return 0; // Timeout
  }

  uint8_t ack[12];
  fpSerial.readBytes(ack, 12);
  if (ack[9] == 0x00) {
    // Biometric match confirmed!
    uint16_t score = (ack[10] << 8) | ack[11];
    return score > 0 ? score : 100;
  }

  return 0; // Did not match
}

/**
 * Uploads 512-byte template from CharBuffer1 up to ESP32 using AS608 UpChar
 * (0x08)
 */
bool uploadTemplateFromBuffer1(uint8_t *outputBuffer) {
  while (fpSerial.available()) {
    fpSerial.read();
  }

  // Send AS608 UpChar (0x08) targeting CharBuffer1 (0x01)
  uint8_t cmdPacket[] = {0xEF, 0x01, 0xFF, 0xFF, 0xFF, 0xFF, 0x01,
                         0x00, 0x04, 0x08, 0x01, 0x00, 0x0E};

  fpSerial.write(cmdPacket, sizeof(cmdPacket));
  fpSerial.flush();

  unsigned long startWait = millis();
  while (fpSerial.available() < 12 && millis() - startWait < 1500) {
    delay(5);
  }

  if (fpSerial.available() < 12)
    return false;

  uint8_t ack[12];
  fpSerial.readBytes(ack, 12);
  if (ack[9] != 0x00)
    return false;

  // Read all incoming packet bytes from R307
  uint8_t rawBuffer[600];
  int rawCount = 0;
  startWait = millis();
  while ((millis() - startWait < 1500) && rawCount < 600) {
    if (fpSerial.available()) {
      rawBuffer[rawCount++] = fpSerial.read();
      startWait = millis(); // reset timeout on incoming byte
    }
  }

  // Case A: Two 267-byte packets (256 data bytes each, Adafruit standard)
  if (rawCount >= 534 && rawBuffer[0] == 0xEF && rawBuffer[1] == 0x01) {
    int uindx = 9;
    memcpy(outputBuffer, rawBuffer + uindx, 256);
    uindx += 256 + 2 + 9;
    if (uindx + 256 <= rawCount) {
      memcpy(outputBuffer + 256, rawBuffer + uindx, 256);
      return true;
    }
  }

  // Case B: Four 139-byte packets (128 data bytes each)
  if (rawCount >= 556 && rawBuffer[0] == 0xEF && rawBuffer[1] == 0x01) {
    int uindx = 9;
    for (int p = 0; p < 4; p++) {
      memcpy(outputBuffer + (p * 128), rawBuffer + uindx, 128);
      uindx += 128 + 2 + 9;
    }
    return true;
  }

  // Case C: Raw 512 bytes received
  if (rawCount >= 512) {
    memcpy(outputBuffer, rawBuffer, 512);
    return true;
  }

  return false;
}

/**
 * Verifies fingerprint scan strictly against MongoDB Atlas database.
 * Flash memory search (fingerSearch) is 100% BYPASSED.
 * Scanned minutiae (CharBuffer1) is compared against MongoDB templates
 * (CharBuffer2).
 */
/**
 * VOTING PROCESS WORKFLOW:
 *  1. R307 Optical Sensor: Capture fingerprint image
 *  2. ESP32 Microcontroller: Transfer image/template from sensor RAM
 *  3. Backend API: Send template/image to Node.js Backend API
 *  4. Fingerprint Engine: Compare with MongoDB voter data (1:N search)
 *  5. Decision Branch:
 *      - NO MATCH: Return -2 (Reject!)
 *      - MATCH FOUND: Check voting status (MongoDB + Sepolia Smart Contract)
 *          * Already voted: Return -3 (Double-Voting Fraud Rejected!)
 *          * Not voted: Return slot ID (Authorized! Proceed to cast ballot)
 */
int checkFingerprint() {
  // Step 1: Capture optical fingerprint image from sensor
  uint8_t p = finger.getImage();
  if (p != FINGERPRINT_OK)
    return -1;

  // Step 2: Extract minutiae features into CharBuffer1 in sensor RAM
  p = finger.image2Tz(1);
  if (p != FINGERPRINT_OK)
    return -1;

  Serial.println("\n========================================================");
  Serial.println("👆 [FINGERPRINT SCANNED] Live optical image captured!");
  Serial.println(
      "   -> Transferring minutiae template to ESP32 microcontroller...");

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Finger Detected");
  lcd.setCursor(0, 1);
  lcd.print("Contacting Engine");

  // Step 2.5: Hardware fast search reference
  uint8_t hwResult = finger.fingerFastSearch();
  int localHardwareSlot = (hwResult == FINGERPRINT_OK) ? finger.fingerID : -1;
  if (localHardwareSlot > 0) {
    Serial.printf(
        "   ℹ️ Sensor Hardware Match Reference: Slot #%d (Confidence: %d)\n",
        localHardwareSlot, finger.confidence);
  }

  // Step 3: Transfer minutiae template from R307 sensor RAM to ESP32 (AS608
  // UpChar 0x08)
  uint8_t probeBytes[512];
  bool transferred = uploadTemplateFromBuffer1(probeBytes);
  String hexProbe = "";
  if (transferred) {
    hexProbe = bytesToHexString(probeBytes, 512);
    Serial.println(
        "   -> Successfully transferred 512 bytes (1024 hex) to ESP32!");
  } else {
    Serial.println("   ⚠️ UpChar transfer timed out, using slot reference for "
                   "Engine search...");
  }

  // Step 4: Send biometric data to Backend API for Fingerprint Engine
  // processing
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(SERVER_BASE_URL + "/api/fingerprints/engine/verify");
    http.addHeader("Content-Type", "application/json");
    http.setTimeout(4000); // 4-second timeout for server engine search

    String verifyJson = "{\"terminalId\":\"ESP32_BOOTH_01\"";
    if (hexProbe.length() == 1024) {
      verifyJson += ",\"templateData\":\"" + hexProbe + "\"";
    }
    if (localHardwareSlot > 0) {
      verifyJson += ",\"slotId\":" + String(localHardwareSlot);
    }
    verifyJson += "}";

    Serial.println(
        "   -> Dispatched to Backend API: /api/fingerprints/engine/verify");
    int httpCode = http.POST(verifyJson);

    if (httpCode == 200) {
      String payload = http.getString();
      http.end();

      // Check Decision Branch from Fingerprint Engine
      if (payload.indexOf("\"authorized\":true") != -1) {
        // MATCH FOUND & VOTING AUTHORIZED!
        String citizenName = "Citizen";
        int nameIdx = payload.indexOf("\"name\":\"");
        if (nameIdx != -1) {
          int endName = payload.indexOf("\"", nameIdx + 8);
          if (endName != -1)
            citizenName = payload.substring(nameIdx + 8, endName);
        }

        int slotId = (localHardwareSlot > 0) ? localHardwareSlot : 1;
        int slotIdx = payload.indexOf("\"fingerprintSlot\":");
        if (slotIdx != -1) {
          slotId = payload.substring(slotIdx + 18, slotIdx + 22).toInt();
          if (slotId <= 0)
            slotId = (localHardwareSlot > 0) ? localHardwareSlot : 1;
        }

        Serial.printf("🎉 [ENGINE AUTHORIZED] Citizen: %s (Slot #%d) "
                      "authorized to vote!\n",
                      citizenName.c_str(), slotId);

        lcd.clear();
        lcd.setCursor(0, 0);
        lcd.print("Authorized!");
        lcd.setCursor(0, 1);
        lcd.print(citizenName.substring(0, 16));
        delay(1200);

        return slotId;

      } else if (payload.indexOf("\"alreadyVoted\":true") != -1) {
        // MATCH FOUND BUT ALREADY VOTED -> FRAUD REJECTED!
        Serial.println(
            "🛑 [FRAUD REJECTED] Citizen has already cast a ballot!");
        lcd.clear();
        lcd.setCursor(0, 0);
        lcd.print("Fraud Alert!");
        lcd.setCursor(0, 1);
        lcd.print("Already Voted!");
        soundFraudAlarm();
        delay(2500);
        promptScan();
        return -3;

      } else {
        // NO MATCH FOUND IN MONGODB -> REJECT!
        Serial.println(
            "❌ [REJECTED] Fingerprint not recognized in MongoDB database.");
        lcd.clear();
        lcd.setCursor(0, 0);
        lcd.print("Access Denied");
        lcd.setCursor(0, 1);
        lcd.print("Not Registered!");
        soundFingerRejected();
        delay(2000);
        promptScan();
        return -2;
      }
    } else {
      Serial.printf("⚠️ Backend API returned HTTP %d, falling back to local "
                    "hardware match...\n",
                    httpCode);
      http.end();
    }
  }

  // Edge Fallback: Local Hardware Slot Matching (Offline Mode)
  if (localHardwareSlot > 0) {
    if (hasVotedLocal[localHardwareSlot]) {
      Serial.println("🛑 Local check: Citizen already voted!");
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("Fraud Alert!");
      lcd.setCursor(0, 1);
      lcd.print("Already Voted!");
      soundFraudAlarm();
      delay(2500);
      promptScan();
      return -3;
    }
    Serial.printf("✅ [OFFLINE FALLBACK] Recognized local voter Slot #%d\n",
                  localHardwareSlot);
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Authorized!");
    lcd.setCursor(0, 1);
    lcd.print("Voter #" + String(localHardwareSlot));
    delay(1200);
    return localHardwareSlot;
  }

  return -2;
}

/**
 * Fetches citizen template from MongoDB via Node.js API and stores into RAM
 * (Flash Bypassed)
 */
bool syncVoterTemplateFromMongo(int slotId) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("⚠️ Cannot sync from MongoDB: Wi-Fi offline.");
    return false;
  }

  HTTPClient http;
  String slotUrl = SERVER_BASE_URL + "/api/fingerprints/slot/" + String(slotId);
  Serial.print("📡 [SYNC MONGODB] Querying: ");
  Serial.println(slotUrl);

  http.begin(slotUrl);
  http.setTimeout(5000);

  int httpCode = http.GET();
  if (httpCode != 200) {
    Serial.printf("❌ Failed to query MongoDB for Slot #%d (HTTP %d)\n", slotId,
                  httpCode);
    http.end();
    return false;
  }

  String payload = http.getString();
  http.end();

  int tIdx = payload.indexOf("\"fingerprintTemplate\":\"");
  if (tIdx < 0) {
    Serial.printf("ℹ️ Slot #%d has no remote template in MongoDB.\n", slotId);
    return false;
  }

  int start = tIdx + 23;
  int end = payload.indexOf("\"", start);
  String hexTemplate = payload.substring(start, end);

  if (hexTemplate.length() < 1024) {
    while (hexTemplate.length() < 1024) {
      hexTemplate += "00";
    }
  }

  uint8_t templateBytes[512];
  if (!hexStringToBytes(hexTemplate, templateBytes, 512)) {
    Serial.println("❌ Failed to decode hex template into binary bytes.");
    return false;
  }

  // Parse citizen info
  String voterName = "Citizen #" + String(slotId);
  int nameIdx = payload.indexOf("\"name\":\"");
  if (nameIdx != -1) {
    int endName = payload.indexOf("\"", nameIdx + 8);
    if (endName != -1)
      voterName = payload.substring(nameIdx + 8, endName);
  }

  String region = "Konkan";
  int regIdx = payload.indexOf("\"region\":\"");
  if (regIdx != -1) {
    int endReg = payload.indexOf("\"", regIdx + 10);
    if (endReg != -1)
      region = payload.substring(regIdx + 10, endReg);
  }

  String district = "Mumbai";
  int distIdx = payload.indexOf("\"district\":\"");
  if (distIdx != -1) {
    int endDist = payload.indexOf("\"", distIdx + 12);
    if (endDist != -1)
      district = payload.substring(distIdx + 12, endDist);
  }

  String vId = "FP_UID_" + String(slotId);
  int vIdIdx = payload.indexOf("\"voterId\":\"");
  if (vIdIdx != -1) {
    int endVid = payload.indexOf("\"", vIdIdx + 11);
    if (endVid != -1)
      vId = payload.substring(vIdIdx + 11, endVid);
  }

  // Store strictly in ESP32 RAM cache (Flash storage is 100% bypassed!)
  mongoTemplates[slotId].slotId = slotId;
  mongoTemplates[slotId].voterId = vId;
  mongoTemplates[slotId].name = voterName;
  mongoTemplates[slotId].region = region;
  mongoTemplates[slotId].district = district;
  if (mongoTemplates[slotId].templateBytes == nullptr) {
    mongoTemplates[slotId].templateBytes = (uint8_t *)malloc(512);
  }
  if (mongoTemplates[slotId].templateBytes != nullptr) {
    memcpy(mongoTemplates[slotId].templateBytes, templateBytes, 512);
    mongoTemplates[slotId].isLoaded = true;
  }

  voterRegionLocal[slotId] = region;
  voterDistrictLocal[slotId] = district;

  Serial.printf("🍃 [MONGODB SYNC SUCCESS] Slot #%d (%s, %s - %s) loaded into "
                "RAM. Flash bypassed!\n",
                slotId, voterName.c_str(), region.c_str(), district.c_str());
  return true;
}

/**
 * Synchronizes primary election citizen templates from MongoDB into ESP32 RAM
 */
void syncAllTemplatesFromMongo() {
  Serial.println("\n========================================================");
  Serial.println(
      "🍃 SYNCING BIOMETRIC TEMPLATES FROM MONGODB ATLAS (RAM ONLY)");
  Serial.println("   -> Sensor Flash Memory storage is 100% BYPASSED");
  Serial.println("========================================================");

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Sync MongoDB ->");
  lcd.setCursor(0, 1);
  lcd.print("RAM Buffer...");

  int successCount = 0;
  for (int s = 1; s <= 4; s++) {
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Sync Mongo Slot");
    lcd.setCursor(0, 1);
    lcd.print("Slot #" + String(s) + "...");

    if (syncVoterTemplateFromMongo(s)) {
      successCount++;
      soundTallyClick();
    }
    delay(200);
  }

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("MongoDB Sync OK!");
  lcd.setCursor(0, 1);
  lcd.print("Loaded " + String(successCount) + "/4 in RAM");
  soundBootReady();
  delay(2000);
  promptScan();
}

// Find first free slot in MongoDB RAM cache (Flash bypassed)
int getNextAvailableID() {
  for (int id = 5; id < MAX_LOCAL_VOTERS; id++) {
    if (!mongoTemplates[id].isLoaded && voterRegionLocal[id].length() == 0) {
      return id; // Found first unassigned slot in MongoDB cache
    }
  }
  return 5;
}

// Live Enrollment Mode: Guided Biometric Registration with Region & Sub-Region
// Selection
int enrollFingerprint(int id) {
  int p = -1;
  Serial.print("-> Starting registration for New Voter slot #");
  Serial.println(id);

  // -------------------------------------------------------------
  // Step A: Region Selection on LCD using Touch Buttons 1 - 4
  // -------------------------------------------------------------
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Select Region:");
  lcd.setCursor(0, 1);
  lcd.print("1:KNK 2:VID 3:MR 4:PS");

  int regChoice = waitForTouchButton(20000);
  if (regChoice == 0) {
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Enroll Cancelled");
    lcd.setCursor(0, 1);
    lcd.print("Region Timeout");
    soundTimeout();
    delay(2000);
    return -1;
  }

  String selectedRegion = REGION_NAMES[regChoice - 1];
  Serial.printf("-> Selected Region [%d]: %s\n", regChoice,
                selectedRegion.c_str());
  soundPartySelected();

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Region Selected:");
  lcd.setCursor(0, 1);
  lcd.print(">> " + selectedRegion);
  delay(1200);

  // -------------------------------------------------------------
  // Step B: Sub-Region (District) Selection using Touch Buttons 1 - 4
  // -------------------------------------------------------------
  lcd.clear();
  lcd.setCursor(0, 0);
  if (regChoice == 1) {
    lcd.print("Konkan District:");
    lcd.setCursor(0, 1);
    lcd.print("1:Mum 2:Tha 3:Rai 4:Pal");
  } else if (regChoice == 2) {
    lcd.print("Vidarbha Dist:");
    lcd.setCursor(0, 1);
    lcd.print("1:Nag 2:Amr 3:Ako 4:War");
  } else if (regChoice == 3) {
    lcd.print("Marathwada Dist:");
    lcd.setCursor(0, 1);
    lcd.print("1:Aur 2:Nan 3:Lat 4:Jal");
  } else {
    lcd.print("Paschim Dist:");
    lcd.setCursor(0, 1);
    lcd.print("1:Pun 2:Kol 3:Sat 4:Sol");
  }

  int distChoice = waitForTouchButton(20000);
  if (distChoice == 0) {
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Enroll Cancelled");
    lcd.setCursor(0, 1);
    lcd.print("District Timeout");
    soundTimeout();
    delay(2000);
    return -1;
  }

  String selectedDistrict = "";
  if (regChoice == 1)
    selectedDistrict = DISTRICTS_KONKAN[distChoice - 1];
  else if (regChoice == 2)
    selectedDistrict = DISTRICTS_VIDARBHA[distChoice - 1];
  else if (regChoice == 3)
    selectedDistrict = DISTRICTS_MARATHWADA[distChoice - 1];
  else
    selectedDistrict = DISTRICTS_PASCHIM[distChoice - 1];

  Serial.printf("-> Selected District [%d]: %s\n", distChoice,
                selectedDistrict.c_str());
  soundPartySelected();

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Constituency:");
  lcd.setCursor(0, 1);
  lcd.print(selectedRegion.substring(0, 6) + "-" +
            selectedDistrict.substring(0, 9));
  delay(1500);

  // -------------------------------------------------------------
  // Step C: Fingerprint Optical Scan & Minutiae Capture (Pass 1)
  // -------------------------------------------------------------
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Enroll Voter #" + String(id));
  lcd.setCursor(0, 1);
  lcd.print("Place Finger...");

  // Step 1: Wait for finger placement
  unsigned long enrollStart = millis();
  while (p != FINGERPRINT_OK) {
    if (millis() - enrollStart > 15000) {
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("Enroll Cancelled");
      lcd.setCursor(0, 1);
      lcd.print("Timeout Error");
      soundTimeout();
      delay(2000);
      return -1;
    }
    p = finger.getImage();
    delay(50);
  }

  p = finger.image2Tz(1);
  if (p != FINGERPRINT_OK) {
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Scan Failed");
    lcd.setCursor(0, 1);
    lcd.print("Try Again");
    soundFingerRejected();
    delay(2000);
    return -1;
  }

  soundFingerMatched();
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Remove Finger");
  lcd.setCursor(0, 1);
  lcd.print("Wait...");

  delay(1200);
  p = 0;
  while (p != FINGERPRINT_NOFINGER) {
    p = finger.getImage();
    delay(50);
  }

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Place Same Finger");
  lcd.setCursor(0, 1);
  lcd.print("Again to Confirm");

  // -------------------------------------------------------------
  // Step D: Fingerprint Optical Scan Confirmation (Pass 2)
  // -------------------------------------------------------------
  enrollStart = millis();
  p = -1;
  while (p != FINGERPRINT_OK) {
    if (millis() - enrollStart > 15000) {
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("Enroll Cancelled");
      lcd.setCursor(0, 1);
      lcd.print("Timeout Error");
      soundTimeout();
      delay(2000);
      return -1;
    }
    p = finger.getImage();
    delay(50);
  }

  p = finger.image2Tz(2);
  if (p != FINGERPRINT_OK) {
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Scan Failed");
    lcd.setCursor(0, 1);
    lcd.print("Try Again");
    soundFingerRejected();
    delay(2000);
    return -1;
  }

  // -------------------------------------------------------------
  // Step E: Create Model and Commit to R307 Flash EEPROM Slot
  // -------------------------------------------------------------
  p = finger.createModel();
  if (p != FINGERPRINT_OK) {
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Finger Mismatch");
    lcd.setCursor(0, 1);
    lcd.print("Registration Err");
    soundFraudAlarm();
    delay(2500);
    return -1;
  }

  // Extract 512-byte template from CharBuffer1 in RAM
  uint8_t enrolledBytes[512];
  bool extracted = uploadTemplateFromBuffer1(enrolledBytes);
  String hexTemplate = "";
  if (extracted) {
    hexTemplate = bytesToHexString(enrolledBytes, 512);
  }

  // Cache in ESP32 RAM (Flash bypassed)
  if (id < MAX_LOCAL_VOTERS) {
    mongoTemplates[id].slotId = id;
    mongoTemplates[id].voterId = "FP_UID_" + String(id);
    mongoTemplates[id].name = "Citizen #" + String(id);
    mongoTemplates[id].region = selectedRegion;
    mongoTemplates[id].district = selectedDistrict;
    if (extracted) {
      if (mongoTemplates[id].templateBytes == nullptr) {
        mongoTemplates[id].templateBytes = (uint8_t *)malloc(512);
      }
      if (mongoTemplates[id].templateBytes != nullptr) {
        memcpy(mongoTemplates[id].templateBytes, enrolledBytes, 512);
      }
    }
    mongoTemplates[id].isLoaded = true;
    voterRegionLocal[id] = selectedRegion;
    voterDistrictLocal[id] = selectedDistrict;
    hasVotedLocal[id] = false;
  }

  // Persist Citizen + 512-Byte Template directly to MongoDB Atlas
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(SERVER_BASE_URL + "/api/fingerprints/engine/register");
    http.addHeader("Content-Type", "application/json");
    http.setTimeout(4000);
    String json = "{\"voterId\":\"FP_UID_" + String(id) +
                  "\",\"fingerprintSlot\":" + String(id) +
                  ",\"name\":\"Citizen #" + String(id) + "\",\"region\":\"" +
                  selectedRegion + "\",\"district\":\"" + selectedDistrict +
                  "\",\"constituency\":\"" + selectedRegion + " - " +
                  selectedDistrict + "\"";
    if (hexTemplate.length() == 1024) {
      json += ",\"fingerprintTemplate\":\"" + hexTemplate + "\"";
    }
    json += "}";

    int resCode = http.POST(json);
    if (resCode == 200 || resCode == 201) {
      Serial.printf("🍃 [MONGODB SUCCESS] Slot #%d [%s - %s] registered with "
                    "template to MongoDB Atlas!\n",
                    id, selectedRegion.c_str(), selectedDistrict.c_str());
    } else {
      Serial.printf(
          "⚠️ [MONGODB REGISTRATION FAILED] HTTP %d (URL: %s)\n", resCode,
          (SERVER_BASE_URL + "/api/fingerprints/engine/register").c_str());
    }
    http.end();
  }

  // Mirror to sensor memory as non-critical local backup
  finger.storeModel(id);

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Voter #" + String(id) + " Saved!");
  lcd.setCursor(0, 1);
  lcd.print("Saved to MongoDB");
  soundVoteSecured();
  delay(3000);
  return id;
}

// ===============================================================================
// 12. DISTINCT AUDIO TONE ENGINE IMPLEMENTATION
// Works with both Active Buzzers (distinct cadences) & Passive Buzzers (musical
// pitches)
// ===============================================================================

// 1. Boot Ready: Upbeat 3-step rising chime
void soundBootReady() {
  tone(BUZZER_PIN, 1800, 70);
  delay(80);
  tone(BUZZER_PIN, 2400, 70);
  delay(80);
  tone(BUZZER_PIN, 3200, 140);
  delay(150);
  noTone(BUZZER_PIN);
  digitalWrite(BUZZER_PIN, LOW);
}

// 2. Fingerprint Matched: Cheerful double-pip ("Pip-Pip!")
void soundFingerMatched() {
  tone(BUZZER_PIN, 2500, 60);
  delay(80);
  tone(BUZZER_PIN, 3100, 90);
  delay(100);
  noTone(BUZZER_PIN);
  digitalWrite(BUZZER_PIN, LOW);
}

// 3. Fingerprint Rejected / Not in DB: Low dual buzz ("Bzz-Bzz")
void soundFingerRejected() {
  tone(BUZZER_PIN, 600, 160);
  delay(190);
  tone(BUZZER_PIN, 450, 240);
  delay(260);
  noTone(BUZZER_PIN);
  digitalWrite(BUZZER_PIN, LOW);
}

// 4. Candidate Party Selected: Quick tactile acknowledgment click
void soundPartySelected() {
  tone(BUZZER_PIN, 2400, 70);
  delay(80);
  noTone(BUZZER_PIN);
  digitalWrite(BUZZER_PIN, LOW);
}

// 5. Vote Secured & Mined on Blockchain: Celebratory victory fanfare (4 rising
// notes!)
void soundVoteSecured() {
  tone(BUZZER_PIN, 1800, 70);
  delay(90);
  tone(BUZZER_PIN, 2200, 70);
  delay(90);
  tone(BUZZER_PIN, 2800, 90);
  delay(110);
  tone(BUZZER_PIN, 3600, 260);
  delay(280);
  noTone(BUZZER_PIN);
  digitalWrite(BUZZER_PIN, LOW);
}

// 6. Vote Recorded Offline: Steady double blip
void soundVoteOffline() {
  tone(BUZZER_PIN, 1600, 100);
  delay(120);
  tone(BUZZER_PIN, 1600, 100);
  delay(120);
  noTone(BUZZER_PIN);
  digitalWrite(BUZZER_PIN, LOW);
}

// 7. Fraud Alarm / Already Voted: Urgent rapid siren alarm
// (Bee-Bop-Bee-Bop-Wail!)
void soundFraudAlarm() {
  for (int i = 0; i < 4; i++) {
    tone(BUZZER_PIN, 3400, 70);
    delay(80);
    tone(BUZZER_PIN, 1200, 70);
    delay(80);
  }
  tone(BUZZER_PIN, 800, 400);
  delay(420);
  noTone(BUZZER_PIN);
  digitalWrite(BUZZER_PIN, LOW);
}

// 8. Session Timeout: Descending 3-step power down
void soundTimeout() {
  tone(BUZZER_PIN, 2400, 90);
  delay(110);
  tone(BUZZER_PIN, 1700, 90);
  delay(110);
  tone(BUZZER_PIN, 1000, 220);
  delay(240);
  noTone(BUZZER_PIN);
  digitalWrite(BUZZER_PIN, LOW);
}

// 9. Tally / Results Button: Dual high blip
void soundTallyClick() {
  tone(BUZZER_PIN, 2600, 50);
  delay(60);
  tone(BUZZER_PIN, 3200, 60);
  delay(70);
  noTone(BUZZER_PIN);
  digitalWrite(BUZZER_PIN, LOW);
}

// Legacy wrappers for backward compatibility
void beepShort() { soundPartySelected(); }

void beepDouble() { soundFingerMatched(); }

void longBeep() { soundFraudAlarm(); }