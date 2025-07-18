const express = require('express');
const multer = require('multer');
const feedbackController = require('../controllers/feedbackController');

const router = express.Router();

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Only allow images
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Routes
router.get('/feedback/:id', feedbackController.getFeedbackForm);
router.post('/feedback/:id', upload.single('image'), feedbackController.submitFeedback);

// Root route
router.get('/', (req, res) => {
  res.send('Feedback System API - Use /feedback/:id to access feedback forms');
});

module.exports = router;