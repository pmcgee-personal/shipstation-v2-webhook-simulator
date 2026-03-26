const express = require('express');
const axios = require('axios');
const { subHours, formatISO } = require('date-fns');
const fs = require('fs');
const path = require('path');

const app = express();

// 1. Middlewares
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 2. Route to serve the Dashboard (index.html)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 3. The Simulation Logic
app.post('/simulate', async (req, res) => {
    const { target_url, carrier, tracking_number, status } = req.body;

    // Load the carrier template
    const templatePath = `./payloads/${carrier}.json`;
    if (!fs.existsSync(templatePath)) {
        return res.status(400).json({ error: `Template for ${carrier} not found.` });
    }
    
    let template;
    try {
        template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
    } catch (e) {
        return res.status(500).json({ error: "Failed to parse template JSON" });
    }

    // Find where the requested status is in our event list
    const startIndex = template.data.events.findIndex(e => e.status_code === status);
    if (startIndex === -1) {
        return res.status(400).json({ error: `Status ${status} not found for ${carrier}.` });
    }

    // Process events and dates
    const historyEvents = template.data.events.slice(startIndex);
    const now = new Date();
    const mostRecentOffset = historyEvents[0].hour_offset;

    const processedEvents = historyEvents.map(event => {
        const hoursDiff = Math.abs(event.hour_offset - mostRecentOffset);
        const eventTime = subHours(now, hoursDiff);
        const { hour_offset, ...cleanEvent } = event;

        return {
            ...cleanEvent,
            occurred_at: formatISO(eventTime),
            carrier_occurred_at: formatISO(eventTime).split('Z')[0],
            event_description: cleanEvent.description
        };
    });

    const isDelivered = (status === 'DE');
    const shipEvent = template.data.events.find(e => e.status_code === 'AC') || historyEvents[historyEvents.length - 1];
    const shipDate = subHours(now, Math.abs(shipEvent.hour_offset - mostRecentOffset));
    const estimatedDelivery = !isDelivered ? subHours(now, -24) : null;

    // Build the Final Webhook Payload
    const finalPayload = {
        resource_url: `https://api.shipengine.com/v1/tracking?carrier_code=${carrier}&tracking_number=${tracking_number}`,
        resource_type: "API_TRACK",
        data: {
            ...template.data,
            tracking_number: tracking_number,
            status_code: status,
            status_description: processedEvents[0].description,
            carrier_status_code: processedEvents[0].event_code,
            carrier_status_description: processedEvents[0].description,
            ship_date: formatISO(shipDate),
            estimated_delivery_date: estimatedDelivery ? formatISO(estimatedDelivery) : null,
            actual_delivery_date: isDelivered ? formatISO(now) : null,
            events: processedEvents
        }
    };

    // Push Webhook with ShipEngine Signature Headers
    try {
        console.log(`\n--- Pushing Webhook ---`);
        console.log(`Carrier: ${carrier} | Status: ${status}`);
        
        await axios.post(target_url, finalPayload, {
            timeout: 5000,
            headers: {
                'Content-Type': 'application/json',
                'x-shipengine-rsa-sha256-key-id': 'simulated-key-123',
                'x-shipengine-rsa-sha256-signature': 'simulated-signature-v1',
                'x-shipengine-timestamp': formatISO(now)
            }
        });

        res.status(200).json({ message: "Simulation Successful", webhook_status: 200 });
    } catch (error) {
        console.error(`❌ Webhook Failed: ${error.message}`);
        res.status(500).json({ error: "Delivery failed", details: error.message });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`\n🚀 Simulator running at http://localhost:${PORT}`);
    console.log(`📁 Serving dashboard from: ${path.join(__dirname, 'public')}`);
});
