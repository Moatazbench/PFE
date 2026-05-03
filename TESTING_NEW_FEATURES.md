# Complete Testing Guide - Enterprise Performance Management Features

**Last Updated**: April 27, 2026  
**Test Environment**: Local development with seed data

---

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Test Setup](#test-setup)
3. [Feature 1: Phase-Aware Field Locking](#feature-1-phase-aware-field-locking)
4. [Feature 2: Progress Staleness Detection](#feature-2-progress-staleness-detection)
5. [Feature 3: AI Objective Refinement](#feature-3-ai-objective-refinement)
6. [Feature 4: Performance Scoring](#feature-4-performance-scoring)
7. [Feature 5: successIndicator Protection](#feature-5-successindicator-protection)
8. [Edge Cases & Error Handling](#edge-cases--error-handling)
9. [End-to-End Workflow](#end-to-end-workflow)
10. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Tools
- **Postman** or **cURL** or **Insomnia** for API testing
- **MongoDB Compass** (optional, for data verification)
- Backend running: `npm run dev` or equivalent
- Frontend running (for UI verification, optional)
- Test user accounts with roles: ADMIN, TEAM_LEADER, COLLABORATOR

### Test Database State
- At least 1 active cycle
- 1 user with TEAM_LEADER role
- 2-3 COLLABORATOR users assigned to that team leader
- At least 3 existing objectives in various states

### API Base URL
Replace `{BASE_URL}` with your API endpoint:
```
http://localhost:5000/api  (local development)
```

### Authentication
All requests require the `Authorization` header:
```
Authorization: Bearer {JWT_TOKEN}
```

Get token via login:
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@biat.com",
    "password": "password"
  }'
```

---

## Test Setup

### Step 1: Create Test Data

**Create a test cycle with phases (if not exists)**:
```bash
curl -X POST {BASE_URL}/cycles \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "FY2026 Annual Cycle",
    "year": 2026,
    "status": "draft",
    "phase1Start": "2026-01-01",
    "phase1End": "2026-03-31",
    "phase2Start": "2026-04-01",
    "phase2End": "2026-10-31",
    "phase3Start": "2026-11-01",
    "phase3End": "2026-12-31",
    "currentPhase": "phase1"
  }'
```

**Response** (note the cycle ID):
```json
{
  "_id": "CYCLE_ID_HERE",
  "name": "FY2026 Annual Cycle",
  "year": 2026,
  "currentPhase": "phase1",
  "status": "draft"
}
```

### Step 2: Create Test Objectives

**Create 3-4 test objectives** as a COLLABORATOR:
```bash
curl -X POST {BASE_URL}/objectives \
  -H "Authorization: Bearer {COLLABORATOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Increase System Performance",
    "description": "Optimize database queries and caching",
    "successIndicator": "Reduce average response time from 500ms to under 200ms by Q3",
    "weight": 30,
    "cycle": "CYCLE_ID_HERE",
    "category": "individual"
  }'
```

**Response** (save the objective IDs):
```json
{
  "success": true,
  "objective": {
    "_id": "OBJ_ID_1",
    "title": "Increase System Performance",
    "status": "draft",
    "weight": 30
  }
}
```

Create at least 3 objectives with different weights (e.g., 30, 40, 30 = 100%).

---

## Feature 1: Phase-Aware Field Locking

### Test 1.1: Phase 1 - All Fields Editable

**Objective**: Verify you CAN edit all fields during Phase 1

**Setup**: Objective in `draft` status, cycle in `phase1`

**Test**:
```bash
curl -X PUT {BASE_URL}/objectives/OBJ_ID_1 \
  -H "Authorization: Bearer {COLLABORATOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "NEW TITLE - Increase System Performance",
    "description": "Updated description with new details",
    "successIndicator": "Reduce response time from 500ms to 200ms, track via monitoring dashboard",
    "weight": 35,
    "visibility": "team"
  }'
```

**Expected Response**: ✅ 200 OK
```json
{
  "success": true,
  "objective": {
    "title": "NEW TITLE - Increase System Performance",
    "description": "Updated description with new details",
    "successIndicator": "Reduce response time from 500ms to 200ms, track via monitoring dashboard",
    "weight": 35
  }
}
```

**Verification**:
- ✅ Title changed
- ✅ Description changed
- ✅ successIndicator changed
- ✅ Weight changed

---

### Test 1.2: Phase 2 - Structural Fields LOCKED

**Objective**: Verify structural fields are LOCKED during Phase 2

**Setup**:
1. Submit objectives to approval: `POST /objectives/OBJ_ID_1/submit-for-approval`
2. Manager validates: `POST /objectives/OBJ_ID_1/validate` with `status: "approved"`
3. Advance cycle to Phase 2: `PATCH /cycles/CYCLE_ID/phase` with `currentPhase: "phase2"`

**Test 1.2a: Try to update LOCKED field (title)**:
```bash
curl -X PUT {BASE_URL}/objectives/OBJ_ID_1 \
  -H "Authorization: Bearer {COLLABORATOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "SHOULD FAIL - Changed Title"
  }'
```

**Expected Response**: ❌ 403 Forbidden
```json
{
  "success": false,
  "message": "Structural fields (title, description, success indicator, weight) are locked during execution. Use progress updates to track work."
}
```

**Verification**:
- ✅ Received 403 status
- ✅ Clear error message about locked fields
- ✅ Suggestion to use progress updates

---

### Test 1.2b: Try to update ALLOWED field (labels) during Phase 2

**Test**:
```bash
curl -X PUT {BASE_URL}/objectives/OBJ_ID_1 \
  -H "Authorization: Bearer {COLLABORATOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "labels": ["in-progress", "high-priority"]
  }'
```

**Expected Response**: ✅ 200 OK
```json
{
  "success": true,
  "objective": {
    "labels": ["in-progress", "high-priority"]
  }
}
```

**Verification**:
- ✅ Metadata fields CAN be updated
- ✅ No error for non-structural updates

---

### Test 1.3: Phase 2 - Progress Updates Work

**Objective**: Verify progress tracking works during Phase 2

**Test**:
```bash
curl -X POST {BASE_URL}/objectives/OBJ_ID_1/submit \
  -H "Authorization: Bearer {COLLABORATOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "achievementPercent": 45,
    "selfAssessment": "Made good progress this week. Database optimization complete, cache layer in testing."
  }'
```

**Expected Response**: ✅ 200 OK
```json
{
  "success": true,
  "objective": {
    "achievementPercent": 45,
    "selfAssessment": "Made good progress...",
    "weightedScore": 13.5
  }
}
```

**Verification**:
- ✅ Achievement percent updated
- ✅ Weighted score calculated: (30 × 45%) = 13.5
- ✅ No error about locked fields

---

### Test 1.4: Phase 3 - Read-Only for Non-Admins

**Objective**: Verify Phase 3 is read-only

**Setup**:
1. Advance cycle to Phase 3: `PATCH /cycles/CYCLE_ID/phase` with `currentPhase: "phase3"`
2. Objective should be in `evaluated` status

**Test**:
```bash
curl -X PUT {BASE_URL}/objectives/OBJ_ID_1 \
  -H "Authorization: Bearer {COLLABORATOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "labels": ["completed"]
  }'
```

**Expected Response**: ❌ 403 Forbidden
```json
{
  "success": false,
  "message": "Objectives are read-only during Phase 3 (Evaluation). Contact an administrator for changes."
}
```

**Verification**:
- ✅ Received 403 even for metadata fields
- ✅ Clear message that Phase 3 is read-only
- ✅ Admin bypass still works (test with ADMIN token if available)

---

### Test 1.5: Admin Can Override in Phase 3

**Test with ADMIN token**:
```bash
curl -X PUT {BASE_URL}/objectives/OBJ_ID_1 \
  -H "Authorization: Bearer {ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Admin override: Updated description"
  }'
```

**Expected Response**: ✅ 200 OK

**Verification**:
- ✅ Admins bypass Phase 3 read-only
- ✅ Field updated successfully

---

## Feature 2: Progress Staleness Detection

### Test 2.1: Check Stale Objectives (14+ Days No Update)

**Objective**: Manager can identify team members not updating progress

**Setup**:
1. Have objectives in Phase 2, status `approved` or `validated`
2. Last update was >14 days ago
3. Login as TEAM_LEADER

**Test**:
```bash
curl -X GET {BASE_URL}/objectives/stale \
  -H "Authorization: Bearer {TEAM_LEADER_TOKEN}"
```

**Expected Response**: ✅ 200 OK
```json
{
  "success": true,
  "staleObjectives": [
    {
      "_id": "OBJ_ID_1",
      "title": "Increase System Performance",
      "owner": {
        "_id": "USER_ID",
        "name": "John Doe"
      },
      "status": "approved",
      "staleness": {
        "isDaysStale": true,
        "isHighRiskStale": false,
        "daysSinceUpdate": 25,
        "lastUpdateDate": "2026-04-02T10:00:00.000Z",
        "severity": "warning"
      }
    }
  ],
  "summary": {
    "critical": 0,
    "warning": 1,
    "total": 1
  }
}
```

**Verification Checklist**:
- ✅ Only objectives in approved/validated status returned
- ✅ `isDaysStale: true` if daysSinceUpdate >= 14
- ✅ `isHighRiskStale: true` if daysSinceUpdate >= 30
- ✅ `severity` is "warning" (14-29 days) or "critical" (30+ days)
- ✅ Summary aggregates counts correctly

---

### Test 2.2: No Stale Objectives Recently Updated

**Setup**: Update an objective in Phase 2 today

**Test**:
```bash
curl -X POST {BASE_URL}/objectives/OBJ_ID_2/submit \
  -H "Authorization: Bearer {COLLABORATOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "achievementPercent": 60,
    "selfAssessment": "This week: completed task A and started task B."
  }'
```

Then check stale:
```bash
curl -X GET {BASE_URL}/objectives/stale \
  -H "Authorization: Bearer {TEAM_LEADER_TOKEN}"
```

**Expected Response**: ✅ 200 OK
```json
{
  "staleObjectives": [],
  "summary": {
    "critical": 0,
    "warning": 0,
    "total": 0
  }
}
```

**Verification**:
- ✅ Recently updated objective NOT in stale list
- ✅ `isDaysStale: false` when daysSinceUpdate < 14

---

### Test 2.3: Critical vs Warning Severity

**Setup**: Have 3 objectives:
- Obj A: not updated for 35 days → critical
- Obj B: not updated for 20 days → warning
- Obj C: not updated for 5 days → ok

**Test**:
```bash
curl -X GET {BASE_URL}/objectives/stale \
  -H "Authorization: Bearer {TEAM_LEADER_TOKEN}"
```

**Expected Response**: ✅ 200 OK
```json
{
  "staleObjectives": [
    {
      "title": "Obj A",
      "staleness": {
        "daysSinceUpdate": 35,
        "severity": "critical",
        "isHighRiskStale": true
      }
    },
    {
      "title": "Obj B",
      "staleness": {
        "daysSinceUpdate": 20,
        "severity": "warning",
        "isHighRiskStale": false
      }
    }
  ],
  "summary": {
    "critical": 1,
    "warning": 1,
    "total": 2
  }
}
```

**Verification**:
- ✅ Critical objectives at top
- ✅ Summary shows 1 critical, 1 warning
- ✅ Obj C (5 days) not in list

---

### Test 2.4: Authorization - Only Manager Can See Team Stale

**Test with COLLABORATOR**:
```bash
curl -X GET {BASE_URL}/objectives/stale \
  -H "Authorization: Bearer {COLLABORATOR_TOKEN}"
```

**Expected Response**: ❌ 403 Forbidden
```json
{
  "success": false,
  "message": "Only managers can view team staleness"
}
```

**Verification**:
- ✅ COLLABORATOR cannot access
- ✅ TEAM_LEADER and ADMIN can access

---

## Feature 3: AI Objective Refinement

### Test 3.1: Analyze Objective Quality (SMART Validation)

**Objective**: Get AI feedback on objective structure

**Test - GOOD objective**:
```bash
curl -X POST {BASE_URL}/ai/analyze-objective-quality \
  -H "Authorization: Bearer {COLLABORATOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Increase Customer Satisfaction Score",
    "description": "Implement feedback collection system and improve response times",
    "successIndicator": "Achieve 90% customer satisfaction rating by end of Q3 2026, measured via Intercom surveys"
  }'
```

**Expected Response**: ✅ 200 OK
```json
{
  "success": true,
  "quality": "good",
  "issues": [],
  "strengths": [
    "Contains measurable metrics",
    "Contains clear deadline or timeframe",
    "Contains clear action verb"
  ],
  "smartScore": {
    "specific": true,
    "measurable": true,
    "achievable": true,
    "relevant": true,
    "timeBound": true
  }
}
```

**Verification**:
- ✅ No issues flagged
- ✅ All SMART criteria met
- ✅ Strengths identified

---

### Test 3.2: Analyze Objective Quality (BAD - Vague)

**Test - VAGUE objective**:
```bash
curl -X POST {BASE_URL}/ai/analyze-objective-quality \
  -H "Authorization: Bearer {COLLABORATOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Improve team performance",
    "description": "Try to enhance our processes and explore better ways",
    "successIndicator": ""
  }'
```

**Expected Response**: ✅ 200 OK
```json
{
  "success": true,
  "quality": "needs_improvement",
  "issues": [
    {
      "type": "vague_language",
      "severity": "medium",
      "message": "Objective uses vague language. Add specific metrics or numbers...",
      "examples": ["improve", "enhance", "explore"]
    },
    {
      "type": "not_measurable",
      "severity": "high",
      "message": "Success Indicator is missing or vague. Define how you will measure success..."
    },
    {
      "type": "no_deadline",
      "severity": "medium",
      "message": "No clear timeframe specified. Add when this objective must be achieved..."
    }
  ],
  "smartScore": {
    "specific": false,
    "measurable": false,
    "achievable": true,
    "relevant": true,
    "timeBound": false
  }
}
```

**Verification**:
- ✅ Quality marked as "needs_improvement"
- ✅ Vague words detected (improve, enhance, explore)
- ✅ High severity for missing successIndicator
- ✅ SMART score shows false for S, M, T

---

### Test 3.3: Refine Objective Suggestions

**Objective**: Get concrete suggestions for improvement

**Test**:
```bash
curl -X POST {BASE_URL}/ai/refine-objective \
  -H "Authorization: Bearer {COLLABORATOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Improve system uptime",
    "description": "Work on making the system more reliable",
    "successIndicator": ""
  }'
```

**Expected Response**: ✅ 200 OK
```json
{
  "success": true,
  "suggestions": [
    {
      "type": "add_metrics",
      "suggestion": "Add specific targets. For example: 'Increase from 70% to 85%' or 'Reduce from 50ms to 30ms'.",
      "example": "Improve system performance to 30ms response time by Q3 2026"
    },
    {
      "type": "add_deadline",
      "suggestion": "Specify when this must be achieved. Use quarter format (Q1-Q4) or specific dates.",
      "example": "Achieve 90% customer satisfaction by end of Q3 2026"
    },
    {
      "type": "add_kpi_plan",
      "suggestion": "Consider how you'll track progress. What leading and lagging indicators matter?",
      "example": "Weekly dashboard updates, bi-weekly stakeholder reviews, monthly milestone checks"
    }
  ],
  "refinementTemplates": [
    {
      "template": "Increase [metric] from [current] to [target] by [deadline] through [actions]",
      "example": "Increase customer satisfaction from 75% to 90% by Q3 through bi-weekly feedback loops"
    },
    {
      "template": "Reduce [metric] from [current] to [target] by [deadline] by implementing [approach]",
      "example": "Reduce average bug resolution time from 4 days to 2 days by Q2 by implementing automated testing"
    }
  ],
  "recommendedFormat": "Use the format: [Action Verb] [Object] [Target] by [Deadline] through [Method]"
}
```

**Verification**:
- ✅ Specific suggestions provided
- ✅ Templates show recommended structure
- ✅ Examples are concrete and actionable

---

## Feature 4: Performance Scoring

### Test 4.1: Base Scoring (Weight × Achievement)

**Objective**: Verify weighted score calculation

**Setup**: Objective with weight 30, achievementPercent 80

**Test**:
```bash
curl -X GET {BASE_URL}/objectives/OBJ_ID_1 \
  -H "Authorization: Bearer {COLLABORATOR_TOKEN}"
```

**Expected Response**: ✅ 200 OK
```json
{
  "objective": {
    "weight": 30,
    "achievementPercent": 80,
    "weightedScore": 24.0,
    "managerAdjustedPercent": null
  }
}
```

**Verification**:
- ✅ weightedScore = (30 × 80) / 100 = 24.0

---

### Test 4.2: Manager Adjustment Override

**Objective**: Manager can adjust score for quality considerations

**Setup**: Objective evaluated by manager

**Test - Manager adjusts score**:
```bash
curl -X POST {BASE_URL}/objectives/OBJ_ID_1/evaluate \
  -H "Authorization: Bearer {TEAM_LEADER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "evaluationRating": "met",
    "evaluationComment": "Good execution, slight delays but high quality work",
    "managerAdjustedPercent": 85
  }'
```

**Expected Response**: ✅ 200 OK
```json
{
  "success": true,
  "objective": {
    "status": "evaluated",
    "evaluationRating": "met",
    "managerAdjustedPercent": 85,
    "weightedScore": 25.5
  }
}
```

**Verification**:
- ✅ weightedScore = (30 × 85) / 100 = 25.5
- ✅ Manager adjustment takes precedence
- ✅ Activity logged

---

### Test 4.3: Composite Score (Individual + Team)

**Objective**: Verify 70/30 split between individual and team objectives

**Setup**: Employee with:
- Individual objectives (weight 100%):
  - Obj A: weight 50, score 25
  - Obj B: weight 50, score 20
  - Individual total: 45 points

- Team objectives (weight 100%):
  - Obj C: weight 100, score 25
  - Team total: 25 points

**Test**:
```bash
curl -X GET {BASE_URL}/objectives/user/USER_ID/cycle/CYCLE_ID \
  -H "Authorization: Bearer {TEAM_LEADER_TOKEN}"
```

**Expected Response**: ✅ 200 OK
```json
{
  "validation": {
    "individualScore": 31.5,
    "teamScore": 7.5,
    "compositeScore": 39.0
  }
}
```

**Verification**:
- ✅ Individual score = 45 × 0.70 = 31.5
- ✅ Team score = 25 × 0.30 = 7.5
- ✅ Composite = 31.5 + 7.5 = 39.0

---

## Feature 5: successIndicator Protection

### Test 5.1: successIndicator Required on Creation

**Objective**: Cannot create without successIndicator

**Test - Missing successIndicator**:
```bash
curl -X POST {BASE_URL}/objectives \
  -H "Authorization: Bearer {COLLABORATOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Objective",
    "description": "Description here",
    "weight": 25,
    "cycle": "CYCLE_ID"
  }'
```

**Expected Response**: ❌ 400 Bad Request
```json
{
  "success": false,
  "message": "Success Indicator is required for SMART goals"
}
```

**Verification**:
- ✅ Creation blocked
- ✅ Clear error message

---

### Test 5.2: successIndicator Minimum Length

**Objective**: Must be at least 10 characters

**Test - Too short**:
```bash
curl -X POST {BASE_URL}/objectives \
  -H "Authorization: Bearer {COLLABORATOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Objective",
    "description": "Description",
    "successIndicator": "Good",
    "weight": 25,
    "cycle": "CYCLE_ID"
  }'
```

**Expected Response**: ❌ 400 Bad Request
```json
{
  "success": false,
  "message": "Success Indicator must be descriptive (at least 10 characters)."
}
```

**Verification**:
- ✅ Validation enforced
- ✅ Minimum length requirement

---

### Test 5.3: successIndicator Locked During Phase 2

**Objective**: Cannot modify successIndicator during execution

**Setup**: Objective in Phase 2, status `approved`

**Test**:
```bash
curl -X PUT {BASE_URL}/objectives/OBJ_ID_1 \
  -H "Authorization: Bearer {COLLABORATOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "successIndicator": "Changed success indicator"
  }'
```

**Expected Response**: ❌ 403 Forbidden
```json
{
  "success": false,
  "message": "Structural fields (title, description, success indicator, weight) are locked during execution..."
}
```

**Verification**:
- ✅ successIndicator listed as locked field
- ✅ Clear error message

---

### Test 5.4: successIndicator Can Be Updated in Phase 1

**Setup**: Objective in `draft` status, Phase 1

**Test**:
```bash
curl -X PUT {BASE_URL}/objectives/OBJ_ID_1 \
  -H "Authorization: Bearer {COLLABORATOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "successIndicator": "Updated success indicator - now 15+ characters minimum"
  }'
```

**Expected Response**: ✅ 200 OK
```json
{
  "success": true,
  "objective": {
    "successIndicator": "Updated success indicator - now 15+ characters minimum"
  }
}
```

**Verification**:
- ✅ Update successful in Phase 1
- ✅ New value saved

---

## Edge Cases & Error Handling

### Test 6.1: Collaborative Edit Conflict

**Objective**: Verify last-update-wins behavior

**Setup**: Two users editing same objective simultaneously

**Test**:
```bash
# User A updates
curl -X PUT {BASE_URL}/objectives/OBJ_ID_1 \
  -H "Authorization: Bearer {USER_A_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"description": "User A description"}'

# User B updates same field (slightly after)
curl -X PUT {BASE_URL}/objectives/OBJ_ID_1 \
  -H "Authorization: Bearer {USER_B_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"description": "User B description"}'

# Verify final state
curl -X GET {BASE_URL}/objectives/OBJ_ID_1 \
  -H "Authorization: Bearer {USER_A_TOKEN}"
```

**Expected Result**: 
```json
{
  "description": "User B description"
}
```

**Verification**:
- ✅ Last update wins
- ✅ Both requests succeeded
- ✅ Activity log shows both updates

---

### Test 6.2: Invalid Phase Transition

**Objective**: Cannot skip phases or go backward

**Setup**: Cycle in `phase1`

**Test - Try to jump to phase3**:
```bash
curl -X PATCH {BASE_URL}/cycles/CYCLE_ID/phase \
  -H "Authorization: Bearer {ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "currentPhase": "phase3"
  }'
```

**Expected Response**: ✅ 200 OK (Admin can override)
```json
{
  "currentPhase": "phase3"
}
```

**Test same with TEAM_LEADER**:
```bash
curl -X PATCH {BASE_URL}/cycles/CYCLE_ID/phase \
  -H "Authorization: Bearer {TEAM_LEADER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "currentPhase": "phase3"
  }'
```

**Expected Response**: ❌ 400 Bad Request
```json
{
  "message": "Cannot skip phases. Must advance from phase1 to phase2"
}
```

**Verification**:
- ✅ Admin can skip phases
- ✅ Non-admin cannot skip
- ✅ Forward-only enforcement

---

### Test 6.3: Weight Validation After Rejection

**Objective**: Rejected objectives don't count toward weight total

**Setup**: 
- Objective A: weight 40, status approved
- Objective B: weight 30, status rejected
- Objective C: weight 25, status draft

**Test - Try to add Objective D with weight 10**:
```bash
curl -X POST {BASE_URL}/objectives \
  -H "Authorization: Bearer {COLLABORATOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "New Objective",
    "description": "Testing weight",
    "successIndicator": "Measure success properly here",
    "weight": 10,
    "cycle": "CYCLE_ID"
  }'
```

**Expected Response**: ✅ 201 Created
```json
{
  "success": true,
  "objective": {
    "weight": 10
  }
}
```

**Verification**:
- ✅ Total: 40 (approved) + 25 (draft) + 10 (new) = 75% ✅
- ✅ Rejected objectives excluded
- ✅ Remaining 25% capacity still available

---

### Test 6.4: Non-Owner Cannot Update Phase 2

**Setup**: Objective owned by User A, attempting to edit from User B

**Test - User B tries to edit**:
```bash
curl -X PUT {BASE_URL}/objectives/OBJ_OWNED_BY_A \
  -H "Authorization: Bearer {USER_B_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"labels": ["updated"]}'
```

**Expected Response**: ❌ 403 Forbidden
```json
{
  "success": false,
  "message": "Not authorized to update."
}
```

**Verification**:
- ✅ Only owner/admin/leader can edit
- ✅ Authorization enforced

---

## End-to-End Workflow

### Complete Cycle Test: Phase 1 → 2 → 3

This test validates the entire lifecycle in one flow.

#### Phase 1: Planning (Week 1)

**Step 1.1: Employee creates objectives**
```bash
# Create 3 objectives with 30%, 40%, 30% weights
```

**Step 1.2: AI quality check**
```bash
curl -X POST {BASE_URL}/ai/analyze-objective-quality \
  -H "Authorization: Bearer {COLLABORATOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "objective title",
    "description": "...",
    "successIndicator": "..."
  }'
# Review for SMART compliance
```

**Step 1.3: Employee submits objectives**
```bash
curl -X POST {BASE_URL}/objectives/OBJ_ID_1/submit \
  -H "Authorization: Bearer {COLLABORATOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"cycle": "CYCLE_ID"}'
```

**Step 1.4: Manager validates**
```bash
curl -X POST {BASE_URL}/objectives/OBJ_ID_1/validate \
  -H "Authorization: Bearer {TEAM_LEADER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "approved",
    "managerComments": "Good goals, well structured"
  }'
```

**Expected**: 3 objectives approved, total weight = 100%

---

#### Phase 2: Execution (Week 2 - Week 24)

**Step 2.1: Advance cycle to Phase 2**
```bash
curl -X PATCH {BASE_URL}/cycles/CYCLE_ID/phase \
  -H "Authorization: Bearer {TEAM_LEADER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"currentPhase": "phase2"}'
```

**Step 2.2: Employee submits progress update**
```bash
curl -X POST {BASE_URL}/objectives/OBJ_ID_1/submit \
  -H "Authorization: Bearer {COLLABORATOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "achievementPercent": 25,
    "selfAssessment": "Quarter progress: 25% complete. On track for delivery."
  }'
```

**Step 2.3: Verify structural fields are locked**
```bash
curl -X PUT {BASE_URL}/objectives/OBJ_ID_1 \
  -H "Authorization: Bearer {COLLABORATOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"title": "Changed Title"}'
# Should get 403 error
```

**Step 2.4: Manager checks staleness (after 14+ days idle)**
```bash
# Skip progress updates for 14+ days

curl -X GET {BASE_URL}/objectives/stale \
  -H "Authorization: Bearer {TEAM_LEADER_TOKEN}"
# Should show this objective as stale
```

**Step 2.5: Employee provides final progress**
```bash
curl -X POST {BASE_URL}/objectives/OBJ_ID_1/submit \
  -H "Authorization: Bearer {COLLABORATOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "achievementPercent": 100,
    "selfAssessment": "Completed with all success criteria met."
  }'
```

**Expected**: weightedScore = (30 × 100) / 100 = 30

---

#### Phase 3: Evaluation (Week 25-26)

**Step 3.1: Advance cycle to Phase 3**
```bash
curl -X PATCH {BASE_URL}/cycles/CYCLE_ID/phase \
  -H "Authorization: Bearer {TEAM_LEADER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"currentPhase": "phase3"}'
```

**Step 3.2: Verify objectives are read-only**
```bash
curl -X PUT {BASE_URL}/objectives/OBJ_ID_1 \
  -H "Authorization: Bearer {COLLABORATOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"labels": ["test"]}'
# Should get 403 error
```

**Step 3.3: Manager evaluates objective**
```bash
curl -X POST {BASE_URL}/objectives/OBJ_ID_1/evaluate \
  -H "Authorization: Bearer {TEAM_LEADER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "evaluationRating": "exceeded",
    "evaluationComment": "Excellent execution. Early delivery with high quality.",
    "managerAdjustedPercent": 105
  }'
```

**Step 3.4: Verify final score (with manager adjustment)**
```bash
curl -X GET {BASE_URL}/objectives/OBJ_ID_1 \
  -H "Authorization: Bearer {TEAM_LEADER_TOKEN}"
```

**Expected**:
```json
{
  "status": "evaluated",
  "evaluationRating": "exceeded",
  "managerAdjustedPercent": 105,
  "weightedScore": 31.5
}
```

**Step 3.5: Calculate composite performance**
```bash
curl -X GET {BASE_URL}/objectives/user/USER_ID/cycle/CYCLE_ID \
  -H "Authorization: Bearer {TEAM_LEADER_TOKEN}"
```

**Expected**: compositeScore calculated based on all evaluated objectives

---

## Troubleshooting

### Issue: "Phase not found" or "Phase undefined"

**Cause**: Cycle not properly loaded or currentPhase not set

**Solution**:
```bash
# Check cycle has currentPhase
curl -X GET {BASE_URL}/cycles/CYCLE_ID \
  -H "Authorization: Bearer {ADMIN_TOKEN}"

# Verify phase field exists and is valid
# Should be one of: phase1, phase2, phase3, closed
```

---

### Issue: "Not authorized to update" in Phase 1

**Cause**: Role checking failing or wrong cycle context

**Solution**:
```bash
# Verify user role
curl -X GET {BASE_URL}/me \
  -H "Authorization: Bearer {TOKEN}"

# Verify objective owner
curl -X GET {BASE_URL}/objectives/OBJ_ID \
  -H "Authorization: Bearer {TOKEN}"
# Check owner field matches user._id
```

---

### Issue: weightedScore not calculated

**Cause**: Missing achievementPercent or not submitted

**Solution**:
```bash
# Ensure progress submitted
curl -X POST {BASE_URL}/objectives/OBJ_ID/submit \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"achievementPercent": 50}'

# Check response includes weightedScore
```

---

### Issue: Staleness endpoint returns empty but should have results

**Cause**: Objectives not in correct status or weren't updated 14+ days ago

**Solution**:
```bash
# Check objective status
curl -X GET {BASE_URL}/objectives/OBJ_ID \
  -H "Authorization: Bearer {TOKEN}"
# Should be "approved" or "validated"

# Check last update date
# updatedAt or progressUpdates timestamps
# Must be older than 14 days

# For testing, manually edit test data in MongoDB:
db.objectives.updateOne(
  {_id: ObjectId("OBJ_ID")},
  {$set: {updatedAt: new Date(Date.now() - 20*24*60*60*1000)}}
)
```

---

### Issue: AI endpoint returns empty suggestions

**Cause**: Objective already well-formed, no issues detected

**Expected Behavior**: This is correct. Test with a poorly-structured objective:

```bash
curl -X POST {BASE_URL}/ai/analyze-objective-quality \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Improve things",
    "description": "Make better",
    "successIndicator": ""
  }'
```

---

## Checklist for Complete Testing

Use this checklist to ensure all features are tested:

### Phase-Aware Field Locking
- [ ] Phase 1: Can edit all fields
- [ ] Phase 2: Cannot edit structural fields (title, description, weight, successIndicator)
- [ ] Phase 2: Can edit metadata (labels, visibility)
- [ ] Phase 3: Cannot edit any fields (non-admin)
- [ ] Admin can override Phase 3 read-only

### Staleness Detection
- [ ] Can retrieve stale objectives as manager
- [ ] 14-day warning threshold works
- [ ] 30-day critical threshold works
- [ ] Severity levels correct
- [ ] COLLABORATOR cannot access endpoint

### AI Refinement
- [ ] analyzeObjectiveQuality detects issues
- [ ] analyzeObjectiveQuality shows SMART scores
- [ ] refineObjective provides suggestions
- [ ] Templates provided for improvement

### Performance Scoring
- [ ] weightedScore = (weight × achievement%) / 100
- [ ] Manager adjustments override base score
- [ ] Composite score: 70% individual + 30% team

### successIndicator Protection
- [ ] Required on creation
- [ ] Minimum 10 characters enforced
- [ ] Locked during Phase 2+
- [ ] Updatable during Phase 1

---

## Performance Benchmarks (Optional)

Monitor these metrics during testing:

| Operation | Target Time | Actual | Status |
|-----------|------------|--------|--------|
| GET /objectives | < 200ms | _____ | [ ] |
| POST /objectives | < 300ms | _____ | [ ] |
| PUT /objectives | < 200ms | _____ | [ ] |
| GET /objectives/stale | < 500ms | _____ | [ ] |
| POST /ai/analyze-objective-quality | < 1s | _____ | [ ] |

---

## Sign-Off

Testing completed by: ________________  
Date: ________________  
Environment: ________________  
Notes: ________________________________________________

All tests passed: [ ] Yes [ ] No

Issues found: ________________________________________________
