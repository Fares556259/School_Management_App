'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { AlertCircle, ArrowLeft, ArrowRight, BellRing, Check, CheckCircle2, Clock3, GraduationCap, Loader2, MapPin, Phone, RefreshCw, Search, ShieldCheck, Users, X } from 'lucide-react';
import { useLanguage } from '@/lib/translations/LanguageContext';
import { parentAccessCopy } from '@/lib/parentAccessCopy';
import type { ParentAccessEntry as Entry, ParentAccessInboxData as Inbox } from '@/lib/parentAccessInbox';

type Decision = { action: 'APPROVE' | 'REJECT' | 'REVOKE'; entries: Entry[] };
const tones: Record<string, string> = { PENDING: 'bg-amber-50 text-amber-800', APPROVED: 'bg-emerald-50 text-emerald-800', REJECTED: 'bg-rose-50 text-rose-800', CANCELLED: 'bg-slate-100 text-slate-600', REVOKED: 'bg-rose-50 text-rose-800' };

export default function ParentAccessInbox({ initialData }: { initialData: Inbox }) {
  const { locale } = useLanguage();
  const c = parentAccessCopy[locale] || parentAccessCopy.fr;
  const [status, setStatus] = useState('PENDING');
  const [classId, setClassId] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Inbox>(initialData);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(() => new Date(initialData.fetchedAt));
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [details, setDetails] = useState<Entry | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [sessionRequired, setSessionRequired] = useState(false);
  const [slowSaving, setSlowSaving] = useState(false);
  useEffect(() => {
    if (!saving) { setSlowSaving(false); return; }
    const timer = setTimeout(() => setSlowSaving(true), 4_000);
    return () => clearTimeout(timer);
  }, [saving]);
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  const dataCache = useRef(new Map<string, Inbox>([['PENDING|||1', initialData]]));
  const pendingCountRef = useRef(initialData.counts.PENDING || 0);
  pendingCountRef.current = data.counts.PENDING || 0;
  const label = (s: string) => ({ PENDING: c.pending, APPROVED: c.approved, REJECTED: c.rejected, CANCELLED: c.cancelled, REVOKED: c.revoked }[s] || s);
  const date = (value: string) => new Intl.DateTimeFormat(locale === 'ar' ? 'ar-TN' : locale, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Tunis' }).format(new Date(value));
  useEffect(() => { const timer = setTimeout(() => { setQuery(search.trim()); setPage(1); }, 250); return () => clearTimeout(timer); }, [search]);
  const load = useCallback(async (quiet = false, includeMeta = false) => {
    controller.current?.abort();
    const abort = new AbortController(); controller.current = abort;
    const key = `${status}|${classId}|${query}|${page}`;
    const cached = dataCache.current.get(key);
    if (!quiet && cached) {
      setData(previous => ({ ...cached, counts: previous.counts, classes: previous.classes }));
      setRefreshing(true);
    } else if (quiet) setRefreshing(true);
    else setLoading(true);
    try {
      const params = new URLSearchParams({ status, classId, q: query, page: String(page), meta: includeMeta ? '1' : '0' });
      const response = await fetch(`/api/admin/parent-access?${params}`, { signal: abort.signal, cache: 'no-store' });
      if (response.redirected || response.status === 401) { setSessionRequired(true); throw new Error('session'); }
      if (!response.ok) throw new Error('load');
      const next: Inbox = await response.json();
      setData(previous => {
        const merged = {
          ...next,
          counts: Object.keys(next.counts).length ? next.counts : previous.counts,
          classes: next.classes.length ? next.classes : previous.classes,
        };
        dataCache.current.set(key, merged);
        return merged;
      });
      setLastUpdatedAt(new Date(next.fetchedAt)); setError(''); setSessionRequired(false);
      setSelected(prev => prev.filter(id => next.requests.some(r => r.id === id && !r.conflicting && r.status === 'PENDING')));
    } catch (e) { if (!abort.signal.aborted) setError(e instanceof Error && e.message === 'session' ? c.sessionExpired : c.loadError); }
    finally { if (!abort.signal.aborted) { setLoading(false); setRefreshing(false); } }
  }, [status, classId, query, page, c.loadError, c.sessionExpired]);
  useEffect(() => {
    if (mounted.current) void load();
    else mounted.current = true;

    // Poll only the inexpensive pending counter. A full inbox refresh performs
    // several joined queries and used to run every 30 seconds even while an
    // administrator was reading an already processed tab.
    const poll = async () => {
      if (document.hidden || controller.current?.signal.aborted) return;
      try {
        const response = await fetch('/api/admin/parent-access?summary=1', { cache: 'no-store' });
        if (!response.ok) return;
        const summary: { pending?: number } = await response.json();
        if (!Number.isFinite(summary.pending)) return;
        const pending = Number(summary.pending);
        const changed = pending !== pendingCountRef.current;
        if (changed && status === 'PENDING') void load(true, true);
        else if (changed) setData(previous => ({ ...previous, counts: { ...previous.counts, PENDING: pending } }));
      } catch {
        // The visible data remains usable while a background poll is offline.
      }
    };
    const timer = setInterval(() => void poll(), 60_000);
    return () => { clearInterval(timer); controller.current?.abort(); };
  }, [load, status]);
  const openDecision = (action: Decision['action'], entries: Entry[]) => { setDetails(null); setDecision({ action, entries }); setReason(''); setConfirmed(false); setSaveError(''); };
  const save = async () => {
    if (!decision || saving) return;
    setSaving(true); setSaveError('');
    try {
      const response = await fetch('/api/admin/parent-access', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestIds: decision.entries.map(r => r.id), action: decision.action, identityConfirmed: confirmed, reason }) });
      if (response.redirected || response.status === 401) {
        setSessionRequired(true); setSaveError(c.sessionExpired); return;
      }
      const result = await response.json();
      if (!response.ok) { setSaveError((c as Record<string, string>)[result.code] || c.error); return; }
      setSessionRequired(false);
      const failed = result.results.filter((r: { success: boolean }) => !r.success);
      if (failed.length && decision.entries.length === 1) {
        setSaveError((c as Record<string, string>)[failed[0].code] || c.error); await load(true); return;
      }
      const succeeded = result.results.filter((item: { success: boolean }) => item.success);
      const succeededIds = new Set(succeeded.map((item: { requestId: string }) => item.requestId));
      const destination = decision.action === 'APPROVE' ? 'APPROVED' : decision.action === 'REJECT' ? 'REJECTED' : 'REVOKED';
      dataCache.current.clear();
      setData(previous => {
        const counts = { ...previous.counts };
        decision.entries.forEach(entry => {
          if (!succeededIds.has(entry.id)) return;
          counts[entry.status] = Math.max(0, (counts[entry.status] || 0) - 1);
          counts[destination] = (counts[destination] || 0) + 1;
        });
        const removed = previous.requests.filter(entry => succeededIds.has(entry.id)).length;
        return {
          ...previous,
          counts,
          total: Math.max(0, previous.total - removed),
          requests: previous.requests.filter(entry => !succeededIds.has(entry.id)),
        };
      });
      setNotice(failed.length ? c.partial : c.done); setDecision(null); setSelected([]); void load(true, true);
    } catch { setSaveError(c.unconfirmed); } finally { setSaving(false); }
  };
  const eligible = data.requests.filter(r => !r.conflicting && r.status === 'PENDING');
  const button = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50';
  const secondary = `${button} border border-ink-200 bg-white text-ink-700 hover:bg-ink-50`;
  const primary = `${button} bg-brand-600 text-white hover:bg-brand-700`;
  const address = (value: string) => value.trim() && value.trim() !== 'Non renseignée' ? value.trim() : c.addressMissing;
  const person = (r: Entry) => `${r.parent.name} ${r.parent.surname}`;
  const updatedLabel = `${c.updated} ${new Intl.DateTimeFormat(locale === 'ar' ? 'ar-TN' : locale, { hour: '2-digit', minute: '2-digit' }).format(lastUpdatedAt)}`;
  return <main dir={locale === 'ar' ? 'rtl' : 'ltr'} className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6 lg:p-8">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-xs font-bold tracking-[.16em] text-brand-600">{c.eyebrow}</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink-900">{c.title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-ink-500">{c.intro}</p></div>
      <div className="flex items-center gap-3"><span aria-live="polite" className="hidden text-xs text-ink-400 sm:block">{refreshing ? c.syncing : updatedLabel}</span><button onClick={() => void load(true, true)} disabled={loading || refreshing} className={secondary}><RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />{c.refresh}</button></div>
    </header>
    <section className="grid grid-cols-3 gap-3">
      {[['PENDING', Clock3, 'text-amber-700 bg-amber-50'], ['APPROVED', CheckCircle2, 'text-emerald-700 bg-emerald-50'], ['REJECTED', Users, 'text-slate-600 bg-slate-100']].map(([key, Icon, tone]) => {
        const StatusIcon = Icon as typeof Clock3; const k = key as string;
        return <button key={k} onClick={() => { setStatus(k); setPage(1); setSelected([]); }} className={`ss-panel flex items-center justify-between gap-2 p-3 text-start transition sm:p-5 ${status === k ? 'ring-2 ring-brand-500' : 'hover:border-brand-200'}`} aria-pressed={status === k}>
          <span><span className="block text-xs text-ink-500 sm:text-sm">{label(k)}</span><span className="mt-1 block text-2xl font-semibold text-ink-900 sm:text-3xl">{data.counts[k] ?? 0}</span></span><span className={`hidden h-11 w-11 place-items-center rounded-xl sm:grid ${tone}`}><StatusIcon size={20} /></span>
        </button>;
      })}
    </section>
    <aside className="flex gap-3 rounded-2xl border border-brand-100 bg-brand-50/60 px-4 py-3 text-sm leading-5"><ShieldCheck size={19} className="mt-0.5 shrink-0 text-brand-600" /><div><h2 className="font-semibold text-ink-900">{c.guideTitle}</h2><p className="mt-0.5 text-ink-600">{c.guide}</p></div></aside>
    {notice && <div role="status" className="flex items-start justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><span>{notice}</span><button aria-label={c.close} onClick={() => setNotice('')}><X size={18} /></button></div>}
    <section className="ss-panel overflow-hidden">
      <div className="flex flex-wrap gap-3 border-b border-ink-100 p-4">
        <div className="relative min-w-52 flex-1"><Search size={17} className="pointer-events-none absolute start-3 top-3.5 text-ink-400" /><input value={search} onChange={e => setSearch(e.target.value)} aria-label={c.search} placeholder={c.search} className="h-11 w-full rounded-xl border border-ink-200 bg-white pe-10 ps-10 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />{search && <button type="button" onClick={() => setSearch('')} aria-label={c.clearSearch} className="absolute end-2 top-2 grid h-7 w-7 place-items-center rounded-lg text-ink-400 hover:bg-ink-100 hover:text-ink-700"><X size={15} /></button>}</div>
        <select aria-label={c.allClasses} value={classId} onChange={e => { setClassId(e.target.value); setPage(1); setSelected([]); }} className="h-11 rounded-xl border border-ink-200 bg-white px-3 text-sm"><option value="">{c.allClasses}</option>{data.classes.map(cls => <option key={cls.id} value={cls.id}>{cls.name}</option>)}</select>
        <select aria-label={c.history} value={status} onChange={e => { setStatus(e.target.value); setPage(1); setSelected([]); }} className="h-11 rounded-xl border border-ink-200 bg-white px-3 text-sm">{['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'REVOKED'].map(s => <option key={s} value={s}>{label(s)}</option>)}</select>
      </div>
      {(loading || refreshing) && <div role="progressbar" aria-label={c.syncing} className="h-0.5 w-full overflow-hidden bg-brand-100"><div className="h-full w-1/3 animate-pulse rounded-full bg-brand-500" /></div>}
      {status === 'PENDING' && !!data.requests.length && <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 bg-ink-50/60 p-4">
        <label className="flex cursor-pointer items-center gap-3 text-sm text-ink-600"><input type="checkbox" className="h-4 w-4 accent-blue-600" checked={eligible.length > 0 && eligible.every(r => selected.includes(r.id))} onChange={e => setSelected(e.target.checked ? eligible.map(r => r.id) : [])} />{selected.length ? `${selected.length} ${c.selected}` : c.selectPage}</label>
        {selected.length > 0 && <button className={primary} onClick={() => openDecision('APPROVE', data.requests.filter(r => selected.includes(r.id)))}><Check size={17} />{c.batch} ({selected.length})</button>}
      </div>}
      {error && <div role="alert" className="m-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-rose-50 p-4 text-sm text-rose-800"><span>{error}</span>{sessionRequired && <a href="/sign-in" target="_blank" rel="noopener noreferrer" className={secondary}>{c.signInAgain}</a>}<button onClick={() => void load()} className={secondary}>{c.retry}</button></div>}
      {!data.requests.length && !error ? <div className="px-6 py-16 text-center"><span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-brand-50 text-brand-600"><Users size={28} /></span><h2 className="mt-5 text-xl font-semibold text-ink-900">{!search && !classId && status === 'PENDING' ? c.empty : c.noResults}</h2><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-ink-500">{!search && !classId && status === 'PENDING' ? c.emptyBody : c.noResultsBody}</p></div> : <div className={`divide-y divide-ink-100 transition-opacity ${loading ? 'opacity-60' : ''}`}>
        {data.requests.map(r => <article key={r.id} className="p-4 sm:p-5">
          <div className="flex items-start gap-3">
            {status === 'PENDING' && <input aria-label={`${c.parent}: ${person(r)}`} type="checkbox" className="mt-4 h-4 w-4 shrink-0 accent-blue-600" disabled={r.conflicting} checked={selected.includes(r.id)} onChange={e => setSelected(prev => e.target.checked ? [...prev, r.id] : prev.filter(id => id !== r.id))} />}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-base font-semibold text-ink-900">{person(r)}</h2><span className={`rounded-full px-3 py-1 text-xs font-semibold ${tones[r.status]}`}>{label(r.status)}</span></div>
              <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-500"><span className="inline-flex items-center gap-2"><Phone size={14} /><bdi>{r.parent.phone}</bdi></span><span>{(c as Record<string, string>)[r.relation] || r.relation}</span><span>{date(r.createdAt)}</span></div>
              <div className="mt-3 flex items-start gap-2 text-sm text-ink-600"><MapPin size={15} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-400" /><dl className="min-w-0"><dt className="text-xs font-medium text-ink-500">{c.address}</dt><dd dir="auto" className="mt-0.5 whitespace-pre-line break-words [overflow-wrap:anywhere]">{address(r.parent.address)}</dd></dl></div>
              <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-ink-50 p-3 text-sm"><GraduationCap size={18} className="text-brand-600" /><span className="font-semibold text-ink-800">{r.student.name} {r.student.surname}</span><span className="rounded-lg border border-ink-200 bg-white px-2 py-1 text-xs font-medium">{r.student.class?.name || c.noClass}</span><bdi className="ms-auto font-mono text-xs text-ink-500">{r.student.nationalId}</bdi></div>
              {r.conflicting && r.status === 'PENDING' && <p className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-amber-800"><AlertCircle size={15} />{c.conflict}</p>}
              {r.reason && <p className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{r.reason}</p>}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><span className="text-xs text-ink-400">{r.reviewedAt ? `${c.reviewed} ${date(r.reviewedAt)} · ${c.by} ${r.reviewedByName || '—'}` : `#${r.id.slice(-8).toUpperCase()}`}</span><div className="flex gap-2"><button onClick={() => setDetails(r)} className={secondary}>{c.details}<ArrowRight size={15} className="rtl:rotate-180" /></button>{status === 'PENDING' && !r.conflicting && <button onClick={() => openDecision('APPROVE', [r])} className={primary}><Check size={16} />{c.approve}</button>}</div></div>
            </div>
          </div>
        </article>)}
      </div>}
      {!!data.total && <footer className="flex items-center justify-between border-t border-ink-100 p-4 text-sm text-ink-500"><span>{c.page} {page} / {Math.ceil(data.total / 25)} · {data.total}</span><div className="flex gap-2"><button aria-label={c.previous} className={secondary} disabled={page === 1} onClick={() => setPage(p => p - 1)}><ArrowLeft size={17} className="rtl:rotate-180" /></button><button aria-label={c.next} className={secondary} disabled={page * 25 >= data.total} onClick={() => setPage(p => p + 1)}><ArrowRight size={17} className="rtl:rotate-180" /></button></div></footer>}
    </section>
    <Dialog.Root open={!!details || !!decision} onOpenChange={open => { if (!open && !saving) { setDetails(null); setDecision(null); } }}><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-50 bg-ink-900/40 backdrop-blur-sm" /><Dialog.Content dir={locale === 'ar' ? 'rtl' : 'ltr'} className="fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl border border-ink-200 bg-white p-6 shadow-xl" onEscapeKeyDown={e => { if (saving) e.preventDefault(); }} onPointerDownOutside={e => { if (saving) e.preventDefault(); }}>
      <Dialog.Title className="pe-8 text-xl font-semibold text-ink-900">{details ? c.details : decision?.action === 'APPROVE' ? c.approveTitle : decision?.action === 'REVOKE' ? c.revokeTitle : c.rejectTitle}</Dialog.Title>
      <Dialog.Description className="mt-2 text-sm leading-6 text-ink-500">{details ? c.guide : decision?.action === 'APPROVE' ? c.approveBody : decision?.action === 'REVOKE' ? c.revokeBody : c.reason}</Dialog.Description>
      <Dialog.Close disabled={saving} aria-label={c.close} className="absolute end-4 top-4 grid h-9 w-9 place-items-center rounded-xl text-ink-500 hover:bg-ink-100"><X size={19} /></Dialog.Close>
      {details ? <><dl className="mt-5 space-y-4">{[[c.parent, person(details)], [c.phone, details.parent.phone], [c.relationship, (c as Record<string, string>)[details.relation] || details.relation], [c.address, address(details.parent.address)], [c.child, `${details.student.name} ${details.student.surname}`], [c.studentId, details.student.nationalId], [c.received, date(details.createdAt)]].map(([key, value]) => <div key={key}><dt className="text-xs font-medium text-ink-500">{key}</dt><dd dir="auto" className="mt-1 whitespace-pre-line break-words text-sm font-semibold text-ink-900 [overflow-wrap:anywhere]">{value || '—'}</dd></div>)}</dl>
        {details.conflicting && <p className="mt-5 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-800">{c.conflictHelp}</p>}
        <div className="mt-6 flex flex-wrap gap-3">{details.status === 'PENDING' && <><button className={primary} onClick={() => openDecision('APPROVE', [details])}>{c.approve}</button><button className={secondary} onClick={() => openDecision('REJECT', [details])}>{c.reject}</button></>}{details.status === 'APPROVED' && <button className={`${secondary} text-rose-700`} onClick={() => openDecision('REVOKE', [details])}>{c.revoke}</button>}</div>
      </> : decision ? <>
        <div className="my-5 max-h-48 space-y-2 overflow-y-auto rounded-2xl bg-ink-50 p-4">{decision.entries.map(r => <div key={r.id} className="border-b border-ink-200 pb-2 last:border-0 last:pb-0"><p className="text-sm font-semibold text-ink-900">{person(r)}</p><p className="mt-1 text-xs text-ink-500">{r.student.name} {r.student.surname} · {r.student.class?.name || c.noClass}</p></div>)}</div>
        {decision.action === 'APPROVE' ? <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-brand-100 bg-brand-50/60 p-4 text-sm leading-6 text-ink-800"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-blue-600" />{c.verified}</label> : <label className="block text-sm font-medium text-ink-800">{c.reason}<textarea value={reason} onChange={e => setReason(e.target.value)} maxLength={500} rows={4} placeholder={c.reasonPlaceholder} className="mt-2 w-full rounded-xl border border-ink-200 p-3 font-normal outline-none focus:border-brand-500" /></label>}
        <p className="mt-4 flex gap-2 text-xs leading-5 text-ink-500"><BellRing size={16} className="mt-0.5 shrink-0" />{c.notification}</p>
        {slowSaving && saving && <p role="status" className="mt-4 text-sm leading-6 text-ink-500">{c.stillWorking}</p>}
        {saveError && <div role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800"><p>{saveError}</p>{sessionRequired && <a href="/sign-in" target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-11 items-center font-semibold underline">{c.signInAgain}</a>}</div>}
        <div className="mt-6 flex justify-end gap-3"><button disabled={saving} className={secondary} onClick={() => setDecision(null)}>{c.cancel}</button><button disabled={saving || (decision.action === 'APPROVE' ? !confirmed : !reason.trim())} className={decision.action === 'APPROVE' ? primary : `${button} bg-rose-600 text-white hover:bg-rose-700`} onClick={() => void save()}>{saving && <Loader2 size={16} className="animate-spin" />}{saving ? c.working : decision.action === 'APPROVE' ? c.approve : decision.action === 'REVOKE' ? c.revoke : c.reject}</button></div>
      </> : null}
    </Dialog.Content></Dialog.Portal></Dialog.Root>
  </main>;
}
