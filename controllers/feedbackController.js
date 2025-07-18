const { v4: uuidv4 } = require('uuid');
const pool = require('../config/db');
const cloudinary = require('../utils/cloudinary');

class FeedbackController {
  // Get feedback form
  async getFeedbackForm(req, res) {
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).send('Invalid feedback link');
      }

      // Check if feedback link exists
      const [rows] = await pool.execute(
        'SELECT id, customer_name FROM feedback_links WHERE id = ?',
        [id]
      );

      if (rows.length === 0) {
        return res.status(404).send('Feedback link not found or expired');
      }

      const feedbackLink = rows[0];
      
      res.render('feedback_form', { 
        feedbackId: id,
        customerName: feedbackLink.customer_name
      });
    } catch (error) {
      console.error('Error getting feedback form:', error);
      res.status(500).send('Server error');
    }
  }

  // Submit feedback
  async submitFeedback(req, res) {
    try {
      const { id } = req.params;
      const { feedback_text } = req.body;
      const file = req.file;

      if (!id) {
        return res.status(400).send('Invalid feedback link');
      }

      // Check if feedback link exists
      const [linkRows] = await pool.execute(
        'SELECT id, customer_name FROM feedback_links WHERE id = ?',
        [id]
      );

      if (linkRows.length === 0) {
        return res.status(404).send('Feedback link not found or expired');
      }

      let imageUrl = null;

      // Upload image to Cloudinary if provided
      if (file) {
        try {
          const result = await new Promise((resolve, reject) => {
            cloudinary.uploader.upload_stream(
              {
                folder: 'feedback-images',
                resource_type: 'image'
              },
              (error, result) => {
                if (error) reject(error);
                else resolve(result);
              }
            ).end(file.buffer);
          });
          
          imageUrl = result.secure_url;
        } catch (uploadError) {
          console.error('Cloudinary upload error:', uploadError);
          return res.status(500).send('Image upload failed');
        }
      }

      // Get client IP address
      const clientIp = req.ip || 
                      req.connection.remoteAddress || 
                      req.socket.remoteAddress ||
                      (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
                      req.headers['x-forwarded-for']?.split(',')[0] ||
                      'unknown';

      // Prepare submission data
      const submissionData = {
        feedback_text: feedback_text || '',
        image_url: imageUrl,
        ip_address: clientIp,
        submitted_at: new Date().toISOString(),
        user_agent: req.get('User-Agent') || 'unknown',
        customer_name: linkRows[0].customer_name
      };

      // Insert submission into database
      const submissionId = uuidv4();
      await pool.execute(
        'INSERT INTO feedback_submissions (id, feedback_link_id, data, submitted_at) VALUES (?, ?, ?, NOW())',
        [submissionId, id, JSON.stringify(submissionData)]
      );

      // Delete the feedback link after successful submission
      await pool.execute(
        'DELETE FROM feedback_links WHERE id = ?',
        [id]
      );

      res.render('success', { 
        customerName: linkRows[0].customer_name 
      });
    } catch (error) {
      console.error('Error submitting feedback:', error);
      res.status(500).send('Server error');
    }
  }

  // Validate feedback link (utility method)
  async validateFeedbackLink(req, res, next) {
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).send('Invalid feedback link');
      }

      const [rows] = await pool.execute(
        'SELECT id FROM feedback_links WHERE id = ?',
        [id]
      );

      if (rows.length === 0) {
        return res.status(404).send('Feedback link not found or expired');
      }

      next();
    } catch (error) {
      console.error('Error validating feedback link:', error);
      res.status(500).send('Server error');
    }
  }
}

module.exports = new FeedbackController();