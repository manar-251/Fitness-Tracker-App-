const express = require('express');
const Workout = require('../models/workout');

const router = express.Router();

// Dashboard
router.get('/', async (req, res) => {
  try {
    const userId = req.session.user.userId;
    const now = new Date();
    
    // Recent workouts (last 5)
    const recentWorkouts = await Workout.find({ userId })
      .sort({ date: -1, createdAt: -1 })
      .limit(5);
    
    // This week's stats
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    
    const thisWeekWorkouts = await Workout.find({
      userId,
      date: { $gte: startOfWeek, $lte: endOfWeek }
    });
    
    const thisWeekMinutes = thisWeekWorkouts.reduce((total, workout) => total + workout.duration, 0);
    const thisWeekSessions = thisWeekWorkouts.length;
    
    // This month's stats
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    
    const thisMonthWorkouts = await Workout.find({
      userId,
      date: { $gte: startOfMonth, $lte: endOfMonth }
    });
    
    const thisMonthMinutes = thisMonthWorkouts.reduce((total, workout) => total + workout.duration, 0);
    const thisMonthSessions = thisMonthWorkouts.length;
    
    // Workout types breakdown for this month
    const typeBreakdown = {};
    thisMonthWorkouts.forEach(workout => {
      typeBreakdown[workout.type] = (typeBreakdown[workout.type] || 0) + 1;
    });
    
    // Calculate streak (consecutive days with workouts)
    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get all workout dates for the user
    const allWorkouts = await Workout.find({ userId })
      .sort({ date: -1 })
      .select('date');
    
    const workoutDates = [...new Set(allWorkouts.map(w => w.date.toDateString()))];
    
    // Calculate streak
    let checkDate = new Date(today);
    for (let i = 0; i < workoutDates.length; i++) {
      const workoutDate = new Date(workoutDates[i]);
      workoutDate.setHours(0, 0, 0, 0);
      
      if (workoutDate.toDateString() === checkDate.toDateString()) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else if (workoutDate < checkDate) {
        break;
      }
    }
    
    res.render('dashboard/index', {
      title: 'Dashboard',
      userName: req.session.user.userName,
      recentWorkouts,
      thisWeekMinutes,
      thisWeekSessions,
      thisMonthMinutes,
      thisMonthSessions,
      typeBreakdown,
      streak
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).render('error', { title: 'Dashboard Error', error });
  }
});

// Statistics page
router.get('/stats', async (req, res) => {
  try {
    const userId = req.session.user.userId;
    const period = req.query.period || 'month'; // week, month, year
    
    let startDate, endDate;
    const now = new Date();
    
    switch (period) {
      case 'week':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - now.getDay());
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
        break;
      case 'month':
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        break;
    }
    
    const workouts = await Workout.find({
      userId,
      date: { $gte: startDate, $lte: endDate }
    }).sort({ date: 1 });
    
    // Calculate statistics
    const totalMinutes = workouts.reduce((total, workout) => total + workout.duration, 0);
    const totalSessions = workouts.length;
    const averageDuration = totalSessions > 0 ? Math.round(totalMinutes / totalSessions) : 0;
    
    // Type breakdown
    const typeStats = {};
    workouts.forEach(workout => {
      if (!typeStats[workout.type]) {
        typeStats[workout.type] = { count: 0, minutes: 0 };
      }
      typeStats[workout.type].count++;
      typeStats[workout.type].minutes += workout.duration;
    });
    
    // Daily breakdown for charts
    const dailyStats = {};
    workouts.forEach(workout => {
      const dateKey = workout.date.toISOString().split('T')[0];
      if (!dailyStats[dateKey]) {
        dailyStats[dateKey] = { sessions: 0, minutes: 0 };
      }
      dailyStats[dateKey].sessions++;
      dailyStats[dateKey].minutes += workout.duration;
    });
    
    res.render('dashboard/stats', {
      title: 'Statistics',
      period,
      totalMinutes,
      totalSessions,
      averageDuration,
      typeStats,
      dailyStats,
      workouts
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).render('error', { title: 'Stats Error', error });
  }
});

module.exports = router;