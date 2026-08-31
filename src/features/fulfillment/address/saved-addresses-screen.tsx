"use client";

import type {
  CustomerAddress,
  CustomerAddressInput,
} from "@craveup/storefront-sdk";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  toStorefrontCustomerTransportError,
} from "@/lib/storefront/customer";
import {
  useStorefrontCustomer,
  type StorefrontCustomerTransportLoader,
} from "@/lib/storefront/use-customer";

import { loadFixtureCustomerTransport } from "@/features/status/customer-transport-loader";

import { SavedAddressEditor } from "./saved-address-editor";
import {
  SavedAddresses,
  type SavedAddress,
  type SavedAddressView,
} from "./saved-addresses";
import { getSavedAddressesMessages } from "./saved-addresses.messages";
import type { DeliveryPolicy } from "./serviceability";

const pageSize = 20;

function retryAfterSeconds(retryAfterMs: number | undefined) {
  return Math.max(Math.ceil((retryAfterMs ?? 1_000) / 1_000), 1);
}

function idempotencyKey(action: "create" | "update" | "delete") {
  return `saved_address_${action}_${crypto.randomUUID()}`;
}

function toSavedAddress(address: CustomerAddress): SavedAddress {
  return {
    id: address.addressId,
    revision: address.revision,
    formattedLabel: address.fullAddress,
    street: address.line1,
    streetOptional: address.line2 || undefined,
    latitude: address.lat,
    longitude: address.lng,
  };
}

type EditorState =
  | { readonly kind: "create" }
  | { readonly kind: "edit"; readonly address: CustomerAddress };

type MutationAction = "create" | "update" | "delete";

interface MutationAttempt {
  readonly action: MutationAction;
  readonly signature: string;
  readonly idempotencyKey: string;
}

export interface SavedAddressesScreenProps {
  merchantSlug: string;
  locale: string;
  mode: "fixture" | "live";
  policy?: DeliveryPolicy;
  getTransport?: StorefrontCustomerTransportLoader;
  createIdempotencyKey?: (
    action: "create" | "update" | "delete",
  ) => string;
  onApplyAddress?: (address: CustomerAddress) => void | Promise<void>;
}

function mergeAddressPages(
  current: readonly CustomerAddress[],
  incoming: readonly CustomerAddress[],
) {
  const merged = new Map(current.map((address) => [address.addressId, address]));
  for (const address of incoming) merged.set(address.addressId, address);
  return [...merged.values()];
}

export function SavedAddressesScreen({
  merchantSlug,
  ...props
}: SavedAddressesScreenProps) {
  return (
    <ScopedSavedAddressesScreen
      key={merchantSlug}
      merchantSlug={merchantSlug}
      {...props}
    />
  );
}

function ScopedSavedAddressesScreen({
  merchantSlug,
  locale,
  mode,
  policy,
  getTransport,
  createIdempotencyKey = idempotencyKey,
  onApplyAddress,
}: SavedAddressesScreenProps) {
  const transportLoader =
    getTransport ??
    (mode === "fixture" ? loadFixtureCustomerTransport : undefined);
  const customer = useStorefrontCustomer({
    merchantSlug,
    ...(transportLoader ? { getTransport: transportLoader } : {}),
  });
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [nextCursor, setNextCursor] = useState<string>();
  const [view, setView] = useState<SavedAddressView>("pending");
  const [editor, setEditor] = useState<EditorState>();
  const [editorPending, setEditorPending] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>();
  const [rateLimitRemaining, setRateLimitRemaining] = useState(0);
  const bootstrappedRef = useRef(false);
  const mutationAttemptRef = useRef<MutationAttempt | null>(null);
  const messages = useMemo(
    () => getSavedAddressesMessages(locale),
    [locale],
  );

  const loadAddresses = useCallback(
    async (cursor?: string, preserveView?: SavedAddressView) => {
      if (!cursor) setView("pending");
      try {
        const page = await customer.addresses.list({
          limit: pageSize,
          ...(cursor ? { cursor } : {}),
        });
        setAddresses((current) =>
          cursor ? mergeAddressPages(current, page.items) : page.items,
        );
        setNextCursor(page.nextCursor ?? undefined);
        setRateLimitRemaining(0);
        setView(preserveView ?? "ready");
      } catch (error) {
        const safeError = toStorefrontCustomerTransportError(error);
        if (safeError.state === "rate-limited") {
          setRateLimitRemaining(retryAfterSeconds(safeError.retryAfterMs));
        }
        setView(
          safeError.state === "authentication-required"
            ? "signed-out"
            : safeError.state === "resource-conflict"
              ? "conflict"
              : "error",
        );
        throw safeError;
      }
    },
    [customer.addresses],
  );

  useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;
    void loadAddresses().catch(() => undefined);
  }, [loadAddresses]);

  useEffect(() => {
    if (rateLimitRemaining <= 0) return;
    const timeout = window.setTimeout(() => {
      setRateLimitRemaining((seconds) => Math.max(seconds - 1, 0));
    }, 1_000);
    return () => window.clearTimeout(timeout);
  }, [rateLimitRemaining]);

  function keyForAttempt(action: MutationAction, signature: string) {
    const attempt = mutationAttemptRef.current;
    if (attempt?.action === action && attempt.signature === signature) {
      return attempt.idempotencyKey;
    }
    const nextAttempt = {
      action,
      signature,
      idempotencyKey: createIdempotencyKey(action),
    } satisfies MutationAttempt;
    mutationAttemptRef.current = nextAttempt;
    return nextAttempt.idempotencyKey;
  }

  function clearAttempt(action: MutationAction, signature: string) {
    const attempt = mutationAttemptRef.current;
    if (attempt?.action === action && attempt.signature === signature) {
      mutationAttemptRef.current = null;
    }
  }

  async function refreshConflict() {
    try {
      await loadAddresses(undefined, "conflict");
    } catch {
      // loadAddresses exposes the bounded replacement state.
    }
  }

  async function saveAddress(payload: CustomerAddressInput) {
    const action = editor?.kind === "edit" ? "update" : "create";
    const signature = JSON.stringify({
      action,
      ...(editor?.kind === "edit"
        ? {
            addressId: editor.address.addressId,
            revision: editor.address.revision,
          }
        : {}),
      payload,
    });
    setEditorPending(true);
    setEditorError(null);
    try {
      if (editor?.kind === "edit") {
        const updated = await customer.addresses.update(
          editor.address.addressId,
          payload,
          {
            revision: editor.address.revision,
            idempotencyKey: keyForAttempt("update", signature),
          },
        );
        setAddresses((current) =>
          current.map((address) =>
            address.addressId === updated.addressId ? updated : address,
          ),
        );
      } else {
        const created = await customer.addresses.create(payload, {
          idempotencyKey: keyForAttempt("create", signature),
        });
        setAddresses((current) => [...current, created]);
      }
      clearAttempt(action, signature);
      setEditor(undefined);
      setView("ready");
    } catch (error) {
      const safeError = toStorefrontCustomerTransportError(error);
      if (safeError.state === "authentication-required") {
        clearAttempt(action, signature);
        setEditor(undefined);
        setView("signed-out");
      } else if (safeError.state === "resource-conflict") {
        clearAttempt(action, signature);
        setEditor(undefined);
        await refreshConflict();
      } else if (safeError.state === "rate-limited") {
        setRateLimitRemaining(retryAfterSeconds(safeError.retryAfterMs));
        setEditorError(null);
      } else {
        setEditorError(
          safeError.state === "validation"
            ? messages.editor.remoteValidation
            : messages.editor.remoteError,
        );
      }
    } finally {
      setEditorPending(false);
    }
  }

  async function deleteAddress(addressId: string) {
    const signature = JSON.stringify({ action: "delete", addressId });
    try {
      await customer.addresses.delete(addressId, {
        idempotencyKey: keyForAttempt("delete", signature),
      });
      clearAttempt("delete", signature);
      setAddresses((current) =>
        current.filter((address) => address.addressId !== addressId),
      );
      if (selectedId === addressId) setSelectedId(undefined);
    } catch (error) {
      const safeError = toStorefrontCustomerTransportError(error);
      if (safeError.state === "authentication-required") {
        clearAttempt("delete", signature);
        setView("signed-out");
      } else if (safeError.state === "resource-conflict") {
        clearAttempt("delete", signature);
        await refreshConflict();
      } else if (safeError.state === "rate-limited") {
        setRateLimitRemaining(retryAfterSeconds(safeError.retryAfterMs));
      }
      throw safeError;
    }
  }

  const presentationAddresses = addresses.map(toSavedAddress);

  return (
    <>
      <SavedAddresses
        addresses={presentationAddresses}
        policy={policy}
        view={view}
        selectedId={selectedId}
        nextCursor={nextCursor}
        retryAfterSeconds={rateLimitRemaining}
        showDeliveryAction={Boolean(onApplyAddress && policy) && !editor}
        messages={messages}
        onCreate={() => {
          mutationAttemptRef.current = null;
          setEditorError(null);
          setEditor({ kind: "create" });
        }}
        onEdit={(address) => {
          const source = addresses.find(
            (candidate) => candidate.addressId === address.id,
          );
          if (!source) return;
          mutationAttemptRef.current = null;
          setEditorError(null);
          setEditor({ kind: "edit", address: source });
        }}
        onDelete={({ addressId }) => deleteAddress(addressId)}
        onLoadMore={(cursor) => loadAddresses(cursor)}
        onRetry={() => loadAddresses()}
        onSelect={
          onApplyAddress
            ? async (address) => {
                const source = addresses.find(
                  (candidate) => candidate.addressId === address.id,
                );
                if (!source) return;
                await onApplyAddress(source);
                setSelectedId(source.addressId);
              }
            : undefined
        }
      />
      {editor ? (
        <SavedAddressEditor
          address={editor.kind === "edit" ? editor.address : undefined}
          pending={editorPending}
          retryAfterSeconds={rateLimitRemaining}
          remoteError={editorError}
          messages={messages.editor}
          onCancel={() => {
            mutationAttemptRef.current = null;
            setEditor(undefined);
          }}
          onSubmit={saveAddress}
        />
      ) : null}
    </>
  );
}
