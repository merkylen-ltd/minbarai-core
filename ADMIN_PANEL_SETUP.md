# Admin Panel Setup Guide

## Overview

The MinbarAI Admin Panel is a comprehensive control panel for managing users, subscriptions, payments, and monitoring system health. This guide will walk you through the setup and configuration process.

## Features Implemented

### ✅ Authentication & Authorization
- Email whitelist-based admin access
- Middleware protection for all admin routes
- Automatic redirect for non-admin users

### ✅ Dashboard
- Real-time metrics (Total Users, Active Subscriptions, MRR, Active Sessions)
- Signup trend chart (last 30 days)
- Session status overview with realtime updates
- New signups breakdown (today, this week, this month)

### ✅ User Management
- User list with search and pagination
- User detail pages with subscription info and session history
- Actions: Suspend, Activate, Reset Password, View Sessions

### ✅ Subscription Management
- List all subscriptions with filters
- Hybrid approach: Database + Stripe API enrichment
- Actions: Extend, Cancel, Reactivate subscriptions

### ✅ Payment Monitoring
- Webhook health status with success rate
- Failed payments list with error details
- Recent payment events log

### ✅ System Health
- Multi-service health checks (Supabase, Stripe, Voiceflow, Gemini)
- Auto-refresh every 30 seconds
- Response time monitoring

### ✅ Quick Actions
- Send email to users with custom templates
- Manual Stripe sync (future enhancement)
- View user session history

### ✅ Realtime Features
- Active sessions counter updates every 5 seconds via SSE
- Session status breakdown (active, capped, expired)

## Setup Instructions

### 1. Environment Variables

Add the following variables to your `.env.local` file:

```bash
# Admin Configuration (REQUIRED)
ADMIN_EMAILS=your-admin-email@example.com,another-admin@example.com

# Email Service (Resend) - REQUIRED for email features
RESEND_API_KEY=re_your_api_key_here
RESEND_FROM_EMAIL=noreply@minbarai.com

# Existing variables (should already be configured)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
STRIPE_SECRET_KEY=your_stripe_secret_key
```

### 2. Resend Email Service Setup

1. Sign up for a free Resend account at https://resend.com
2. Verify your domain or use their test domain
3. Create an API key in the Resend dashboard
4. Add the API key to your `.env.local` as `RESEND_API_KEY`
5. Set `RESEND_FROM_EMAIL` to your verified email address

### 3. Grant Admin Access

To grant admin access to a user:

1. Add their email to the `ADMIN_EMAILS` environment variable (comma-separated list)
2. Restart your development server
3. The user can now access `/admin` after signing in

Example:
```bash
ADMIN_EMAILS=admin@minbarai.com,manager@minbarai.com
```

### 4. Access the Admin Panel

1. Start your development server: `npm run dev`
2. Sign in with an admin email
3. Navigate to `/admin`
4. You should see the admin dashboard

## Architecture

### File Structure

```
app/
├── admin/
│   ├── layout.tsx              # Admin layout with sidebar and header
│   ├── page.tsx                # Dashboard with metrics and charts
│   ├── users/
│   │   ├── page.tsx            # User list
│   │   └── [id]/page.tsx       # User details
│   ├── subscriptions/page.tsx  # Subscription overview
│   ├── payments/page.tsx       # Payment issues
│   ├── health/page.tsx         # System health
│   └── actions/page.tsx        # Quick actions
├── api/admin/
│   ├── users/                  # User management APIs
│   ├── subscriptions/          # Subscription APIs
│   ├── analytics/              # Analytics APIs
│   ├── payments/               # Payment APIs
│   ├── health/                 # Health check APIs
│   ├── actions/                # Quick action APIs
│   └── realtime/               # SSE endpoints
components/admin/
├── AdminSidebar.tsx            # Navigation sidebar
├── AdminHeader.tsx             # Header with user info
├── MetricCard.tsx              # Dashboard metric cards
└── StatusBadge.tsx             # Subscription status badges
lib/
├── auth/admin.ts               # Admin auth utilities
├── email/
│   ├── resend.ts               # Email service
│   └── templates/              # Email templates
└── supabase/admin.ts           # Admin Supabase client
```

### Security Features

1. **Email Whitelist**: Only users with emails in `ADMIN_EMAILS` can access admin routes
2. **Middleware Protection**: All `/admin` routes are protected at the middleware level
3. **Service Role Client**: Admin APIs use Supabase service_role key (server-side only)
4. **Rate Limiting**: Consider adding rate limits to email sending
5. **Input Validation**: All user inputs are validated and sanitized

### API Endpoints

#### User Management
- `GET /api/admin/users` - List users with pagination
- `GET /api/admin/users/[id]` - Get user details
- `POST /api/admin/users/[id]/suspend` - Suspend user
- `POST /api/admin/users/[id]/activate` - Activate user
- `POST /api/admin/users/[id]/reset-password` - Send password reset

#### Subscriptions
- `GET /api/admin/subscriptions` - List subscriptions
- `POST /api/admin/subscriptions/[id]/extend` - Extend subscription
- `POST /api/admin/subscriptions/[id]/cancel` - Cancel subscription
- `POST /api/admin/subscriptions/[id]/reactivate` - Reactivate subscription

#### Analytics
- `GET /api/admin/analytics/overview` - Dashboard metrics
- `GET /api/admin/analytics/signups` - Signup trends
- `GET /api/admin/analytics/usage` - Usage statistics

#### Payments
- `GET /api/admin/payments/failed` - Failed payments
- `GET /api/admin/payments/webhook-status` - Webhook health
- `GET /api/admin/payments/recent-events` - Recent events

#### Health
- `GET /api/admin/health/status` - Service health checks

#### Actions
- `POST /api/admin/actions/send-email` - Send email to user
- `GET /api/admin/actions/session-history` - Get session history

#### Realtime
- `GET /api/admin/realtime/active-sessions` - SSE for active sessions

## Usage Guide

### Managing Users

1. **View Users**: Navigate to `/admin/users`
2. **Search**: Use the search bar to filter by email
3. **View Details**: Click "View Details" on any user
4. **Suspend User**: From user details, use admin actions
5. **Reset Password**: Triggers a password reset email via Supabase

### Managing Subscriptions

1. **View Subscriptions**: Navigate to `/admin/subscriptions`
2. **Extend Subscription**: Add days to a user's subscription period
3. **Cancel Subscription**: Cancel immediately or at period end
4. **Reactivate**: Restore a canceled subscription

### Monitoring Payments

1. **Check Webhook Health**: View success rate and recent events
2. **Review Failed Payments**: See error messages and retry counts
3. **View Recent Events**: Monitor all payment-related webhook events

### System Health

1. **Service Status**: Check if Supabase, Stripe, etc. are operational
2. **Response Times**: Monitor API response times
3. **Auto-Refresh**: Page refreshes every 30 seconds automatically

### Quick Actions

1. **Send Email**: 
   - Enter user email, subject, and message
   - Email uses branded template automatically
   - Sent via Resend API

2. **Session History**:
   - View all sessions for a specific user
   - Filter by status (active, closed, expired)

## Troubleshooting

### Admin Access Denied

**Problem**: User gets "Access denied: Admin privileges required"

**Solution**:
1. Verify the user's email is in `ADMIN_EMAILS`
2. Check for typos (emails are case-insensitive)
3. Restart the development server after changing `.env.local`
4. Clear browser cookies and re-login

### Email Sending Fails

**Problem**: Error when sending emails

**Solution**:
1. Verify `RESEND_API_KEY` is correct
2. Check if `RESEND_FROM_EMAIL` is verified in Resend dashboard
3. Check Resend logs for delivery status
4. Ensure API key has send permissions

### Stripe Data Not Loading

**Problem**: Subscription data missing Stripe information

**Solution**:
1. Verify `STRIPE_SECRET_KEY` is correct
2. Check if users have `stripe_subscription_id` in database
3. Check browser console for API errors
4. Verify Stripe API permissions

### Realtime Updates Not Working

**Problem**: Active sessions counter not updating

**Solution**:
1. Check browser console for SSE connection errors
2. Verify `/api/admin/realtime/active-sessions` is accessible
3. Check if EventSource is supported in browser
4. Restart the development server

## Production Deployment

Before deploying to production:

1. **Environment Variables**: Set all required variables in your hosting platform
2. **ADMIN_EMAILS**: Use production admin emails
3. **RESEND_API_KEY**: Use production API key
4. **Email Domain**: Verify your production domain in Resend
5. **Security**: Consider adding rate limiting to sensitive endpoints
6. **Monitoring**: Set up logging and error tracking
7. **Backup**: Ensure database backups are configured

## Future Enhancements

Potential improvements for the admin panel:

- [ ] Export data to CSV
- [ ] Advanced search with complex filters
- [ ] Bulk actions (suspend multiple users)
- [ ] Admin notification system
- [ ] Audit trail dashboard
- [ ] Custom reports builder
- [ ] Scheduled tasks dashboard
- [ ] User impersonation (for support)
- [ ] Advanced analytics with charts
- [ ] Real-time alerts for critical events

## Support

If you encounter issues:

1. Check the browser console for errors
2. Check server logs for API errors
3. Verify all environment variables are set correctly
4. Review the troubleshooting section above
5. Contact the development team

## Security Best Practices

1. **Never commit** `.env.local` to version control
2. **Rotate admin emails** when team members leave
3. **Monitor admin actions** through logs
4. **Use strong passwords** for admin accounts
5. **Enable 2FA** on Supabase admin accounts
6. **Regularly review** admin access list
7. **Limit admin emails** to essential personnel only
8. **Audit logs** should be implemented for compliance

---

**Built with**: Next.js 14, React, TypeScript, Tailwind CSS, Supabase, Stripe, Resend, Recharts, date-fns
**Version**: 1.0.0
**Last Updated**: January 2026
