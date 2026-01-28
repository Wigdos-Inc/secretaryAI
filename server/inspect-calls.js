#!/usr/bin/env node
// Simple helper to fetch Twilio Call details for given CallSIDs
// Usage: set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in env, then:
//   node inspect-calls.js CAxxxxxxxx CAyyyyyyyy

const Twilio = require('twilio');

const SID = process.env.TWILIO_ACCOUNT_SID;
const TOKEN = process.env.TWILIO_AUTH_TOKEN;

if (!SID || !TOKEN) {
  console.error('ERROR: set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in the environment');
  process.exit(1);
}

const client = Twilio(SID, TOKEN);
const sids = process.argv.slice(2);
if (!sids.length) {
  console.log('Usage: node inspect-calls.js <CALL_SID> [CALL_SID ...]');
  process.exit(0);
}

(async () => {
  for (const callSid of sids) {
    try {
      const call = await client.calls(callSid).fetch();
      console.log('---');
      console.log('CallSid:', callSid);
      console.log('Status:', call.status);
      console.log('From:', call.from);
      console.log('To:', call.to);
      console.log('Direction:', call.direction);
      console.log('Start Time:', call.startTime || 'N/A');
      console.log('End Time:', call.endTime || 'N/A');
      console.log('Duration:', call.duration || 'N/A');
      console.log('Error Code:', call.errorCode || 'none');
      console.log('Subresources:', JSON.stringify(call.subresourceUris || {}, null, 2));

      // Fetch events for more detail if available
      try {
        const events = await client.calls(callSid).feedback().list({ limit: 20 });
        if (events && events.length) console.log('Recent feedback/events:', events.length);
      } catch (e) {
        // ignore
      }
    } catch (e) {
      console.error('Failed to fetch', callSid, e.message || e);
    }
  }
  process.exit(0);
})();
