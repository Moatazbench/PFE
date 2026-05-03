# FULL TESTING PLAYBOOK — PART 2
# Goals (Goal Model), Objectives, Goal Approvals, Mid-Year, Final Eval

---

# MODULE 5: ANNUAL GOALS (Goal Model — /annual-goals)

## TEST 5.1: Create Goal During Phase 1
- Preconditions: Login as james.dev@biat.com, active cycle in Phase 1
- Steps:
  1. Go to /annual-goals
  2. Click "+ Add Goal"
  3. Fill: Title="Increase sales by 20%", Weight=30, Priority=High
  4. Save
- Expected: Goal created with status "draft"

## TEST 5.2: Create Goal — Empty Title
- Steps:
  1. Open create modal, leave title empty, fill weight
  2. Try to save
- Expected: Validation error prevents creation

## TEST 5.3: Create Goal — Zero Weight
- Steps:
  1. Create goal with weight=0
  2. Try to submit it
- Expected: Error "Goal must have a weight greater than 0"

## TEST 5.4: Create Multiple Goals (Check Weight Total)
- Steps:
  1. Create 3 goals: Weight 40, 30, 30 (total = 100)
  2. Check the validation bar
- Expected: Weight bar shows 100%, green color

## TEST 5.5: Create Goal — Weight Exceeds 100%
- Steps:
  1. Already have 100% weight in goals
  2. Try to create another goal with weight=10
- Expected: Warning about exceeding 100%

## TEST 5.6: Submit Goal for Approval
- Steps:
  1. Find a draft goal
  2. Click "Submit"
- Expected: Status changes to "submitted", manager gets notified

## TEST 5.7: BLOCKED — Submit Already Approved Goal
- Steps:
  1. Find an approved goal
  2. Try to submit it again (if button exists, or via API)
- Expected: Error "Only draft or needs_revision goals can be submitted"

## TEST 5.8: Edit a Draft Goal
- Steps:
  1. Click Edit on a draft goal
  2. Change title and weight
  3. Save
- Expected: Goal updated successfully

## TEST 5.9: BLOCKED — Edit an Approved Goal (as Employee)
- Steps:
  1. Try to edit a goal that's already approved
- Expected: Error "Only draft or revision-requested goals can be edited"
  OR form fields are disabled

## TEST 5.10: Delete a Draft Goal
- Steps:
  1. Click Delete on a draft goal
  2. Confirm deletion
- Expected: Goal removed from list

## TEST 5.11: BLOCKED — Delete a Submitted/Approved Goal
- Steps:
  1. Try to delete a goal that's not in draft
- Expected: Error "Only drafts can be deleted"

## TEST 5.12: BLOCKED — Create Goal During Phase 2
- Preconditions: Cycle advanced to Phase 2
- Steps:
  1. Login as collaborator, go to /annual-goals
- Expected: "+ Add Goal" button NOT visible

## TEST 5.13: BLOCKED — Submit Goal During Phase 2
- Steps (API test):
  1. Try POST /api/goals/{id}/submit while cycle is in phase2
- Expected: 403 "Action allowed during phase1"

---

# MODULE 6: GOAL APPROVALS (Manager — /goal-approvals)

## TEST 6.1: View Pending Goals (as Team Leader)
- Preconditions: Login as ahmed.lead@biat.com, team member submitted goals
- Steps:
  1. Go to /goal-approvals
- Expected: List of submitted goals from team members

## TEST 6.2: Approve a Goal
- Steps:
  1. Find a submitted goal
  2. Click Approve
- Expected: Status → "approved", employee notified

## TEST 6.3: Reject / Request Revision
- Steps:
  1. Find a submitted goal
  2. Click "Request Revision" or "Reject"
  3. Enter feedback comment
  4. Submit
- Expected: Status → "needs_revision", employee sees manager feedback

## TEST 6.4: BLOCKED — Approve Already Approved Goal
- Steps:
  1. Try to approve a goal that's already approved
- Expected: Error "Only submitted goals can be approved"

## TEST 6.5: Employee Revises and Resubmits
- Preconditions: Goal is in "needs_revision"
- Steps:
  1. Login as employee
  2. Edit the goal
  3. Resubmit
- Expected: Status goes back to "submitted"

## TEST 6.6: BLOCKED — Approve Goal During Phase 2
- Steps:
  1. While cycle is in phase2, try to approve a goal
- Expected: Error "Action allowed during phase1"

## TEST 6.7: Approve Goal as Wrong Manager
- Steps:
  1. Login as sofia.lead@biat.com (different team)
  2. Try to approve a goal belonging to Ahmed's team
- Expected: 403 Forbidden

---

# MODULE 7: OBJECTIVES SYSTEM (/goals page)

## TEST 7.1: Create Individual Objective
- Preconditions: Login as collaborator, Phase 1
- Steps:
  1. Go to /goals
  2. Create objective: Title, Weight, Description
- Expected: Objective created in "draft" status

## TEST 7.2: Submit Objective for Approval
- Steps:
  1. Click Submit on a draft objective
- Expected: Status → "pending", team leader notified

## TEST 7.3: Manager Approves Objective
- Login as team leader
- Approve the objective
- Expected: Status → "approved"

## TEST 7.4: Manager Requests Revision
- Steps:
  1. Reject or request revision on an objective
  2. Enter revision reason
- Expected: Status → "revision_requested", employee notified

## TEST 7.5: BLOCKED — Create Objective During Phase 2
- Expected: 403 error "Goals can only be created during Phase 1"

## TEST 7.6: Team Objective (Manager assigns to entire team)
- Login as team leader
- Create a "team" category objective
- Expected: Objective distributed to all team members

## TEST 7.7: Acknowledge Manager-Assigned Objective
- Login as employee who received assigned goal
- Accept or request clarification
- Expected: Status → "approved" or clarification comment added

## TEST 7.8: Mark Objective Completed (Phase 2 or 3)
- Preconditions: Cycle in Phase 2, objective is approved
- Steps:
  1. Login as employee
  2. Mark objective as completed
  3. Enter self-assessment and achievement %
- Expected: Saved, manager notified. NO CRASH (this was the critical bug fix)

## TEST 7.9: BLOCKED — Mark Completed During Phase 1
- Expected: Error "only allowed during phase2 or phase3"

## TEST 7.10: Manager Evaluates Objective (Phase 3 only)
- Preconditions: Cycle in Phase 3
- Steps:
  1. Login as team leader
  2. Evaluate an objective: rating, comment, adjusted %
- Expected: Status → "evaluated"

## TEST 7.11: BLOCKED — Evaluate During Phase 2
- Expected: Error "only allowed during phase3"

## TEST 7.12: Batch Submit All Objectives
- Steps:
  1. Have 3-10 objectives totaling 100% weight
  2. Click "Submit All"
- Expected: All submitted at once

## TEST 7.13: BLOCKED — Batch Submit with < 3 or > 10 Objectives
- Expected: Error about count requirement

## TEST 7.14: BLOCKED — Batch Submit when Weight != 100%
- Expected: Error showing current weight total

---

# MODULE 8: MID-YEAR ASSESSMENTS (/midyear-assessments)

## TEST 8.1: View Mid-Year Page During Phase 2
- Login as collaborator
- Expected: Assessment form enabled, goals listed

## TEST 8.2: Submit Self-Assessment (Employee)
- Steps:
  1. Enter progress %, comments for each goal
  2. Submit
- Expected: Review saved, manager can see it

## TEST 8.3: Submit Manager Assessment
- Login as team leader
- Provide assessment for employee's goals
- Expected: Goal status → "midyear_assessed"

## TEST 8.4: View Mid-Year During Phase 1 (Read-Only)
- Expected: Page shows "read-only mode" banner, forms disabled

## TEST 8.5: View Mid-Year During Phase 3 (Read-Only)
- Expected: Can view past assessments but cannot edit

---

# MODULE 9: FINAL EVALUATIONS (/final-evaluations)

## TEST 9.1: View Final Evaluation During Phase 3
- Login as collaborator
- Expected: Self-assessment form enabled

## TEST 9.2: Submit Final Self-Assessment
- Steps:
  1. Enter final completion %, comments
  2. Submit
- Expected: Saved successfully

## TEST 9.3: Manager Submits Final Evaluation
- Login as team leader
- Evaluate each goal with final score
- Expected: Goal status → "final_evaluated"

## TEST 9.4: BLOCKED — Submit During Phase 2
- Expected: Error toast "only during Phase 3"

## TEST 9.5: View Final Eval After Cycle Closed
- Expected: Read-only view of all evaluations

---

# MODULE 10: EVALUATION SCORING (/evaluation-scoring, /evaluation-list)

## TEST 10.1: Create Evaluation (Phase 3 Only)
- Login as team leader
- Create evaluation for a team member
- Expected: Evaluation created with goal assessments populated

## TEST 10.2: BLOCKED — Create Evaluation During Phase 1 or 2
- Expected: 403 "only during Phase 3"

## TEST 10.3: Score Evaluation
- Steps:
  1. Open an evaluation
  2. Review each goal assessment
  3. Adjust scores, add comments
  4. Submit final score
- Expected: Score calculated, status updated

## TEST 10.4: Duplicate Evaluation (same employee+cycle)
- Try to create a second evaluation for same person
- Expected: Error "evaluation already exists"

## TEST 10.5: View Evaluation List
- Go to /evaluation-list
- Expected: All evaluations for current cycle listed
