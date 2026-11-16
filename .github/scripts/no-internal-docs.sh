#!/usr/bin/env bash
# Public repo: internal documents (docs/, pitch, submissions, office/pdf/video files) must never be committed.
set -euo pipefail
bad=$(git ls-files | grep -iE '^docs/|(^|/)pitch/|(^|/)submission-images/|SUBMISSION[^/]*\.md$|\.(pdf|docx?|pptx?|key|xlsx?|od[tps]|mov|mp4)$' || true)
if [ -n "$bad" ]; then
  echo "::error::Internal documents are not allowed in this public repo. Remove these files (keep them in regenbazaar-private):"
  echo "$bad"
  exit 1
fi
echo "OK: no internal documents tracked."
