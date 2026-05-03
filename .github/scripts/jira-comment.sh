#!/usr/bin/env bash
set -euo pipefail

MSG="${1:-}"
if [[ -z "$MSG" ]]; then
  echo "Usage: jira-comment.sh <message>"
  exit 0
fi

REF_NAME="${GITHUB_REF_NAME:-}"
GIT_COMMIT_MSG="$(git log -1 --pretty=%B 2>/dev/null || true)"

CANDIDATE="$REF_NAME $GIT_COMMIT_MSG $MSG"
JIRA_KEY="$(echo "$CANDIDATE" | grep -oE '[A-Z][A-Z0-9]+-[0-9]+' | head -n1 || true)"

if [[ -z "${JIRA_BASE_URL:-}" || -z "${JIRA_USER_EMAIL:-}" || -z "${JIRA_API_TOKEN:-}" ]]; then
  echo "Jira secrets not set; skipping Jira comment."
  exit 0
fi

if [[ -z "$JIRA_KEY" ]]; then
  echo "No Jira key found (example: KAN-3). Skipping Jira comment."
  exit 0
fi

echo "Posting comment to Jira issue: $JIRA_KEY"

AUTH="$(printf '%s:%s' "$JIRA_USER_EMAIL" "$JIRA_API_TOKEN" | base64)"

PAYLOAD="$(python3 - << 'PY'
import json, os
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

echo "Jira comment posted."