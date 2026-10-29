import os
import sys
os.environ['MPLCONFIGDIR'] = os.path.join(os.path.dirname(__file__), '.mplconfig')
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as patches

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable, Image
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    """
    Two-pass canvas to dynamically compute and draw total page count
    along with running professional engineering headers and footers.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        
        # Suppress running header & footer on cover page (Page 1)
        if self._pageNumber > 1:
            # Running Header
            self.setFont("Helvetica-Bold", 8)
            self.setFillColor(colors.HexColor("#64748b"))
            self.drawString(54, 750, "VOTECHAIN // BIOMETRIC WEB3 VOTING SYSTEM")
            
            self.setFont("Helvetica", 8)
            self.drawRightString(612 - 54, 750, "Complete Technical Specification & External Viva Defense Manual")
            
            self.setStrokeColor(colors.HexColor("#cbd5e1"))
            self.setLineWidth(0.5)
            self.line(54, 742, 612 - 54, 742)
            
            # Running Footer
            self.setStrokeColor(colors.HexColor("#cbd5e1"))
            self.setLineWidth(0.5)
            self.line(54, 50, 612 - 54, 50)
            
            self.setFont("Helvetica", 8)
            self.setFillColor(colors.HexColor("#64748b"))
            self.drawString(54, 38, "Engineering Project Documentation - Core Team & Evaluator Edition")
            
            page_text = f"Page {self._pageNumber} of {page_count}"
            self.drawRightString(612 - 54, 38, page_text)
            
        self.restoreState()

def build_pdf(filename):
    doc = SimpleDocTemplate(
        filename,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=60,
        bottomMargin=60
    )

    styles = getSampleStyleSheet()

    # Premium Palette
    PRIMARY = colors.HexColor("#0f172a")     # Deep Slate
    ACCENT = colors.HexColor("#0284c7")      # Cerulean Blue
    SECONDARY = colors.HexColor("#334155")   # Charcoal
    MUTED = colors.HexColor("#64748b")       # Cool Grey
    LIGHT_BG = colors.HexColor("#f8fafc")    # Off-white / light tint
    CODE_BG = colors.HexColor("#f1f5f9")     # Code background
    SUCCESS = colors.HexColor("#059669")     # Emerald
    WARNING = colors.HexColor("#d97706")     # Amber
    DANGER = colors.HexColor("#dc2626")      # Crimson

    # Typography Styles
    cover_title_style = ParagraphStyle(
        'CoverTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=24,
        leading=30,
        textColor=PRIMARY,
        spaceAfter=10
    )

    cover_subtitle_style = ParagraphStyle(
        'CoverSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=ACCENT,
        spaceAfter=20
    )

    h1_style = ParagraphStyle(
        'Heading1_Custom',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=15,
        leading=19,
        textColor=PRIMARY,
        spaceBefore=16,
        spaceAfter=8,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        'Heading2_Custom',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=11.5,
        leading=15,
        textColor=ACCENT,
        spaceBefore=11,
        spaceAfter=5,
        keepWithNext=True
    )

    h3_style = ParagraphStyle(
        'Heading3_Custom',
        parent=styles['Heading3'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=13,
        textColor=SECONDARY,
        spaceBefore=8,
        spaceAfter=4,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'Body_Custom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13.5,
        textColor=SECONDARY,
        spaceAfter=7
    )

    bullet_style = ParagraphStyle(
        'Bullet_Custom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.8,
        leading=13,
        textColor=SECONDARY,
        leftIndent=14,
        firstLineIndent=-9,
        spaceAfter=3.5
    )

    code_style = ParagraphStyle(
        'Code_Custom',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=7.8,
        leading=10.5,
        textColor=colors.HexColor("#0f172a"),
        backColor=CODE_BG,
        borderPadding=6,
        spaceAfter=6
    )

    callout_style = ParagraphStyle(
        'Callout_Custom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.8,
        leading=13,
        textColor=colors.HexColor("#0369a1"),
        backColor=colors.HexColor("#e0f2fe"),
        borderPadding=7,
        spaceBefore=5,
        spaceAfter=7
    )

    callout_success_style = ParagraphStyle(
        'Callout_Success',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.8,
        leading=13,
        textColor=colors.HexColor("#065f46"),
        backColor=colors.HexColor("#d1fae5"),
        borderPadding=7,
        spaceBefore=5,
        spaceAfter=7
    )

    callout_danger_style = ParagraphStyle(
        'Callout_Danger',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.8,
        leading=13,
        textColor=colors.HexColor("#991b1b"),
        backColor=colors.HexColor("#fee2e2"),
        borderPadding=7,
        spaceBefore=5,
        spaceAfter=7
    )

    story = []

    # =========================================================================
    # COVER PAGE
    # =========================================================================
    story.append(Spacer(1, 25))
    story.append(Paragraph("PROJECT TECHNICAL SPECIFICATION & DEFENSE MANUAL", cover_subtitle_style))
    story.append(Paragraph("VOTECHAIN: Biometric Edge to Blockchain Voting System<br/>From Hardware Sensor to Ethereum Consensus", cover_title_style))
    story.append(HRFlowable(width="100%", thickness=2.5, color=ACCENT, spaceBefore=4, spaceAfter=16))
    
    story.append(Paragraph(
        "This engineering handbook provides a complete, exhaustive breakdown of the entire VOTECHAIN voting system "
        "designed for team members, project evaluators, and system architects. It is organized into <b>five comprehensive parts</b>: "
        "<br/>• <b>Part 1:</b> Components, capabilities, biometric data handling, template creation, and storage isolation."
        "<br/>• <b>Part 2:</b> End-to-end working mechanism, architectural advantages, and real-world engineering limitations."
        "<br/>• <b>Part 3:</b> Detailed data flow, cryptographic SHA-256 pipeline, blockchain result retrieval, EVM vote counting, and resolving the secret ballot vs auditability paradox."
        "<br/>• <b>Part 4:</b> External Presentation Defense & Top 3 Viva Questions (Sensor-to-MongoDB Pipeline, Biometric Matching Engine, and EVM vs VOTECHAIN Comparative Analysis)."
        "<br/>• <b>Part 5:</b> Complete System Flowchart & Exhaustive Decision Logic Matrix (Every Condition, Timeout, Fallback & State Transition).",
        body_style
    ))
    story.append(Spacer(1, 15))

    meta_data = [
        [Paragraph("<b>Target Blockchain:</b>", body_style), Paragraph("Ethereum Sepolia Testnet (Chain ID: 11155111, Shanghai EVM)", body_style)],
        [Paragraph("<b>Smart Contract:</b>", body_style), Paragraph("VotingRegistry.sol (Solidity 0.8.24, Optimized 200 runs)", body_style)],
        [Paragraph("<b>Contract Address:</b>", body_style), Paragraph("0xa899b0F862277c2a8b5566324782Cd189d2c5a3f", body_style)],
        [Paragraph("<b>Relayer Backend Stack:</b>", body_style), Paragraph("Node.js 24 + Express 5 + Ethers.js v6 + Native Crypto", body_style)],
        [Paragraph("<b>Edge Terminal:</b>", body_style), Paragraph("ESP32 Dual-Core DevKit + R307 Optical Sensor + 16x2 I2C LCD", body_style)],
        [Paragraph("<b>Biometric Security:</b>", body_style), Paragraph("Local DSP Minutiae Extraction, Zero Raw Data Transmission", body_style)],
        [Paragraph("<b>Identity Anonymizer:</b>", body_style), Paragraph("One-way Salted SHA-256 Hash + State Mutex Lock", body_style)],
        [Paragraph("<b>Auditability:</b>", body_style), Paragraph("Live Dashboard + Sepolia Etherscan Public Receipts + Block Events", body_style)],
    ]
    meta_table = Table(meta_data, colWidths=[150, 354])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), LIGHT_BG),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#cbd5e1")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#e2e8f0")),
        ('TOPPADDING', (0,0), (-1,-1), 4.5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4.5),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(meta_table)
    
    story.append(Spacer(1, 20))
    story.append(Paragraph(
        "<b>Core Architectural Principle:</b> <i>Decentralized immutability at the consensus layer, strict cryptographic privacy at the relayer layer, and zero biological exposure at the edge hardware layer.</i>",
        callout_style
    ))
    story.append(PageBreak())

    # =========================================================================
    # PART 1: COMPONENTS, CAPABILITIES & DATA STORAGE
    # =========================================================================
    story.append(Paragraph("PART 1: Components, Capabilities & Hardware Data Handling", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=ACCENT, spaceBefore=2, spaceAfter=10))

    story.append(Paragraph(
        "The project combines physical edge hardware, embedded microcode, cryptographic relayer middleware, "
        "and a decentralized smart contract. Below is the detailed breakdown of every component, its exact technical role, "
        "and how fingerprint data is acquired, converted, and preserved.",
        body_style
    ))

    story.append(Paragraph("1.1 Complete Hardware Component Breakdown", h2_style))

    hw_comp_data = [
        [Paragraph("<b>Component</b>", body_style), Paragraph("<b>Key Specifications & Capabilities</b>", body_style), Paragraph("<b>Role in VOTECHAIN Project</b>", body_style)],
        [
            Paragraph("<b>ESP32 Microcontroller</b><br/>(38-Pin DevKit)", body_style),
            Paragraph("• Dual-Core 32-bit Xtensa LX6 @ 240 MHz<br/>• 520 KB SRAM, 4 MB Flash memory<br/>• 802.11 b/g/n Wi-Fi + Bluetooth 4.2 BLE<br/>• Hardware Timers, Dual UART (Serial0, Serial2)<br/>• Dedicated I2C Controller (GPIO 21, 22)", body_style),
            Paragraph("Acts as the edge terminal brain. Reads biometric matches from R307 via UART, renders voter feedback onto LCD, debounces capacitive touch inputs, manages network failover, and sends HTTP POST JSON requests to Web3 relayer.", body_style)
        ],
        [
            Paragraph("<b>R307 Optical Fingerprint Sensor</b>", body_style),
            Paragraph("• High-resolution optical prism with blue LED<br/>• Integrated DSP image processing chip (AS608)<br/>• Resolution: 500 DPI, Scan speed: &lt; 0.3s<br/>• False Acceptance Rate (FAR): &lt; 0.001%<br/>• False Rejection Rate (FRR): &lt; 0.1%<br/>• Onboard Flash storage (up to 128-1000 templates)<br/>• TTL Serial UART interface (57600 baud)", body_style),
            Paragraph("Captures live biometric ridge patterns, extracts mathematical minutiae feature vectors, performs local 1:N database searching, and stores templates securely in its internal EEPROM. It completely isolates biometric data inside the sensor.", body_style)
        ],
        [
            Paragraph("<b>16x2 I2C LCD Display</b><br/>(PCF8574 Backpack)", body_style),
            Paragraph("• 16 characters x 2 lines alphanumeric display<br/>• HD44780 parallel controller with PCF8574 I2C adapter<br/>• Operates on 2 wires: SDA (GPIO 21) & SCL (GPIO 22)<br/>• Contrast adjustment pot & software backlight control", body_style),
            Paragraph("Provides clear real-time user guidance: 'Scan Finger...', greetings ('Hi Vallabh'), candidate ballot prompts ('1:BJP 2:UBT'), voting feedback ('Sepolia Mined'), fraud alerts, and certified live tally displays.", body_style)
        ],
        [
            Paragraph("<b>Capacitive Touch / Push Buttons</b>", body_style),
            Paragraph("• 4 Ballot Selection Inputs (GPIO 13, 14, 25, 26)<br/>• 1 Result / Tally Query Input (GPIO 27)<br/>• 1 Enrollment Button (GPIO 32)<br/>• Software debouncing (40-50ms) + internal pull-down", body_style),
            Paragraph("Enables physical voter interaction. Ballot keys register candidate selection. Result key requires a 2-press confirmation window (3.5s) to prevent accidental tally disclosure. Enroll button enters 2-step registration.", body_style)
        ],
        [
            Paragraph("<b>Active Piezo Buzzer</b><br/>(GPIO 33)", body_style),
            Paragraph("• Frequency-modulated acoustic transducer<br/>• High decibel output @ 3.3V/5V logic", body_style),
            Paragraph("Provides distinct acoustic feedback signatures: single high chime on valid scan, double beep on candidate selection, multi-tone fanfare on blockchain confirmation, and rapid low alarm on fraud or mismatch.", body_style)
        ],
    ]
    hw_table = Table(hw_comp_data, colWidths=[120, 194, 190])
    hw_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), PRIMARY),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#cbd5e1")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#e2e8f0")),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(hw_table)

    story.append(Spacer(1, 8))
    story.append(Paragraph("1.2 How Fingerprint Data is Passed, Processed, and Stored", h2_style))
    story.append(Paragraph(
        "A critical question in biometric systems is: <b>Does the voter's raw fingerprint image or biological minutiae ever get transmitted across the network or saved to the blockchain?</b> "
        "<br/><b>The absolute answer is NO.</b> The architecture strictly enforces edge biometric isolation:",
        body_style
    ))

    story.append(Paragraph(
        "<b>Phase A: Biometric Enrollment (Saving New Voter Template):</b><br/>"
        "1. <b>Image Acquisition:</b> The voter places a finger on the R307 glass prism. The sensor executes <code>finger.getImage()</code>, illuminating the ridge-and-valley patterns with internal LEDs and capturing an optical image in the sensor's internal RAM.<br/>"
        "2. <b>Minutiae Extraction 1:</b> The sensor's onboard DSP chip runs mathematical algorithms (ridge thinning, binarization, bifurcation and ridge ending detection) via <code>finger.image2Tz(1)</code>, generating a compact 512-byte feature character file in Buffer 1.<br/>"
        "3. <b>Confirmation Scan:</b> The user lifts and re-applies the same finger. The sensor captures a second image and extracts feature file Buffer 2 via <code>finger.image2Tz(2)</code>.<br/>"
        "4. <b>Model Creation:</b> The DSP compares Buffer 1 and Buffer 2 using <code>finger.createModel()</code>. If both feature sets match, it fuses them into a certified mathematical template.<br/>"
        "5. <b>Internal Flash Storage:</b> The fused template is stored in the R307's secure onboard EEPROM memory slot using <code>finger.storeModel(id)</code> (e.g., Slot #1, #2, etc.). <b>The raw image is immediately destroyed from sensor RAM.</b>",
        bullet_style
    ))

    story.append(Paragraph(
        "<b>Phase B: Voter Verification at the Voting Booth (Passing the Data):</b><br/>"
        "1. When a citizen places their finger on the sensor during election mode, <code>finger.getImage()</code> captures the surface pattern, and <code>finger.image2Tz()</code> creates a temporary search template.<br/>"
        "2. The sensor performs a local 1:N search inside its own hardware EEPROM using <code>finger.fingerSearch()</code>. It compares the temporary template against all enrolled templates.<br/>"
        "3. <b>Data Passed to ESP32:</b> If a match is found, the sensor sends <b>ONLY an integer Template ID</b> (e.g. <code>1</code>) over UART Serial2. It does NOT send any image, coordinates, or minutiae data!<br/>"
        "4. <b>Data Passed to Relayer Server:</b> The ESP32 formats an abstract string identifier: <code>\"voterID\": \"FP_UID_1\"</code>. This string contains zero biometric information. It is simply a token indicating that physical biometric verification was successfully completed at the hardware terminal.",
        bullet_style
    ))

    story.append(Paragraph(
        "<b>Biometric Privacy Guarantee:</b> Even if an attacker physically intercepts the Wi-Fi packets between the ESP32 and the server, "
        "or reads the entire Ethereum blockchain, they will NEVER acquire any biometric data. Fingerprint templates remain locked inside "
        "the physical flash memory of the R307 sensor.",
        callout_success_style
    ))

    story.append(Spacer(1, 6))
    story.append(Paragraph("1.3 Software & Blockchain Component Architecture", h2_style))

    sw_comp_data = [
        [Paragraph("<b>Component</b>", body_style), Paragraph("<b>Tech Stack</b>", body_style), Paragraph("<b>Core Capabilities & Functionality</b>", body_style)],
        [
            Paragraph("<b>Web3 Relayer Backend</b><br/>(<code>server.js</code>)", body_style),
            Paragraph("Node.js 24 (ESM)<br/>Express 5<br/>Ethers.js v6<br/>Native Crypto", body_style),
            Paragraph("• Ingests JSON voting ballots from edge terminals.<br/>• Salted SHA-256 cryptographic voter anonymization.<br/>• Zero-Gas Pre-Flight fraud check via static EVM calls.<br/>• FIFO Mutex Transaction Queue to eliminate nonce race conditions.<br/>• Auto-sensing engine (seamless live EVM vs high-fidelity simulation).", body_style)
        ],
        [
            Paragraph("<b>Smart Contract</b><br/>(<code>VotingRegistry.sol</code>)", body_style),
            Paragraph("Solidity 0.8.24<br/>EVM Shanghai<br/>Hardhat Framework", body_style),
            Paragraph("• Deployed on Ethereum Sepolia testnet.<br/>• Enforces single-vote rule: <code>mapping(string => bool) hasVoted</code>.<br/>• Maintains certified party tallies: <code>mapping(string => uint256) partyVotes</code>.<br/>• Tracks global votes counter and dynamic active party array.<br/>• Emits permanent on-chain event: <code>VoteSecured(voterHash, party, timestamp)</code>.", body_style)
        ],
        [
            Paragraph("<b>Sovereign Web Dashboard</b><br/>(<code>public/</code>)", body_style),
            Paragraph("HTML5 / CSS3<br/>Vanilla JS (ES6)<br/>Chart.js Engine", body_style),
            Paragraph("• Real-time glassmorphism visualization of election results.<br/>• Live party vote bar charts, turnout metrics, and winner announcements.<br/>• Public transaction audit ledger with direct Etherscan explorer hyperlinks.<br/>• Health telemetry: Sepolia block height, RPC latency, relayer wallet balance.", body_style)
        ],
    ]
    sw_table = Table(sw_comp_data, colWidths=[120, 100, 284])
    sw_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), PRIMARY),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#cbd5e1")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#e2e8f0")),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(sw_table)

    story.append(PageBreak())

    # =========================================================================
    # PART 2: WORKING OF THE PROJECT, ADVANTAGES & DISADVANTAGES
    # =========================================================================
    story.append(Paragraph("PART 2: Working Mechanism, Advantages & Engineering Trade-offs", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=ACCENT, spaceBefore=2, spaceAfter=10))

    story.append(Paragraph("2.1 End-to-End Operational Lifecycle", h2_style))
    story.append(Paragraph(
        "The system operates across three synchronized phases: Voter Enrollment, Ballot Casting & Consensus Verification, and Election Conclusion & Tally Showcase.",
        body_style
    ))

    lifecycle_data = [
        [Paragraph("<b>Step</b>", body_style), Paragraph("<b>Sub-System</b>", body_style), Paragraph("<b>Operational Action & Event Logic</b>", body_style)],
        [
            Paragraph("<b>1. Registration</b>", body_style),
            Paragraph("ESP32 + R307", body_style),
            Paragraph("Admin presses GPIO 32. Terminal prompts citizen to place finger twice. R307 extracts minutiae, fuses them into a template, and stores it in EEPROM slot #N. No network communication is needed.", body_style)
        ],
        [
            Paragraph("<b>2. Authentication</b>", body_style),
            Paragraph("Edge Terminal", body_style),
            Paragraph("Citizen places finger on scanner. R307 identifies Template ID (e.g. #1). ESP32 checks local cache <code>hasVotedLocal[1]</code>. If clean, LCD greets citizen ('Hi Vallabh') and enables ballot touch keys.", body_style)
        ],
        [
            Paragraph("<b>3. Choice Selection</b>", body_style),
            Paragraph("Capacitive Keys", body_style),
            Paragraph("Citizen touches candidate key (e.g. GPIO 13 -> BJP). LCD explicitly reflects selection: <code>YOU VOTED FOR: >> BJP</code> for 2 seconds. ESP32 triggers selection tone and enters broadcast mode.", body_style)
        ],
        [
            Paragraph("<b>4. Cryptographic Relay</b>", body_style),
            Paragraph("Node.js Server", body_style),
            Paragraph("ESP32 sends HTTP POST with <code>voterID: FP_UID_1</code> and <code>party: BJP</code>. Server combines ID with election salt and computes SHA-256 hash. Queries contract <code>hasVoted(hash)</code> via free RPC static call.", body_style)
        ],
        [
            Paragraph("<b>5. Blockchain Mining</b>", body_style),
            Paragraph("Sepolia EVM", body_style),
            Paragraph("Server passes task to FIFO Queue. Relayer signs ECDSA transaction calling <code>castVote(voterHash, party)</code>. Smart contract updates <code>hasVoted = true</code>, increments party vote count, and emits <code>VoteSecured</code> event.", body_style)
        ],
        [
            Paragraph("<b>6. Terminal Confirmation</b>", body_style),
            Paragraph("ESP32 LCD + Buzzer", body_style),
            Paragraph("Server returns HTTP 200 with txHash. ESP32 sounds victory fanfare, displays <code>Vote: BJP / Sepolia Mined</code>, displays <code>THANK YOU FOR VOTING</code> for 3s, sets local lock, and resets for next voter.", body_style)
        ],
        [
            Paragraph("<b>7. Result Showcase</b>", body_style),
            Paragraph("Result Key / Web UI", body_style),
            Paragraph("Presiding officer double-presses GPIO 27. ESP32 queries <code>/api/blockchain/votes</code>, receives official smart contract tallies, cycles through candidate votes on LCD, and declares the election winner.", body_style)
        ],
    ]
    lifecycle_table = Table(lifecycle_data, colWidths=[90, 100, 314])
    lifecycle_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), PRIMARY),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#cbd5e1")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#e2e8f0")),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(lifecycle_table)

    story.append(Spacer(1, 10))
    story.append(Paragraph("2.2 Comprehensive Advantages of VOTECHAIN", h2_style))

    story.append(Paragraph(
        "<b>1. Total Electoral Immutability & Tamper Resistance:</b> Traditional electronic voting machines (EVMs) and centralized SQL databases "
        "can be altered by rogue election administrators, database administrators, or malicious firmware modifications. Once a ballot is mined "
        "into the Ethereum Sepolia blockchain, altering the tally would require reversing the proof-of-stake cryptographic consensus of thousands "
        "of global validator nodes. It is mathematically impossible to delete, modify, or inject votes after block confirmation.",
        bullet_style
    ))
    story.append(Paragraph(
        "<b>2. Absolute Sybil Resistance & Double-Voting Elimination:</b> Physical biometric authentication guarantees that 1 physical human corresponds "
        "to exactly 1 template. Simultaneously, the smart contract's state mapping <code>require(!hasVoted[voterHash])</code> guarantees that "
        "the corresponding cryptographic identity can only be processed once. Even if a voter visits multiple voting terminals or attempts to hack the API, "
        "the EVM immediately reverts any duplicate submission.",
        bullet_style
    ))
    story.append(Paragraph(
        "<b>3. Zero Biometric Exposure (Hardware-Level Air-Gap):</b> Unlike webcams or mobile biometric apps where facial/fingerprint scans travel across "
        "the internet, the R307 sensor performs feature extraction and template comparison strictly within its own onboard DSP silicon. The outside world "
        "only ever sees an abstract identifier, preserving citizen privacy under international data protection standards (GDPR / ISO 27001).",
        bullet_style
    ))
    story.append(Paragraph(
        "<b>4. Zero-Gas Pre-Flight Fraud Protection:</b> In standard blockchain applications, submitting a failing transaction still consumes network gas fees. "
        "VOTECHAIN executes a free, static read-only call (<code>contract.hasVoted(voterHash)</code>) before constructing the transaction. Duplicate votes "
        "are intercepted at the middleware layer in 15 milliseconds, halting fraud without burning a single Wei of network gas.",
        bullet_style
    ))
    story.append(Paragraph(
        "<b>5. Public Transparency & Universal Verifiability:</b> In conventional elections, citizens must blind-trust official counting bodies. "
        "In VOTECHAIN, every vote generates an immutable transaction receipt on Etherscan with an exact block number and timestamp. Any citizen, journalist, "
        "or competing political candidate can run an independent script or inspect the open-source smart contract to audit the entire election.",
        bullet_style
    ))
    story.append(Paragraph(
        "<b>6. Hybrid Resilience (Online + Standalone Failover):</b> If a remote polling station experiences temporary Wi-Fi or broadband failure, "
        "the ESP32 firmware does not freeze or halt voting. It automatically transitions into offline standalone mode, logs votes into local volatile memory, "
        "and keeps the election running until connectivity is restored.",
        bullet_style
    ))

    story.append(Spacer(1, 8))
    story.append(Paragraph("2.3 Disadvantages, Limitations & Engineering Challenges", h2_style))

    story.append(Paragraph(
        "While VOTECHAIN provides cryptographic security, deploying blockchain voting in real-world large-scale environments introduces specific limitations:",
        body_style
    ))

    disadv_data = [
        [Paragraph("<b>Limitation / Challenge</b>", body_style), Paragraph("<b>Technical Root Cause</b>", body_style), Paragraph("<b>Real-World Impact & Mitigation Strategy</b>", body_style)],
        [
            Paragraph("<b>Transaction Latency & Throughput (TPS)</b>", body_style),
            Paragraph("Ethereum Sepolia (and Ethereum Mainnet) has a block interval of ~12-15 seconds. Smart contract transaction execution is bounded by network gas limits.", body_style),
            Paragraph("In a national election with millions of simultaneous voters, Layer 1 Ethereum would experience transaction congestion and long confirmation queues.<br/><b>Mitigation:</b> Deploy on high-throughput Layer 2 zk-Rollups or Optimistic Rollups (e.g., Arbitrum, Optimism, Base, Polygon) achieving 2,000+ TPS with sub-second finality.", body_style)
        ],
        [
            Paragraph("<b>Gas Fee Volatility</b>", body_style),
            Paragraph("Every state modification (<code>hasVoted = true</code>, <code>partyVotes += 1</code>) costs ~45,000 to 65,000 EVM gas units, payable in ETH.", body_style),
            Paragraph("Fluctuating crypto market prices can make voting expensive if paid on public mainnets.<br/><b>Mitigation:</b> In national elections, a sovereign consortium chain (private Proof-of-Authority EVM) or government-sponsored fee subsidy (Account Abstraction ERC-4337 Paymaster) eliminates voter cost.", body_style)
        ],
        [
            Paragraph("<b>Relayer Key Centralization</b>", body_style),
            Paragraph("The smart contract restricts vote casting to <code>onlyAdmin</code> (the backend relayer wallet) to pay gas on behalf of voters and prevent spam.", body_style),
            Paragraph("If the server private key is compromised, an attacker could attempt unauthorized contract calls (though still bounded by unique hashes).<br/><b>Mitigation:</b> Utilize Multi-Party Computation (MPC), Hardware Security Modules (AWS CloudHSM), or Multi-Signature Governance (Gnosis Safe).", body_style)
        ],
        [
            Paragraph("<b>Biometric Edge Physical Errors (FRR)</b>", body_style),
            Paragraph("Optical sensors (R307) depend on light refraction through glass. Dirty, wet, damaged, or aged fingers can lead to False Rejection (FRR).", body_style),
            Paragraph("Elderly citizens or manual laborers may experience recognition failure.<br/><b>Mitigation:</b> Pair optical sensor with secondary capacitive or multi-spectral scanners and biometric multi-finger enrollment.", body_style)
        ],
        [
            Paragraph("<b>Edge Sensor Flash Capacity</b>", body_style),
            Paragraph("The onboard EEPROM memory of standard optical sensors accommodates 128 to 1,000 templates per physical module.", body_style),
            Paragraph("Single polling booths cannot hold an entire city's population inside one sensor.<br/><b>Mitigation:</b> In enterprise rollouts, store encrypted minutiae templates on secure local precinct edge servers or smart-card citizen IDs, comparing minutiae on-demand.", body_style)
        ],
    ]
    disadv_table = Table(disadv_data, colWidths=[110, 160, 234])
    disadv_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), PRIMARY),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#cbd5e1")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#e2e8f0")),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(disadv_table)

    story.append(PageBreak())

    # =========================================================================
    # PART 3: DATA FLOW, CRYPTOGRAPHY, VOTE COUNTING & AUDITING
    # =========================================================================
    story.append(Paragraph("PART 3: Data Flow, Cryptographic Pipeline, Counting & Privacy", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=ACCENT, spaceBefore=2, spaceAfter=10))

    story.append(Paragraph(
        "This section details the microscopic end-to-end data pipeline: exactly what data floats from the optical sensor to the ESP32, "
        "what transforms at the Node.js cryptographic engine, what commits to the Ethereum Sepolia ledger, how data returns during result counting, "
        "and how mathematical proofs resolve the fundamental question: <i>How does the system prove a vote was counted without revealing who voted for whom?</i>",
        body_style
    ))

    story.append(Paragraph("3.1 Complete End-to-End Data Flow Pipeline (Sensor to Blockchain)", h2_style))

    story.append(Paragraph(
        "<b>Stage 1: Physical Ridge Pattern to Sensor RAM</b><br/>"
        "• <i>Data Floating:</i> Infrared/Optical photons reflected from citizen's finger ridges into CMOS sensor.<br/>"
        "• <i>Transformation:</i> Optical sensor converts light into an internal 256x288 pixel grayscale bitmap inside the R307 image buffer.<br/>"
        "• <i>DSP Processing:</i> AS608 DSP executes Gabor filtering and thinning to locate minutiae points (ridge bifurcations and endings), compiling a 512-byte temporary feature vector.",
        bullet_style
    ))

    story.append(Paragraph(
        "<b>Stage 2: Sensor to ESP32 (UART Bus @ 57600 baud)</b><br/>"
        "• <i>Data Floating:</i> Hex packet over Serial2 (GPIO 16/17): <code>EF 01 FF FF FF FF 07 00 07 00 00 01 ...</code><br/>"
        "• <i>Extracted Value:</i> The R307 transmits confirmation code <code>FINGERPRINT_OK</code> and <code>fingerID = 1</code>.<br/>"
        "• <i>ESP32 Assembly:</i> ESP32 maps <code>ID 1</code> to registered string <code>FP_UID_1</code>. When the citizen presses Touch Key A, it binds <code>party = \"BJP\"</code>.",
        bullet_style
    ))

    story.append(Paragraph(
        "<b>Stage 3: ESP32 to Node.js Relayer (Wi-Fi HTTP REST)</b><br/>"
        "• <i>Channel:</i> Local Wi-Fi (WPA2) via TCP/IP socket connection to port 3000.<br/>"
        "• <i>Payload Floating:</i> Unencrypted JSON payload:<br/>"
        "&nbsp;&nbsp;<code>POST /api/blockchain/vote HTTP/1.1</code><br/>"
        "&nbsp;&nbsp;<code>{\"voterID\": \"FP_UID_1\", \"party\": \"BJP\"}</code>",
        bullet_style
    ))

    story.append(Paragraph(
        "<b>Stage 4: Node.js Cryptographic Engine (Identity Anonymization)</b><br/>"
        "• <i>Operation:</i> The server retrieves the private election salt: <code>VOTER_HASH_SALT = \"Election2026_Round1\"</code>.<br/>"
        "• <i>Hashing Function:</i> <code>voterHash = crypto.createHash('sha256').update('FP_UID_1_Election2026_Round1').digest('hex')</code><br/>"
        "• <i>Resulting Hash:</i> <code>7aa8e8e090d14ca31f6232023b5899fd975aaf80cf3448d315a9c4d4104288fb</code><br/>"
        "• <i>Key Insight:</i> From this exact point onward, <code>FP_UID_1</code> is discarded. Only the 64-character hex hash exists.",
        bullet_style
    ))

    story.append(Paragraph(
        "<b>Stage 5: Pre-Flight Static RPC Inspection (Zero-Gas Fraud Verification)</b><br/>"
        "• <i>RPC Call:</i> <code>eth_call</code> targeting <code>hasVoted(\"7aa8e8...\")</code>.<br/>"
        "• <i>If true:</i> The transaction immediately aborts. Server returns <code>HTTP 409 Conflict (Fraud Alert)</code> to ESP32.<br/>"
        "• <i>If false:</i> The ballot passes to the sequential FIFO Mutex queue to receive an orderly EVM nonce.",
        bullet_style
    ))

    story.append(Paragraph(
        "<b>Stage 6: Relayer to Ethereum Sepolia Network (ECDSA Signed Transaction)</b><br/>"
        "• <i>Data Floating:</i> RLP-encoded, secp256k1 signed raw transaction broadcast via JSON-RPC <code>eth_sendRawTransaction</code>.<br/>"
        "• <i>EVM Calldata:</i> Function selector <code>0x4b786c62</code> (castVote) + ABI-encoded string parameters <code>(voterHash, \"BJP\")</code>.<br/>"
        "• <i>Consensus Execution:</i> Sepolia validators execute bytecode on Shanghai EVM, store <code>hasVoted[voterHash] = true</code>, update <code>partyVotes[\"BJP\"] += 1</code>, and write event <code>VoteSecured</code> to block receipts.",
        bullet_style
    ))

    story.append(Paragraph(
        "<b>Stage 7: Blockchain Confirmation Returning to Edge Terminal & UI</b><br/>"
        "• <i>RPC Response:</i> Validator returns transaction receipt: <code>txHash: 0x66f36b..., blockNumber: 11935637, gasUsed: 48219</code>.<br/>"
        "• <i>Server Response:</i> HTTP 200 JSON with <code>{ success: true, voterHash, party, blockNumber, transactionHash, etherscanLink }</code>.<br/>"
        "• <i>LCD Render:</i> ESP32 displays <code>Vote: BJP / Sepolia Mined</code> and sounds celebration chime.",
        bullet_style
    ))

    story.append(Spacer(1, 8))
    story.append(Paragraph("3.2 How Data Returns from the Blockchain During Result Showcasing", h2_style))
    story.append(Paragraph(
        "When an election official triggers the Result button (double-press GPIO 27) on the ESP32 terminal or when a citizen visits the Live Web Dashboard, "
        "how does data return from the blockchain? How are votes actually counted?",
        body_style
    ))

    story.append(Paragraph(
        "<b>1. Triggering the Tally Request:</b><br/>"
        "The client dispatches an HTTP GET request to <code>/api/blockchain/votes</code>.",
        bullet_style
    ))
    story.append(Paragraph(
        "<b>2. Querying the Smart Contract State Trie via JSON-RPC:</b><br/>"
        "The Node.js server does NOT read from a mutable local SQL database. Instead, it queries the Ethereum Sepolia node using read-only EVM calls:<br/>"
        "• <code>contract.partyVotes(\"BJP\")</code> &nbsp;&nbsp;-> returns <code>uint256</code> count from storage slot.<br/>"
        "• <code>contract.partyVotes(\"UBT\")</code> &nbsp;&nbsp;-> returns <code>uint256</code> count.<br/>"
        "• <code>contract.partyVotes(\"Congress\")</code> -> returns <code>uint256</code> count.<br/>"
        "• <code>contract.partyVotes(\"AIMIM\")</code> &nbsp;-> returns <code>uint256</code> count.<br/>"
        "• <code>contract.totalVotes()</code> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;-> returns aggregate ballots cast.",
        bullet_style
    ))
    story.append(Paragraph(
        "<b>3. The EVM Read Query Characteristics:</b><br/>"
        "• <b>Zero Gas Cost:</b> These calls execute locally on the RPC node via the EVM <code>eth_call</code> opcode. They read directly from the state storage trie without creating a transaction or spending any gas.<br/>"
        "• <b>Cryptographic Proof:</b> The values returned are derived from the <b>State Root Hash</b> in the latest Ethereum block header, backed by Merkle Patricia Patricia Trie cryptographic proofs.",
        bullet_style
    ))
    story.append(Paragraph(
        "<b>4. Returning JSON to Edge Terminal:</b><br/>"
        "The server returns: <code>{\"success\": true, \"totalVotes\": 14, \"parties\": {\"BJP\": 7, \"UBT\": 4, \"Congress\": 2, \"AIMIM\": 1}}</code>.<br/>"
        "The ESP32 parses this JSON stream, iterates through the tallies, renders candidate scores on the 16x2 LCD (A:7 B:4 / C:2 D:1), calculates the maximum tally, and displays: <code>WINNER: BJP / Total:14 Final</code>.",
        bullet_style
    ))

    story.append(PageBreak())

    story.append(Paragraph("3.3 How Anyone Independently Confirms & Audits Blockchain Results", h2_style))
    story.append(Paragraph(
        "Because the blockchain is a public, open-access distributed ledger, neither the election commission nor the server administrators "
        "can manipulate or falsify the outcome. Anyone in the world can independently audit and verify the results using two distinct methods:",
        body_style
    ))

    audit_data = [
        [Paragraph("<b>Audit Method</b>", body_style), Paragraph("<b>How It Works in VOTECHAIN</b>", body_style), Paragraph("<b>Verification Guarantee</b>", body_style)],
        [
            Paragraph("<b>Method 1: Direct State Inspection</b><br/>(Etherscan / Web3 CLI)", body_style),
            Paragraph("Any person opens Etherscan for Sepolia: <code>https://sepolia.etherscan.io/address/0xa899b0F862277c2a8b5566324782Cd189d2c5a3f#readContract</code>.<br/>They invoke <code>partyVotes('BJP')</code> or <code>totalVotes()</code> directly in their browser.", body_style),
            Paragraph("Returns the exact, certified tally directly from the decentralized network without touching our server.", body_style)
        ],
        [
            Paragraph("<b>Method 2: Event Log Reconstruction</b><br/>(Full Mathematical Replay)", body_style),
            Paragraph("The contract emits <code>event VoteSecured(string voterHash, string party, uint256 timestamp)</code> on every ballot.<br/>An auditor runs a script querying all historical event logs from deployment block to the current block: <code>contract.queryFilter('VoteSecured')</code>.", body_style),
            Paragraph("The auditor counts the emitted events for each party. Because Ethereum transaction event logs are permanently hashed into the block's Bloom filter and receipt trie, the sum of event logs must equal <code>partyVotes</code> with 100% mathematical precision.", body_style)
        ],
        [
            Paragraph("<b>Method 3: Voter Receipt Lookup</b><br/>(Individual Verification)", body_style),
            Paragraph("A citizen checks the transaction hash given on their receipt on Etherscan.<br/>They see the exact block number, gas used, timestamp, and their anonymized <code>voterHash</code> recorded permanently.", body_style),
            Paragraph("Proves beyond doubt that their specific ballot was included in the certified tally.", body_style)
        ],
    ]
    audit_table = Table(audit_data, colWidths=[120, 204, 180])
    audit_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), PRIMARY),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#cbd5e1")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#e2e8f0")),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(audit_table)

    story.append(Spacer(1, 10))
    story.append(Paragraph("3.4 Resolving the Core Paradox: How Hash Guarantees Immutability Without Exposing Voter Choice", h2_style))
    story.append(Paragraph(
        "A critical question often asked during project evaluations is: <br/>"
        "<i>'As the blockchain is immutable, how will the hash give us info of whom any person voted? Does the hash reveal who voted for whom?'</i>",
        callout_style
    ))

    story.append(Paragraph(
        "To properly explain this to your group members and evaluators, you must address <b>The Secret Ballot Principle vs The Public Auditability Invariant</b>:",
        body_style
    ))

    story.append(Paragraph(
        "<b>1. The Democratic Secret Ballot Rule:</b><br/>"
        "In any legitimate democratic voting system, <b>it is an illegal security violation for the public or an employer or an official to find out which candidate a specific physical person voted for</b>. "
        "If a blockchain system allowed anyone to take 'Vallabh's name or fingerprint' and inspect the ledger to see 'Vallabh voted for BJP', it would enable voter coercion, vote buying, and political retaliation. "
        "Therefore, the system is intentionally architected to decouple physical identity from candidate choice.",
        bullet_style
    ))

    story.append(Paragraph(
        "<b>2. Why the SHA-256 Hash is One-Way (Irreversible):</b><br/>"
        "The voter hash is calculated as: <code>SHA-256(voterID + secret_salt)</code>.<br/>"
        "• A cryptographic hash function is a <b>one-way mathematical trapdoor</b>. It is computationally infeasible to invert a SHA-256 hash back into the original input string.<br/>"
        "• Even if someone has access to all registered voter IDs, the private server salt (<code>VOTER_HASH_SALT</code>) prevents dictionary and rainbow-table attacks. An outside observer seeing hash <code>7aa8e8...</code> on Etherscan has zero mathematical ability to discover which citizen cast it.",
        bullet_style
    ))

    story.append(Paragraph(
        "<b>3. What the Hash Actually Proves on the Blockchain:</b><br/>"
        "The hash serves three vital cryptographic roles without compromising ballot privacy:<br/>"
        "• <b>Single-Vote Enforcement:</b> The smart contract maintains <code>mapping(string => bool) public hasVoted</code>. The moment <code>7aa8e8...</code> submits a vote, the contract sets <code>hasVoted[7aa8e8...] = true</code>. If that same person attempts to scan their finger again, the contract halts the transaction because the hash already exists. <b>It proves the person voted, without revealing who they are.</b><br/>"
        "• <b>Independent Voter Inclusion Verification (Cast-as-Intended Proof):</b> The voter is given their transaction receipt (or hash). The voter can query <code>hasVoted(myHash)</code> on Etherscan to verify with 100% certainty: <i>'Yes, my vote was permanently included in the blockchain tally.'</i><br/>"
        "• <b>Decoupled State Tallies:</b> In the smart contract, <code>partyVotes[party]</code> is an aggregate counter incremented anonymously. The public ledger records the total certified votes for each party while preserving the voter's constitutional right to a private, confidential ballot.",
        bullet_style
    ))

    story.append(Spacer(1, 10))
    story.append(Paragraph("3.5 Summary Architecture Reference Card", h2_style))

    summary_data = [
        [Paragraph("<b>Step / Layer</b>", body_style), Paragraph("<b>Data State</b>", body_style), Paragraph("<b>Security / Privacy Guarantee</b>", body_style)],
        [Paragraph("Edge Sensor (R307)", body_style), Paragraph("Biometric Minutiae Template (Local EEPROM)", body_style), Paragraph("Raw image never leaves sensor hardware. Zero network exposure.", body_style)],
        [Paragraph("Microcontroller (ESP32)", body_style), Paragraph("Abstract Token: <code>FP_UID_1</code> + Party: <code>BJP</code>", body_style), Paragraph("No biological data. Debounced button inputs and session timeouts.", body_style)],
        [Paragraph("Relayer Middleware", body_style), Paragraph("Salted SHA-256 Hash: <code>7aa8e8...</code>", body_style), Paragraph("Mathematical one-way irreversible transformation. Nonce mutex queue.", body_style)],
        [Paragraph("Sepolia Blockchain", body_style), Paragraph("<code>hasVoted[hash] = true</code>, <code>partyVotes['BJP'] += 1</code>", body_style), Paragraph("100% immutable decentralized consensus. Single-vote rule enforced.", body_style)],
        [Paragraph("Auditor / Observer", body_style), Paragraph("Block Explorer Receipts & Event Logs", body_style), Paragraph("Universal public verification without compromising ballot secrecy.", body_style)],
    ]
    summary_table = Table(summary_data, colWidths=[120, 194, 190])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), PRIMARY),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#cbd5e1")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#e2e8f0")),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(summary_table)

    # =========================================================================
    # PART 4: EXTERNAL PRESENTATION DEFENSE & TOP 3 VIVA QUESTIONS
    # =========================================================================
    story.append(PageBreak())
    story.append(Paragraph("PART 4: External Presentation Defense & Top 3 Viva Questions", h1_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=ACCENT, spaceBefore=2, spaceAfter=10))

    story.append(Paragraph(
        "This section is engineered specifically for university evaluators, external viva defense panels, and technical examiners. "
        "It provides low-level architectural answers to the top three critical questions examiners ask regarding the hardware data "
        "transmission pipeline, biometric matching mechanics, and how VOTECHAIN fundamentally solves the core security flaws of "
        "traditional Electronic Voting Machines (EVMs).",
        body_style
    ))

    story.append(Spacer(1, 6))
    story.append(Paragraph("4.1 Question 1: How Biometric Data Transfers from Sensor to Server and Persists in MongoDB", h2_style))
    story.append(Paragraph(
        "A common evaluator inquiry is: <i>'Trace the exact path of the voter's data. How does an optical finger scan get from the "
        "glass prism of the R307 sensor into the Node.js server and become a record in MongoDB?'</i>",
        callout_style
    ))

    story.append(Paragraph(
        "The complete end-to-end data transmission pipeline operates in four coordinated architectural phases:",
        body_style
    ))

    story.append(Paragraph(
        "<b>Phase 1: Physical Acquisition & Minutiae Extraction (Sensor Edge):</b><br/>"
        "• The voter places their finger onto the R307 optical prism. A 570nm green LED illuminates the epidermis, and an internal CMOS "
        "optical array captures a 256x288 pixel grayscale ridge pattern (<code>finger.getImage()</code>).<br/>"
        "• The embedded AS608 Digital Signal Processor (DSP) executes the minutiae extraction algorithm (<code>finger.image2Tz()</code>). "
        "It identifies unique ridge bifurcations, ridge endings, and core deltas, compressing this topological geometry into a "
        "standardized <b>512-byte (1024 hex character) minutiae character buffer</b> (stored in the sensor's internal RAM CharBuffer1). "
        "<b>Crucially: The raw optical image is immediately discarded and NEVER leaves the sensor.</b>",
        bullet_style
    ))

    story.append(Paragraph(
        "<b>Phase 2: Hardware UART Transmission (Sensor to ESP32):</b><br/>"
        "• Communication between the R307 sensor and ESP32 microcontroller occurs over <b>Hardware Serial 2 (UART)</b> operating at "
        "<b>57,600 baud rate</b> (ESP32 Pin 16 = RX2 connected to Sensor TX; Pin 17 = TX2 connected to Sensor RX).<br/>"
        "• The data is framed inside standard AS608 binary packet frames: "
        "<code>[0xEF01 (2B Header) | 0xFFFFFFFF (4B Address) | 0x01/0x02 (1B Packet Flag) | Length (2B) | Minutiae/Slot Token Payload | Checksum (2B)]</code>.<br/>"
        "• Upon a successful 1:N match, the sensor transmits a 16-byte acknowledgment frame containing the matched Flash EEPROM Slot ID "
        "(e.g., <code>fingerID = 1</code>) and match confidence score (e.g., <code>confidence = 98</code>).",
        bullet_style
    ))

    story.append(Paragraph(
        "<b>Phase 3: Wireless Network Transport (ESP32 to Node.js Relay Server):</b><br/>"
        "• The ESP32 MCU receives the slot token via UART, debounces the voter's candidate button press (e.g., GPIO 13 = BJP), and formats an "
        "HTTP REST request using the ESP32 <code>HTTPClient</code> library over WPA2-PSK Wi-Fi.<br/>"
        "• It dispatches an HTTP POST payload to <code>http://&lt;SERVER_IP&gt;:3000/api/blockchain/vote</code> containing the structured JSON: "
        "<code>{\"voterID\": \"FP_UID_1\", \"party\": \"BJP\"}</code>. "
        "During citizen enrollment, it calls <code>/api/fingerprints/enroll</code> passing citizen demographics alongside the slot number.",
        bullet_style
    ))

    story.append(Paragraph(
        "<b>Phase 4: Middleware Ingestion & MongoDB Persistence:</b><br/>"
        "• The Node.js Express server receives the HTTP POST request. In <code>db/mongo.js</code>, Mongoose connects to MongoDB Atlas.<br/>"
        "• <b>Citizen Profile Storage (<code>fingerprint_voters</code> collection):</b> Maps physical EEPROM Slot #1 to demographic data: "
        "citizen name (<code>Vallabh Joshi</code>), national ID (<code>IND-MH-9482-1049</code>), constituency (<code>Ward 12 - South Mumbai</code>), "
        "512-byte minutiae character template, and SHA-256 template integrity hash. Upon voting, it marks <code>hasVoted: true</code>.<br/>"
        "• <b>Tamper-Evident Audit Logging (<code>biometric_audit_logs</code> collection):</b> Generates an immutable event record containing "
        "action: <code>BALLOT_CAST</code>, terminalId: <code>ESP32-BOOTH-01</code>, anonymizedHash: <code>7aa8e8...</code>, transactionHash: "
        "<code>0x3f1a...</code>, blockNumber, and millisecond timestamp. This guarantees a complete audit trail without violating ballot secrecy.",
        bullet_style
    ))

    story.append(Spacer(1, 8))
    pipeline_table_data = [
        [Paragraph("<b>Pipeline Stage</b>", body_style), Paragraph("<b>Physical Medium / Protocol</b>", body_style), Paragraph("<b>Data Payload & Representation</b>", body_style), Paragraph("<b>Security Role</b>", body_style)],
        [Paragraph("1. Prism Optical Scan", body_style), Paragraph("Optical Reflection / CMOS", body_style), Paragraph("570nm Grayscale Ridge Geometry", body_style), Paragraph("Live biometric presence", body_style)],
        [Paragraph("2. DSP Minutiae", body_style), Paragraph("AS608 Internal Bus", body_style), Paragraph("512-byte Minutiae Template", body_style), Paragraph("Raw image purged", body_style)],
        [Paragraph("3. Sensor -> ESP32", body_style), Paragraph("Hardware UART @ 57600 baud", body_style), Paragraph("AS608 Frame: <code>Slot #1, Score: 98</code>", body_style), Paragraph("Isolated wired interface", body_style)],
        [Paragraph("4. ESP32 -> Server", body_style), Paragraph("Wi-Fi 802.11b/g/n / HTTP REST", body_style), Paragraph("JSON: <code>{\"voterID\":\"FP_UID_1\",\"party\":\"BJP\"}</code>", body_style), Paragraph("WPA2 encrypted payload", body_style)],
        [Paragraph("5. Server -> MongoDB", body_style), Paragraph("TCP Socket / Mongoose ODM", body_style), Paragraph("BSON Document in <code>fingerprint_voters</code>", body_style), Paragraph("Persistent off-chain ledger", body_style)],
        [Paragraph("6. Server -> Sepolia", body_style), Paragraph("JSON-RPC Provider (Ethers.js)", body_style), Paragraph("EVM Tx: <code>castVote(voterHash, party)</code>", body_style), Paragraph("Immutable public consensus", body_style)],
    ]
    pipeline_table = Table(pipeline_table_data, colWidths=[90, 120, 174, 120])
    pipeline_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), PRIMARY),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#cbd5e1")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#e2e8f0")),
        ('TOPPADDING', (0,0), (-1,-1), 3.5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3.5),
        ('LEFTPADDING', (0,0), (-1,-1), 4),
        ('RIGHTPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(pipeline_table)

    story.append(Spacer(1, 10))
    story.append(Paragraph("4.2 Question 2: Exact Biometric Matching Mechanics: Sensor Internal Match vs. MongoDB Registry", h2_style))
    story.append(Paragraph(
        "A critical technical question asked by evaluators is: <i>'Where does the biometric matching actually occur? Does the finger "
        "match inside the R307 sensor chip, or is the fingerprint sent to MongoDB and matched in the database?'</i>",
        callout_style
    ))

    story.append(Paragraph(
        "<b>The Direct Engineering Answer:</b><br/>"
        "In this project's production hardware architecture, <b>THE PHYSICAL 1:N BIOMETRIC MATCHING RUNS ENTIRELY INSIDE THE R307 "
        "OPTICAL SENSOR'S EMBEDDED DSP PROCESSOR AND FLASH EEPROM (Edge Computing / On-Device Biometric Matching)</b>, NOT inside MongoDB.",
        body_style
    ))

    story.append(Paragraph(
        "Here is the precise division of computational responsibility between the Sensor and MongoDB:",
        body_style
    ))

    story.append(Paragraph(
        "<b>1. What the R307 Sensor Does (Physical Biometric Matching):</b><br/>"
        "• The R307 module contains an onboard high-speed 32-bit DSP processor and onboard non-volatile Flash EEPROM storing up to 127 fingerprint templates.<br/>"
        "• In <code>hardware.ino</code> lines 833-848, the firmware calls: "
        "<code>finger.getImage()</code> -> <code>finger.image2Tz()</code> -> <code>finger.fingerSearch()</code>.<br/>"
        "• The <code>finger.fingerSearch()</code> function executes entirely on the sensor's DSP. It executes a high-speed Euclidean distance "
        "matching algorithm comparing the live finger's CharBuffer1 against all 127 templates in local flash. This takes <b>under 200 milliseconds</b>.<br/>"
        "• If a match is found, the sensor returns integer <code>finger.fingerID</code> (e.g., Slot 1). If the finger does not match any enrolled citizen, "
        "the sensor chip returns <code>FINGERPRINT_NOTFOUND (-2)</code>, triggering the local buzzer fraud alarm and halting the booth.",
        bullet_style
    ))

    story.append(Paragraph(
        "<b>2. What MongoDB Does (Off-Chain Demographic & Audit Registry):</b><br/>"
        "• MongoDB does <b>not</b> perform optical pixel or minutiae matching during physical booth operation. Instead, MongoDB acts as the "
        "<b>Off-Chain Demographic Resolver and Double-Voting Prevention Guard</b>.<br/>"
        "• When the ESP32 receives <code>fingerID = 1</code> from the sensor, it queries: <code>GET /api/fingerprints/slot/1</code>.<br/>"
        "• MongoDB performs a fast indexed B-Tree lookup (<code>FingerprintVoter.findOne({ fingerprintSlot: 1 })</code>) to fetch the voter's human "
        "identity: <i>'Slot 1 belongs to Vallabh Joshi, Ward 12, Booth #01'</i>.<br/>"
        "• MongoDB immediately inspects the <code>hasVoted</code> boolean. If <code>hasVoted === true</code>, the server rejects the ballot locally "
        "with HTTP 409 Conflict, preventing an expensive blockchain transaction from ever being submitted.",
        bullet_style
    ))

    story.append(Paragraph(
        "<b>3. Hybrid Server-Side Verification Capability:</b><br/>"
        "• In addition to on-device matching, our backend (<code>db/mongo.js</code> line 402) provides an optional 1:N server-side matching API: "
        "<code>POST /api/fingerprints/verify</code>. If an external web kiosk or centralized scanner sends an AS608 minutiae template string, "
        "the server computes its SHA-256 hash and matches it against all <code>templateHash</code> indices in MongoDB in sub-millisecond time. "
        "Thus, the project demonstrates a <b>dual-tier matching capability</b>: Edge matching on IoT hardware and Hash matching in MongoDB.",
        bullet_style
    ))

    story.append(Spacer(1, 10))
    story.append(Paragraph("4.3 Question 3: How VOTECHAIN is Unique and Superior to Traditional EVM Voting Systems", h2_style))
    story.append(Paragraph(
        "Evaluators will invariably challenge: <i>'Governments already spend millions on Electronic Voting Machines (EVMs). "
        "Why is your project needed? How does VOTECHAIN fundamentally differ from a standard EVM?'</i>",
        callout_style
    ))

    story.append(Paragraph(
        "Traditional EVMs (such as those used in India, the USA, and Brazil) suffer from <b>six fatal architectural vulnerabilities</b>. "
        "VOTECHAIN solves every single one of them through the convergence of <b>Biometrics, Zero-Knowledge Hashing, and Ethereum Smart Contracts</b>:",
        body_style
    ))

    story.append(Paragraph(
        "<b>1. Eliminating the 'Black-Box' EEPROM Problem (Trustless vs Blind Trust):</b><br/>"
        "• <i>Traditional EVM:</i> Votes are stored on a closed, proprietary microcontroller EEPROM inside the physical booth. Neither voters, "
        "candidates, nor independent observers can ever inspect what is written into that EEPROM. The public must blindly trust the election commission.<br/>"
        "• <i>VOTECHAIN:</i> Votes are written to a decentralized, publicly verifiable smart contract (<code>VotingRegistry.sol</code> on Ethereum Sepolia). "
        "The smart contract code is open-source, audited, and immutable. Anyone on earth can open Etherscan or our dashboard and verify the ledger in real-time.",
        bullet_style
    ))

    story.append(Paragraph(
        "<b>2. Preventing Impersonation, Bogus Voting & Booth Capturing:</b><br/>"
        "• <i>Traditional EVM:</i> Voter identification is performed manually by human polling officers checking paper electoral photo rolls. "
        "Forged voter IDs, duplicate registrations across booths, proxy voting, and physical booth capturing remain persistent vulnerabilities.<br/>"
        "• <i>VOTECHAIN:</i> Hardware-enforced biometric authentication. The terminal requires live optical scanning on the R307 sensor. "
        "A citizen cannot vote without their physical living fingerprint matching their enrolled slot. Booth capturing is rendered useless because "
        "capturers cannot cast votes without the physical fingers of registered citizens.",
        bullet_style
    ))

    story.append(Paragraph(
        "<b>3. Eliminating Strongrooms, Transit Tampering & Machine Swapping:</b><br/>"
        "• <i>Traditional EVM:</i> After polls close, thousands of EVMs must be sealed, loaded into trucks, transported across highways, "
        "and locked inside government strongrooms for weeks under armed guard until counting day. Rumors of machine swapping or memory chip "
        "tampering during transit cause immense political instability and contested elections.<br/>"
        "• <i>VOTECHAIN:</i> <b>Zero physical transit. Zero strongrooms.</b> The ballot is broadcast and mined into a block the very second the citizen "
        "touches the candidate button. Once finalized by Ethereum consensus, that vote cannot be modified or deleted even by the President or military.",
        bullet_style
    ))

    story.append(Paragraph(
        "<b>4. Mathematically Proven Cast-as-Intended Proof (The VVPAT Replacement):</b><br/>"
        "• <i>Traditional EVM:</i> Uses a paper VVPAT slip that drops into a locked box. The voter cannot take the slip home. If the box is burned "
        "or lost, the voter has zero legal proof that their vote was counted.<br/>"
        "• <i>VOTECHAIN:</i> The voter receives a cryptographic transaction hash (or QR receipt). The voter can query <code>hasVoted(voterHash)</code> "
        "on any computer in the world to verify: <i>'My vote was permanently included in Block #7284919.'</i>",
        bullet_style
    ))

    story.append(Paragraph(
        "<b>5. Solving the Secret Ballot Paradox on a Public Blockchain:</b><br/>"
        "• A major objection is: <i>'If blockchain is public, won't everyone know who I voted for?'</i><br/>"
        "• VOTECHAIN utilizes a <b>Salted One-Way SHA-256 Cryptographic Bridge</b>: <code>voterHash = SHA-256(voterID + ElectionSalt)</code>.<br/>"
        "• The smart contract strictly enforces <code>hasVoted[voterHash] = true</code> (single-vote rule), while incrementing candidate tallies "
        "<code>partyVotes[party] += 1</code> as an anonymous aggregate accumulator. Physical identity and candidate choice are mathematically decoupled.",
        bullet_style
    ))

    story.append(Spacer(1, 8))
    evm_comp_data = [
        [Paragraph("<b>Comparison Metric</b>", body_style), Paragraph("<b>Traditional EVM System</b>", body_style), Paragraph("<b>VOTECHAIN (Our Web3 Project)</b>", body_style)],
        [Paragraph("1. Data Storage", body_style), Paragraph("Proprietary microcontroller EEPROM in booth", body_style), Paragraph("Decentralized Ethereum Sepolia Blockchain", body_style)],
        [Paragraph("2. Identity Verification", body_style), Paragraph("Manual human check of paper photo ID rolls", body_style), Paragraph("Hardware-level R307 Optical Fingerprint DSP", body_style)],
        [Paragraph("3. Bogus / Proxy Voting", body_style), Paragraph("Vulnerable to fake IDs, proxy voting & booth capture", body_style), Paragraph("Biometrically locked: 1 physical finger = 1 ballot", body_style)],
        [Paragraph("4. Physical Security", body_style), Paragraph("Requires armed trucks, strongroom locks, seal audits", body_style), Paragraph("Zero transit risk: Mined to blockchain in real time", body_style)],
        [Paragraph("5. Auditability", body_style), Paragraph("Closed black box; requires government recounting", body_style), Paragraph("100% public, verifiable on Etherscan by any citizen", body_style)],
        [Paragraph("6. Counting Speed", body_style), Paragraph("Days or weeks of manual EVM tabulation", body_style), Paragraph("Instant: Autonomous smart contract real-time counters", body_style)],
        [Paragraph("7. Voter Verification", body_style), Paragraph("Paper slip (VVPAT) drops into locked box", body_style), Paragraph("Cryptographic Tx receipt: Cast-as-Intended proof", body_style)],
    ]
    evm_comp_table = Table(evm_comp_data, colWidths=[110, 194, 200])
    evm_comp_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), PRIMARY),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#cbd5e1")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#e2e8f0")),
        ('TOPPADDING', (0,0), (-1,-1), 3.5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3.5),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(evm_comp_table)

    story.append(Spacer(1, 10))
    story.append(Paragraph("4.4 External Examiner Viva Quick-Defense Cheat Sheet", h2_style))

    story.append(Paragraph(
        "<b>Q1: Can a rogue server admin or government database administrator alter the votes in MongoDB?</b><br/>"
        "<b>Answer:</b> Even if a malicious database admin has root access to MongoDB and changes <code>hasVoted</code> or deletes records, "
        "<b>they CANNOT alter the election outcome</b>! The authoritative, legal vote count lives strictly inside the Ethereum Sepolia smart contract "
        "state (<code>partyVotes[party]</code>). The blockchain rejects any unauthorized state modifications. MongoDB is solely an identity lookup "
        "and telemetry cache; the smart contract is the ultimate single source of truth.",
        bullet_style
    ))

    story.append(Paragraph(
        "<b>Q2: What happens if the polling booth loses Wi-Fi / Internet connection during the election?</b><br/>"
        "<b>Answer:</b> The ESP32 firmware features an intelligent <b>Hybrid Offline Resilience Buffer</b>. If Wi-Fi disconnects, the terminal "
        "continues operating seamlessly in standalone mode: it validates fingerprints against local EEPROM slots, records ballots into local "
        "non-volatile flash memory, and cues them for batch synchronization the moment network connectivity is restored.",
        bullet_style
    ))

    story.append(Paragraph(
        "<b>Q3: What prevents multiple voting booths from triggering EVM Nonce Collisions on the Ethereum blockchain?</b><br/>"
        "<b>Answer:</b> In <code>server.js</code> (lines 56-89), our Node.js middleware implements an asynchronous <code>TransactionQueue</code>. "
        "Ethereum accounts require strictly sequential transaction nonces. If 10 booths submit votes simultaneously, the queue serializes the "
        "signing and broadcast process using an async mutex lock, preventing nonce collisions, transaction replacement errors, and gas starvation.",
        bullet_style
    ))

    story.append(Paragraph(
        "<b>Q4: Why not store citizen fingerprint templates directly on the Ethereum smart contract?</b><br/>"
        "<b>Answer:</b> Storing 512-byte minutiae templates on Ethereum would incur prohibitive gas costs (~$50–$100 per citizen) and would publicly "
        "expose citizen biometric data to the global internet. Our dual-storage architecture solves this by storing rich biometrics off-chain in "
        "MongoDB while anchoring only lightweight, anonymous 32-byte cryptographic hashes to the blockchain.",
        bullet_style
    ))

    story.append(Spacer(1, 10))
    story.append(Paragraph("4.5 Special Protocol Deep-Dive: Downloading Templates from MongoDB to R307 via Wi-Fi", h2_style))
    story.append(Paragraph(
        "A critical viva question asked by hardware/embedded evaluators is: <i>'Can the ESP32 fetch the 512-byte template from MongoDB "
        "and write it directly into the sensor's flash memory over Wi-Fi without the voter physically scanning their finger on the sensor?'</i>",
        callout_style
    ))

    story.append(Paragraph(
        "<b>The Direct Engineering Answer:</b><br/>"
        "<b>YES, ABSOLUTELY.</b> The R307 / AS608 optical sensor hardware architecture natively supports direct binary template injection "
        "through the <b><code>DownChar (Instruction Code 0x09)</code></b> protocol instruction. The complete 5-step operational flow is:",
        body_style
    ))

    story.append(Paragraph(
        "<b>1. REST API Retrieval:</b> The ESP32 MCU issues an HTTP GET call to <code>/api/fingerprints/slot/:id</code> over WPA2 Wi-Fi. "
        "The Node.js server retrieves the citizen's document from MongoDB and returns the 512-byte minutiae character template as a "
        "1024-character hexadecimal string.<br/>"
        "<b>2. Binary Hex Decoding:</b> The ESP32 parses the 1024 hex characters into an internal binary buffer of 512 raw bytes "
        "(<code>uint8_t templateBytes[512]</code>), converting every two hex characters into one unsigned byte (e.g., <code>0xEF</code>).<br/>"
        "<b>3. Dispatching AS608 DownChar Command (0x09):</b> The ESP32 transmits a 12-byte command packet across Hardware UART Serial2 "
        "(<code>TX=17, RX=16</code> @ 57600 baud): <code>[0xEF01 (Header) | 0xFFFFFFFF (Address) | 0x01 (Command Flag) | 0x0004 (Length) | 0x09 (DownChar) | 0x01 (Target CharBuffer1) | Checksum]</code>. "
        "The sensor's embedded AS608 DSP replies with acknowledgment code <code>0x00</code> (Ready for data stream).<br/>"
        "<b>4. Chunked UART Data Streaming (4 x 128 Bytes):</b> The sensor's serial input buffer operates in 128-byte segments. The ESP32 "
        "segments the 512 binary bytes into four sequential data packets (Data Packet Flag <code>0x02</code>, and <code>0x08</code> for End of Stream). "
        "The sensor writes the streaming bytes into its high-speed internal RAM buffer (<code>CharBuffer1</code>).<br/>"
        "<b>5. Non-Volatile Flash Persistence (storeModel 0x06):</b> Once <code>CharBuffer1</code> is verified via checksum, the ESP32 dispatches "
        "the storage instruction: <code>finger.storeModel(slotId)</code> (Command <code>0x06</code>). The sensor writes <code>CharBuffer1</code> "
        "permanently into its onboard non-volatile Flash EEPROM (Slots 1–127). The slot is now immediately available for instant offline matching!",
        bullet_style
    ))

    story.append(Paragraph(
        "<b>Real-World Election Significance:</b><br/>"
        "In a national election with millions of citizens and tens of thousands of voting booths, voters do not visit individual booths beforehand. "
        "Voters register once at a centralized government enrollment center (Aadhaar / Voter ID Registry). On election morning, each booth powers on, "
        "downloads the assigned ward voter templates from MongoDB directly into sensor memory using <code>DownChar</code>, and conducts instant, "
        "air-gapped 0.2-second biometric matching all day without external internet dependency.",
        callout_success_style
    ))

    # =========================================================================
    # PART 5: COMPLETE SYSTEM ARCHITECTURE FLOWCHART & DECISION MATRIX
    # =========================================================================
    story.append(PageBreak())
    story.append(Paragraph("PART 5: Complete System Architecture Flowchart & Decision Logic Matrix", h1_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=ACCENT, spaceBefore=2, spaceAfter=8))

    story.append(Paragraph(
        "This section documents the end-to-end execution flow of VOTECHAIN with exhaustive architectural precision. "
        "It includes the high-resolution master system flowchart diagram covering all six project phases, followed by "
        "the definitive <b>Condition-by-Condition Reference Table</b> analyzing every decision diamond, timeout, fallback, "
        "and state transition across Edge Hardware, Network Transport, Relayer Middleware, and Ethereum Sepolia Smart Contracts.",
        body_style
    ))
    story.append(Spacer(1, 4))

    flowchart_img = os.path.join(os.path.dirname(__file__), "votechain_master_flowchart.png")
    if os.path.exists(flowchart_img):
        story.append(Image(flowchart_img, width=6.5*inch, height=9.1*inch))

    story.append(PageBreak())
    story.append(Paragraph("5.1 Exhaustive Condition-by-Condition Verification Reference Table", h2_style))
    story.append(Paragraph(
        "Every decision diamond in the master flowchart corresponds to an exact, auditable code condition. "
        "The following matrix maps each decision point to its source file, runtime check, and branching behavior:",
        body_style
    ))
    story.append(Spacer(1, 4))

    table_data = [
        [Paragraph("<b>Decision Condition</b>", body_style), Paragraph("<b>Code Reference</b>", body_style), Paragraph("<b>Condition Checked</b>", body_style), Paragraph("<b>If True (Branch Yes)</b>", body_style), Paragraph("<b>If False (Branch No)</b>", body_style)],
        [Paragraph("1. I2C LCD Scan", body_style), Paragraph("<code>hardware.ino</code>:181", body_style), Paragraph("<code>Wire.endTransmission() == 0</code>", body_style), Paragraph("Binds <code>0x27</code> or <code>0x3F</code>", body_style), Paragraph("Fallback default with warning", body_style)],
        [Paragraph("2. Wi-Fi Connection", body_style), Paragraph("<code>hardware.ino</code>:405", body_style), Paragraph("<code>WiFi.status() == WL_CONNECTED</code>", body_style), Paragraph("Sets <code>isWifiConnected = true</code>", body_style), Paragraph("Sets <code>isWifiConnected = false</code> (Offline)", body_style)],
        [Paragraph("3. Sensor Password", body_style), Paragraph("<code>hardware.ino</code>:236", body_style), Paragraph("<code>finger.verifyPassword()</code>", body_style), Paragraph("Initializes sensor; LCD OK", body_style), Paragraph("Halts with continuous alarm", body_style)],
        [Paragraph("4. DownChar DB Sync", body_style), Paragraph("<code>hardware.ino</code>:261", body_style), Paragraph("<code>isWifiConnected == true</code>", body_style), Paragraph("Fetches Slots 1-4 from Mongo", body_style), Paragraph("Uses existing flash slots", body_style)],
        [Paragraph("5. Result Double-Press", body_style), Paragraph("<code>hardware.ino</code>:276", body_style), Paragraph("2nd press within 3.5s window", body_style), Paragraph("Fetches on-chain tallies & winner", body_style), Paragraph("Aborts results; returns to scan", body_style)],
        [Paragraph("6. Sensor Match", body_style), Paragraph("<code>hardware.ino</code>:840", body_style), Paragraph("<code>finger.fingerSearch() == OK</code>", body_style), Paragraph("Returns matched <code>fingerID</code>", body_style), Paragraph("Returns <code>-2</code> (Not Matched error)", body_style)],
        [Paragraph("7. Local Double-Vote", body_style), Paragraph("<code>hardware.ino</code>:348", body_style), Paragraph("<code>hasVotedLocal[id] == true</code>", body_style), Paragraph("Triggers fraud alarm & halts", body_style), Paragraph("Proceeds to party selection", body_style)],
        [Paragraph("8. Ballot Timeout", body_style), Paragraph("<code>hardware.ino</code>:450", body_style), Paragraph("<code>millis() - start > 25000</code>", body_style), Paragraph("Cancels session; returns idle", body_style), Paragraph("Captures party button press", body_style)],
        [Paragraph("9. Candidate Touch", body_style), Paragraph("<code>hardware.ino</code>:460", body_style), Paragraph("<code>digitalRead(TOUCH_PARTY_X)</code>", body_style), Paragraph("Assigns candidate (BJP, UBT...)", body_style), Paragraph("Continues polling touch pins", body_style)],
        [Paragraph("10. Anonymization", body_style), Paragraph("<code>server.js</code>:255", body_style), Paragraph("<code>!voterHash && voterID</code>", body_style), Paragraph("Computes SHA-256(ID + Salt)", body_style), Paragraph("Uses pre-hashed token", body_style)],
        [Paragraph("11. Pre-Flight Gas Guard", body_style), Paragraph("<code>server.js</code>:279", body_style), Paragraph("<code>contract.hasVoted(voterHash)</code>", body_style), Paragraph("Rejects with HTTP 409 (0 gas)", body_style), Paragraph("Enqueues for Sepolia broadcast", body_style)],
        [Paragraph("12. EVM Nonce Queue", body_style), Paragraph("<code>server.js</code>:56", body_style), Paragraph("<code>txQueue.processing == false</code>", body_style), Paragraph("Signs with sequential nonce", body_style), Paragraph("Queues to prevent collision", body_style)],
        [Paragraph("13. Solidity Immutability", body_style), Paragraph("<code>VotingRegistry.sol</code>:18", body_style), Paragraph("<code>require(!hasVoted[voterHash])</code>", body_style), Paragraph("Commits vote & increments tally", body_style), Paragraph("EVM reverts transaction", body_style)],
        [Paragraph("14. MongoDB Update", body_style), Paragraph("<code>mongo.js</code>:607", body_style), Paragraph("<code>hasVoted == false</code> in DB", body_style), Paragraph("Updates <code>hasVoted: true</code>, logs", body_style), Paragraph("Maintains audit trail", body_style)],
        [Paragraph("15. Regional Franchise", body_style), Paragraph("<code>server.js</code>:275", body_style), Paragraph("<code>voter.region != req.region</code>", body_style), Paragraph("Rejects with HTTP 403 Forbidden", body_style), Paragraph("Permits verified home ballot", body_style)],
        [Paragraph("16. Remote Ballot Adapt", body_style), Paragraph("<code>hardware.ino</code>:510", body_style), Paragraph("<code>voter.region detected</code>", body_style), Paragraph("Renders home constituency ballot", body_style), Paragraph("Default state candidates", body_style)],
    ]
    cond_table = Table(table_data, colWidths=[90, 85, 120, 105, 104])
    cond_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), PRIMARY),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#cbd5e1")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#e2e8f0")),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
        ('LEFTPADDING', (0,0), (-1,-1), 3.5),
        ('RIGHTPADDING', (0,0), (-1,-1), 3.5),
    ]))
    story.append(cond_table)

    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"PDF successfully built: {filename}")

if __name__ == "__main__":
    out_path = os.path.join(os.path.dirname(__file__), "VOTECHAIN_Complete_Project_Guide_All_3_Parts.pdf")
    build_pdf(out_path)
