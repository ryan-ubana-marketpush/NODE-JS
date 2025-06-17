const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// Environment Variables
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

    // Get type of work item (e.g., Bug)
    const workItemType =
      fields['System.WorkItemType']?.newValue ||
      resource.revision?.fields?.['System.WorkItemType'];

    if (workItemType !== 'Bug') {
      console.log(`⏭ Skipped: Not a Bug (${workItemType})`);
      return res.status(200).send('No action needed');
    }

    // Check if BoardColumn was updated (from drag-and-drop)
    const boardColumn = fields['Microsoft.VSTS.Common.BoardColumn']?.newValue;
    const oldBoardColumn = fields['Microsoft.VSTS.Common.BoardColumn']?.oldValue;

    if (!boardColumn || boardColumn !== 'Ready to Roll to PROD') {
      console.log(`⏭ Skipped: Bug not in target column (${boardColumn})`);
      return res.status(200).send('No action needed');
    }

    // Get title and assigned user
    const title =
      fields['System.Title']?.newValue ||
      resource.revision?.fields?.['System.Title'] || 'Unknown Task';

    const assignedTo =
      fields['System.AssignedTo']?.newValue?.displayName ||
      resource.revision?.fields?.['System.AssignedTo']?.displayName || 'Unassigned';

    const url = resource._links?.html?.href || 'No URL';

    // Compose notification message
    const message = `
🔔 *Azure DevOps Bug Moved to Column*
• *Title:* ${title}
• *Board Column:* ${oldBoardColumn || 'Unknown'} → ${boardColumn}
• *Assigned to:* ${assignedTo}
🔗 [View Task](${url})
    `;

    // Send to Google Chat
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
