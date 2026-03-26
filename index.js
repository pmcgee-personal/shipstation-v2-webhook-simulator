const express = require('express');
const axios = require('axios');
const { subHours, formatISO } = require('date-fns');
const fs = require('fs');

const app = express();
app.use(express.json());

app.post('/simulate', async (req, res) => {
    const { target_url, carrier, tracking_number, status } = req.body;

    // 1. Load the carrier template
    const templatePath = `./payloads/${carrier}.json`;
    if (!fs.existsSync(templatePath)) {
        return res.status(400).json({ error: `Template for ${carrier} not found.` });
    }
    const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));

    // 2. Find where the requested status is in our event list
    const startIndex = template.data.events.findIndex(e => e.status_code === status);
    if (startIndex === -1) {
        return res.status(400).json({ error: `Status ${status} not found for ${carrier}.` });
    }

    // 3. Slice history (Show only events up to the chosen status)
    const historyEvents = template.data.events.slice(startIndex);
    const now = new Date();
    const mostRecentOffset = historyEvents[0].hour_offset;

    // 4. Process individual events (Inject timestamps & keep metadata)
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

    // 5. Date Logic: Ship Date & Estimated vs Actual Delivery
    const isDelivered = (status === 'DE');
    
    // Calculate Ship Date (Looking for the 'AC' event)
    const shipEvent = template.data.events.find(e => e.status_code === 'AC') || historyEvents[historyEvents.length - 1];
    const shipHoursDiff = Math.abs(shipEvent.hour_offset - mostRecentOffset);
    const shipDate = subHours(now, shipHoursDiff);

    // If not delivered, set estimate to 24 hours in the future
    const estimatedDelivery = !isDelivered ? subHours(now, -24) : null;

    // 6. Final Payload Assembly
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

    // 7. Push Webhook with ShipEngine Signature Headers
    try {
        console.log(`\n--- Sending Webhook ---`);
        console.log(`Target: ${target_url} | Status: ${status}`);
        
        await axios.post(target_url, finalPayload, {
            timeout: 5000,
            headers: {
                'Content-Type': 'application/json',
                'x-shipengine-rsa-sha256-key-id': 'simulated-key-123',
                'x-shipengine-rsa-sha256-signature': 'simulated-signature-v1',
                'x-shipengine-timestamp': formatISO(now)
            }
        });

        console.log(`✅ Webhook Delivered Successfully`);
        res.status(200).json({ message: "Simulation Successful", sent_payload: finalPayload });
    } catch (error) {
        console.error(`❌ Webhook Failed: ${error.message}`);
        res.status(500).json({ error: "Delivery failed", details: error.message });
    }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Simulator active at http://localhost:${PORT}`));
