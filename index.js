const express = require('express');
const axios = require('axios');
const { subHours, formatISO } = require('date-fns');
const fs = require('fs');

const app = express();
app.use(express.json());

app.post('/simulate', async (req, res) => {
    const { target_url, carrier, tracking_number, status } = req.body;

    // 1. Basic validation of input
    if (!target_url || !carrier || !tracking_number || !status) {
        return res.status(400).json({ error: "Missing required fields: target_url, carrier, tracking_number, or status" });
    }

    // 2. Load the template
    const templatePath = `./payloads/${carrier}.json`;
    if (!fs.existsSync(templatePath)) {
        return res.status(400).json({ error: `Template for ${carrier} not found in payloads/ folder.` });
    }
    
    let template;
    try {
        template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
    } catch (e) {
        return res.status(500).json({ error: "Failed to parse JSON template", details: e.message });
    }

    // 3. Find the starting status index
    const startIndex = template.data.events.findIndex(e => e.status_code === status);
    if (startIndex === -1) {
        return res.status(400).json({ error: `Status ${status} not found in the ${carrier} event list.` });
    }

    // 4. Process events (Slice + Time Math + Clean)
    const historyEvents = template.data.events.slice(startIndex);
    const now = new Date();
    const mostRecentOffset = historyEvents[0].hour_offset;

    const processedEvents = historyEvents.map(event => {
        const hoursToSubtract = Math.abs(event.hour_offset - mostRecentOffset);
        const eventTime = subHours(now, hoursToSubtract);

        // Strip the internal 'hour_offset' helper
        const { hour_offset, ...cleanEvent } = event;

        return {
            ...cleanEvent,
            occurred_at: formatISO(eventTime),
            carrier_occurred_at: formatISO(eventTime).split('Z')[0]
        };
    });

    // 5. Build the Final Webhook Payload
    const finalPayload = {
        resource_url: `https://api.shipengine.com/v1/tracking?carrier_code=${carrier}&tracking_number=${tracking_number}`,
        resource_type: "API_TRACK",
        data: {
            ...template.data,
            tracking_number: tracking_number,
            status_code: status,
            status_description: processedEvents[0].description,
            carrier_status_code: processedEvents[0].event_code,
            events: processedEvents
        }
    };

    // 6. Push Webhook with Enhanced Error Handling
    console.log(`\n--- New Simulation Request ---`);
    console.log(`Target URL: ${target_url}`);
    console.log(`Carrier: ${carrier} | Status: ${status}`);

    try {
        const response = await axios.post(target_url, finalPayload, {
            timeout: 8000, // Wait up to 8 seconds
            headers: { 'Content-Type': 'application/json' }
        });

        console.log(`✅ Webhook Delivered! Response Status: ${response.status}`);
        
        res.status(200).json({ 
            message: "Simulation Successful!", 
            webhook_status: response.status,
            sent_payload: finalPayload 
        });
    } catch (error) {
        console.error(`❌ Webhook Delivery Failed!`);
        
        if (error.response) {
            // The destination server (like Webhook.site) replied with an error (e.g., 404 or 500)
            console.error(`Response Data:`, error.response.data);
            console.error(`Response Status:`, error.response.status);
        } else if (error.request) {
            // The request was made but no response was received (Timeout or DNS issue)
            console.error(`No response received from target URL. Check your internet or the URL.`);
        } else {
            console.error(`Error Message:`, error.message);
        }

        res.status(500).json({ 
            error: "Webhook delivery failed", 
            details: error.message 
        });
    }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Simulator running on http://localhost:${PORT}`));
