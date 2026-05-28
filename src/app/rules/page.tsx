'use client';
import { useEffect, useState } from 'react';
import { Plus, Trash2, Save, X, Edit2 } from 'lucide-react';
import type { RuleDTO, RuleMatch, RuleAction } from '@/lib/types';

const EMPTY: RuleDTO = {
  id: 0,
  name: '',
  description: '',
  scope: 'movie',
  priority: 100,
  enabled: true,
  match: {},
  action: { kind: 'prefer_resolution', value: '2160p' },
  appliedCount: 0,
};

export default function RulesPage() {
  const [rules, setRules] = useState<RuleDTO[]>([]);
  const [editing, setEditing] = useState<RuleDTO | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const r = await fetch('/api/rules');
    setRules(await r.json());
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async (rule: RuleDTO) => {
    await fetch('/api/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rule),
    });
    setEditing(null);
    await load();
  };

  const remove = async (id: number) => {
    if (!confirm('Delete this rule?')) return;
    await fetch(`/api/rules?id=${id}`, { method: 'DELETE' });
    await load();
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold">Rules</h1>
          <p className="text-sm text-text-dim mt-1">
            Annotate duplicates with a recommended "keep this" version (e.g. keep 4K for Marvel). Rules don't auto-delete - they just highlight.
          </p>
        </div>
        <button
          onClick={() => setEditing({ ...EMPTY })}
          className="px-3 py-1.5 bg-accent text-accent-ink font-semibold rounded-md flex items-center gap-2 text-sm"
        >
          <Plus size={14} /> New rule
        </button>
      </div>

      {editing && <RuleEditor initial={editing} onCancel={() => setEditing(null)} onSave={save} />}

      {loading ? (
        <p className="text-text-dim text-center py-12">Loading…</p>
      ) : rules.length === 0 ? (
        <p className="text-text-dim text-center py-12 text-sm">
          No rules yet. Click "New rule" to create one.
        </p>
      ) : (
        <div className="space-y-2">
          {rules.map((r) => (
            <RuleCard key={r.id} rule={r} onEdit={() => setEditing(r)} onDelete={() => remove(r.id)} />
          ))}
        </div>
      )}

      <div className="mt-8 p-4 bg-panel border border-border rounded-md text-sm text-text-dim">
        <h3 className="font-semibold text-text mb-2">Examples</h3>
        <ul className="space-y-1 list-disc list-inside">
          <li>Keep 4K for Marvel: scope=movie, collection=&ldquo;Marvel Cinematic Universe&rdquo;, action=prefer_resolution:2160p</li>
          <li>Keep 1080p for older catalog: scope=movie, yearMax=1990, action=prefer_resolution:1080p</li>
          <li>Always keep REMUX: scope=movie, action=prefer_codec:HEVC (then prefer_largest as fallback)</li>
          <li>Auto-ignore anime older than 2010: scope=anime, yearMax=2010, action=ignore</li>
        </ul>
      </div>
    </div>
  );
}

function RuleCard({ rule, onEdit, onDelete }: { rule: RuleDTO; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="bg-panel border border-border rounded-md p-3 flex items-start gap-3">
      <div className={`mt-1 w-2 h-2 rounded-full ${rule.enabled ? 'bg-good' : 'bg-text-dim'}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold">{rule.name}</span>
          <span className="text-xs px-1.5 py-0.5 border border-border rounded text-text-dim">{rule.scope}</span>
          <span className="text-xs px-1.5 py-0.5 border border-border rounded text-text-dim">priority {rule.priority}</span>
          {rule.appliedCount > 0 && (
            <span className="text-xs text-text-dim">{rule.appliedCount} applies</span>
          )}
        </div>
        {rule.description && <div className="text-xs text-text-dim mt-1">{rule.description}</div>}
        <div className="text-xs text-text-dim mt-2 font-mono">
          match: {JSON.stringify(rule.match)}
        </div>
        <div className="text-xs text-text-dim mt-0.5 font-mono">
          action: {rule.action.kind}{rule.action.value ? ':' + rule.action.value : ''}
        </div>
      </div>
      <button onClick={onEdit} className="p-1.5 hover:bg-panel-2 rounded text-text-dim hover:text-text">
        <Edit2 size={14} />
      </button>
      <button onClick={onDelete} className="p-1.5 hover:bg-danger/10 hover:text-danger rounded text-text-dim">
        <Trash2 size={14} />
      </button>
    </div>
  );
}

function RuleEditor({
  initial,
  onCancel,
  onSave,
}: {
  initial: RuleDTO;
  onCancel: () => void;
  onSave: (r: RuleDTO) => void;
}) {
  const [r, setR] = useState<RuleDTO>(initial);
  const updateMatch = (patch: Partial<RuleMatch>) => setR({ ...r, match: { ...r.match, ...patch } });
  const updateAction = (patch: Partial<RuleAction>) => setR({ ...r, action: { ...r.action, ...patch } as RuleAction });

  return (
    <div className="bg-panel border border-accent/40 rounded-lg p-4 mb-4 space-y-3">
      <div className="grid sm:grid-cols-3 gap-3">
        <Field label="Name">
          <input value={r.name} onChange={(e) => setR({ ...r, name: e.target.value })}
            className="w-full px-2.5 py-1.5 bg-panel-2 border border-border rounded text-sm" />
        </Field>
        <Field label="Scope">
          <select value={r.scope} onChange={(e) => setR({ ...r, scope: e.target.value as RuleDTO['scope'] })}
            className="w-full px-2.5 py-1.5 bg-panel-2 border border-border rounded text-sm">
            <option value="all">all</option>
            <option value="movie">movie</option>
            <option value="show">show / TV</option>
            <option value="anime">anime</option>
          </select>
        </Field>
        <Field label="Priority">
          <input type="number" value={r.priority} onChange={(e) => setR({ ...r, priority: Number(e.target.value) })}
            className="w-full px-2.5 py-1.5 bg-panel-2 border border-border rounded text-sm" />
        </Field>
      </div>
      <Field label="Description (optional)">
        <input value={r.description ?? ''} onChange={(e) => setR({ ...r, description: e.target.value })}
          className="w-full px-2.5 py-1.5 bg-panel-2 border border-border rounded text-sm" />
      </Field>

      <div className="border-t border-border pt-3">
        <div className="text-xs uppercase tracking-wide text-text-dim mb-2">Match (all conditions must satisfy)</div>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Title regex">
            <input value={r.match.titleRegex ?? ''} onChange={(e) => updateMatch({ titleRegex: e.target.value || undefined })}
              placeholder="e.g. ^Avengers"
              className="w-full px-2.5 py-1.5 bg-panel-2 border border-border rounded text-sm font-mono" />
          </Field>
          <Field label="Libraries (comma-separated)">
            <input value={r.match.libraries?.join(', ') ?? ''} onChange={(e) => updateMatch({ libraries: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
              placeholder="Movies, Anime"
              className="w-full px-2.5 py-1.5 bg-panel-2 border border-border rounded text-sm" />
          </Field>
          <Field label="Year min">
            <input type="number" value={r.match.yearMin ?? ''} onChange={(e) => updateMatch({ yearMin: e.target.value ? Number(e.target.value) : undefined })}
              className="w-full px-2.5 py-1.5 bg-panel-2 border border-border rounded text-sm" />
          </Field>
          <Field label="Year max">
            <input type="number" value={r.match.yearMax ?? ''} onChange={(e) => updateMatch({ yearMax: e.target.value ? Number(e.target.value) : undefined })}
              className="w-full px-2.5 py-1.5 bg-panel-2 border border-border rounded text-sm" />
          </Field>
          <Field label="Genres (any-of, comma-separated)">
            <input value={r.match.genres?.join(', ') ?? ''} onChange={(e) => updateMatch({ genres: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
              placeholder="Action, Sci-Fi"
              className="w-full px-2.5 py-1.5 bg-panel-2 border border-border rounded text-sm" />
          </Field>
          <Field label="Collections (any-of, comma-separated)">
            <input value={r.match.collections?.join(', ') ?? ''} onChange={(e) => updateMatch({ collections: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
              placeholder="Marvel Cinematic Universe, DC Extended Universe"
              className="w-full px-2.5 py-1.5 bg-panel-2 border border-border rounded text-sm" />
          </Field>
        </div>
      </div>

      <div className="border-t border-border pt-3">
        <div className="text-xs uppercase tracking-wide text-text-dim mb-2">Action</div>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Action">
            <select value={r.action.kind} onChange={(e) => updateAction({ kind: e.target.value as RuleAction['kind'] })}
              className="w-full px-2.5 py-1.5 bg-panel-2 border border-border rounded text-sm">
              <option value="prefer_resolution">prefer_resolution</option>
              <option value="prefer_largest">prefer_largest</option>
              <option value="prefer_codec">prefer_codec</option>
              <option value="mark_review">mark_review (flag only)</option>
              <option value="ignore">ignore (hide from list)</option>
            </select>
          </Field>
          {(r.action.kind === 'prefer_resolution' || r.action.kind === 'prefer_codec') && (
            <Field label="Value">
              <input value={r.action.value ?? ''} onChange={(e) => updateAction({ value: e.target.value })}
                placeholder={r.action.kind === 'prefer_resolution' ? '2160p / 1080p / 720p' : 'x265 / x264 / av1'}
                className="w-full px-2.5 py-1.5 bg-panel-2 border border-border rounded text-sm" />
            </Field>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <label className="flex items-center gap-2 text-sm text-text-dim">
          <input type="checkbox" checked={r.enabled} onChange={(e) => setR({ ...r, enabled: e.target.checked })}
            className="accent-accent" />
          Enabled
        </label>
        <div className="flex gap-2">
          <button onClick={onCancel} className="px-3 py-1.5 border border-border rounded text-sm flex items-center gap-1.5">
            <X size={14} /> Cancel
          </button>
          <button onClick={() => onSave(r)} className="px-3 py-1.5 bg-accent text-accent-ink font-semibold rounded text-sm flex items-center gap-1.5">
            <Save size={14} /> {r.id ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs">
      <span className="text-text-dim mb-1 block">{label}</span>
      {children}
    </label>
  );
}
