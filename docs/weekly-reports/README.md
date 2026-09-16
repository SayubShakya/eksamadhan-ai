# Weekly progress reports

One folder per week, submitted to the supervisor every Monday.

| Week | Period | Report |
| :--- | :--- | :--- |
| 1 | 15–21 Sep 2026 | [`week-01/`](week-01/) |

Each folder holds:

- `Week-NN-Progress-Report.docx` — the University of Bedfordshire form, filled in.
  This is the copy to print, sign and submit via BREO.
- `Week-NN-Progress-Report.md` — the same content in Markdown, so it is readable
  directly on GitHub without downloading the Word file.

## Rules this satisfies

The supervisor's requirements for this project:

4. A weekly log every Monday, stating what was accomplished last week and what is
   planned for this week.
5. The log must match the work actually committed to the repository.
6. The weekly report will not be signed if the work is not reflected in the Git repo.

Point 5 is why each report ends with the commit range it covers. Before submitting,
regenerate the evidence with:

```bash
git log --since=<week start> --until=<week end> \
        --pretty='- %ad `%h` %s' --date=short
```
