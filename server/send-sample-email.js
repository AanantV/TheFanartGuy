const fs = require('fs');
const path = require('path');
const { buildOrderEmail, sendMail, isEmailConfigured } = require('./email');

const SAMPLE_IMAGE = path.join(__dirname, 'src', 'components', 'logo.jpg');

const sampleOrder = {
  firstName: 'Priya',
  middleName: 'K',
  lastName: 'Sharma',
  dateOfBirth: '1998-03-14',
  email: 'priya.sample@example.com',
  phoneCountryCode: '+91',
  phoneNumber: '9876543210',
  commissionTitle: 'Jailer-style poster of my cat',
  description:
    'An A3 poster in the red-and-black Jailer style, with my cat in sunglasses as the hero.\n' +
    'Bold title text at the bottom, please.',
  budget: 3500,
  currency: 'INR',
  expectedDelivery: '2026-12-20',
  additionalDetails: 'It is a birthday gift, so a print-ready file would be great.',
  addressLine1: '12 Example Street',
  addressLine2: 'Flat 4B',
  landmark: 'Near City Park',
  state: 'Tamil Nadu',
  country: 'India',
  pincode: '600001',
  referenceImages: ['/api/uploads/00000000000000000.jpg'],
};

async function main() {
  const email = buildOrderEmail(sampleOrder, 'SAMPLE');

  // The sample has no real upload, so attach the site logo as the reference image.
  email.attachments = email.attachments.map(a => ({ ...a, path: SAMPLE_IMAGE }));
  email.subject = `[Sample] ${email.subject}`;

  // Browser preview: swap the inline-attachment references for the actual image data.
  const imageData = `data:image/jpeg;base64,${fs.readFileSync(SAMPLE_IMAGE).toString('base64')}`;
  const preview = email.html.replace(/cid:reference-\d+@thefanartguy/g, imageData);

  const previewPath = path.join(__dirname, 'data', 'sample-order-email.html');
  fs.mkdirSync(path.dirname(previewPath), { recursive: true });
  fs.writeFileSync(previewPath, preview);

  console.log(`Preview saved: ${previewPath}`);

  if (!isEmailConfigured()) {
    console.log(
      'Email not sent: SMTP is not set up yet. Fill in the email settings in server/.env (see server/.env.example).'
    );
    return;
  }

  const info = await sendMail(email, { replyTo: sampleOrder.email });
  console.log(`Sample email sent to ${process.env.NOTIFY_EMAIL} (message id: ${info.messageId}).`);
}

main().catch(err => {
  console.error('Sending failed:', err.message);

  if (/ECONNREFUSED|ETIMEDOUT|ESOCKET|ENOTFOUND|ECONNRESET|certificate/i.test(`${err.code} ${err.message}`)) {
    console.error(
      'The mail server could not be reached. A work/office network often blocks email (SMTP) ports; try from a home network.'
    );
  } else if (/Invalid login|535|534/i.test(err.message)) {
    console.error(
      'Login rejected. For Gmail, SMTP_PASS must be an App Password, not your normal password.'
    );
  }

  process.exit(1);
});