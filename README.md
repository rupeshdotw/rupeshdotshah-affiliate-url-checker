# 🎯 Affiliate URL Resolver

<div align="center">

![Node.js Version](https://img.shields.io/badge/node-%3E%3D%2014.0.0-green.svg)
![Express Version](https://img.shields.io/badge/express-%5E4.18.2-lightgrey)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)

A powerful and efficient URL resolution service that tracks campaign parameters, handles complex redirects, and validates marketing URLs.

[Key Features](#key-features) •
[Installation](#installation) •
[Usage](#usage) •
[API Reference](#api-reference) •
[Deployment](#deployment)

</div>

## 🚀 Key Features

- ⚡ **Lightning Fast Resolution**: Primary resolution in under 1 second
- 🔄 **Smart Fallback System**: Multi-tiered approach for handling complex redirects
- 🔍 **Parameter Detection**: Tracks url parameters like : `clickid`, `utm_source`, `im_ref`, and `clickref`
- 🌐 **Browser Emulation**: Uses Puppeteer for JavaScript-heavy redirects
- 📊 **Detailed Response**: Complete redirect chain and parameter analysis
- 🛡️ **Robust Error Handling**: Comprehensive error catching and timeout protection

### 📁 Import/Export Capabilities
- 📥 **Import Support**:
  - CSV file import
  - XLSX file import
  - Drag & drop file support
  - Smart column detection
  - Batch processing
- 📤 **Export Options**:
  - Export to CSV
  - Complete campaign history
  - Formatted date and time

### 🌍 Location Detection
- 🔍 **Auto-Detection**: Automatic country detection
- 🔄 **Multiple Services**: Fallback to multiple geolocation services
- 🚥 **Status Indicators**: Visual feedback for detection process
- 🔄 **Manual Refresh**: Option to refresh location detection

### 🔍 Search & Filter
- 🔎 **Real-time Search**: Instant search across all fields
- 📅 **Date Range Filter**: 
  - Built-in date range picker
  - Clear filter option
  - Support for custom date formats
- 📊 **Sorting Options**:
  - Sort by newest/oldest
  - Persistent sorting preferences

### 🔄 URL Refresh Features
- 🔄 **Individual Refresh**: Refresh single URLs
- 📊 **Batch Refresh**: Refresh all URLs with progress tracking
- ⚠️ **Error Handling**: 
  - Automatic retry mechanism
  - Error status indicators
  - Restore previous URL on failure
- 📈 **Progress Tracking**: Visual progress indicators

### 💫 Additional Features
- 📋 **Clipboard Support**: One-click URL copying
- ✏️ **Inline Editing**: Edit campaign URLs and tags directly
- 🗑️ **Data Management**: Delete individual or all campaigns
- 📱 **Responsive Design**: Works on desktop and mobile
- 🔔 **Notifications**: Beautiful toast notifications for all actions

## 🛠️ Installation

1. **Clone the repository**
```bash
git clone https://github.com/rupeshdotw/rupeshdotshah-affiliate-url-checker.git
cd rupeshdotshah-affiliate-url-checker
```

2. **Install dependencies**
```bash
npm install
```

3. **Start the server**
```bash
# Development mode
npm run dev

# Production mode
npm start
```

## 💻 Usage

The server provides multiple endpoints for URL resolution with different levels of depth and speed:

### Quick Resolution
```bash
curl "http://localhost:8080/resolve-fast?url=https://your-campaign-url.com"
```

### Deep Resolution
```bash
curl "http://localhost:8080/resolve?url=https://your-campaign-url.com"
```

### Sample Response
```json
{
  "originalUrl": "https://your-campaign-url.com",
  "finalUrl": "https://final-destination.com?clickid=123&utm_source=campaign",
  "method": "puppeteer-standard",
  "hasClickId": true,
  "hasUtmSource": true,
  "hasClickRef": false
}
```

## 📚 API Reference

### Endpoints

#### `GET /resolve-fast`
- **Purpose**: Quick URL resolution (< 1 second)
- **Parameters**: `url` (required) - URL to resolve
- **Response Time**: ~1 second
- **Best For**: Simple redirects and immediate parameter checking

#### `GET /resolve`
- **Purpose**: Complete URL resolution with fallbacks
- **Parameters**: `url` (required) - URL to resolve
- **Response Time**: 2-20 seconds
- **Best For**: Complex redirects and thorough parameter tracking

#### `GET /health`
- **Purpose**: Service health check
- **Response**: Service status and available methods

## 🌟 Advanced Features

- **Timeout Protection**: Automatic request termination after specified duration
- **Resource Optimization**: Selective resource loading in Puppeteer
- **User-Agent Simulation**: Browser-like request headers
- **Redirect Chain Tracking**: Complete history of URL redirections

## 🚀 Deployment

### Prerequisites
- Node.js >= 14.0.0
- NPM or Yarn
- 512MB RAM minimum

### Environment Variables
```env
PORT=8080  # Server port (optional)
```

### Deployment Platforms
- 🌐 Any Node.js compatible hosting

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Puppeteer](https://pptr.dev/) for headless browser automation
- [Express.js](https://expressjs.com/) for the web framework
- [node-fetch](https://github.com/node-fetch/node-fetch) for HTTP requests

---

<div align="center">

Made with ❤️ by Rupesh Shah ![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)

</div>

![Screenshot 2025-06-04 at 4 33 54 PM](https://github.com/user-attachments/assets/d52e19e1-4174-47bf-bf12-55f5e9b9ca5c)
