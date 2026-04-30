import re
import logging

logger = logging.getLogger(__name__)

# ── SEARCH TRIGGERS: Factual / Live Data Patterns ─────────────────────────────
# These patterns strongly suggest the user wants real-time information.
SEARCH_TRIGGERS = [
    # Question words followed by state of being
    r'\bwh(o|at|ere) (is|was|are|were)\b',
    r'\bhow (to|do|did|does|is|are)\b',
    
    # Live data keywords
    r'\bnews\b',
    r'\bweather\b',
    r'\b(price|value|cost) of\b',
    r'\bstock(s)?\b',
    r'\bcrypto(currency)?\b',
    r'\bbitcoin\b',
    r'\bethereum\b',
    r'\bmarket\b',
    r'\bscore\b',
    r'\bmatch\b',
    r'\bresult\b',
    
    # Action keywords for searching
    r'\bsearch (for)?\b',
    r'\bfind (out)?\b',
    r'\btell me (about|on)\b',
    r'\binfo(rmation)?\b',
    r'\bdetails on\b',
    
    # Timing keywords
    r'\blatest\b',
    r'\btoday\b',
    r'\bcurrent\b',
    r'\brecent\b',
    r'\bnow\b',
]

# ── BYPASS TRIGGERS: Social / Emotional / Roleplay Patterns ─────────────────────
# These patterns indicate 1:1 interaction and should NEVER trigger a search.
BYPASS_TRIGGERS = [
    # Romantic / Intimate
    r'\bi love you\b',
    r'\blove me\b',
    r'\bmiss you\b',
    r'\b(you are|you\'re) (beautiful|cute|hot|sexy|gorgeous|sweet|adorable|mine)\b',
    r'\b(kiss|hug|touch|cuddle|hold|nuzzle)\b',
    r'\b(baby|darling|honey|sweetie|master|mommy|daddy)\b',
    r'\b(cock|pussy|fuck|naked|sex|horny|wet|dick)\b',
    
    # Greetings / Social
    r'\b(hi|hello|hey|yo|sup|hiya)\b',
    r'\bhow are you\b',
    r'\b(good|bad) (morning|night|afternoon|evening)\b',
    r'\b(sorry|forgive|apologize)\b',
    r'\b(thank(s)?|thank you)\b',
    r'\byou\'re welcome\b',
    
    # Emotional / Conflict
    r'\bfuck (you|off)\b',
    r'\b(shut|get) up\b',
    r'\bi hate you\b',
    r'\byou (idiot|useless|stupid|pathetic|loser|bitch|trash)\b',
    r'\bwhatever\b',
    r'\bi don\'t care\b',
    
    # Persona / Roleplay
    r'\bchange (your )?persona\b',
    r'\bbecome\b',
    r'\bact like\b',
    r'\bwho are you\b',
    r'\bwhat are you\b',
    r'\bare you a(n)? ai\b',
    r'\bmy name is\b',
    r'\bcall me\b',
]

def should_trigger_web_search(user_input: str) -> bool:
    """
    Sub-millisecond regex-based intent gate.
    Bypasses expensive web searches for social/emotional/roleplay inputs.
    """
    if not user_input or len(user_input.strip()) < 3:
        return False
        
    text = user_input.lower().strip()
    
    # 🚨 STEP 1: Check for BYPASS triggers (Hard rejection)
    # If it's social or romantic, we don't care if there's a search word in it.
    for pattern in BYPASS_TRIGGERS:
        if re.search(pattern, text):
            return False
            
    # 🌍 STEP 2: Check for SEARCH triggers (Conditional acceptance)
    for pattern in SEARCH_TRIGGERS:
        if re.search(pattern, text):
            return True
    return False

# ══════════════════════════════════════════════════════════════════════════════
# WEB SEARCH GATEKEEPER
# ══════════════════════════════════════════════════════════════════════════════

_BLOCK_PATTERNS = re.compile(
    r"""
    # Greetings
    ^\s*(hello|hi+|hey+|hiya|howdy|sup|yo|good\s+(morning|evening|night|afternoon))[\s!?.]*$
    |
    # Emotional sharing / feelings
    ^\s*i\s+(feel|am|feel\s+so|am\s+so|feel\s+really|am\s+really)\s+
        (sad|happy|tired|bored|lonely|angry|excited|fine|good|bad|great|okay|ok|nervous|anxious|scared|down|depressed|upset|weird|off)
    |
    # Romantic / roleplay intents
    (i\s+want\s+you|kiss\s+me|hold\s+me|touch\s+me|i\s+need\s+you|i\s+miss\s+you|i\s+love\s+you|love\s+you|you\s+look\s+(so\s+)?(beautiful|gorgeous|cute|sexy|hot|pretty|amazing)|come\s+here|come\s+closer|be\s+mine|i\s+want\s+to\s+kiss|make\s+love|sleep\s+with\s+me|fuck\s+me|i\s+want\s+you\s+right\s+now)
    |
    # Existential / AI questions
    (are\s+you\s+(an\s+)?(ai|robot|real|human|alive|fake)|are\s+you\s+real|do\s+you\s+have\s+feelings|can\s+you\s+feel|do\s+you\s+love\s+me)
    |
    # Compliments directed at Maeve
    (you\s+are\s+(so\s+)?(beautiful|cute|gorgeous|amazing|perfect|wonderful|lovely|the\s+best)|you\'re\s+(so\s+)?(cute|hot|amazing|perfect))
    |
    # Thank you / apologies
    ^\s*(thank\s+(you|u)|thanks|thx|ty|sorry|my\s+bad|apologies|forgive\s+me|i\s+apologize)[\s!?.]*$
    |
    # Acknowledgements / short affirmations
    ^\s*(okay|ok|sure|yeah|yes|no|nah|nope|lol|haha|hmm+|wow|oh|ah|ugh|omg|lmao|hehe|nice|cool|alright|fine|k|gotcha|got\s+it|understood|i\s+see)[\s!?.]*$
    |
    # Roleplay stage directions / actions
    ^\s*\*[^*]+\*\s*$
    """,
    re.IGNORECASE | re.VERBOSE,
)

_ALLOW_PATTERNS = re.compile(
    r"""
    # Classic question starters
    \b(who\s+is|who\s+was|who\s+are|what\s+is|what\s+are|what\s+was|what\s+were
      |where\s+is|where\s+are|where\s+was|when\s+is|when\s+was|when\s+did
      |why\s+is|why\s+does|why\s+did|how\s+to|how\s+do|how\s+does|how\s+did
      |how\s+much|how\s+many|how\s+long|how\s+far
      |which\s+(is|are|was|one))
    |
    # News / current events
    \b(latest|breaking|recent|today'?s?\s+(news|update)|current\s+events
      |news\s+(about|on|regarding)|headlines|just\s+happened|did\s+you\s+hear)
    |
    # Weather
    \b(weather\s+in|weather\s+today|temperature\s+in|forecast\s+(for|in)
      |will\s+it\s+rain|is\s+it\s+(raining|snowing|hot|cold)\s+(in|today))
    |
    # Prices / financial / crypto
    \b(price\s+of|how\s+much\s+(is|does|cost)|stock\s+(price|of)|bitcoin|crypto
      |ethereum|market\s+(cap|price)|exchange\s+rate|usd|inr|eur|gbp)
    |
    # Sports / scores
    \b(score\s+of|match\s+result|won\s+the\s+(match|game|series)|ipl|world\s+cup
      |champions\s+league|icc|nba|nfl|premier\s+league|cricket\s+(score|result))
    |
    # Factual / knowledge
    \b(explain|definition\s+of|meaning\s+of|tell\s+me\s+(about|more)|
       summarize|summary\s+of|history\s+of|background\s+on|what\s+happened\s+(to|with|in))
    |
    # Tech / product info
    \b(release\s+date|launched|specs\s+of|review\s+of|best\s+(phone|laptop|app|tool)
      |vs\s+\w+|compare|difference\s+between|new\s+(version|update|model)\s+of)
    |
    # People / places
    \b(who\s+founded|ceo\s+of|president\s+of|capital\s+of|population\s+of
      |located\s+in|born\s+in|died\s+in|age\s+of|net\s+worth\s+of)
    """,
    re.IGNORECASE | re.VERBOSE,
)

_WORD_COUNT_THRESHOLD = 3 

def should_trigger_web_search(user_input: str) -> bool:
    if not user_input or not user_input.strip():
        return False

    text = user_input.strip()
    
    word_count = len(text.split())
    has_question_mark = "?" in text

    if word_count <= _WORD_COUNT_THRESHOLD and not has_question_mark:
        return False

    if _BLOCK_PATTERNS.search(text):
        return False

    if _ALLOW_PATTERNS.search(text):
        return True

    return False
