const express = require('express');
const router = express.Router();
const User = require('../models/user');
const Appointment = require('../models/appointments');
const {verifyToken, isAdmin} = require('../middleware/authMiddleware');

router.get('/', verifyToken, isAdmin, async(req, res) => {
  try {
    const users = await User.find().select('-password');
    res.status(200).json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({message:'Error retrieving users '})
  }
});
router.get('/user', verifyToken, async(req, res) => {
  try {
    const appointments = await Appointment.find({user: req.user.id})
        .populate('service')
        .sort({date: 1}); //sort dates in ascending order
    res.status(200).json(appointments);
  } catch (error) {
    console.error(error);
    res.status(500).json({message: 'Internal server error while getting appointments', error});
  }
});
module.exports = router;
