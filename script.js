const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

const GOOGLE_CHAT_WEBHOOK = process.env.GOOGLE_CHAT_WEBHOOK;
const AZURE_ORG = process.env.AZURE_ORG;
const AZURE_PROJECT = process.env.AZURE_PROJECT;
const AZURE_PAT = process.env.AZURE_PAT;

// ✅ Increase payload size limit
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

app.post('/', async (req, res) => {
  try {
    const resource = req.body.resource;
    const fields = resource.fields;
    const workItemId = resource.workItemId || resource.id;

    const oldState = fields?.["System.State"]?.oldValue || "N/A";
    const newState = fields?.["System.State"]?.newValue || "N/A";
    const title = resource.revision?.fields?.["System.Title"] || "Unknown Task";
    const url = resource._links?.html?.href || "No URL";

    let assignedTo = fields?.["System.AssignedTo"]?.newValue?.displayName
                  || resource.revision?.fields?.["System.AssignedTo"]?.displayName;

    if (!assignedTo && workItemId) {
      const azureUrl = `https://dev.azure.com/${AZURE_ORG}/${AZURE_PROJECT}/_apis/wit/workitems/${workItemId}?api-version=7.1-preview.3`;
      const response = await fetch(azureUrl, {
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`:${AZURE_PAT}`).toString('base64'),
        },
      });
      const data = await response.json();
      assignedTo = data.fields?.["System.AssignedTo"]?.displayName || "Unassigned";
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
