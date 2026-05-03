// AI Controller — Context-aware, randomized responses
// Each function uses template pools + random selection to generate different outputs every time

const aiService = require('../services/aiService');
const reviewContextService = require('../services/reviewContextService');
const Objective = require('../models/Objective');
const User = require('../models/User');
const { createAuditLog } = require('../utils/auditHelper');

const REVIEW_ROLES = ['ADMIN', 'HR', 'TEAM_LEADER'];

function getRequesterId(req) {
    return String(req.user?.id || req.user?._id || '');
}



function pickMultiple(arr, count) {
    var shuffled = arr.slice().sort(function () { return Math.random() - 0.5; });
    return shuffled.slice(0, Math.min(count, shuffled.length));
}

// ============ AI GOAL SUGGESTIONS ============
exports.generateGoalSuggestions = async (req, res) => {
    try {
        const requesterId = getRequesterId(req);
        const { role, context } = req.body;
        const userId = req.body.userId || requesterId;

        // Gather real employee data from DB
        const Evaluation = require('../models/Evaluation');

        // Get last completed objectives (max 5, lean)
        const completedObjectives = await Objective.find({
            owner: userId,
            status: { $in: ['evaluated', 'locked', 'approved'] },
        })
            .sort({ updatedAt: -1 })
            .limit(5)
            .select('title evaluationRating achievementPercent')
            .lean();

        // Get latest evaluation for strengths/weaknesses
        const latestEval = await Evaluation.findOne({ employeeId: userId })
            .sort({ createdAt: -1 })
            .select('strengths areasForImprovement overallComments')
            .lean();

        // Get user role from DB if not provided
        let userRole = role || req.user?.role || 'EMPLOYEE';
        if (userId !== requesterId) {
            const targetUser = await User.findById(userId).select('role').lean();
            if (targetUser) userRole = targetUser.role;
        }

        // Build compact input for AI (strict limit)
        const employeeData = {
            role: userRole,
            strengths: latestEval?.strengths || '',
            weaknesses: latestEval?.areasForImprovement || '',
            completedObjectives: completedObjectives.map(o => ({
                title: o.title,
                rating: o.evaluationRating || '',
                achievement: o.achievementPercent || 0,
            })),
        };

        // Add optional context
        if (context && context.trim()) {
            employeeData.context = context.trim().slice(0, 200);
        }

        // Try AI generation
        let suggestions = null;
        if (aiService.isConfigured()) {
            suggestions = await aiService.generateGoalSuggestions(employeeData);
        }

        // Fallback: rule-based from real data
        if (!suggestions) {
            suggestions = buildGoalSuggestionsFallback(employeeData);
        }

        res.json({ success: true, suggestions });
    } catch (err) {
        console.error('Goal suggestion error:', err.message);
        res.status(500).json({ message: 'Goal suggestion failed' });
    }
};

// Rule-based fallback using real employee data
function buildGoalSuggestionsFallback(employeeData) {
    const suggestions = [];
    const weaknesses = (employeeData.weaknesses || '').toLowerCase();
    const strengths = (employeeData.strengths || '').toLowerCase();
    const completedTitles = (employeeData.completedObjectives || []).map(o => o.title.toLowerCase());

    // Weakness-based improvement goals
    const weaknessGoals = [
        { keywords: ['communicat', 'collaborat', 'team'], title: 'Strengthen Cross-Team Communication', desc: 'Establish regular sync meetings and document collaboration outcomes to improve team alignment.', indicator: 'Complete weekly cross-team syncs for 3 months with documented action items.' },
        { keywords: ['time', 'deadline', 'punctual', 'delay'], title: 'Improve Deadline Adherence', desc: 'Implement structured project planning with milestone tracking to consistently meet deadlines.', indicator: 'Achieve 90%+ on-time delivery rate over the next quarter.' },
        { keywords: ['technical', 'skill', 'learn', 'knowledge'], title: 'Close Technical Skill Gap', desc: 'Complete targeted training and apply new skills to at least one active project.', indicator: 'Complete 2 certified training modules and deliver 1 project using the new skills within 60 days.' },
        { keywords: ['leadership', 'manag', 'mentor', 'delegat'], title: 'Develop Leadership Capabilities', desc: 'Lead a cross-functional initiative and mentor at least one junior team member.', indicator: 'Successfully lead 1 initiative and document mentoring outcomes within 90 days.' },
        { keywords: ['quality', 'accuracy', 'detail', 'error'], title: 'Raise Output Quality Standards', desc: 'Implement review checklists and self-audit processes to reduce errors in deliverables.', indicator: 'Reduce error rate by 30% as measured by QA feedback in the next review cycle.' },
        { keywords: ['initiat', 'proactiv', 'owner'], title: 'Increase Proactive Initiative', desc: 'Identify and propose solutions for at least 2 process improvements without being asked.', indicator: 'Submit 2 documented improvement proposals with measurable impact within 60 days.' },
    ];

    weaknessGoals.forEach(goal => {
        if (suggestions.length >= 3) return;
        const isRelevant = goal.keywords.some(k => weaknesses.includes(k));
        const isNotRepeat = !completedTitles.some(t => t.includes(goal.title.toLowerCase().slice(0, 20)));
        if (isRelevant && isNotRepeat) {
            suggestions.push({ title: goal.title, description: goal.desc, successIndicator: goal.indicator });
        }
    });

    // Strength-based growth goals
    const strengthGoals = [
        { keywords: ['communicat', 'present'], title: 'Lead Knowledge-Sharing Sessions', desc: 'Organize and deliver presentations to share expertise with broader teams.', indicator: 'Deliver 3 knowledge-sharing sessions with positive attendee feedback within the quarter.' },
        { keywords: ['technical', 'engineer', 'develop'], title: 'Architect a Key Technical Solution', desc: 'Design and implement a technical solution that addresses a critical business need.', indicator: 'Deliver 1 documented architecture with successful production deployment.' },
        { keywords: ['leadership', 'manag', 'team'], title: 'Scale Team Impact Through Delegation', desc: 'Develop team members by delegating high-impact tasks and coaching through execution.', indicator: 'Successfully delegate 3 significant tasks with documented outcomes within 90 days.' },
        { keywords: ['analytic', 'data', 'insight'], title: 'Build Data-Driven Decision Framework', desc: 'Create dashboards or reports that enable evidence-based decisions for the team.', indicator: 'Deliver 1 dashboard or report used in at least 2 strategic decisions within the quarter.' },
    ];

    strengthGoals.forEach(goal => {
        if (suggestions.length >= 3) return;
        const isRelevant = goal.keywords.some(k => strengths.includes(k));
        const isNotRepeat = !completedTitles.some(t => t.includes(goal.title.toLowerCase().slice(0, 20)));
        if (isRelevant && isNotRepeat) {
            suggestions.push({ title: goal.title, description: goal.desc, successIndicator: goal.indicator });
        }
    });

    // Fill remaining with generic goals
    const genericGoals = [
        { title: 'Improve Process Efficiency', description: 'Identify and eliminate 2 workflow bottlenecks to reduce cycle time.', successIndicator: 'Document 2 process improvements with measured time savings within 60 days.' },
        { title: 'Enhance Professional Skills', description: 'Complete a targeted training program aligned with career growth objectives.', successIndicator: 'Complete 1 certified course and apply learnings to a current project within 90 days.' },
        { title: 'Strengthen Stakeholder Relationships', description: 'Proactively engage key stakeholders to improve alignment and collaboration.', successIndicator: 'Establish regular check-ins with 3 stakeholders and track satisfaction improvement.' },
    ];

    let genericIndex = 0;
    while (suggestions.length < 2 && genericIndex < genericGoals.length) {
        const g = genericGoals[genericIndex];
        const isNotRepeat = !completedTitles.some(t => t.includes(g.title.toLowerCase().slice(0, 15)));
        if (isNotRepeat) suggestions.push(g);
        genericIndex++;
    }

    // Add fallback warning
    suggestions.forEach(s => { s._fallback = true; });
    return suggestions;
}

// ============ KPI SUGGESTIONS ============
exports.suggestKpis = async (req, res) => {
    try {
        const { goalTitle, goalDescription } = req.body;
        var combined = ((goalTitle || '') + ' ' + (goalDescription || '')).toLowerCase();

        var kpiPools = {
            revenue: [
                { title: 'Monthly Revenue Growth', metricType: 'currency', initialValue: 0, targetValue: pickRandom([25000, 50000, 75000, 100000]), unit: '$' },
                { title: 'New Deals Closed', metricType: 'number', initialValue: 0, targetValue: pickRandom([10, 20, 30, 50]), unit: 'deals' },
                { title: 'Average Deal Size', metricType: 'currency', initialValue: 0, targetValue: pickRandom([5000, 10000, 15000]), unit: '$' },
                { title: 'Pipeline Value', metricType: 'currency', initialValue: 0, targetValue: pickRandom([100000, 200000, 500000]), unit: '$' },
                { title: 'Win Rate', metricType: 'percent', initialValue: 0, targetValue: pickRandom([30, 40, 50, 60]), unit: '%' },
            ],
            performance: [
                { title: 'Average Response Time', metricType: 'number', initialValue: pickRandom([200, 300, 500]), targetValue: pickRandom([50, 80, 100]), unit: 'ms' },
                { title: 'System Uptime', metricType: 'percent', initialValue: 99, targetValue: pickRandom([99.5, 99.9, 99.95]), unit: '%' },
                { title: 'Error Rate Reduction', metricType: 'percent', initialValue: pickRandom([5, 8, 10]), targetValue: pickRandom([1, 2, 3]), unit: '%' },
                { title: 'Load Test Throughput', metricType: 'number', initialValue: 0, targetValue: pickRandom([1000, 2000, 5000]), unit: 'req/s' },
            ],
            engagement: [
                { title: 'Employee Satisfaction Score', metricType: 'number', initialValue: pickRandom([3, 3.5]), targetValue: pickRandom([4, 4.5, 5]), unit: '/5' },
                { title: 'Survey Response Rate', metricType: 'percent', initialValue: 0, targetValue: pickRandom([70, 80, 90]), unit: '%' },
                { title: 'Training Hours Completed', metricType: 'number', initialValue: 0, targetValue: pickRandom([20, 40, 60]), unit: 'hours' },
                { title: 'Retention Rate', metricType: 'percent', initialValue: 0, targetValue: pickRandom([85, 90, 95]), unit: '%' },
            ],
            general: [
                { title: 'Completion Rate', metricType: 'percent', initialValue: 0, targetValue: 100, unit: '%' },
                { title: 'Milestones Achieved', metricType: 'number', initialValue: 0, targetValue: pickRandom([3, 5, 8]), unit: 'milestones' },
                { title: 'Quality Score', metricType: 'number', initialValue: 0, targetValue: pickRandom([8, 9, 10]), unit: '/10' },
                { title: 'Stakeholder Approval', metricType: 'boolean', initialValue: 0, targetValue: 1, unit: '' },
                { title: 'On-Time Delivery', metricType: 'boolean', initialValue: 0, targetValue: 1, unit: '' },
                { title: 'Tasks Completed', metricType: 'number', initialValue: 0, targetValue: pickRandom([10, 15, 20, 25]), unit: 'tasks' },
                { title: 'Efficiency Improvement', metricType: 'percent', initialValue: 0, targetValue: pickRandom([10, 15, 20, 25]), unit: '%' },
            ]
        };

        // Match category
        var pool = kpiPools.general;
        if (combined.includes('revenue') || combined.includes('sales') || combined.includes('deal') || combined.includes('client')) {
            pool = kpiPools.revenue;
        } else if (combined.includes('latency') || combined.includes('performance') || combined.includes('speed') || combined.includes('uptime')) {
            pool = kpiPools.performance;
        } else if (combined.includes('engag') || combined.includes('satisf') || combined.includes('retent') || combined.includes('training') || combined.includes('employee')) {
            pool = kpiPools.engagement;
        }

        var kpis = pickMultiple(pool, pickRandom([2, 3]));

        res.json({ kpis });
    } catch (err) {
        res.status(500).json({ message: 'KPI suggestion failed' });
    }
};

// ============ PERFORMANCE SUMMARY ============
exports.summarizePerformance = async (req, res) => {
    try {
        const { objectives, reviews, feedbacks, userName } = req.body;
        var objCount = objectives?.length || 0;
        var name = userName || 'The employee';

        var openings = [
            `Based on the analysis of ${objCount} active objectives, ${name} demonstrates`,
            `Reviewing ${objCount} goals and recent performance data, ${name} shows`,
            `A comprehensive review of ${objCount} objectives reveals that ${name} exhibits`,
            `Performance data across ${objCount} goals indicates ${name} has`,
        ];

        var strengths = [
            'consistent progress toward strategic milestones',
            'strong execution capability on high-priority objectives',
            'effective time management and deadline adherence',
            'a proactive approach to problem-solving and goal achievement',
            'excellent collaboration with cross-functional stakeholders',
            'notable improvement in quantitative KPI metrics',
        ];

        var improvements = [
            'There is opportunity to improve documentation of progress updates.',
            'More frequent KPI tracking could help identify potential roadblocks earlier.',
            'Expanding visibility of achievements to broader stakeholders is recommended.',
            'Consider breaking larger goals into smaller, more measurable sub-objectives.',
            'Strengthening alignment between individual and team objectives would enhance impact.',
            'More proactive risk communication would benefit overall team coordination.',
        ];

        var closings = [
            'Overall, the trajectory is positive and aligned with organizational priorities.',
            'With continued focus, the current performance level is on track to exceed targets.',
            'The balanced approach across objectives demonstrates strong professional maturity.',
            'Sustained momentum in the current direction will yield significant results by quarter end.',
        ];

        // Build contextual insights from actual data
        var contextParts = [];
        if (objectives && objectives.length > 0) {
            // Completed if achievementPercent >= 100
            var completed = objectives.filter(function (o) { return o.achievementPercent >= 100; }).length;
            // At risk if overdue or progressing slowly
            var atRisk = objectives.filter(function (o) { 
                if (!o.deadline) return false;
                return new Date(o.deadline) < new Date() && o.achievementPercent < 100;
            }).length;
            var avgProgress = objectives.reduce(function (sum, o) { return sum + (o.achievementPercent || 0); }, 0) / objectives.length;

            if (completed > 0) contextParts.push(completed + ' out of ' + objCount + ' objectives have been achieved.');
            if (atRisk > 0) contextParts.push(atRisk + ' objective(s) are flagged as at-risk and need attention.');
            if (avgProgress > 0) contextParts.push('Average progress across all goals is ' + Math.round(avgProgress) + '%.');
        }

        var summary = pickRandom(openings) + ' ' + pickRandom(strengths) + '. ' +
            (contextParts.length > 0 ? contextParts.join(' ') + ' ' : '') +
            pickRandom(improvements) + ' ' + pickRandom(closings);

        res.json({ summary });
    } catch (err) {
        res.status(500).json({ message: 'AI summarization failed' });
    }
};

// ============ AI RISK DETECTION ============
exports.detectRisks = async (req, res) => {
    try {
        const { objectives } = req.body;
        const risks = [];

        if (objectives && Array.isArray(objectives)) {
            objectives.forEach(obj => {
                // Overdue check
                if (obj.deadline && new Date(obj.deadline) < new Date() && (obj.achievementPercent || 0) < 100) {
                    risks.push({
                        objectiveId: obj._id,
                        title: obj.title,
                        risk: 'overdue',
                        severity: 'high',
                        message: `"${obj.title}" is past its deadline with only ${obj.achievementPercent || 0}% progress.`
                    });
                }

                // Low progress check
                if (obj.deadline) {
                    const total = new Date(obj.deadline) - new Date(obj.startDate || obj.createdAt);
                    const elapsed = new Date() - new Date(obj.startDate || obj.createdAt);
                    const timePercent = Math.min(100, (elapsed / total) * 100);
                    const progress = obj.achievementPercent || 0;
                    if (timePercent > 50 && progress < timePercent * 0.4) {
                        risks.push({
                            objectiveId: obj._id,
                            title: obj.title,
                            risk: 'low_progress',
                            severity: 'medium',
                            message: `"${obj.title}" is at ${progress}% progress but ${timePercent.toFixed(0)}% of time has elapsed.`
                        });
                    }
                }

                // Unrealistic weight
                if (obj.weight > 40) {
                    risks.push({
                        objectiveId: obj._id,
                        title: obj.title,
                        risk: 'high_weight',
                        severity: 'low',
                        message: `"${obj.title}" has ${obj.weight}% weight. Consider distributing weight more evenly.`
                    });
                }

                // No KPIs defined
                if (!obj.kpis || obj.kpis.length === 0) {
                    risks.push({
                        objectiveId: obj._id,
                        title: obj.title,
                        risk: 'no_kpis',
                        severity: 'medium',
                        message: `"${obj.title}" has no KPIs defined. Add key results to track measurable progress.`
                    });
                }
            });
        }

        res.json({ risks, totalRisks: risks.length });
    } catch (err) {
        res.status(500).json({ message: 'Risk detection failed' });
    }
};

// ============ NOTIFICATION PRIORITIZATION ============
exports.prioritizeNotifications = async (req, res) => {
    try {
        const { notifications } = req.body;
        if (!notifications || !Array.isArray(notifications)) {
            return res.json({ prioritized: [] });
        }

        const prioritized = notifications.map(n => {
            let priority = 'normal';
            const titleLower = (n.title || '').toLowerCase();
            const msgLower = (n.message || '').toLowerCase();

            if (titleLower.includes('overdue') || titleLower.includes('rejected') || msgLower.includes('overdue')) {
                priority = 'high';
            } else if (titleLower.includes('submitted') || titleLower.includes('approved') || titleLower.includes('completed')) {
                priority = 'medium';
            } else if (titleLower.includes('comment') || titleLower.includes('update')) {
                priority = 'low';
            }

            return Object.assign({}, n, { aiPriority: priority });
        });

        const order = { high: 0, medium: 1, normal: 2, low: 3 };
        prioritized.sort((a, b) => order[a.aiPriority] - order[b.aiPriority]);

        res.json({ prioritized });
    } catch (err) {
        res.status(500).json({ message: 'Notification prioritization failed' });
    }
};

async function runReviewFlow(req, res, mode) {
    try {
        const requesterId = getRequesterId(req);
        const { employeeId, cycleId, objectiveId } = req.body;

        if (!employeeId || !cycleId) {
            return res.status(400).json({ message: 'employeeId and cycleId are required' });
        }

        if (mode === 'manager_review') {
            if (!REVIEW_ROLES.includes(req.user.role)) {
                return res.status(403).json({ message: 'Forbidden: insufficient permissions for manager review' });
            }
            if (!objectiveId) {
                return res.status(400).json({ message: 'objectiveId is required for manager review drafts' });
            }
            const objective = await Objective.findById(objectiveId).populate('owner', 'manager');
            if (!objective) {
                return res.status(404).json({ message: 'Objective not found' });
            }
            const ownerId = String(objective.owner?._id || objective.owner || '');
            if (ownerId !== String(employeeId)) {
                return res.status(400).json({ message: 'Objective does not belong to the requested employee' });
            }
            if (!['ADMIN', 'HR'].includes(req.user.role)) {
                const managerId = String(objective.owner?.manager || '');
                if (managerId !== requesterId) {
                    return res.status(403).json({ message: 'Forbidden: not authorized to review this employee' });
                }
            }
        }

        if (mode === 'final_self_assessment' && String(employeeId) !== requesterId && !['ADMIN', 'HR'].includes(req.user.role)) {
            const targetEmployee = await User.findById(employeeId).select('manager').lean();
            if (!targetEmployee) {
                return res.status(404).json({ message: 'Employee not found' });
            }
            if (String(targetEmployee.manager || '') !== requesterId) {
                return res.status(403).json({ message: 'Forbidden: insufficient permissions for self-assessment draft' });
            }
        }

        const context = await reviewContextService.buildReviewContext({
            employeeId,
            cycleId,
            objectiveId: objectiveId || null,
        });

        let result;
        switch (mode) {
            case 'midyear_summary':
                if (!REVIEW_ROLES.includes(req.user.role)) {
                    return res.status(403).json({ message: 'Forbidden: insufficient permissions for midyear review' });
                }
                result = await aiService.generateMidyearReview(context);
                break;
            case 'final_self_assessment':
                if (requesterId !== String(employeeId) && !REVIEW_ROLES.includes(req.user.role)) {
                    return res.status(403).json({ message: 'Forbidden: only the employee or HR/Admin can request final self assessment' });
                }
                result = await aiService.generateFinalSelfReview(context);
                break;
            case 'manager_review':
                if (!REVIEW_ROLES.includes(req.user.role)) {
                    return res.status(403).json({ message: 'Forbidden: insufficient permissions for manager review' });
                }
                result = await aiService.generateManagerReview(context);
                break;
            default:
                return res.status(400).json({ message: 'Invalid review mode' });
        }

        createAuditLog({
            entityType: 'ai_review',
            entityId: employeeId,
            action: `ai_review_${mode}`,
            performedBy: requesterId,
            userName: req.user?.name || '',
            userRole: req.user?.role || '',
            description: `AI ${mode === 'final_self_assessment' ? 'final self-assessment' : mode === 'manager_review' ? 'manager review' : 'mid-year summary'} generated for employee ${employeeId} in cycle ${cycleId}${objectiveId ? ` objective ${objectiveId}` : ''}`,
            newValue: { mode, employeeId, cycleId, objectiveId },
            ipAddress: req.ip,
        });

        res.json({ success: true, review: result });
    } catch (err) {
        console.error('AI review flow error:', err);
        res.status(500).json({ message: 'AI review generation failed', details: err.message });
    }
}

exports.generateMidyearReview = async (req, res) => runReviewFlow(req, res, 'midyear_summary');
exports.generateFinalSelfReview = async (req, res) => runReviewFlow(req, res, 'final_self_assessment');
exports.generateManagerReview = async (req, res) => runReviewFlow(req, res, 'manager_review');

// ============ UNIFIED AI ASSIST ENDPOINT ============
exports.assist = async (req, res) => {
    try {
        const { action, context, prompt } = req.body;

        var actions = {
            'summarize-feedback': function () {
                var feedbacks = context?.feedbacks || [];
                var count = feedbacks.length;
                var types = {};
                feedbacks.forEach(function (f) { types[f.type] = (types[f.type] || 0) + 1; });
                var typeStr = Object.entries(types).map(function (e) { return e[1] + ' ' + e[0]; }).join(', ');

                var templates = [
                    `Analysis of ${count} feedback items (${typeStr || 'various types'}) reveals a pattern of ${pickRandom(['constructive engagement', 'proactive communication', 'collaborative spirit', 'action-oriented discussion'])}. ${pickRandom(['Key themes include team collaboration and goal alignment.', 'Notable focus areas are skill development and performance improvement.', 'Recurring themes highlight communication effectiveness and initiative.'])}`,
                    `Across ${count} feedback entries, the predominant sentiment is ${pickRandom(['positive and growth-oriented', 'constructive with actionable suggestions', 'supportive with clear improvement areas'])}. ${pickRandom(['The feedback demonstrates a healthy culture of continuous improvement.', 'There is a strong foundation of trust enabling honest feedback exchange.'])}`,
                ];
                return pickRandom(templates);
            },
            'write-update': function () {
                var goalTitle = context?.goalTitle || 'the objective';
                var progress = context?.progress || 0;
                var templates = [
                    `Made significant progress on "${goalTitle}" — currently at ${progress}%. ${pickRandom(['Key milestones were achieved ahead of schedule.', 'No blockers identified; on track to meet the deadline.', 'Completed initial phase and moving to implementation.', 'Collaborated with stakeholders to align on next steps.'])}`,
                    `Update on "${goalTitle}" (${progress}% complete): ${pickRandom(['Implemented core deliverables and began validation testing.', 'Resolved pending dependencies and accelerated the timeline.', 'Received positive feedback from early reviewers; iterating on improvements.', 'Identified optimization opportunities that could improve outcomes by 15%.'])}`,
                    `Progress report for "${goalTitle}": ${pickRandom(['Successfully completed the current sprint objectives.', 'Team coordination resulted in faster-than-expected progress.', 'Initial metrics indicate strong alignment with KPI targets.'])} Current completion: ${progress}%.`,
                ];
                return pickRandom(templates);
            },
            'review-prep': function () {
                var objectives = context?.objectives || [];
                var count = objectives.length;
                var completed = objectives.filter(function (o) { return (o.achievementPercent || 0) >= 100; }).length;
                var avgProgress = count > 0 ? Math.round(objectives.reduce(function (s, o) { return s + (o.achievementPercent || 0); }, 0) / count) : 0;

                return `Review preparation summary: ${count} objectives tracked with ${completed} completed and ${avgProgress}% average progress. ${pickRandom([
                    'Recommended discussion points: KPI tracking methodology, resource allocation, and timeline adjustments.',
                    'Key talking points: progress velocity, blockers encountered, and upcoming milestone targets.',
                    'Suggested focus areas: achievement recognition, improvement opportunities, and career development alignment.',
                    'Discussion preparation: highlight top achievements, address at-risk items, and set priorities for next period.',
                ])}`;
            }
        };

        if (action && actions[action]) {
            return res.json({ result: actions[action]() });
        }

        // --- Free-text primitive chatbot logic ---
        if (prompt) {
            const lowerPrompt = prompt.toLowerCase();
            
            if (lowerPrompt.includes('goal') || lowerPrompt.includes('smart')) {
                return res.json({ result: "Here is a SMART goal suggestion: 'Increase unit test coverage from 65% to 85% by Q3 to reduce production bugs by 15%, measured via SonarQube.' Make sure your goals are Specific, Measurable, Achievable, Relevant, and Time-bound!" });
            }
            if (lowerPrompt.includes('kpi') || lowerPrompt.includes('metric')) {
                return res.json({ result: "When designing KPIs, look for leading indicators. Instead of just 'Revenue' (lagging), try tracking 'Qualified Meetings Booked' (leading). Can I suggest specific metrics for your department?" });
            }
            if (lowerPrompt.includes('update') || lowerPrompt.includes('progress')) {
                return res.json({ result: "To write a great progress update, use the 'What, So What, Now What' framework. 1. What did you do? 2. Why does it matter? 3. What are you doing next week?" });
            }
            if (lowerPrompt.includes('hello') || lowerPrompt.includes('hi')) {
                return res.json({ result: "Hello! I am your AI Performance Assistant. I can help you draft SMART goals, brainstorm KPIs, or formulate progress updates. What would you like to work on?" });
            }
            
            const generalResponses = [
                "That's an interesting perspective. Consider breaking that down into smaller, measurable milestones so you can track it in your next Annual Cycle phase.",
                "I recommend aligning that with your Phase 1 goals. Have you checked if it fits within your 100% capacity limit?",
                "This sounds like a great topic for your next 1-on-1 meeting. I can help you structure an agenda if you'd like.",
                "Great question! I'm a lightweight local assistant right now. To help you best, ask me to 'Suggest a goal', 'Improve my KPIs', or 'Write an update'."
            ];
            
            return res.json({ result: pickRandom(generalResponses) });
        }

        return res.json({ result: 'Use specific actions or provide a prompt.' });
    } catch (err) {
        res.status(500).json({ message: 'AI assist failed' });
    }
};

function pickRandom(arr) {
    if (!arr || !arr.length) return '';
    return arr[Math.floor(Math.random() * arr.length)];
}

exports.draftCheckin = async (req, res) => {
    try {
        const { goalTitle, oldKpis, newKpis, newStatus } = req.body;

        let changes = [];
        let positive = true;

        if (oldKpis && newKpis) {
            newKpis.forEach(newK => {
                const oldK = oldKpis.find(k => String(k._id) === String(newK._id));
                if (oldK && newK.currentValue !== undefined && oldK.currentValue != newK.currentValue) {
                    const diff = parseFloat(newK.currentValue) - parseFloat(oldK.currentValue);
                    if (diff < 0 && newK.metricType !== 'number') positive = false;
                    const diffText = diff > 0 ? `increased by ${diff}` : `decreased by ${Math.abs(diff)}`;
                    changes.push(`'${newK.title || 'KPI'}' ${diffText} (now ${newK.currentValue})`);
                }
            });
        }

        const templates = positive ? [
            "We've made solid progress this period. ",
            "Continuing on a positive trajectory. ",
            "Great momentum on this goal. "
        ] : [
            "Facing some headwinds this period. ",
            "Progress has stalled slightly. ",
            "We've encountered some challenges. "
        ];

        let draft = pickRandom(templates);
        if (changes.length > 0) {
            draft += "Specifically, " + changes.join(' and ') + ". ";
        } else {
            draft += "General updates and alignments have been made without direct metric changes. ";
        }

        if (newStatus && newStatus !== 'no_status') {
            draft += `The overall objective status is currently marked as ${newStatus.replace('_', ' ')}.`;
        }

        res.json({ success: true, draft });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ============ OBJECTIVE QUALITY ANALYSIS (SMART Detection) ============
exports.analyzeObjectiveQuality = async (req, res) => {
    try {
        const { title, description, successIndicator } = req.body;
        const combined = ((title || '') + ' ' + (description || '') + ' ' + (successIndicator || '')).toLowerCase();
        
        const issues = [];
        const strengths = [];
        
        // Check for vague language
        const vagueWords = ['improve', 'better', 'good', 'enhance', 'explore', 'consider', 'investigate', 'think about', 'maybe'];
        const vagueCount = vagueWords.filter(word => combined.includes(word)).length;
        if (vagueCount >= 2) {
            issues.push({
                type: 'vague_language',
                severity: 'medium',
                message: 'Objective uses vague language. Add specific metrics or numbers (e.g., "Increase by 25%", "Reduce to 80ms").',
                examples: vagueWords.filter(w => combined.includes(w))
            });
        }
        
        // Check for measurability (SMART: Measurable)
        const measurableIndicators = ['%', '$', '#', 'achieve', 'reach', 'reduce', 'increase', 'complete', 'deliver'];
        const hasMeasurable = measurableIndicators.some(ind => combined.includes(ind));
        if (!hasMeasurable && !successIndicator) {
            issues.push({
                type: 'not_measurable',
                severity: 'high',
                message: 'Success Indicator is missing or vague. Define how you will measure success (e.g., "Achieve 90% accuracy by Q3").'
            });
        } else if (hasMeasurable) {
            strengths.push('Contains measurable metrics');
        }
        
        // Check for timeframe (SMART: Time-bound)
        const timeFrames = ['q1', 'q2', 'q3', 'q4', 'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december', 'week', 'month', 'quarter', 'end of', 'by'];
        const hasTimeFrame = timeFrames.some(tf => combined.includes(tf));
        if (!hasTimeFrame) {
            issues.push({
                type: 'no_deadline',
                severity: 'medium',
                message: 'No clear timeframe specified. Add when this objective must be achieved (e.g., "by end of Q2").'
            });
        } else {
            strengths.push('Contains clear deadline or timeframe');
        }
        
        // Check for actionability (SMART: Specific)
        const actionVerbs = ['implement', 'deliver', 'build', 'design', 'develop', 'launch', 'achieve', 'reduce', 'increase', 'optimize', 'establish', 'create'];
        const hasAction = actionVerbs.some(verb => combined.includes(verb));
        if (!hasAction) {
            issues.push({
                type: 'not_specific',
                severity: 'medium',
                message: 'Use action verbs to clarify what will be done. Examples: Implement, Deliver, Build, Launch, Achieve.'
            });
        } else {
            strengths.push('Contains clear action verb');
        }
        
        // Check for realistic scope
        if (title && title.length < 10) {
            issues.push({
                type: 'title_too_short',
                severity: 'low',
                message: 'Objective title is quite short. Expand it to be more descriptive (at least 10 characters).'
            });
        } else if (title && title.length > 100) {
            issues.push({
                type: 'title_too_long',
                severity: 'low',
                message: 'Objective title is very long (>100 chars). Consider shortening for clarity.'
            });
        }
        
        const overallQuality = issues.filter(i => i.severity === 'high').length === 0 ? 'good' : 'needs_improvement';
        
        res.json({
            success: true,
            quality: overallQuality,
            issues,
            strengths,
            smartScore: {
                specific: issues.some(i => i.type === 'not_specific') ? false : true,
                measurable: issues.some(i => i.type === 'not_measurable') ? false : true,
                achievable: true, // Generally assume achievable unless title suggests otherwise
                relevant: true,   // Assume relevant in business context
                timeBound: issues.some(i => i.type === 'no_deadline') ? false : true
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ============ OBJECTIVE REFINEMENT SUGGESTIONS ============
exports.refineObjective = async (req, res) => {
    try {
        const { title, description, successIndicator, context } = req.body;
        const combined = ((title || '') + ' ' + (description || '')).toLowerCase();
        
        const suggestions = [];
        
        // Suggest more specific metrics
        if (!combined.match(/\b(\d+%|[$€£]\d+|#\d+|\d+\s*(hours|days|weeks|months))\b/)) {
            suggestions.push({
                type: 'add_metrics',
                suggestion: 'Add specific targets. For example: "Increase from 70% to 85%" or "Reduce from 50ms to 30ms".',
                example: 'Improve system performance to 30ms response time by Q3 2026'
            });
        }
        
        // Suggest timeframe
        if (!combined.match(/\b(q[1-4]|january|february|march|april|may|june|july|august|september|october|november|december|\d{4}|end of|by)\b/i)) {
            suggestions.push({
                type: 'add_deadline',
                suggestion: 'Specify when this must be achieved. Use quarter format (Q1-Q4) or specific dates.',
                example: 'Achieve 90% customer satisfaction by end of Q3 2026'
            });
        }
        
        // Suggest alignment with team goals
        if (context && context.departmentGoals) {
            suggestions.push({
                type: 'align_department',
                suggestion: 'Ensure alignment with your department\'s strategic priorities.',
                example: 'Map this objective to 1-2 department-level goals for better impact visibility'
            });
        }
        
        // Suggest adding KPI strategy
        if (!description || description.length < 50) {
            suggestions.push({
                type: 'add_kpi_plan',
                suggestion: 'Consider how you\'ll track progress. What leading and lagging indicators matter?',
                example: 'Weekly dashboard updates, bi-weekly stakeholder reviews, monthly milestone checks'
            });
        }
        
        // Template-based refinement suggestions
        const refinedSuggestions = [
            {
                template: 'Increase [metric] from [current] to [target] by [deadline] through [actions]',
                example: 'Increase customer satisfaction from 75% to 90% by Q3 through bi-weekly feedback loops and faster issue resolution'
            },
            {
                template: 'Deliver [deliverable] with [quality standard] by [deadline] for [stakeholder] to achieve [business outcome]',
                example: 'Deliver 3 new features with 95% test coverage by Q2 for Product team to improve NPS by 10 points'
            },
            {
                template: 'Reduce [metric] from [current] to [target] by [deadline] by implementing [approach]',
                example: 'Reduce average bug resolution time from 4 days to 2 days by Q2 by implementing automated testing'
            }
        ];
        
        res.json({
            success: true,
            suggestions,
            refinementTemplates: refinedSuggestions,
            recommendedFormat: 'Use the format: [Action Verb] [Object] [Target] by [Deadline] through [Method]'
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};


exports.generateDevelopmentPlan = async (req, res) => {
    try {
        const { userId, evaluationId } = req.body;

        if (!userId) {
            return res.status(400).json({ success: false, message: 'userId is required' });
        }

        const Evaluation = require('../models/Evaluation');

        let evaluation = null;
        if (evaluationId) {
            evaluation = await Evaluation.findOne({ _id: evaluationId, employeeId: userId }).lean();
        } else {
            evaluation = await Evaluation.findOne({ employeeId: userId }).sort({ createdAt: -1 }).lean();
        }

        const objectives = await Objective.find({ owner: userId })
            .sort({ createdAt: -1 })
            .limit(5)
            .select('title status achievementPercent weight evaluationRating evaluationComment managerComments')
            .lean();

        // If no Evaluation doc AND no evaluated objectives → nothing to work with
        if (!evaluation && (!objectives || objectives.length === 0)) {
            return res.status(404).json({ success: false, message: 'No evaluation data found for this user. Complete at least one objective evaluation first.' });
        }

        // Build compact structured data for AI — works with or without an Evaluation doc
        const dataContext = {
            score: evaluation?.finalScore != null ? evaluation.finalScore : (evaluation?.suggestedScore ?? null),
            period: evaluation?.period || '',
            feedback: evaluation?.overallComments || '',
            strengths: evaluation?.strengths || '',
            improvements: evaluation?.areasForImprovement || '',
            recommendations: evaluation?.developmentRecommendations || '',
            nextSteps: evaluation?.nextSteps || '',
            objectives: objectives.map(o => ({
                title: o.title,
                status: o.status,
                achievement: o.achievementPercent || 0,
                rating: o.evaluationRating || '',
                managerNote: o.managerComments || o.evaluationComment || '',
            })),
        };

        const competencies = [];

        // Try AI generation if configured
        if (aiService.isConfigured()) {
            const aiPlan = await aiService.generateDevelopmentPlan(dataContext);
            if (aiPlan) {
                return res.json({ success: true, plan: aiPlan });
            }
        }

        // Fallback: structured non-AI summary
        return res.json({ success: true, plan: buildDevelopmentPlanFallback(userId, evaluation || {}, competencies, objectives) });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

function buildDevelopmentPlanFallback(userId, evaluation, competencies, goals) {
    const score = evaluation.finalScore != null ? evaluation.finalScore : evaluation.suggestedScore;
    const normalizedGoals = Array.isArray(goals) ? goals : [];
    const normalizedCompetencies = Array.isArray(competencies) ? competencies : [];
    const lowProgressGoals = normalizedGoals.filter(function (goal) {
        return Number(goal.currentProgress || 0) < 60;
    });
    const onTrackGoals = normalizedGoals.filter(function (goal) {
        return Number(goal.currentProgress || 0) >= 60;
    });
    const lowCompetencies = normalizedCompetencies.filter(function (competency) {
        return Number(competency.maxScore || 0) > 0 && ((Number(competency.score || 0) / Number(competency.maxScore || 1)) * 100) < 60;
    });

    const strengths = [];
    const gapAreas = [];
    const actions = [];

    if (evaluation.strengths) {
        strengths.push(evaluation.strengths);
    }
    if (onTrackGoals.length > 0) {
        strengths.push('Recent goals show stronger execution on ' + onTrackGoals.map(function (goal) { return goal.title; }).join(', ') + '.');
    }
    if (score != null && score >= 7) {
        strengths.push('Your evaluation score of ' + score + ' reflects a solid overall performance level.');
    }
    if (strengths.length === 0) {
        strengths.push('Your evaluation has been completed for ' + (evaluation.period || 'the latest review period') + '.');
        strengths.push('The available review data provides a foundation for targeted development actions.');
    }

    if (evaluation.areasForImprovement) {
        gapAreas.push(evaluation.areasForImprovement);
    }
    lowCompetencies.forEach(function (competency) {
        gapAreas.push(competency.name + ' is below the target range at ' + competency.score + '/' + competency.maxScore + '.');
    });
    lowProgressGoals.forEach(function (goal) {
        gapAreas.push(goal.title + ' is currently at ' + (goal.currentProgress || 0) + '% progress.');
    });
    if (score != null && score < 7) {
        gapAreas.push('The evaluation score of ' + score + ' suggests room to strengthen consistency and delivery quality.');
    }
    if (gapAreas.length === 0) {
        gapAreas.push('Translate evaluation feedback into clearer next-step priorities.');
        gapAreas.push('Build a more measurable follow-through plan for the next review period.');
    }

    if (evaluation.areasForImprovement) {
        actions.push({
            action_title: 'Address feedback themes',
            description: 'Break the manager feedback into 2 or 3 specific behaviors to improve and review progress weekly.',
            rationale: 'The evaluation highlights this improvement area: "' + evaluation.areasForImprovement + '".',
            suggested_timeline: 'Next 30 days',
            success_metric: 'Document 2-3 improvement commitments and complete weekly check-ins against them.'
        });
    }

    if (evaluation.developmentRecommendations) {
        actions.push({
            action_title: 'Apply review recommendations',
            description: 'Convert the development recommendations into practical actions, learning steps, or coaching conversations tied to your role.',
            rationale: 'The evaluation includes this recommendation: "' + evaluation.developmentRecommendations + '".',
            suggested_timeline: 'Within 2 weeks',
            success_metric: 'Create and begin executing a written action list based on the evaluation recommendations.'
        });
    }

    lowProgressGoals.forEach(function (goal) {
        if (actions.length < 5) {
            actions.push({
                action_title: 'Recover goal momentum',
                description: 'Create a short recovery plan for "' + goal.title + '" with a clear next milestone, blocker review, and checkpoint date.',
                rationale: '"' + goal.title + '" is currently at ' + (goal.currentProgress || 0) + '% progress with status "' + (goal.status || 'unknown') + '".',
                suggested_timeline: 'Next 14 days',
                success_metric: 'Increase progress on "' + goal.title + '" beyond the current ' + (goal.currentProgress || 0) + '% baseline.'
            });
        }
    });

    lowCompetencies.forEach(function (competency) {
        if (actions.length < 5) {
            actions.push({
                action_title: 'Strengthen core skill',
                description: 'Focus practice, coaching, or targeted learning on ' + competency.name + ' and apply it in current work within the next review window.',
                rationale: competency.name + ' is measured at ' + competency.score + '/' + competency.maxScore + ', which is below the 60% threshold.',
                suggested_timeline: 'Next 30 days',
                success_metric: 'Demonstrate improvement in a follow-up review or through manager-observed application of the skill.'
            });
        }
    });

    if (score != null && score < 7 && actions.length < 5) {
        actions.push({
            action_title: 'Raise performance consistency',
            description: 'Set a weekly operating rhythm to review priorities, track commitments, and close gaps before the next evaluation cycle.',
            rationale: 'The evaluation score is ' + score + ', indicating an opportunity to improve overall consistency.',
            suggested_timeline: 'Next 30 days',
            success_metric: 'Maintain a weekly review cadence and show measurable improvement in delivery or feedback quality.'
        });
    }

    if (evaluation.nextSteps && actions.length < 5) {
        actions.push({
            action_title: 'Execute next steps',
            description: 'Translate the recorded next steps into a dated checklist and share progress updates with your manager.',
            rationale: 'The evaluation already lists next steps: "' + evaluation.nextSteps + '".',
            suggested_timeline: 'This month',
            success_metric: 'Complete the agreed next steps and provide at least one documented progress update.'
        });
    }

    while (actions.length < 3) {
        actions.push({
            action_title: 'Track development weekly',
            description: 'Set one weekly checkpoint to review feedback themes, current priorities, and concrete progress on your development focus areas.',
            rationale: 'The available evaluation data is limited, so consistent follow-through is the clearest way to turn feedback into improvement.',
            suggested_timeline: 'Weekly for 30 days',
            success_metric: 'Complete four consecutive weekly check-ins with written progress notes.'
        });
    }

    return {
        summary: buildDevelopmentPlanSummary(evaluation, normalizedGoals, lowCompetencies, score),
        strengths: strengths.slice(0, 2),
        gap_areas: gapAreas.slice(0, 3),
        recommended_actions: actions.slice(0, 5).map(function (action) {
            return {
                action_title: action.action_title || 'Untitled',
                description: action.description || '',
                rationale: action.rationale || '',
                suggested_timeline: action.suggested_timeline || 'TBD',
                success_metric: action.success_metric || ''
            };
        })
    };
}

function buildDevelopmentPlanSummary(evaluation, goals, lowCompetencies, score) {
    const parts = [];

    if (score != null) {
        parts.push('This employee received an evaluation score of ' + score + ' for ' + (evaluation.period || 'the latest review period') + '.');
    } else {
        parts.push('This development plan is based on the latest available evaluation record for ' + (evaluation.period || 'the current review period') + '.');
    }

    if (evaluation.overallComments) {
        parts.push('Manager feedback notes: "' + evaluation.overallComments + '".');
    }

    if (goals.length > 0) {
        const avgProgress = Math.round(goals.reduce(function (sum, goal) {
            return sum + Number(goal.currentProgress || 0);
        }, 0) / goals.length);
        parts.push('Across the recent goals reviewed, average progress is ' + avgProgress + '%.');
    } else if (lowCompetencies.length > 0) {
        parts.push('The plan prioritizes the lowest-rated competency areas identified in the available data.');
    } else {
        parts.push('Because the available record is limited, the plan focuses on turning the evaluation feedback into specific and measurable next steps.');
    }

    return parts.join(' ');
}
