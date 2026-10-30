import os
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as patches

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, KeepTogether, PageBreak, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas

# ===============================================================================
# 1. GENERATE HIGH-RES DATA TRANSFER FLOW DIAGRAM WITH WORKFLOW & REAL EXAMPLE
# ===============================================================================
def generate_flow_diagram(output_path):
    print("[1/2] Generating High-Resolution Data Transfer Flow Diagram (with Concrete Walkthrough Example)...")
    fig, ax = plt.subplots(figsize=(15, 10.5), dpi=300)
    ax.set_xlim(0, 15)
    ax.set_ylim(0, 10.5)
    ax.axis('off')
    fig.patch.set_facecolor('#F8FAFC')
    ax.set_facecolor('#F8FAFC')

    # Top Master Banner
    t_box = patches.FancyBboxPatch(
        (0.5, 9.35), 14.0, 0.85,
        boxstyle="round,pad=0.08,rounding_size=0.12",
        ec="#0F172A", fc="#0F172A", zorder=2
    )
    ax.add_patch(t_box)
    ax.text(7.5, 9.87, "VOTECHAIN END-TO-END DATA TRANSFER & SECURITY PIPELINE",
            ha='center', va='center', color='white', fontsize=13, weight='bold')
    ax.text(7.5, 9.55, "R307 SENSOR  ->  ESP32 EDGE CONTROLLER  ->  FINGERPRINT ENGINE & RELAY  ->  MONGODB ATLAS  ->  ETHEREUM SEPOLIA",
            ha='center', va='center', color='#38BDF8', fontsize=8.5, weight='bold')

    # -------------------------------------------------------------------------
    # TOP HALF: THE 4 CORE STAGES OF DATA TRANSFORMATION & WHAT HAPPENS
    # -------------------------------------------------------------------------
    # Stage 1: Optical Sensor & Minutiae Capture (Blue)
    box1 = patches.FancyBboxPatch(
        (0.5, 4.7), 3.2, 4.35,
        boxstyle="round,pad=0.08,rounding_size=0.12",
        ec="#2563EB", fc="#EFF6FF", lw=1.5, zorder=3
    )
    ax.add_patch(box1)
    h1 = patches.FancyBboxPatch((0.5, 8.5), 3.2, 0.55, boxstyle="round,pad=0.08,rounding_size=0.1", ec="#2563EB", fc="#2563EB", zorder=4)
    ax.add_patch(h1)
    ax.text(2.1, 8.78, "STAGE 1: BIOMETRIC SENSING", ha='center', va='center', color='white', fontsize=8.5, weight='bold')
    ax.text(2.1, 8.25, "R307 Optical Sensor Hardware", ha='center', va='center', color='#1E293B', fontsize=8, weight='bold')

    pts1 = [
        ("Step 1: Optical Scan", "Photons -> 256x288 Pixels", "TIR Prism (CMOS)", "Anti-tamper Prism"),
        ("Step 2: Minutiae DSP", "Raw Image -> 512B Vector", "AS608 DSP Bus", "One-Way Feature Extr."),
        ("Step 3: UART Transfer", "512B in 4x 128B Frames", "UART Serial2 57.6k", "16-bit Frame Checksum")
    ]
    y1 = 7.75
    for title, form, proto, sec in pts1:
        ax.text(0.7, y1, f"- {title}", fontsize=7.2, weight='bold', color='#1E3A8A')
        ax.text(0.9, y1 - 0.22, f"Format: {form}", fontsize=6.3, color='#475569')
        ax.text(0.9, y1 - 0.42, f"Method: {proto}", fontsize=6.3, color='#0284C7', weight='bold')
        y1 -= 0.68

    ax.text(2.1, 5.25, "What Happens: Prism captures optical ridges,", ha='center', va='center', fontsize=6.3, color='#1E40AF', style='italic')
    ax.text(2.1, 5.00, "DSP extracts minutiae, 512B streamed over UART.", ha='center', va='center', fontsize=6.3, color='#1E40AF', style='italic')

    # Stage 2: ESP32 Edge Gateway (Teal)
    box2 = patches.FancyBboxPatch(
        (4.1, 4.7), 3.3, 4.35,
        boxstyle="round,pad=0.08,rounding_size=0.12",
        ec="#0D9488", fc="#F0FDFA", lw=1.5, zorder=3
    )
    ax.add_patch(box2)
    h2 = patches.FancyBboxPatch((4.1, 8.5), 3.3, 0.55, boxstyle="round,pad=0.08,rounding_size=0.1", ec="#0D9488", fc="#0D9488", zorder=4)
    ax.add_patch(h2)
    ax.text(5.75, 8.78, "STAGE 2: EDGE CONTROLLER", ha='center', va='center', color='white', fontsize=8.5, weight='bold')
    ax.text(5.75, 8.25, "ESP32 DevKit Edge Gateway", ha='center', va='center', color='#1E293B', fontsize=8, weight='bold')

    pts2 = [
        ("Step 4: Wi-Fi REST Post", "1024 Hex Chars (JSON)", "HTTP POST /verify", "WPA2-AES / TLS 1.3"),
        ("Step 7: Token Return", "Signed Auth Token JSON", "HTTP 200 Response", "HMAC Single-Use Nonce"),
        ("Step 8: Touch Ballot", "Capacitive GPIO Pulse", "Hardware Interrupt", "Mutual Exclusion Lock")
    ]
    y2 = 7.75
    for title, form, proto, sec in pts2:
        ax.text(4.3, y2, f"- {title}", fontsize=7.2, weight='bold', color='#115E59')
        ax.text(4.5, y2 - 0.22, f"Format: {form}", fontsize=6.3, color='#475569')
        ax.text(4.5, y2 - 0.42, f"Method: {proto}", fontsize=6.3, color='#0D9488', weight='bold')
        y2 -= 0.68

    ax.text(5.75, 5.25, "What Happens: Receives UART, POSTs to cloud,", ha='center', va='center', fontsize=6.3, color='#0F766E', style='italic')
    ax.text(5.75, 5.00, "shows 'Authorized', reads capacitive party tap.", ha='center', va='center', fontsize=6.3, color='#0F766E', style='italic')

    # Stage 3: Node.js Fingerprint Engine & Relayer (Amber)
    box3 = patches.FancyBboxPatch(
        (7.8, 4.7), 3.4, 4.35,
        boxstyle="round,pad=0.08,rounding_size=0.12",
        ec="#D97706", fc="#FFFBEB", lw=1.5, zorder=3
    )
    ax.add_patch(box3)
    h3 = patches.FancyBboxPatch((7.8, 8.5), 3.4, 0.55, boxstyle="round,pad=0.08,rounding_size=0.1", ec="#D97706", fc="#D97706", zorder=4)
    ax.add_patch(h3)
    ax.text(9.5, 8.78, "STAGE 3: ENGINE & RELAY", ha='center', va='center', color='white', fontsize=8.5, weight='bold')
    ax.text(9.5, 8.25, "Node.js Server & Engine Core", ha='center', va='center', color='#1E293B', fontsize=8, weight='bold')

    pts3 = [
        ("Step 5: 1:N Minutiae Search", "Probe Vector vs N Records", "Node In-Memory Pool", "Spatial Tolerance Gate"),
        ("Step 6: Double-Vote Check", "SHA-256 Hash Cross-Check", "Mongoose + Sepolia RPC", "Zero-Knowledge Hash"),
        ("Step 10: Anonymize & Sign", "ABI castVote(Hash, Party)", "Ethers.js v6 (ECDSA)", "Secp256k1 Key Isolation")
    ]
    y3 = 7.75
    for title, form, proto, sec in pts3:
        ax.text(8.0, y3, f"- {title}", fontsize=7.2, weight='bold', color='#92400E')
        ax.text(8.2, y3 - 0.22, f"Format: {form}", fontsize=6.3, color='#475569')
        ax.text(8.2, y3 - 0.42, f"Method: {proto}", fontsize=6.3, color='#B45309', weight='bold')
        y3 -= 0.68

    ax.text(9.5, 5.25, "What Happens: Matches probe with Mongo Atlas,", ha='center', va='center', fontsize=6.3, color='#92400E', style='italic')
    ax.text(9.5, 5.00, "verifies hasVoted=false, salts ID & signs EVM tx.", ha='center', va='center', fontsize=6.3, color='#92400E', style='italic')

    # Stage 4: Dual Storage: Blockchain + MongoDB (Red)
    box4 = patches.FancyBboxPatch(
        (11.6, 4.7), 2.9, 4.35,
        boxstyle="round,pad=0.08,rounding_size=0.12",
        ec="#DC2626", fc="#FEF2F2", lw=1.5, zorder=3
    )
    ax.add_patch(box4)
    h4 = patches.FancyBboxPatch((11.6, 8.5), 2.9, 0.55, boxstyle="round,pad=0.08,rounding_size=0.1", ec="#DC2626", fc="#DC2626", zorder=4)
    ax.add_patch(h4)
    ax.text(13.05, 8.78, "STAGE 4: DUAL STORAGE", ha='center', va='center', color='white', fontsize=8.5, weight='bold')
    ax.text(13.05, 8.25, "MongoDB + Ethereum Sepolia", ha='center', va='center', color='#1E293B', fontsize=8, weight='bold')

    pts4 = [
        ("Step 11: Sepolia Blockchain", "Signed Raw Tx Hex", "JSON-RPC / TLS 1.3", "PoS Global Consensus"),
        ("Step 12: MongoDB Audit Log", "BSON Audit & Regional Doc", "Mongoose Driver TLS", "AES-256 At Rest"),
        ("Step 13: Terminal Feedback", "Receipt JSON -> LCD & Sound", "I2C 0x27 + GPIO PWM", "Immediate Session Clear")
    ]
    y4 = 7.75
    for title, form, proto, sec in pts4:
        ax.text(11.8, y4, f"- {title}", fontsize=7.2, weight='bold', color='#991B1B')
        ax.text(12.0, y4 - 0.22, f"Format: {form}", fontsize=6.3, color='#475569')
        ax.text(12.0, y4 - 0.42, f"Method: {proto}", fontsize=6.3, color='#DC2626', weight='bold')
        y4 -= 0.68

    ax.text(13.05, 5.25, "What Happens: Sepolia mines immutable block,", ha='center', va='center', fontsize=6.3, color='#B91C1C', style='italic')
    ax.text(13.05, 5.00, "Mongo updates hasVoted=true in IST format.", ha='center', va='center', fontsize=6.3, color='#B91C1C', style='italic')

    # Connecting Arrows Across Stages
    arrow_style = dict(arrowstyle='->', lw=2.4, color='#475569', mutation_scale=16)
    ax.annotate('', xy=(4.1, 6.8), xytext=(3.7, 6.8), arrowprops=arrow_style)
    ax.annotate('', xy=(7.8, 6.8), xytext=(7.4, 6.8), arrowprops=arrow_style)
    ax.annotate('', xy=(11.6, 6.8), xytext=(11.2, 6.8), arrowprops=arrow_style)

    # -------------------------------------------------------------------------
    # BOTTOM HALF: REAL-WORLD CONCRETE WALKTHROUGH EXAMPLE (VALLABH JOSHI VOTING BJP)
    # Replaces the removed timing synthesis block with concrete step-by-step reality!
    # -------------------------------------------------------------------------
    b_box = patches.FancyBboxPatch(
        (0.5, 0.4), 14.0, 3.9,
        boxstyle="round,pad=0.08,rounding_size=0.12",
        ec="#0F172A", fc="#FFFFFF", lw=1.5, zorder=2
    )
    ax.add_patch(b_box)
    bh = patches.FancyBboxPatch((0.5, 3.85), 14.0, 0.45, boxstyle="round,pad=0.08,rounding_size=0.1", ec="#0F172A", fc="#0F172A", zorder=3)
    ax.add_patch(bh)
    ax.text(7.5, 4.08, "PRACTICAL END-TO-END EXAMPLE: CITIZEN VALLABH JOSHI (KONKAN) CASTING VOTE FOR BJP", ha='center', va='center', color='white', fontsize=9.5, weight='bold')

    # 4 Sub-Panels for the Real Example
    # Panel A: Scanning & Ingestion
    p_a = patches.FancyBboxPatch((0.7, 0.6), 3.2, 3.1, boxstyle="round,pad=0.06,rounding_size=0.08", ec="#2563EB", fc="#F8FAFC", lw=1.0, zorder=3)
    ax.add_patch(p_a)
    ax.text(2.3, 3.48, "[1. BIOMETRIC SCAN]", ha='center', va='center', color='#2563EB', fontsize=7.8, weight='bold')
    ex_a = [
        "• Citizen: Vallabh Joshi",
        "• Registered ID: FP_UID_1",
        "• Franchise: Konkan (Mumbai)",
        "• Action: Places Right Index Finger",
        "• Sensor DSP extracts minutiae points",
        "• 512 bytes streamed to ESP32 via",
        "  UART Serial2 @ 57600 baud",
        "• Latency: ~240 ms (0.24 seconds)"
    ]
    ya = 3.20
    for l in ex_a:
        ax.text(0.85, ya, l, fontsize=6.3, color='#1E293B')
        ya -= 0.32

    # Panel B: Cloud Verification & Status
    p_b = patches.FancyBboxPatch((4.2, 0.6), 3.3, 3.1, boxstyle="round,pad=0.06,rounding_size=0.08", ec="#0D9488", fc="#F8FAFC", lw=1.0, zorder=3)
    ax.add_patch(p_b)
    ax.text(5.85, 3.48, "[2. ENGINE AUTH & PREFLIGHT]", ha='center', va='center', color='#0D9488', fontsize=7.8, weight='bold')
    ex_b = [
        "• ESP32 POSTs to /api/fingerprints/verify",
        "• Engine compares with Mongo Atlas",
        "• Matched: Slot #1 (Score: 98%!)",
        "• Preflight Check: hasVoted == false",
        "• Sepolia Check: hasVoted(hash) == 0",
        "• Server issues single-use token:",
        "  AUTH_F7629067FC337A4F3548...",
        "• Token Validity: Strict 60 Seconds"
    ]
    yb = 3.20
    for l in ex_b:
        ax.text(4.35, yb, l, fontsize=6.3, color='#1E293B')
        yb -= 0.32

    # Panel C: Ballot Touch & Anonymization
    p_c = patches.FancyBboxPatch((7.8, 0.6), 3.3, 3.1, boxstyle="round,pad=0.06,rounding_size=0.08", ec="#D97706", fc="#F8FAFC", lw=1.0, zorder=3)
    ax.add_patch(p_c)
    ax.text(9.45, 3.48, "[3. BALLOT TAP & HASHING]", ha='center', va='center', color='#D97706', fontsize=7.8, weight='bold')
    ex_c = [
        "• LCD: 'Authorized! Vallabh Joshi'",
        "• Vallabh taps Touch Button 1 (BJP)",
        "• ESP32 sends: { voterID, party: 'BJP' }",
        "• Node Relayer anonymizes identity:",
        "  Hash = SHA-256(FP_UID_1 || Salt)",
        "  voterHash: b36bd0d7bee3670c...",
        "• Signs castVote(voterHash, 'BJP')",
        "• ECDSA Secp256k1 Key Isolation"
    ]
    yc = 3.20
    for l in ex_c:
        ax.text(7.95, yc, l, fontsize=6.3, color='#1E293B')
        yc -= 0.32

    # Panel D: Blockchain Settlement & Feedback
    p_d = patches.FancyBboxPatch((11.4, 0.6), 2.9, 3.1, boxstyle="round,pad=0.06,rounding_size=0.08", ec="#DC2626", fc="#F8FAFC", lw=1.0, zorder=3)
    ax.add_patch(p_d)
    ax.text(12.85, 3.48, "[4. BLOCKCHAIN & AUDIT]", ha='center', va='center', color='#DC2626', fontsize=7.8, weight='bold')
    ex_d = [
        "• Mined on Sepolia Ethereum Block:",
        "  Tx Hash: 0x6d6b7b78757aba4c...",
        "  Block Number: #12024283",
        "• Committed to Mongo: votes_konkan",
        "• hasVoted = true in voters_konkan",
        "• Timestamp: 2026-10-30 10:28:22 IST",
        "• LCD: 'Vote Recorded! Secured Web3'",
        "• Buzzer: 3 Chimes (Vote Cast!)"
    ]
    yd = 3.20
    for l in ex_d:
        ax.text(11.55, yd, l, fontsize=6.3, color='#1E293B')
        yd -= 0.32

    # Horizontal Arrows connecting Example Panels
    ax.annotate('', xy=(4.2, 2.1), xytext=(3.9, 2.1), arrowprops=arrow_style)
    ax.annotate('', xy=(7.8, 2.1), xytext=(7.5, 2.1), arrowprops=arrow_style)
    ax.annotate('', xy=(11.4, 2.1), xytext=(11.1, 2.1), arrowprops=arrow_style)

    plt.tight_layout()
    plt.savefig(output_path, dpi=300, facecolor=fig.get_facecolor(), edgecolor='none')
    plt.close()
    print("✅ High-res diagram generated at:", output_path)


# ===============================================================================
# 2. NUMBERED CANVAS FOR TWO-PASS RUNNING HEADERS & FOOTERS
# ===============================================================================
class NumberedCanvas(canvas.Canvas):
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
        if self._pageNumber == 1:
            return

        self.saveState()
        self.setFont("Helvetica-Bold", 8)
        self.setFillColor(colors.HexColor("#0F172A"))

        # Running Header
        self.drawString(45, letter[1] - 32, "VOTECHAIN: STEP-BY-STEP DATA TRANSFER, SECURITY & TIMING SPECIFICATION")
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        self.drawRightString(letter[0] - 45, letter[1] - 32, "Complete Voting Workflow & Real-World Example")

        self.setStrokeColor(colors.HexColor("#CBD5E1"))
        self.setLineWidth(0.75)
        self.line(45, letter[1] - 38, letter[0] - 45, letter[1] - 38)

        # Running Footer
        self.line(45, 38, letter[0] - 45, 38)
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        self.drawString(45, 26, "VoteChain Technical Specification • Biometric Encryption, MongoDB Atlas & Ethereum Sepolia")
        self.setFont("Helvetica-Bold", 8)
        self.setFillColor(colors.HexColor("#0F172A"))
        self.drawRightString(letter[0] - 45, 26, f"Page {self._pageNumber} of {page_count}")

        self.restoreState()


# ===============================================================================
# 3. BUILD THE COMPREHENSIVE PDF DOCUMENT
# ===============================================================================
def build_transfer_flow_pdf(pdf_path, diagram_path):
    print("Building VoteChain_Data_Transfer_Security_Flow.pdf document...")

    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=letter,
        leftMargin=40,
        rightMargin=40,
        topMargin=42,
        bottomMargin=42
    )

    styles = getSampleStyleSheet()

    PRIMARY = colors.HexColor("#0F172A")    # Deep Slate
    SECONDARY = colors.HexColor("#2563EB")  # Royal Blue
    TEAL = colors.HexColor("#0D9488")       # Teal
    AMBER = colors.HexColor("#D97706")      # Amber
    CRIMSON = colors.HexColor("#DC2626")    # Crimson
    TEXT_DARK = colors.HexColor("#1E293B")  # Charcoal
    TEXT_MUTED = colors.HexColor("#475569") # Slate Muted

    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=17,
        leading=21,
        textColor=PRIMARY,
        spaceAfter=4
    )

    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=SECONDARY,
        spaceAfter=8
    )

    section_heading = ParagraphStyle(
        'SectionHeading',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11.5,
        leading=14.5,
        textColor=PRIMARY,
        spaceBefore=8,
        spaceAfter=5,
        keepWithNext=True
    )

    step_title_style = ParagraphStyle(
        'StepTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=11.5,
        textColor=PRIMARY
    )

    body_style = ParagraphStyle(
        'BodyTextCustom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7.8,
        leading=10.5,
        textColor=TEXT_DARK
    )

    body_muted = ParagraphStyle(
        'BodyMutedCustom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7.2,
        leading=9.5,
        textColor=TEXT_MUTED
    )

    table_header_style = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=6.8,
        leading=8.8,
        textColor=colors.white,
        alignment=1
    )

    table_cell_style = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=6.5,
        leading=8.3,
        textColor=TEXT_DARK
    )

    table_cell_bold = ParagraphStyle(
        'TableCellBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=6.5,
        leading=8.3,
        textColor=PRIMARY
    )

    story = []

    # =========================================================================
    # PAGE 1: TITLE BANNER, OVERVIEW & HIGH-RES MASTER DIAGRAM
    # =========================================================================
    story.append(Paragraph("VOTECHAIN: END-TO-END DATA TRANSFER, SECURITY & TIMING", title_style))
    story.append(Paragraph("Complete Technical Pipeline with Step-by-Step Info & Real-World Walkthrough Example", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=SECONDARY, spaceBefore=0, spaceAfter=6))

    # Executive Overview Paragraph
    intro_p = Paragraph(
        "<b>System Overview:</b> In the VoteChain Biometric Web3 Voting System, voting is executed across a coordinated four-stage hardware-software pipeline: "
        "<b>(1) R307 Optical Biometric Sensing</b>, <b>(2) ESP32 Edge Gateway</b>, <b>(3) Backend Recognition Engine & Relayer</b>, and <b>(4) Dual Storage: Blockchain Consensus + MongoDB Atlas</b>. "
        "At every step, data changes format—from analog optical reflections into high-entropy minutiae vectors, serial binary packet frames, JSON HTTP payloads, "
        "salted SHA-256 anonymized digests, and finally ECDSA-signed Ethereum smart contract transactions. "
        "Below is the complete flow diagram along with an exact step-by-step real-world walkthrough of citizen <b>Vallabh Joshi</b> voting for <b>BJP</b>.",
        body_style
    )
    story.append(intro_p)
    story.append(Spacer(1, 5))

    # Embed Master Flowchart
    if os.path.exists(diagram_path):
        story.append(Image(diagram_path, width=7.4 * inch, height=4.6 * inch))
        story.append(Spacer(1, 5))

    # Real-World Summary Callout Box
    summary_box_data = [
        [
            Paragraph("<b>👤 Real Example Voter:</b> Vallabh Joshi (FP_UID_1)", table_cell_bold),
            Paragraph("<b>🗳️ Selected Party:</b> BJP [Konkan - Mumbai]", table_cell_bold),
            Paragraph("<b>🕒 Record Time:</b> 2026-10-30 10:28:22 IST", table_cell_bold),
            Paragraph("<b>⛓️ Sepolia Block:</b> #12024283 (Confirmed)", table_cell_bold)
        ]
    ]
    t_summary_box = Table(summary_box_data, colWidths=[1.85 * inch, 1.85 * inch, 1.85 * inch, 1.85 * inch])
    t_summary_box.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#EFF6FF")),
        ('BOX', (0, 0), (-1, -1), 1, SECONDARY),
        ('PADDING', (0, 0), (-1, -1), 4),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE')
    ]))
    story.append(t_summary_box)

    story.append(PageBreak())

    # =========================================================================
    # PAGE 2: REAL-WORLD EXAMPLE WALKTHROUGH & STEP-BY-STEP INFO
    # =========================================================================
    story.append(Paragraph("CONCRETE REAL-WORLD EXAMPLE: CITIZEN VALLABH JOSHI VOTING FOR BJP", section_heading))
    story.append(Paragraph("To understand the system clearly, here is the complete trace of a real voter from touch to blockchain mining:", body_muted))
    story.append(Spacer(1, 6))

    example_story = [
        [
            Paragraph("<b>Stage & Action</b>", table_header_style),
            Paragraph("What Actually Happens In This Step", table_header_style),
            Paragraph("Data Form & Values in This Step", table_header_style),
            Paragraph("Latency", table_header_style)
        ],
        [
            Paragraph("<b>Phase A:<br/>Biometric Scan</b>", table_cell_bold),
            Paragraph("Citizen Vallabh Joshi approaches the polling booth in Mumbai (Konkan region). He places his right index finger on the R307 sensor glass. The sensor illuminates the finger with red LEDs, captures ridges and valleys, extracts 48 minutiae points into volatile RAM, and streams 512 bytes over UART serial pins to the ESP32.", table_cell_style),
            Paragraph("• Raw 256x288 pixel optical reflection<br/>• Minutiae Vector: 512 bytes binary<br/>• UART Frames: 4x 139-byte packets<br/>• Transferred to ESP32 Serial2 @ 57600 baud", table_cell_style),
            Paragraph("<b>240 ms</b><br/>(0.24 s)", table_cell_bold)
        ],
        [
            Paragraph("<b>Phase B:<br/>Cloud Engine Auth</b>", table_cell_bold),
            Paragraph("ESP32 sends the minutiae hex string via Wi-Fi to Node.js /api/fingerprints/engine/verify. The server's Fingerprint Engine executes a 1:N spatial pattern search across MongoDB Atlas. It matches Vallabh's template (Slot #1, score 98%). The server checks MongoDB hasVoted and Sepolia contract. Both confirm he has NOT voted yet. Server issues a signed single-use authorization token valid for 60 seconds.", table_cell_style),
            Paragraph("• Payload: JSON with 1024 hex chars<br/>• Match Score: 98% (High confidence)<br/>• Double-Vote Preflight: hasVoted == false<br/>• Auth Token: AUTH_F7629067FC337A4F3548...<br/>• Expiration: Strict 60 seconds", table_cell_style),
            Paragraph("<b>75 ms</b><br/>(0.08 s)", table_cell_bold)
        ],
        [
            Paragraph("<b>Phase C:<br/>Ballot Touch & Signing</b>", table_cell_bold),
            Paragraph("ESP32 LCD displays 'Authorized! Vallabh Joshi' and triggers a welcoming audio tone. Vallabh touches Button 1 to vote for BJP. ESP32 sends the vote payload with the authorization token to /api/blockchain/vote. Node.js relayer verifies the token, hashes his ID with dynamic election salt (voterHash), and signs the castVote(voterHash, 'BJP') smart contract call.", table_cell_style),
            Paragraph("• LCD: 'Authorized! Vallabh Joshi'<br/>• Touch Input: GPIO 13 Active Pulse<br/>• voterHash: b36bd0d7bee3670c... (SHA-256)<br/>• ABI: castVote(voterHash, 'BJP')<br/>• Signed with Relayer Secp256k1 key", table_cell_style),
            Paragraph("<b>2.5 s</b><br/>(Human tap)", table_cell_bold)
        ],
        [
            Paragraph("<b>Phase D:<br/>Settlement & Receipt</b>", table_cell_bold),
            Paragraph("The signed transaction is broadcast to the Ethereum Sepolia network. Proof-of-Stake validators mint the vote into an immutable block (#12024283). Simultaneously, MongoDB stores the vote in votes_konkan, marks hasVoted = true in voters_konkan and fingerprintvoters, and logs the event with timestamp '2026-10-30 10:28:22 IST'. Terminal LCD displays 'Vote Recorded!' and plays 3 confirmation chimes.", table_cell_style),
            Paragraph("• Sepolia Tx: 0x6d6b7b78757aba4c...<br/>• Block: #12024283 (PoS Consensus)<br/>• MongoDB: Saved in votes_konkan<br/>• Time: 2026-10-30 10:28:22 IST<br/>• hasVoted set to true (Prevents double vote)", table_cell_style),
            Paragraph("<b>12 s block</b><br/>(Relay: 45ms)", table_cell_bold)
        ]
    ]

    t_example = Table(example_story, colWidths=[1.15 * inch, 2.75 * inch, 2.5 * inch, 0.9 * inch])
    t_example.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), PRIMARY),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('ALIGN', (3, 1), (3, -1), 'CENTER'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
        ('PADDING', (0, 0), (-1, -1), 4.5),
        ('VALIGN', (0, 0), (-1, -1), 'TOP')
    ]))
    story.append(t_example)
    story.append(Spacer(1, 10))

    # =========================================================================
    # PAGES 3 & 4: DETAILED STEP-BY-STEP NOTES WITH PROCESS INFO (STEPS 1 TO 13)
    # =========================================================================
    story.append(Paragraph("DETAILED STEP-BY-STEP TECHNICAL NOTES (WHAT HAPPENS IN EACH STEP)", section_heading))
    story.append(Paragraph("Complete technical description of data format, transfer method, security enforcement, and latency for every step:", body_muted))
    story.append(Spacer(1, 6))

    steps_data = [
        {
            "num": "STEP 1",
            "title": "Physical Finger Placement & Optical Image Capture",
            "info": "What Happens: Citizen places finger onto optical prism. Red LEDs light up the finger surface. Ridges touch the glass while valleys leave air gaps, causing light to reflect differently onto a CMOS sensor. The sensor captures an uncompressed 256x288 pixel grayscale image into temporary SRAM.",
            "data": "Reflected optical photons -> 8-bit digital grayscale pixel matrix (256 x 288 resolution, 73,728 bytes).",
            "form": "Analog light reflection -> 8-bit Digital Pixel Array.",
            "method": "Total Internal Reflection (TIR) optical CMOS sensor pipeline -> Internal ImageBuffer.",
            "sec": "Physical anti-tamper optical prism surface. Direct volatile capture into sensor ImageBuffer RAM. Never written to non-volatile flash storage.",
            "time": "~ 150 ms (0.15 seconds)"
        },
        {
            "num": "STEP 2",
            "title": "In-Sensor DSP Minutiae Extraction",
            "info": "What Happens: The R307 sensor's internal DSP chip runs an edge detection and skeletonization algorithm. It thins the ridges to 1-pixel width, identifies coordinates where ridges end or bifurcate (split), and determines the angle theta. This mathematical vector is stored in CharBuffer1 in volatile RAM.",
            "data": "ImageBuffer pixel matrix is converted into core minutiae points: ridge endings, bifurcations, orientation angles, and singular core points.",
            "form": "AS608 binary feature vector character buffer (512 bytes raw minutiae).",
            "method": "Internal high-speed DSP bus command 0x02 (PS_Image2Tz to CharBuffer1).",
            "sec": "One-way biometric abstraction: mathematical minutiae coordinates cannot be reverse-engineered back into an image. Volatile CharBuffer1 RAM only.",
            "time": "~ 90 - 110 ms (0.10 seconds)"
        },
        {
            "num": "STEP 3",
            "title": "Biometric Minutiae Transfer: R307 Sensor -> ESP32",
            "info": "What Happens: ESP32 sends command 0x08 (PS_UpChar). The sensor divides the 512-byte minutiae buffer into 4 packets of 128 bytes each. Each packet is wrapped with header bytes and a 16-bit arithmetic checksum. ESP32 receives them over Hardware Serial2 and verifies the checksum of each packet.",
            "data": "512 bytes of minutiae data divided into 4 sequential data packets of 128 bytes each, framed with headers and checksums.",
            "form": "UART Binary Packet Frames: [0xEF 0x01 | Address (4B) | Packet ID (1B) | Length (2B) | 128 Data Bytes | 16-bit Checksum] (139B per packet x 4 = 556B total).",
            "method": "Hardware Serial UART (Serial2: TX=GPIO 17, RX=GPIO 16) at 57,600 baud rate (8N1). Command: AS608 PS_UpChar (0x08).",
            "sec": "Point-to-point physical wired UART bus (immune to radio eavesdropping). Arithmetic 16-bit packet checksum verification on each packet prevents bit flips.",
            "time": "~ 85 - 95 ms (0.09 seconds)"
        },
        {
            "num": "STEP 4",
            "title": "Edge -> Backend API Biometric Verification Request",
            "info": "What Happens: ESP32 formats the 512 binary bytes into a 1024-character hexadecimal string. It creates an HTTP POST request to /api/fingerprints/engine/verify over Wi-Fi. The request body includes terminalId and the hex string.",
            "data": "JSON verification payload containing terminal identifier and 1024-character hexadecimal minutiae string.",
            "form": "JSON-formatted string: { \"terminalId\": \"ESP32_BOOTH_01\", \"templateData\": \"EF01FFFF...\" } (~1.2 KB payload).",
            "method": "Wi-Fi IEEE 802.11 b/g/n wireless link -> TCP/IP -> HTTP POST /api/fingerprints/engine/verify (TLS 1.3 supported).",
            "sec": "WPA2-AES / WPA3 Wi-Fi radio encryption. Strict timeout bounds (4-second watchdog) prevent hanging threads or replay interception.",
            "time": "~ 35 - 60 ms (0.05 seconds)"
        },
        {
            "num": "STEP 5",
            "title": "Backend Fingerprint Engine 1:N Biometric Matching",
            "info": "What Happens: Node.js server loads the candidate templates from MongoDB Atlas into memory. The Fingerprint Recognition Engine aligns the probe minutiae points against candidate templates, calculating spatial distance (dr <= 18px) and angular alignment (dtheta <= 30 deg). If score >= 40%, it confirms a match.",
            "data": "Incoming probe template compared against N citizen templates retrieved from MongoDB Atlas voter collections.",
            "form": "In-memory binary byte array and structured minutiae descriptor tables: (x, y, theta, type, quality).",
            "method": "Node.js Fingerprint Recognition Engine executing spatial point pattern matching and descriptor cross-correlation in memory.",
            "sec": "Bypasses sensor flash memory completely. Employs spatial distance and angular tolerance gates, preventing spoof attacks.",
            "time": "~ 20 - 40 ms (0.03 seconds)"
        },
        {
            "num": "STEP 6",
            "title": "Voting Status Pre-Flight Check (Double-Voting Guard)",
            "info": "What Happens: Once the voter is identified (e.g. Vallabh Joshi, FP_UID_1), the server checks if he already voted. It inspects the hasVoted boolean flag in MongoDB Atlas. Then it hashes his ID with the active round salt and queries the Ethereum Sepolia smart contract function hasVoted(voterHash).",
            "data": "Citizen Voter ID (FP_UID_1) converted into salted hash SHA-256(voterID + activeSalt) and checked against ledger.",
            "form": "SHA-256 Hex Hash (64 chars) + JSON-RPC eth_call payload to Sepolia Ethereum node.",
            "method": "MongoDB Mongoose lookup + HTTPS JSON-RPC query (eth_call) to Sepolia RPC (ethereum-sepolia-rpc.publicnode.com).",
            "sec": "Anonymized identity: Citizen raw Voter ID is never sent to public blockchain. Dual pre-flight: checks both MongoDB hasVoted flag and smart contract.",
            "time": "~ 80 - 180 ms (0.13 seconds)"
        },
        {
            "num": "STEP 7",
            "title": "Authorization Token Issuance: Backend -> ESP32",
            "info": "What Happens: If voter is eligible (has not voted), the server generates a single-use authorization token using HMAC-SHA256, binds it to the voter's identity and current election round, sets a 60-second expiration, and returns HTTP 200 to the ESP32.",
            "data": "Authorization receipt with citizen name, franchise region, allowed parties, and single-use cryptographic token.",
            "form": "JSON Payload: { \"authorized\": true, \"voter\": { \"name\": \"Vallabh\", \"region\": \"Konkan\" }, \"authorizationToken\": \"AUTH_872A...\" } (~350B).",
            "method": "HTTP 200 OK Response over Wi-Fi 802.11n TCP/IP link.",
            "sec": "HMAC-SHA256 signature binding voter ID, round, and nonce. Strict 60-second expiration. Single-use: revoked immediately upon voting.",
            "time": "~ 25 - 40 ms (0.03 seconds)"
        },
        {
            "num": "STEP 8",
            "title": "Voter Balloting (Party Selection on Terminal)",
            "info": "What Happens: ESP32 receives the token, clears the display, shows 'Authorized! Vallabh Joshi', and triggers a happy chime. The voter taps one of 4 capacitive touch buttons (1:BJP, 2:UBT, 3:Congress, 4:AIMIM). Hardware debounce filters noise, and the chosen party is locked in.",
            "data": "Capacitive finger touch triggers digital pulse, identifying selected candidate party (BJP, UBT, Congress, or AIMIM).",
            "form": "Analog human capacitance -> Digital HIGH/LOW voltage pulse (3.3V) across ESP32 GPIO pins (13, 14, 25, 26).",
            "method": "Hardware GPIO interrupt / polling loop with 50 ms software debounce filter.",
            "sec": "25-second countdown timer: session aborts if voter takes too long. Mutual exclusion lock: exactly one party tap is accepted per cycle.",
            "time": "~ 2.0 - 5.0 seconds (Human reaction time)"
        },
        {
            "num": "STEP 9",
            "title": "Vote Dispatch: ESP32 Terminal -> Node.js Web3 Relayer",
            "info": "What Happens: ESP32 packages voterID, party, region, district, and authorizationToken into JSON and transmits an HTTP POST to /api/blockchain/vote over Wi-Fi. The backend verifies the token and confirms the party is valid for the citizen's region.",
            "data": "Citizen ID, selected party, registered constituency, and authorization token.",
            "form": "JSON Payload: { \"voterID\": \"FP_UID_1\", \"party\": \"BJP\", \"region\": \"Konkan\", \"authorizationToken\": \"AUTH_...\" } (~280B).",
            "method": "Wi-Fi TCP/IP HTTP POST /api/blockchain/vote (Port 3000).",
            "sec": "Authorization token verified before accepting payload. Regional franchise check: rejects votes for parties outside voter's registered region.",
            "time": "~ 30 - 50 ms (0.04 seconds)"
        },
        {
            "num": "STEP 10",
            "title": "Cryptographic Anonymization & Transaction Signing",
            "info": "What Happens: The Node.js Web3 Relayer strips the citizen's personal name and Voter ID. It calculates voterHash = SHA-256(voterID + activeSalt). It prepares the Ethereum transaction calling smart contract castVote(voterHash, 'BJP') and signs it with the relayer's Secp256k1 private key.",
            "data": "voterHash = SHA-256(voterID + activeSalt). Smart contract invocation: castVote(voterHash, \"BJP\").",
            "form": "ABI-encoded Ethereum transaction payload signed with relayer's Secp256k1 private key (~180 bytes raw hex).",
            "method": "Internal Ethers.js v6 runtime + Keccak-256 + ECDSA signature (secp256k1 curve).",
            "sec": "Decoupled Zero-Knowledge privacy: Citizen identity is permanently unlinked from ballot. Dynamic salt prevents rainbow tables. Nonce queue prevents collisions.",
            "time": "~ 15 - 25 ms (0.02 seconds)"
        },
        {
            "num": "STEP 11",
            "title": "Blockchain Broadcast & Consensus Confirmation",
            "info": "What Happens: The relayer transmits the signed transaction to Ethereum Sepolia via JSON-RPC. Global Proof-of-Stake validator nodes order the transaction into the mempool and mint it into a block. The vote is now permanently immutable.",
            "data": "Signed raw transaction hex broadcasted to mempool, validated by Sepolia Proof-of-Stake nodes, and confirmed in block.",
            "form": "JSON-RPC eth_sendRawTransaction hex string -> Ethereum Sepolia block header & transaction receipt.",
            "method": "Ethereum JSON-RPC over HTTPS (TLS 1.3) to Sepolia RPC validator network.",
            "sec": "Decentralized consensus: Proof-of-Stake validator consensus ensures 100% immutability. Irreversible, publicly verifiable on Etherscan.",
            "time": "Relay acceptance: ~ 50 ms | Block Mining: ~ 12 - 15 s (Simulation: 10 ms)"
        },
        {
            "num": "STEP 12",
            "title": "Dual-Storage Commit & Audit Trail Logging",
            "info": "What Happens: Node.js records the cast vote in the regional MongoDB collection (votes_konkan) with party, txHash, and blockNumber. It updates hasVoted = true on the voter's record in voters_konkan and fingerprintvoters, and creates an audit log entry with an Indian Standard Time (IST) timestamp.",
            "data": "Transaction hash, block number, party, region, timestamp, and updated voter status (hasVoted = true).",
            "form": "BSON binary document over TLS connection to MongoDB Atlas database.",
            "method": "MongoDB Wire Protocol with TLS 1.3 encryption across cluster replica sets.",
            "sec": "Atomic document updates (findOneAndUpdate). AES-256 storage encryption at rest. Audit log preserved in IST format.",
            "time": "~ 25 - 45 ms (0.03 seconds)"
        },
        {
            "num": "STEP 13",
            "title": "Terminal Confirmation & Voter Feedback",
            "info": "What Happens: Node.js returns HTTP 200 receipt to ESP32 with the transaction hash and block number. ESP32 triggers 3 short pips and 1 long confirmation tone on the buzzer, displays 'Vote Recorded! Secured on Web3' on the LCD for 2.5 seconds, clears local memory, and returns to standby scan mode.",
            "data": "Receipt JSON with transaction hash and block number -> LCD display command -> Buzzer audio tone trigger.",
            "form": "JSON Receipt (~200B) -> I2C bus byte packet (0x27 address) -> GPIO 33 PWM audio tone.",
            "method": "Wi-Fi TCP/IP -> I2C Display Bus (100 kHz) -> Hardware PWM Active Buzzer chime.",
            "sec": "Immediate session termination: local voter tracking flags updated, memory buffers cleared, terminal returns to standby prompt.",
            "time": "~ 2.5 seconds (Visual & audio confirmation)"
        }
    ]

    for s in steps_data:
        box_data = [
            [
                Paragraph(f"<b>{s['num']}: {s['title']}</b>", step_title_style),
                Paragraph(f"<b>⏱️ {s['time']}</b>", ParagraphStyle('TR', parent=step_title_style, alignment=2, textColor=SECONDARY))
            ],
            [
                Paragraph(f"<b>ℹ️ What Happens:</b> {s['info']}", body_style),
                ""
            ],
            [
                Paragraph(f"<b>📦 Data Transferred:</b> {s['data']}", body_style),
                ""
            ],
            [
                Paragraph(f"<b>📝 Form / Format:</b> {s['form']}", body_style),
                ""
            ],
            [
                Paragraph(f"<b>⚡ Method / Protocol:</b> {s['method']}", body_style),
                ""
            ],
            [
                Paragraph(f"<b>🛡️ Security Applied:</b> {s['sec']}", body_style),
                ""
            ]
        ]

        t_step = Table(box_data, colWidths=[5.6 * inch, 1.8 * inch])
        t_step.setStyle(TableStyle([
            ('SPAN', (0, 1), (1, 1)),
            ('SPAN', (0, 2), (1, 2)),
            ('SPAN', (0, 3), (1, 3)),
            ('SPAN', (0, 4), (1, 4)),
            ('SPAN', (0, 5), (1, 5)),
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#F1F5F9")),
            ('BOX', (0, 0), (-1, -1), 0.75, colors.HexColor("#CBD5E1")),
            ('LINEBELOW', (0, 0), (-1, 0), 1, SECONDARY),
            ('PADDING', (0, 0), (-1, -1), 4),
            ('VALIGN', (0, 0), (-1, -1), 'TOP')
        ]))

        story.append(t_step)
        story.append(Spacer(1, 5))

        if s['num'] == "STEP 4":
            story.append(PageBreak())
        elif s['num'] == "STEP 8":
            story.append(PageBreak())

    story.append(PageBreak())

    # =========================================================================
    # PAGE 5: MASTER SUMMARY MATRIX TABLE & SECURITY ANALYSIS
    # =========================================================================
    story.append(Paragraph("MASTER DATA TRANSFER, SECURITY & TIMING MATRIX", section_heading))
    story.append(Paragraph("Side-by-side comparison of every step in the VoteChain voting lifecycle:", body_muted))
    story.append(Spacer(1, 6))

    matrix_rows = [
        [
            Paragraph("Step # & Stage", table_header_style),
            Paragraph("Data Form / Format", table_header_style),
            Paragraph("Method / Protocol", table_header_style),
            Paragraph("Security Applied", table_header_style),
            Paragraph("Time", table_header_style)
        ],
        [
            Paragraph("<b>1. Optical Scan</b>", table_cell_bold),
            Paragraph("Photons -> 256x288 Grayscale", table_cell_style),
            Paragraph("TIR Optical CMOS", table_cell_style),
            Paragraph("Anti-tamper Prism, Volatile RAM", table_cell_style),
            Paragraph("150 ms", table_cell_bold)
        ],
        [
            Paragraph("<b>2. Minutiae DSP</b>", table_cell_bold),
            Paragraph("512-Byte Feature Vector", table_cell_style),
            Paragraph("AS608 Internal DSP", table_cell_style),
            Paragraph("One-Way Minutiae, Zero Flash", table_cell_style),
            Paragraph("100 ms", table_cell_bold)
        ],
        [
            Paragraph("<b>3. UART Transfer</b>", table_cell_bold),
            Paragraph("4x 139B Binary Frames", table_cell_style),
            Paragraph("UART Serial2 (57.6k)", table_cell_style),
            Paragraph("16-Bit Packet Checksum", table_cell_style),
            Paragraph("90 ms", table_cell_bold)
        ],
        [
            Paragraph("<b>4. Wi-Fi API Post</b>", table_cell_bold),
            Paragraph("1024-Char Hex JSON", table_cell_style),
            Paragraph("Wi-Fi HTTP /verify", table_cell_style),
            Paragraph("WPA2-AES Encryption, Watchdog", table_cell_style),
            Paragraph("45 ms", table_cell_bold)
        ],
        [
            Paragraph("<b>5. Engine Match</b>", table_cell_bold),
            Paragraph("Probe vs N Minutiae Tables", table_cell_style),
            Paragraph("Node.js In-Memory", table_cell_style),
            Paragraph("Spatial/Angular Gates (dr<=18px)", table_cell_style),
            Paragraph("30 ms", table_cell_bold)
        ],
        [
            Paragraph("<b>6. Double-Vote Preflight</b>", table_cell_bold),
            Paragraph("SHA-256 Hash + JSON-RPC", table_cell_style),
            Paragraph("Mongoose + Sepolia RPC", table_cell_style),
            Paragraph("Zero-Knowledge Salted Hash", table_cell_style),
            Paragraph("90 ms", table_cell_bold)
        ],
        [
            Paragraph("<b>7. Token Return</b>", table_cell_bold),
            Paragraph("HMAC Auth Token JSON", table_cell_style),
            Paragraph("HTTP 200 over Wi-Fi", table_cell_style),
            Paragraph("HMAC-SHA256, 60s Expiry", table_cell_style),
            Paragraph("30 ms", table_cell_bold)
        ],
        [
            Paragraph("<b>8. Touch Ballot</b>", table_cell_bold),
            Paragraph("Capacitive GPIO Pulse", table_cell_style),
            Paragraph("Hardware Interrupt", table_cell_style),
            Paragraph("25s Timeout, Mutual Exclusion", table_cell_style),
            Paragraph("2.5 s", table_cell_bold)
        ],
        [
            Paragraph("<b>9. Vote Dispatch</b>", table_cell_bold),
            Paragraph("Party + Auth Token JSON", table_cell_style),
            Paragraph("Wi-Fi HTTP /vote", table_cell_style),
            Paragraph("Regional Franchise Boundary", table_cell_style),
            Paragraph("40 ms", table_cell_bold)
        ],
        [
            Paragraph("<b>10. Anonymize & Sign</b>", table_cell_bold),
            Paragraph("ABI castVote(Hash, Party)", table_cell_style),
            Paragraph("Ethers.js v6 ECDSA", table_cell_style),
            Paragraph("Secp256k1 Curve, Nonce Queue", table_cell_style),
            Paragraph("20 ms", table_cell_bold)
        ],
        [
            Paragraph("<b>11. Sepolia Consensus</b>", table_cell_bold),
            Paragraph("Raw Signed Tx Hex", table_cell_style),
            Paragraph("JSON-RPC HTTPS / TLS", table_cell_style),
            Paragraph("PoS Global Consensus, Immutable", table_cell_style),
            Paragraph("12 s (Block)", table_cell_bold)
        ],
        [
            Paragraph("<b>12. Dual Storage</b>", table_cell_bold),
            Paragraph("BSON Audit & Regional Doc", table_cell_style),
            Paragraph("MongoDB Protocol TLS", table_cell_style),
            Paragraph("AES-256 At Rest, Atomic Ops", table_cell_style),
            Paragraph("35 ms", table_cell_bold)
        ],
        [
            Paragraph("<b>13. LCD Receipt</b>", table_cell_bold),
            Paragraph("JSON Receipt + Audio PWM", table_cell_style),
            Paragraph("I2C 0x27 + GPIO 33", table_cell_style),
            Paragraph("Session Cleared, Immediate Reset", table_cell_style),
            Paragraph("2.5 s", table_cell_bold)
        ]
    ]

    t_matrix = Table(matrix_rows, colWidths=[1.35 * inch, 1.5 * inch, 1.4 * inch, 2.25 * inch, 0.9 * inch])
    t_matrix.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), PRIMARY),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('ALIGN', (4, 1), (4, -1), 'CENTER'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
        ('PADDING', (0, 0), (-1, -1), 3.2),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE')
    ]))

    story.append(t_matrix)
    story.append(Spacer(1, 10))

    # Core Security Principles Summary
    story.append(Paragraph("THE FIVE PILLARS OF VOTECHAIN SECURITY", section_heading))
    
    pillars_text = """
    <b>1. Zero Sensor Flash Persistence:</b> At no time is citizen biometric minutiae committed to the R307 sensor's non-volatile EEPROM memory. All capture, feature extraction, and transfer occur in volatile SRAM buffers that vanish immediately when power is cycled.<br/>
    <b>2. Point-to-Point Hardware Isolation:</b> The serial channel between the optical sensor and ESP32 utilizes a dedicated physical UART bus guarded by 16-bit arithmetic checksums on every packet frame.<br/>
    <b>3. Decoupled Identity & One-Way Anonymization:</b> Citizen Voter IDs are never broadcast to the public blockchain. A one-way salted SHA-256 digest decouples voter demographic records in MongoDB from the immutable vote cast on Ethereum Sepolia.<br/>
    <b>4. Single-Use Cryptographic Authorization:</b> Every ballot requires a server-issued HMAC-SHA256 authorization token with a strict 60-second expiration. The token is revoked the millisecond the vote is cast, preventing replay and ballot stuffing.<br/>
    <b>5. Immutable Proof-of-Stake Consensus:</b> Once the transaction is mined into an Ethereum block, it is cryptographically sealed by global validators. No electoral administrator, politician, or attacker can alter, delete, or re-order cast ballots.
    """
    story.append(Paragraph(pillars_text, body_style))

    # Build PDF
    doc.build(story, canvasmaker=NumberedCanvas)
    print("✅ Complete PDF document generated successfully at:", pdf_path)


if __name__ == "__main__":
    docs_dir = os.path.dirname(os.path.abspath(__file__))
    diagram_output = os.path.join(docs_dir, "data_transfer_flow_diagram.png")
    pdf_output = os.path.join(docs_dir, "VoteChain_Data_Transfer_Security_Flow.pdf")

    # Step 1: Generate Diagram
    generate_flow_diagram(diagram_output)

    # Step 2: Build PDF
    build_transfer_flow_pdf(pdf_output, diagram_output)
