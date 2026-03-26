const express = require('express');
const axios = require('axios');
const { subHours, formatISO } = require('date-fns');
const fs = require('fs');

const app = express();
app.use(express.json());

app.post('/simulate', async (req, res) => {
    // These 4 fields are what the user provides in the request
    const { target_url, carrier, tracking_number, status } = req.body;

    // 1. Load the template (e.g., payloads/fedex.json)
    const templatePath = `./payloads/${carrier}.json`;
    if (!fs.existsSync(templatePath)) {
        return res.status(400).json({ error: `Template for ${carrier} not found.` });
    }
    const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));

    // 2. Find the index of the requested status (e.g., "DE" for Delivered)
    const startIndex = template.data.events.findIndex(e => e.status_code === status);
    if (startIndex === -1) {
        return res.status(400).json({ error: `Status ${status} not found for ${carrier}.` });
    }

    // 3. Slice the history (includes everything from the status down to the end of the array)
    const historyEvents = template.data.events.slice(startIndex);

    // 4. Update timestamps to "Real Time" and strip the internal 'hour_offset'
    const now = new Date();
    const mostRecentOffset = historyEvents[0].hour_offset;

    const processedEvents = historyEvents.map(event => {
        // Calculate the difference in hours between this event and the "latest" one
        const hoursToSubtract = Math.abs(event.hour_offset - mostRecentOffset);
        const eventTime = subHours(now, hoursToSubtract);

        // Destructure the event to REMOVE 'hour_offset' so it stays secret
        const { hour_offset, ...cleanEvent } = event;

        return {
            ...cleanEvent,
            occurred_at: formatISO(eventTime),
            // ShipEngine uses a 'carrier_occurred_at' without the 'Z' (local time)
            carrier_occurred_at: formatISO(eventTime).split('Z')[0]
        };
    });

    // 5. Assemble the final production-ready payload
    const finalPayload = {
        ...template,
        resource_url: template.resource_url.replace('{{TRACKING_NUMBER}}', tracking_number),
        data: {
            ...template.data,
            tracking_number: tracking_number,
            status_code: status,
            status_description: processedEvents[0].description,
            carrier_status_code: processedEvents[0].event_code,
            events: processedEvents
        }
    };

    // 6. Push the webhook to the integrator
    try {
        console.log(`Pushing simulated ${status} webhook to ${target_url}...`);
        await axios.post(target_url, finalPayload);
        res.status(200).json({ 
            message: "Simulation Successful!", 
            sent_payload: finalPayload 
        });
    } catch (error) {
        res.status(500).json({ 
            error: "Webhook delivery failed", 
            details: error.message 
        });
    }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Simulator running on http://localhost:${PORT}`));
