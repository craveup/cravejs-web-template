import type { NormalizedAddress } from "../types";
import styles from "./delivery-address-form.module.css";

export function AddressResults({
  results,
  onSelect,
}: {
  results: readonly NormalizedAddress[];
  onSelect: (address: NormalizedAddress) => void;
}) {
  if (!results.length) return null;
  return (
    <ul className={styles.results} aria-label="Address results">
      {results.map((address) => (
        <li key={`${address.formattedLabel}:${address.latitude}:${address.longitude}`}>
          <button type="button" onClick={() => onSelect(address)}>
            <span aria-hidden="true" />
            <span>
              <strong>{address.street ?? address.formattedLabel}</strong>
              <small>
                {[address.city, address.region].filter(Boolean).join(", ")}
                {address.postcode ? ` ${address.postcode}` : ""}
              </small>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
