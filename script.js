// script.js
const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;
const GOOGLE_CHAT_WEBHOOK = process.env.GOOGLE_CHAT_WEBHOOK;

app.use(bodyParser.json());

app.post('/', async (req, res) => {
  try {
    const resource = req.body.resource;
    const fields = resource.fields;

    const oldState = fields?.["System.State"]?.oldValue || "N/A";
    const newState = fields?.["System.State"]?.newValue || "N/A";
    const title = resource.revision?.fields?.["System.Title"] || "Unknown Task";
    const url = resource._links?.html?.href || "No URL";

    // Reliable Assigned To fallback logic
    let assignedTo = "Unassigned";
    if (fields?.["System.AssignedTo"]?.newValue?.displayName) {
      assignedTo = fields["System.AssignedTo"].newValue.displayName;
    } else if (resource.revision?.fields?.["System.AssignedTo"]?.displayName) {
      assignedTo = resource.revision.fields["System.AssignedTo"].displayName;
    }

    const message = `
🔔 *Azure DevOps Task Moved*
• *Title:* ${title}
• *State:* ${oldState} → ${newState}
• *Assigned to:* ${assignedTo}
🔗 [View Task](${url})
    `;

    await fetch(GOOGLE_CHAT_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message }),
    });

    console.log('Notification sent.');
    res.status(200).send('OK');
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Failed to send notification');
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
