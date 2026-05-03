# Quick Testing Reference - Copy & Paste Commands

## Prerequisites
Set these variables in your terminal:
```bash
export BASE_URL="http://localhost:5000/api"
export ADMIN_TOKEN="your_admin_jwt_here"
export TEAM_LEADER_TOKEN="your_team_leader_jwt_here"
export COLLABORATOR_TOKEN="your_collaborator_jwt_here"
export CYCLE_ID="your_cycle_id_here"
export OBJ_ID="your_objective_id_here"
export USER_ID="your_user_id_here"
```

Or set them inline:
```bash
CYCLE_ID="..." TEAM_LEADER_TOKEN="..." curl ...
```

---

## 1. Create Test Cycle (Admin)

```bash
curl -X POST $BASE_URL/cycles \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "FY2026 Test Cycle",
    "year": 2026,
    "status": "draft",
    "phase1Start": "2026-01-01",
    "phase1End": "2026-03-31",
    "phase2Start": "2026-04-01",
    "phase2End": "2026-10-31",
    "phase3Start": "2026-11-01",
    "phase3End": "2026-12-31",
    "currentPhase": "phase1"
  }' | jq
```

---

## 2. Create Test Objectives (Collaborator)

```bash
# Objective 1
curl -X POST $BASE_URL/objectives \
  -H "Authorization: Bearer $COLLABORATOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Improve System Performance",
    "description": "Optimize database and caching",
    "successIndicator": "Reduce response time from 500ms to 200ms by Q3 2026",
    "weight": 30,
    "cycle": "'$CYCLE_ID'",
    "category": "individual"
  }' | jq '.objective._id'
```

---

## 3. Test Phase 1: Edit All Fields ✅

```bash
curl -X PUT $BASE_URL/objectives/$OBJ_ID \
  -H "Authorization: Bearer $COLLABORATOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "UPDATED - Improve System Performance",
    "weight": 35,
    "successIndicator": "Reduce response time from 500ms to 150ms by Q3 2026, measured via monitoring dashboard"
  }' | jq '.objective | {title, weight, successIndicator}'
```

**Expected**: ✅ 200 OK - All fields updated

---

## 4. Submit & Approve Objective

```bash
# Step 1: Employee submits
curl -X POST $BASE_URL/objectives/$OBJ_ID/submit \
  -H "Authorization: Bearer $COLLABORATOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' | jq '.objective.status'

# Step 2: Manager validates
curl -X POST $BASE_URL/objectives/$OBJ_ID/validate \
  -H "Authorization: Bearer $TEAM_LEADER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "approved",
    "managerComments": "Well structured objective"
  }' | jq '.objective.status'
```

**Expected**: ✅ status = "approved"

---

## 5. Advance to Phase 2

```bash
curl -X PATCH $BASE_URL/cycles/$CYCLE_ID/phase \
  -H "Authorization: Bearer $TEAM_LEADER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"currentPhase": "phase2"}' | jq '.currentPhase'
```

**Expected**: ✅ "phase2"

---

## 6. Test Phase 2: Locked Structural Fields ❌

```bash
# Try to update title (should fail)
curl -X PUT $BASE_URL/objectives/$OBJ_ID \
  -H "Authorization: Bearer $COLLABORATOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "NEW TITLE"}' | jq
```

**Expected**: ❌ 403 Forbidden - "Structural fields are locked"

---

## 7. Test Phase 2: Progress Updates Work ✅

```bash
curl -X POST $BASE_URL/objectives/$OBJ_ID/submit \
  -H "Authorization: Bearer $COLLABORATOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "achievementPercent": 50,
    "selfAssessment": "Halfway through, on track"
  }' | jq '.objective | {achievementPercent, weightedScore}'
```

**Expected**: ✅ achievementPercent = 50, weightedScore = 15 (30×50%)

---

## 8. Test AI: Quality Analysis

```bash
# Good objective
curl -X POST $BASE_URL/ai/analyze-objective-quality \
  -H "Authorization: Bearer $COLLABORATOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Increase Customer Satisfaction",
    "description": "Improve response times and feedback",
    "successIndicator": "Achieve 90% satisfaction by end of Q3 2026"
  }' | jq '.quality, .smartScore'

# Bad objective
curl -X POST $BASE_URL/ai/analyze-objective-quality \
  -H "Authorization: Bearer $COLLABORATOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Improve things",
    "description": "Make better",
    "successIndicator": ""
  }' | jq '.quality, .issues[].type'
```

---

## 9. Test Staleness Detection

```bash
# Check stale objectives (as manager)
curl -X GET $BASE_URL/objectives/stale \
  -H "Authorization: Bearer $TEAM_LEADER_TOKEN" | jq '.summary, .staleObjectives[0].staleness'
```

**Expected**: Shows summary of critical/warning objectives

---

## 10. Test Phase 3: Read-Only

```bash
# Advance to Phase 3
curl -X PATCH $BASE_URL/cycles/$CYCLE_ID/phase \
  -H "Authorization: Bearer $TEAM_LEADER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"currentPhase": "phase3"}' | jq

# Try to update anything (should fail)
curl -X PUT $BASE_URL/objectives/$OBJ_ID \
  -H "Authorization: Bearer $COLLABORATOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"labels": ["test"]}' | jq
```

**Expected**: ❌ 403 Forbidden - "Read-only during Phase 3"

---

## 11. Test Evaluation & Scoring

```bash
curl -X POST $BASE_URL/objectives/$OBJ_ID/evaluate \
  -H "Authorization: Bearer $TEAM_LEADER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "evaluationRating": "exceeded",
    "evaluationComment": "Excellent work",
    "managerAdjustedPercent": 100
  }' | jq '.objective | {status, evaluationRating, managerAdjustedPercent, weightedScore}'
```

**Expected**: ✅ status = "evaluated", weightedScore updated

---

## 12. Check Composite Score

```bash
curl -X GET "$BASE_URL/objectives/user/$USER_ID/cycle/$CYCLE_ID" \
  -H "Authorization: Bearer $TEAM_LEADER_TOKEN" | jq '.validation | {individualScore, teamScore, compositeScore}'
```

---

## Automated Test Sequence

Save as `test.sh` and run with: `bash test.sh`

```bash
#!/bin/bash

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

test_count=0
pass_count=0

test_endpoint() {
  local name=$1
  local method=$2
  local endpoint=$3
  local token=$4
  local data=$5
  local expected_status=${6:-200}
  
  test_count=$((test_count+1))
  
  if [ "$method" == "GET" ]; then
    response=$(curl -s -w "\n%{http_code}" -X GET "http://localhost:5000/api$endpoint" \
      -H "Authorization: Bearer $token")
  else
    response=$(curl -s -w "\n%{http_code}" -X $method "http://localhost:5000/api$endpoint" \
      -H "Authorization: Bearer $token" \
      -H "Content-Type: application/json" \
      -d "$data")
  fi
  
  status=$(echo "$response" | tail -n1)
  body=$(echo "$response" | head -n-1)
  
  if [ "$status" == "$expected_status" ]; then
    echo -e "${GREEN}✓${NC} Test $test_count: $name (HTTP $status)"
    pass_count=$((pass_count+1))
  else
    echo -e "${RED}✗${NC} Test $test_count: $name (Expected $expected_status, got $status)"
    echo "Response: $body"
  fi
}

echo "Running automated tests..."
echo "======================================"

# Load your tokens here
ADMIN_TOKEN="..."
TEAM_LEADER_TOKEN="..."
COLLABORATOR_TOKEN="..."
CYCLE_ID="..."
OBJ_ID="..."

# Test suite
test_endpoint "Phase 1: Edit Title" "PUT" "/objectives/$OBJ_ID" "$COLLABORATOR_TOKEN" \
  '{"title":"Test Title"}' 200

test_endpoint "Phase 1: Edit Weight" "PUT" "/objectives/$OBJ_ID" "$COLLABORATOR_TOKEN" \
  '{"weight":35}' 200

test_endpoint "Get Stale Objectives" "GET" "/objectives/stale" "$TEAM_LEADER_TOKEN" \
  "" 200

test_endpoint "Analyze Quality" "POST" "/ai/analyze-objective-quality" "$COLLABORATOR_TOKEN" \
  '{"title":"Test","description":"Test","successIndicator":"Test indicator minimum 10"}' 200

echo "======================================"
echo "Tests passed: $pass_count / $test_count"
```

---

## Common cURL Shortcuts

**Get just the status code**:
```bash
curl -s -o /dev/null -w "%{http_code}" -X GET $BASE_URL/objectives/$OBJ_ID
```

**Pretty print JSON**:
```bash
curl ... | jq '.'
```

**Extract specific field**:
```bash
curl ... | jq '.objective.weightedScore'
```

**Check error message only**:
```bash
curl ... | jq '.message'
```

---

## Verification Checklist

Use this after running tests:

- [ ] Phase 1 fields (title, description, weight, successIndicator) are editable
- [ ] Phase 2 structural fields are locked with 403 error
- [ ] Phase 2 progress updates work and calculate weightedScore correctly
- [ ] Phase 3 is read-only for non-admins
- [ ] Stale endpoint returns objectives not updated for 14+ days
- [ ] AI quality analysis detects vague language and missing metrics
- [ ] successIndicator is required (10+ chars minimum)
- [ ] Composite score = (individual×0.7) + (team×0.3)

---

## Debug Commands

**Check if objective is in Phase 2**:
```bash
curl -s -X GET $BASE_URL/objectives/$OBJ_ID \
  -H "Authorization: Bearer $COLLABORATOR_TOKEN" | jq '{status, cycle}'
```

**Check current cycle phase**:
```bash
curl -s -X GET $BASE_URL/cycles/$CYCLE_ID \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.currentPhase'
```

**Check when objective was last updated**:
```bash
curl -s -X GET $BASE_URL/objectives/$OBJ_ID \
  -H "Authorization: Bearer $COLLABORATOR_TOKEN" | jq '.updatedAt'
```

**Check all activity on objective**:
```bash
curl -s -X GET $BASE_URL/objectives/$OBJ_ID \
  -H "Authorization: Bearer $COLLABORATOR_TOKEN" | jq '.activityLog'
```

---

## Troubleshooting

**Getting "Unauthorized" (401)**:
```bash
# Verify token is valid
curl -s -X GET $BASE_URL/me \
  -H "Authorization: Bearer $YOUR_TOKEN" | jq '.name'
```

**Getting "Not authorized" (403)**:
```bash
# Check user role
curl -s -X GET $BASE_URL/me \
  -H "Authorization: Bearer $YOUR_TOKEN" | jq '.role'
# Need TEAM_LEADER or ADMIN for certain endpoints
```

**Field changes not persisting**:
```bash
# Verify no phase locks
curl -s -X GET $BASE_URL/cycles/$CYCLE_ID \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.currentPhase'
# Should be phase1 to allow edits
```
