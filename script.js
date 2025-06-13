const express = require("express");
const bodyParser = require("body-parser");
const fetch = require("node-fetch");

const app = express();
app.use(bodyParser.json());

const GOOGLE_CHAT_WEBHOOK = "https://chat.googleapis.com/v1/spaces/AAQAaiBKmcM/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=zA9pb7X7OOz3p3jBI754znrklMdXDLryXody61zpock";

app.post("/webhook", async (req, res) => {
  try {
    const resource = req.body.resource;
    const fields = resource.fields || {};
    const title = resource.revision?.fields["System.Title"] || "Unknown Task";
    const oldState = fields["System.State"]?.oldValue || "N/A";
    const newState = fields["System.State"]?.newValue || "N/A";
    const assignedTo = resource.revision?.fields["System.AssignedTo"]?.displayName || "Unassigned";
    const url = resource._links?.html?.href || "No URL";

    const message = `🔔 *Azure DevOps Task Moved*\n• *Title:* ${title}\n• *State:* ${oldState} → ${newState}\n• *Assigned to:* ${assignedTo}\n🔗 [View Task](${url})`;

    await fetch(GOOGLE_CHAT_WEBHOOK, {
      method: "POST",
      body: JSON.stringify({ text: message }),
      headers: { "Content-Type": "application/json" },
    });

    res.status(200).send("Notification sent");
  } catch (err) {
    res.status(500).send("Error: " + err.message);
  }
});

app.listen(process.env.PORT || 3000, () => console.log("Server running"));
