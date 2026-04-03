// AI Controller — Context-aware, randomized responses
// Each function uses template pools + random selection to generate different outputs every time

function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function pickMultiple(arr, count) {
    var shuffled = arr.slice().sort(function () { return Math.random() - 0.5; });
    return shuffled.slice(0, Math.min(count, shuffled.length));
}

// ============ GOAL GENERATION ============
exports.generateGoal = async (req, res) => {
    try {
        const { role, department, context } = req.body;
        const dept = (department || 'General').toLowerCase();
        const ctx = (context || '').toLowerCase();

        const goalTemplates = {
            sales: [
                { title: 'Increase Quarterly Revenue by {pct}%', desc: 'Drive revenue growth through expanded outreach and improved conversion rates targeting {segment} clients.' },
                { title: 'Expand Client Base by {num} Accounts', desc: 'Develop and execute a targeted acquisition strategy to bring in {num} new enterprise accounts this quarter.' },
                { title: 'Improve Sales Conversion Rate to {pct}%', desc: 'Optimize the sales funnel by refining lead qualification, follow-up cadences, and proposal quality.' },
                { title: 'Reduce Average Sales Cycle by {num} Days', desc: 'Streamline the sales process through better pipeline management and faster stakeholder alignment.' },
                { title: 'Launch {num} New Product Partnerships', desc: 'Identify and establish strategic partnerships that create cross-selling opportunities and increase deal sizes.' },
                { title: 'Achieve {pct}% Customer Retention Rate', desc: 'Implement proactive account management practices to reduce churn and increase customer lifetime value.' },
            ],
            engineering: [
                { title: 'Reduce System Latency by {pct}%', desc: 'Optimize database queries, implement caching layers, and refactor critical code paths for better performance.' },
                { title: 'Achieve {pct}% Code Coverage', desc: 'Establish comprehensive unit and integration testing to improve code quality and reduce production bugs.' },
                { title: 'Migrate {num} Legacy Services to Microservices', desc: 'Decompose monolithic components into scalable, independently deployable microservices.' },
                { title: 'Reduce Deployment Time by {pct}%', desc: 'Automate CI/CD pipelines and implement blue-green deployments for faster, safer releases.' },
                { title: 'Implement Zero-Downtime Architecture', desc: 'Design and deploy infrastructure that supports rolling updates without service interruption.' },
                { title: 'Reduce Bug Escape Rate by {pct}%', desc: 'Strengthen pre-release testing processes and implement automated regression test suites.' },
            ],
            hr: [
                { title: 'Improve Employee Engagement Score by {pct}%', desc: 'Design and execute engagement initiatives based on survey insights and industry best practices.' },
                { title: 'Reduce Time-to-Hire by {num} Days', desc: 'Streamline the recruitment pipeline through ATS optimization and structured interview processes.' },
                { title: 'Launch {num} Professional Development Programs', desc: 'Create targeted learning paths for career progression and skill development across departments.' },
                { title: 'Achieve {pct}% Training Completion Rate', desc: 'Ensure all team members complete mandatory and elective training modules within the evaluation period.' },
                { title: 'Reduce Voluntary Turnover by {pct}%', desc: 'Implement retention strategies including career pathing, mentorship programs, and competitive compensation reviews.' },
            ],
            marketing: [
                { title: 'Increase Website Traffic by {pct}%', desc: 'Drive organic and paid traffic through SEO optimization, content marketing, and targeted campaigns.' },
                { title: 'Generate {num} Marketing Qualified Leads', desc: 'Develop multi-channel lead generation campaigns targeting high-intent prospects.' },
                { title: 'Improve Brand Awareness Score by {pct}%', desc: 'Execute brand awareness campaigns across digital and traditional channels to increase market visibility.' },
                { title: 'Launch {num} Successful Marketing Campaigns', desc: 'Plan, execute, and measure ROI-positive campaigns across email, social, and digital advertising channels.' },
            ],
            general: [
                { title: 'Improve Team Productivity by {pct}%', desc: 'Streamline workflows, eliminate bottlenecks, and implement agile methodologies to boost output quality.' },
                { title: 'Complete {num} Strategic Projects On Time', desc: 'Deliver key strategic initiatives within scope, timeline, and budget constraints.' },
                { title: 'Reduce Operational Costs by {pct}%', desc: 'Identify and implement cost optimization measures while maintaining service quality standards.' },
                { title: 'Achieve {pct}% Stakeholder Satisfaction', desc: 'Improve communication, deliver consistent results, and proactively address stakeholder needs.' },
                { title: 'Implement {num} Process Improvements', desc: 'Analyze current processes, identify inefficiencies, and deploy measurable improvements within the quarter.' },
                { title: 'Develop Cross-Functional Collaboration Framework', desc: 'Establish formal collaboration channels and shared objectives between departments to break down silos.' },
                { title: 'Enhance Data-Driven Decision Making', desc: 'Implement dashboards, reporting tools, and KPI tracking to support evidence-based strategic decisions.' },
            ]
        };

        // Determine which template pool to use
        var pool = goalTemplates.general;
        var deptKeys = Object.keys(goalTemplates);
        for (var i = 0; i < deptKeys.length; i++) {
            if (dept.includes(deptKeys[i]) || ctx.includes(deptKeys[i])) {
                pool = goalTemplates[deptKeys[i]];
                break;
            }
        }

        var template = pickRandom(pool);
        var pct = pickRandom([10, 15, 20, 25, 30]);
        var num = pickRandom([3, 5, 8, 10, 12]);
        var segments = ['enterprise', 'mid-market', 'SMB', 'strategic', 'high-value'];

        var title = template.title.replace('{pct}', pct).replace('{num}', num);
        var description = template.desc.replace('{pct}', pct).replace('{num}', num).replace('{segment}', pickRandom(segments));

        // Append user context if provided
        if (context && context.trim()) {
            description += ' Context: ' + context.trim() + '.';
        }

        var successIndicators = [
            'Measurable progress tracked weekly with final target achieved by deadline.',
            'Key milestones completed on schedule with documented evidence of improvement.',
            'Quantitative metrics show consistent upward trend reaching target threshold.',
            'Stakeholder feedback confirms positive impact with supporting data validation.',
            'Dashboard metrics demonstrate sustained improvement over the evaluation period.',
        ];

        var weights = [15, 20, 25, 30];

        res.json({
            title: title,
            description: description,
            weight: pickRandom(weights),
            successIndicator: pickRandom(successIndicators)
        });
    } catch (err) {
        res.status(500).json({ message: 'AI generation failed' });
    }
};

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
