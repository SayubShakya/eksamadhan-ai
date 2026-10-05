#!/usr/bin/env python3
"""
Summarises the user feedback survey (report Table 11, objective 4) from the Google Form's
answers, downloaded from the linked sheet as CSV (File > Download > Comma Separated Values).

    python3 evaluation/survey_summary.py docs/evaluation/survey-answers.csv

Prints a Markdown section ready for FINAL_REPORT.md §9.3: who answered, a table per rated
question (n, mean, median, how many chose 4 or 5) and the overall usability score against the
proposal's target (an average of 4.0 or more, from at least 3 shop owners).

Columns are found by their number ("5. I could ...", as the form numbers them), so a reworded
question still lines up. Only rows whose consent answer is "Yes" are counted. A file whose name
or rows say TEST is labelled as test data in the output, so it cannot pass for real results.
"""
import csv
import statistics
import sys
from collections import Counter

RATED = range(5, 17)            # questions 5 to 16, on a 1 to 5 scale
NEPALI = 15                     # optional: only those who tried Nepali answer it
TARGET = 4.0
MIN_OWNERS = 3
THEMES = {5: 'Ease of use', 6: 'Ease of use', 7: 'Ease of use',
          8: 'Trust', 9: 'Trust', 10: 'Trust',
          11: 'Handover', 12: 'Handover', 13: 'Handover',
          14: 'Speed', 15: 'Nepali', 16: 'Willingness'}


def column(header, number):
    prefix = f'{number}. '
    for name in header:
        if name.strip().startswith(prefix):
            return name
    return None


def main(path):
    with open(path, newline='', encoding='utf-8-sig') as f:
        rows = list(csv.DictReader(f))
    if not rows:
        sys.exit('No answers in ' + path)
    header = rows[0].keys()
    consent, role = column(header, 1), column(header, 2)
    answered = [r for r in rows if (r.get(consent) or '').strip().lower() == 'yes']
    declined = len(rows) - len(answered)

    is_test = 'TEST' in path.upper() or any('TEST' in ' '.join(r.values()).upper() for r in answered)
    out = []
    if is_test:
        out.append('> **TEST DATA, NOT REAL RESPONSES. Do not copy any of this into a report.**\n')

    roles = Counter((r.get(role) or 'Not given').strip() for r in answered)
    owners = roles.get('Shop owner', 0)
    out.append('### User feedback results\n')
    out.append(f'{len(answered)} people took part'
               + (f' ({declined} declined at the consent question)' if declined else '') + ': '
               + ', '.join(f'{n} {name.lower()}' for name, n in roles.most_common()) + '.\n')

    out.append('| Question | Theme | n | Mean | Median | Chose 4 or 5 |')
    out.append('| :- | :- | :- | :- | :- | :- |')
    all_scores = []
    for q in RATED:
        name = column(header, q)
        if not name:
            continue
        scores = [int(r[name]) for r in answered if (r.get(name) or '').strip().isdigit()]
        if not scores:
            out.append(f'| Q{q} | {THEMES[q]} | 0 | | | |')
            continue
        if q != NEPALI:
            all_scores.extend(scores)
        high = sum(1 for s in scores if s >= 4)
        out.append(f'| Q{q} | {THEMES[q]} | {len(scores)} | {statistics.mean(scores):.2f} | '
                   f'{statistics.median(scores):g} | {high} of {len(scores)} |')

    overall = statistics.mean(all_scores) if all_scores else 0
    met = overall >= TARGET and owners >= MIN_OWNERS
    out.append('')
    out.append(f'**Overall usability** (questions 5 to 16, Nepali left out because only some tried it): '
               f'**{overall:.2f} out of 5**, from {owners} shop owner(s). Target: {TARGET:.1f} or more '
               f'from at least {MIN_OWNERS} shop owners. **{"Met" if met else "Not met"}.**')

    for q, label in [(17, 'Liked most'), (18, 'Confusing or went wrong'), (19, 'Needed before daily use')]:
        name = column(header, q)
        notes = [r[name].strip() for r in answered if name and (r.get(name) or '').strip()]
        if notes:
            out.append(f'\n**{label}:**')
            out.extend(f'- {n}' for n in notes)

    print('\n'.join(out))


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
