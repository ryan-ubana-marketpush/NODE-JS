const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

const GOOGLE_CHAT_WEBHOOK = process.env.GOOGLE_CHAT_WEBHOOK;
const AZURE_ORG = process.env.AZURE_ORG;
const AZURE_PROJECT = process.env.AZURE_PROJECT;
const AZURE_PAT = process.env.AZURE_PAT;

app.use(bodyParser.json());

app.post('/', async (req, res) => {
  try {
    const resource = req.body.resource;
    const fields = resource.fields || {};
    const workItemId = resource.workItemId || resource.id;

    const oldColumn = fields?.["Microsoft.VSTS.Common.BoardColumn"]?.oldValue;
    const newColumn = fields?.["Microsoft.VSTS.Common.BoardColumn"]?.newValue;

    // Only react if BoardColumn changed to "Ready to Roll to PROD"
    if (newColumn !== "Ready to Roll to PROD") {
      console.log(`⏭ Skipped: Column is not 'Ready to Roll to PROD' (${newColumn})`);
      return res.status(200).send('No action needed');
    }

    console.log(`📥 Work Item ${workItemId} moved to column: ${newColumn}`);

    const title = resource.revision?.fields?.["System.Title"] || "Unknown Task";
    const url = resource._links?.html?.href || "No URL";

    // Fallback for AssignedTo field
    let assignedTo = fields?.["System.AssignedTo"]?.newValue?.displayName
                  || resource.revision?.fields?.["System.AssignedTo"]?.displayName;

    // Fetch from Azure DevOps if missing
    if (!assignedTo && workItemId) {
      const azureUrl = `https://dev.azure.com/${AZURE_ORG}/${AZURE_PROJECT}/_apis/wit/workitems/${workItemId}?api-version=7.1-preview.3`;
      const response = await fetch(azureUrl, {
        headers: {
          Authorization: 'Basic ' + Buffer.from(`:${AZURE_PAT}`).toString('base64'),
        },
      });
      const data = await response.json();
      assignedTo = data.fields?.["System.AssignedTo"]?.displayName || "Unassigned";
    }

    const message = `
🔔 *Azure DevOps Task Moved to Board Column*
• *Title:* ${title}
• *Column:* ${oldColumn || "Unknown"} → ${newColumn}
• *Assigned to:* ${assignedTo}
🔗 [View Task](${url})
    `;

    await fetch(GOOGLE_CHAT_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message }),
    });

    console.log('✅ Notification sent.');
    res.status(200).send('OK');
  } catch (error) {
    console.error('❌ Error sending notification:', error);
    res.status(500).send('Failed to send notification');
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
