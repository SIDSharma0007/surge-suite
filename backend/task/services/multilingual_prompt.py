import re

# Unicode ranges for prioritized Indic scripts
INDIC_SCRIPT_PATTERNS = {
    'hindi': re.compile(r'[\u0900-\u097F]'),      # Devanagari script (Hindi, Marathi, Sanskrit)
    'bengali': re.compile(r'[\u0980-\u09FF]'),    # Bengali / Assamese script
    'odia': re.compile(r'[\u0B00-\u0B7F]'),       # Odia script
}

LANGUAGE_NAMES = {
    'hindi': 'Hindi (हिन्दी)',
    'bengali': 'Bengali (বাংলা)',
    'odia': 'Odia (ଓଡ଼ିଆ)',
    'english': 'English',
}

def detect_language(text: str) -> str:
    """
    Detects if the input text contains Hindi, Bengali, Odia, or English/Latin scripts.
    Returns the dominant language key ('hindi', 'bengali', 'odia', or 'english').
    """
    if not text or not isinstance(text, str):
        return 'english'

    counts = {}
    for lang, pattern in INDIC_SCRIPT_PATTERNS.items():
        matches = pattern.findall(text)
        if matches:
            counts[lang] = len(matches)

    if counts:
        # Return the language with the highest character count
        dominant_lang = max(counts, key=counts.get)
        return dominant_lang

    return 'english'


def enhance_system_instruction(base_instruction: str, problem_statement: str) -> str:
    """
    Enriches the base system instruction with multilingual directives tailored for
    NVIDIA Nemotron / LLMs based on the detected language of the problem statement.
    """
    detected_lang = detect_language(problem_statement)
    lang_display = LANGUAGE_NAMES.get(detected_lang, 'English')

    multilingual_directive = (
        f"\n\nMULTILINGUAL INTERACTION DIRECTIVE:\n"
        f"- Target Prompt Language Detected: {lang_display}.\n"
        f"- You fully support multilingual interaction, with deep fluency in English, Hindi (हिन्दी), Bengali (বাংলা), and Odia (ଓଡ଼ିଆ).\n"
        f"- If the user's prompt or task is in an Indian language (e.g. Hindi, Bengali, or Odia), understand the intent and entities accurately.\n"
        f"- Formulate tool arguments accurately (translating search queries or file names to English/ASCII where appropriate for system tools).\n"
        f"- Provide your final natural-language response in the SAME language used by the user ({lang_display}), while keeping code blocks, technical syntax, and terminal commands clear and unaltered.\n"
        f"- If the user switches languages or uses Romanized Indic text (Hinglish, Benglish, etc.), adapt naturally and respond with clarity.\n"
    )

    return base_instruction + multilingual_directive
