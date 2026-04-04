# ShipStation V2 Webhook Simulator (Web Edition) 🚀

A browser-based utility designed to simulate high-fidelity **ShipStation V2** tracking webhooks. This tool allows developers to test tracking integrations for **FedEx, UPS, and USPS** directly from their browser without a local server.

## 🌐 Live Access
**URL:** [https://pmcgee-personal.github.io/shipstation-v2-webhook-simulator/](https://pmcgee-personal.github.io/shipstation-v2-webhook-simulator/)

📱 Mobile Installation (PWA)
This simulator is a Progressive Web App, meaning you can install it on your phone's home screen without using an App Store:

iOS (Safari): Tap the Share icon (square with up arrow) and select "Add to Home Screen."

Android (Chrome): Tap the three dots in the top right and select "Install app" or "Add to Home screen."

Desktop: Click the Install icon in the address bar of Chrome or Edge to run it as a standalone window.
## ⚡ Quick Start
1. **Enable CORS Access:** Because this tool runs in the browser, you must visit [CORS Anywhere](https://cors-anywhere.herokuapp.com/corsdemo) and click **"Request temporary access"** to allow the simulator to send requests to your webhook URL.
2. **Enter Target:** Paste your Webhook.site or API endpoint URL.
3. **Configure:** Choose your carrier, tracking number, and desired status.
4. **Fire Webhook:** Click the button and check your endpoint for the incoming JSON.

## 🛠️ Features
- **Zero Installation**: Runs entirely in the browser via GitHub Pages.
- **Dynamic Payloads**: Generates V2 schemas with carrier-specific logic for `stamps_com`, `ups`, and `fedex`.
- **Smart Logic**: 
    - **Signer**: Automatically populates "Authorized Receiver" only for `Delivered` events.
    - **Status Descriptions**: Dynamically maps "Accepted", "In Transit", "Delivered", and "Exception".
    - **Carrier URLs**: Generates authentic tracking links specific to the selected carrier.
- **Security Headers**: Includes simulated `x-shipengine` HMAC/RSA headers for signature verification testing.
- **Offline Ready (Basic)**: Includes a Service Worker (sw.js) to meet PWA installation requirements.
- **App Manifest**: Configured with a manifest.json for a native look and feel, including a custom app icon and theme colors.
- **Mobile Optimized**: Uses a specific viewport meta-tag to prevent accidental zooming on mobile inputs.

## 📋 Requirement: CORS Anywhere
To prevent "Cross-Origin" security blocks in your browser, this tool uses a proxy. If your webhooks aren't firing, ensure you have an active session at:
`https://cors-anywhere.herokuapp.com/corsdemo`

## 📂 Project Structure
- `index.html`: The monolithic frontend containing the UI, CSS, and simulation logic.
- `gh-pages` branch: The primary branch used for deployment.

## License
MIT
