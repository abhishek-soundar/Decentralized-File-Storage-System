// src/validators/files.validator.js
const Joi = require('joi');
const { Types } = require('mongoose');

const objectId = Joi.string().custom((value, helpers) => {
  if (!Types.ObjectId.isValid(value)) return helpers.error('any.invalid');
  return value;
}, 'ObjectId validation');

const verifyParamsSchema = Joi.object({
  params: Joi.object({
    id: objectId.required()
  })
});

const idParamOnly = Joi.object({
  params: Joi.object({
    id: objectId.required()
  })
});

module.exports = { verifyParamsSchema, idParamOnly };
