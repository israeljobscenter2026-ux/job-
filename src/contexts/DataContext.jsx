import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  getLeads, setLeads,
  getAreas, setAreas,
  getTemplates, setTemplates,
  getAds, setAds,
  uuid
} from '../lib/storage.js';
import { STATUSES } from '../lib/statuses.js';
import { DEFAULT_TEMPLATES } from '../lib/whatsapp.js';
import { sanitizeText } from '../lib/validation.js';

const DataContext = createContext(null);

const TWO_MONTHS_MS = 1000 * 60 * 60 * 24 * 60;

export function DataProvider({ children }) {
  const [leads, setLeadsState] = useState(() => getLeads());
  const [areas, setAreasState] = useState(() => getAreas());
  const [templates, setTemplatesState] = useState(() => getTemplates() || DEFAULT_TEMPLATES);
  const [ads, setAdsState] = useState(() => getAds());

  useEffect(() => {
    if (!getTemplates()) setTemplates(DEFAULT_TEMPLATES);
  }, []);

  function persistLeads(next) {
    setLeads(next);
    setLeadsState(next);
  }
  function persistAreas(next) {
    setAreas(next);
    setAreasState(next);
  }
  function persistTemplates(next) {
    setTemplates(next);
    setTemplatesState(next);
  }
  function persistAds(next) {
    setAds(next);
    setAdsState(next);
  }

  // --- Leads CRUD -----------------------------------------------------------
  const createLead = useCallback((payload) => {
    const now = new Date().toISOString();
    const lead = {
      id: uuid(),
      firstName: sanitizeText(payload.firstName).trim(),
      lastName: sanitizeText(payload.lastName).trim(),
      phone: String(payload.phone || '').replace(/\D/g, ''),
      idNumber: String(payload.idNumber || '').replace(/\D/g, ''),
      area: sanitizeText(payload.area).trim(),
      jobType: payload.jobType,
      status: STATUSES.NEW,
      notes: '',
      hireDate: null,
      createdAt: now,
      updatedAt: now,
      statusHistory: [{ status: STATUSES.NEW, at: now, by: 'מערכת' }]
    };
    const next = [lead, ...getLeads()];
    persistLeads(next);
    return lead;
  }, []);

  const updateLead = useCallback((id, patch, actor = 'מנהל') => {
    const current = getLeads();
    const next = current.map((l) => {
      if (l.id !== id) return l;
      const updated = { ...l, ...patch, updatedAt: new Date().toISOString() };
      if (patch.notes !== undefined) updated.notes = sanitizeText(patch.notes);
      if (patch.firstName !== undefined) updated.firstName = sanitizeText(patch.firstName).trim();
      if (patch.lastName !== undefined) updated.lastName = sanitizeText(patch.lastName).trim();
      if (patch.area !== undefined) updated.area = sanitizeText(patch.area).trim();
      if (patch.phone !== undefined) updated.phone = String(patch.phone).replace(/\D/g, '');
      if (patch.idNumber !== undefined) updated.idNumber = String(patch.idNumber).replace(/\D/g, '');

      if (patch.status && patch.status !== l.status) {
        updated.statusHistory = [
          ...(l.statusHistory || []),
          { status: patch.status, at: new Date().toISOString(), by: actor }
        ];
        if (patch.status !== STATUSES.HIRED && !patch.hireDate) {
          // Keep hireDate if it existed (so we can see history); only clear if explicitly asked.
        }
      }
      return updated;
    });
    persistLeads(next);
  }, []);

  const deleteLead = useCallback((id) => {
    persistLeads(getLeads().filter((l) => l.id !== id));
  }, []);

  // --- Areas CRUD -----------------------------------------------------------
  const addArea = useCallback((name) => {
    const clean = sanitizeText(name).trim();
    if (!clean) return;
    const current = getAreas();
    if (current.some((a) => a.name === clean)) return;
    persistAreas([...current, { id: uuid(), name: clean }]);
  }, []);

  const updateArea = useCallback((id, name) => {
    const clean = sanitizeText(name).trim();
    if (!clean) return;
    persistAreas(getAreas().map((a) => (a.id === id ? { ...a, name: clean } : a)));
  }, []);

  const deleteArea = useCallback((id) => {
    persistAreas(getAreas().filter((a) => a.id !== id));
  }, []);

  // --- Ads CRUD -------------------------------------------------------------
  const createAd = useCallback((payload) => {
    const now = new Date().toISOString();
    const ad = {
      id: uuid(),
      title: sanitizeText(payload.title).trim(),
      body: sanitizeText(payload.body),
      image: payload.image || '',
      notes: sanitizeText(payload.notes || ''),
      status: 'draft',
      publishedAt: null,
      createdAt: now,
      updatedAt: now
    };
    persistAds([ad, ...getAds()]);
    return ad;
  }, []);

  const updateAd = useCallback((id, patch) => {
    const next = getAds().map((a) => {
      if (a.id !== id) return a;
      const updated = { ...a, ...patch, updatedAt: new Date().toISOString() };
      if (patch.title !== undefined) updated.title = sanitizeText(patch.title).trim();
      if (patch.body !== undefined) updated.body = sanitizeText(patch.body);
      if (patch.notes !== undefined) updated.notes = sanitizeText(patch.notes);
      return updated;
    });
    persistAds(next);
  }, []);

  const publishAd = useCallback((id, dateIso) => {
    const now = new Date().toISOString();
    const publishedAt = dateIso ? new Date(dateIso).toISOString() : now;
    const next = getAds().map((a) => (
      a.id === id ? { ...a, status: 'published', publishedAt, updatedAt: now } : a
    ));
    persistAds(next);
  }, []);

  const unpublishAd = useCallback((id) => {
    const now = new Date().toISOString();
    const next = getAds().map((a) => (
      a.id === id ? { ...a, status: 'draft', publishedAt: null, updatedAt: now } : a
    ));
    persistAds(next);
  }, []);

  const deleteAd = useCallback((id) => {
    persistAds(getAds().filter((a) => a.id !== id));
  }, []);

  // --- Templates ------------------------------------------------------------
  const updateTemplate = useCallback((key, patch) => {
    const next = { ...getTemplates() || DEFAULT_TEMPLATES };
    next[key] = { ...next[key], ...patch };
    persistTemplates(next);
  }, []);

  // --- Derived: reminders ---------------------------------------------------
  const remindersDue = useMemo(() => {
    const now = Date.now();
    return leads.filter((l) => {
      if (l.status !== STATUSES.HIRED || !l.hireDate) return false;
      const hired = new Date(l.hireDate).getTime();
      if (Number.isNaN(hired)) return false;
      return now - hired >= TWO_MONTHS_MS;
    });
  }, [leads]);

  const stats = useMemo(() => {
    const total = leads.length;
    const byStatus = {};
    for (const s of Object.values(STATUSES)) byStatus[s] = 0;
    for (const l of leads) byStatus[l.status] = (byStatus[l.status] || 0) + 1;
    return { total, byStatus, reminders: remindersDue.length };
  }, [leads, remindersDue]);

  const value = useMemo(() => ({
    leads, areas, templates, ads,
    createLead, updateLead, deleteLead,
    addArea, updateArea, deleteArea,
    updateTemplate,
    createAd, updateAd, publishAd, unpublishAd, deleteAd,
    remindersDue, stats
  }), [leads, areas, templates, ads, createLead, updateLead, deleteLead, addArea, updateArea, deleteArea, updateTemplate, createAd, updateAd, publishAd, unpublishAd, deleteAd, remindersDue, stats]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside DataProvider');
  return ctx;
}
