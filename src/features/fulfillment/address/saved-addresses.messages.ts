export interface SavedAddressEditorMessages {
  readonly createHeading: string;
  readonly editHeading: string;
  readonly description: string;
  readonly fullAddress: string;
  readonly line1: string;
  readonly line2: string;
  readonly line3: string;
  readonly latitude: string;
  readonly longitude: string;
  readonly save: string;
  readonly saving: string;
  readonly retryIn: (seconds: number) => string;
  readonly cancel: string;
  readonly completeAddressRequired: string;
  readonly completeAddressLength: string;
  readonly line1Required: string;
  readonly line1Length: string;
  readonly line2Length: string;
  readonly line3Length: string;
  readonly latitudeInvalid: string;
  readonly longitudeInvalid: string;
  readonly remoteValidation: string;
  readonly remoteError: string;
  readonly rateLimited: string;
}

export interface SavedAddressesMessages {
  readonly heading: string;
  readonly signedOut: string;
  readonly signIn: string;
  readonly conflict: string;
  readonly loadError: string;
  readonly refresh: string;
  readonly refreshIn: (seconds: number) => string;
  readonly rateLimited: string;
  readonly add: string;
  readonly empty: string;
  readonly loadMore: string;
  readonly edit: string;
  readonly delete: string;
  readonly confirmDelete: string;
  readonly cancel: string;
  readonly selected: string;
  readonly pending: string;
  readonly refreshed: string;
  readonly loadedMore: string;
  readonly selectedStatus: string;
  readonly deletedStatus: string;
  readonly actionError: string;
  readonly policyUnavailable: string;
  readonly addressIncomplete: string;
  readonly outsidePolicy: (policyLabel: string) => string;
  readonly deliverTo: (label: string) => string;
  readonly deleteGroup: (label: string) => string;
  readonly editor: SavedAddressEditorMessages;
}

const englishMessages: SavedAddressesMessages = {
  heading: "Your saved addresses",
  signedOut: "Please sign in to view your saved addresses.",
  signIn: "Sign in",
  conflict:
    "This address changed elsewhere. Review the refreshed address before retrying.",
  loadError: "Saved addresses could not be loaded. Try again.",
  refresh: "Refresh addresses",
  refreshIn: (seconds) =>
    `Refresh addresses in ${seconds} ${seconds === 1 ? "second" : "seconds"}`,
  rateLimited: "Too many address requests. Please wait before trying again.",
  add: "Add a new address",
  empty: "You do not have any saved addresses yet.",
  loadMore: "Load more addresses",
  edit: "Edit",
  delete: "Delete",
  confirmDelete: "Confirm delete",
  cancel: "Cancel",
  selected: "Selected address",
  pending: "Updating saved addresses…",
  refreshed: "Saved addresses refreshed.",
  loadedMore: "More addresses loaded.",
  selectedStatus: "Saved address selected.",
  deletedStatus: "Saved address deleted.",
  actionError:
    "The address action could not be completed. Review the latest addresses and try again.",
  policyUnavailable:
    "Delivery selection is unavailable until the merchant delivery policy is configured.",
  addressIncomplete:
    "This saved address does not include enough structured information to check delivery availability.",
  outsidePolicy: (policyLabel) =>
    `This saved address is outside ${policyLabel}.`,
  deliverTo: (label) => `Deliver to ${label}`,
  deleteGroup: (label) => `Confirm deletion of ${label}`,
  editor: {
    createHeading: "Add a new address",
    editHeading: "Edit saved address",
    description:
      "Save the address exactly as it should appear for future deliveries.",
    fullAddress: "Complete address",
    line1: "Address line 1",
    line2: "Apartment, suite, or unit",
    line3: "City, region, and postcode",
    latitude: "Latitude",
    longitude: "Longitude",
    save: "Save address",
    saving: "Saving address…",
    retryIn: (seconds) =>
      `Try again in ${seconds} ${seconds === 1 ? "second" : "seconds"}`,
    cancel: "Cancel",
    completeAddressRequired: "Enter the complete address.",
    completeAddressLength:
      "Keep the complete address under 500 characters.",
    line1Required: "Enter address line 1.",
    line1Length: "Keep address line 1 under 200 characters.",
    line2Length: "Keep address line 2 under 200 characters.",
    line3Length: "Keep address line 3 under 200 characters.",
    latitudeInvalid: "Enter a latitude from -90 to 90.",
    longitudeInvalid: "Enter a longitude from -180 to 180.",
    remoteValidation: "Review the address fields and try again.",
    remoteError: "The address could not be saved. Try again.",
    rateLimited: "Too many address requests. Please wait before trying again.",
  },
};

export function getSavedAddressesMessages(
  locale = "en-US",
): SavedAddressesMessages {
  try {
    new Intl.Locale(locale);
  } catch {
    return englishMessages;
  }
  return englishMessages;
}
