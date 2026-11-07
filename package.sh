#!/bin/sh
# Builds the submission package for Assignment 2 (Artifact, Poster, Source Code):
#   EkSamadhan-AI-2337659-submission.zip
#
#   README.txt        what is in the package and where to start
#   source/           the source code, exactly as committed (git archive of HEAD): no settings
#                     files, secrets, logs, build output or node_modules
#   poster/           the A1 poster
#   screenshots/      every screen of the working application
#   guides/           INSTALL.md and USER_GUIDE.md, also as the first things in source/
#
# Only committed work goes in, so commit first. Nothing in source/ holds a password or key:
# setup.sh makes fresh ones on the marker's machine.
set -e
cd "$(dirname "$0")"

NAME="EkSamadhan-AI-2337659-submission"
OUT="dist-package"
POSTER="docs/Assement and Feedback/Assignment 2 Artifact, Poster, Source Code Submission/EkSamadhan-AI Banner Semester 2.pdf"

if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "Note: there are uncommitted changes; the package holds the last commit only."
fi

rm -rf "$OUT" && mkdir -p "$OUT/$NAME"/source "$OUT/$NAME"/poster "$OUT/$NAME"/screenshots "$OUT/$NAME"/guides

git archive HEAD | tar -x -C "$OUT/$NAME/source"
cp INSTALL.md USER_GUIDE.md "$OUT/$NAME/guides/"
[ -f "$POSTER" ] && cp "$POSTER" "$OUT/$NAME/poster/EkSamadhan-AI-poster.pdf" || echo "Note: poster not found, folder left empty"
[ -d docs/app-screenshots ] && cp docs/app-screenshots/*.png "$OUT/$NAME/screenshots/" 2>/dev/null || true

# A last check that no settings file or key slipped in.
if find "$OUT/$NAME" -name ".env" -o -name "*.pem" -o -name "*firebase-adminsdk*" | grep -q .; then
  echo "Stopped: a secrets file is in the package." >&2; exit 1
fi

COMMIT=$(git rev-parse --short HEAD)
cat > "$OUT/$NAME/README.txt" <<EOF
EkSamadhan AI: submission package
CIS017-3 Undergraduate Project, University of Bedfordshire
Student: Sayub Shakya (2337659)   Supervisor: Pawan KC
Source code from commit $COMMIT, packaged $(date +%Y-%m-%d)
Repository: https://github.com/SayubShakya/eksamadhan-ai

Start here
  1. guides/INSTALL.md     run the application with Docker (about 10 minutes)
  2. guides/USER_GUIDE.md  how to use each screen, for owner, staff and platform admin

Contents
  source/       the full source code (backend, frontend, evaluation scripts, Docker files)
  poster/       the A1 poster
  screenshots/  every screen of the working application
  guides/       installation guide and user guide

Quick start (needs Docker Desktop)
  cd source
  sh setup.sh
  docker compose --profile app up --build
  open http://localhost:8088   owner@demo.eksamadhan.ai / Demo-Owner-2026
EOF

(cd "$OUT" && rm -f "$NAME.zip" && zip -qr "$NAME.zip" "$NAME")
echo "Built $OUT/$NAME.zip ($(du -h "$OUT/$NAME.zip" | cut -f1)) from commit $COMMIT"
