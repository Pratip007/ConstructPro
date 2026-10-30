const { validationResult } = require('express-validator');
const { sendError } = require('../utils/response');

/**
 * Wraps an array of express-validator validation chains.
 * Runs them in order and, if any fail, responds with 400 and an errors array.
 *
 * Usage:
 *   router.post('/signup', validate([
 *     body('email').isEmail(),
 *     body('password').isLength({ min: 8 }),
 *   ]), handler);
 *
 * @param {import('express-validator').ValidationChain[]} validations
 * @returns {Function[]} Array of middleware (validations + error-check)
 */
function validate(validations) {
  return [
    ...validations,
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          errors: errors.array(),
        });
      }
      return next();
    },
  ];
}

module.exports = { validate };
