import { useEffect, useState } from 'react';
import { useData } from '../contexts/DataContext.jsx';
import { TEMPLATE_KEYS, fillTemplate } from '../lib/whatsapp.js';

const ORDER = [
  TEMPLATE_KEYS.INITIAL,
  TEMPLATE_KEYS.SENT,
  TEMPLATE_KEYS.HIRED,
  TEMPLATE_KEYS.TWO_MONTHS_CHECK,
  TEMPLATE_KEYS.IRRELEVANT
];

const SAMPLE = { firstName: 'דני', lastName: 'כהן', area: 'תל אביב' };

export default function TemplatesPage() {
  const { templates, updateTemplate } = useData();
  const [drafts, setDrafts] = useState({});

  useEffect(() => {
    const initial = {};
    for (const k of ORDER) initial[k] = templates?.[k]?.body || '';
    setDrafts(initial);
  }, [templates]);

  function save(key) {
    updateTemplate(key, { body: drafts[key] });
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold">תבניות הודעות WhatsApp</h1>
        <p className="text-slate-500 text-sm">
          ההודעות נפתחות ידנית ב-WhatsApp; המערכת אינה שולחת אוטומטית. ניתן לערוך טקסט, ולשלב משתנים:
          <code className="ltr-cell mx-1 font-mono">&#123;שם פרטי&#125;</code>,
          <code className="ltr-cell mx-1 font-mono">&#123;אזור/אתר&#125;</code>.
        </p>
      </header>

      <div className="grid lg:grid-cols-2 gap-4">
        {ORDER.map((key) => {
          const t = templates?.[key];
          if (!t) return null;
          const preview = fillTemplate(drafts[key] || '', SAMPLE);
          return (
            <div key={key} className="card p-5">
              <h2 className="text-lg font-semibold mb-2">{t.title}</h2>
              <textarea
                className="input min-h-[120px]"
                value={drafts[key] || ''}
                onChange={(e) => setDrafts((d) => ({ ...d, [key]: e.target.value }))}
              />
              <div className="mt-2 rounded-lg bg-slate-50 border border-slate-200 p-3 text-sm whitespace-pre-wrap">
                <div className="text-xs text-slate-500 mb-1">תצוגה מקדימה (דוגמה)</div>
                {preview}
              </div>
              <div className="mt-3 flex justify-end">
                <button className="btn-primary" onClick={() => save(key)} disabled={drafts[key] === t.body}>
                  שמירה
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
