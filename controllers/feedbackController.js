const { v4: uuidv4 } = require('uuid');
const { database } = require('../config/db'); // Your MongoDB connection
const cloudinary = require('../utils/cloudinary');

// Get collections
const feedbackLinksCollection = database.collection('feedback_links');
const feedbackSubmissionsCollection = database.collection('feedback_submissions');

class FeedbackController {
  // Get feedback form
  async getFeedbackForm(req, res) {
    try {
      const { id } = req.params;
      
      console.log('Received feedback link ID:', id);
      
      if (!id) {
        return res.status(400).send('Invalid feedback link');
      }

      // Check if feedback link exists - try different query approaches
      console.log('Searching for feedback link...');
      
      // First, let's see what's in the collection
      const allLinks = await feedbackLinksCollection.find({}).limit(5).toArray();
      console.log('Sample feedback links in collection:', allLinks);
      
      // Try finding by _id as string
      let feedbackLink = await feedbackLinksCollection.findOne({ _id: id });
      console.log('Found by _id (string):', feedbackLink);
      
      // If not found, try finding by id field (in case you're using 'id' instead of '_id')
      if (!feedbackLink) {
        feedbackLink = await feedbackLinksCollection.findOne({ id: id });
        console.log('Found by id field:', feedbackLink);
      }

      if (!feedbackLink) {
        console.log('No feedback link found for ID:', id);
        return res.status(404).send('Feedback link not found or expired');
      }
      
      console.log('Successfully found feedback link:', feedbackLink);
      
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

      console.log('Submitting feedback for ID:', id);
      console.log('Feedback text:', feedback_text);

      if (!id) {
        return res.status(400).send('Invalid feedback link');
      }

      // Check if feedback link exists - try different query approaches
      console.log('Searching for feedback link during submission...');
      
      // Try finding by _id as string
      let feedbackLink = await feedbackLinksCollection.findOne({ _id: id });
      console.log('Found by _id (string) during submission:', feedbackLink);
      
      // If not found, try finding by id field
      if (!feedbackLink) {
        feedbackLink = await feedbackLinksCollection.findOne({ id: id });
        console.log('Found by id field during submission:', feedbackLink);
      }

      if (!feedbackLink) {
        console.log('No feedback link found during submission for ID:', id);
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
        customer_name: feedbackLink.customer_name
      };

      // Insert submission into database
      const submissionId = uuidv4();
      const submissionDocument = {
        _id: submissionId,
        feedback_link_id: id,
        data: submissionData,
        submitted_at: new Date()
      };

      await feedbackSubmissionsCollection.insertOne(submissionDocument);
      console.log('Successfully inserted feedback submission:', submissionId);

      // Delete the feedback link after successful submission
      console.log('Attempting to delete feedback link...');
      const deleteResult = await feedbackLinksCollection.deleteOne({ _id: id });
      console.log('Delete result:', deleteResult);
      
      // If deletion by _id failed, try by id field
      if (deleteResult.deletedCount === 0) {
        const deleteResult2 = await feedbackLinksCollection.deleteOne({ id: id });
        console.log('Delete by id field result:', deleteResult2);
      }

      console.log('Rendering success page for customer:', feedbackLink.customer_name);
      res.render('success', { 
        customerName: feedbackLink.customer_name 
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
      
      console.log('Validating feedback link ID:', id);
      
      if (!id) {
        return res.status(400).send('Invalid feedback link');
      }

      // Try finding by _id as string
      let feedbackLink = await feedbackLinksCollection.findOne({ _id: id });
      console.log('Found by _id (string) in validation:', feedbackLink);
      
      // If not found, try finding by id field
      if (!feedbackLink) {
        feedbackLink = await feedbackLinksCollection.findOne({ id: id });
        console.log('Found by id field in validation:', feedbackLink);
      }

      if (!feedbackLink) {
        console.log('No feedback link found during validation for ID:', id);
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