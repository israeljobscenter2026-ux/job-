import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { STATUSES } from '../lib/statuses.js';
import { DEFAULT_TEMPLATES } from '../lib/whatsapp.js';
import { sanitizeText } from '../lib/validation.js';
import { isSupabaseConfigured, supabase } from '../lib/supabase.js';
import { useAuth } from './AuthContext.jsx';

const DataContext = createContext(null);

const TWO_MONTHS_MS = 1000 * 60 * 60 * 24 * 60;
const LANDING_PAGE_URL = 'https://israel-jobs-center2026.netlify.app/';

function leadFromRow(row) {
  return {
    id: row.id,
    firstName: row.first_name || '',
    lastName: row.last_name || '',
    phone: row.phone || '',
    idNumber: row.id_number || '',
    area: row.area || '',
    city: row.city || '',
    project: row.project || '',
    jobRole: row.job_role || '',
    jobType: row.job_type || '',
    status: row.status || STATUSES.NEW,
    notes: row.notes || '',
    hireDate: row.hire_date,
    statusHistory: row.status_history || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function leadToRow(payload) {
  return {
    first_name: sanitizeText(payload.firstName).trim(),
    last_name: sanitizeText(payload.lastName).trim(),
    phone: String(payload.phone || '').replace(/\D/g, ''),
    id_number: String(payload.idNumber || '').replace(/\D/g, ''),
    area: sanitizeText(payload.area).trim(),
    city: sanitizeText(payload.city || '').trim(),
    project: sanitizeText(payload.project || '').trim(),
    job_role: sanitizeText(payload.jobRole || '').trim(),
    job_type: payload.jobType || payload.jobRole || ''
  };
}

function leadPatchToRow(patch) {
  const row = { updated_at: new Date().toISOString() };
  if (patch.firstName !== undefined) row.first_name = sanitizeText(patch.firstName).trim();
  if (patch.lastName !== undefined) row.last_name = sanitizeText(patch.lastName).trim();
  if (patch.phone !== undefined) row.phone = String(patch.phone || '').replace(/\D/g, '');
  if (patch.idNumber !== undefined) row.id_number = String(patch.idNumber || '').replace(/\D/g, '');
  if (patch.area !== undefined) row.area = sanitizeText(patch.area).trim();
  if (patch.city !== undefined) row.city = sanitizeText(patch.city).trim();
  if (patch.project !== undefined) row.project = sanitizeText(patch.project).trim();
  if (patch.jobRole !== undefined) row.job_role = sanitizeText(patch.jobRole).trim();
  if (patch.jobType !== undefined) row.job_type = patch.jobType;
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.notes !== undefined) row.notes = sanitizeText(patch.notes);
  if (patch.hireDate !== undefined) row.hire_date = patch.hireDate;
  if (patch.statusHistory !== undefined) row.status_history = patch.statusHistory;
  return row;
}

function areaFromRow(row) {
  return { id: row.id, name: row.name };
}

function adFromRow(row) {
  return {
    id: row.id,
    title: row.title || '',
    body: row.body || '',
    image: row.image || '',
    notes: row.notes || '',
    status: row.status || 'draft',
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function adToRow(payload) {
  const body = withLandingPageLink(payload.body || '');
  return {
    title: sanitizeText(payload.title || body.split('\n').find(Boolean) || 'פרסומת').trim(),
    body,
    image: payload.image || '',
    notes: sanitizeText(payload.notes || '')
  };
}

function adPatchToRow(patch) {
  const row = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) row.title = sanitizeText(patch.title).trim();
  if (patch.body !== undefined) row.body = withLandingPageLink(patch.body);
  if (patch.image !== undefined) row.image = patch.image || '';
  if (patch.notes !== undefined) row.notes = sanitizeText(patch.notes);
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.publishedAt !== undefined) row.published_at = patch.publishedAt;
  return row;
}

function withLandingPageLink(body) {
  const clean = sanitizeText(body || '').trim();
  if (!clean) return LANDING_PAGE_URL;

  const withoutExistingLink = clean
    .split('\n')
    .filter((line) => line.trim() !== LANDING_PAGE_URL)
    .join('\n')
    .trim();

  return `${withoutExistingLink}\n\n${LANDING_PAGE_URL}`;
}

function templatesFromRows(rows) {
  const next = { ...DEFAULT_TEMPLATES };
  for (const row of rows || []) {
    next[row.key] = { title: row.title, body: row.body };
  }
  return next;
}

export function DataProvider({ children }) {
  const { user, ready: authReady } = useAuth();
  const [leads, setLeadsState] = useState([]);
  const [areas, setAreasState] = useState([]);
  const [templates, setTemplatesState] = useState(DEFAULT_TEMPLATES);
  const [ads, setAdsState] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refreshData = useCallback(async () => {
    if (!authReady) return;
    setLoading(true);
    setError(null);

    if (!isSupabaseConfigured) {
      setError('Supabase לא מוגדר.');
      setLoading(false);
      return;
    }

    const areasQuery = supabase.from('areas').select('*').order('name');
    const { data: areaRows, error: areasError } = await areasQuery;
    if (areasError) setError(areasError.message);
    setAreasState((areaRows || []).map(areaFromRow));

    if (!user) {
      setLeadsState([]);
      setTemplatesState(DEFAULT_TEMPLATES);
      setAdsState([]);
      setLoading(false);
      return;
    }

    const [leadsResult, templatesResult, adsResult] = await Promise.all([
      supabase.from('leads').select('*').order('created_at', { ascending: false }),
      supabase.from('templates').select('*'),
      supabase.from('ads').select('*').order('created_at', { ascending: false })
    ]);

    if (leadsResult.error || templatesResult.error || adsResult.error) {
      setError(leadsResult.error?.message || templatesResult.error?.message || adsResult.error?.message);
    }

    setLeadsState((leadsResult.data || []).map(leadFromRow));
    setTemplatesState(templatesFromRows(templatesResult.data || []));
    setAdsState((adsResult.data || []).map(adFromRow));
    setLoading(false);
  }, [authReady, user]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const createLead = useCallback(async (payload) => {
    const now = new Date().toISOString();
    const row = {
      ...leadToRow(payload),
      status: STATUSES.NEW,
      notes: '',
      status_history: [{ status: STATUSES.NEW, at: now, by: 'מערכת' }]
    };

    const { error: insertError } = await supabase.from('leads').insert(row);
    if (insertError) throw insertError;
    if (user) await refreshData();
    return null;
  }, [refreshData, user]);

  const updateLead = useCallback(async (id, patch, actor = 'מנהל') => {
    const current = leads.find((l) => l.id === id);
    if (!current) return;

    const normalized = { ...patch };
    if (patch.status && patch.status !== current.status) {
      normalized.statusHistory = [
        ...(current.statusHistory || []),
        { status: patch.status, at: new Date().toISOString(), by: actor }
      ];
    }

    const { data, error: updateError } = await supabase
      .from('leads')
      .update(leadPatchToRow(normalized))
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;
    setLeadsState((list) => list.map((lead) => (lead.id === id ? leadFromRow(data) : lead)));
  }, [leads]);

  const deleteLead = useCallback(async (id) => {
    const { error: deleteError } = await supabase.from('leads').delete().eq('id', id);
    if (deleteError) throw deleteError;
    setLeadsState((list) => list.filter((lead) => lead.id !== id));
  }, []);

  const addArea = useCallback(async (name) => {
    const clean = sanitizeText(name).trim();
    if (!clean) return;
    const { data, error: insertError } = await supabase
      .from('areas')
      .insert({ name: clean })
      .select()
      .single();
    if (insertError) throw insertError;
    setAreasState((list) => [...list, areaFromRow(data)].sort((a, b) => a.name.localeCompare(b.name, 'he')));
  }, []);

  const updateArea = useCallback(async (id, name) => {
    const clean = sanitizeText(name).trim();
    if (!clean) return;
    const { data, error: updateError } = await supabase
      .from('areas')
      .update({ name: clean })
      .eq('id', id)
      .select()
      .single();
    if (updateError) throw updateError;
    setAreasState((list) => list.map((area) => (area.id === id ? areaFromRow(data) : area)));
  }, []);

  const deleteArea = useCallback(async (id) => {
    const { error: deleteError } = await supabase.from('areas').delete().eq('id', id);
    if (deleteError) throw deleteError;
    setAreasState((list) => list.filter((area) => area.id !== id));
  }, []);

  const createAd = useCallback(async (payload) => {
    const { data, error: insertError } = await supabase
      .from('ads')
      .insert(adToRow(payload))
      .select()
      .single();
    if (insertError) throw insertError;
    setAdsState((list) => [adFromRow(data), ...list]);
  }, []);

  const updateAd = useCallback(async (id, patch) => {
    const { data, error: updateError } = await supabase
      .from('ads')
      .update(adPatchToRow(patch))
      .eq('id', id)
      .select()
      .single();
    if (updateError) throw updateError;
    setAdsState((list) => list.map((ad) => (ad.id === id ? adFromRow(data) : ad)));
  }, []);

  const publishAd = useCallback(async (id, dateIso) => {
    const publishedAt = dateIso ? new Date(dateIso).toISOString() : new Date().toISOString();
    await updateAd(id, { status: 'published', publishedAt });
  }, [updateAd]);

  const unpublishAd = useCallback(async (id) => {
    await updateAd(id, { status: 'draft', publishedAt: null });
  }, [updateAd]);

  const deleteAd = useCallback(async (id) => {
    const { error: deleteError } = await supabase.from('ads').delete().eq('id', id);
    if (deleteError) throw deleteError;
    setAdsState((list) => list.filter((ad) => ad.id !== id));
  }, []);

  const updateTemplate = useCallback(async (key, patch) => {
    const current = templates[key] || DEFAULT_TEMPLATES[key];
    const next = { ...current, ...patch };
    const { error: upsertError } = await supabase
      .from('templates')
      .upsert({
        key,
        title: next.title,
        body: next.body,
        updated_at: new Date().toISOString()
      });
    if (upsertError) throw upsertError;
    setTemplatesState((list) => ({ ...list, [key]: next }));
  }, [templates]);

  const remindersDue = useMemo(() => {
    const now = Date.now();
    return leads.filter((lead) => {
      if (lead.status !== STATUSES.HIRED || !lead.hireDate) return false;
      const hired = new Date(lead.hireDate).getTime();
      if (Number.isNaN(hired)) return false;
      return now - hired >= TWO_MONTHS_MS;
    });
  }, [leads]);

  const stats = useMemo(() => {
    const total = leads.length;
    const byStatus = {};
    for (const status of Object.values(STATUSES)) byStatus[status] = 0;
    for (const lead of leads) byStatus[lead.status] = (byStatus[lead.status] || 0) + 1;
    return { total, byStatus, reminders: remindersDue.length };
  }, [leads, remindersDue]);

  const value = useMemo(() => ({
    leads, areas, templates, ads,
    loading, error, refreshData,
    createLead, updateLead, deleteLead,
    addArea, updateArea, deleteArea,
    updateTemplate,
    createAd, updateAd, publishAd, unpublishAd, deleteAd,
    remindersDue, stats
  }), [
    leads, areas, templates, ads, loading, error, refreshData,
    createLead, updateLead, deleteLead,
    addArea, updateArea, deleteArea,
    updateTemplate,
    createAd, updateAd, publishAd, unpublishAd, deleteAd,
    remindersDue, stats
  ]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside DataProvider');
  return ctx;
}
