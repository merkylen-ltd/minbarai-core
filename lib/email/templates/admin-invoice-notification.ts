export const adminInvoiceNotificationEmail = (params: {
  organizationName?: string
  amount: number
  currency: string
  description: string
  dueDate: string
  invoiceUrl: string
  recipientEmail: string
}) => {
  const currencySymbols: Record<string, string> = {
    eur: '€',
    usd: '$',
    gbp: '£',
  }
  const symbol = currencySymbols[params.currency.toLowerCase()] || params.currency

  return {
    subject: `Invoice Payment Required – MinbarAI`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { border-bottom: 3px solid #55a39a; padding-bottom: 20px; margin-bottom: 30px; }
    .logo { font-size: 24px; font-weight: bold; color: #1a1a1a; }
    .content { margin: 30px 0; }
    .invoice-section { background: #f8f8f8; border-left: 4px solid #55a39a; padding: 20px; margin: 20px 0; }
    .amount { font-size: 36px; font-weight: bold; color: #55a39a; margin: 10px 0; }
    .details { margin: 15px 0; }
    .detail-row { display: flex; justify-content: space-between; margin: 8px 0; }
    .detail-label { color: #666; }
    .cta-button { display: inline-block; background: #55a39a; color: white; padding: 12px 30px; border-radius: 4px; text-decoration: none; margin: 20px 0; font-weight: bold; }
    .footer { border-top: 1px solid #ddd; padding-top: 20px; margin-top: 40px; font-size: 12px; color: #999; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">MinbarAI</div>
    </div>

    <div class="content">
      <p>Dear ${params.organizationName || 'Valued Partner'},</p>

      <p>We are pleased to inform you that your MinbarAI subscription invoice is ready for payment. Please review the details below and complete payment by the due date.</p>

      <div class="invoice-section">
        <div class="detail-row">
          <span class="detail-label">Invoice Amount:</span>
          <strong>${symbol}${(params.amount / 100).toFixed(2)}</strong>
        </div>
        <div class="detail-row">
          <span class="detail-label">Currency:</span>
          <strong>${params.currency.toUpperCase()}</strong>
        </div>
        <div class="detail-row">
          <span class="detail-label">Description:</span>
          <strong>${params.description}</strong>
        </div>
        <div class="detail-row">
          <span class="detail-label">Due Date:</span>
          <strong>${params.dueDate}</strong>
        </div>
      </div>

      <p style="text-align: center; margin-top: 30px;">
        <a href="${params.invoiceUrl}" class="cta-button">View & Pay Invoice</a>
      </p>

      <p style="margin-top: 30px;">The link above will take you to our secure payment portal. You can view the full invoice details and complete payment using your preferred payment method.</p>

      <p><strong>If you have any questions regarding this invoice, please contact our support team at support@minbarai.com</strong></p>

      <p>Thank you for partnering with MinbarAI.</p>

      <p style="margin-top: 30px; color: #666;">
        Best regards,<br>
        The MinbarAI Team
      </p>
    </div>

    <div class="footer">
      <p>© 2026 MinbarAI. All rights reserved.</p>
      <p>This is an automated message. Please do not reply directly to this email.</p>
    </div>
  </div>
</body>
</html>
    `,
  }
}
