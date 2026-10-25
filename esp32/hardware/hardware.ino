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

#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <Adafruit_Fingerprint.h>
#include <WiFi.h>
#include <HTTPClient.h>

// ===============================================================================
// 1. PIN DEFINITIONS & TOUCH SENSOR CONFIGURATION
// ===============================================================================
#define TOUCH_PARTY_A 13
#define TOUCH_PARTY_B 14
#define TOUCH_PARTY_C 25
#define TOUCH_PARTY_D 26
#define TOUCH_RESULT  27
#define BTN_ENROLL    32 // Push Button (GPIO 32 to GND) to Register / Enroll New Voter
#define BUZZER_PIN    33

// Touch Sensor Trigger Logic:
// Standard digital capacitive touch modules (e.g., TTP223) output HIGH on touch.
// If your touch sensors output LOW on touch, change this to LOW.
#define TOUCH_ACTIVE  HIGH

// Backward-compatibility aliases
#define BTN_PARTY_A   TOUCH_PARTY_A
#define BTN_PARTY_B   TOUCH_PARTY_B
#define BTN_PARTY_C   TOUCH_PARTY_C
#define BTN_PARTY_D   TOUCH_PARTY_D
#define BTN_RESULT    TOUCH_RESULT

// Fingerprint Sensor Serial Pins (Hardware Serial 2)
#define FP_RX_PIN 16 // Connect to Sensor TX
#define FP_TX_PIN 17 // Connect to Sensor RX

// ===============================================================================
// 2. NETWORK & SERVER CONFIGURATION
// ===============================================================================
// Replace with your Wi-Fi credentials:
const char* WIFI_SSID     = "Vivo t2x";
const char* WIFI_PASSWORD = "11111111";

// ===============================================================================
// DYNAMIC SERVER HOST CONFIGURATION
// When your computer's IP address changes (e.g., new Wi-Fi / Hotspot):
// -> UPDATE ONLY THIS ONE VARIABLE BELOW:
// ===============================================================================
const char* SERVER_IP     = "10.118.241.167"; // <-- Current Hotspot Wi-Fi IP
const int   SERVER_PORT   = 3000;           // Port of node server.js

// Dynamic API endpoints automatically constructed from SERVER_IP and SERVER_PORT
#define ENDPOINT_VOTE    "/api/blockchain/vote"
#define ENDPOINT_RESULTS "/api/blockchain/votes"

String SERVER_BASE_URL    = String("http://") + SERVER_IP + ":" + SERVER_PORT;
String SERVER_VOTE_URL    = SERVER_BASE_URL + ENDPOINT_VOTE;
String SERVER_RESULTS_URL = SERVER_BASE_URL + ENDPOINT_RESULTS;

// Timeout settings
const unsigned long VOTE_TIMEOUT_MS = 25000; // 25s timeout waiting for party button
const int HTTP_TIMEOUT_MS           = 8000;  // 8s timeout for Web3 blockchain bridge

// ===============================================================================
// 3. HARDWARE & STATE INSTANCES
// ===============================================================================
// LCD Display instances for both standard I2C addresses (0x27 for PCF8574, 0x3F for PCF8574A)
LiquidCrystal_I2C lcd27(0x27, 16, 2);
LiquidCrystal_I2C lcd3F(0x3F, 16, 2);
LiquidCrystal_I2C* pLcd = &lcd27;
#define lcd (*pLcd)

// Hardware Serial 2 for R307 Fingerprint Sensor
HardwareSerial fpSerial(2);
Adafruit_Fingerprint finger = Adafruit_Fingerprint(&fpSerial);

// Candidate party names (matching both UI and blockchain smart contract)
const char* PARTY_A_NAME = "BJP";
const char* PARTY_B_NAME = "UBT";
const char* PARTY_C_NAME = "Congress";
const char* PARTY_D_NAME = "AIMIM";

// Local backup vote counters
int localVotesA = 0;
int localVotesB = 0;
int localVotesC = 0;
int localVotesD = 0;

// Local tracking cache (supports up to 128 registered fingerprint IDs)
#define MAX_LOCAL_VOTERS 128
bool hasVotedLocal[MAX_LOCAL_VOTERS] = {false};

bool isWifiConnected = false;

// ===============================================================================
// 4. FUNCTION DECLARATIONS & AUDIO TONE ENGINE
// ===============================================================================
void setupWifi();
void promptScan();
String getVoterName(int id);
void takeVote(int id, String name);
int checkFingerprint();
bool broadcastVoteToBlockchain(String voterId, String party);
void fetchAndShowResults();
int enrollFingerprint(int id);
int getNextAvailableID();

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
  SERVER_BASE_URL    = String("http://") + SERVER_IP + ":" + SERVER_PORT;
  SERVER_VOTE_URL    = SERVER_BASE_URL + ENDPOINT_VOTE;
  SERVER_RESULTS_URL = SERVER_BASE_URL + ENDPOINT_RESULTS;
  Serial.print("Target Server Host: ");
  Serial.println(SERVER_BASE_URL);

  // 1. Initialize GPIO Pins (Capacitive Touch Sensors & Buzzer)
  Serial.println("1. Initializing Touch Sensor Pins & Buzzer...");
  pinMode(TOUCH_PARTY_A, INPUT);
  pinMode(TOUCH_PARTY_B, INPUT);
  pinMode(TOUCH_PARTY_C, INPUT);
  pinMode(TOUCH_PARTY_D, INPUT);
  pinMode(TOUCH_RESULT,  INPUT);
  pinMode(BTN_ENROLL,    INPUT_PULLUP); // Dedicated push button to enroll new voter
  pinMode(BUZZER_PIN,    OUTPUT);
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
      if (addr < 16) Serial.print("0");
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
    Serial.println("-> [LCD SUCCESS] Found and bound to 16x2 I2C Display at 0x27!");
  } else if (detectedAddr == 0x3F) {
    pLcd = &lcd3F;
    Serial.println("-> [LCD SUCCESS] Found and bound to 16x2 I2C Display at 0x3F!");
  } else if (detectedAddr != 0) {
    Serial.print("-> [LCD SUCCESS] Found device at 0x");
    Serial.print(detectedAddr, HEX);
    Serial.println(", initializing LCD at this address...");
    pLcd = new LiquidCrystal_I2C(detectedAddr, 16, 2);
  } else {
    Serial.println("⚠️ [LCD WARNING] ZERO I2C devices detected on SDA=21, SCL=22!");
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
  Serial.println("4. Connecting to R307 Fingerprint Sensor on Serial2 (RX:16, TX:17)...");
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
    Serial.println("-> ERROR: Fingerprint Sensor not found! Check 5V, GND, RX(16), TX(17).");
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
  promptScan();
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

  // 1. Check if the Result Touch Sensor is triggered
  if (digitalRead(TOUCH_RESULT) == TOUCH_ACTIVE) {
    delay(50); // Debounce
    if (digitalRead(TOUCH_RESULT) == TOUCH_ACTIVE) {
      Serial.println("\n📊 Result inspection touch sensor triggered.");
      soundTallyClick();
      fetchAndShowResults();
      while (digitalRead(TOUCH_RESULT) == TOUCH_ACTIVE) { delay(10); } // Wait for touch release
      delay(3000);
      promptScan();
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
      while (digitalRead(BTN_ENROLL) == LOW) { delay(10); } // Wait for button release
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

    // Local Pre-Flight Check
    if (voterID < MAX_LOCAL_VOTERS && hasVotedLocal[voterID]) {
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

    String voterName = getVoterName(voterID);
    Serial.println("-> Authenticated Voter: " + voterName);

    // Display welcome on LCD
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Voter: " + voterName.substring(0, 9));
    lcd.setCursor(0, 1);
    lcd.print("Choose Candidate");
    delay(1500);

    // 3. Capture Ballot Button Press with Timeout
    takeVote(voterID, voterName);

  } else if (fingerStatus == -2) {
    // Finger was placed on sensor, but minutiae template does not match database
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
    Serial.println("\n-> WARNING: Wi-Fi not connected. Entering Offline Standalone Mode.");
    lcd.setCursor(0, 1);
    lcd.print("Offline Mode");
    delay(1500);
  }
}

// ===============================================================================
// 8. VOTING CAPTURE & DISPATCH
// ===============================================================================
void takeVote(int id, String name) {
  bool voteCast = false;
  String selectedParty = "";
  unsigned long startTime = millis();

  Serial.println("-> Waiting for candidate button (GPIO 13, 14, 25, 26)...");

  // Display the candidate choices clearly on the 16x2 LCD
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("1:BJP     2:UBT ");
  lcd.setCursor(0, 1);
  lcd.print("3:Cong  4:AIMIM");

  while (!voteCast) {
    // Check timeout
    if (millis() - startTime > VOTE_TIMEOUT_MS) {
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

    // Touch 1: Party A (BJP)
    if (digitalRead(TOUCH_PARTY_A) == TOUCH_ACTIVE) {
      delay(40); // Debounce
      if (digitalRead(TOUCH_PARTY_A) == TOUCH_ACTIVE) {
        selectedParty = PARTY_A_NAME;
        localVotesA++;
        while (digitalRead(TOUCH_PARTY_A) == TOUCH_ACTIVE) { delay(10); }
        voteCast = true;
      }
    }
    // Touch 2: Party B (UBT)
    else if (digitalRead(TOUCH_PARTY_B) == TOUCH_ACTIVE) {
      delay(40);
      if (digitalRead(TOUCH_PARTY_B) == TOUCH_ACTIVE) {
        selectedParty = PARTY_B_NAME;
        localVotesB++;
        while (digitalRead(TOUCH_PARTY_B) == TOUCH_ACTIVE) { delay(10); }
        voteCast = true;
      }
    }
    // Touch 3: Party C (Congress)
    else if (digitalRead(TOUCH_PARTY_C) == TOUCH_ACTIVE) {
      delay(40);
      if (digitalRead(TOUCH_PARTY_C) == TOUCH_ACTIVE) {
        selectedParty = PARTY_C_NAME;
        localVotesC++;
        while (digitalRead(TOUCH_PARTY_C) == TOUCH_ACTIVE) { delay(10); }
        voteCast = true;
      }
    }
    // Touch 4: Party D (AIMIM)
    else if (digitalRead(TOUCH_PARTY_D) == TOUCH_ACTIVE) {
      delay(40);
      if (digitalRead(TOUCH_PARTY_D) == TOUCH_ACTIVE) {
        selectedParty = PARTY_D_NAME;
        localVotesD++;
        while (digitalRead(TOUCH_PARTY_D) == TOUCH_ACTIVE) { delay(10); }
        voteCast = true;
      }
    }

    delay(20);
  }

  Serial.println("-> Touch Triggered! Choice: " + selectedParty);
  soundPartySelected();

  // 1. Explicitly show the voter WHOM they really voted for!
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("YOU VOTED FOR:");
  lcd.setCursor(0, 1);
  lcd.print(">> " + selectedParty);
  delay(2000); // 2 full seconds for voter to clearly see their choice

  // 2. Show Web3 blockchain submission
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Vote: " + selectedParty.substring(0, 10));
  lcd.setCursor(0, 1);
  lcd.print("Broadcasting...");

  // Send to Web3 Blockchain Relayer
  String voterUID = "FP_UID_" + String(id);
  bool chainSuccess = broadcastVoteToBlockchain(voterUID, selectedParty);

  // Mark local cache so voter cannot vote again on this terminal
  if (id < MAX_LOCAL_VOTERS) {
    hasVotedLocal[id] = true;
  }

  // 3. Final On-Chain / Ledger Confirmation
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

  // 4. "Thanks for Voting" screen for 3 seconds, then reset immediately!
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("   THANK YOU    ");
  lcd.setCursor(0, 1);
  lcd.print("  FOR VOTING!   ");
  delay(3000);

  promptScan();
}

// ===============================================================================
// 9. HTTP BLOCKCHAIN RELAYER COMMUNICATION
// ===============================================================================
bool broadcastVoteToBlockchain(String voterId, String party) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("⚠️ Wi-Fi not connected. Vote saved to local offline memory.");
    return false;
  }

  HTTPClient http;
  http.begin(SERVER_VOTE_URL);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(HTTP_TIMEOUT_MS);

  // Construct JSON payload
  String jsonPayload = "{\"voterID\":\"" + voterId + "\",\"party\":\"" + party + "\"}";
  Serial.print("📤 [HTTP POST -> ");
  Serial.print(SERVER_VOTE_URL);
  Serial.println("]: " + jsonPayload);

  int httpResponseCode = http.POST(jsonPayload);
  String responseBody  = http.getString();
  http.end();

  Serial.print("📥 [Server Response Code]: ");
  Serial.println(httpResponseCode);
  Serial.print("📥 [Server Response Body]: ");
  Serial.println(responseBody);

  if (httpResponseCode == 200) {
    Serial.println("🎉 [SUCCESS] Vote validated and mined onto Ethereum Sepolia blockchain!");
    return true;
  } else if (httpResponseCode == 409) {
    Serial.println("🛑 [FRAUD ALERT] Double voting attempt detected by blockchain smart contract!");
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

// ===============================================================================
// 10. QUERY & DISPLAY ELECTION TALLIES
// ===============================================================================
void fetchAndShowResults() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Election Results");
  lcd.setCursor(0, 1);
  lcd.print("Loading tallies..");

  // Try querying server if connected
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(SERVER_RESULTS_URL);
    http.setTimeout(5000);
    int code = http.GET();
    if (code == 200) {
      String payload = http.getString();
      Serial.println("\n--- LIVE ON-CHAIN ELECTION RESULTS ---");
      Serial.println(payload);
    }
    http.end();
  }

  // Display Local Certified Counts
  Serial.println("\n--- TERMINAL RESULTS SUMMARY ---");
  Serial.printf("Party A (%s): %d\n", PARTY_A_NAME, localVotesA);
  Serial.printf("Party B (%s): %d\n", PARTY_B_NAME, localVotesB);
  Serial.printf("Party C (%s): %d\n", PARTY_C_NAME, localVotesC);
  Serial.printf("Party D (%s): %d\n", PARTY_D_NAME, localVotesD);
  Serial.println("--------------------------------\n");

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("A:"); lcd.print(localVotesA);
  lcd.setCursor(8, 0);
  lcd.print("B:"); lcd.print(localVotesB);

  lcd.setCursor(0, 1);
  lcd.print("C:"); lcd.print(localVotesC);
  lcd.setCursor(8, 1);
  lcd.print("D:"); lcd.print(localVotesD);
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

String getVoterName(int id) {
  // Map Fingerprint IDs to Citizen Names
  if (id == 1) return "Vallabh";
  if (id == 2) return "Rahul";
  if (id == 3) return "Priya";
  if (id == 4) return "Ananya";
  return "Voter #" + String(id);
}

int checkFingerprint() {
  uint8_t p = finger.getImage();
  if (p != FINGERPRINT_OK) return -1;

  p = finger.image2Tz();
  if (p != FINGERPRINT_OK) return -1;

  p = finger.fingerSearch();
  if (p == FINGERPRINT_OK) {
    return finger.fingerID; // Matched ID (1 - 127)
  } else if (p == FINGERPRINT_NOTFOUND) {
    return -2; // Finger detected but template not recognized
  }

  return -1;
}

// Find first free memory slot in R307 sensor
int getNextAvailableID() {
  for (int id = 5; id < MAX_LOCAL_VOTERS; id++) {
    if (finger.loadModel(id) != FINGERPRINT_OK) {
      return id; // Found first unassigned slot
    }
  }
  return 5;
}

// Live Enrollment Mode: Guided 2-step biometric registration
int enrollFingerprint(int id) {
  int p = -1;
  Serial.print("-> Starting registration for New Voter slot #");
  Serial.println(id);

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

  // Step 2: Wait for same finger to confirm minutiae
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

  // Step 3: Create model and save into R307 flash EEPROM
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

  p = finger.storeModel(id);
  if (p == FINGERPRINT_OK) {
    Serial.print("-> SUCCESS: Biometric saved to template slot #");
    Serial.println(id);

    // Reset local voting record so this new voter can vote immediately!
    if (id < MAX_LOCAL_VOTERS) {
      hasVotedLocal[id] = false;
    }

    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Voter #" + String(id) + " Saved!");
    lcd.setCursor(0, 1);
    lcd.print("Ready to Vote ✅");
    soundVoteSecured();
    delay(3000);
    return id;
  } else {
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Flash Storage");
    lcd.setCursor(0, 1);
    lcd.print("Write Failed!");
    soundFraudAlarm();
    delay(2000);
    return -1;
  }
}

// ===============================================================================
// 12. DISTINCT AUDIO TONE ENGINE IMPLEMENTATION
// Works with both Active Buzzers (distinct cadences) & Passive Buzzers (musical pitches)
// ===============================================================================

// 1. Boot Ready: Upbeat 3-step rising chime
void soundBootReady() {
  tone(BUZZER_PIN, 1800, 70); delay(80);
  tone(BUZZER_PIN, 2400, 70); delay(80);
  tone(BUZZER_PIN, 3200, 140); delay(150);
  noTone(BUZZER_PIN);
  digitalWrite(BUZZER_PIN, LOW);
}

// 2. Fingerprint Matched: Cheerful double-pip ("Pip-Pip!")
void soundFingerMatched() {
  tone(BUZZER_PIN, 2500, 60); delay(80);
  tone(BUZZER_PIN, 3100, 90); delay(100);
  noTone(BUZZER_PIN);
  digitalWrite(BUZZER_PIN, LOW);
}

// 3. Fingerprint Rejected / Not in DB: Low dual buzz ("Bzz-Bzz")
void soundFingerRejected() {
  tone(BUZZER_PIN, 600, 160); delay(190);
  tone(BUZZER_PIN, 450, 240); delay(260);
  noTone(BUZZER_PIN);
  digitalWrite(BUZZER_PIN, LOW);
}

// 4. Candidate Party Selected: Quick tactile acknowledgment click
void soundPartySelected() {
  tone(BUZZER_PIN, 2400, 70); delay(80);
  noTone(BUZZER_PIN);
  digitalWrite(BUZZER_PIN, LOW);
}

// 5. Vote Secured & Mined on Blockchain: Celebratory victory fanfare (4 rising notes!)
void soundVoteSecured() {
  tone(BUZZER_PIN, 1800, 70); delay(90);
  tone(BUZZER_PIN, 2200, 70); delay(90);
  tone(BUZZER_PIN, 2800, 90); delay(110);
  tone(BUZZER_PIN, 3600, 260); delay(280);
  noTone(BUZZER_PIN);
  digitalWrite(BUZZER_PIN, LOW);
}

// 6. Vote Recorded Offline: Steady double blip
void soundVoteOffline() {
  tone(BUZZER_PIN, 1600, 100); delay(120);
  tone(BUZZER_PIN, 1600, 100); delay(120);
  noTone(BUZZER_PIN);
  digitalWrite(BUZZER_PIN, LOW);
}

// 7. Fraud Alarm / Already Voted: Urgent rapid siren alarm (Bee-Bop-Bee-Bop-Wail!)
void soundFraudAlarm() {
  for (int i = 0; i < 4; i++) {
    tone(BUZZER_PIN, 3400, 70); delay(80);
    tone(BUZZER_PIN, 1200, 70); delay(80);
  }
  tone(BUZZER_PIN, 800, 400); delay(420);
  noTone(BUZZER_PIN);
  digitalWrite(BUZZER_PIN, LOW);
}

// 8. Session Timeout: Descending 3-step power down
void soundTimeout() {
  tone(BUZZER_PIN, 2400, 90); delay(110);
  tone(BUZZER_PIN, 1700, 90); delay(110);
  tone(BUZZER_PIN, 1000, 220); delay(240);
  noTone(BUZZER_PIN);
  digitalWrite(BUZZER_PIN, LOW);
}

// 9. Tally / Results Button: Dual high blip
void soundTallyClick() {
  tone(BUZZER_PIN, 2600, 50); delay(60);
  tone(BUZZER_PIN, 3200, 60); delay(70);
  noTone(BUZZER_PIN);
  digitalWrite(BUZZER_PIN, LOW);
}

// Legacy wrappers for backward compatibility
void beepShort() {
  soundPartySelected();
}

void beepDouble() {
  soundFingerMatched();
}

void longBeep() {
  soundFraudAlarm();
}