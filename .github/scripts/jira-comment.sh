#!/usr/bin/env bash
set -euo pipefail

MSG="${1:-}"
if [[ -z "$MSG" ]]; then
  echo "Usage: jira-comment.sh <message>"
  exit 0
fi

REF_NAME="${GITHUB_REF_NAME:-}"
COMMIT_MSG="${GITHUB_EVENT_HEAD_COMMIT_MESSAGE:-}"
PR_TITLE="${GITHUB_EVENT_PULL_REQUEST_TITLE:-}"
CANDIDATE="$REF_NAME $COMMIT_MSG $PR_TITLE"

JIRA_KEY="$(echo "$CANDIDATE" | grep -oE '[A-Z][A-Z0-9]+-[0-9]+' | head -n1 || true)"

if [[ -z "${JIRA_BASE_URL:-}" || -z "${JIRA_USER_EMAIL:-}" || -z "${JIRA_API_TOKEN:-}" ]]; then
  echo "Jira secrets not set; skipping Jira comment."
  exit 0
fi

if [[ -z "$JIRA_KEY" ]]; then
  echo "No Jira key found (example: PFE-123). Skipping Jira comment."
  exit 0
fi

AUTH="$(printf '%s:%s' "$JIRA_USER_EMAIL" "$JIRA_API_TOKEN" | base64)"

PAYLOAD="$(python3 - << 'PY'
import json, os, sys
msg = os.environ.get("JIRA_MSG", "")
body = {
  "body": {
    "type": "doc",
    "version": 1,
    "content": [{
      "type": "paragraph",
      "content": [{"type":"text","text": msg}]
    }]
  }
}
print(json.dumps(body))
PY
)"

curl -fsS -X POST \
  -H "Authorization: Basic ${AUTH}" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  "${JIRA_BASE_URL}/rest/api/3/issue/${JIRA_KEY}/comment" \
  --data "${PAYLOAD}"
