const express = require('express');
const axios = require('axios');
const { subHours, formatISO } = require('date-fns');
const fs = require('fs');
const path = require('path');

const app = express();

// 1. Global State & Middlewares
let webhookHistory = []; // Stores the last 5 simulation attempts
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 2. Dashboard Route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 3. History API (For the Dashboard UI)
app.get('/history', (req, res) => {
    res.json(webhookHistory);
});

// 4. The Simulation Engine
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

    // Find requested status in the event list
    const startIndex = template.data.events.findIndex(e => e.status_code === status);
    if (startIndex === -1) {
        return res.status(400).json({ error: `Status ${status} not found for ${carrier}.` });
    }

    // Process events and relative timestamps (Time Travel)
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
            carrier_occurred_at: formatISO(eventTime).split('Z')[0], // Local format
        };
    });

    // Date Logic for Delivery Estimates
    const isDelivered = (status === 'DE');
    const shipEvent = template.data.events.find(e => e.status_code === 'AC') || historyEvents[historyEvents.length - 1];
    const shipDate = subHours(now, Math.abs(shipEvent.hour_offset - mostRecentOffset));
    const estimatedDelivery = !isDelivered ? subHours(now, -24) : null;

    // 5. Final Webhook Payload Assembly (SSAPI Compliant)
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
            carrier_detail_code: processedEvents[0].carrier_detail_code || null,
            ship_date: formatISO(shipDate),
            estimated_delivery_date: estimatedDelivery ? formatISO(estimatedDelivery) : null,
            actual_delivery_date: isDelivered ? formatISO(now) : null,
            events: processedEvents
        }
    };

    // 6. Push Webhook to Target
    try {
        await axios.post(target_url, finalPayload, {
            timeout: 5000,
            headers: {
                'Content-Type': 'application/json',
                'x-shipengine-rsa-sha256-key-id': 'simulated-key-123',
                'x-shipengine-rsa-sha256-signature': 'simulated-signature-v1',
                'x-shipengine-timestamp': formatISO(now)
            }
        });

        // Add to history log on success
        webhookHistory.unshift({
            timestamp: new Date().toLocaleTimeString(),
            carrier,
            status,
            tracking_number,
            success: true
        });
        if (webhookHistory.length > 5) webhookHistory.pop();

        res.status(200).json({ message: "Simulation Successful", webhook_status: 200 });
    } catch (error) {
        console.error(`❌ Webhook Failed: ${error.message}`);
        
        // Add to history log on failure
        webhookHistory.unshift({
            timestamp: new Date().toLocaleTimeString(),
            carrier,
            status,
            tracking_number,
            success: false
        });

        res.status(500).json({ error: "Delivery failed", details: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`\n🚀 Simulator running at http://localhost:${PORT}`);
    console.log(`📁 Templates loaded from: ${path.join(__dirname, 'payloads')}`);
});
