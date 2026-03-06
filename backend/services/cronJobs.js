const cron = require('node-cron');
const Student = require('../models/Student');
const { makeInactivityCall } = require('./twilioService');

/**
 * Initializes cron jobs for the application.
 */
const initCronJobs = () => {
  // Schedule a job to run every day at 9:00 AM
  // Format: second minute hour day-of-month month day-of-week
  // Day of week: 1-6 is Monday-Saturday
  cron.schedule('0 9 * * 1-6', async () => {
    console.log('Running daily inactivity check (Mon-Sat)...');

    try {
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);

      // Find students who haven't been active for more than 24 hours
      const inactiveStudents = await Student.find({
        lastActiveAt: { $lt: oneDayAgo },
      });

      console.log(`Found ${inactiveStudents.length} inactive students.`);

      for (const student of inactiveStudents) {
        console.log(`Notifying student: ${student.name} (${student.studentId})`);
        
        // Use student's phone number if available, otherwise fallback to the one provided by the user
        const targetNumber = student.phoneNumber || process.env.TWILIO_TARGET_NUMBER;
        
        if (targetNumber) {
          await makeInactivityCall(targetNumber);
        } else {
          console.warn(`No phone number found for student ${student.name}`);
        }
      }
    } catch (error) {
      console.error('Error during inactivity check cron job:', error);
    }
  });

  console.log('Cron jobs initialized.');
};

module.exports = {
  initCronJobs,
};
