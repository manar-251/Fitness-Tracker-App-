const express = require('express');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const Workout = require('../models/workout');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Validation rules
const workoutValidation = [
  body('type').notEmpty().withMessage('Workout type is required'),
  body('duration').isInt({ min: 1 }).withMessage('Duration must be at least 1 minute'),
  body('date').isISO8601().withMessage('Please enter a valid date'),
  body('notes').optional().trim()
];

// GET /workouts - List all workouts with filtering
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;
    
    let filter = { userId: req.session.userId };
    
    // Date range filter
    if (req.query.dateFrom && req.query.dateTo) {
      filter.date = {
        $gte: new Date(req.query.dateFrom),
        $lte: new Date(req.query.dateTo + 'T23:59:59')
      };
    }
    
    // Type filter
    if (req.query.type && req.query.type !== '') {
      filter.type = req.query.type;
    }
    
    // Search in notes
    if (req.query.search) {
      filter.notes = { $regex: req.query.search, $options: 'i' };
    }
    
    const workouts = await Workout.find(filter)
      .sort({ date: -1, createdAt: -1 })
      .limit(limit)
      .skip(skip);
    
    const totalWorkouts = await Workout.countDocuments(filter);
    const totalPages = Math.ceil(totalWorkouts / limit);
    
    const workoutTypes = ['Cardio', 'Strength', 'Yoga', 'Running', 'Cycling', 'Swimming', 'Walking', 'HIIT', 'Other'];
    
    res.render('workouts/index', {
      title: 'My Workouts',
      workouts,
      currentPage: page,
      totalPages,
      workoutTypes,
      filters: req.query
    });
  } catch (error) {
    console.error('Error fetching workouts:', error);
    res.status(500).render('error', { title: 'Error', error });
  }
});

// GET /workouts/new - New workout form
router.get('/new', (req, res) => {
  const workoutTypes = ['Cardio', 'Strength', 'Yoga', 'Running', 'Cycling', 'Swimming', 'Walking', 'HIIT', 'Other'];
  
  res.render('workouts/new', {
    title: 'Add New Workout',
    workoutTypes,
    errors: [],
    formData: {
      type: '',
      duration: '',
      date: new Date().toISOString().split('T')[0],
      notes: ''
    }
  });
});

// POST /workouts - Create new workout
router.post('/', upload.single('photo'), workoutValidation, async (req, res) => {
  const errors = validationResult(req);
  const workoutTypes = ['Cardio', 'Strength', 'Yoga', 'Running', 'Cycling', 'Swimming', 'Walking', 'HIIT', 'Other'];
  
  if (!errors.isEmpty()) {
    return res.render('workouts/new', {
      title: 'Add New Workout',
      workoutTypes,
      errors: errors.array(),
      formData: req.body
    });
  }

  try {
    const workoutData = {
      userId: req.session.userId,
      type: req.body.type,
      duration: parseInt(req.body.duration),
      date: new Date(req.body.date),
      notes: req.body.notes || ''
    };
    
    // Handle tags
    if (req.body.tags) {
      workoutData.tags = req.body.tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
    }
    
    // Handle photo upload
    if (req.file) {
      workoutData.photo = req.file.filename;
    }
    
    const workout = new Workout(workoutData);
    await workout.save();
    
    res.redirect('/workouts');
  } catch (error) {
    console.error('Error creating workout:', error);
    res.render('workouts/new', {
      title: 'Add New Workout',
      workoutTypes,
      errors: [{ msg: 'Server error. Please try again.' }],
      formData: req.body
    });
  }
});

// GET /workouts/:id - View workout details
router.get('/:id', async (req, res) => {
  try {
    const workout = await Workout.findOne({
      _id: req.params.id,
      userId: req.session.userId
    });
    
    if (!workout) {
      return res.status(404).render('404', { title: 'Workout Not Found' });
    }
    
    res.render('workouts/show', {
      title: 'Workout Details',
      workout
    });
  } catch (error) {
    console.error('Error fetching workout:', error);
    res.status(500).render('error', { title: 'Error', error });
  }
});

// GET /workouts/:id/edit - Edit workout form
router.get('/:id/edit', async (req, res) => {
  try {
    const workout = await Workout.findOne({
      _id: req.params.id,
      userId: req.session.userId
    });
    
    if (!workout) {
      return res.status(404).render('404', { title: 'Workout Not Found' });
    }
    
    const workoutTypes = ['Cardio', 'Strength', 'Yoga', 'Running', 'Cycling', 'Swimming', 'Walking', 'HIIT', 'Other'];
    
    // Format date for HTML input
    const formattedDate = workout.date.toISOString().split('T')[0];
    
    res.render('workouts/edit', {
      title: 'Edit Workout',
      workout,
      workoutTypes,
      errors: [],
      formData: {
        type: workout.type,
        duration: workout.duration,
        date: formattedDate,
        notes: workout.notes || '',
        tags: workout.tags ? workout.tags.join(', ') : ''
      }
    });
  } catch (error) {
    console.error('Error fetching workout for edit:', error);
    res.status(500).render('error', { title: 'Error', error });
  }
});

// PUT /workouts/:id - Update workout
router.put('/:id', upload.single('photo'), workoutValidation, async (req, res) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    try {
      const workout = await Workout.findOne({
        _id: req.params.id,
        userId: req.session.userId
      });
      
      const workoutTypes = ['Cardio', 'Strength', 'Yoga', 'Running', 'Cycling', 'Swimming', 'Walking', 'HIIT', 'Other'];
      
      return res.render('workouts/edit', {
        title: 'Edit Workout',
        workout,
        workoutTypes,
        errors: errors.array(),
        formData: req.body
      });
    } catch (error) {
      console.error('Error fetching workout for edit:', error);
      return res.status(500).render('error', { title: 'Error', error });
    }
  }

  try {
    const workout = await Workout.findOne({
      _id: req.params.id,
      userId: req.session.userId
    });
    
    if (!workout) {
      return res.status(404).render('404', { title: 'Workout Not Found' });
    }
    
    // Update workout data
    workout.type = req.body.type;
    workout.duration = parseInt(req.body.duration);
    workout.date = new Date(req.body.date);
    workout.notes = req.body.notes || '';
    
    // Handle tags
    if (req.body.tags) {
      workout.tags = req.body.tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
    } else {
      workout.tags = [];
    }
    
    // Handle photo upload
    if (req.file) {
      workout.photo = req.file.filename;
    }
    
    await workout.save();
    
    res.redirect('/workouts');
  } catch (error) {
    console.error('Error updating workout:', error);
    res.status(500).render('error', { title: 'Error', error });
  }
});

// DELETE /workouts/:id - Delete workout
router.delete('/:id', async (req, res) => {
  try {
    const result = await Workout.findOneAndDelete({
      _id: req.params.id,
      userId: req.session.userId
    });
    
    if (!result) {
      return res.status(404).json({ success: false, message: 'Workout not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting workout:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Export to CSV
router.get('/export/csv', async (req, res) => {
  try {
    let filter = { userId: req.session.userId };
    
    // Apply same filters as the list view
    if (req.query.dateFrom && req.query.dateTo) {
      filter.date = {
        $gte: new Date(req.query.dateFrom),
        $lte: new Date(req.query.dateTo + 'T23:59:59')
      };
    }
    
    if (req.query.type && req.query.type !== '') {
      filter.type = req.query.type;
    }
    
    const workouts = await Workout.find(filter).sort({ date: -1 });
    
    // Create CSV content
    let csv = 'Date,Type,Duration (minutes),Notes,Tags\n';
    
    workouts.forEach(workout => {
      const date = workout.date.toISOString().split('T')[0];
      const notes = (workout.notes || '').replace(/"/g, '""'); // Escape quotes
      const tags = workout.tags ? workout.tags.join('; ') : '';
      
      csv += `"${date}","${workout.type}","${workout.duration}","${notes}","${tags}"\n`;
    });
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="workouts.csv"');
    res.send(csv);
  } catch (error) {
    console.error('Error exporting workouts:', error);
    res.status(500).render('error', { title: 'Export Error', error });
  }
});

module.exports = router;