#!/usr/bin/env python3
"""Rebuilds every .drawio and .png in this folder from the Mermaid sources.

    python3 tools/rebuild.py            # run from docs/system-design/draw.io

Needs mermaid-cli (`mmdc`) and the draw.io desktop CLI (`drawio`) on PATH. The Mermaid
render comes first because the flowchart layout is lifted from its SVG — see README.md.
"""
import os
import re
import shutil
import subprocess
import sys
import json
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent                      # docs/system-design/draw.io
SOURCES = ROOT.parent / 'new-system-design'

# (Mermaid README, block index, folder under draw.io, file stem, diagram title)
DIAGRAMS = [
    ('system-architecture', 0, 'system-architecture',
     'system-architecture', 'System architecture'),
    ('er-diagram', 0, 'er-diagram', 'er-diagram', 'ER diagram'),
    ('class-diagram', 0, 'class-diagram',
     'class-diagram-domain-model', 'Class diagram - domain model'),
    ('class-diagram', 1, 'class-diagram',
     'class-diagram-service-layer', 'Class diagram - service layer'),
    ('use-case', 0, 'use-case', 'use-case-account-owner', 'Use case - account owner'),
    ('use-case', 1, 'use-case', 'use-case-support-agent', 'Use case - support agent'),
    ('use-case', 2, 'use-case', 'use-case-customer', 'Use case - customer'),
    ('use-case', 3, 'use-case', 'use-case-system', 'Use case - system'),
    ('workflow-diagram/level-0-data-flow-diagram', 0,
     'workflow-diagram/level-0-data-flow-diagram',
     'level-0-data-flow-diagram', 'Level 0 data flow diagram'),
    ('workflow-diagram/Level 1 Data Flow Diagram', 0,
     'workflow-diagram/Level 1 Data Flow Diagram',
     'level-1-data-flow-diagram', 'Level 1 data flow diagram'),
    ('sequence-diagram', 0, 'sequence-diagram',
     'sequence-diagram-reply-or-escalate', 'Sequence - reply or escalate'),
    ('activity-diagram', 0, 'activity-diagram',
     'activity-diagram-ai-decision', 'Activity - the AI decision'),
]


def tool(name):
    found = shutil.which(name)
    if not found:
        sys.exit(f'{name} is not on PATH — see README.md')
    return found


CHROMES = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
]


def browser_config(work):
    """mermaid-cli drives a real browser. Point it at an installed one rather than
    letting Puppeteer download its own copy."""
    path = os.environ.get('PUPPETEER_EXECUTABLE_PATH') or next(
        (c for c in CHROMES if Path(c).exists()), None)
    if not path:
        sys.exit('No Chrome or Chromium found — set PUPPETEER_EXECUTABLE_PATH')
    config = work / 'puppeteer.json'
    config.write_text(json.dumps({'executablePath': path, 'args': ['--no-sandbox']}))
    return config


def main():
    mmdc, drawio = tool('mmdc'), tool('drawio')
    env = dict(os.environ, PUPPETEER_SKIP_DOWNLOAD='true', PYTHONPATH=str(HERE))
    work = Path(tempfile.mkdtemp())
    puppeteer = browser_config(work)
    failed = 0

    for readme, index, folder, stem, title in DIAGRAMS:
        blocks = re.findall(r'```mermaid\n(.*?)\n```',
                            (SOURCES / readme / 'README.md').read_text(), re.S)
        source = blocks[index]
        mmd = work / f'{stem}.mmd'
        mmd.write_text(source)

        out = ROOT / folder
        out.mkdir(parents=True, exist_ok=True)
        args = [sys.executable, str(HERE / 'mermaid-to-drawio.py'),
                str(mmd), str(out / f'{stem}.drawio'), title]

        # Every kind but the sequence diagram takes its layout from Mermaid's SVG.
        if not source.lstrip().startswith('sequenceDiagram'):
            svg = work / f'{stem}.svg'
            render = subprocess.run(
                [mmdc, '-i', str(mmd), '-o', str(svg), '-p', str(puppeteer)],
                capture_output=True, text=True, env=env)
            if render.returncode:
                print(f'{stem}: mermaid render failed — {render.stderr.strip()[-160:]}')
                failed += 1
                continue
            args.append(str(svg))

        if subprocess.run(args, capture_output=True, env=env).returncode:
            print(f'{stem}: conversion failed')
            failed += 1
            continue
        if subprocess.run([drawio, '-x', '-f', 'png', '-s', '2', '--no-sandbox',
                           '-o', str(out / f'{stem}.png'), str(out / f'{stem}.drawio')],
                          capture_output=True).returncode:
            print(f'{stem}: png render failed')
            failed += 1
            continue
        print(f'{folder}/{stem}')

    shutil.rmtree(work, ignore_errors=True)
    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main()
