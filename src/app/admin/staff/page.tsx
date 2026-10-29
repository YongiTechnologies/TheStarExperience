'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ChefHat, ChevronDown, ConciergeBell, Dices, GlassWater, KeyRound, LockOpen, Pencil, Plus, RefreshCw, Power } from 'lucide-react';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { DevicesPanel } from '@/components/admin/DevicesPanel';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/staff/Toast';
import { createStaff, describeApiError, getStaffList, updateStaff } from '@/lib/api';
import { ShiftStatus, StaffMember } from '@/types';

type PinRole = StaffMember['role'];

const ROLES: { role: PinRole; label: string; plural: string; Icon: React.ElementType; hint: string }[] = [
  { role: 'waiter', label: 'Waiter', plural: 'Waiters', Icon: ConciergeBell, hint: 'Gets orders from their tables, accepts and serves them' },
  { role: 'kitchen', label: 'Kitchen', plural: 'Kitchen', Icon: ChefHat, hint: 'Sees food tickets and marks them ready' },
  { role: 'bar', label: 'Bar', plural: 'Bar', Icon: GlassWater, hint: 'Sees drink tickets and marks them ready' },
];

const SHIFT_LABEL: Record<ShiftStatus, string> = { on_shift: 'On shift', on_break: 'On break', off: 'Off shift' };
const SHIFT_DOT: Record<ShiftStatus, string> = { on_shift: 'bg-star-green', on_break: 'bg-star-gold', off: 'bg-zinc-600' };

/** Mirrors the server's rule: no repeats (1111), runs (1234, 9876), pairs (1212) or 2580. */
function isGuessable(pin: string): boolean {
  const steps = new Set([...pin].slice(1).map((d, i) => Number(d) - Number(pin[i])));
  return (
    new Set(pin).size === 1 ||
    (steps.size === 1 && (steps.has(1) || steps.has(-1))) ||
    pin.slice(0, 2) === pin.slice(2) ||
    ['2580', '0852', '1122', '6969', '1004', '2000', '1999'].includes(pin)
  );
}

function randomPin(): string {
  const digits = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(digits);
    const pin = String(digits[0] % 10000).padStart(4, '0');
    if (!isGuessable(pin)) return pin;
  }
}

type Editor = { mode: 'create' } | { mode: 'edit'; member: StaffMember } | { mode: 'pin'; member: StaffMember };

export default function StaffPage() {
  const { show, toast } = useToast(6000);
  const [staff, setStaff] = useState<StaffMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [toggling, setToggling] = useState<number | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const inactive = staff?.filter((m) => !m.is_active) ?? [];

  const load = useCallback(async () => {
    try {
      setStaff(await getStaffList());
      setError(null);
    } catch (err) {
      setError(describeApiError(err));
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const toggleActive = async (member: StaffMember) => {
    if (member.is_active && (member.tables.length || member.open_orders)) {
      const ok = window.confirm(
        `Deactivate ${member.display_name}? Their tables (${member.tables.join(', ') || 'none'}) and ${member.open_orders} open order(s) will be unassigned.`
      );
      if (!ok) return;
    }
    setToggling(member.id);
    try {
      await updateStaff(member.id, { is_active: !member.is_active });
      show(member.is_active ? `${member.display_name} can no longer sign in.` : `${member.display_name} can sign in again.`);
      await load();
    } catch (err) {
      show(describeApiError(err));
    } finally {
      setToggling(null);
    }
  };

  const unlock = async (member: StaffMember) => {
    setToggling(member.id);
    try {
      await updateStaff(member.id, { unlock: true });
      show(`${member.display_name} can try their PIN again.`);
      await load();
    } catch (err) {
      show(describeApiError(err));
    } finally {
      setToggling(null);
    }
  };

  const saved = (message: string) => {
    setEditor(null);
    show(message);
    void load();
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col">
      <AdminHeader />
      <div className="flex-1 flex flex-col md:flex-row">
        <AdminSidebar />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 overflow-x-hidden max-w-5xl">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-black tracking-tight uppercase">Staff</h1>
              <p className="text-xs text-star-muted mt-1">
                Staff sign in at <span className="text-white font-semibold">/staff</span> by tapping their name and entering their 4-digit PIN.
              </p>
            </div>
            <Button onClick={() => setEditor({ mode: 'create' })} leftIcon={<Plus className="w-4 h-4" />}>
              Add staff
            </Button>
          </div>

          {error && (
            <div className="flex items-center gap-3 rounded-2xl bg-star-red/10 border border-star-red/30 px-4 py-3 text-sm text-star-red" role="status">
              <span className="flex-1">{error}</span>
              <button type="button" onClick={() => void load()} className="inline-flex items-center gap-1.5 font-semibold cursor-pointer">
                <RefreshCw className="w-4 h-4" /> Retry
              </button>
            </div>
          )}

          {!staff ? (
            !error && <div className="h-48 rounded-2xl bg-[#141414] animate-pulse" aria-busy="true" />
          ) : staff.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#2A2A2A] p-10 text-center">
              <p className="font-semibold">No staff yet</p>
              <p className="mt-1 text-sm text-star-muted">Add your waiters, kitchen and bar team. Each gets a 4-digit PIN.</p>
              <Button className="mt-4" onClick={() => setEditor({ mode: 'create' })} leftIcon={<Plus className="w-4 h-4" />}>
                Add the first one
              </Button>
            </div>
          ) : (
            <>
              {ROLES.map(({ role, plural, Icon }) => {
                const people = staff.filter((m) => m.role === role && m.is_active);
                if (people.length === 0) return null;
                return (
                  <section key={role} aria-label={plural}>
                    <h2 className="mb-2.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-star-muted">
                      <Icon className="w-4 h-4 text-star-gold" /> {plural}
                      <span className="tabular text-white">{people.length}</span>
                    </h2>
                    <ul className="rounded-2xl bg-[#121212] border border-[#232323] divide-y divide-[#222222]">
                      {people.map((member) => (
                        <StaffRow key={member.id} member={member} busy={toggling === member.id} onEdit={setEditor} onToggle={toggleActive} onUnlock={unlock} />
                      ))}
                    </ul>
                  </section>
                );
              })}

              {inactive.length > 0 && (
                <section aria-label="Inactive staff">
                  <button
                    type="button"
                    onClick={() => setShowInactive((v) => !v)}
                    aria-expanded={showInactive}
                    className="mb-2.5 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-star-muted hover:text-white cursor-pointer"
                  >
                    <ChevronDown className={`w-4 h-4 transition-transform ${showInactive ? '' : '-rotate-90'}`} />
                    Inactive <span className="tabular text-white">{inactive.length}</span>
                  </button>
                  {showInactive && (
                    <ul className="rounded-2xl bg-[#121212] border border-[#232323] divide-y divide-[#222222]">
                      {inactive.map((member) => (
                        <StaffRow key={member.id} member={member} busy={toggling === member.id} onEdit={setEditor} onToggle={toggleActive} onUnlock={unlock} />
                      ))}
                    </ul>
                  )}
                </section>
              )}
            </>
          )}

          <DevicesPanel onMessage={show} />
        </main>
      </div>

      {editor && <StaffEditor editor={editor} onClose={() => setEditor(null)} onSaved={saved} />}
      {toast}
    </div>
  );
}

const ROLE_LABEL: Record<PinRole, string> = { waiter: 'Waiter', kitchen: 'Kitchen', bar: 'Bar' };

function StaffRow({
  member,
  busy,
  onEdit,
  onToggle,
  onUnlock,
}: {
  member: StaffMember;
  busy: boolean;
  onEdit: (editor: Editor) => void;
  onToggle: (member: StaffMember) => void;
  onUnlock: (member: StaffMember) => void;
}) {
  const isWaiter = member.role === 'waiter';
  return (
    <li className="p-4 flex flex-wrap items-center gap-x-4 gap-y-3">
      <div className={`min-w-0 flex-1 basis-48 ${member.is_active ? '' : 'opacity-60'}`}>
        <p className="font-semibold">
          {member.display_name}
          {!member.is_active && <span className="ml-2 text-xs font-normal text-star-muted">{ROLE_LABEL[member.role]}</span>}
        </p>
        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-star-muted">
          {member.is_active ? (
            <>
              <span className={`w-1.5 h-1.5 rounded-full ${SHIFT_DOT[member.shift_status]}`} />
              {SHIFT_LABEL[member.shift_status]}
              {isWaiter && (
                <>
                  {' · '}
                  {member.tables.length ? `tables ${member.tables.join(', ')}` : 'no tables'}
                  {member.open_orders > 0 && ` · ${member.open_orders} open`}
                </>
              )}
            </>
          ) : (
            'Can’t sign in'
          )}
          {!member.has_pin && <span className="text-star-red"> · no PIN set</span>}
          {member.locked && <span className="text-star-red"> · locked after wrong PINs</span>}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {member.locked && member.is_active && (
          <Button variant="outline" size="sm" isLoading={busy} onClick={() => onUnlock(member)} leftIcon={<LockOpen className="w-3.5 h-3.5" />}>
            Unlock
          </Button>
        )}
        {isWaiter && member.is_active && (
          <Link
            href="/admin/floor"
            className="inline-flex items-center text-xs font-semibold px-3 py-2 rounded-xl bg-[#1F1F1F] border border-[#2D2D2D] hover:bg-[#282828]"
          >
            Tables
          </Link>
        )}
        {member.is_active && (
          <>
            <Button variant="secondary" size="sm" onClick={() => onEdit({ mode: 'pin', member })} leftIcon={<KeyRound className="w-3.5 h-3.5" />}>
              New PIN
            </Button>
            <Button variant="secondary" size="sm" onClick={() => onEdit({ mode: 'edit', member })} leftIcon={<Pencil className="w-3.5 h-3.5" />}>
              Edit
            </Button>
          </>
        )}
        <Button
          variant={member.is_active ? 'danger' : 'secondary'}
          size="sm"
          isLoading={busy}
          onClick={() => onToggle(member)}
          leftIcon={<Power className="w-3.5 h-3.5" />}
        >
          {member.is_active ? 'Deactivate' : 'Reactivate'}
        </Button>
      </div>
    </li>
  );
}

function PinField({ value, onChange }: { value: string; onChange: (pin: string) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="staff-pin" className="text-xs font-medium uppercase tracking-wider text-star-muted">
        4-digit PIN
      </label>
      <div className="flex gap-2">
        <input
          id="staff-pin"
          inputMode="numeric"
          autoComplete="off"
          pattern="\d{4}"
          maxLength={4}
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
          className="flex-1 h-12 rounded-xl bg-[#0F0F0F] border border-[#2D2D2D] px-4 font-mono text-2xl tracking-[0.5em] text-white focus:outline-none focus:border-star-gold"
          placeholder="••••"
        />
        <Button type="button" variant="secondary" onClick={() => onChange(randomPin())} leftIcon={<Dices className="w-4 h-4" />}>
          Random
        </Button>
      </div>
      <p className="text-[11px] text-star-muted">Tell them in person. Repeats and runs like 1111, 1212 or 1234 aren’t allowed.</p>
    </div>
  );
}

function StaffEditor({ editor, onClose, onSaved }: { editor: Editor; onClose: () => void; onSaved: (message: string) => void }) {
  const member = editor.mode === 'create' ? null : editor.member;
  const [name, setName] = useState(member?.display_name ?? '');
  const [role, setRole] = useState<PinRole>(member?.role ?? 'waiter');
  const [pin, setPin] = useState(() => (editor.mode === 'edit' ? '' : randomPin()));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsPin = editor.mode !== 'edit';
  const valid = (editor.mode === 'pin' || name.trim().length > 0) && (!needsPin || /^\d{4}$/.test(pin));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    if (editor.mode === 'edit' && member && role !== member.role && member.role === 'waiter' && (member.tables.length || member.open_orders)) {
      if (!window.confirm(`${member.display_name} will lose tables ${member.tables.join(', ')} and their open orders go to the unassigned queue. Continue?`)) return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editor.mode === 'create') {
        const created = await createStaff({ display_name: name.trim(), role, pin });
        onSaved(`${created.display_name} added. Their PIN is ${pin}.`);
      } else if (editor.mode === 'pin') {
        await updateStaff(editor.member.id, { pin });
        onSaved(`${editor.member.display_name}’s new PIN is ${pin}.`);
      } else {
        await updateStaff(editor.member.id, { display_name: name.trim(), role });
        onSaved(`${name.trim()} updated.`);
      }
    } catch (err) {
      setError(describeApiError(err));
      setSaving(false);
    }
  };

  const title = editor.mode === 'create' ? 'Add staff' : editor.mode === 'pin' ? `New PIN for ${editor.member.display_name}` : `Edit ${editor.member.display_name}`;

  return (
    <Modal isOpen onClose={onClose} title={title} subtitle={editor.mode === 'pin' ? 'The old PIN stops working and any device signed in with it is signed out.' : undefined}>
      <form onSubmit={save} className="space-y-5">
        {editor.mode !== 'pin' && (
          <>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="staff-name" className="text-xs font-medium uppercase tracking-wider text-star-muted">
                Name shown on the sign-in screen
              </label>
              <input
                id="staff-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                autoFocus
                className="h-12 rounded-xl bg-[#0F0F0F] border border-[#2D2D2D] px-4 text-white focus:outline-none focus:border-star-gold"
                placeholder="e.g. Ama"
              />
            </div>
            <fieldset>
              <legend className="mb-1.5 text-xs font-medium uppercase tracking-wider text-star-muted">Role</legend>
              <div className="grid grid-cols-3 gap-2">
                {ROLES.map(({ role: value, label, Icon }) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={role === value}
                    onClick={() => setRole(value)}
                    className={`h-16 rounded-xl border flex flex-col items-center justify-center gap-1 text-sm font-semibold transition-colors cursor-pointer ${
                      role === value ? 'border-star-gold bg-star-gold/10 text-star-gold' : 'border-[#2A2A2A] text-zinc-300 hover:border-[#3A3A3A]'
                    }`}
                  >
                    <Icon className="w-4 h-4" /> {label}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] text-star-muted">{ROLES.find((r) => r.role === role)?.hint}</p>
              {member && role !== member.role && (
                <p className="mt-1 text-[11px] text-star-gold">They’ll be signed out and sign in again to reach their new screen.</p>
              )}
            </fieldset>
          </>
        )}

        {needsPin && <PinField value={pin} onChange={setPin} />}

        {error && <p className="text-sm text-star-red" role="alert">{error}</p>}
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" isLoading={saving} disabled={!valid} className="flex-1">
            {editor.mode === 'create' ? 'Add' : 'Save'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
