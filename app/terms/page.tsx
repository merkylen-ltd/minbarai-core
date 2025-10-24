'use client';

import React from 'react';
import Link from 'next/link';
import { Download, ArrowLeft, FileText } from 'lucide-react';

const TermsAndConditionsPage: React.FC = () => {
  const handleDownloadPDF = () => {
    // Create a new window to print the page as PDF
    window.print();
  };

  const handleDownloadText = async () => {
    try {
      const response = await fetch('/api/terms-and-conditions/download');
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'minbarai-terms-and-conditions.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        console.error('Failed to download terms and conditions');
        // Fallback to browser print
        window.print();
      }
    } catch (error) {
      console.error('Error downloading terms and conditions:', error);
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
              Terms and Conditions
            </h1>
            <p className="text-neutral-300 text-lg">
              Legal terms governing your use of MinbarAI services
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
                <h2 className="text-2xl font-heading text-neutral-0 mb-4">1. Acceptance of Terms</h2>
                <p className="text-neutral-300 leading-relaxed">
                  By accessing and using MinbarAI ("the Service"), operated by MinbarAI ("we," "our," or "us"), you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-heading text-neutral-0 mb-4">2. Description of Service</h2>
                <p className="text-neutral-300 leading-relaxed mb-3">
                  MinbarAI is a Software-as-a-Service (SaaS) platform that provides live multi-language translation services for religious sermons, lectures, and live events. Our service includes:
                </p>
                <ul className="text-neutral-300 space-y-2 ml-4">
                  <li>Real-time audio capture and processing</li>
                  <li>AI-powered speech-to-text transcription</li>
                  <li>Multi-language translation capabilities</li>
                  <li>Live streaming translation services</li>
                  <li>Session management and usage tracking</li>
                  <li>Subscription-based access with tiered plans</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-heading text-neutral-0 mb-4">3. User Accounts and Registration</h2>
                
                <div className="mb-6">
                  <h3 className="text-xl font-heading text-accent-300 mb-3">3.1 Account Creation</h3>
                  <ul className="text-neutral-300 space-y-2 ml-4">
                    <li>You must provide accurate, current, and complete information during registration</li>
                    <li>You are responsible for maintaining the confidentiality of your account credentials</li>
                    <li>You must be at least 18 years old to create an account</li>
                    <li>One person or entity may not maintain multiple accounts</li>
                  </ul>
                </div>

                <div className="mb-6">
                  <h3 className="text-xl font-heading text-accent-300 mb-3">3.2 Account Security</h3>
                  <ul className="text-neutral-300 space-y-2 ml-4">
                    <li>You are responsible for all activities that occur under your account</li>
                    <li>You must notify us immediately of any unauthorized use of your account</li>
                    <li>We are not liable for any loss or damage arising from unauthorized account use</li>
                  </ul>
                </div>

                <div className="mb-6">
                  <h3 className="text-xl font-heading text-accent-300 mb-3">3.3 Account Termination</h3>
                  <ul className="text-neutral-300 space-y-2 ml-4">
                    <li>We reserve the right to suspend or terminate accounts that violate these terms</li>
                    <li>You may terminate your account at any time through your account settings</li>
                    <li>Upon termination, your right to use the service ceases immediately</li>
                  </ul>
                </div>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-heading text-neutral-0 mb-4">4. Subscription and Payment Terms</h2>
                
                <div className="mb-6">
                  <h3 className="text-xl font-heading text-accent-300 mb-3">4.1 Subscription Plans</h3>
                  <ul className="text-neutral-300 space-y-2 ml-4">
                    <li>MinbarAI offers subscription-based access with monthly billing cycles</li>
                    <li>Current pricing: €99 per month for full access</li>
                    <li>Subscription fees are billed in advance on a monthly basis</li>
                    <li>All prices are exclusive of applicable taxes</li>
                  </ul>
                </div>

                <div className="mb-6">
                  <h3 className="text-xl font-heading text-accent-300 mb-3">4.2 Payment Processing</h3>
                  <ul className="text-neutral-300 space-y-2 ml-4">
                    <li>Payments are processed through Stripe, our third-party payment processor</li>
                    <li>You authorize us to charge your chosen payment method</li>
                    <li>Failed payments may result in service suspension</li>
                    <li>All payment information is handled securely and encrypted</li>
                  </ul>
                </div>

                <div className="mb-6">
                  <h3 className="text-xl font-heading text-accent-300 mb-3">4.3 Billing and Renewal</h3>
                  <ul className="text-neutral-300 space-y-2 ml-4">
                    <li>Subscriptions automatically renew unless cancelled before the next billing cycle</li>
                    <li>You will be charged the then-current subscription fee</li>
                    <li>No refunds are provided for partial months or unused service time</li>
                    <li>We reserve the right to change pricing with 30 days' notice</li>
                  </ul>
                </div>

                <div className="mb-6">
                  <h3 className="text-xl font-heading text-accent-300 mb-3">4.4 Cancellation</h3>
                  <ul className="text-neutral-300 space-y-2 ml-4">
                    <li>You may cancel your subscription at any time through your account dashboard</li>
                    <li>Cancellation takes effect at the end of your current billing period</li>
                    <li>You retain access to the service until the end of your paid period</li>
                    <li>No partial refunds are provided for early cancellation</li>
                  </ul>
                </div>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-heading text-neutral-0 mb-4">5. Acceptable Use Policy</h2>
                
                <div className="mb-6">
                  <h3 className="text-xl font-heading text-accent-300 mb-3">5.1 Permitted Uses</h3>
                  <p className="text-neutral-300 leading-relaxed mb-3">
                    You may use MinbarAI for:
                  </p>
                  <ul className="text-neutral-300 space-y-2 ml-4">
                    <li>Legitimate religious, educational, or professional purposes</li>
                    <li>Personal use within the scope of your subscription</li>
                    <li>Translation of appropriate content for authorized events</li>
                  </ul>
                </div>

                <div className="mb-6">
                  <h3 className="text-xl font-heading text-accent-300 mb-3">5.2 Prohibited Uses</h3>
                  <p className="text-neutral-300 leading-relaxed mb-3">
                    You may not use MinbarAI to:
                  </p>
                  <ul className="text-neutral-300 space-y-2 ml-4">
                    <li>Transmit, distribute, or store any material that is illegal, harmful, or offensive</li>
                    <li>Violate any applicable laws or regulations</li>
                    <li>Infringe on intellectual property rights of others</li>
                    <li>Attempt to gain unauthorized access to our systems</li>
                    <li>Use the service for commercial purposes beyond your subscription scope</li>
                    <li>Reverse engineer, decompile, or disassemble our software</li>
                    <li>Share your account credentials with others</li>
                    <li>Use automated tools to access the service without permission</li>
                  </ul>
                </div>

                <div className="mb-6">
                  <h3 className="text-xl font-heading text-accent-300 mb-3">5.3 Content Restrictions</h3>
                  <ul className="text-neutral-300 space-y-2 ml-4">
                    <li>Content must be appropriate for religious and educational contexts</li>
                    <li>No hate speech, harassment, or discriminatory content</li>
                    <li>No content that promotes violence or illegal activities</li>
                    <li>No copyrighted material without proper authorization</li>
                  </ul>
                </div>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-heading text-neutral-0 mb-4">6. Intellectual Property Rights</h2>
                
                <div className="mb-6">
                  <h3 className="text-xl font-heading text-accent-300 mb-3">6.1 Our Intellectual Property</h3>
                  <ul className="text-neutral-300 space-y-2 ml-4">
                    <li>MinbarAI and all related trademarks, logos, and service marks are our property</li>
                    <li>Our software, algorithms, proprietary AI models, and proprietary technology are protected by intellectual property laws</li>
                    <li>You may not copy, modify, reverse engineer, or distribute our proprietary technology</li>
                    <li>Our AI translation algorithms, models, and methodologies are trade secrets and proprietary intellectual property</li>
                  </ul>
                </div>

                <div className="mb-6">
                  <h3 className="text-xl font-heading text-accent-300 mb-3">6.2 Your Content</h3>
                  <ul className="text-neutral-300 space-y-2 ml-4">
                    <li>You retain ownership of content you input into our service</li>
                    <li>By using our service, you grant us a limited license to process your content for translation purposes</li>
                    <li>We do not claim ownership of your original content</li>
                  </ul>
                </div>

                <div className="mb-6">
                  <h3 className="text-xl font-heading text-accent-300 mb-3">6.3 Translation Output</h3>
                  <ul className="text-neutral-300 space-y-2 ml-4">
                    <li>Translation outputs are generated using our proprietary AI technology and infrastructure</li>
                    <li>You may use translation outputs for your intended purposes</li>
                    <li>We retain all rights to our proprietary translation algorithms, methodologies, and AI models</li>
                    <li>Our AI translation technology is protected intellectual property and trade secret</li>
                  </ul>
                </div>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-heading text-neutral-0 mb-4">7. Privacy and Data Protection</h2>
                
                <div className="mb-6">
                  <h3 className="text-xl font-heading text-accent-300 mb-3">7.1 Data Collection</h3>
                  <ul className="text-neutral-300 space-y-2 ml-4">
                    <li>We collect and process data as described in our Privacy Policy</li>
                    <li>This includes audio data, text content, usage patterns, and account information</li>
                    <li>All data processing complies with applicable privacy laws</li>
                  </ul>
                </div>

                <div className="mb-6">
                  <h3 className="text-xl font-heading text-accent-300 mb-3">7.2 Data Security</h3>
                  <ul className="text-neutral-300 space-y-2 ml-4">
                    <li>We implement industry-standard security measures to protect your data</li>
                    <li>Data is encrypted in transit and at rest</li>
                    <li>We use secure third-party services for data processing and storage</li>
                  </ul>
                </div>

                <div className="mb-6">
                  <h3 className="text-xl font-heading text-accent-300 mb-3">7.3 Data Retention</h3>
                  <ul className="text-neutral-300 space-y-2 ml-4">
                    <li>We retain data as necessary to provide our services</li>
                    <li>Audio data may be processed in real-time and not permanently stored</li>
                    <li>Account data is retained according to our data retention policies</li>
                  </ul>
                </div>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-heading text-neutral-0 mb-4">8. Service Availability and Limitations</h2>
                
                <div className="mb-6">
                  <h3 className="text-xl font-heading text-accent-300 mb-3">8.1 Service Availability</h3>
                  <ul className="text-neutral-300 space-y-2 ml-4">
                    <li>We strive to maintain high service availability but do not guarantee 100% uptime</li>
                    <li>Scheduled maintenance may temporarily interrupt service</li>
                    <li>We will provide advance notice of planned maintenance when possible</li>
                  </ul>
                </div>

                <div className="mb-6">
                  <h3 className="text-xl font-heading text-accent-300 mb-3">8.2 Usage Limitations</h3>
                  <ul className="text-neutral-300 space-y-2 ml-4">
                    <li>Subscription plans include usage limits as specified in your plan</li>
                    <li>Session duration limits apply to prevent abuse</li>
                    <li>Rate limiting may be implemented to ensure fair usage</li>
                  </ul>
                </div>

                <div className="mb-6">
                  <h3 className="text-xl font-heading text-accent-300 mb-3">8.3 Technical Requirements</h3>
                  <ul className="text-neutral-300 space-y-2 ml-4">
                    <li>You are responsible for ensuring your devices meet minimum technical requirements</li>
                    <li>Internet connectivity is required for service functionality</li>
                    <li>Browser compatibility requirements may apply</li>
                  </ul>
                </div>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-heading text-neutral-0 mb-4">9. Disclaimers and Limitations of Liability</h2>
                
                <div className="mb-6">
                  <h3 className="text-xl font-heading text-accent-300 mb-3">9.1 Service Disclaimers</h3>
                  <ul className="text-neutral-300 space-y-2 ml-4">
                    <li>The service is provided "as is" without warranties of any kind</li>
                    <li>We do not guarantee the accuracy of translations</li>
                    <li>Translation quality may vary based on content complexity and language pairs</li>
                  </ul>
                </div>

                <div className="mb-6">
                  <h3 className="text-xl font-heading text-accent-300 mb-3">9.2 Limitation of Liability</h3>
                  <ul className="text-neutral-300 space-y-2 ml-4">
                    <li>Our liability is limited to the amount you paid for the service in the 12 months preceding the claim</li>
                    <li>We are not liable for indirect, incidental, or consequential damages</li>
                    <li>We are not liable for any loss of data, profits, or business opportunities</li>
                  </ul>
                </div>

                <div className="mb-6">
                  <h3 className="text-xl font-heading text-accent-300 mb-3">9.3 Force Majeure</h3>
                  <ul className="text-neutral-300 space-y-2 ml-4">
                    <li>We are not liable for service interruptions due to circumstances beyond our control</li>
                    <li>This includes natural disasters, government actions, or third-party service failures</li>
                  </ul>
                </div>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-heading text-neutral-0 mb-4">10. Indemnification</h2>
                <p className="text-neutral-300 leading-relaxed mb-3">
                  You agree to indemnify and hold harmless MinbarAI, its officers, directors, employees, and agents from any claims, damages, or expenses arising from:
                </p>
                <ul className="text-neutral-300 space-y-2 ml-4">
                  <li>Your use of the service in violation of these terms</li>
                  <li>Your violation of any applicable laws or regulations</li>
                  <li>Your infringement of any third-party rights</li>
                  <li>Content you provide through the service</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-heading text-neutral-0 mb-4">11. Modifications to Terms</h2>
                
                <div className="mb-6">
                  <h3 className="text-xl font-heading text-accent-300 mb-3">11.1 Changes to Terms</h3>
                  <ul className="text-neutral-300 space-y-2 ml-4">
                    <li>We may modify these terms at any time</li>
                    <li>Material changes will be communicated via email or service notifications</li>
                    <li>Continued use of the service constitutes acceptance of modified terms</li>
                  </ul>
                </div>

                <div className="mb-6">
                  <h3 className="text-xl font-heading text-accent-300 mb-3">11.2 Service Updates</h3>
                  <ul className="text-neutral-300 space-y-2 ml-4">
                    <li>We may update, modify, or discontinue features of the service</li>
                    <li>We will provide reasonable notice of significant changes</li>
                    <li>Some updates may require acceptance of new terms</li>
                  </ul>
                </div>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-heading text-neutral-0 mb-4">12. Termination</h2>
                
                <div className="mb-6">
                  <h3 className="text-xl font-heading text-accent-300 mb-3">12.1 Termination by You</h3>
                  <ul className="text-neutral-300 space-y-2 ml-4">
                    <li>You may terminate your account at any time</li>
                    <li>Termination takes effect at the end of your current billing period</li>
                    <li>You remain responsible for all charges incurred before termination</li>
                  </ul>
                </div>

                <div className="mb-6">
                  <h3 className="text-xl font-heading text-accent-300 mb-3">12.2 Termination by Us</h3>
                  <ul className="text-neutral-300 space-y-2 ml-4">
                    <li>We may terminate your account for violation of these terms</li>
                    <li>We may suspend service for non-payment or technical issues</li>
                    <li>We will provide reasonable notice when possible</li>
                  </ul>
                </div>

                <div className="mb-6">
                  <h3 className="text-xl font-heading text-accent-300 mb-3">12.3 Effect of Termination</h3>
                  <ul className="text-neutral-300 space-y-2 ml-4">
                    <li>Upon termination, your right to use the service ceases immediately</li>
                    <li>We may delete your account data after a reasonable period</li>
                    <li>Provisions that by their nature should survive termination will remain in effect</li>
                  </ul>
                </div>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-heading text-neutral-0 mb-4">13. Governing Law and Dispute Resolution</h2>
                
                <div className="mb-6">
                  <h3 className="text-xl font-heading text-accent-300 mb-3">13.1 Governing Law</h3>
                  <ul className="text-neutral-300 space-y-2 ml-4">
                    <li>These terms are governed by the laws of [Your Jurisdiction]</li>
                    <li>Any disputes will be resolved in the courts of [Your Jurisdiction]</li>
                  </ul>
                </div>

                <div className="mb-6">
                  <h3 className="text-xl font-heading text-accent-300 mb-3">13.2 Dispute Resolution</h3>
                  <ul className="text-neutral-300 space-y-2 ml-4">
                    <li>We encourage resolution of disputes through direct communication</li>
                    <li>For EU users, you may use the European Commission's Online Dispute Resolution platform</li>
                    <li>Binding arbitration may be required for certain disputes</li>
                  </ul>
                </div>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-heading text-neutral-0 mb-4">14. International Users</h2>
                
                <div className="mb-6">
                  <h3 className="text-xl font-heading text-accent-300 mb-3">14.1 Export Controls</h3>
                  <ul className="text-neutral-300 space-y-2 ml-4">
                    <li>The service may be subject to export control laws</li>
                    <li>You are responsible for compliance with applicable export regulations</li>
                    <li>The service may not be available in all countries</li>
                  </ul>
                </div>

                <div className="mb-6">
                  <h3 className="text-xl font-heading text-accent-300 mb-3">14.2 Local Laws</h3>
                  <ul className="text-neutral-300 space-y-2 ml-4">
                    <li>You are responsible for compliance with local laws and regulations</li>
                    <li>Some features may be restricted in certain jurisdictions</li>
                    <li>We reserve the right to restrict access based on legal requirements</li>
                  </ul>
                </div>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-heading text-neutral-0 mb-4">15. Third-Party Services</h2>
                
                <div className="mb-6">
                  <h3 className="text-xl font-heading text-accent-300 mb-3">15.1 Third-Party Integrations</h3>
                  <ul className="text-neutral-300 space-y-2 ml-4">
                    <li>Our service integrates with trusted third-party providers for essential infrastructure services</li>
                    <li>These services have their own terms and privacy policies</li>
                    <li>We are not responsible for third-party service availability or performance</li>
                  </ul>
                </div>

                <div className="mb-6">
                  <h3 className="text-xl font-heading text-accent-300 mb-3">15.2 Third-Party Content</h3>
                  <ul className="text-neutral-300 space-y-2 ml-4">
                    <li>Our service may include content from third parties</li>
                    <li>We do not endorse or assume responsibility for third-party content</li>
                    <li>Third-party content is subject to its own terms and conditions</li>
                  </ul>
                </div>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-heading text-neutral-0 mb-4">16. Beta Features and Testing</h2>
                
                <div className="mb-6">
                  <h3 className="text-xl font-heading text-accent-300 mb-3">16.1 Beta Services</h3>
                  <ul className="text-neutral-300 space-y-2 ml-4">
                    <li>Some features may be marked as "beta" or "experimental"</li>
                    <li>Beta features may be unstable or incomplete</li>
                    <li>We may modify or discontinue beta features without notice</li>
                  </ul>
                </div>

                <div className="mb-6">
                  <h3 className="text-xl font-heading text-accent-300 mb-3">16.2 Feedback and Testing</h3>
                  <ul className="text-neutral-300 space-y-2 ml-4">
                    <li>We may request feedback on beta features</li>
                    <li>Your participation in beta testing is voluntary</li>
                    <li>Beta features are provided "as is" without warranties</li>
                  </ul>
                </div>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-heading text-neutral-0 mb-4">17. Contact Information</h2>
                <p className="text-neutral-300 leading-relaxed mb-3">
                  For questions about these Terms and Conditions, please contact us:
                </p>
                <div className="bg-primary-700/30 border border-primary-600/20 rounded-lg p-4">
                  <p className="text-neutral-200 font-heading mb-2">MinbarAI</p>
                  <p className="text-neutral-300">Email: support@minbarai.com</p>
                  <p className="text-neutral-300">Website: https://minbarai.com</p>
                </div>
                <p className="text-neutral-300 leading-relaxed mt-4">
                  For general support inquiries:
                </p>
                <p className="text-neutral-300">Email: support@minbarai.com</p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-heading text-neutral-0 mb-4">18. Severability</h2>
                <p className="text-neutral-300 leading-relaxed">
                  If any provision of these terms is found to be unenforceable or invalid, the remaining provisions will remain in full force and effect. We will replace any invalid provision with a valid provision that most closely approximates the intent of the original provision.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-heading text-neutral-0 mb-4">19. Entire Agreement</h2>
                <p className="text-neutral-300 leading-relaxed">
                  These Terms and Conditions, together with our Privacy Policy, constitute the entire agreement between you and MinbarAI regarding the use of our service. They supersede all prior agreements and understandings.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-heading text-neutral-0 mb-4">20. Waiver</h2>
                <p className="text-neutral-300 leading-relaxed">
                  Our failure to enforce any provision of these terms does not constitute a waiver of that provision or any other provision. Any waiver must be in writing and signed by an authorized representative.
                </p>
              </section>

              <div className="border-t border-primary-600/20 pt-8 mt-12">
                <p className="text-neutral-400 text-center mb-4">
                  <strong>These Terms and Conditions are effective as of January 2025 and apply to all users of MinbarAI services.</strong>
                </p>
                <p className="text-neutral-400 text-center">
                  <strong>By using MinbarAI, you acknowledge that you have read, understood, and agree to be bound by these Terms and Conditions.</strong>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsAndConditionsPage;
