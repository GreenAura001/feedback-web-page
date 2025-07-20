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

  // Submit feedback - FIXED VERSION
  async submitFeedback(req, res) {
    try {
      const { id } = req.params;
      const file = req.file;

      console.log('=== SUBMIT FEEDBACK DEBUG ===');
      console.log('Submitting feedback for ID:', id);
      console.log('Form data received:', req.body);
      console.log('File uploaded:', !!file);

      if (!id) {
        console.log('ERROR: No ID provided');
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
        console.log('ERROR: No feedback link found during submission for ID:', id);
        
        // Let's see what's actually in the database
        const allLinks = await feedbackLinksCollection.find({}).toArray();
        console.log('All links in database during submission:', allLinks);
        
        return res.status(404).send('Feedback link not found or expired');
      }

      console.log('SUCCESS: Found feedback link during submission');

      let imageUrl = null;

      // Upload image to Cloudinary if provided
      if (file) {
        console.log('Uploading image to Cloudinary...');
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
          console.log('Image uploaded successfully:', imageUrl);
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

      // Collect all form data into a structured object
      const feedbackData = {
        satisfaction: req.body.satisfaction,
        service_type: req.body.service_type,
        service_type_other: req.body.service_type_other || null,
        punctuality: req.body.punctuality,
        communication: req.body.communication,
        quality_rating: req.body.quality_rating,
        cleanliness: req.body.cleanliness,
        expectations: req.body.expectations,
        liked_most: req.body.liked_most || '',
        improvements: req.body.improvements || '',
        recommend: req.body.recommend,
        recommend_reason: req.body.recommend_reason || null,
        maintenance_interest: req.body.maintenance_interest,
        tips_offers: req.body.tips_offers,
        image_url: imageUrl,
        metadata: {
          ip_address: clientIp,
          user_agent: req.get('User-Agent') || 'unknown',
          submitted_at: new Date().toISOString(),
          customer_name: feedbackLink.customer_name
        }
      };

      console.log('Structured feedback data:', JSON.stringify(feedbackData, null, 2));

      // Insert submission into MongoDB database
      const submissionId = uuidv4();
      const submissionDocument = {
        _id: submissionId,
        feedback_link_id: id,
        feedback_text: JSON.stringify(feedbackData), // Store as JSON string in feedback_text field
        submitted_at: new Date()
      };

      console.log('Inserting submission document...');
      console.log('Full submission document to insert:', JSON.stringify(submissionDocument, null, 2));
      
      try {
        const insertResult = await feedbackSubmissionsCollection.insertOne(submissionDocument);
        console.log('Insert operation result:', insertResult);
        console.log('Successfully inserted feedback submission with ID:', submissionId);
        
        // Verify the insertion by immediately querying for it
        const verifyInsert = await feedbackSubmissionsCollection.findOne({ _id: submissionId });
        console.log('Verification - found inserted document:', verifyInsert);
        
        // Also check total count in collection
        const totalCount = await feedbackSubmissionsCollection.countDocuments();
        console.log('Total documents in feedback_submissions collection:', totalCount);
        
      } catch (insertError) {
        console.error('Error during database insertion:', insertError);
        console.error('Insert error stack:', insertError.stack);
        return res.status(500).send('Database error during feedback submission');
      }

      // NOTE: NOT DELETING THE LINK FOR DEBUGGING PURPOSES
      console.log('DEBUG MODE: Not deleting feedback link to allow repeated testing');

      console.log('Rendering success page for customer:', feedbackLink.customer_name);
      
      res.render('success', { 
        customerName: feedbackLink.customer_name 
      });
      
      console.log('=== SUBMIT FEEDBACK COMPLETED ===');
      
    } catch (error) {
      console.error('Error submitting feedback:', error);
      console.error('Full error stack:', error.stack);
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

  // Helper method to retrieve feedback submissions with parsed JSON data
  async getFeedbackSubmissionsByLinkId(feedbackLinkId) {
    try {
      const submissions = await feedbackSubmissionsCollection
        .find({ feedback_link_id: feedbackLinkId })
        .sort({ submitted_at: -1 })
        .toArray();
      
      // Parse the JSON feedback_text for each submission
      const parsedSubmissions = submissions.map(submission => ({
        ...submission,
        feedback_data: JSON.parse(submission.feedback_text)
      }));
      
      return parsedSubmissions;
    } catch (error) {
      console.error('Error fetching feedback submissions:', error);
      throw error;
    }
  }

  // Helper method to retrieve all feedback submissions with parsed JSON data
  async getAllFeedbackSubmissions() {
    try {
      const submissions = await feedbackSubmissionsCollection
        .find({})
        .sort({ submitted_at: -1 })
        .toArray();
      
      // Parse the JSON feedback_text for each submission
      const parsedSubmissions = submissions.map(submission => ({
        ...submission,
        feedback_data: JSON.parse(submission.feedback_text)
      }));
      
      return parsedSubmissions;
    } catch (error) {
      console.error('Error fetching all feedback submissions:', error);
      throw error;
    }
  }
}

module.exports = new FeedbackController();