import React, { useEffect, useRef, useState } from 'react';
import { COUNTRIES } from '../../shared/countries';
import { API_URL } from '../api';

// Optional reference images. Keep these in sync with server/uploads.js and server/index.js.
const MAX_REFERENCE_IMAGES = 5;
const MAX_REFERENCE_MB = 10;
const REFERENCE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/** Uploads one reference image and returns its stored URL. */
async function uploadReference(file) {
  const res = await fetch(`${API_URL}/api/commissions/reference-images`, {
    method: 'POST',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Could not upload ${file.name}.`);
  return data.url;
}

const EMPTY_FORM = {
  firstName: '',
  middleName: '',
  lastName: '',
  dateOfBirth: '',
  email: '',
  phoneCountry: 'India',
  phoneNumber: '',
  commissionTitle: '',
  description: '',
  budget: '',
  currency: 'INR',
  expectedDelivery: '',
  additionalDetails: '',
  addressLine1: '',
  addressLine2: '',
  landmark: '',
  state: '',
  country: 'India',
  pincode: '',
};

// Phone numbers: digits only once spaces, dashes, dots and brackets are removed.
const PHONE_PATTERN = /^\d{4,14}$/;
const cleanPhone = value => value.replace(/[\s\-().]/g, '');

// Local date as YYYY-MM-DD, shifted by `offsetDays`.
function localDate(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Same rules as the server (server/index.js), so visitors see problems before submitting.
function validate(form) {
  const errors = {};
  const required = [
    'firstName', 'lastName', 'dateOfBirth', 'email', 'phoneNumber', 'commissionTitle', 'description',
    'budget', 'expectedDelivery', 'addressLine1', 'state', 'country', 'pincode',
  ];
  required.forEach(field => {
    if (!String(form[field]).trim()) errors[field] = 'This field is required.';
  });
  if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    errors.email = 'Enter a valid email address.';
  }
  if (form.phoneNumber && !PHONE_PATTERN.test(cleanPhone(form.phoneNumber))) {
    errors.phoneNumber = 'Enter a valid phone number (digits only, without the country code).';
  }
  if (form.budget && !(Number(form.budget) > 0)) errors.budget = 'Enter a budget greater than 0.';
  if (form.dateOfBirth && form.dateOfBirth >= localDate()) {
    errors.dateOfBirth = 'Date of birth must be in the past.';
  }
  if (form.expectedDelivery && form.expectedDelivery <= localDate()) {
    errors.expectedDelivery = 'Delivery date must be in the future.';
  }
  if (form.pincode && !/^[A-Za-z0-9 -]{3,10}$/.test(form.pincode.trim())) {
    errors.pincode = 'Enter a valid pincode.';
  }
  return errors;
}

function Field({ label, name, error, required, children }) {
  return (
    <div className={`form-field ${error ? 'has-error' : ''}`}>
      <label htmlFor={name}>
        {label} {required && <span className="required">*</span>}
      </label>
      {children}
      {error && <span className="field-error" id={`${name}-error`}>{error}</span>}
    </div>
  );
}

function Commissions() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState('idle'); // idle | submitting | success | error
  const [message, setMessage] = useState('');
  const [orderId, setOrderId] = useState(null);
  const [references, setReferences] = useState([]); // [{ id, file, preview }]
  const referenceInput = useRef(null);
  const staticSite = typeof window !== 'undefined' && window.location.hostname.endsWith('github.io') && !API_URL;

  // Free the temporary preview addresses when images are removed or the page closes.
  const referencesRef = useRef(references);
  referencesRef.current = references;
  useEffect(() => () => referencesRef.current.forEach(r => URL.revokeObjectURL(r.preview)), []);

  const addReferences = e => {
    const files = [...e.target.files];
    e.target.value = ''; // allow choosing the same file again
    const problems = [];
    const accepted = [];
    for (const file of files) {
      if (references.length + accepted.length >= MAX_REFERENCE_IMAGES) {
        problems.push(`You can attach up to ${MAX_REFERENCE_IMAGES} images.`);
        break;
      }
      if (!REFERENCE_TYPES.includes(file.type)) problems.push(`${file.name}: use a JPEG, PNG, WebP or GIF image.`);
      else if (file.size > MAX_REFERENCE_MB * 1024 * 1024) problems.push(`${file.name}: larger than ${MAX_REFERENCE_MB} MB.`);
      else accepted.push({ id: `${file.name}-${file.size}-${Math.random()}`, file, preview: URL.createObjectURL(file) });
    }
    setReferences(prev => [...prev, ...accepted]);
    setErrors(prev => ({ ...prev, referenceImages: problems.length ? problems.join(' ') : undefined }));
  };

  const removeReference = id => {
    setReferences(prev => {
      const gone = prev.find(r => r.id === id);
      if (gone) URL.revokeObjectURL(gone.preview);
      return prev.filter(r => r.id !== id);
    });
    setErrors(prev => ({ ...prev, referenceImages: undefined }));
  };

  const clearReferences = () => {
    references.forEach(r => URL.revokeObjectURL(r.preview));
    setReferences([]);
  };

  const handleChange = e => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: undefined }));
  };

  // Props shared by every input: value binding, change handler and accessibility hooks.
  const bind = name => ({
    id: name,
    name,
    value: form[name],
    onChange: handleChange,
    'aria-invalid': errors[name] ? true : undefined,
    'aria-describedby': errors[name] ? `${name}-error` : undefined,
  });

  const handleSubmit = async e => {
    e.preventDefault();
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setStatus('error');
      setMessage('Please fix the highlighted fields.');
      document.getElementById(Object.keys(found)[0])?.focus();
      return;
    }

    setStatus('submitting');
    setMessage('');
    try {
      // Upload any reference images first, then send the order with their URLs.
      const referenceImages = [];
      for (const ref of references) {
        try {
          referenceImages.push(await uploadReference(ref.file));
        } catch (err) {
          setErrors({ referenceImages: err.message });
          setStatus('error');
          setMessage('One of your reference images could not be uploaded.');
          return;
        }
      }

      const res = await fetch(`${API_URL}/api/commissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, referenceImages }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrors(data.errors || {});
        setStatus('error');
        setMessage(data.message || 'Something went wrong. Please try again.');
        return;
      }
      setOrderId(data.id);
      setStatus('success');
    } catch {
      setStatus('error');
      setMessage('Could not reach the server. Please check your connection and try again.');
    }
  };

  const handleCancel = () => {
    const changed = references.length > 0 || Object.keys(EMPTY_FORM).some(key => form[key] !== EMPTY_FORM[key]);
    if (changed && !window.confirm('Discard the details you have entered?')) return;
    setForm(EMPTY_FORM);
    clearReferences();
    setErrors({});
    setStatus('idle');
    setMessage('');
  };

  const startNewOrder = () => {
    setForm(EMPTY_FORM);
    clearReferences();
    setErrors({});
    setOrderId(null);
    setStatus('idle');
  };

  if (staticSite) {
    return (
      <section className="commission-static">
        <p className="commission-welcome">Let&rsquo;s make something unforgettable.</p>
        <p>
          For commissions, send a quick email with your idea, preferred size, deadline and any reference images.
          I&rsquo;ll reply with availability, a quote and next steps.
        </p>
        <a className="btn btn-primary" href="mailto:aanantfm@gmail.com?subject=Commission%20enquiry%20for%20TheFanartGuy">
          Start a commission
        </a>
        <p className="commission-note">You can also find TheFanartGuy on Instagram for works in progress and updates.</p>
      </section>
    );
  }

  if (status === 'success') {
    return (
      <div className="commission-success" role="status">
        <h2>Order received!</h2>
        <p>
          Thanks, {form.firstName}! Your commission <strong>&ldquo;{form.commissionTitle}&rdquo;</strong> has
          been saved as order <strong>#{orderId}</strong>. I&rsquo;ll get in touch at {form.email} soon.
        </p>
        <button type="button" className="btn btn-primary" onClick={startNewOrder}>
          Place another order
        </button>
      </div>
    );
  }

  return (
    <form className="commission-form" onSubmit={handleSubmit} noValidate>
      <p className="commission-welcome">
        Thanks for choosing Thefanartguy as your favourite artist. Please enter your commission
        details further to proceed.
      </p>

      <fieldset>
        <legend>Your details</legend>
        <div className="form-grid three">
          <Field label="First name" name="firstName" error={errors.firstName} required>
            <input type="text" autoComplete="given-name" maxLength={50} {...bind('firstName')} />
          </Field>
          <Field label="Middle name" name="middleName" error={errors.middleName}>
            <input type="text" autoComplete="additional-name" maxLength={50} {...bind('middleName')} />
          </Field>
          <Field label="Last name" name="lastName" error={errors.lastName} required>
            <input type="text" autoComplete="family-name" maxLength={50} {...bind('lastName')} />
          </Field>
        </div>
        <div className="form-grid two">
          <Field label="Date of birth" name="dateOfBirth" error={errors.dateOfBirth} required>
            <input type="date" autoComplete="bday" max={localDate(-1)} {...bind('dateOfBirth')} />
          </Field>
          <Field label="Email address" name="email" error={errors.email} required>
            <input type="email" autoComplete="email" maxLength={120} {...bind('email')} />
          </Field>
        </div>
        <Field label="Contact number" name="phoneNumber" error={errors.phoneNumber} required>
          <div className="phone-input">
            <select name="phoneCountry" value={form.phoneCountry} onChange={handleChange} aria-label="Country code">
              {COUNTRIES.map(c => (
                <option key={c.name} value={c.name}>{c.dialCode} {c.name}</option>
              ))}
            </select>
            <input type="tel" autoComplete="tel-national" inputMode="tel" maxLength={20} placeholder="98765 43210" {...bind('phoneNumber')} />
          </div>
        </Field>
      </fieldset>

      <fieldset>
        <legend>Commission</legend>
        <Field label="Title of the commission" name="commissionTitle" error={errors.commissionTitle} required>
          <input type="text" maxLength={120} placeholder="e.g. Jailer-style poster of my dog" {...bind('commissionTitle')} />
        </Field>
        <Field label="Description" name="description" error={errors.description} required>
          <textarea rows={5} maxLength={3000} placeholder="Characters, style, size, colours, references..." {...bind('description')} />
        </Field>
        <div className="form-grid two">
          <Field label="Budget" name="budget" error={errors.budget} required>
            <div className="budget-input">
              <select name="currency" value={form.currency} onChange={handleChange} aria-label="Currency">
                <option value="INR">₹ INR</option>
                <option value="USD">$ USD</option>
                <option value="EUR">€ EUR</option>
                <option value="GBP">£ GBP</option>
              </select>
              <input type="number" min="1" step="1" inputMode="numeric" {...bind('budget')} />
            </div>
          </Field>
          <Field label="Expected date of delivery" name="expectedDelivery" error={errors.expectedDelivery} required>
            <input type="date" min={localDate(1)} {...bind('expectedDelivery')} />
          </Field>
        </div>
        <Field label="Additional details" name="additionalDetails" error={errors.additionalDetails}>
          <textarea rows={3} maxLength={3000} placeholder="Anything else I should know?" {...bind('additionalDetails')} />
        </Field>
      </fieldset>

      <fieldset>
        <legend>Reference images (optional)</legend>
        <p className="reference-hint">
          Got a photo, sketch or style you&rsquo;d like me to follow? Add up to {MAX_REFERENCE_IMAGES} images
          (JPEG, PNG, WebP or GIF, max {MAX_REFERENCE_MB} MB each).
        </p>
        <input
          ref={referenceInput}
          type="file"
          accept={REFERENCE_TYPES.join(',')}
          multiple
          onChange={addReferences}
          hidden
        />
        <div className={`reference-grid ${errors.referenceImages ? 'has-error' : ''}`}>
          {references.map((ref, i) => (
            <figure key={ref.id} className="reference-thumb">
              <img src={ref.preview} alt={`Reference ${i + 1}: ${ref.file.name}`} />
              <button
                type="button"
                className="reference-remove"
                onClick={() => removeReference(ref.id)}
                aria-label={`Remove ${ref.file.name}`}
                disabled={status === 'submitting'}
              >
                ×
              </button>
            </figure>
          ))}
          {references.length < MAX_REFERENCE_IMAGES && (
            <button
              type="button"
              className="reference-add"
              onClick={() => referenceInput.current.click()}
              disabled={status === 'submitting'}
            >
              <span aria-hidden="true">+</span>
              {references.length ? 'Add more' : 'Add images'}
            </button>
          )}
        </div>
        {errors.referenceImages && <span className="field-error" role="alert">{errors.referenceImages}</span>}
      </fieldset>

      <fieldset>
        <legend>Address</legend>
        <Field label="Address line 1" name="addressLine1" error={errors.addressLine1} required>
          <input type="text" autoComplete="address-line1" maxLength={150} {...bind('addressLine1')} />
        </Field>
        <Field label="Address line 2" name="addressLine2" error={errors.addressLine2}>
          <input type="text" autoComplete="address-line2" maxLength={150} {...bind('addressLine2')} />
        </Field>
        <div className="form-grid two">
          <Field label="Landmark" name="landmark" error={errors.landmark}>
            <input type="text" maxLength={100} {...bind('landmark')} />
          </Field>
          <Field label="State" name="state" error={errors.state} required>
            <input type="text" autoComplete="address-level1" maxLength={60} {...bind('state')} />
          </Field>
          <Field label="Country" name="country" error={errors.country} required>
            <select autoComplete="country-name" {...bind('country')}>
              {COUNTRIES.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Pincode" name="pincode" error={errors.pincode} required>
            <input type="text" autoComplete="postal-code" maxLength={10} {...bind('pincode')} />
          </Field>
        </div>
      </fieldset>

      {message && <p className="form-message" role="alert">{message}</p>}

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={status === 'submitting'}>
          {status === 'submitting' ? (references.length ? 'Uploading images…' : 'Placing order…') : 'Confirm Order'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={handleCancel} disabled={status === 'submitting'}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export default Commissions;
