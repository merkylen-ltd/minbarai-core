# MinbarAI - Live Multi-Language Translation SaaS

A professional SaaS application for live multi-language translation, built with Next.js 14, Supabase, and Stripe. Deployed on Google Cloud Run for ultra-low latency performance.

## Features

- 🎤 **Live Audio Capture**: Real-time multi-language speech recognition via VoiceFlow
- 🔄 **AI Translation**: Powered by Voiceflow WS (server-side LLM translation)
- 💳 **Subscription Management**: €99/month with Stripe integration
- 🔐 **Secure Authentication**: Supabase Auth with row-level security
- 📱 **Responsive Design**: Works on desktop and mobile
- 🌙 **Dark Mode**: Professional viewer interface with theme switching
- 📊 **Dashboard**: Complete management interface for users
- 🔒 **Protected Routes**: Middleware-based authentication
- 📄 **Session Recording**: Download transcripts and manage sessions
- ⚡ **Ultra-Low Latency**: Deployed on Google Cloud Run for optimal performance

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, TailwindCSS
- **Backend**: Next.js API Routes, Server Actions
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Payments**: Stripe
- **AI**: Voiceflow WS translation
- **Speech Recognition**: VoiceFlow WebSocket API
- **Deployment**: Google Cloud Run
- **Containerization**: Docker
- **Secrets Management**: Google Secret Manager

## Quick Start

### 1. Clone and Install

\`\`\`bash
git clone <repository-url>
cd MinbarAI-main
npm install
\`\`\`

### 2. Environment Variables

Copy \`env.example\` to \`.env.local\` and fill in your credentials:

\`\`\`bash
cp env.example .env.local
\`\`\`

Required environment variables:

\`\`\`env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Stripe
STRIPE_SECRET_KEY=your_stripe_secret_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
NEXT_PUBLIC_STRIPE_PRICE_ID=price_1SB0jD484U6B4yaGMAb6nlZ8

# AI - Translation handled via Voiceflow WS (no Gemini key required)

# VoiceFlow Speech Recognition
NEXT_PUBLIC_VOICEFLOW_WS_URL=wss://voiceflow-relay-e5l6mfznxq-ey.a.run.app
NEXT_PUBLIC_VOICEFLOW_WS_URL_PROD=wss://voiceflow-relay-e5l6mfznxq-ey.a.run.app
NEXT_PUBLIC_VOICEFLOW_WS_TOKEN=your_voiceflow_websocket_token

# App URLs
NEXT_PUBLIC_SITE_URL=http://localhost:3000
\`\`\`

### 3. Database Setup

1. Create a new Supabase project
2. Run the SQL schema from \`database.sql\` in your Supabase SQL editor
3. Enable Row Level Security policies

### 4. Test VoiceFlow Connection

Test the VoiceFlow WebSocket connection:

```bash
node scripts/test-voiceflow-connection.js
```

### 5. Stripe Setup

1. Create a Stripe account
2. Set up a product with €99/month pricing
3. Configure webhooks endpoint: \`https://minbarai.com/api/stripe/webhooks\`
4. Add webhook events: \`customer.subscription.*\`, \`invoice.payment_*\`

### 5. Seed Database (Optional)

For development and testing, you can seed the database with a test user:

\`\`\`bash
# Using the shell script (recommended)
./seed.sh

# Or using npm scripts
npm run seed

# Clean up test data when done
npm run seed:cleanup
\`\`\`

This creates a test user with unlimited plan access:
- **Email**: \`test@minbarai.com\`
- **Password**: \`M4qR$tY8uI1oP6sA\`
- **Plan**: Unlimited (Active)

See [SEED_README.md](SEED_README.md) for detailed information about the seed scripts.

### 6. Run Development Server

\`\`\`bash
npm run dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Deployment

### Google Cloud Run Deployment

This application is optimized for deployment on Google Cloud Run with two environments:

- **Production**: Always-on scaling (min-instances=1) for ultra-low latency
- **Development**: Scale-to-zero for cost optimization

#### Prerequisites

1. **Google Cloud Project**: Create a project and enable required APIs
2. **Service Account**: Create a service account with appropriate permissions
3. **Docker**: Install Docker for building container images
4. **gcloud CLI**: Install and authenticate with Google Cloud

#### Required APIs

Enable these APIs in your Google Cloud project:

```bash
gcloud services enable run.googleapis.com
gcloud services enable secretmanager.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable containerregistry.googleapis.com
```

#### Service Account Permissions

Your service account needs these IAM roles:

- Cloud Run Admin
- Service Account User
- Secret Manager Secret Accessor
- Storage Admin (for Container Registry)
- Cloud Build Editor (optional, for CI/CD)

#### Quick Deployment

1. **Set up secrets**:
   ```bash
   ./setup-secrets.sh
   ```

2. **Deploy to production**:
   ```bash
   ./deploy-pro.sh
   ```

3. **Deploy to development**:
   ```bash
   ./deploy-dev.sh
   ```

#### Manual Deployment Steps

1. **Configure gcloud**:
   ```bash
   gcloud config set project YOUR_PROJECT_ID
   gcloud auth configure-docker
   ```

2. **Build and push Docker image**:
   ```bash
   docker build -t gcr.io/YOUR_PROJECT_ID/minberai:latest .
   docker push gcr.io/YOUR_PROJECT_ID/minberai:latest
   ```

3. **Deploy to Cloud Run**:
   ```bash
   gcloud run deploy minberai-pro \
     --image gcr.io/YOUR_PROJECT_ID/minberai:latest \
     --platform managed \
     --region europe-west3 \
     --allow-unauthenticated \
     --port 8080 \
     --memory 2Gi \
     --cpu 2 \
     --min-instances 1 \
     --max-instances 50
   ```

#### Environment Variables

The deployment scripts automatically configure:

**Public Variables** (set directly):
- \`NEXT_PUBLIC_SUPABASE_URL\`
- \`NEXT_PUBLIC_SUPABASE_ANON_KEY\`
- \`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY\`
- \`NEXT_PUBLIC_STRIPE_PRICE_ID\`
- \`NEXT_PUBLIC_VOICEFLOW_WS_URL\`
- \`NEXT_PUBLIC_VOICEFLOW_WS_TOKEN\`
- \`NEXT_PUBLIC_SITE_URL\`

**Secret Variables** (stored in Secret Manager):
- \`STRIPE_SECRET_KEY\`
- \`STRIPE_WEBHOOK_SECRET\`
- \`SUPABASE_SERVICE_ROLE_KEY\`

#### Custom Domain Setup

For production deployment, the script automatically maps your custom domain:

```bash
gcloud run domain-mappings create \
  --service minberai-pro \
  --domain minbarai.com \
  --region europe-west3
```

Update your DNS records to point to the provided CNAME target.

#### Stripe Webhook Registration

Webhooks are automatically registered during deployment:

- **Production**: \`https://minbarai.com/api/stripe/webhooks\`
- **Development**: \`https://minbarai-dev-xxxxx.run.app/api/stripe/webhooks\`

#### CI/CD with Cloud Build

Use the included \`cloudbuild.yaml\` for automated deployments:

```bash
gcloud builds triggers create github \
  --repo-name=MinberAI-core \
  --repo-owner=your-github-username \
  --branch-pattern="^main$" \
  --build-config=cloudbuild.yaml
```

## Project Structure

\`\`\`
MinberAI-core/
├── app/                    # Next.js App Router
│   ├── auth/              # Authentication pages
│   ├── dashboard/         # Protected dashboard
│   ├── api/               # API routes
│   │   └── health/        # Health check endpoint
│   └── subscribe/         # Subscription page
├── components/            # React components
│   ├── ui/               # Base UI components
│   └── dashboard/        # Dashboard-specific components
├── lib/                  # Utility libraries
│   ├── supabase/         # Supabase client configuration
│   └── stripe/           # Stripe configuration
├── types/                # TypeScript type definitions
├── utils/                # Utility functions
├── supabase/             # Database schema
│   └── database.sql      # Database schema
├── scripts/              # Deployment and utility scripts
├── Dockerfile            # Docker configuration
├── .dockerignore         # Docker ignore file
├── .gcloudignore         # Google Cloud ignore file
├── cloudbuild.yaml       # Cloud Build CI/CD configuration
├── deploy-pro.sh         # Production deployment script
├── deploy-dev.sh         # Development deployment script
├── setup-secrets.sh      # Secret Manager setup script
├── register-stripe-webhooks.sh # Stripe webhook registration
└── middleware.ts         # Authentication middleware
\`\`\`

## Usage

### For End Users

1. **Sign Up**: Create an account and subscribe to the €99/month plan
2. **Dashboard**: Access the live translation dashboard
3. **Start Recording**: Click "Start Recording" to begin Arabic speech recognition
4. **View Translations**: Watch real-time German translations appear
6. **Download**: Save session transcripts as text files

### For Developers

The application provides several key components:

- **Authentication Flow**: Complete sign-up/sign-in with email verification
- **Subscription Management**: Stripe integration with webhook handling
- **Live Translation Engine**: Speech recognition + AI translation pipeline
- **Professional Viewer**: Separate window for clean presentation display
- **Session Management**: Save and retrieve translation sessions

## Browser Requirements

- **Chrome/Edge**: Required for speech recognition API
- **Microphone Access**: Users must grant microphone permissions
- **Modern Browser**: ES2020+ support required

## Development

### Local Development

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment**:
   ```bash
   cp env.example .env.local
   # Edit .env.local with your values
   ```

3. **Run development server**:
   ```bash
   npm run dev
   ```

### Docker Development

```bash
# Build Docker image
npm run docker:build

# Run locally
npm run docker:run
```

### Available Scripts

- \`npm run dev\` - Start development server
- \`npm run build\` - Build for production
- \`npm run start\` - Start production server
- \`npm run lint\` - Run ESLint
- \`npm run type-check\` - Run TypeScript checks
- \`npm run docker:build\` - Build Docker image
- \`npm run docker:run\` - Run Docker container
- \`npm run deploy:setup\` - Set up Google Secret Manager
- \`npm run deploy:pro\` - Deploy to production
- \`npm run deploy:dev\` - Deploy to development
- \`npm run webhooks:register\` - Register Stripe webhooks
- \`npm run gcloud:auth\` - Authenticate with Google Cloud

## Monitoring

### Health Checks

The application includes a health check endpoint at \`/api/health\` that returns:

- Service status
- Memory usage
- Uptime
- Environment information

### Logs

View Cloud Run logs:

```bash
gcloud logs read --service=minberai-pro --region=europe-west3 --limit=50
```

### Metrics

Monitor your deployment in the Google Cloud Console:
- [Cloud Run Metrics](https://console.cloud.google.com/run)
- [Secret Manager](https://console.cloud.google.com/security/secret-manager)
- [Container Registry](https://console.cloud.google.com/gcr)

## Support

For technical support or questions:
- Email: support@minberai.com
- Documentation: [Your documentation URL]

## License

[Your License]

---

Built with ❤️ using Next.js, Supabase, Voiceflow, and Google Cloud Run



ewuuJ$MLe3Zm4&n


 Email: tawba@minbarai.com
   Password: 1f6b4KeXE8ho