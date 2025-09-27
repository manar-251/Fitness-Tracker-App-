const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');

const router = express.Router();

// Sign In Page
router.get('/signin', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/dashboard');
  }
  res.render('auth/signin', { title: 'Sign In', errors: [], email: '' });
});

// Sign In POST
router.post('/signin', [
  body('email').isEmail().withMessage('Please enter a valid email'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.render('auth/signin', {
      title: 'Sign In',
      errors: errors.array(),
      email: req.body.email
    });
  }

  try {
    const { email, password } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.render('auth/signin', {
        title: 'Sign In',
        errors: [{ msg: 'Invalid email or password' }],
        email
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.render('auth/signin', {
        title: 'Sign In',
        errors: [{ msg: 'Invalid email or password' }],
        email
      });
    }

    req.session.userId = user._id;
    req.session.userName = user.name;
    res.redirect('/dashboard');
  } catch (error) {
    console.error('Sign in error:', error);
    res.render('auth/signin', {
      title: 'Sign In',
      errors: [{ msg: 'Server error. Please try again.' }],
      email: req.body.email
    });
  }
});

// Sign Up Page
router.get('/signup', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/dashboard');
  }
  res.render('auth/signup', { title: 'Sign Up', errors: [], formData: {} });
});

// Sign Up POST
router.post('/signup', [
  body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('email').isEmail().withMessage('Please enter a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.password) {
      throw new Error('Passwords do not match');
    }
    return true;
  })
], async (req, res) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.render('auth/signup', {
      title: 'Sign Up',
      errors: errors.array(),
      formData: req.body
    });
  }

  try {
    const { name, email, password } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.render('auth/signup', {
        title: 'Sign Up',
        errors: [{ msg: 'User with this email already exists' }],
        formData: req.body
      });
    }

    const user = new User({ name, email, password });
    await user.save();

    req.session.userId = user._id;
    req.session.userName = user.name;
    res.redirect('/dashboard');
  } catch (error) {
    console.error('Sign up error:', error);
    res.render('auth/signup', {
      title: 'Sign Up',
      errors: [{ msg: 'Server error. Please try again.' }],
      formData: req.body
    });
  }
});

// Sign Out
router.post('/signout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Session destroy error:', err);
    }
    res.redirect('/auth/signin');
  });
});

module.exports = router;