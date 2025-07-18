const { feedbackCollection } = require('./mongodb-connection');
const { v4: uuidv4 } = require('uuid');

// Example usage functions that replace your MySQL queries

// Insert a new feedback submission
async function createFeedbackSubmission(feedbackLinkId, data) {
  try {
    const document = {
      _id: uuidv4(), // MongoDB uses _id instead of id
      feedback_link_id: feedbackLinkId,
      data: data, // MongoDB natively supports JSON objects
      submitted_at: new Date()
    };
    
    const result = await feedbackCollection.insertOne(document);
    return result.insertedId;
  } catch (error) {
    console.error('Error creating feedback submission:', error);
    throw error;
  }
}

// Find feedback submissions by feedback_link_id
async function getFeedbackSubmissions(feedbackLinkId) {
  try {
    const submissions = await feedbackCollection
      .find({ feedback_link_id: feedbackLinkId })
      .sort({ submitted_at: -1 })
      .toArray();
    
    return submissions;
  } catch (error) {
    console.error('Error fetching feedback submissions:', error);
    throw error;
  }
}

// Find a specific feedback submission by ID
async function getFeedbackSubmissionById(id) {
  try {
    const submission = await feedbackCollection.findOne({ _id: id });
    return submission;
  } catch (error) {
    console.error('Error fetching feedback submission:', error);
    throw error;
  }
}

// Update a feedback submission
async function updateFeedbackSubmission(id, updateData) {
  try {
    const result = await feedbackCollection.updateOne(
      { _id: id },
      { 
        $set: {
          ...updateData,
          updated_at: new Date()
        }
      }
    );
    
    return result.modifiedCount > 0;
  } catch (error) {
    console.error('Error updating feedback submission:', error);
    throw error;
  }
}

// Delete a feedback submission
async function deleteFeedbackSubmission(id) {
  try {
    const result = await feedbackCollection.deleteOne({ _id: id });
    return result.deletedCount > 0;
  } catch (error) {
    console.error('Error deleting feedback submission:', error);
    throw error;
  }
}

// Get submissions within a date range
async function getFeedbackSubmissionsByDateRange(startDate, endDate) {
  try {
    const submissions = await feedbackCollection
      .find({
        submitted_at: {
          $gte: startDate,
          $lte: endDate
        }
      })
      .sort({ submitted_at: -1 })
      .toArray();
    
    return submissions;
  } catch (error) {
    console.error('Error fetching feedback submissions by date range:', error);
    throw error;
  }
}

module.exports = {
  createFeedbackSubmission,
  getFeedbackSubmissions,
  getFeedbackSubmissionById,
  updateFeedbackSubmission,
  deleteFeedbackSubmission,
  getFeedbackSubmissionsByDateRange
};