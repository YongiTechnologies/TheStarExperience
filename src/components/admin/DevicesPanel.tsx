'use client';

import React, { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Check, Copy, Laptop, Plus, RefreshCw, Share2, Smartphone, Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import {
  addDevice,
  approveThisDevice,
  describeApiError,
  getDevices,
  getStaffDevice,
  newDeviceCode,
  removeDevice,
} from '@/lib/api';
import { formatAge, minutesSince, useNow } from '@/lib/useNow';
import { DevicePairing, StaffDeviceInfo } from '@/types';

/**
 * Phones and tablets approved for staff sign-in. Unapproved browsers can't see staff
 * names or try PINs, so nobody outside can guess PINs or lock staff out.
 */
export function DevicesPanel({ onMessage }: { onMessage: (text: string) => void }) {
  const now = useNow(30000);
  const [devices, setDevices] = useState<StaffDeviceInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pairing, setPairing] = useState<DevicePairing | null>(null);
  const [naming, setNaming] = useState<'other' | 'this' | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [thisDeviceId, setThisDeviceId] = useState<number | null>(null);
  const [thisApproved, setThisApproved] = useState(false);

  const load = useCallback(async () => {
    try {
      setDevices(await getDevices());
      setError(null);
    } catch (err) {
      setError(describeApiError(err));
    }
    const mine = getStaffDevice();
    setThisApproved(Boolean(mine));
    setThisDeviceId(mine?.id ?? null);
  }, []);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const remove = async (device: StaffDeviceInfo) => {
    if (!window.confirm(`Remove ${device.name}? Anyone signed in on it is signed out, and it stops getting alerts.`)) return;
    setBusyId(device.id);
    try {
      await removeDevice(device.id);
      onMessage(`${device.name} removed.`);
      await load();
    } catch (err) {
      onMessage(describeApiError(err));
    } finally {
      setBusyId(null);
    }
  };

  const reissue = async (device: StaffDeviceInfo) => {
    setBusyId(device.id);
    try {
      setPairing(await newDeviceCode(device.id));
      await load();
    } catch (err) {
      onMessage(describeApiError(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section aria-label="Devices" className="pt-2">
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-star-muted">
          <Smartphone className="w-4 h-4 text-star-gold" /> Devices
          {devices && <span className="tabular text-white">{devices.length}</span>}
        </h2>
        <div className="ml-auto flex flex-wrap gap-2">
          {!thisApproved && (
            <Button variant="secondary" size="sm" onClick={() => setNaming('this')} leftIcon={<Laptop className="w-3.5 h-3.5" />}>
              Use this browser
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setNaming('other')} leftIcon={<Plus className="w-3.5 h-3.5" />}>
            Add device
          </Button>
        </div>
      </div>
      <p className="mb-3 text-xs text-star-muted">
        Staff can only sign in on phones and tablets approved here, so nobody outside can see names, guess PINs or lock staff out.
      </p>

      {error ? (
        <div className="flex items-center gap-3 rounded-2xl bg-star-red/10 border border-star-red/30 px-4 py-3 text-sm text-star-red">
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => void load()} className="inline-flex items-center gap-1.5 font-semibold cursor-pointer">
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        </div>
      ) : !devices ? (
        <div className="h-20 rounded-2xl bg-[#141414] animate-pulse" aria-busy="true" />
      ) : devices.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[#2A2A2A] p-6 text-center text-sm text-star-muted">
          No devices yet. Add each waiter’s phone and the kitchen and bar tablets.
        </p>
      ) : (
        <ul className="rounded-2xl bg-[#121212] border border-[#232323] divide-y divide-[#222222]">
          {devices.map((device) => {
            const expiresIn = device.pairing_expires_at
              ? Math.max(0, Math.ceil((new Date(device.pairing_expires_at).getTime() - now) / 60000))
              : 0;
            return (
              <li key={device.id} className="p-4 flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="min-w-0 flex-1 basis-48">
                  <p className="font-semibold">
                    {device.name}
                    {device.id === thisDeviceId && (
                      <span className="ml-2 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-star-gold/15 text-star-gold">
                        This browser
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-star-muted">
                    {device.paired
                      ? device.last_seen_at && minutesSince(device.last_seen_at, now) < 1
                        ? 'Set up · in use now'
                        : `Set up · last used ${device.last_seen_at ? `${formatAge(device.last_seen_at, now)} ago` : 'never'}`
                      : <span className="text-star-gold">Waiting for its code · expires in {expiresIn} min</span>}
                  </p>
                </div>
                <div className="flex gap-2">
                  {!device.paired && (
                    <Button variant="secondary" size="sm" isLoading={busyId === device.id} onClick={() => void reissue(device)}>
                      Show new code
                    </Button>
                  )}
                  <Button
                    variant="danger"
                    size="sm"
                    isLoading={busyId === device.id && device.paired}
                    onClick={() => void remove(device)}
                    leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                  >
                    Remove
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {naming && (
        <NameDeviceModal
          forThisBrowser={naming === 'this'}
          onClose={() => setNaming(null)}
          onCreated={async (result) => {
            setNaming(null);
            if (result.kind === 'pairing') setPairing(result.pairing);
            else onMessage(`This browser is approved as “${result.name}”. Staff can sign in here at /staff.`);
            await load();
          }}
        />
      )}
      {pairing && <PairingCodeModal pairing={pairing} onClose={() => setPairing(null)} />}
    </section>
  );
}

type Created = { kind: 'pairing'; pairing: DevicePairing } | { kind: 'this'; name: string };

function NameDeviceModal({
  forThisBrowser,
  onClose,
  onCreated,
}: {
  forThisBrowser: boolean;
  onClose: () => void;
  onCreated: (result: Created) => void | Promise<void>;
}) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    setError(null);
    try {
      if (forThisBrowser) {
        await approveThisDevice(trimmed);
        await onCreated({ kind: 'this', name: trimmed });
      } else {
        await onCreated({ kind: 'pairing', pairing: await addDevice(trimmed) });
      }
    } catch (err) {
      setError(describeApiError(err));
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={forThisBrowser ? 'Use this browser for staff' : 'Add a device'}
      subtitle={forThisBrowser ? 'Staff will be able to sign in here with their PIN.' : 'You’ll get a one-time code to type on the device.'}
    >
      <form onSubmit={save} className="space-y-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="device-name" className="text-xs font-medium uppercase tracking-wider text-star-muted">
            Device name
          </label>
          <input
            id="device-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            autoFocus
            placeholder={forThisBrowser ? 'e.g. Bar tablet' : 'e.g. Ama’s phone, Kitchen tablet'}
            className="h-12 rounded-xl bg-[#0F0F0F] border border-[#2D2D2D] px-4 text-white focus:outline-none focus:border-star-gold"
          />
        </div>
        {error && <p className="text-sm text-star-red" role="alert">{error}</p>}
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" isLoading={saving} disabled={!name.trim()} className="flex-1">
            {forThisBrowser ? 'Approve' : 'Get code'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * The address staff phones should open. NEXT_PUBLIC_SITE_URL wins (set it when the admin
 * runs on a computer whose address phones can't reach); otherwise the admin's own address.
 */
function staffSiteUrl(): { base: string; localOnly: boolean } {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '');
  if (configured) return { base: configured, localOnly: false };
  if (typeof window === 'undefined') return { base: '', localOnly: false };
  const host = window.location.hostname;
  const localOnly = host === 'localhost' || host === '[::1]' || host === '0.0.0.0' || host.startsWith('127.');
  return { base: window.location.origin, localOnly };
}

function PairingCodeModal({ pairing, onClose }: { pairing: DevicePairing; onClose: () => void }) {
  const { base, localOnly } = staffSiteUrl();
  const link = `${base}/staff?code=${pairing.code}`;
  const expires = new Date(pairing.expires_at).toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' });
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  useEffect(() => {
    let cancelled = false;
    void QRCode.toDataURL(link, { margin: 1, width: 440, errorCorrectionLevel: 'M', color: { dark: '#0C0B09', light: '#F4EFE6' } })
      .then((url) => !cancelled && setQr(url))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [link]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      window.prompt('Copy this setup link:', link);
    }
  };

  const share = () =>
    void navigator
      .share({ title: 'Star Staff setup', text: `Set up ${pairing.name} for staff sign-in (works once, until ${expires}):`, url: link })
      .catch(() => undefined);

  return (
    <Modal isOpen onClose={onClose} title={`Set up ${pairing.name}`} subtitle={`Works once, until it’s used or ${expires}.`}>
      {localOnly && (
        <p className="mb-4 rounded-xl bg-star-gold/10 border border-star-gold/30 px-3 py-2.5 text-xs text-star-gold">
          This is this computer’s local address, which phones can’t open. Open the admin from your public address (the one on the
          table QR codes), or set NEXT_PUBLIC_SITE_URL to it.
        </p>
      )}
      <div className="flex flex-col items-center text-center">
        <p className="text-sm text-zinc-300">Scan with the device’s camera, then tap <strong className="text-white">Set up this device</strong>.</p>
        <div className="mt-3 w-[220px] h-[220px] rounded-2xl bg-cream p-2 grid place-items-center">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element -- a generated data URL, nothing to optimise
            <img src={qr} alt={`QR code that opens the setup link for ${pairing.name}`} width={204} height={204} />
          ) : (
            <span className="w-full h-full rounded-xl bg-zinc-300 animate-pulse" />
          )}
        </div>
        <p className="mt-4 text-xs text-star-muted">
          or open <span className="font-mono text-white break-all">{base}/staff</span> on it and type
        </p>
        <p
          className="mt-2 font-mono text-[36px] leading-none font-black tracking-[0.2em] text-star-gold select-all"
          aria-label={`Setup code ${pairing.code.split('').join(' ')}`}
        >
          {pairing.code}
        </p>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={() => void copy()} leftIcon={copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}>
          {copied ? 'Link copied' : 'Copy link'}
        </Button>
        {canShare ? (
          <Button variant="secondary" onClick={share} leftIcon={<Share2 className="w-4 h-4" />}>
            Send link
          </Button>
        ) : (
          <Button onClick={onClose}>Done</Button>
        )}
      </div>
      {canShare && (
        <Button onClick={onClose} className="mt-2 w-full">
          Done
        </Button>
      )}
      <p className="mt-3 text-center text-[11px] text-star-muted">Not with them? Send the link on WhatsApp. It only works once.</p>
    </Modal>
  );
}
