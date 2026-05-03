# FULL TESTING PLAYBOOK — PART 1
# Auth, Users, Teams, Cycles

## TEST ACCOUNTS
- ADMIN: admin@biat.com
- HR: hr@biat.com
- TEAM_LEADER: ahmed.lead@biat.com / sofia.lead@biat.com
- COLLABORATOR: james.dev@biat.com / emma.dev@biat.com
- Password: (use your seeded password, likely "password123" or "Password1!")

---

# MODULE 1: AUTHENTICATION

## TEST 1.1: Valid Login
- Objective: Verify successful authentication
- Preconditions: Backend + Frontend running
- Steps:
  1. Navigate to http://localhost:5173
  2. Enter admin@biat.com and valid password
  3. Click Login
- Expected: Redirect to /dashboard, user name visible in sidebar
- Watch for: Token stored in localStorage, no console errors

## TEST 1.2: Invalid Login — Wrong Password
- Objective: Verify error on bad credentials
- Steps:
  1. Go to /login
  2. Enter admin@biat.com, password: "wrongpassword"
  3. Click Login
- Expected: Error toast "Invalid credentials", stay on login page
- Watch for: No redirect, no token stored

## TEST 1.3: Invalid Login — Empty Fields
- Steps:
  1. Click Login with empty email and password
- Expected: Form validation prevents submission or shows error
- Watch for: HTML5 validation or custom error message

## TEST 1.4: Invalid Login — Non-existent Email
- Steps:
  1. Enter nonexistent@biat.com with any password
- Expected: Error message, no login

## TEST 1.5: Session Persistence
- Steps:
  1. Login successfully
  2. Close the browser tab
  3. Open a new tab to http://localhost:5173/dashboard
- Expected: Still logged in (token persists)

## TEST 1.6: Logout
- Steps:
  1. Login successfully
  2. Click logout button (usually in sidebar or settings)
- Expected: Redirected to /login, token removed

## TEST 1.7: Access Protected Route Without Login
- Steps:
  1. Clear localStorage
  2. Navigate directly to http://localhost:5173/dashboard
- Expected: Redirected to /login

---

# MODULE 2: USER MANAGEMENT

## TEST 2.1: View Users List (as ADMIN)
- Preconditions: Login as admin@biat.com
- Steps:
  1. Navigate to /users
- Expected: List of all 24 users displayed with name, email, role
- Watch for: No "users.map is not a function" error

## TEST 2.2: View Users List (as COLLABORATOR — should be blocked)
- Preconditions: Login as james.dev@biat.com
- Steps:
  1. Navigate to /users
- Expected: Access denied or page not visible in sidebar
- Watch for: No data leakage

## TEST 2.3: View Users List (as TEAM_LEADER)
- Steps:
  1. Login as ahmed.lead@biat.com
  2. Navigate to /users
- Expected: Either sees full list or only their team (depends on RBAC config)

---

# MODULE 3: TEAM MANAGEMENT

## TEST 3.1: View Teams (as ADMIN)
- Preconditions: Login as admin@biat.com
- Steps:
  1. Navigate to /teams
- Expected: List of teams with members displayed. No crash.

## TEST 3.2: Create a New Team
- Preconditions: Login as admin@biat.com
- Steps:
  1. Go to /teams
  2. Click "Create Team" or equivalent
  3. Enter team name: "QA Test Team"
  4. Select a leader: sofia.lead@biat.com
  5. Add members: lucas.qa@biat.com, mia.qa@biat.com
  6. Save
- Expected: Team created, appears in list
- Watch for: Form validation, duplicate team name handling

## TEST 3.3: Edit Team — Change Members
- Steps:
  1. Find an existing team
  2. Click edit
  3. Add or remove a member
  4. Save
- Expected: Team updated successfully

## TEST 3.4: Edit Team — Change Leader
- Steps:
  1. Edit a team
  2. Change the team leader to a different TEAM_LEADER user
  3. Save
- Expected: Leader updated, old leader loses access to team management for that team

## TEST 3.5: Create Team with No Members
- Steps:
  1. Create a team with only a leader, zero members
- Expected: Should either warn or allow (check business rules)

## TEST 3.6: Create Team as COLLABORATOR (unauthorized)
- Login as james.dev@biat.com, try to access /teams
- Expected: No create button visible, or access denied

---

# MODULE 4: CYCLE MANAGEMENT

## TEST 4.1: View Cycles (as ADMIN)
- Login as admin@biat.com
- Navigate to /cycles
- Expected: List of cycles with name, year, status, current phase

## TEST 4.2: Create a New Cycle
- Steps:
  1. Click "Create Cycle"
  2. Fill: Name="2026 Annual Review", Year=2026
  3. Fill date fields (phase1Start < phase1End < phase2Start < phase2End...)
  4. Save
- Expected: Cycle created with status "draft", currentPhase "phase1"

## TEST 4.3: Create Cycle — Invalid Dates (phase2Start before phase1End)
- Steps:
  1. Create cycle with overlapping/backwards dates
- Expected: Validation error, cycle NOT created

## TEST 4.4: Start a Draft Cycle (Activate to Phase 1)
- Preconditions: A draft cycle exists
- Steps:
  1. Click "Start" or "Advance Phase" on the draft cycle
- Expected: Status changes to "in_progress", currentPhase = "phase1"

## TEST 4.5: BLOCKED — Skip Phase (Draft → Phase 2)
- Steps:
  1. Try to manually set a draft cycle to phase2 (via UI or API)
- Expected: Error "Draft cycles must start at Phase 1"
- This tests our NEW backward-guard fix

## TEST 4.6: Advance Phase 1 → Phase 2
- Preconditions: Cycle is in phase1
- Steps:
  1. Click "Advance Phase"
- Expected: currentPhase changes to "phase2"

## TEST 4.7: BLOCKED — Go Backwards (Phase 2 → Phase 1)
- Steps:
  1. While in phase2, try to go back to phase1
- Expected: Error "Cannot go backwards"
- This tests our NEW backward-guard fix

## TEST 4.8: BLOCKED — Skip Phase (Phase 1 → Phase 3)
- Steps:
  1. While in phase1, try to jump to phase3
- Expected: Error "Cannot skip phases. Must advance from phase1 to phase2"

## TEST 4.9: Full Phase Progression
- Steps:
  1. Start from draft → phase1 → phase2 → phase3 → closed
  2. Each step should succeed
- Expected: Cycle ends in "closed" status

## TEST 4.10: BLOCKED — Modify Closed Cycle
- Steps:
  1. Try to change phase of a closed cycle
- Expected: Error "Cannot change phase of a closed cycle"

## TEST 4.11: Create Cycle as COLLABORATOR (unauthorized)
- Login as james.dev@biat.com
- Expected: No cycle management buttons visible

## TEST 4.12: Create Cycle as TEAM_LEADER (unauthorized)
- Login as ahmed.lead@biat.com
- Expected: Can view cycles but cannot create/advance them
