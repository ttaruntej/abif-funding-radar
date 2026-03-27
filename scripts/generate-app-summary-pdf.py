from pathlib import Path
import shutil

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    KeepInFrame,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parent.parent
OUTPUT_DIR = ROOT / "output" / "pdf"
PUBLIC_DIR = ROOT / "public" / "downloads"
TMP_DIR = ROOT / "tmp" / "pdfs"
FILENAME = "abif-funding-radar-app-summary.pdf"

OUTPUT_PATH = OUTPUT_DIR / FILENAME
PUBLIC_PATH = PUBLIC_DIR / FILENAME


def bullet(text):
    return Paragraph(f'&bull; {text}', STYLES["bullet"])


def section(title, body, accent):
    header = Paragraph(title, STYLES["section"])
    if isinstance(body, list):
        content = [header, Spacer(1, 2), *body]
    else:
        content = [header, Spacer(1, 2), body]

    wrapped = KeepInFrame(0, 0, content, mode="shrink")
    table = Table([[wrapped]], colWidths=[None])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.white),
                ("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor("#D7E3F4")),
                ("LINEBEFORE", (0, 0), (0, -1), 4, accent),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    return table


STYLES = getSampleStyleSheet()
STYLES.add(
    ParagraphStyle(
        name="eyebrow",
        parent=STYLES["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8.2,
        leading=10,
        textColor=colors.HexColor("#2563EB"),
        alignment=TA_CENTER,
        spaceAfter=2,
    )
)
STYLES.add(
    ParagraphStyle(
        name="app_title",
        parent=STYLES["Title"],
        fontName="Helvetica-Bold",
        fontSize=20,
        leading=22,
        textColor=colors.HexColor("#0F172A"),
        alignment=TA_CENTER,
        spaceAfter=4,
    )
)
STYLES.add(
    ParagraphStyle(
        name="app_subtitle",
        parent=STYLES["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=11,
        textColor=colors.HexColor("#475569"),
        alignment=TA_CENTER,
        spaceAfter=8,
    )
)
STYLES.add(
    ParagraphStyle(
        name="section",
        parent=STYLES["Heading3"],
        fontName="Helvetica-Bold",
        fontSize=9.2,
        leading=10.5,
        textColor=colors.HexColor("#0F172A"),
        spaceAfter=1,
    )
)
STYLES.add(
    ParagraphStyle(
        name="body",
        parent=STYLES["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#1E293B"),
        spaceAfter=0,
    )
)
STYLES.add(
    ParagraphStyle(
        name="bullet",
        parent=STYLES["Normal"],
        fontName="Helvetica",
        fontSize=8.2,
        leading=10.2,
        textColor=colors.HexColor("#1E293B"),
        leftIndent=8,
        firstLineIndent=-6,
        spaceAfter=1,
    )
)
STYLES.add(
    ParagraphStyle(
        name="footer_note",
        parent=STYLES["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8.3,
        leading=10.2,
        textColor=colors.HexColor("#0F172A"),
        alignment=TA_CENTER,
    )
)


def build_pdf():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    TMP_DIR.mkdir(parents=True, exist_ok=True)

    doc = SimpleDocTemplate(
        str(OUTPUT_PATH),
        pagesize=A4,
        leftMargin=14 * mm,
        rightMargin=14 * mm,
        topMargin=12 * mm,
        bottomMargin=12 * mm,
    )

    story = [
        Paragraph("Visitor Overview", STYLES["eyebrow"]),
        Paragraph("ABIF Funding Radar", STYLES["app_title"]),
        Paragraph(
            "A one-page guide for website visitors who want to understand the platform quickly, navigate it confidently, and share improvements through the suggestion box.",
            STYLES["app_subtitle"],
        ),
    ]

    intro_row = Table(
        [
            [
                section(
                    "What it is",
                    Paragraph(
                        "ABIF Funding Radar is a funding opportunity dashboard for Agri Business Incubation Foundation IIT Kharagpur. It helps visitors scan relevant grants, calls, and ecosystem support options without digging across multiple portals manually.",
                        STYLES["body"],
                    ),
                    colors.HexColor("#2563EB"),
                ),
                section(
                    "Who it's for",
                    Paragraph(
                        "Primary persona: startup and incubator teams at ABIF who need a quick, decision-ready view of grants, calls, schemes, and ecosystem support opportunities.",
                        STYLES["body"],
                    ),
                    colors.HexColor("#10B981"),
                ),
            ]
        ],
        colWidths=[88 * mm, 88 * mm],
        hAlign="LEFT",
    )
    intro_row.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
    story.extend([intro_row, Spacer(1, 6)])

    feature_bullets = [
        bullet("Audience-aware views for startup and incubator users, plus category, sector, status, and search filters."),
        bullet("Context-aware stats and an in-app briefing summary recalculated from the current filtered view."),
        bullet("Refresh workflow that triggers source sync and shows queue, progress, findings, and updated records."),
        bullet("CSV export and email briefing flows so teams can share filtered opportunities quickly."),
        bullet("User manual support for first-time visitors who want a guided walkthrough."),
        bullet("Suggestion box for reporting missing schemes, broken links, or improvement ideas."),
    ]
    story.extend(
        [
            section("What it does", feature_bullets, colors.HexColor("#7C3AED")),
            Spacer(1, 6),
        ]
    )

    lower_row = Table(
        [
            [
                section(
                    "How to use this website",
                    [
                        bullet("Sign in, choose the startup or incubator lens, and scan the numbers board for a quick read of the current list."),
                        bullet("Use search, category, sector, and status filters to narrow the list to the opportunities that match your needs."),
                        bullet("Open the user manual if you want a guided walkthrough before exploring the dashboard in detail."),
                        bullet("Use export or briefing actions when you want to share a short list with teammates or stakeholders."),
                    ],
                    colors.HexColor("#F59E0B"),
                ),
                section(
                    "Why visitors keep it open",
                    [
                        bullet("It reduces the time needed to discover relevant schemes across startup, incubator, national, state, international, and CSR categories."),
                        bullet("It helps teams move from browsing to action with filtering, export, and email-friendly briefing features."),
                        bullet("It gives visitors a clear place to suggest improvements instead of losing feedback in email threads."),
                        bullet("It supports regular review routines for founders, program teams, and ecosystem managers."),
                    ],
                    colors.HexColor("#EF4444"),
                ),
            ]
        ],
        colWidths=[88 * mm, 88 * mm],
        hAlign="LEFT",
    )
    lower_row.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
    story.extend([lower_row, Spacer(1, 6)])

    cta = Table(
        [
            [
                Paragraph(
                    "Visiting the website? If you spot a missing scheme, broken source, or useful improvement, please use the Suggestion box so the ABIF team can review it.",
                    STYLES["footer_note"],
                )
            ]
        ],
        colWidths=[176 * mm],
        hAlign="LEFT",
    )
    cta.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#EFF6FF")),
                ("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor("#BFDBFE")),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 9),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
            ]
        )
    )
    story.append(cta)

    doc.build(story)
    shutil.copy2(OUTPUT_PATH, PUBLIC_PATH)


if __name__ == "__main__":
    build_pdf()
    print(OUTPUT_PATH)
    print(PUBLIC_PATH)
