'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { apiGet, apiPost } from '@/lib/api-client';
import { useNotification } from '@/contexts/NotificationContext';
import { useAuth } from '@/contexts/AuthContext';
import { exportToPDF } from '@/lib/export-utils';
import SearchableDropdown from '@/components/SearchableDropdown';
import styles from './EmployeeJoiningPage.module.scss';

const RELIGIONS = ['Hindu', 'Muslim', 'Christian', 'Sikh', 'Buddhist', 'Jain', 'Other'];
const RELIGION_ITEMS = RELIGIONS.map((r) => ({ value: r, label: r }));

export default function EmployeeJoiningPage() {
  const { success, error: notifyError } = useNotification();
  const { currentUser } = useAuth();

  // Personal info
  const [name, setName] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [dob, setDob] = useState('');
  const [religion, setReligion] = useState('');
  const [aadhaar, setAadhaar] = useState('');
  const [contact, setContact] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactNumber, setEmergencyContactNumber] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Address
  const [village, setVillage] = useState('');
  const [post, setPost] = useState('');
  const [ps, setPs] = useState('');
  const [district, setDistrict] = useState('');
  const [pin, setPin] = useState('');

  // Bank
  const [bankName, setBankName] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [uan, setUan] = useState('');

  // Employment
  const [designation, setDesignation] = useState('');
  const [positionErection, setPositionErection] = useState(false);
  const [positionSheeting, setPositionSheeting] = useState(false);
  const [positionCategory, setPositionCategory] = useState('');
  const [site, setSite] = useState('');
  const [joinDate, setJoinDate] = useState(new Date().toISOString().substring(0, 10));
  const [termsAccepted, setTermsAccepted] = useState(false);

  // UI state
  const [loading, setLoading] = useState(false);
  const [nextAutoId, setNextAutoId] = useState('ATR-EMP-001');
  const [aadhaarError, setAadhaarError] = useState('');

  // Dropdown items
  const [categoryItems, setCategoryItems] = useState<{ value: string; label: string }[]>([]);
  const [siteItems, setSiteItems] = useState<{ value: string; label: string }[]>([]);

  const photoInputRef = useRef<HTMLInputElement>(null);

  const calculatedAge = useMemo(() => {
    if (!dob) return null;
    const birth = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  }, [dob]);

  const workingPositions = useMemo(() => {
    const positions: string[] = [];
    if (positionErection) positions.push('Erection');
    if (positionSheeting) positions.push('Sheeting');
    return positions.join(', ');
  }, [positionErection, positionSheeting]);

  const loadNextAutoId = useCallback(async () => {
    try {
      const res = await apiGet<{ next_id?: string }>('/employees/next-id');
      if (res?.next_id) setNextAutoId(res.next_id);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    apiGet<{ id: string | number; name: string }[]>('/employee-categories')
      .then((cats) =>
        setCategoryItems(cats.map((c) => ({ value: String(c.id), label: c.name })))
      )
      .catch((err: any) => notifyError(err.message ?? 'Failed to load categories'));

    apiGet<{ id: string | number; name: string }[]>('/sites')
      .then((sites) =>
        setSiteItems(sites.map((s) => ({ value: String(s.id), label: s.name })))
      )
      .catch((err: any) => notifyError(err.message ?? 'Failed to load sites'));

    loadNextAutoId();
  }, [notifyError, loadNextAutoId]);

  const onPhotoSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      notifyError('Photo must be under 5MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleAadhaarInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '').substring(0, 12);
    const formatted = digits.replace(/(\d{4})(?=\d)/g, '$1 ');
    setAadhaar(formatted);
    setAadhaarError('');
    if (digits.length === 12) {
      validateAadhaar(digits);
    }
  };

  const validateAadhaar = async (digits: string) => {
    if (digits.length !== 12 || /^0/.test(digits)) {
      setAadhaarError('Invalid Aadhaar number');
      return;
    }
    try {
      const res = await apiGet<{ exists?: boolean }>('/employees/check-aadhaar', {
        aadhaar: digits,
      });
      if (res?.exists) setAadhaarError('Aadhaar already registered');
    } catch {
      // ignore
    }
  };

  const resetForm = () => {
    setName('');
    setFatherName('');
    setDob('');
    setReligion('');
    setAadhaar('');
    setContact('');
    setWhatsapp('');
    setEmergencyContactName('');
    setEmergencyContactNumber('');
    setPhotoPreview(null);
    setVillage('');
    setPost('');
    setPs('');
    setDistrict('');
    setPin('');
    setBankName('');
    setAccountHolder('');
    setAccountNumber('');
    setIfscCode('');
    setUan('');
    setDesignation('');
    setPositionErection(false);
    setPositionSheeting(false);
    setPositionCategory('');
    setSite('');
    setJoinDate(new Date().toISOString().substring(0, 10));
    setTermsAccepted(false);
    setAadhaarError('');
  };

  const submitForm = async () => {
    if (!name || !aadhaar || !positionCategory || !site) {
      notifyError('Please fill all required fields.');
      return;
    }
    if (aadhaarError) {
      notifyError(aadhaarError);
      return;
    }
    if (!termsAccepted) {
      notifyError('Please accept Terms & Conditions.');
      return;
    }
    setLoading(true);
    try {
      const body = {
        name,
        father_name: fatherName,
        aadhaar: aadhaar.replace(/\s/g, ''),
        phone: contact,
        dob: dob || null,
        religion,
        village,
        post,
        ps,
        district,
        pin,
        uan,
        whatsapp,
        emergency_contact_name: emergencyContactName,
        emergency_contact_number: emergencyContactNumber,
        bank_name: bankName,
        account_holder: accountHolder,
        account_number: accountNumber,
        ifsc_code: ifscCode,
        category_id: positionCategory,
        current_site_id: site,
        designation,
        working_positions: workingPositions,
        join_date: joinDate || null,
        photo: photoPreview,
      };
      const res: any = await apiPost('/employees', body);
      const empId = res?.display_id || nextAutoId;
      success(`Employee "${name}" registered as ${empId}`);
      resetForm();
      loadNextAutoId();
    } catch (err: any) {
      notifyError(err.message ?? 'Failed to register employee');
    }
    setLoading(false);
  };

  const downloadRegistrationPDF = () => {
    exportToPDF({
      title: 'Employee Registration Form',
      fileName: `Registration_${name}`,
      companyName: 'ATR Construction Pvt. Ltd.',
      data: [
        {
          Field: 'Name',
          Value: name,
        },
        { Field: "Father's Name", Value: fatherName },
        { Field: 'DOB', Value: dob },
        { Field: 'Religion', Value: religion },
        { Field: 'Aadhaar', Value: aadhaar },
        { Field: 'Contact', Value: contact },
        { Field: 'WhatsApp', Value: whatsapp },
        { Field: 'Village', Value: village },
        { Field: 'Post', Value: post },
        { Field: 'PS', Value: ps },
        { Field: 'District', Value: district },
        { Field: 'PIN', Value: pin },
        { Field: 'Bank', Value: bankName },
        { Field: 'Account', Value: accountNumber },
        { Field: 'IFSC', Value: ifscCode },
        { Field: 'UAN', Value: uan },
        { Field: 'Designation', Value: designation },
        { Field: 'Positions', Value: workingPositions },
      ],
      columns: [
        { key: 'Field', header: 'Field' },
        { key: 'Value', header: 'Value' },
      ],
    });
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>
          <i className="ri-user-add-line" /> Employee Registration
        </h1>
        <span className={styles.autoIdBadge}>
          <i className="ri-hashtag" /> Next ID: {nextAutoId}
        </span>
      </div>

      {/* Personal Information */}
      <div className="card-container">
        <h3 className={styles.sectionTitle}>
          <i className="ri-user-line" /> Personal Information
        </h3>
        <div className={styles.formWithPhoto}>
          <div className="form-grid">
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label>Full Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Employee full name"
                required
              />
            </div>
            <div className="form-group">
              <label>Father&apos;s Name</label>
              <input
                type="text"
                value={fatherName}
                onChange={(e) => setFatherName(e.target.value)}
                placeholder="Father's name"
              />
            </div>
            <div className="form-group">
              <label>Date of Birth</label>
              <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
              {calculatedAge !== null && (
                <span className={styles.ageBadge}>Age: {calculatedAge} years</span>
              )}
            </div>
            <div className="form-group">
              <SearchableDropdown
                items={RELIGION_ITEMS}
                value={religion}
                onChange={setReligion}
                placeholder="Select Religion"
                label="Religion"
              />
            </div>
            <div className="form-group">
              <label>Aadhaar Number *</label>
              <input
                type="text"
                value={aadhaar}
                onChange={handleAadhaarInput}
                placeholder="XXXX XXXX XXXX"
                maxLength={14}
                required
              />
              {aadhaarError && (
                <span style={{ color: 'var(--danger)', fontSize: '12px' }}>{aadhaarError}</span>
              )}
            </div>
            <div className="form-group">
              <label>Contact Number</label>
              <input
                type="tel"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="10-digit mobile"
                pattern="[0-9]{10}"
                maxLength={10}
              />
            </div>
            <div className="form-group">
              <label>WhatsApp Number</label>
              <input
                type="tel"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="WhatsApp number"
                maxLength={10}
              />
            </div>
            <div className="form-group">
              <label>Emergency Contact Name</label>
              <input
                type="text"
                value={emergencyContactName}
                onChange={(e) => setEmergencyContactName(e.target.value)}
                placeholder="Emergency contact name"
              />
            </div>
            <div className="form-group">
              <label>Emergency Contact Number</label>
              <input
                type="tel"
                value={emergencyContactNumber}
                onChange={(e) => setEmergencyContactNumber(e.target.value)}
                placeholder="Emergency number"
                maxLength={10}
              />
            </div>
          </div>
          <div className={styles.photoUpload} onClick={() => photoInputRef.current?.click()}>
            {photoPreview ? (
              <img src={photoPreview} alt="Preview" className={styles.photoPreview} />
            ) : (
              <div className={styles.photoPlaceholder}>
                <i className="ri-camera-line" style={{ fontSize: 32, color: 'var(--text-muted)' }} />
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Click to upload</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Max 5MB</span>
              </div>
            )}
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              onChange={onPhotoSelected}
              style={{ display: 'none' }}
            />
          </div>
        </div>
      </div>

      {/* Address Details */}
      <div className="card-container">
        <h3 className={styles.sectionTitle}>
          <i className="ri-map-pin-line" /> Address Details
        </h3>
        <div className="form-grid">
          <div className="form-group">
            <label>Village / Town</label>
            <input
              type="text"
              value={village}
              onChange={(e) => setVillage(e.target.value)}
              placeholder="Village / Town"
            />
          </div>
          <div className="form-group">
            <label>Post Office</label>
            <input
              type="text"
              value={post}
              onChange={(e) => setPost(e.target.value)}
              placeholder="Post Office"
            />
          </div>
          <div className="form-group">
            <label>Police Station</label>
            <input
              type="text"
              value={ps}
              onChange={(e) => setPs(e.target.value)}
              placeholder="Police Station"
            />
          </div>
          <div className="form-group">
            <label>District</label>
            <input
              type="text"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              placeholder="District"
            />
          </div>
          <div className="form-group">
            <label>PIN Code</label>
            <input
              type="text"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="PIN Code"
              maxLength={6}
            />
          </div>
        </div>
      </div>

      {/* Bank Details */}
      <div className="card-container">
        <h3 className={styles.sectionTitle}>
          <i className="ri-bank-line" /> Bank Details
        </h3>
        <div className="form-grid">
          <div className="form-group">
            <label>Bank Name</label>
            <input
              type="text"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="Bank Name"
            />
          </div>
          <div className="form-group">
            <label>Account Holder Name</label>
            <input
              type="text"
              value={accountHolder}
              onChange={(e) => setAccountHolder(e.target.value)}
              placeholder="Account Holder Name"
            />
          </div>
          <div className="form-group">
            <label>Account Number</label>
            <input
              type="text"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder="Account Number"
            />
          </div>
          <div className="form-group">
            <label>IFSC Code</label>
            <input
              type="text"
              value={ifscCode}
              onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
              placeholder="IFSC Code"
            />
          </div>
          <div className="form-group">
            <label>UAN (PF Number)</label>
            <input
              type="text"
              value={uan}
              onChange={(e) => setUan(e.target.value)}
              placeholder="UAN Number"
            />
          </div>
        </div>
      </div>

      {/* Employment Details */}
      <div className="card-container">
        <h3 className={styles.sectionTitle}>
          <i className="ri-briefcase-line" /> Employment Details
        </h3>
        <div className="form-grid">
          <div className="form-group">
            <label>Designation</label>
            <input
              type="text"
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              placeholder="e.g. Mason, Helper"
            />
          </div>
          <div className="form-group">
            <label>Working Positions</label>
            <div className={styles.checkboxGroup}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={positionErection}
                  onChange={(e) => setPositionErection(e.target.checked)}
                />
                Erection
              </label>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={positionSheeting}
                  onChange={(e) => setPositionSheeting(e.target.checked)}
                />
                Sheeting
              </label>
            </div>
          </div>
          <div className="form-group">
            <SearchableDropdown
              items={categoryItems}
              value={positionCategory}
              onChange={setPositionCategory}
              placeholder="Select Category"
              label="Position Category *"
              required
            />
          </div>
          <div className="form-group">
            <SearchableDropdown
              items={siteItems}
              value={site}
              onChange={setSite}
              placeholder="Select Site"
              label="Site *"
              required
            />
          </div>
          <div className="form-group">
            <label>Join Date</label>
            <input
              type="date"
              value={joinDate}
              onChange={(e) => setJoinDate(e.target.value)}
            />
          </div>
        </div>

        <div className={styles.termsSection}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
            />
            I accept the Terms &amp; Conditions of employment
          </label>
        </div>
      </div>

      <div className={styles.formActions}>
        <button
          className="btn-primary"
          onClick={submitForm}
          disabled={loading}
        >
          <i className="ri-user-add-line" />{' '}
          {loading ? 'Registering...' : 'Register Employee'}
        </button>
        <button className="btn-secondary" onClick={resetForm} type="button">
          <i className="ri-refresh-line" /> Reset
        </button>
        <button
          className="btn-outline"
          onClick={downloadRegistrationPDF}
          type="button"
          disabled={!name}
        >
          <i className="ri-file-pdf-line" /> Download PDF
        </button>
      </div>
    </div>
  );
}
