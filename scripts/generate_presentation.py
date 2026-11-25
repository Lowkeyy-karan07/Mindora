import os
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.enum.text import PP_ALIGN
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE

def create_deck():
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)

    blank_layout = prs.slide_layouts[6] # Blank slide layout

    # Colors
    NAVY = RGBColor(15, 23, 42)        # #0F172A
    SLATE_DARK = RGBColor(30, 41, 59)  # #1E293B
    SLATE_MUTED = RGBColor(100, 116, 139) # #64748B
    TEAL_PRIMARY = RGBColor(13, 148, 136) # #0D9488
    TEAL_DARK = RGBColor(15, 118, 110) # #0F766E
    EMERALD = RGBColor(16, 185, 129)   # #10B981
    BG_LIGHT = RGBColor(248, 250, 252) # #F8FAFC
    CARD_BG = RGBColor(255, 255, 255)  # #FFFFFF
    CARD_BORDER = RGBColor(226, 232, 240) # #E2E8F0
    ACCENT_BG = RGBColor(240, 253, 250) # #F0FDFA
    ROSE = RGBColor(225, 29, 72)       # #E11D48
    AMBER = RGBColor(217, 119, 6)      # #D97706
    WHITE = RGBColor(255, 255, 255)

    def add_header(slide, category, title, subtitle):
        # Category Badge
        cat_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.45), Inches(8), Inches(0.3))
        tf_cat = cat_box.text_frame
        tf_cat.word_wrap = True
        tf_cat.margin_left = tf_cat.margin_top = tf_cat.margin_right = tf_cat.margin_bottom = 0
        p_cat = tf_cat.paragraphs[0]
        p_cat.text = category.upper()
        p_cat.font.size = Pt(10)
        p_cat.font.bold = True
        p_cat.font.color.rgb = TEAL_PRIMARY

        # Title
        title_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.75), Inches(11.733), Inches(0.55))
        tf_title = title_box.text_frame
        tf_title.word_wrap = True
        tf_title.margin_left = tf_title.margin_top = tf_title.margin_right = tf_title.margin_bottom = 0
        p_title = tf_title.paragraphs[0]
        p_title.text = title
        p_title.font.size = Pt(22)
        p_title.font.bold = True
        p_title.font.color.rgb = NAVY

        # Subtitle
        sub_box = slide.shapes.add_textbox(Inches(0.8), Inches(1.35), Inches(11.733), Inches(0.4))
        tf_sub = sub_box.text_frame
        tf_sub.word_wrap = True
        tf_sub.margin_left = tf_sub.margin_top = tf_sub.margin_right = tf_sub.margin_bottom = 0
        p_sub = tf_sub.paragraphs[0]
        p_sub.text = subtitle
        p_sub.font.size = Pt(13)
        p_sub.font.color.rgb = SLATE_MUTED

    # =========================================================================
    # SLIDE 1: Problem and Motivation
    # =========================================================================
    slide1 = prs.slides.add_slide(blank_layout)
    add_header(
        slide1,
        "Problem & Motivation",
        "The Core Problem: Choice Paralysis Under Acute Stress",
        "Why existing wellbeing apps fail when people need help the most"
    )

    # Core Problem Callout Box (Top banner)
    callout = slide1.shapes.add_shape(
        MSO_SHAPE.ROUNDED_RECTANGLE,
        Inches(0.8), Inches(1.9), Inches(11.733), Inches(1.1)
    )
    callout.fill.solid()
    callout.fill.fore_color.rgb = ACCENT_BG
    callout.line.color.rgb = TEAL_PRIMARY
    callout.line.width = Pt(1.5)
    tf_callout = callout.text_frame
    tf_callout.word_wrap = True
    tf_callout.margin_left = Inches(0.3)
    tf_callout.margin_top = Inches(0.18)
    tf_callout.margin_right = Inches(0.3)
    p_c1 = tf_callout.paragraphs[0]
    p_c1.text = "THE SINGLE CORE PROBLEM STATEMENT:"
    p_c1.font.bold = True
    p_c1.font.size = Pt(11)
    p_c1.font.color.rgb = TEAL_DARK
    p_c2 = tf_callout.add_paragraph()
    p_c2.text = "People experiencing everyday stress or cognitive overload cannot easily decide which simple wellbeing practice suits their immediate mood. Decision fatigue prevents action."
    p_c2.font.bold = True
    p_c2.font.size = Pt(14)
    p_c2.font.color.rgb = NAVY

    # Left Column: The Status Quo (Failure Mode)
    card_left = slide1.shapes.add_shape(
        MSO_SHAPE.ROUNDED_RECTANGLE,
        Inches(0.8), Inches(3.2), Inches(5.7), Inches(3.7)
    )
    card_left.fill.solid()
    card_left.fill.fore_color.rgb = CARD_BG
    card_left.line.color.rgb = CARD_BORDER
    tf_l = card_left.text_frame
    tf_l.word_wrap = True
    tf_l.margin_left = Inches(0.3)
    tf_l.margin_top = Inches(0.25)
    tf_l.margin_right = Inches(0.3)
    
    p_lt = tf_l.paragraphs[0]
    p_lt.text = "Current Landscape: High Friction & Cognitive Strain"
    p_lt.font.bold = True
    p_lt.font.size = Pt(14)
    p_lt.font.color.rgb = ROSE
    
    points_left = [
        ("Endless Practice Catalogs: ", "Apps present 500+ meditation libraries, complex filters, and multi-tier subscriptions, triggering decision paralysis."),
        ("Open-Ended Chat Prompts: ", "Generic chatbots require users to articulate long personal prompts precisely when mentally exhausted."),
        ("Clinical Intimidation: ", "Psychiatric assessment jargon creates unease for everyday workplace or academic stress."),
        ("Outcome: ", "Users abandon the session before taking a single mindful breath.")
    ]
    for title, desc in points_left:
        p = tf_l.add_paragraph()
        p.space_before = Pt(8)
        run_t = p.add_run()
        run_t.text = "• " + title
        run_t.font.bold = True
        run_t.font.size = Pt(11)
        run_t.font.color.rgb = SLATE_DARK
        run_d = p.add_run()
        run_d.text = desc
        run_d.font.size = Pt(11)
        run_d.font.color.rgb = SLATE_MUTED

    # Right Column: Mindora's Solution
    card_right = slide1.shapes.add_shape(
        MSO_SHAPE.ROUNDED_RECTANGLE,
        Inches(6.833), Inches(3.2), Inches(5.7), Inches(3.7)
    )
    card_right.fill.solid()
    card_right.fill.fore_color.rgb = CARD_BG
    card_right.line.color.rgb = CARD_BORDER
    tf_r = card_right.text_frame
    tf_r.word_wrap = True
    tf_r.margin_left = Inches(0.3)
    tf_r.margin_top = Inches(0.25)
    tf_r.margin_right = Inches(0.3)

    p_rt = tf_r.paragraphs[0]
    p_rt.text = "Mindora's Approach: Instant Relief in 3 Taps"
    p_rt.font.bold = True
    p_rt.font.size = Pt(14)
    p_rt.font.color.rgb = TEAL_PRIMARY

    points_right = [
        ("One 5-Second Mood Check-in: ", "Five visually distinct emotional states (Anxious, Stressed, Sad, Overwhelmed, Okay) + optional brief note."),
        ("Exactly 3 Explained Recommendations: ", "No scrolling or searching. Three scored options with warm, non-clinical explanations for why they fit right now."),
        ("Immediate In-App Practice Player: ", "Dedicated interactive timers, breathing circles, grounding steps, and journal pads—not audio lectures."),
        ("Continuous Feedback Personalization: ", "A single-tap post-activity rating ('Yes' / 'A little' / 'No') quietly calibrates future recommendations.")
    ]
    for title, desc in points_right:
        p = tf_r.add_paragraph()
        p.space_before = Pt(8)
        run_t = p.add_run()
        run_t.text = "✔ " + title
        run_t.font.bold = True
        run_t.font.size = Pt(11)
        run_t.font.color.rgb = SLATE_DARK
        run_d = p.add_run()
        run_d.text = desc
        run_d.font.size = Pt(11)
        run_d.font.color.rgb = SLATE_MUTED

    # Speaker Notes Slide 1
    slide1.notes_slide.notes_text_frame.text = (
        "Welcome everyone. Today I am presenting Mindora, an autonomous wellbeing coach web application designed around a very specific software engineering insight.\n\n"
        "Most digital health tools fail not because of their content, but because of cognitive friction. When a person is experiencing acute stress, panic, or emotional heaviness, executive cognitive function degrades. Deciding what to do is itself a major obstacle.\n\n"
        "Commercial wellness apps ask users to browse libraries of hundreds of meditations, select durations, or converse with an open-ended chatbot. This triggers choice paralysis and decision fatigue. Under stress, people don't want a 20-minute search; they need decision relief.\n\n"
        "Mindora was engineered around ONE core problem: people under everyday stress cannot easily decide which simple wellbeing activity suits their mood.\n\n"
        "Our answer is radical simplicity: one 5-second check-in with 5 distinct moods, an instant safety evaluation, and exactly three explained suggestions. In just three taps and under two seconds, the user is already engaged in an active, guided exercise. Let's look at the software architecture that makes this both safe and deterministic."
    )

    # =========================================================================
    # SLIDE 2: Approach and Software Engineering Role
    # =========================================================================
    slide2 = prs.slides.add_slide(blank_layout)
    add_header(
        slide2,
        "System Architecture & Engineering Discipline",
        "Layered Architecture & Strict Software Engineering Controls",
        "How rigorous software engineering ensures safety, determinism, and privacy"
    )

    # Architectural Flow Diagram (4 Columns / Stages)
    stages = [
        {
            "num": "01",
            "title": "Client UI Layer",
            "tech": "Next.js 16 App Router",
            "items": [
                "5 Mood Cards (distinct color)",
                "Optional Note (<= 300 chars)",
                "Accessible interactive players",
                "prefers-reduced-motion CSS",
                "Universal safety footer"
            ],
            "color": TEAL_PRIMARY
        },
        {
            "num": "02",
            "title": "Safety Gatekeeper",
            "tech": "Phrase-Based Interceptor",
            "items": [
                "Runs FIRST before DB or AI",
                "Whole-phrase crisis list",
                "Matches self-harm / suicide",
                "Zero sensitive data logged",
                "Returns crisis resources immediately"
            ],
            "color": ROSE
        },
        {
            "num": "03",
            "title": "Hybrid Recommender",
            "tech": "Pure Rules + Gemini LLM",
            "items": [
                "11 Curated activities catalog",
                "Score = Mood + Feedback - Recency",
                "Deterministic ID tie-breaking",
                "Constrained Gemini (5s timeout)",
                "Automatic fallback to rules"
            ],
            "color": TEAL_PRIMARY
        },
        {
            "num": "04",
            "title": "Data & Persistence",
            "tech": "SQLite (better-sqlite3)",
            "items": [
                "Zero-cloud local persistence",
                "WAL mode enabled",
                "Atomic transaction deletion",
                "Zero logging of notes/journals",
                "Idempotent database seeding"
            ],
            "color": SLATE_DARK
        }
    ]

    col_width = Inches(2.75)
    gap = Inches(0.24)
    start_left = Inches(0.8)
    top_y = Inches(1.9)
    box_height = Inches(3.6)

    for i, st in enumerate(stages):
        x = start_left + i * (col_width + gap)
        box = slide2.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, top_y, col_width, box_height)
        box.fill.solid()
        box.fill.fore_color.rgb = CARD_BG
        box.line.color.rgb = st["color"]
        box.line.width = Pt(1.5)

        tf = box.text_frame
        tf.word_wrap = True
        tf.margin_left = Inches(0.18)
        tf.margin_top = Inches(0.18)
        tf.margin_right = Inches(0.18)

        # Stage number
        p0 = tf.paragraphs[0]
        p0.text = f"LAYER {st['num']}"
        p0.font.size = Pt(9)
        p0.font.bold = True
        p0.font.color.rgb = st["color"]

        # Stage Title
        p1 = tf.add_paragraph()
        p1.text = st["title"]
        p1.font.size = Pt(13)
        p1.font.bold = True
        p1.font.color.rgb = NAVY

        # Tech Badge
        p2 = tf.add_paragraph()
        p2.text = st["tech"]
        p2.font.size = Pt(10)
        p2.font.color.rgb = SLATE_MUTED
        p2.space_after = Pt(8)

        # Bullet points
        for item in st["items"]:
            p = tf.add_paragraph()
            p.text = "• " + item
            p.font.size = Pt(9.5)
            p.font.color.rgb = SLATE_DARK
            p.space_before = Pt(3)

    # Bottom Banner: Software Engineering Pillars
    se_banner = slide2.shapes.add_shape(
        MSO_SHAPE.ROUNDED_RECTANGLE,
        Inches(0.8), Inches(5.7), Inches(11.733), Inches(1.3)
    )
    se_banner.fill.solid()
    se_banner.fill.fore_color.rgb = BG_LIGHT
    se_banner.line.color.rgb = CARD_BORDER
    tf_se = se_banner.text_frame
    tf_se.word_wrap = True
    tf_se.margin_left = Inches(0.25)
    tf_se.margin_top = Inches(0.15)
    tf_se.margin_right = Inches(0.25)

    p_set = tf_se.paragraphs[0]
    p_set.text = "SOFTWARE ENGINEERING DISCIPLINE & GOVERNANCE"
    p_set.font.bold = True
    p_set.font.size = Pt(10)
    p_set.font.color.rgb = TEAL_PRIMARY

    p_sed = tf_se.add_paragraph()
    p_sed.space_before = Pt(4)
    run1 = p_sed.add_run()
    run1.text = "• IEEE 830 Specification: "
    run1.font.bold = True
    run1.font.size = Pt(10)
    run1.font.color.rgb = NAVY
    run1_d = p_sed.add_run()
    run1_d.text = "Comprehensive SRS detailing FR-1 through FR-8 and NFR-1 through NFR-5 with strict non-goals.  "
    run1_d.font.size = Pt(10)
    run1_d.font.color.rgb = SLATE_MUTED

    run2 = p_sed.add_run()
    run2.text = "• 100% Traceability: "
    run2.font.bold = True
    run2.font.size = Pt(10)
    run2.font.color.rgb = NAVY
    run2_d = p_sed.add_run()
    run2_d.text = "Every functional requirement has explicit automated test cases in Vitest and Playwright.  "
    run2_d.font.size = Pt(10)
    run2_d.font.color.rgb = SLATE_MUTED

    run3 = p_sed.add_run()
    run3.text = "• Separation of Concerns: "
    run3.font.bold = True
    run3.font.size = Pt(10)
    run3.font.color.rgb = NAVY
    run3_d = p_sed.add_run()
    run3_d.text = "Pure functional recommendation scoring decoupled from DB queries; zero logging of private notes."
    run3_d.font.size = Pt(10)
    run3_d.font.color.rgb = SLATE_MUTED

    # Speaker Notes Slide 2
    slide2.notes_slide.notes_text_frame.text = (
        "On this slide, you see Mindora's four architectural layers, alongside the software engineering discipline that governs the project.\n\n"
        "Layer 1 is our client UI, built on Next.js 16 with accessible, mobile-first Tailwind design and motion-reduction support.\n\n"
        "Layer 2 is our safety gatekeeper. This is a critical engineering decision: checkSafety executes BEFORE anything else. If a crisis phrase is detected in the user's note, the system immediately returns supportive human resources. It stores nothing sensitive, generates zero check-in logs, and completely halts the recommendation pipeline.\n\n"
        "Layer 3 is our hybrid recommender. We start with pure functional scoring: mood matches receive +10 points, historical feedback adds up to +2 or demotes by -2, and a -1.5 penalty prevents showing practices completed in the last 24 hours. When AI is enabled, Google Gemini is strictly constrained: it cannot invent activities or diagnose; it can only select from the vetted candidate list and provide warm 25-word rationales. If Gemini times out after 5 seconds or fails schema validation, the engine instantly falls back to rule-based recommendations with zero interruption to the user.\n\n"
        "Layer 4 is local SQLite in WAL mode. No user data leaves the machine.\n\n"
        "Crucially, this is backed by an IEEE 830 specification with complete traceability: every requirement from FR-1 to FR-8 maps to automated unit and Playwright tests."
    )

    # =========================================================================
    # SLIDE 3: Why This Approach (Table Comparison)
    # =========================================================================
    slide3 = prs.slides.add_slide(blank_layout)
    add_header(
        slide3,
        "Architectural Rationale & Trade-offs",
        "Why This Engineering Approach? Key Architectural Decisions",
        "Evaluating our chosen architecture against common industry alternatives"
    )

    # Comparison Table
    rows = 5
    cols = 4
    left = Inches(0.8)
    top = Inches(1.9)
    width = Inches(11.733)
    height = Inches(4.8)

    table_shape = slide3.shapes.add_table(rows, cols, left, top, width, height)
    tbl = table_shape.table

    # Column widths
    tbl.columns[0].width = Inches(2.2) # Dimension
    tbl.columns[1].width = Inches(3.1) # Chosen Architecture
    tbl.columns[2].width = Inches(2.6) # Alternative Considered
    tbl.columns[3].width = Inches(3.833) # Strategic Rationale

    table_data = [
        [
            "Decision Dimension",
            "Mindora's Chosen Architecture",
            "Alternative Considered",
            "Strategic Engineering Rationale"
        ],
        [
            "Recommender Strategy",
            "Rules + Constrained LLM\n(Deterministic Scoring + 5s Timeout)",
            "Plain Conversational ChatGPT\n(Open prompt interaction)",
            "Eliminates hallucinated exercises; enforces strict schema; guarantees instant fallback to rules if API is offline or slow."
        ],
        [
            "Activity Delivery",
            "Curated Catalogue (11 Activities)\n(Breathing, Grounding, Journal, Break)",
            "Dynamically Generated Advice\n(LLM creates exercises on the fly)",
            "Ensures clinical safety and structured UX (synchronized breathing rings, step wizards) that plain text prompts cannot provide."
        ],
        [
            "Data Persistence",
            "Embedded SQLite (better-sqlite3)\n(Local DB, WAL mode, pure SQL)",
            "Hosted Postgres / Prisma ORM\n(Cloud database service)",
            "Guarantees absolute data privacy and zero hosting cost; atomic local data wiping in one transaction; eliminates network DB latency."
        ],
        [
            "System Topology",
            "Fullstack Monolith (Next.js 16)\n(App Router + nodejs API routes)",
            "Distributed Microservices\n(Separate backend, frontend & auth)",
            "Zero network overhead between UI and handlers; single shared TypeScript types; trivial zero-dependency deployment for end-users."
        ]
    ]

    for r_idx, row in enumerate(table_data):
        for c_idx, val in enumerate(row):
            cell = tbl.cell(r_idx, c_idx)
            cell.text = val
            p = cell.text_frame.paragraphs[0]
            p.font.size = Pt(10)
            
            # Format header row
            if r_idx == 0:
                cell.fill.solid()
                cell.fill.fore_color.rgb = SLATE_DARK
                p.font.bold = True
                p.font.size = Pt(10.5)
                p.font.color.rgb = WHITE
                p.alignment = PP_ALIGN.LEFT
            else:
                # Alternating row colors
                cell.fill.solid()
                if r_idx % 2 == 1:
                    cell.fill.fore_color.rgb = CARD_BG
                else:
                    cell.fill.fore_color.rgb = BG_LIGHT
                
                # Highlight Mindora column
                if c_idx == 1:
                    p.font.bold = True
                    p.font.color.rgb = TEAL_DARK
                elif c_idx == 0:
                    p.font.bold = True
                    p.font.color.rgb = NAVY
                elif c_idx == 2:
                    p.font.color.rgb = ROSE
                else:
                    p.font.color.rgb = SLATE_DARK

    # Speaker Notes Slide 3
    slide3.notes_slide.notes_text_frame.text = (
        "Why did we build Mindora this way instead of hooking up a ChatGPT wrapper or deploying an enterprise microservice stack? This matrix explains the four key trade-offs.\n\n"
        "First, Recommendation Strategy: Many apps simply prompt an LLM to 'talk to the user.' But LLMs hallucinate, suffer latency spikes, and cannot guarantee deterministic outputs. Mindora uses a hybrid model: candidate scoring is done mathematically by rules. Gemini is only used to select and explain 3 items within a 5-second window. If Gemini fails, the rules engine takes over seamlessly.\n\n"
        "Second, Activity Delivery: Generating wellbeing advice dynamically is clinically risky. We use a curated catalog of 11 vetted practices across four types. Because activities have fixed structures, our UI can render synchronized breathing circles and step wizards that generic text responses can never deliver.\n\n"
        "Third, Data Persistence: People share vulnerable feelings during check-ins. Storing that in a cloud Postgres database creates compliance and privacy risks. By embedding SQLite locally with better-sqlite3 in WAL mode, data never leaves the user's computer, and wiping their entire history is a single atomic SQL transaction.\n\n"
        "Finally, System Topology: A Next.js fullstack monolith gives us zero-network IPC between UI and handlers, unified TypeScript schemas, and zero operational complexity."
    )

    # =========================================================================
    # SLIDE 4: Outcomes (Real Metrics & Test Results + 2 Screenshots)
    # =========================================================================
    slide4 = prs.slides.add_slide(blank_layout)
    add_header(
        slide4,
        "Empirical Outcomes & Verification",
        "Verified Results: 100% Test Pass Rate & Sub-Second Latency",
        "Empirical performance, comprehensive code coverage, and personalization proof"
    )

    # Left Column: Metrics and Verification Evidence
    # 4 Metric Cards in 2x2 Grid
    metrics = [
        {"val": "64 / 64", "lbl": "Automated Tests Passed", "sub": "59 Vitest (1.13s) + 5 Playwright (11.9s)", "col": TEAL_PRIMARY},
        {"val": "93.05%", "lbl": "Core Code Statement Coverage", "sub": "100% in catalog & safety modules", "col": EMERALD},
        {"val": "3 Taps", "lbl": "Friction to Start Practice", "sub": "Mood -> Suggestions -> Start Activity", "col": TEAL_PRIMARY},
        {"val": "0.99s – 1.09s", "lbl": "Time to Start Practice", "sub": "Measured wall-clock time from launch", "col": EMERALD},
    ]

    grid_left = Inches(0.8)
    grid_top = Inches(1.9)
    card_w = Inches(2.7)
    card_h = Inches(1.15)
    gap_x = Inches(0.2)
    gap_y = Inches(0.15)

    for idx, m in enumerate(metrics):
        r = idx // 2
        c = idx % 2
        bx = grid_left + c * (card_w + gap_x)
        by = grid_top + r * (card_h + gap_y)

        b = slide4.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, bx, by, card_w, card_h)
        b.fill.solid()
        b.fill.fore_color.rgb = CARD_BG
        b.line.color.rgb = CARD_BORDER
        tf_m = b.text_frame
        tf_m.word_wrap = True
        tf_m.margin_left = Inches(0.15)
        tf_m.margin_top = Inches(0.12)
        tf_m.margin_right = Inches(0.15)

        pv = tf_m.paragraphs[0]
        pv.text = m["val"]
        pv.font.bold = True
        pv.font.size = Pt(17)
        pv.font.color.rgb = m["col"]

        pl = tf_m.add_paragraph()
        pl.text = m["lbl"]
        pl.font.bold = True
        pl.font.size = Pt(10)
        pl.font.color.rgb = NAVY

        ps = tf_m.add_paragraph()
        ps.text = m["sub"]
        ps.font.size = Pt(8.5)
        ps.font.color.rgb = SLATE_MUTED

    # Verification Evidence Box (Below Metrics)
    proof_box = slide4.shapes.add_shape(
        MSO_SHAPE.ROUNDED_RECTANGLE,
        Inches(0.8), Inches(4.5), Inches(5.6), Inches(2.4)
    )
    proof_box.fill.solid()
    proof_box.fill.fore_color.rgb = ACCENT_BG
    proof_box.line.color.rgb = TEAL_PRIMARY
    tf_p = proof_box.text_frame
    tf_p.word_wrap = True
    tf_p.margin_left = Inches(0.2)
    tf_p.margin_top = Inches(0.15)
    tf_p.margin_right = Inches(0.2)

    p_pt = tf_p.paragraphs[0]
    p_pt.text = "EMPIRICALLY PROVEN PERSONALIZATION & SAFETY"
    p_pt.font.bold = True
    p_pt.font.size = Pt(10)
    p_pt.font.color.rgb = TEAL_DARK

    proof_items = [
        ("Dynamic Ranking Shift: ", "Unit tests verify rating 'yes' promotes an activity (+2) while 'no' demotes it (-2) in subsequent check-ins."),
        ("24-Hour Recency Penalty: ", "Completing an activity applies a -1.5 score reduction, preventing repetitive suggestions."),
        ("Crisis Interception: ", "Tested across 28 unit scenarios and E2E browser runs; crisis phrases yield exactly 0 recommendations and display emergency support."),
        ("Atomic Data Wipe: ", "Verified via Playwright: 'Delete my data' wipes all user history atomically while keeping the user record intact.")
    ]
    for title, desc in proof_items:
        p = tf_p.add_paragraph()
        p.space_before = Pt(3)
        rt = p.add_run()
        rt.text = "✔ " + title
        rt.font.bold = True
        rt.font.size = Pt(9)
        rt.font.color.rgb = NAVY
        rd = p.add_run()
        rd.text = desc
        rd.font.size = Pt(9)
        rd.font.color.rgb = SLATE_DARK

    # Right Column: 2 App Screenshot Placeholders
    # Screenshot Placeholder 1
    shot1 = slide4.shapes.add_shape(
        MSO_SHAPE.ROUNDED_RECTANGLE,
        Inches(6.7), Inches(1.9), Inches(5.833), Inches(2.35)
    )
    shot1.fill.solid()
    shot1.fill.fore_color.rgb = BG_LIGHT
    shot1.line.color.rgb = CARD_BORDER
    shot1.line.dash_style = 2 # Dashed line
    tf_s1 = shot1.text_frame
    tf_s1.word_wrap = True
    p_s1 = tf_s1.paragraphs[0]
    p_s1.text = "📸 APP SCREENSHOT PLACEHOLDER 1\n[ Check-in Screen & 3 Explained Recommendations ]\n\nShows 5 distinct mood cards (Anxious selected), 300-char note input,\nand the resulting 3 tailored recommendation cards with 'Rules'/'AI' badges."
    p_s1.font.size = Pt(11)
    p_s1.font.color.rgb = SLATE_MUTED
    p_s1.alignment = PP_ALIGN.CENTER

    # Screenshot Placeholder 2
    shot2 = slide4.shapes.add_shape(
        MSO_SHAPE.ROUNDED_RECTANGLE,
        Inches(6.7), Inches(4.5), Inches(5.833), Inches(2.4)
    )
    shot2.fill.solid()
    shot2.fill.fore_color.rgb = BG_LIGHT
    shot2.line.color.rgb = CARD_BORDER
    shot2.line.dash_style = 2 # Dashed line
    tf_s2 = shot2.text_frame
    tf_s2.word_wrap = True
    p_s2 = tf_s2.paragraphs[0]
    p_s2.text = "📸 APP SCREENSHOT PLACEHOLDER 2\n[ Interactive Practice Player & Longitudinal Dashboard ]\n\nShows the animated Breathing Player with Stop control, followed by\nthe Wellbeing Dashboard with mood counts and feedback history."
    p_s2.font.size = Pt(11)
    p_s2.font.color.rgb = SLATE_MUTED
    p_s2.alignment = PP_ALIGN.CENTER

    # Speaker Notes Slide 4
    slide4.notes_slide.notes_text_frame.text = (
        "Here are the empirical outcomes of our software engineering effort. All numbers here are drawn directly from automated test runs and Playwright telemetry—nothing has been estimated.\n\n"
        "First, verification: we achieved a 100% test pass rate across 64 automated tests—59 unit and integration tests in Vitest executed in 1.13 seconds, and 5 full browser E2E tests in Playwright.\n\n"
        "Second, code coverage: our core business logic, safety engine, and repository layers have 93.05% statement coverage, with 100% coverage in both the safety phrase matcher and catalog modules.\n\n"
        "Third, usability telemetry: Playwright measured the exact journey from page load to starting an active practice. It takes exactly 3 taps and between 0.99 and 1.09 seconds. We eliminated all dead ends and search bars.\n\n"
        "Fourth, algorithmic proof: we validated that the feedback loop works. Rating an activity 'yes' adds 2 points and moves it up in future rankings, while 'no' demotes it by 2 points. And a 24-hour completion penalty prevents the same activity from monopolizing suggestions.\n\n"
        "On the right, you see placeholders for our two core views: the check-in and recommendation screen, and the interactive activity player and dashboard."
    )

    # =========================================================================
    # SLIDE 5: Innovation & Differentiation (Why not plain ChatGPT?)
    # =========================================================================
    slide5 = prs.slides.add_slide(blank_layout)
    add_header(
        slide5,
        "Innovation & Differentiation",
        "Why Mindora? Differentiation Beyond Conversational Chatbots",
        "Six distinct engineering advantages over generic AI chat interfaces"
    )

    # 6 Pillar Cards (2 rows of 3 columns)
    pillars = [
        {
            "icon": "🛡️",
            "title": "Safety Gate Before AI",
            "subtitle": "Deterministic Crisis Triage",
            "desc": "Keyword heuristic intercepts self-harm and crisis phrases immediately. Never transmits crisis notes to Gemini; instantly renders emergency helplines."
        },
        {
            "icon": "🧘",
            "title": "Curated Interactive UX",
            "subtitle": "Active Player vs Text Wall",
            "desc": "Instead of unformatted text advice, delivers synchronized expanding breathing rings, grounding step wizards, and structured journal pads."
        },
        {
            "icon": "⚡",
            "title": "Deterministic Fallback",
            "subtitle": "Zero-Downtime Guarantee",
            "desc": "If Gemini times out (5s), throws an error, or is unconfigured, the pure mathematical rules engine takes over seamlessly. Never shows an error screen."
        },
        {
            "icon": "🔄",
            "title": "Persistent Feedback Loop",
            "subtitle": "Implicit Personalization",
            "desc": "Every single-tap rating directly updates future ranking scores. A chatbot forgets your preferences the moment a chat context window closes."
        },
        {
            "icon": "🔒",
            "title": "Absolute Data Privacy",
            "subtitle": "Local Storage & Zero Logging",
            "desc": "Check-in thoughts and journals are stored locally in SQLite and never logged server-side. Gemini only receives anonymized candidate IDs and mood."
        },
        {
            "icon": "🎯",
            "title": "Zero-Cognitive Journey",
            "subtitle": "Prompting Burden Removed",
            "desc": "Removes the anxiety of the blank prompt box. In 3 taps and 1 second, users transition from distress to active guided relief."
        }
    ]

    p_w = Inches(3.7)
    p_h = Inches(2.25)
    p_gap_x = Inches(0.28)
    p_gap_y = Inches(0.25)
    p_left_start = Inches(0.8)
    p_top_start = Inches(1.9)

    for i, pil in enumerate(pillars):
        r = i // 3
        c = i % 3
        px = p_left_start + c * (p_w + p_gap_x)
        py = p_top_start + r * (p_h + p_gap_y)

        card = slide5.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, px, py, p_w, p_h)
        card.fill.solid()
        card.fill.fore_color.rgb = CARD_BG
        card.line.color.rgb = CARD_BORDER
        card.line.width = Pt(1.2)

        tf = card.text_frame
        tf.word_wrap = True
        tf.margin_left = Inches(0.2)
        tf.margin_top = Inches(0.18)
        tf.margin_right = Inches(0.2)

        # Header with icon
        p0 = tf.paragraphs[0]
        p0.text = f"{pil['icon']}  {pil['title']}"
        p0.font.bold = True
        p0.font.size = Pt(12.5)
        p0.font.color.rgb = NAVY

        p1 = tf.add_paragraph()
        p1.text = pil["subtitle"]
        p1.font.bold = True
        p1.font.size = Pt(9.5)
        p1.font.color.rgb = TEAL_PRIMARY
        p1.space_after = Pt(6)

        p2 = tf.add_paragraph()
        p2.text = pil["desc"]
        p2.font.size = Pt(10)
        p2.font.color.rgb = SLATE_DARK
        p2.space_before = Pt(2)

    # Speaker Notes Slide 5
    slide5.notes_slide.notes_text_frame.text = (
        "To conclude, let's address the most fundamental product question: Why not just use ChatGPT?\n\n"
        "First, Safety: ChatGPT evaluates safety via probabilistic model weights after the prompt is submitted. Mindora places a hard deterministic safety interceptor BEFORE any LLM or database operation. If crisis language is detected, it never reaches Gemini.\n\n"
        "Second, Interactive UX: An LLM outputs paragraphs of text. Reading walls of text is the last thing an anxious person needs. Mindora provides interactive tooling: an animated breathing circle with inhale/hold/exhale cues, a 5-step grounding wizard, and focused timers.\n\n"
        "Third, Resilience: If OpenAI or Google has an outage or rate-limit spike, a chatbot app breaks. Mindora falls back to deterministic mathematical ranking with 25-word templated reasons instantly.\n\n"
        "Fourth, Memory: Chatbots forget your preferences between chats unless you maintain complex cloud embeddings. Mindora's local SQLite database quietly tracks feedback scores and 24-hour recency penalties.\n\n"
        "Fifth, Privacy: We never log user notes to server consoles, and we only send anonymized candidate IDs to Gemini.\n\n"
        "Finally, Cognitive Load: A blank chat box demands articulation. Mindora requires only three taps.\n\n"
        "Mindora proves that disciplined software engineering, safety boundaries, and targeted UX produce a far more effective wellbeing tool than an open-ended conversational agent. Thank you, and I look forward to your questions."
    )

    output_path = os.path.abspath("docs/Mindora_Presentation.pptx")
    prs.save(output_path)
    print(f"Presentation saved successfully to {output_path}")

if __name__ == "__main__":
    create_deck()
