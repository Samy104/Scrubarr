'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Save, Trash2, ShieldCheck, Sparkles, Power, ChevronDown, ChevronRight, Pencil, X, Wand2 } from 'lucide-react';
import type { CleanupRuleDTO, CleanupRuleMatch, CleanupRuleConditions } from '@/lib/types';
import { useNotifications } from '@/lib/notifications';
import { useConfirm } from '@/lib/confirm';

type Draft = Omit<CleanupRuleDTO, 'id'> & { id?: number };

const blankDraft = (scope: 'movie' | 'show' = 'movie', kind: 'exception' | 'eligibility' = 'eligibility'): Draft => ({
  name: '',
  description: null,
  scope,
  kind,
  priority: 50,
  enabled: true,
  match: {},
  conditions: {},
});

export default function CleanupRulesPage() {
  const [rules, setRules] = useState<CleanupRuleDTO[]>([]);
  const [scopeFilter, setScopeFilter] = useState<'all' | 'movie' | 'show'>('all');
  const [editing, setEditing] = useState<Draft | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const { notify } = useNotifications();
  const confirm = useConfirm();

  const load = async () => {
    const r = await fetch('/api/cleanup/rules', { cache: 'no-store' });
    if (r.ok) setRules(await r.json());
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (scopeFilter === 'all') return rules;
    return rules.filter((r) => r.scope === scopeFilter);
  }, [rules, scopeFilter]);

  const counts = useMemo(() => ({
    movie: rules.filter((r) => r.scope === 'movie').length,
    show: rules.filter((r) => r.scope === 'show').length,
    exception: rules.filter((r) => r.kind === 'exception').length,
    eligibility: rules.filter((r) => r.kind === 'eligibility').length,
  }), [rules]);

  const save = async (draft: Draft) => {
    const r = await fetch('/api/cleanup/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    });
    if (r.ok) {
      notify({ kind: 'success', title: draft.id ? 'Rule updated' : 'Rule created', body: draft.name });
      setEditing(null);
      await load();
    } else {
      notify({ kind: 'error', title: 'Rule save failed', body: await r.text() });
    }
  };

  const remove = async (rule: CleanupRuleDTO) => {
    const ok = await confirm({
      title: 'Delete cleanup rule',
      body: <>Remove the rule <span className="font-medium text-text">{rule.name}</span>. Future evaluations will skip it.</>,
      danger: true,
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    await fetch(`/api/cleanup/rules?id=${rule.id}`, { method: 'DELETE' });
    notify({ kind: 'info', title: 'Rule deleted', body: rule.name });
    await load();
  };

  const toggle = async (rule: CleanupRuleDTO) => {
    await save({ ...rule, enabled: !rule.enabled });
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 pr-16 bg-panel border-b border-border sticky top-0 z-10">
        <h1 className="font-display font-semibold text-base tracking-tight">Cleanup rules</h1>
        <div className="text-xs text-text-dim flex gap-3">
          <span><span className="text-text font-mono">{counts.movie}</span> movie · <span className="text-text font-mono">{counts.show}</span> show</span>
          <span className="text-good"><span className="font-mono">{counts.exception}</span> exception</span>
          <span className="text-warn"><span className="font-mono">{counts.eligibility}</span> eligibility</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <select
            value={scopeFilter}
            onChange={(e) => setScopeFilter(e.target.value as any)}
            className="px-3 py-1.5 bg-panel-2 border border-border rounded text-sm"
          >
            <option value="all">All scopes</option>
            <option value="movie">Movie rules</option>
            <option value="show">Show rules</option>
          </select>
          <button
            onClick={() => setEditing(blankDraft())}
            className="px-3 py-1.5 bg-accent text-accent-ink font-semibold rounded-md text-sm flex items-center gap-1.5 hover:opacity-90"
          >
            <Plus size={13} /> New rule
          </button>
        </div>
      </div>

      <div className="p-4 max-w-5xl mx-auto space-y-4">
        <p className="text-sm text-text-dim max-w-3xl">
          <span className="text-text font-medium">Eligibility</span> rules nominate movies or shows for deletion when watch history and ratings match.{' '}
          <span className="text-text font-medium">Exception</span> rules carve out anything that should always be kept regardless. An exception always wins.
        </p>

        {filtered.length === 0 && (
          <div className="text-center py-16 text-sm text-text-dim">No rules yet for this scope. Click <span className="text-text">New rule</span> to add one.</div>
        )}

        <div className="space-y-1.5">
          {filtered.map((r) => (
            <RuleCard
              key={r.id}
              rule={r}
              expanded={expandedId === r.id}
              onExpand={() => setExpandedId((cur) => cur === r.id ? null : r.id)}
              onEdit={() => setEditing({ ...r })}
              onRemove={() => remove(r)}
              onToggle={() => toggle(r)}
            />
          ))}
        </div>
      </div>

      {editing && (
        <RuleEditor
          draft={editing}
          onChange={setEditing}
          onCancel={() => setEditing(null)}
          onSave={save}
        />
      )}
    </div>
  );
}

function RuleCard({
  rule, expanded, onExpand, onEdit, onRemove, onToggle,
}: {
  rule: CleanupRuleDTO;
  expanded: boolean;
  onExpand: () => void;
  onEdit: () => void;
  onRemove: () => void;
  onToggle: () => void;
}) {
  const matchSummary = useMemo(() => describeMatch(rule.match), [rule.match]);
  const condSummary = useMemo(() => describeConditions(rule.conditions), [rule.conditions]);
  return (
    <div
      className={`bg-panel border rounded-lg overflow-hidden transition-colors ${
        rule.kind === 'exception' ? 'border-good/30 hover:border-good/50' : 'border-warn/30 hover:border-warn/50'
      } ${rule.enabled ? '' : 'opacity-50'}`}
    >
      <div className="flex items-center gap-3 p-3">
        <button onClick={onExpand} className="text-text-dim hover:text-text">
          {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </button>
        <div className={`w-1 h-9 rounded-full ${rule.kind === 'exception' ? 'bg-good' : 'bg-warn'}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-display font-semibold tracking-tight">{rule.name}</h2>
            <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium ${
              rule.kind === 'exception' ? 'bg-good/15 text-good' : 'bg-warn/15 text-warn'
            }`}>
              {rule.kind === 'exception' ? <ShieldCheck size={10} /> : <Sparkles size={10} />}
              {rule.kind}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-text-dim font-mono">{rule.scope}</span>
            <span className="text-[10px] text-text-dim font-mono">priority {rule.priority}</span>
          </div>
          {rule.description && <p className="text-xs text-text-dim mt-0.5">{rule.description}</p>}
          {!expanded && (
            <div className="text-[11px] text-text-dim mt-1 flex flex-wrap gap-x-3">
              {matchSummary && <span>match: <span className="text-text">{matchSummary}</span></span>}
              {rule.kind === 'eligibility' && condSummary && <span>when: <span className="text-text">{condSummary}</span></span>}
            </div>
          )}
        </div>
        <Link
          href={`/cleanup/${rule.scope === 'show' ? 'shows' : 'movies'}?rule=${rule.id}`}
          className="px-2.5 py-1.5 text-xs rounded border border-border hover:border-accent hover:bg-accent/10 hover:text-accent inline-flex items-center gap-1.5"
          title="Open the filtered candidate list for this rule"
        >
          <Wand2 size={12} /> View matches
        </Link>
        <button onClick={onToggle} className={`p-1.5 rounded hover:bg-panel-2 ${rule.enabled ? 'text-good' : 'text-text-dim'}`} title={rule.enabled ? 'Disable' : 'Enable'}>
          <Power size={14} />
        </button>
        <button onClick={onEdit} className="p-1.5 rounded text-text-dim hover:text-text hover:bg-panel-2" title="Edit">
          <Pencil size={14} />
        </button>
        <button onClick={onRemove} className="p-1.5 rounded text-text-dim hover:text-danger hover:bg-panel-2" title="Delete">
          <Trash2 size={14} />
        </button>
      </div>
      {expanded && (
        <div className="border-t border-border bg-panel-2/40 px-4 py-3 grid sm:grid-cols-2 gap-4 text-xs">
          <div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-text-dim mb-1">Library match</div>
            <pre className="font-mono text-[11px] text-text whitespace-pre-wrap break-all">{JSON.stringify(rule.match, null, 2)}</pre>
          </div>
          {rule.kind === 'eligibility' && (
            <div>
              <div className="text-[10px] uppercase tracking-[0.16em] text-text-dim mb-1">Eligibility conditions</div>
              <pre className="font-mono text-[11px] text-text whitespace-pre-wrap break-all">{JSON.stringify(rule.conditions, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function describeMatch(m: CleanupRuleMatch): string {
  const parts: string[] = [];
  if (m.studios?.length) parts.push(`studio ∈ {${m.studios.join(', ')}}`);
  if (m.collections?.length) parts.push(`collection ∈ {${m.collections.join(', ')}}`);
  if (m.genres?.length) parts.push(`genre ∈ {${m.genres.join(', ')}}`);
  if (m.libraries?.length) parts.push(`lib ∈ {${m.libraries.join(', ')}}`);
  if (m.titleRegex) parts.push(`title ~ /${m.titleRegex}/i`);
  if (m.yearMin != null || m.yearMax != null) parts.push(`year ${m.yearMin ?? '*'}–${m.yearMax ?? '*'}`);
  return parts.join(' · ') || 'any item';
}

function describeConditions(c: CleanupRuleConditions): string {
  const parts: string[] = [];
  if (c.neverViewed === true) parts.push('never viewed');
  if (c.neverViewed === false) parts.push('viewed at least once');
  if (c.viewCount) parts.push(`plays ${c.viewCount.min ?? '*'}–${c.viewCount.max ?? '*'}`);
  if (c.rating) parts.push(`rating ${c.rating.min ?? '*'}–${c.rating.max ?? '*'}`);
  if (c.userRating) parts.push(`your rating ${c.userRating.min ?? '*'}–${c.userRating.max ?? '*'}`);
  if (c.audienceRating) parts.push(`audience ${c.audienceRating.min ?? '*'}–${c.audienceRating.max ?? '*'}`);
  if (c.daysSinceLastView) parts.push(`last viewed ${c.daysSinceLastView.min ?? '*'}–${c.daysSinceLastView.max ?? '*'}d ago`);
  if (c.showCompletion) parts.push(`completion ${pct(c.showCompletion.min)}–${pct(c.showCompletion.max)}`);
  return parts.join(' · ');
}
const pct = (n?: number) => n == null ? '*' : `${Math.round(n * 100)}%`;

function RuleEditor({
  draft, onChange, onCancel, onSave,
}: {
  draft: Draft;
  onChange: (d: Draft) => void;
  onCancel: () => void;
  onSave: (d: Draft) => Promise<void>;
}) {
  const [tab, setTab] = useState<'match' | 'conditions'>('match');
  const isException = draft.kind === 'exception';

  const setMatch = (m: CleanupRuleMatch) => onChange({ ...draft, match: m });
  const setCond = (c: CleanupRuleConditions) => onChange({ ...draft, conditions: c });

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-bg/80 backdrop-blur-sm p-3">
      <div className="bg-panel border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" style={{ animation: 'mvPopIn 160ms ease-out' }}>
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="font-display font-semibold tracking-tight">{draft.id ? 'Edit rule' : 'New cleanup rule'}</div>
          <button onClick={onCancel} className="text-text-dim hover:text-text"><X size={16} /></button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-xs col-span-2">
              <span className="text-text-dim mb-1 block">Name</span>
              <input
                value={draft.name}
                onChange={(e) => onChange({ ...draft, name: e.target.value })}
                className="w-full px-2.5 py-1.5 bg-panel-2 border border-border rounded text-sm"
                placeholder="e.g. Unwatched and poorly rated"
              />
            </label>
            <label className="text-xs col-span-2">
              <span className="text-text-dim mb-1 block">Description (optional)</span>
              <input
                value={draft.description ?? ''}
                onChange={(e) => onChange({ ...draft, description: e.target.value || null })}
                className="w-full px-2.5 py-1.5 bg-panel-2 border border-border rounded text-sm"
              />
            </label>
            <label className="text-xs">
              <span className="text-text-dim mb-1 block">Scope</span>
              <select value={draft.scope} onChange={(e) => onChange({ ...draft, scope: e.target.value as any })} className="w-full px-2.5 py-1.5 bg-panel-2 border border-border rounded text-sm">
                <option value="movie">Movie</option>
                <option value="show">Show</option>
              </select>
            </label>
            <label className="text-xs">
              <span className="text-text-dim mb-1 block">Kind</span>
              <select value={draft.kind} onChange={(e) => onChange({ ...draft, kind: e.target.value as any })} className="w-full px-2.5 py-1.5 bg-panel-2 border border-border rounded text-sm">
                <option value="eligibility">Eligibility (candidate for deletion)</option>
                <option value="exception">Exception (always keep)</option>
              </select>
            </label>
            <label className="text-xs">
              <span className="text-text-dim mb-1 block">Priority (lower runs first)</span>
              <input type="number" value={draft.priority} onChange={(e) => onChange({ ...draft, priority: Number(e.target.value) })} className="w-full px-2.5 py-1.5 bg-panel-2 border border-border rounded text-sm" />
            </label>
            <label className="text-xs flex items-end gap-2 pb-1.5">
              <input type="checkbox" checked={draft.enabled} onChange={(e) => onChange({ ...draft, enabled: e.target.checked })} className="accent-accent" />
              <span>Enabled</span>
            </label>
          </div>

          <div className="border-b border-border flex gap-1">
            <TabBtn active={tab === 'match'} onClick={() => setTab('match')}>Library match</TabBtn>
            {!isException && <TabBtn active={tab === 'conditions'} onClick={() => setTab('conditions')}>Eligibility conditions</TabBtn>}
          </div>

          {tab === 'match' && <MatchEditor m={draft.match} onChange={setMatch} />}
          {tab === 'conditions' && !isException && <ConditionsEditor c={draft.conditions} onChange={setCond} />}
        </div>

        <div className="px-4 py-3 border-t border-border flex items-center justify-end gap-2 bg-panel-2/40">
          <button onClick={onCancel} className="px-3 py-1.5 border border-border rounded text-sm hover:bg-panel-2">Cancel</button>
          <button
            disabled={!draft.name.trim()}
            onClick={() => onSave(draft)}
            className="px-3 py-1.5 bg-accent text-accent-ink font-semibold rounded text-sm flex items-center gap-1.5 disabled:opacity-50"
          >
            <Save size={13} /> {draft.id ? 'Save changes' : 'Create rule'}
          </button>
        </div>
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 text-sm border-b-2 -mb-px transition-colors ${
        active ? 'border-accent text-accent' : 'border-transparent text-text-dim hover:text-text'
      }`}
    >
      {children}
    </button>
  );
}

function MatchEditor({ m, onChange }: { m: CleanupRuleMatch; onChange: (v: CleanupRuleMatch) => void }) {
  const setList = (key: keyof CleanupRuleMatch, v: string) => {
    const arr = v.split(',').map((s) => s.trim()).filter(Boolean);
    onChange({ ...m, [key]: arr.length ? (arr as any) : undefined });
  };
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      <label className="text-xs sm:col-span-2">
        <span className="text-text-dim mb-1 block">Title regex (case-insensitive)</span>
        <input value={m.titleRegex ?? ''} onChange={(e) => onChange({ ...m, titleRegex: e.target.value || undefined })} className="w-full px-2.5 py-1.5 bg-panel-2 border border-border rounded text-sm font-mono" placeholder="^(Iron Man|Thor)" />
      </label>
      <label className="text-xs">
        <span className="text-text-dim mb-1 block">Year min</span>
        <input type="number" value={m.yearMin ?? ''} onChange={(e) => onChange({ ...m, yearMin: e.target.value ? Number(e.target.value) : undefined })} className="w-full px-2.5 py-1.5 bg-panel-2 border border-border rounded text-sm" />
      </label>
      <label className="text-xs">
        <span className="text-text-dim mb-1 block">Year max</span>
        <input type="number" value={m.yearMax ?? ''} onChange={(e) => onChange({ ...m, yearMax: e.target.value ? Number(e.target.value) : undefined })} className="w-full px-2.5 py-1.5 bg-panel-2 border border-border rounded text-sm" />
      </label>
      <label className="text-xs sm:col-span-2">
        <span className="text-text-dim mb-1 block">Studios (comma-separated, partial match)</span>
        <input value={(m.studios ?? []).join(', ')} onChange={(e) => setList('studios', e.target.value)} className="w-full px-2.5 py-1.5 bg-panel-2 border border-border rounded text-sm" placeholder="Marvel Studios, Walt Disney Pictures" />
      </label>
      <label className="text-xs sm:col-span-2">
        <span className="text-text-dim mb-1 block">Collections (any-of)</span>
        <input value={(m.collections ?? []).join(', ')} onChange={(e) => setList('collections', e.target.value)} className="w-full px-2.5 py-1.5 bg-panel-2 border border-border rounded text-sm" placeholder="Marvel Cinematic Universe, James Bond" />
      </label>
      <label className="text-xs sm:col-span-2">
        <span className="text-text-dim mb-1 block">Genres (any-of)</span>
        <input value={(m.genres ?? []).join(', ')} onChange={(e) => setList('genres', e.target.value)} className="w-full px-2.5 py-1.5 bg-panel-2 border border-border rounded text-sm" placeholder="Documentary, Horror" />
      </label>
      <label className="text-xs sm:col-span-2">
        <span className="text-text-dim mb-1 block">Libraries (any-of)</span>
        <input value={(m.libraries ?? []).join(', ')} onChange={(e) => setList('libraries', e.target.value)} className="w-full px-2.5 py-1.5 bg-panel-2 border border-border rounded text-sm" placeholder="Movies, Movies 4K" />
      </label>
      <label className="text-xs sm:col-span-2">
        <span className="text-text-dim mb-1 block">Content ratings (any-of)</span>
        <input value={(m.contentRatings ?? []).join(', ')} onChange={(e) => setList('contentRatings', e.target.value)} className="w-full px-2.5 py-1.5 bg-panel-2 border border-border rounded text-sm" placeholder="R, PG-13" />
      </label>
    </div>
  );
}

function ConditionsEditor({ c, onChange }: { c: CleanupRuleConditions; onChange: (v: CleanupRuleConditions) => void }) {
  const range = (key: 'viewCount' | 'daysSinceLastView' | 'rating' | 'userRating' | 'audienceRating' | 'showCompletion', label: string, step = '1', hint?: string) => (
    <div className="text-xs">
      <span className="text-text-dim mb-1 block">{label} {hint && <span className="text-[10px] text-text-dim/70">{hint}</span>}</span>
      <div className="flex items-center gap-2">
        <input
          type="number" step={step} placeholder="min"
          value={c[key]?.min ?? ''}
          onChange={(e) => onChange({ ...c, [key]: { ...(c[key] ?? {}), min: e.target.value ? Number(e.target.value) : undefined } })}
          className="w-full px-2.5 py-1.5 bg-panel-2 border border-border rounded text-sm"
        />
        <span className="text-text-dim">to</span>
        <input
          type="number" step={step} placeholder="max"
          value={c[key]?.max ?? ''}
          onChange={(e) => onChange({ ...c, [key]: { ...(c[key] ?? {}), max: e.target.value ? Number(e.target.value) : undefined } })}
          className="w-full px-2.5 py-1.5 bg-panel-2 border border-border rounded text-sm"
        />
      </div>
    </div>
  );
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      <label className="text-xs flex items-center gap-2 sm:col-span-2">
        <input type="checkbox"
          checked={c.neverViewed === true}
          onChange={(e) => onChange({ ...c, neverViewed: e.target.checked ? true : undefined })}
          className="accent-accent" />
        Never viewed (viewCount = 0)
      </label>
      {range('viewCount', 'View count')}
      {range('daysSinceLastView', 'Days since last view')}
      {range('rating', 'Third-party rating', '0.1', '(IMDB / Rotten Tomatoes 0–10)')}
      {range('userRating', 'Your rating', '0.1', '(0–10)')}
      {range('audienceRating', 'Audience rating', '0.1')}
      {range('showCompletion', 'Show completion', '0.01', '(0.0 – 1.0)')}
    </div>
  );
}
