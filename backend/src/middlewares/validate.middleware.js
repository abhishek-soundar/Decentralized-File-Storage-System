// src/middlewares/validate.middleware.js
const httpErrors = require('http-errors');

module.exports = (schema) => {
  return (req, res, next) => {
    const toValidate = {};
    if (schema.params) toValidate.params = req.params;
    if (schema.query) toValidate.query = req.query;
    if (schema.body) toValidate.body = req.body;
    if (schema.headers) toValidate.headers = req.headers;

    const { error } = schema.validate(toValidate, { abortEarly: false, allowUnknown: true });

    if (error) {
      const details = error.details.map(d => ({ message: d.message, path: d.path }));
      return next(httpErrors(400, 'Validation error', { details }));
    }
    // attach sanitized values if desired (optional)
    next();
  };
};
