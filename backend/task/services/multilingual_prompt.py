import re

# Comprehensive Unicode script patterns for all 13 supported languages
SCRIPT_PATTERNS = {
    'hindi': re.compile(r'[\u0900-\u097F]'),                                # Devanagari script
    'bengali': re.compile(r'[\u0980-\u09FF]'),                              # Bengali / Assamese script
    'odia': re.compile(r'[\u0B00-\u0B7F]'),                                 # Odia script
    'urdu': re.compile(r'[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]'), # Perso-Arabic script
    'tamil': re.compile(r'[\u0B80-\u0BFF]'),                                # Tamil script
    'telugu': re.compile(r'[\u0C00-\u0C7F]'),                               # Telugu script
    'japanese': re.compile(r'[\u3040-\u309F\u30A0-\u30FF]'),                # Hiragana & Katakana
    'chinese': re.compile(r'[\u4E00-\u9FFF]'),                              # CJK Ideographs
    'russian': re.compile(r'[\u0400-\u04FF]'),                              # Cyrillic script
}

# Latin-script language heuristics for French and Spanish
FRENCH_MARKERS = re.compile(r'\b(le|la|les|un|une|des|est|sont|pour|dans|avec|créer|faire|rapport|fichier|bonjour|merci)\b', re.IGNORECASE)
SPANISH_MARKERS = re.compile(r'\b(el|la|los|las|un|una|unos|unas|es|son|para|en|con|crear|hacer|informe|archivo|hola|gracias)\b', re.IGNORECASE)

LANGUAGE_NAMES = {
    'hindi': 'Hindi (हिन्दी)',
    'bengali': 'Bengali (বাংলা)',
    'odia': 'Odia (ଓଡ଼ିଆ)',
    'urdu': 'Urdu (اردو)',
    'tamil': 'Tamil (தமிழ்)',
    'telugu': 'Telugu (తెలుగు)',
    'assamese': 'Assamese (অসমীয়া)',
    'chinese': 'Chinese (中文)',
    'japanese': 'Japanese (日本語)',
    'french': 'French (Français)',
    'spanish': 'Spanish (Español)',
    'russian': 'Russian (Русский)',
    'english': 'English',
}

# Domain keyword dictionaries across all 13 supported languages
MULTILINGUAL_DOMAIN_KEYWORDS = {
    'certificate': [
        # English
        "certificate", "cert", "bonafide", "migration", "character", "transfer", "birth", "degree", "marksheet", "transcript",
        # Indic (Hindi, Bengali, Odia, Urdu, Tamil, Telugu, Assamese)
        "सर्टिफिकेट", "प्रमाणपत्र", "बर्थ", "जन्म", "डिग्री", "मार्कशीट", "आवेदन", "बनवाओ", "बनाओ",
        "সার্টিফিকেট", "প্রমাণপত্র", "জন্ম", "নম্বরপত্র", "দরখাস্ত",
        "ପ୍ରମାଣପତ୍ର", "ସାର୍ଟିଫିକେଟ୍", "ଜନ୍ମ", "ଡିଗ୍ରୀ", "ମାର୍କସିଟ୍", "ଆବେଦନ",
        "سرٹیفکیٹ", "تصدیق نامہ", "پیدائش", "ڈگری", "درخواست",
        "சான்றிதழ்", "பிறப்பு சான்றிதழ்", "விண்ணப்பம்", "பட்டம்",
        "ధృవీకరణ పత్రం", "జనన ధృవీకరణ", "సర్టిఫికెట్", "దరఖాస్తు",
        "চাৰ্টিফিকেট",
        # Global (Chinese, Japanese, French, Spanish, Russian)
        "证书", "证明", "出生证明", "申请", "学位证", "成绩单",
        "証明書", "申請", "証書", "学位記", "出生証明",
        "certificat", "attestation", "diplôme", "demande", "acte de naissance",
        "certificado", "acta de nacimiento", "solicitud", "constancia", "título",
        "сертификат", "свидетельство", "справка", "диплом", "заявление"
    ],
    'maintenance': [
        # English
        "maintenance", "ticket", "room", "facility", "broken", "leak", "repair", "fix", "fan", "light", "plumbing", "ac", "tap", "electricity",
        # Indic
        "मरम्मत", "खराब", "टूटा", "पंखा", "बिजली", "समस्या", "ठीक", "नल", "कमरा", "एसी",
        "মেরামত", "সমস্যা", "ভাঙা", "ফ্যান", "আলো", "পাইপ", "নষ্ট",
        "ମରାମତି", "ଖରାପ", "ଭଙ୍ଗା", "ବିଜୁଳି", "ଫ୍ୟାନ୍", "ନଳ",
        "مرمت", "خراب", "پنکھا", "بجلی", "نل", "درست",
        "பழுது", "பிரச்சனை", "மின்சாரம்", "மின்விசிறி", "குழாய்",
        "మరమ్మత్తు", "సమస్య", "ఫ్యాన్", "విద్యుత్", "నల్లా",
        "মেৰামতি",
        # Global
        "维修", "报修", "故障", "损坏", "电灯", "风扇", "水管",
        "修理", "故障", "メンテナンス", "破損", "水漏れ",
        "réparation", "panne", "maintenance", "problème", "fuite", "robinet",
        "mantenimiento", "reparación", "avería", "roto", "fuga", "grifo",
        "ремонт", "поломка", "обслуживание", "заявка", "протечка"
    ],
    'laboratory': [
        # English
        "laboratory", "lab", "booking", "book", "slot", "schedule", "reserve", "reservation",
        # Indic
        "लैब", "प्रयोगशाला", "बुक", "स्लॉट", "आरक्षण", "समय",
        "ল্যাব", "গবেষণাগার", "বুকিং",
        "ଲ୍ୟାବ୍", "ପ୍ରୟୋଗଶାଳା", "ବୁକିଂ", "ବୁକ୍",
        "لیب", "بکنگ",
        "ஆய்வகம்", "முன்பதிவு",
        "ల్యాబ్", "బుకింగ్",
        "লেব",
        # Global
        "实验室", "预约", "预定", "时段",
        "実験室", "ラボ", "予約",
        "laboratoire", "réservation", "réserver", "créneau",
        "laboratorio", "reserva", "reservar", "horario",
        "лаборатория", "бронирование", "забронировать", "слот"
    ],
    'grievance': [
        # English
        "grievance", "complaint", "escalate", "escalation", "issue", "dispute", "appeal",
        # Indic
        "शिकायत", "अपील", "समस्या", "विवाद", "दर्ज",
        "অভিযোগ", "নালিশ", "আপিল",
        "ଅଭିଯୋଗ", "ଆପିଲ୍",
        "شکایت", "اپیل", "تنازعہ",
        "புகார்", "மனு",
        "ఫిర్యాదు", "అప్పీలు",
        # Global
        "投诉", "申诉", "纠纷", "争议",
        "苦情", "申し立て", "トラブル",
        "réclamation", "plainte", "litige", "recours",
        "queja", "reclamo", "denuncia", "disputa",
        "жалоба", "претензия", "эскалация", "спор"
    ]
}

def matches_domain_intent(domain: str, text: str) -> bool:
    """Checks if input text contains keywords for the given domain across all 13 languages."""
    if not text or not isinstance(text, str):
        return False
    text_lower = text.lower()
    keywords = MULTILINGUAL_DOMAIN_KEYWORDS.get(domain, [])
    return any(k.lower() in text_lower for k in keywords)

def detect_language(text: str) -> str:
    """
    Detects if the input text contains Indic, CJK, Cyrillic, or Latin-based languages.
    Returns one of the 13 supported language keys.
    """
    if not text or not isinstance(text, str):
        return 'english'

    counts = {}
    for lang, pattern in SCRIPT_PATTERNS.items():
        matches = pattern.findall(text)
        if matches:
            counts[lang] = len(matches)

    if counts:
        dominant_lang = max(counts, key=counts.get)
        # Check for Japanese mixed with Kanji
        if dominant_lang == 'chinese' and SCRIPT_PATTERNS['japanese'].search(text):
            return 'japanese'
        # Check for Assamese distinctive characters within Bengali script
        if dominant_lang == 'bengali' and ('ৰ' in text or 'ৱ' in text):
            return 'assamese'
        return dominant_lang

    # Latin text heuristics
    if FRENCH_MARKERS.search(text):
        return 'french'
    if SPANISH_MARKERS.search(text):
        return 'spanish'

    return 'english'


def enhance_system_instruction(base_instruction: str, problem_statement: str) -> str:
    """
    Enriches the base system instruction with multilingual directives tailored for
    NVIDIA Nemotron / LLMs across all 13 supported languages.
    """
    detected_lang = detect_language(problem_statement)
    lang_display = LANGUAGE_NAMES.get(detected_lang, 'English')

    multilingual_directive = (
        f"\n\nMULTILINGUAL INTERACTION DIRECTIVE:\n"
        f"- Target Prompt Language Detected: {lang_display}.\n"
        f"- You fully support multilingual interaction, with deep fluency in 13 languages:\n"
        f"  * Indic: English, Hindi (हिन्दी), Bengali (বাংলা), Odia (ଓଡ଼ିଆ), Urdu (اردو), Tamil (தமிழ்), Telugu (తెలుగు), Assamese (অসমীয়া).\n"
        f"  * Global: Chinese (中文), Japanese (日本語), French (Français), Spanish (Español), Russian (Русский).\n"
        f"- If the user's prompt or task is in any of these languages, understand the intent, entities, and requirements accurately.\n"
        f"- Formulate tool arguments accurately (translating search queries or file names to English/ASCII where appropriate for system tools).\n"
        f"- When the user requests an action requiring institutional submission or booking (certificate, maintenance, lab, grievance), CALL THE APPROPRIATE MCP TOOL in your first step.\n"
        f"- Deliver your final natural-language response in the SAME language used by the user ({lang_display}), while preserving code blocks, technical syntax, Case IDs, and terminal commands clearly in standard format.\n"
        f"- If the user switches languages or uses Romanized Indic text (Hinglish, Benglish, etc.), adapt naturally and respond with clarity.\n"
    )

    return base_instruction + multilingual_directive
