# ShipStation V2 Tracking Webhook Simulator 📦

A lightweight Node.js utility designed to simulate high-fidelity ShipStation V2 tracking webhooks. This tool allows developers to test tracking integrations for **FedEx, UPS, and USPS** without needing real-world tracking numbers or carrier API credentials.

## 🚀 Features
- **Multi-Carrier Support**: Pre-configured templates for FedEx, UPS, and USPS using authentic carrier event codes.
- **Dynamic Time-Travel**: Automatically calculates `occurred_at` and `carrier_occurred_at` timestamps based on relative offsets to simulate a multi-day journey.
- **Web Dashboard**: A built-in UI to trigger simulations, customize tracking numbers, and select statuses (Accepted, In Transit, Exception, Delivered).
- **Activity Log**: Real-time history of fired webhooks directly on the dashboard.
- **Security Ready**: Includes simulated ShipEngine HMAC/RSA headers for signature verification testing.

## 🛠️ Installation

1. **Clone the repository:**
   ```bash
   git clone <your-repo-url>
   cd shipstation-api-tracking-simulator

2. Install dependencies
   npm install

3. Start the simulator
   npm run dev

4. Access the Dashboard
   Open http://localhost:3000 in your browser

## Usage

1. Enter your webhook URL
2. Enter a tracking number
3. Select the carrier and desired status
4. Click Fire Webhook
5. Check your endpoint to see the incoming JSON payload

## Project Stucture
- /payloads : JSON templates containing carrier specific event logic
- /public : Frontend assets for the web dashboard
- index.js : The core express server and simulation engine

## License

MIT
