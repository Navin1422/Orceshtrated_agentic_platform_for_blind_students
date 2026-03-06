const twilio = require('twilio');
const dotenv = require('dotenv');

dotenv.config();

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

/**
 * Makes an automated voice call to a student to remind them to learn.
 * @param {string} to - The recipient's phone number.
 */
const makeInactivityCall = async (to) => {
  try {
    const callTarget = to || process.env.TWILIO_TARGET_NUMBER;
    if (!callTarget) {
      console.warn('No target phone number provided for Twilio call.');
      return;
    }

    const call = await client.calls.create({
      // We use a publicly accessible URL for Twilio to fetch the TwiML. 
      // For local development, we'll try to use the current server's URL if available, 
      // but Twilio needs a public URL (like ngrok). 
      // Falling back to a demo XML if no public URL is provided.
      url: process.env.TWILIO_TWIML_URL || 'http://demo.twilio.com/docs/voice.xml',
      to: callTarget,
      from: process.env.TWILIO_FROM_NUMBER,
    });

    console.log(`Call initiated successfully. SID: ${call.sid} to ${callTarget}`);
    return call;
  } catch (error) {
    console.error('Error making Twilio call:', error);
    throw error;
  }
};

module.exports = {
  makeInactivityCall,
};
