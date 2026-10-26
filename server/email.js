const path = require('path');
const nodemailer = require('nodemailer');
const { uploadPath } = require('./uploads');

const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime())
    ? dateStr
    : d.toLocaleDateString('en-GB', { dateStyle: 'long' });
}

function formatBudget(amount, currency = 'USD') {
  if (amount === null || amount === undefined || amount === '') return '';
  const num = Number(amount);
  return Number.isNaN(num)
    ? `${currency} ${amount}`
    : `${currency} ${num.toLocaleString()}`;
}

function row(label, value, options = {}) {
  if (!value) return '';
  const formattedVal = options.multiline
    ? escapeHtml(value).replace(/\n/g, '<br>')
    : escapeHtml(value);

  return `
    <tr>
      <td style="padding: 6px 12px; font-family:${FONT}; font-size:14px; color:#666666; width:160px; vertical-align:top;">${escapeHtml(label)}</td>
      <td style="padding: 6px 12px; font-family:${FONT}; font-size:14px; color:#1a1a1a; vertical-align:top;">${formattedVal}</td>
    </tr>`;
}

function section(title, rows) {
  const content = rows.filter(Boolean).join('');
  if (!content) return '';
  return `
    <tr>
      <td colspan="2" style="padding:16px 12px 6px; font-family:${FONT}; font-size:15px; font-weight:bold; color:#8b0000; border-bottom:1px solid #eee;">
        ${escapeHtml(title)}
      </td>
    </tr>
    ${content}`;
}

function buildOrderEmail(order, orderId) {
  const fullName = [order.firstName, order.middleName, order.lastName].filter(Boolean).join(' ');
  const phone = order.phoneNumber ? `${order.phoneCountryCode || ''} ${order.phoneNumber}`.trim() : '';
  const address = [
    order.addressLine1,
    order.addressLine2,
    order.landmark && `Landmark: ${order.landmark}`,
    `${order.state || ''} ${order.pincode || ''}`.trim(),
    order.country,
  ].filter(Boolean).join('\n');

  const images = order.referenceImages || [];
  const received = new Date().toLocaleString('en-GB', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: process.env.TIME_ZONE || 'Asia/Kolkata',
  });

  // Reference images are attached and also shown inside the email ("cid:" = inline attachment).
  const attachments = images.map((url, i) => ({
    filename: `reference-${i + 1}${path.extname(url)}`,
    path: uploadPath(url),
    cid: `reference-${i + 1}@thefanartguy`,
  }));

  const imageCells = attachments
    .map(
      a => `
      <td style="padding: 6px; vertical-align:top;">
        <img src="cid:${a.cid}" alt="${escapeHtml(a.filename)}" width="160"
             style="display:block; width: 160px; max-width: 100%; border:1px solid #cccccc; border-radius:4px;" />
      </td>`
    )
    .join('');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f4efe6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f4efe6;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="640" cellpadding="0" cellspacing="0"
             style="max-width: 640px; width: 100%; background:#fffdf8;border:1px solid #d8cdb8; border-radius: 6px;">
        <tr>
          <td style="padding: 28px 28px 18px;text-align:center; border-bottom: 3px double #d8cdb8;">
            <p style="margin:0;font-family: ${FONT}; font-size:13px;letter-spacing:3px;color:#8b0000;text-transform: uppercase;">
              TheFanartGuy &middot; Commission Order Form
            </p>
            <h1 style="margin:8px 0 4px; font-family:${FONT}; font-size: 28px; color: #1a1a1a;">
              New Commission Order #${escapeHtml(orderId)}
            </h1>
            <p style="margin:0;font-family:${FONT};font-size: 15px; color: #555555; font-style: italic;">
              Received ${escapeHtml(received)}
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding: 20px 28px 0;font-family: ${FONT}; font-size:16px;color:#1a1a1a;line-height:1.5;">
            <strong>${escapeHtml(fullName)}</strong> would like a commission titled
            <strong>&ldquo;${escapeHtml(order.commissionTitle)}&rdquo;</strong> with a budget of
            <strong>${escapeHtml(formatBudget(order.budget, order.currency))}</strong>, delivered by
            <strong>${escapeHtml(formatDate(order.expectedDelivery))}</strong>.
            <br><br>
            Reply to this email to answer them directly.
          </td>
        </tr>

        <tr>
          <td style="padding: 10px 28px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              ${section('Customer Details', [
                row('Full name', fullName),
                row('Date of birth', formatDate(order.dateOfBirth)),
                row('Email', order.email),
                row('Contact number', phone),
              ])}

              ${section('Commission', [
                row('Title', order.commissionTitle),
                row('Description', order.description, { multiline: true }),
                row('Budget', formatBudget(order.budget, order.currency)),
                row('Expected delivery', formatDate(order.expectedDelivery)),
                row('Additional details', order.additionalDetails, { multiline: true }),
              ])}

              ${section('Delivery Address', [
                row('Address', address, { multiline: true }),
              ])}

              ${section(
                `Reference Images (${images.length})`,
                images.length
                  ? [
                      `<tr><td colspan="2" style="padding:8px 6px;">
                        <table role="presentation" cellpadding="0" cellspacing="0"><tr>${imageCells}</tr></table>
                        <p style="margin:8px 6px 0;font-family:${FONT}; font-size:14px; color: #555555; font-style: italic;">
                          Full-size copies are attached to this email.
                        </p>
                      </td></tr>`,
                    ]
                  : [row('Images', 'None provided')]
              )}
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding: 24px 28px 28px; text-align:center;">
            <p style="margin:0;font-family:${FONT};font-size:13px;color:#888888; font-style: italic;">
              Sent automatically by your TheFanartGuy website. Order #${escapeHtml(orderId)} is saved in your database.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = [
    `NEW COMMISSION ORDER #${orderId} (received ${received})`,
    '',
    'CUSTOMER DETAILS',
    `Full name: ${fullName}`,
    `Date of birth: ${formatDate(order.dateOfBirth)}`,
    `Email: ${order.email}`,
    `Contact number: ${phone || 'Not provided'}`,
    '',
    'COMMISSION',
    `Title: ${order.commissionTitle}`,
    `Description: ${order.description}`,
    `Budget: ${formatBudget(order.budget, order.currency)}`,
    `Expected delivery: ${formatDate(order.expectedDelivery)}`,
    `Additional details: ${order.additionalDetails || 'Not provided'}`,
    '',
    'DELIVERY ADDRESS',
    address || 'Not provided',
    '',
    `REFERENCE IMAGES: ${images.length ? `${images.length} attached` : 'none'}`,
  ].join('\n');

  return {
    subject: `New commission #${orderId}: ${order.commissionTitle} (${fullName})`,
    html,
    text,
    attachments,
  };
}

function isEmailConfigured() {
  return Boolean(
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS &&
    process.env.NOTIFY_EMAIL
  );
}

let transporter;

function getTransporter() {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT || 465);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465, // 465 SSL; 587 upgrades to TLS automatically
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

/** Sends a built email to NOTIFY_EMAIL. replyTo lets you answer the customer directly. */
async function sendMail({ subject, html, text, attachments }, { replyTo } = {}) {
  return getTransporter().sendMail({
    from: process.env.MAIL_FROM || `"TheFanartGuy Website" <${process.env.SMTP_USER}>`,
    to: process.env.NOTIFY_EMAIL,
    replyTo,
    subject,
    html,
    text,
    attachments,
  });
}

/**
 * Emails a new order to you. Never throws: a failed email must not lose the order,
 * which is already saved in the database by the time this runs.
 */
async function notifyNewOrder(order, orderId) {
  if (!isEmailConfigured()) {
    console.warn(`Order #${orderId} saved, but no email sent: SMTP is not set up (see server/.env.example).`);
    return;
  }

  try {
    await sendMail(buildOrderEmail(order, orderId), { replyTo: order.email });
    console.log(`Order #${orderId} emailed to ${process.env.NOTIFY_EMAIL}.`);
  } catch (err) {
    console.error(`Order #${orderId} saved, but the email failed:`, err.message);
  }
}

module.exports = { buildOrderEmail, sendMail, notifyNewOrder, isEmailConfigured };