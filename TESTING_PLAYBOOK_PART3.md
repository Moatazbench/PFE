# FULL TESTING PLAYBOOK — PART 3
# Remaining Modules, Edge Cases, E2E, Regression

---

# MODULE 11: DASHBOARD (/dashboard)

## TEST 11.1: Dashboard Loads for Each Role
- Login as each role (ADMIN, HR, TEAM_LEADER, COLLABORATOR)
- Expected: Dashboard loads without errors, shows role-appropriate data

## TEST 11.2: Dashboard Stats Accuracy
- Compare displayed stats (goal count, team count) with actual data
- Expected: Numbers match reality

## TEST 11.3: Admin Dashboard (/admin-dashboard)
- Login as admin@biat.com → /admin-dashboard
- Expected: System-wide stats, cycle status displayed

## TEST 11.4: Admin Dashboard — COLLABORATOR Blocked
- Login as james.dev@biat.com → navigate to /admin-dashboard
- Expected: Access denied / redirected

---

# MODULE 12: MY TEAM (/my-team)

## TEST 12.1: Team Leader Views Their Team
- Login as ahmed.lead@biat.com → /my-team
- Expected: Lists team members with their info

## TEST 12.2: Collaborator Views My Team
- Login as james.dev@biat.com → /my-team
- Expected: Shows their own team info or restricted view

---

# MODULE 13: HR DECISIONS (/hr-decisions)

## TEST 13.1: View HR Decisions (as HR)
- Login as hr@biat.com → /hr-decisions
- Expected: List of decisions displayed

## TEST 13.2: Create HR Decision
- Create a new decision for an employee
- Expected: Decision saved

## TEST 13.3: HR Decisions — COLLABORATOR Blocked
- Login as collaborator → /hr-decisions
- Expected: Access denied

---

# MODULE 14: MEETINGS (/meetings)

## TEST 14.1: Create Meeting
- Steps: Create a new meeting with title, date, participants
- Expected: Meeting saved and visible

## TEST 14.2: View Meetings List
- Expected: All relevant meetings displayed

## TEST 14.3: Edit/Cancel Meeting
- Edit meeting details or cancel it
- Expected: Changes saved

---

# MODULE 15: FEEDBACK (/feedback)

## TEST 15.1: Submit Feedback
- Login as any user, go to /feedback
- Submit feedback for a colleague
- Expected: Feedback saved

## TEST 15.2: View Received Feedback
- Expected: Can see feedback received from others

---

# MODULE 16: TASKS (/tasks)

## TEST 16.1: Create Task
- Create a new task with title, description, due date
- Expected: Task created

## TEST 16.2: Update Task Status
- Mark task as in-progress then completed
- Expected: Status transitions work

---

# MODULE 17: NOTIFICATIONS

## TEST 17.1: Notification on Goal Submit
- Submit a goal → check if manager sees notification
- Expected: Notification appears

## TEST 17.2: Notification on Goal Approve/Reject
- Manager approves goal → employee gets notification
- Expected: Notification visible

## TEST 17.3: Mark Notification as Read
- Click on a notification
- Expected: Marked as read

## TEST 17.4: Mark All as Read
- Click "Mark all read"
- Expected: All notifications cleared

---

# MODULE 18: SETTINGS (/settings)

## TEST 18.1: View Profile Settings
- Go to /settings
- Expected: Current user info displayed

## TEST 18.2: Update Profile
- Change name or profile image
- Expected: Updated successfully

---

# MODULE 19: ADDITIONAL PAGES

## TEST 19.1: Team Feed (/feed)
- Expected: Activity feed loads

## TEST 19.2: Career Page (/career)
- Expected: Career data loads

## TEST 19.3: Analytics (/analytics)
- Expected: Charts/data display correctly

## TEST 19.4: Performance (/performance)
- Expected: Performance metrics load

## TEST 19.5: Audit Logs (/audit-logs) — ADMIN only
- Login as admin → /audit-logs
- Expected: Log entries visible

## TEST 19.6: AI Assistant (/ai-assistant)
- Expected: Page loads, can interact

## TEST 19.7: Validation Page (/validation)
- Expected: Shows validation status

---

# MODULE 20: EDGE CASES (CRITICAL)

## TEST 20.1: Double-Click Submit Goal
- Rapidly click Submit twice on a goal
- Expected: Only one submission, no duplicate

## TEST 20.2: Refresh During Goal Creation
- Open create modal, fill form, hit F5
- Expected: Modal closed, no partial data saved

## TEST 20.3: Concurrent Manager Actions
- Two managers try to approve same goal simultaneously
- Expected: One succeeds, other gets error

## TEST 20.4: Empty Goal List
- New user with no goals in a cycle
- Expected: "No Goals Yet" placeholder, no crash

## TEST 20.5: Invalid URL Navigation
- Go to http://localhost:5173/nonexistent
- Expected: Redirected to /login

## TEST 20.6: API with Invalid ObjectId
- Manually call GET /api/goals/invalidid123
- Expected: 400 "Invalid ID format" (not 500 crash)

## TEST 20.7: Submit Goal in Closed Cycle
- Expected: Error "Cycle is closed"

## TEST 20.8: Submit Goal in Draft Cycle
- Expected: Error "Cycle has not been started yet"

## TEST 20.9: Create 11+ Objectives in One Cycle
- Expected: Error "Maximum objectives reached" (max 10)

## TEST 20.10: Duplicate Objective Title in Same Cycle
- Create two objectives with identical titles
- Expected: Error "Duplicate objective title"

---

# MODULE 21: END-TO-END SCENARIOS

## E2E-1: COMPLETE CYCLE — HAPPY PATH
This is the most important test. Follow every step in order.

### Phase 0: Setup
1. Login as admin@biat.com
2. Go to /cycles → Create new cycle "E2E Test 2026"
3. Fill all dates, save (status = draft)
4. Start the cycle → phase1, status = in_progress

### Phase 1: Goal Setting
5. Login as james.dev@biat.com (COLLABORATOR)
6. Go to /annual-goals → Create 3 goals (weights: 40, 30, 30)
7. Submit all 3 goals
8. Login as ahmed.lead@biat.com (TEAM_LEADER)
9. Go to /goal-approvals → See James's 3 goals
10. Approve 2 goals, request revision on 1 (add comment)
11. Login as james.dev@biat.com
12. See manager feedback on the revised goal
13. Edit the goal, resubmit
14. Login as ahmed.lead@biat.com → approve the resubmitted goal
15. ✅ All 3 goals now "approved"

### Phase Transition to Phase 2
16. Login as admin@biat.com
17. Go to /cycles → Advance to Phase 2
18. Verify: Cannot create new goals (button gone)

### Phase 2: Mid-Year Assessment
19. Login as james.dev@biat.com
20. Go to /midyear-assessments
21. Submit self-assessment for each goal (progress %, comments)
22. Login as ahmed.lead@biat.com
23. Submit manager mid-year assessment
24. Verify goals show "midyear_assessed"

### Phase Transition to Phase 3
25. Login as admin@biat.com → Advance to Phase 3
26. Verify: Cannot go back to Phase 2

### Phase 3: Final Evaluation
27. Login as james.dev@biat.com
28. Go to /final-evaluations → submit final self-assessment
29. Login as ahmed.lead@biat.com
30. Submit final evaluation for each goal
31. Create evaluation scoring for james.dev

### Close Cycle
32. Login as admin@biat.com → Advance to "closed"
33. Verify: All data frozen, no edits possible
34. ✅ COMPLETE CYCLE VERIFIED

---

## E2E-2: ERROR RECOVERY FLOW
1. Login as collaborator
2. Create a goal with weight=0 → expect error
3. Fix weight to 30 → save succeeds
4. Submit goal → cycle is in phase2 → expect error
5. Wait for admin to set phase1 → resubmit → succeeds
6. Manager rejects → revise → resubmit → approved

## E2E-3: UNAUTHORIZED ACCESS FLOW
1. Login as collaborator
2. Try to access /admin-dashboard → blocked
3. Try to access /audit-logs → blocked
4. Try to approve a goal via API → 403
5. Try to advance cycle phase via API → 403

---

# MODULE 22: HIGH-RISK AREAS (Test These FIRST)

Priority order for testing:

| Priority | Area | Why |
|----------|------|-----|
| 🔴 P0 | Cycle phase transitions | Core business logic, recently fixed |
| 🔴 P0 | Goal submit/approve/revise loop | Core workflow, guards just added |
| 🔴 P0 | markCompleted endpoint | Was crashing, just fixed |
| 🟡 P1 | Objective create/submit/validate | Phase enforcement just added |
| 🟡 P1 | Evaluation creation | Phase3 guard just added |
| 🟡 P1 | Backward phase regression | New guard, needs validation |
| 🟢 P2 | Dashboard loading | Previously fixed |
| 🟢 P2 | User/Team management | Previously fixed |
| 🟢 P2 | Notifications | Working but legacy format |

---

# MODULE 23: REGRESSION CHECKLIST

After each fix, re-test these:
- [ ] Login still works
- [ ] Dashboard loads for all roles
- [ ] Goal creation works in Phase 1
- [ ] Goal approval workflow works
- [ ] Phase advance works (forward only)
- [ ] Mid-year assessment works in Phase 2
- [ ] Final evaluation works in Phase 3
- [ ] No console errors in browser
- [ ] No crash errors in backend terminal
- [ ] Notifications appear after goal actions
