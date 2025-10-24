'use client';

import React from 'react';
import Link from 'next/link';
import { Download, ArrowLeft, FileText } from 'lucide-react';

const PrivacyPolicyPage: React.FC = () => {
  const handleDownloadPDF = () => {
    // Create a new window to print the page as PDF
    window.print();
  };

  const handleDownloadText = async () => {
    try {
      const response = await fetch('/api/privacy-policy/download');
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'minbarai-privacy-policy.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        console.error('Failed to download privacy policy');
        // Fallback to browser print
        window.print();
      }
    } catch (error) {
      console.error('Error downloading privacy policy:', error);
      // Fallback to browser print
      window.print();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-primary-900">
      {/* Header */}
      <div className="bg-primary-900/50 backdrop-blur-sm border-b border-primary-700/20 sticky top-0 z-50">
        <div className="container-custom py-4">
          <div className="flex items-center justify-between">
            <Link 
              href="/" 
              className="flex items-center space-x-3 text-neutral-0 hover:text-accent-400 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="font-heading">Back to Home</span>
            </Link>
            
            <div className="no-print flex items-center space-x-4">
              <button
                onClick={handleDownloadText}
                className="flex items-center space-x-2 px-4 py-2 bg-accent-500/10 border border-accent-400/20 rounded-lg text-accent-300 hover:text-accent-200 hover:bg-accent-500/20 transition-colors"
              >
                <FileText className="h-4 w-4" />
                <span>Download TXT</span>
              </button>
              
              <button
                onClick={handleDownloadPDF}
                className="flex items-center space-x-2 px-4 py-2 bg-accent-500/10 border border-accent-400/20 rounded-lg text-accent-300 hover:text-accent-200 hover:bg-accent-500/20 transition-colors"
              >
                <Download className="h-4 w-4" />
                <span>Download PDF</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container-custom py-12">
        <div className="max-w-4xl mx-auto">
          {/* Title */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-display text-neutral-0 mb-4">
              Privacy Policy
            </h1>
            <p className="text-neutral-300 text-lg">
              How we collect, use, and protect your information
            </p>
            <div className="mt-4 text-sm text-neutral-400">
              <p><strong>Effective Date:</strong> January 2025</p>
              <p><strong>Last Updated:</strong> January 2025</p>
            </div>
          </div>

          {/* Content */}
          <div className="print-content bg-primary-800/30 backdrop-blur-sm border border-primary-700/20 rounded-2xl p-8 md:p-12">
            <div className="prose prose-lg prose-invert max-w-none">
              
              <section className="mb-8">
                <h2 className="text-2xl font-heading text-neutral-0 mb-4">1. Introduction</h2>
                <p className="text-neutral-300 leading-relaxed">
                  MinbarAI ("we," "our," or "us") operates the website minbarai.com and provides live multi-language translation services for religious sermons, lectures, and live events. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our service.
                </p>
                <p className="text-neutral-300 leading-relaxed mt-4">
                  By using our service, you agree to the collection and use of information in accordance with this policy.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-heading text-neutral-0 mb-4">2. Information We Collect</h2>
                
                <div className="mb-6">
                  <h3 className="text-xl font-heading text-accent-300 mb-3">2.1 Personal Information</h3>
                  <p className="text-neutral-300 leading-relaxed mb-3">
                    We collect the following personal information when you use our service:
                  </p>
                  <ul className="text-neutral-300 space-y-2 ml-4">
                    <li><strong>Account Information:</strong> Email address, password (hashed), and account creation date</li>
                    <li><strong>Authentication Data:</strong> Session tokens, authentication cookies, and login timestamps</li>
                    <li><strong>Subscription Information:</strong> Subscription status, customer ID, subscription period, and payment history</li>
                    <li><strong>Profile Data:</strong> User preferences, language settings, and account settings</li>
                  </ul>
                </div>

                <div className="mb-6">
                  <h3 className="text-xl font-heading text-accent-300 mb-3">2.2 Usage Data</h3>
                  <p className="text-neutral-300 leading-relaxed mb-3">
                    We automatically collect certain information about your use of our service:
                  </p>
                  <ul className="text-neutral-300 space-y-2 ml-4">
                    <li><strong>Session Data:</strong> Live translation session duration, start/end times, and session status</li>
                    <li><strong>Usage Tracking:</strong> Frequency of service use, feature utilization, and performance metrics</li>
                    <li><strong>Device Information:</strong> Browser type, operating system, IP address, and device identifiers</li>
                    <li><strong>Technical Data:</strong> API request logs, error reports, and system performance data</li>
                  </ul>
                </div>

                <div className="mb-6">
                  <h3 className="text-xl font-heading text-accent-300 mb-3">2.3 Audio and Translation Data</h3>
                  <p className="text-neutral-300 leading-relaxed mb-3">
                    When you use our live translation service:
                  </p>
                  <ul className="text-neutral-300 space-y-2 ml-4">
                    <li><strong>Audio Content:</strong> Real-time audio captured during live translation sessions</li>
                    <li><strong>Text Content:</strong> Speech-to-text transcriptions and translated text</li>
                    <li><strong>Language Preferences:</strong> Source and target language selections</li>
                    <li><strong>Session Metadata:</strong> Translation accuracy metrics and processing times</li>
                  </ul>
                </div>

                <div className="mb-6">
                  <h3 className="text-xl font-heading text-accent-300 mb-3">2.4 Payment Information</h3>
                  <p className="text-neutral-300 leading-relaxed mb-3">
                    For subscription services:
                  </p>
                  <ul className="text-neutral-300 space-y-2 ml-4">
                    <li><strong>Billing Data:</strong> Payment method information processed through Stripe</li>
                    <li><strong>Transaction Records:</strong> Subscription payments, refunds, and billing history</li>
                    <li><strong>Customer Data:</strong> Billing address and payment preferences</li>
                  </ul>
                </div>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-heading text-neutral-0 mb-4">3. How We Use Your Information</h2>
                
                <div className="mb-6">
                  <h3 className="text-xl font-heading text-accent-300 mb-3">3.1 Service Provision</h3>
                  <p className="text-neutral-300 leading-relaxed mb-3">
                    We use your information to:
                  </p>
                  <ul className="text-neutral-300 space-y-2 ml-4">
                    <li>Provide live translation services and maintain your account</li>
                    <li>Process payments and manage subscriptions</li>
                    <li>Authenticate users and maintain session security</li>
                    <li>Track usage limits and enforce subscription terms</li>
                    <li>Provide customer support and technical assistance</li>
                  </ul>
                </div>

                <div className="mb-6">
                  <h3 className="text-xl font-heading text-accent-300 mb-3">3.2 Service Improvement</h3>
                  <p className="text-neutral-300 leading-relaxed mb-3">
                    We use aggregated and anonymized data to:
                  </p>
                  <ul className="text-neutral-300 space-y-2 ml-4">
                    <li>Improve translation accuracy and service performance</li>
                    <li>Develop new features and enhance existing functionality</li>
                    <li>Analyze usage patterns and optimize service delivery</li>
                    <li>Conduct research and development for AI translation technology</li>
                  </ul>
                </div>

                <div className="mb-6">
                  <h3 className="text-xl font-heading text-accent-300 mb-3">3.3 Communication</h3>
                  <p className="text-neutral-300 leading-relaxed mb-3">
                    We may use your contact information to:
                  </p>
                  <ul className="text-neutral-300 space-y-2 ml-4">
                    <li>Send service-related notifications and updates</li>
                    <li>Provide important account and billing information</li>
                    <li>Respond to support requests and inquiries</li>
                    <li>Send marketing communications (with your consent)</li>
                  </ul>
                </div>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-heading text-neutral-0 mb-4">4. Information Sharing and Disclosure</h2>
                
                <div className="mb-6">
                  <h3 className="text-xl font-heading text-accent-300 mb-3">4.1 Third-Party Service Providers</h3>
                  <p className="text-neutral-300 leading-relaxed mb-3">
                    We share information with trusted third-party providers:
                  </p>
                  <ul className="text-neutral-300 space-y-2 ml-4">
                    <li><strong>Database Services:</strong> Secure cloud database hosting and user management</li>
                    <li><strong>Payment Processing:</strong> Secure payment processing and subscription management</li>
                    <li><strong>AI Translation Services:</strong> Our proprietary AI translation technology and language processing infrastructure</li>
                    <li><strong>Hosting Services:</strong> Secure website hosting and content delivery</li>
                  </ul>
                </div>

                <div className="mb-6">
                  <h3 className="text-xl font-heading text-accent-300 mb-3">4.2 Legal Requirements</h3>
                  <p className="text-neutral-300 leading-relaxed mb-3">
                    We may disclose your information when required by law or to:
                  </p>
                  <ul className="text-neutral-300 space-y-2 ml-4">
                    <li>Comply with legal obligations and court orders</li>
                    <li>Protect our rights, property, or safety</li>
                    <li>Prevent fraud or security threats</li>
                    <li>Respond to government requests</li>
                  </ul>
                </div>

                <div className="mb-6">
                  <h3 className="text-xl font-heading text-accent-300 mb-3">4.3 Business Transfers</h3>
                  <p className="text-neutral-300 leading-relaxed">
                    In the event of a merger, acquisition, or sale of assets, your information may be transferred as part of the transaction.
                  </p>
                </div>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-heading text-neutral-0 mb-4">5. Data Security</h2>
                
                <div className="mb-6">
                  <h3 className="text-xl font-heading text-accent-300 mb-3">5.1 Security Measures</h3>
                  <p className="text-neutral-300 leading-relaxed mb-3">
                    We implement comprehensive security measures to protect your information:
                  </p>
                  <ul className="text-neutral-300 space-y-2 ml-4">
                    <li><strong>Encryption:</strong> All data is encrypted in transit and at rest</li>
                    <li><strong>Access Controls:</strong> Role-based access controls and authentication requirements</li>
                    <li><strong>Database Security:</strong> Row-level security policies and secure database practices</li>
                    <li><strong>API Security:</strong> Rate limiting, input validation, and secure API endpoints</li>
                  </ul>
                </div>

                <div className="mb-6">
                  <h3 className="text-xl font-heading text-accent-300 mb-3">5.2 Data Retention</h3>
                  <p className="text-neutral-300 leading-relaxed mb-3">
                    We retain your information for as long as necessary to:
                  </p>
                  <ul className="text-neutral-300 space-y-2 ml-4">
                    <li>Provide our services and maintain your account</li>
                    <li>Comply with legal obligations and business requirements</li>
                    <li>Resolve disputes and enforce our agreements</li>
                    <li>Improve our services and develop new features</li>
                  </ul>
                </div>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-heading text-neutral-0 mb-4">6. Your Rights and Choices</h2>
                
                <div className="mb-6">
                  <h3 className="text-xl font-heading text-accent-300 mb-3">6.1 Access and Control</h3>
                  <p className="text-neutral-300 leading-relaxed mb-3">
                    You have the right to:
                  </p>
                  <ul className="text-neutral-300 space-y-2 ml-4">
                    <li>Access and review your personal information</li>
                    <li>Update or correct inaccurate information</li>
                    <li>Delete your account and associated data</li>
                    <li>Export your data in a portable format</li>
                  </ul>
                </div>

                <div className="mb-6">
                  <h3 className="text-xl font-heading text-accent-300 mb-3">6.2 Communication Preferences</h3>
                  <p className="text-neutral-300 leading-relaxed mb-3">
                    You can:
                  </p>
                  <ul className="text-neutral-300 space-y-2 ml-4">
                    <li>Opt out of marketing communications</li>
                    <li>Manage notification preferences</li>
                    <li>Control cookie settings in your browser</li>
                    <li>Request data processing restrictions</li>
                  </ul>
                </div>

                <div className="mb-6">
                  <h3 className="text-xl font-heading text-accent-300 mb-3">6.3 Data Portability</h3>
                  <p className="text-neutral-300 leading-relaxed">
                    You may request a copy of your data in a structured, machine-readable format.
                  </p>
                </div>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-heading text-neutral-0 mb-4">7. Cookies and Tracking Technologies</h2>
                
                <div className="mb-6">
                  <h3 className="text-xl font-heading text-accent-300 mb-3">7.1 Cookie Usage</h3>
                  <p className="text-neutral-300 leading-relaxed mb-3">
                    We use cookies and similar technologies to:
                  </p>
                  <ul className="text-neutral-300 space-y-2 ml-4">
                    <li>Maintain user sessions and authentication</li>
                    <li>Remember user preferences and settings</li>
                    <li>Analyze service usage and performance</li>
                    <li>Provide personalized experiences</li>
                  </ul>
                </div>

                <div className="mb-6">
                  <h3 className="text-xl font-heading text-accent-300 mb-3">7.2 Cookie Types</h3>
                  <ul className="text-neutral-300 space-y-2 ml-4">
                    <li><strong>Essential Cookies:</strong> Required for basic service functionality</li>
                    <li><strong>Functional Cookies:</strong> Enhance user experience and preferences</li>
                    <li><strong>Analytics Cookies:</strong> Help us understand service usage patterns</li>
                    <li><strong>Marketing Cookies:</strong> Used for targeted advertising (with consent)</li>
                  </ul>
                </div>

                <div className="mb-6">
                  <h3 className="text-xl font-heading text-accent-300 mb-3">7.3 Cookie Management</h3>
                  <p className="text-neutral-300 leading-relaxed">
                    You can control cookie settings through your browser preferences, though disabling certain cookies may affect service functionality.
                  </p>
                </div>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-heading text-neutral-0 mb-4">8. International Data Transfers</h2>
                <p className="text-neutral-300 leading-relaxed mb-3">
                  Your information may be transferred to and processed in countries other than your own. We ensure appropriate safeguards are in place for international transfers, including:
                </p>
                <ul className="text-neutral-300 space-y-2 ml-4">
                  <li>Standard contractual clauses</li>
                  <li>Adequacy decisions by relevant authorities</li>
                  <li>Appropriate technical and organizational measures</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-heading text-neutral-0 mb-4">9. Children's Privacy</h2>
                <p className="text-neutral-300 leading-relaxed">
                  Our service is not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13. If we become aware that we have collected personal information from a child under 13, we will take steps to delete such information.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-heading text-neutral-0 mb-4">10. Changes to This Privacy Policy</h2>
                <p className="text-neutral-300 leading-relaxed mb-3">
                  We may update this Privacy Policy from time to time. We will notify you of any material changes by:
                </p>
                <ul className="text-neutral-300 space-y-2 ml-4">
                  <li>Posting the updated policy on our website</li>
                  <li>Sending email notifications to registered users</li>
                  <li>Updating the "Last Updated" date at the top of this policy</li>
                </ul>
                <p className="text-neutral-300 leading-relaxed mt-4">
                  Your continued use of our service after changes become effective constitutes acceptance of the updated policy.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-heading text-neutral-0 mb-4">11. Contact Information</h2>
                <p className="text-neutral-300 leading-relaxed mb-3">
                  If you have questions about this Privacy Policy or our data practices, please contact us:
                </p>
                <div className="bg-primary-700/30 border border-primary-600/20 rounded-lg p-4">
                  <p className="text-neutral-200 font-heading mb-2">MinbarAI</p>
                  <p className="text-neutral-300">Email: support@minbarai.com</p>
                  <p className="text-neutral-300">Website: https://minbarai.com</p>
                </div>
                <p className="text-neutral-300 leading-relaxed mt-4">
                  For data protection inquiries and requests, please include:
                </p>
                <ul className="text-neutral-300 space-y-2 ml-4">
                  <li>Your full name and email address</li>
                  <li>Description of your request</li>
                  <li>Any relevant account information</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-heading text-neutral-0 mb-4">12. Compliance and Legal Framework</h2>
                <p className="text-neutral-300 leading-relaxed mb-3">
                  This Privacy Policy complies with applicable data protection laws, including:
                </p>
                <ul className="text-neutral-300 space-y-2 ml-4">
                  <li><strong>GDPR</strong> (General Data Protection Regulation) for EU users</li>
                  <li><strong>CCPA</strong> (California Consumer Privacy Act) for California residents</li>
                  <li><strong>PIPEDA</strong> (Personal Information Protection and Electronic Documents Act) for Canadian users</li>
                  <li>Other applicable regional privacy laws</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-heading text-neutral-0 mb-4">13. Data Processing Legal Basis</h2>
                <p className="text-neutral-300 leading-relaxed mb-3">
                  Under GDPR, we process your personal data based on:
                </p>
                <ul className="text-neutral-300 space-y-2 ml-4">
                  <li><strong>Contract Performance:</strong> Providing translation services and managing subscriptions</li>
                  <li><strong>Legitimate Interests:</strong> Service improvement, security, and fraud prevention</li>
                  <li><strong>Consent:</strong> Marketing communications and optional data processing</li>
                  <li><strong>Legal Obligation:</strong> Compliance with applicable laws and regulations</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-heading text-neutral-0 mb-4">14. Data Protection Officer</h2>
                <p className="text-neutral-300 leading-relaxed">
                  For EU users, you can contact our Data Protection Officer at:
                </p>
                <p className="text-neutral-300 mt-2">Email: support@minbarai.com</p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-heading text-neutral-0 mb-4">15. Supervisory Authority</h2>
                <p className="text-neutral-300 leading-relaxed">
                  EU users have the right to lodge a complaint with their local supervisory authority if they believe their data protection rights have been violated.
                </p>
              </section>

              <div className="border-t border-primary-600/20 pt-8 mt-12">
                <p className="text-neutral-400 text-center">
                  <strong>This Privacy Policy is effective as of January 2025 and applies to all users of MinbarAI services.</strong>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default PrivacyPolicyPage;
