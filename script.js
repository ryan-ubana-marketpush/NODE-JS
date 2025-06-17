const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

const GOOGLE_CHAT_WEBHOOK = process.env.GOOGLE_CHAT_WEBHOOK;
const AZURE_ORG = process.env.AZURE_ORG;
const AZURE_PROJECT = process.env.AZURE_PROJECT;
const AZURE_PAT = process.env.AZURE_PAT;

app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

app.post('/', async (req, res) => {
  try {
    // 🔍 Log entire payload for debugging
    console.log('📥 Incoming payload:');
    console.log(JSON.stringify(req.body, null, 2));

    const resource = req.body.resource;
    const fields = resource.fields;
    const workItemId = resource.workItemId || resource.id;

    const workItemType =
      fields?.['System.WorkItemType']?.newValue ||
      resource.revision?.fields?.['System.WorkItemType'];

    const boardColumn =
      fields?.['Microsoft.VSTS.Common.BoardColumn']?.newValue;
    const oldBoardColumn =
      fields?.['Microsoft.VSTS.Common.BoardColumn']?.oldValue;

    const title =
      resource.revision?.fields?.['System.Title'] || 'Unknown Task';
    const url = resource._links?.html?.href || 'No URL';

    // ✅ Only proceed if it's a Bug moved to "Ready to Roll to PROD"
    if (workItemType !== 'Bug' || boardColumn !== 'Ready to Roll to PROD') {
      console.log(
        `⏭ Skipped: Type is ${workItemType}, BoardColumn is ${boardColumn}`
      );
      return res.status(200).send('No action needed');
    }

    // Try to get the assignee
    let assignedTo =
      fields?.['System.AssignedTo']?.newValue?.displayName ||
      resource.revision?.fields?.['System.AssignedTo']?.displayName;

    if (!assignedTo && workItemId) {
      const azureUrl = `https://dev.azure.com/${AZURE_ORG}/${AZURE_PROJECT}/_apis/wit/workitems/${workItemId}?api-version=7.1-preview.3`;
      const response = await fetch(azureUrl, {
        headers: {
          Authorization:
            'Basic ' + Buffer.from(`:${AZURE_PAT}`).toString('base64'),
        },
      });
      const data = await response.json();
      assignedTo =
        data.fields?.['System.AssignedTo']?.displayName || 'Unassigned';
    }

    // ✉️ Compose message
    const message = `
🔔 *Azure DevOps Bug Moved to Column*
• *Title:* ${title}
• *Board Column:* ${oldBoardColumn} → ${boardColumn}
• *Assigned to:* ${assignedTo}
🔗 [View Task](${url})
    `;

    // 📤 Send to Google Chat
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
