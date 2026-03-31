import re

_EURO_TOKEN = r"(?:\u20ac|EUR|\u00e2\u201a\u00ac|\u00c3\u00a2\u00e2\u20ac\u0161\u00c2\u00ac)"


def detect_fuel(text: str) -> str | None:
    if re.search(r"\bdiesel\b", text, re.I):
        return "Diesel"
    if re.search(r"\bbenzina\b", text, re.I):
        return "Benzina"
    if re.search(r"\belet?tric[ao]?\b|\bfull[- ]?electric\b", text, re.I):
        return "Elettrica"
    if re.search(r"\bibrida?\b|\bhybrid\b|\bmhev\b|\bphev\b|\bfull[- ]?hybrid\b", text, re.I):
        return "Ibrida"
    if re.search(r"\bgpl\b", text, re.I):
        return "GPL"
    if re.search(r"\bmetano\b|\bcng\b", text, re.I):
        return "Metano"
    if re.search(r"\b(tdi|cdi|crdi|hdi|dci|jtd|jtdm|mjet|cdti|bluehdi|bluedci|d4d|d-4d)\b", text, re.I):
        return "Diesel"
    if re.search(r"\b(tfsi|tsi|gti|tce|puretech|t-?jet|gdi|t-gdi|mpi)\b", text, re.I):
        return "Benzina"
    return None


def detect_transmission(text: str) -> str | None:
    if re.search(r"automatico|automatic|sequenziale|dsg|dct|tiptronic", text, re.I):
        return "Automatico"
    if re.search(r"manuale|manual", text, re.I):
        return "Manuale"
    return None


def detect_body_type(text: str) -> str | None:
    t = text.lower()
    if "cabrio" in t or "convertible" in t or "roadster" in t:
        return "Cabrio"
    if "station wagon" in t or "touring" in t or "sportback" in t or re.search(r"\bsw\b", t):
        return "Station Wagon"
    if "suv" in t or "crossover" in t or "4x4" in t:
        return "SUV"
    if "coup\u00e9" in t or "coupe" in t:
        return "Coup\u00e9"
    if "berlina" in t or "sedan" in t or "hatchback" in t:
        return "Berlina"
    if "monovolume" in t or "minivan" in t or re.search(r"\bmpv\b", t):
        return "Monovolume"
    return None


def parse_price(raw: str) -> int | None:
    digits = re.sub(r"[^\d.]", "", raw).replace(".", "")
    if not digits:
        return None
    value = int(digits)
    if value < 1000 or value > 1_000_000:
        return None
    return value


def parse_km(raw: str) -> int | None:
    digits = re.sub(r"[^\d.]", "", raw).replace(".", "")
    if not digits:
        return None
    value = int(digits)
    if value < 0:
        return None
    return value


def extract_euro_price(text: str) -> int | None:
    # Token-first match avoids false positives on nearby card counters (e.g. "15" before "€ 32.900").
    token_first = re.compile(rf"{_EURO_TOKEN}\s*([\d][\d.]*)", re.I)
    token_last = re.compile(rf"([\d][\d.]*)\s*{_EURO_TOKEN}", re.I)

    for pattern in (token_first, token_last):
        for match in pattern.finditer(text):
            price = parse_price(match.group(1))
            if price:
                return price
    return None
