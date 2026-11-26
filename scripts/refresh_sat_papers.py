"""Refresh the SAT Reading and Writing catalog. Requires Python 3.10+ and pypdf."""
import json
import re
from html.parser import HTMLParser
from io import BytesIO
from pathlib import Path
from urllib.parse import urljoin
from urllib.request import urlopen

from pypdf import PdfReader

PUBLISHER = "https://satsuite.collegeboard.org"
CATALOG = Path(__file__).resolve().parents[1] / "backend/src/data/sat-reading-writing.json"


class PaperLinks(HTMLParser):
    def __init__(self):
        super().__init__()
        self.numbers = set()

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            url = urljoin(PUBLISHER, dict(attrs).get("href") or "")
            match = re.fullmatch(re.escape(PUBLISHER) + r"/media/pdf/sat-practice-test-(\d+)-digital\.pdf", url)
            if match:
                self.numbers.add(int(match[1]))


def download(url):
    with urlopen(url, timeout=30) as response:
        return response.read()


def read_paper(number, fetch=download):
    def pdf(filename):
        return PdfReader(BytesIO(fetch(f"{PUBLISHER}/media/pdf/{filename}.pdf")))

    booklet = pdf(f"sat-practice-test-{number}-digital")
    starts = [i + 1 for i, p in enumerate(booklet.pages[:30])
              if re.search(r"33\s+QUESTIONS", p.extract_text(), re.I)]
    worksheet = pdf(f"scoring-sat-practice-test-{number}-digital").pages[3].extract_text()
    answers = re.findall(r"^\s*(\d+)\s+([ABCD])\s*$", worksheet, re.M)[:66]
    notes = pdf(f"sat-practice-test-{number}-answers-digital")
    # Each explanation starts with the question number and the correct choice.
    explanations = []
    for page in notes.pages[1:]:
        explanations.extend(re.findall(r"QUESTION\s+(\d+)\s+Choice\s+([ABCD])\s+is",
                                       page.extract_text(), re.I))
        if len(explanations) >= 66:
            break
    expected = list(range(1, 34)) * 2
    if (len(starts) != 2 or [int(i) for i, _ in answers] != expected or answers != explanations[:66]):
        raise ValueError(f"Review the publisher's booklet and answer keys for test {number}.")
    letters = "".join(letter for _, letter in answers)
    return {"number": number, "modules": [letters[:33], letters[33:]], "modulePages": starts}


def main():
    links = PaperLinks()
    links.feed(download(f"{PUBLISHER}/practice/practice-tests/paper").decode("utf-8"))
    if not links.numbers:
        raise ValueError("No practice booklets found on the publisher's listing.")
    papers = [read_paper(n) for n in sorted(links.numbers)]
    temp = CATALOG.with_suffix(".json.tmp")
    temp.write_text(json.dumps(papers, indent=2) + "\n", encoding="utf-8")
    temp.replace(CATALOG)
    print(f"Verified {len(papers)} papers and {66 * len(papers)} answers.")


if __name__ == "__main__":
    main()
