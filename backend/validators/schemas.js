const Joi = require('joi');

const objectId = Joi.string().regex(/^[0-9a-fA-F]{24}$/).message('Invalid ObjectId format');
const emailDomain = Joi.string().email().pattern(/@biat\.com$/).messages({
    'string.pattern.base': 'Email must exclusively be a @biat.com address.'
});

const schemas = {
    auth: {
        login: Joi.object({
            email: emailDomain.required(),
            password: Joi.string().required()
        }),
        refresh: Joi.object({
            refreshToken: Joi.string().required()
        })
    },
    user: {
        create: Joi.object({
            name: Joi.string().min(3).max(50).required(),
            email: emailDomain.required(),
            password: Joi.string().min(6).required(),
            role: Joi.string().valid('ADMIN', 'HR', 'TEAM_LEADER', 'COLLABORATOR').default('COLLABORATOR')
        }),
        update: Joi.object({
            name: Joi.string().min(3).max(50),
            email: emailDomain,
            role: Joi.string().valid('ADMIN', 'HR', 'TEAM_LEADER', 'COLLABORATOR'),
            password: Joi.string().min(6)
        })
    },
    objective: {
        create: Joi.object({
            title: Joi.string().trim().min(5).max(100).required().messages({
                'string.empty': 'Title is required',
                'string.min': 'Title must be at least 5 characters.',
                'string.max': 'Title cannot exceed 100 characters.'
            }),
            description: Joi.string().max(500).allow(''),
            successIndicator: Joi.string().trim().min(10).max(250).required().messages({
                'string.empty': 'Success Indicator is required for SMART goals',
                'string.min': 'Success Indicator must be descriptive (at least 10 characters).'
            }),
            weight: Joi.number().integer().min(1).max(100).required(),
            deadline: Joi.date().iso().allow(null, ''),
            cycle: objectId.required(),
            category: Joi.string().valid('individual', 'team').default('individual'),
            labels: Joi.array().items(Joi.string().trim()).default([]),
            visibility: Joi.string().valid('private', 'team', 'department', 'public').default('public'),
            startDate: Joi.date().iso().allow(null, ''),
            parentObjective: objectId.allow(null, ''),
            targetUser: objectId.allow(null, ''),
            targetTeam: objectId.allow(null, ''),
        }),
        update: Joi.object({
            title: Joi.string().trim().min(5).max(100),
            description: Joi.string().max(500).allow(''),
            successIndicator: Joi.string().trim().min(10).max(250),
            weight: Joi.number().integer().min(1).max(100),
            deadline: Joi.date().iso().allow(null, ''),
            labels: Joi.array().items(Joi.string().trim()),
            visibility: Joi.string().valid('private', 'team', 'department', 'public'),
            startDate: Joi.date().iso().allow(null, ''),
            parentObjective: objectId.allow(null, ''),
        }),
        submitProgress: Joi.object({
            achievementPercent: Joi.number().integer().min(0).max(100).required(),
            selfAssessment: Joi.string().allow('')
        }),
        validate: Joi.object({
            status: Joi.string().valid('validated', 'approved', 'rejected', 'revision_requested').required(),
            managerAdjustedPercent: Joi.number().integer().min(0).max(100).allow(null),
            managerComments: Joi.string().allow(''),
            rejectionReason: Joi.string().allow(''),
            revisionReason: Joi.string().allow(''),
        })
    },
    cycle: {
        create: Joi.object({
            name: Joi.string().required(),
            year: Joi.number().integer().min(2020).max(2100).required(),
            evaluationStart: Joi.date().iso().allow(null, ''),
            evaluationEnd: Joi.date().iso().allow(null, ''),
            status: Joi.string().valid('draft', 'open', 'active', 'in_progress', 'closed').default('draft'),
            phase1Start: Joi.date().iso().allow(null, ''),
            phase1End: Joi.date().iso().allow(null, ''),
            phase2Start: Joi.date().iso().allow(null, ''),
            phase2End: Joi.date().iso().allow(null, ''),
            phase3Start: Joi.date().iso().allow(null, ''),
            phase3End: Joi.date().iso().allow(null, ''),
            currentPhase: Joi.string().valid('phase1', 'phase2', 'phase3', 'closed').default('phase1')
        }),
        update: Joi.object({
            name: Joi.string(),
            year: Joi.number().integer().min(2020).max(2100),
            evaluationStart: Joi.date().iso().allow(null, ''),
            evaluationEnd: Joi.date().iso().allow(null, ''),
            status: Joi.string().valid('draft', 'open', 'active', 'in_progress', 'closed'),
            phase1Start: Joi.date().iso().allow(null, ''),
            phase1End: Joi.date().iso().allow(null, ''),
            phase2Start: Joi.date().iso().allow(null, ''),
            phase2End: Joi.date().iso().allow(null, ''),
            phase3Start: Joi.date().iso().allow(null, ''),
            phase3End: Joi.date().iso().allow(null, ''),
            currentPhase: Joi.string().valid('phase1', 'phase2', 'phase3', 'closed')
        }),
        updatePhase: Joi.object({
            currentPhase: Joi.string().valid('phase1', 'phase2', 'phase3', 'closed').required()
        })
    }
};

module.exports = schemas;
