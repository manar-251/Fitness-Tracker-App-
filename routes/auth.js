const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/user');
const isSignedIn = require('../middleware/is-signed-in');

const router = express.Router();

// Sign In Page
router.get('/sign-in', (req, res) => {
  res.render('auth/sign-in', { title: 'Sign In', errors: [], email: '' });
});

// Sign In POST
router.post('/sign-in', [
  body('email').isEmail().withMessage('Please enter a valid email'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.render('auth/sign-in', {
      title: 'Sign In',
      errors: errors.array(),
      email: req.body.email
    });
  }

  try {
    const { email, password } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.render('auth/sign-in', {
        title: 'Sign In',
        errors: [{ msg: 'Invalid email or password' }],
        email
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.render('auth/sign-in', {
        title: 'Sign In',
        errors: [{ msg: 'Invalid email or password' }],
        email
      });
    }

    req.session.user = { userId: user._id, userName : user.name }

     req.session.save(() => {
      res.redirect('/dashboard');
    });
    
  } catch (error) {
    console.error('Sign in error:', error);
    res.render('auth/sign-in', {
      title: 'Sign In',
      errors: [{ msg: 'Server error. Please try again.' }],
      email: req.body.email
    });
  }
});

// Sign Up Page
router.get('/sign-up', (req, res) => {
  res.render('auth/sign-up', { title: 'Sign Up', errors: [], formData: {} });
});

// Sign Up POST
router.post('/sign-up', [
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
    return res.render('auth/sign-up', {
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
      return res.render('auth/sign-up', {
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
    res.render('auth/sign-up', {
      title: 'Sign Up',
      errors: [{ msg: 'Server error. Please try again.' }],
      formData: req.body
    });
  }
});

// Sign Out
router.post('/signout', isSignedIn, (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Session destroy error:', err);
    }
    res.redirect('/auth/sign-in');
  });
});

module.exports = router;