# Barbell Tracker

A comprehensive system for tracking and analyzing barbell movements using an M5StickC Plus2.

## Project Structure

- `embedded/` - M5StickC Plus2 firmware
- `web-client/` - Web-based visualization and control
- `mobile-app/` - Native mobile application (planned)
- `analysis/` - Data analysis and machine learning
- `docs/` - Project documentation

## Getting Started

### Prerequisites

- PlatformIO for firmware development
- Node.js for web client
- Python 3.8+ for analysis
- Android Studio for mobile app (if needed)

### Setup Instructions

1. Firmware
```bash
cd firmware
pio run
```

2. Web Client
```bash
cd web-client
npm install
npm start
```

3. Analysis
```bash
cd analysis
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install -r requirements.txt
```

## Development

Each component can be developed independently:

- Firmware: Use PlatformIO in VS Code
- Web Client: Standard React development flow
- Analysis: Jupyter notebooks and Python scripts

## Testing

Run tests for each component:

```bash
# Embedded
cd embedded && pio test

# Web Client
cd web-client && npm test

# Analysis
cd analysis && pytest
```

## License

None yet