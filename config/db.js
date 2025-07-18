const { MongoClient } = require('mongodb');

// Create MongoDB connection
const client = new MongoClient(process.env.MONGODB_URL, {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 60000,
  socketTimeoutMS: 60000,
  connectTimeoutMS: 60000,
  maxIdleTimeMS: 30000,
  retryWrites: true,
  retryReads: true
});

// Database and collection references
const database = client.db('greenaura_feedback');
const feedbackCollection = database.collection('feedback_submissions');

// Connection function
async function connectToMongoDB() {
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    // Create index on feedback_link_id for better query performance
    await feedbackCollection.createIndex({ feedback_link_id: 1 });
    
    // Create index on submitted_at for time-based queries
    await feedbackCollection.createIndex({ submitted_at: 1 });
    
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Closing MongoDB connection...');
  await client.close();
  process.exit(0);
});

// Initialize connection
connectToMongoDB();

module.exports = {
  client,
  database,
  feedbackCollection
};