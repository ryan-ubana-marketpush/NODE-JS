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

    // Check if BoardColumn changed
    const oldColumn = fields['Microsoft.VSTS.Common.BoardColumn']?.oldValue;
    const newColumn = fields['Microsoft.VSTS.Common.BoardColumn']?.newValue;

    if (!newColumn || newColumn !== 'Ready to Roll to PROD') {
      console.log(`⏭ Skipped: Column is not 'Ready to Roll to PROD' (${newColumn})`);
      return res.status(200).send('No action needed');
    }

    // Get title and assignedTo (fallback to fetch if needed)
    let title = fields['System.Title'] || resource.revision?.fields?.['System.Title'] || 'Unknown Task';
    let assignedTo = fields['System.AssignedTo']?.newValue?.displayName ||
                     resource.revision?.fields?.['System.AssignedTo']?.displayName;

    if (!assignedTo) {
      const azureUrl = `https://dev.azure.com/${AZURE_ORG}/${AZURE_PROJECT}/_apis/wit/workitems/${workItemId}?api-version=7.1-preview.3`;
      const response = await fetch(azureUrl, {
        headers: {
          Authorization: 'Basic ' + Buffer.from(`:${AZURE_PAT}`).toString('base64'),
        },
      });
      const data = await response.json();
      assignedTo = data.fields?.['System.AssignedTo']?.displayName || 'Unassigned';
      title = title === 'Unknown Task' ? data.fields?.['System.Title'] : title;
    }

    const url = resource._links?.html?.href || `https://dev.azure.com/${AZURE_ORG}/${AZURE_PROJECT}/_workitems/edit/${workItemId}`;

    // Send to Google Chat
    const message = `
🔔 *Azure DevOps Task Moved on Board*
• *Title:* ${title}
• *Board Column:* ${oldColumn || 'Unknown'} → ${newColumn}
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
    console.error('❌ Error:', error);
    res.status(500).send('Failed to send notification');
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
