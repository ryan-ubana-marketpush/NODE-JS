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
    const resource = req.body.resource;
    const fields = resource.fields || {};
    const workItemId = resource.workItemId || resource.id;

    console.log('📥 Incoming Work Item Update:', workItemId);
    console.log('🔍 Available fields in payload:', Object.keys(fields)); // <-- Added this line

    const workItemType =
      fields['System.WorkItemType']?.newValue ||
      resource.revision?.fields?.['System.WorkItemType'];

    // Only check for Bugs
    if (workItemType !== 'Bug') {
      console.log(`⏭ Skipped: Not a Bug (${workItemType})`);
      return res.status(200).send('No action needed');
    }

    // 🔍 Fetch the full work item to get the latest BoardColumn
    const azureUrl = `https://dev.azure.com/${AZURE_ORG}/${AZURE_PROJECT}/_apis/wit/workitems/${workItemId}?api-version=7.1-preview.3`;
    const response = await fetch(azureUrl, {
      headers: {
        Authorization:
          'Basic ' + Buffer.from(`:${AZURE_PAT}`).toString('base64'),
      },
    });
    const data = await response.json();

    const boardColumn = data.fields?.['Microsoft.VSTS.Common.BoardColumn'];
    const title = data.fields?.['System.Title'] || 'Unknown Task';
    const assignedTo =
      data.fields?.['System.AssignedTo']?.displayName || 'Unassigned';
    const url = resource._links?.html?.href || 'No URL';

    if (boardColumn !== 'Ready to Roll to PROD') {
      console.log(`⏭ Skipped: Bug not in target column (${boardColumn})`);
      return res.status(200).send('No action needed');
    }

    const message = `
🔔 *Azure DevOps Bug Moved to Column*
• *Title:* ${title}
• *Board Column:* ${boardColumn}
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
