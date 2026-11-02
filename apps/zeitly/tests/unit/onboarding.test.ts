import { describe, expect, it } from 'vitest';
import { ageAt, checkProfile, completeness, needsWorkPermit, oegkMinimalRegistration, profileSchema, validateIban, validateSvNumber } from '@/domain/onboarding';

describe('SV-Nummer', () => {
  it('accepts a valid number and derives the birth date', () => {
    // 1237 010180: weights 3,7,9,0,5,8,4,2,1,6 → 1*3+2*7+3*9+0*0+0*5+1*8+0*4+1*2+8*1+0*6 = 3+14+27+8+2+8 = 62 → 62 % 11 = 7
    const r = validateSvNumber('1237 010180');
    expect(r.ok).toBe(true);
    expect(r.birthDate).toBe('1980-01-01');
  });
  it('rejects wrong check digit and bad length', () => {
    expect(validateSvNumber('1234010180').ok).toBe(false);
    expect(validateSvNumber('123').ok).toBe(false);
  });
});

describe('IBAN', () => {
  it('validates Austrian and German IBANs via mod 97', () => {
    expect(validateIban('AT61 1904 3002 3457 3201').ok).toBe(true);
    expect(validateIban('DE89 3704 0044 0532 0130 00').ok).toBe(true);
    expect(validateIban('AT61 1904 3002 3457 3202').ok).toBe(false);
    expect(validateIban('AT61190430023457320').ok).toBe(false);
  });
});

describe('profile checks', () => {
  const base = {
    person: { firstName: 'Manuela', lastName: 'Behr', birthDate: '1980-01-01', svNumber: '1237010180', nationality: 'Österreich' },
    contact: { street: 'Neustift 6', zip: '2224', city: 'Sulz im Weinviertel', country: 'Österreich', phone: '+43 664 1234567' },
    bank: { iban: 'AT611904300234573201' },
    tax: { children: [], avabRequested: false, pendlerrechnerDone: false, otherEmployment: false },
    employment: { jobTitle: 'Vertrieb', startDate: '2030-01-01', weeklyHours: 40, firstJobInAustria: false },
  };
  it('parses a complete profile', () => {
    const r = profileSchema.safeParse(base);
    expect(r.success).toBe(true);
    expect(completeness(base)).toBe(100);
  });
  it('flags missing documents as warnings only', () => {
    const issues = checkProfile(profileSchema.parse(base), ['id_card', 'ecard', 'meldezettel', 'bank_proof']);
    expect(issues.filter((i) => i.severity === 'error')).toHaveLength(0);
  });
  it('requires a work permit for third-country nationals', () => {
    const p = profileSchema.parse({ ...base, person: { ...base.person, nationality: 'Serbien' } });
    const issues = checkProfile(p, ['id_card', 'ecard', 'meldezettel']);
    expect(issues.some((i) => i.field === 'employment.workPermitType' && i.severity === 'error')).toBe(true);
    expect(issues.some((i) => i.field === 'docs.residence_permit')).toBe(true);
    expect(needsWorkPermit('Deutschland')).toBe(false);
    expect(needsWorkPermit('Schweiz')).toBe(false);
  });
  it('blocks under-15 and warns for minors (KJBG)', () => {
    const minor = profileSchema.parse({ ...base, person: { ...base.person, birthDate: '2013-06-01', svNumber: '1237010180' }, employment: { ...base.employment, startDate: '2027-07-01' } });
    const issues = checkProfile(minor, []);
    expect(issues.some((i) => i.message.includes('Unter 15'))).toBe(true);
    const teen = profileSchema.parse({ ...base, person: { ...base.person, birthDate: '2010-06-01' }, employment: { ...base.employment, startDate: '2027-07-01' } });
    expect(checkProfile(teen, []).some((i) => i.message.includes('KJBG'))).toBe(true);
    expect(ageAt('2010-06-01', '2027-07-01')).toBe(17);
  });
  it('warns when the SV number date differs from the birth date', () => {
    const p = profileSchema.parse({ ...base, person: { ...base.person, birthDate: '1981-02-02' } });
    expect(checkProfile(p, []).some((i) => i.field === 'person.svNumber' && i.severity === 'warn')).toBe(true);
  });
  it('produces ÖGK minimal registration data', () => {
    const r = oegkMinimalRegistration(profileSchema.parse(base), { legalName: 'STEINERfood GmbH' });
    expect(r.nachname).toBe('Behr');
    expect(r.svNummer).toBe('1237010180');
    expect(r.beschaeftigungsbeginn).toBe('2030-01-01');
  });
  it('reports completeness for partial input', () => {
    expect(completeness({ person: { firstName: 'A' } } as never)).toBeLessThan(20);
  });
});
