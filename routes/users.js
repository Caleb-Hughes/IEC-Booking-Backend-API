const express = require('express');
const router = express.Router();
const prisma = require("../db/prisma");
const {verifyToken, isAdmin} = require('../middleware/authMiddleware');

router.get('/', verifyToken, isAdmin, async(req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: {createdAt: "desc"},
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        verified: true,
        googleId: true,
        workingStart: true,
        workingEnd: true,
        offDays: true,
        createdAt: true,
        updatedAt: true
      }
    });
    res.status(200).json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({message:'Error retrieving users '})
  }
});

module.exports = router;
