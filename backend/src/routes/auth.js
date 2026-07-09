const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { register, registerValidation, login, loginValidation, me, changePassword } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Please wait 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Too many registration attempts. Please try again later.' },
});

router.post('/register', registerLimiter, registerValidation, register);
router.post('/login', loginLimiter, loginValidation, login);
router.get('/me', authenticate, me);
router.put('/change-password', authenticate, changePassword);

module.exports = router;
