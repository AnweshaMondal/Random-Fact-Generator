# 🧠 Random Fact Generator API

> A production-ready, AI-powered API that delivers fascinating, verified random facts across multiple categories with enterprise-grade reliability.

[![API Status](https://img.shields.io/badge/Status-Production_Ready-brightgreen)](https://api.randomfacts.com)
[![Version](https://img.shields.io/badge/Version-v1.0.0-blue)](https://github.com/AnweshaMondal/Random-Fact-Generator)
[![License](https://img.shields.io/badge/License-MIT-lightgrey)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green)](https://nodejs.org)
[![MongoDB](https://img.shields.io/badge/MongoDB-7+-green)](https://mongodb.com)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue)](https://docker.com)

---

## 🌟 Features

### � **Core Capabilities**
- **Verified Data**: Every fact is cross-referenced and verified for accuracy
- **12 Categories**: Science, History, Technology, Nature, Space, Animals, Geography, Sports, Entertainment, Health, Food, General
- **AI Integration**: GitHub Models integration for dynamic fact generation and content moderation
- **High Performance**: Redis caching, connection pooling, and optimized queries
- **Production Ready**: Docker support, health checks, monitoring, and graceful shutdowns

### 🤖 **AI-Powered Features**
- **Dynamic Fact Generation**: AI fallback when database facts are exhausted
- **Content Moderation**: Automated content filtering and quality assurance
- **Smart Caching**: Intelligent cache invalidation and refresh strategies
- **Bulk Operations**: AI-assisted batch fact generation and processing

### 🚀 **Enterprise Features**
- **API Key Management**: Comprehensive authentication and authorization
- **Rate Limiting**: Flexible, tier-based request limiting
- **Usage Analytics**: Detailed tracking and reporting
- **Multi-tier Subscriptions**: Basic, Premium, and Platinum plans
- **Swagger Documentation**: Interactive API documentation
- **Health Monitoring**: Comprehensive health checks and alerting

---

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Client Apps   │────│   API Gateway   │────│  Load Balancer  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                               │
                   ┌───────────┼───────────┐
                   │                       │
         ┌─────────────────┐    ┌─────────────────┐
         │   Fact Service  │    │   AI Service    │
         └─────────────────┘    └─────────────────┘
                   │                       │
         ┌─────────────────┐    ┌─────────────────┐
         │    MongoDB      │    │  GitHub Models  │
         └─────────────────┘    └─────────────────┘
                   │
         ┌─────────────────┐
         │     Redis       │
         └─────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MongoDB 7+
- Redis 7+
- Docker (optional but recommended)

### 1. Clone & Install

```bash
git clone https://github.com/AnweshaMondal/Random-Fact-Generator.git
cd Random-Fact-Generator/random-fact-generator
npm install
```

### 2. Environment Setup

```bash
cp .env.example .env
# Edit .env with your configuration
```

**Required Environment Variables:**
```bash
MONGODB_URI=mongodb://localhost:27017/random-fact-generator
JWT_SECRET=your_super_secret_jwt_key_here
GITHUB_TOKEN=your_github_token_here
```

### 3. Database Setup

```bash
# Seed initial facts
npm run seed

# Or manually start MongoDB and run:
node src/utils/seedData.js
```

### 4. Start the Server

```bash
# Development
npm run dev

# Production
npm start
```

### 5. Verify Installation

```bash
# Health check
curl http://localhost:3000/health

# Get a random fact
curl -H "X-API-KEY: your_api_key" http://localhost:3000/api/v1/facts/random
```

---

## 🐋 Docker Deployment

### Quick Start with Docker Compose

```bash
# Development environment
docker-compose up -d

# Production environment with monitoring
docker-compose --profile production up -d

# Development with debug tools
docker-compose --profile debug up -d
```

### Environment Configuration

Create a `.env` file:
```bash
NODE_ENV=production
JWT_SECRET=your_super_secret_jwt_key
GITHUB_TOKEN=your_github_token
MONGO_ROOT_USER=admin
MONGO_ROOT_PASSWORD=secure_password
```

---

## 📖 API Documentation

### 🔐 Authentication

All endpoints require an API key passed in the `X-API-KEY` header:

```bash
curl -H "X-API-KEY: your_api_key" https://api.randomfacts.com/v1/facts/random
```

### 📊 Core Endpoints

#### Get Random Fact
```http
GET /api/v1/facts/random
```

**Query Parameters:**
- `category` (optional): Filter by category
- `ai_fallback` (optional): Enable AI fallback

**Response:**
```json
{
  "status": "success",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "fact": "Octopuses have three hearts and blue blood.",
    "category": "animals",
    "source": "Smithsonian",
    "verified": true,
    "tags": ["octopus", "anatomy", "marine biology"],
    "view_count": 1247,
    "likes": 89,
    "created_at": "2024-01-15T10:30:00Z"
  },
  "meta": {
    "response_time": 45,
    "source": "database"
  }
}
```

#### Get Fact by Category
```http
GET /api/v1/facts/category/{category}
```

#### Search Facts
```http
GET /api/v1/facts/search?q=ocean&category=animals&page=1&limit=10
```

#### AI Fact Generation (Premium)
```http
POST /api/v1/ai/generate/fact
Content-Type: application/json

{
  "category": "science",
  "specific_request": "quantum physics",
  "temperature": 0.8
}
```

### 📋 Available Categories

- `science` - Physics, Chemistry, Biology
- `history` - Historical events and figures
- `technology` - Tech innovations and discoveries
- `nature` - Natural phenomena and ecology
- `space` - Astronomy and space exploration
- `animals` - Animal behavior and biology
- `geography` - Earth sciences and locations
- `sports` - Athletic achievements and records
- `entertainment` - Movies, music, and culture
- `health` - Medical and wellness facts
- `food` - Culinary science and nutrition
- `general` - Miscellaneous interesting facts

---

## 💰 Pricing & Plans

| Plan | Monthly Requests | Price | Features |
|------|------------------|-------|----------|
| **Basic** | 1,000 | **FREE** | Core categories, community support |
| **Premium** | 100,000 | **$10/month** | All categories, AI features, priority support |
| **Platinum** | **Unlimited** | **$50/month** | Everything + dedicated support, early access |

### Enterprise Features (Platinum)
- ✅ Custom fact categories
- ✅ Bulk operations (up to 1000 facts)
- ✅ Advanced analytics and reporting
- ✅ SLA guarantees (99.9% uptime)
- ✅ Dedicated technical support
- ✅ Custom integrations

---

## 🛠️ Development

### Project Structure

```
random-fact-generator/
├── src/
│   ├── config/          # Database and service configurations
│   ├── controllers/     # Request handlers
│   ├── middleware/      # Authentication, validation, rate limiting
│   ├── models/          # Database schemas
│   ├── routes/          # API route definitions
│   ├── services/        # Business logic and external integrations
│   └── utils/           # Utilities and helpers
├── data/                # Initial dataset and migrations
├── tests/               # Unit and integration tests
├── docs/                # Additional documentation
├── docker-compose.yml   # Docker orchestration
└── Dockerfile          # Container definition
```

### Available Scripts

```bash
npm run dev          # Start development server with hot reload
npm start            # Start production server
npm test             # Run test suite
npm run test:watch   # Run tests in watch mode
npm run lint         # Run ESLint
npm run seed         # Seed database with initial facts
npm run health       # Run health checks
```

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `NODE_ENV` | Environment mode | No | `development` |
| `PORT` | Server port | No | `3000` |
| `MONGODB_URI` | MongoDB connection string | Yes | - |
| `REDIS_HOST` | Redis host | No | `localhost` |
| `JWT_SECRET` | JWT signing secret | Yes | - |
| `GITHUB_TOKEN` | GitHub Models API token | Yes | - |
| `AI_FACT_GENERATION_ENABLED` | Enable AI features | No | `true` |

---

## 🧪 Testing

### Run Tests

```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# With coverage
npm run test:coverage
```

### API Testing

```bash
# Test API endpoints
curl -H "X-API-KEY: test_key" http://localhost:3000/api/v1/facts/random

# Health check
curl http://localhost:3000/health

# API documentation
open http://localhost:3000/api-docs
```

---

## 📊 Monitoring & Analytics

### Health Checks

```bash
# Comprehensive health check
node src/utils/healthCheck.js

# JSON output for monitoring
node src/utils/healthCheck.js --json
```

### Metrics & Logging

- **Winston Logger**: Structured logging with multiple transports
- **Request Tracking**: Detailed request/response logging
- **Performance Metrics**: Response time and throughput monitoring
- **Error Tracking**: Comprehensive error logging and alerting

### Monitoring Endpoints

- `/health` - Basic health status
- `/api/v1/facts/stats` - Fact database statistics
- `/api/v1/ai/stats` - AI service usage statistics

---

## 🔧 Production Deployment

### Docker Production

```bash
# Build production image
docker build --target production -t rfg-api .

# Deploy with compose
docker-compose --profile production up -d
```

### Environment Checklist

- [ ] Set strong `JWT_SECRET`
- [ ] Configure `GITHUB_TOKEN` with appropriate permissions
- [ ] Set up MongoDB with authentication
- [ ] Configure Redis password
- [ ] Set up SSL certificates (if using HTTPS)
- [ ] Configure log rotation
- [ ] Set up monitoring and alerting

### Scaling Considerations

- **Horizontal Scaling**: Multiple API instances behind load balancer
- **Database Sharding**: MongoDB sharding for large datasets
- **Caching Strategy**: Redis clustering for high availability
- **CDN Integration**: Edge caching for global distribution

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and add tests
4. Run tests: `npm test`
5. Commit changes: `git commit -m 'Add amazing feature'`
6. Push to branch: `git push origin feature/amazing-feature`
7. Submit a Pull Request

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **GitHub Models** for AI integration
- **MongoDB** for database excellence
- **Redis** for caching performance
- **Node.js Community** for the amazing ecosystem

---

## 📞 Support

- **Documentation**: [https://docs.randomfacts.com](https://docs.randomfacts.com)
- **API Reference**: [https://api.randomfacts.com/api-docs](https://api.randomfacts.com/api-docs)
- **Issues**: [GitHub Issues](https://github.com/AnweshaMondal/Random-Fact-Generator/issues)
- **Email**: support@randomfacts.com

---

<div align="center">

**[Website](https://randomfacts.com) • [Documentation](https://docs.randomfacts.com) • [API Reference](https://api.randomfacts.com/api-docs) • [GitHub](https://github.com/AnweshaMondal/Random-Fact-Generator)**

Made with ❤️ by [AnweshaMondal](https://github.com/AnweshaMondal)

</div>

### 3. Fetch a Fact by Category

You can get a random fact from a specific category by adding it to the endpoint.

**Endpoint:** `https://api.your-domain.com/v1/fact/{category}`

**Example cURL Request (History):**

curl --request GET \
     --url https://api.your-domain.com/v1/fact/history \
     --header 'X-API-KEY: YOUR_API_KEY'

-----

## 💰 Pricing Plans

Our API is priced on a per-request basis, with generous monthly limits for each tier. Choose the plan that best fits your needs.

| Plan | Monthly Requests | Price | Features |
| :--- | :--- | :--- | :--- |
| **Basic** | 1,000 | **FREE** | Access to core categories, community support. Perfect for hobby projects and testing. |
| **Premium** | 100,000 | `$10 / month` | All Basic features, access to *all* categories, priority email support. Ideal for growing applications. |
| **Platinum** | **UNLIMITED** | `$50 / month` | All Premium features, highest-tier performance, dedicated support, and early access to new features. For enterprise-level applications. |

*Overage charges may apply for Premium and Platinum plans if you exceed the monthly limit without upgrading your plan. All billing is handled securely via Stripe.*

-----

## 📄 Documentation & Support

  * **Full API Reference:** [Link to your Swagger/OpenAPI docs]
  * **Contact Us:** For support or inquiries, please contact support@your-domain.com.

-----

### 🛣️ Roadmap

  * **Q3 2025:** Implement new API endpoints, including `/api/v1/fact/search` for keyword-based fact retrieval.
  * **Q4 2025:** Introduce localization and internationalization for facts in multiple languages.
  * **H1 2026:** Develop a user-generated content platform where users can submit and vote on facts.

-----

This comprehensive plan provides a solid foundation for building and monetizing your Random Fact Generator API. Good luck with the project!