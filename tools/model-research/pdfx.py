"""Prints the text of a PDF (needs `pip install pypdf`).
Usage: python3 -I pdfx.py <file.pdf> [plain|layout] [max pages]"""
import sys

from pypdf import PdfReader
r = PdfReader(sys.argv[1])
mode = sys.argv[2] if len(sys.argv) > 2 else 'plain'
pages = int(sys.argv[3]) if len(sys.argv) > 3 else 99
for i, p in enumerate(r.pages[:pages]):
    print(f'--- page {i+1} ---')
    print(p.extract_text(extraction_mode='layout') if mode == 'layout' else p.extract_text())
