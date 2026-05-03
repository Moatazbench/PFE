const Joi = require('joi');

const validate = (schema) => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });

        if (error) {
            const details = error.details.map((x) => ({
                field: x.path.join('.'),
                message: x.message
            }));
            const messages = details.map((x) => x.message).join(', ');
            return res.status(400).json({ success: false, message: `Validation Error: ${messages}`, details });
        }

        req.body = value;
        next();
    };
};

module.exports = validate;
