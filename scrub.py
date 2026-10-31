import sys

from presidio_analyzer import AnalyzerEngine, Pattern, PatternRecognizer
from presidio_anonymizer import AnonymizerEngine

DB_KEY = [
    Pattern("db_url_env", r'(?:DATABASE_URL|DB_URL|MONGO_URI|REDIS_URL)\s*=\s*\S+', 0.95),
    Pattern("db_password", r'(?:password|passwd|pwd)\s*[:=]\s*\S+', 0.9),
    Pattern("conn_string", r'(?:mongodb|postgres(?:ql)?|mysql|redis)://[^\s\'"]+', 1.0),
]

DEV_ID = [
    Pattern("api_key", r'(?:API_KEY|apiKey|SECRET_KEY|secretKey|AUTH_TOKEN)\s*[:=]\s*\S+', 1.0),
    Pattern("dev_id", r'(?:dev_id|developer_id)\s*[:=]\s*\S+', 0.85),
]

ENTITIES = [
    "DB_KEY",
    "DEV_ID",
    "EMAIL_ADDRESS",
    "PHONE_NUMBER",
    "CREDIT_CARD",
    "IBAN_CODE",
    "US_SSN",
    "US_PASSPORT",
]

WAIVER = "@waiver PII"


def build():
    analyzer = AnalyzerEngine()
    analyzer.registry.add_recognizer(
        PatternRecognizer(supported_entity="DB_KEY", patterns=DB_KEY)
    )
    analyzer.registry.add_recognizer(
        PatternRecognizer(supported_entity="DEV_ID", patterns=DEV_ID)
    )
    return analyzer


def mask(value):
    return value[:2] + "*" * min(len(value) - 2, 8)


def scan(path, analyzer):
    try:
        with open(path) as handle:
            text = handle.read()
    except OSError as error:
        print(f"scrub: cannot read {path}: {error}", file=sys.stderr)
        return None, []
    rows = text.splitlines()
    kept = []
    for result in analyzer.analyze(text=text, language="en", entities=ENTITIES):
        line = text.count("\n", 0, result.start) + 1
        if line <= len(rows) and WAIVER in rows[line - 1]:
            continue
        kept.append(result)
    return text, kept


def report(path, text, kept):
    for result in kept:
        line = text.count("\n", 0, result.start) + 1
        print(f"{path}:{line}: {result.entity_type} {mask(text[result.start:result.end])}")


def redact(path, text, kept):
    anonymizer = AnonymizerEngine()
    with open(path, "w") as handle:
        handle.write(anonymizer.anonymize(text=text, analyzer_results=kept).text)


def main(argv):
    fix = "--fix" in argv
    paths = [arg for arg in argv if not arg.startswith("--")]
    analyzer = build()
    hits = 0
    for path in paths:
        text, kept = scan(path, analyzer)
        if text is None or not kept:
            continue
        hits += 1
        report(path, text, kept)
        if fix:
            redact(path, text, kept)
    if hits == 0:
        return 0
    if fix:
        print(f"scrub: redacted {hits} file(s) in place. Review the diff before you commit.")
        return 2
    print("scrub: refusing the commit.")
    print(f"scrub: fix each line, or append `{WAIVER}: <reason>` when it is a false positive.")
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
