/**
 * ===============================================================================
 * BIOMETRIC BLOCKCHAIN VOTING SYSTEM - ESP32 FIRMWARE
 * ===============================================================================
 * Hardware:
 *   - ESP32 NodeMCU / DevKit
 *   - R307 Optical Fingerprint Sensor (UART Serial2: TX=17, RX=16)
 *   - 16x2 I2C LCD Display (SDA=21, SCL=22)
 *   - 4 Push Buttons for Ballot Selection (GPIO 13, 14, 25, 26)
 *   - 1 Push Button for Certified Results (GPIO 27)
 *   - 1 Active Buzzer for Audio Feedback (GPIO 33)
 *
 * Web3 Blockchain Integration:
 *   - Connects to local Wi-Fi and dispatches verified votes to the Node.js
 *     Web3 Relayer (server.js) at /api/blockchain/vote.
 *   - Node.js converts voterID into an anonymized SHA-256 hash and records
 *     the immutable vote onto the Ethereum Sepolia smart contract.
 *   - If Wi-Fi is unavailable, the firmware gracefully operates in Standalone
 *     Offline Mode.
 * ===============================================================================
 */

#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <Adafruit_Fingerprint.h>
#include <WiFi.h>
#include <HTTPClient.h>

// ===============================================================================
// 1. PIN DEFINITIONS
// ===============================================================================
#define BTN_PARTY_A 13
#define BTN_PARTY_B 14
#define BTN_PARTY_C 25
#define BTN_PARTY_D 26
#define BTN_RESULT  27
#define BUZZER_PIN  33

// Fingerprint Sensor Serial Pins (Hardware Serial 2)
#define FP_RX_PIN 16 // Connect to Sensor TX
#define FP_TX_PIN 17 // Connect to Sensor RX

// ===============================================================================
// 2. NETWORK & SERVER CONFIGURATION
// ===============================================================================
// Replace with your Wi-Fi credentials:
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// IP Address and Port of your Node.js server (server.js)
// NOTE: Set this to the IPv4 address of the computer running 'node server.js'
// Example: "http://10.191.114.167:3000/api/blockchain/vote"
String SERVER_VOTE_URL    = "http://10.191.114.167:3000/api/blockchain/vote";
String SERVER_RESULTS_URL = "http://10.191.114.167:3000/api/blockchain/votes";

// Timeout settings
const unsigned long VOTE_TIMEOUT_MS = 25000; // 25s timeout waiting for party button
const int HTTP_TIMEOUT_MS           = 8000;  // 8s timeout for Web3 blockchain bridge

// ===============================================================================
// 3. HARDWARE & STATE INSTANCES
// ===============================================================================
// LCD Display (Default I2C Address 0x27, 16 columns, 2 rows)
LiquidCrystal_I2C lcd(0x27, 16, 2);

// Hardware Serial 2 for R307 Fingerprint Sensor
HardwareSerial fpSerial(2);
Adafruit_Fingerprint finger = Adafruit_Fingerprint(&fpSerial);

// Candidate party names (matching both UI and blockchain smart contract)
const char* PARTY_A_NAME = "Democracy Forward";
const char* PARTY_B_NAME = "Alliance for Progress";
const char* PARTY_C_NAME = "Liberty Coalition";
const char* PARTY_D_NAME = "Green Earth Party";

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
// 4. FUNCTION DECLARATIONS
// ===============================================================================
void setupWifi();
void promptScan();
String getVoterName(int id);
void takeVote(int id, String name);
int checkFingerprint();
bool broadcastVoteToBlockchain(String voterId, String party);
void fetchAndShowResults();
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

  // 1. Initialize GPIO Pins
  Serial.println("1. Initializing Button Pins & Buzzer...");
  pinMode(BTN_PARTY_A, INPUT_PULLUP);
  pinMode(BTN_PARTY_B, INPUT_PULLUP);
  pinMode(BTN_PARTY_C, INPUT_PULLUP);
  pinMode(BTN_PARTY_D, INPUT_PULLUP);
  pinMode(BTN_RESULT,  INPUT_PULLUP);
  pinMode(BUZZER_PIN,  OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);

  // 2. Initialize I2C Bus and LCD
  Serial.println("2. Initializing 16x2 I2C LCD Display...");
  Wire.begin(21, 22); // Explicit SDA=21, SCL=22 for ESP32
  
  // Compatible LCD initialization for Arduino-LiquidCrystal-I2C library
  lcd.begin();
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
    longBeep();
    while (1) {
      delay(500);
      // Halt if hardware sensor is missing
    }
  }

  beepShort();
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

  // 1. Check if the Result Button is pressed
  if (digitalRead(BTN_RESULT) == LOW) {
    delay(50); // Debounce
    if (digitalRead(BTN_RESULT) == LOW) {
      Serial.println("\n📊 Result inspection button pressed.");
      beepShort();
      fetchAndShowResults();
      while (digitalRead(BTN_RESULT) == LOW) { delay(10); } // Wait for release
      delay(3000);
      promptScan();
    }
  }

  // 2. Poll Optical Fingerprint Sensor
  int fingerStatus = checkFingerprint();

  if (fingerStatus > 0) {
    int voterID = fingerStatus;
    Serial.print("\n👆 Finger Matched! Database Template ID #");
    Serial.println(voterID);

    beepDouble();

    // Local Pre-Flight Check
    if (voterID < MAX_LOCAL_VOTERS && hasVotedLocal[voterID]) {
      Serial.println("🛑 FRAUD REJECTED: User has already cast a ballot!");
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("Fraud Alert!");
      lcd.setCursor(0, 1);
      lcd.print("Already Voted!");
      longBeep();
      delay(2500);
      promptScan();
      return;
    }

    String voterName = getVoterName(voterID);
    Serial.println("-> Authenticated Voter: " + voterName);

    // Display welcome on LCD
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Hi " + voterName.substring(0, 13));
    lcd.setCursor(0, 1);
    lcd.print("Press Party Key");

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
    longBeep();
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

  while (!voteCast) {
    // Check timeout
    if (millis() - startTime > VOTE_TIMEOUT_MS) {
      Serial.println("-> Voting session timed out (No button pressed).");
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("Session Timeout");
      lcd.setCursor(0, 1);
      lcd.print("No Vote Cast");
      longBeep();
      delay(2000);
      promptScan();
      return;
    }

    // Button 1: Party A
    if (digitalRead(BTN_PARTY_A) == LOW) {
      delay(40); // Debounce
      if (digitalRead(BTN_PARTY_A) == LOW) {
        selectedParty = PARTY_A_NAME;
        localVotesA++;
        while (digitalRead(BTN_PARTY_A) == LOW) { delay(10); }
        voteCast = true;
      }
    }
    // Button 2: Party B
    else if (digitalRead(BTN_PARTY_B) == LOW) {
      delay(40);
      if (digitalRead(BTN_PARTY_B) == LOW) {
        selectedParty = PARTY_B_NAME;
        localVotesB++;
        while (digitalRead(BTN_PARTY_B) == LOW) { delay(10); }
        voteCast = true;
      }
    }
    // Button 3: Party C
    else if (digitalRead(BTN_PARTY_C) == LOW) {
      delay(40);
      if (digitalRead(BTN_PARTY_C) == LOW) {
        selectedParty = PARTY_C_NAME;
        localVotesC++;
        while (digitalRead(BTN_PARTY_C) == LOW) { delay(10); }
        voteCast = true;
      }
    }
    // Button 4: Party D
    else if (digitalRead(BTN_PARTY_D) == LOW) {
      delay(40);
      if (digitalRead(BTN_PARTY_D) == LOW) {
        selectedParty = PARTY_D_NAME;
        localVotesD++;
        while (digitalRead(BTN_PARTY_D) == LOW) { delay(10); }
        voteCast = true;
      }
    }

    delay(20);
  }

  Serial.println("-> Button Pressed! Choice: " + selectedParty);
  beepShort();

  // Show "Submitting" on LCD
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Recording Ballot");
  lcd.setCursor(0, 1);
  lcd.print("Broadcasting...");

  // Send to Web3 Blockchain Relayer
  String voterUID = "FP_UID_" + String(id);
  bool chainSuccess = broadcastVoteToBlockchain(voterUID, selectedParty);

  // Mark local cache so voter cannot vote again on this terminal
  if (id < MAX_LOCAL_VOTERS) {
    hasVotedLocal[id] = true;
  }

  // Visual & Audio Confirmation
  lcd.clear();
  if (chainSuccess) {
    lcd.setCursor(0, 0);
    lcd.print("Vote Secured!");
    lcd.setCursor(0, 1);
    lcd.print("Sepolia Minied");
    beepShort();
  } else {
    lcd.setCursor(0, 0);
    lcd.print("Vote Stored");
    lcd.setCursor(0, 1);
    lcd.print("Terminal Cache");
    beepShort();
  }

  delay(2500);
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
  Serial.println("📤 [HTTP POST -> Node.js Relayer]: " + jsonPayload);

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
    longBeep();
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

void beepShort() {
  digitalWrite(BUZZER_PIN, HIGH);
  delay(120);
  digitalWrite(BUZZER_PIN, LOW);
}

void beepDouble() {
  digitalWrite(BUZZER_PIN, HIGH);
  delay(80);
  digitalWrite(BUZZER_PIN, LOW);
  delay(80);
  digitalWrite(BUZZER_PIN, HIGH);
  delay(80);
  digitalWrite(BUZZER_PIN, LOW);
}

void longBeep() {
  digitalWrite(BUZZER_PIN, HIGH);
  delay(900);
  digitalWrite(BUZZER_PIN, LOW);
}