import { fulfillmentRoutes } from "./routes";
import {
  fulfillmentModeLabels,
  hasValidCoordinates,
  type FulfillmentDescription,
  type FulfillmentDetail,
} from "./types";

function present(value: string | undefined) {
  return Boolean(value?.trim());
}

export function isFulfillmentComplete(detail: FulfillmentDetail): boolean {
  switch (detail.mode) {
    case "takeout":
      return true;
    case "delivery":
      return Boolean(
        detail.address &&
          detail.address.formattedLabel.trim() &&
          present(detail.address.street) &&
          present(detail.address.city) &&
          present(detail.address.region) &&
          present(detail.address.postcode) &&
          hasValidCoordinates(detail.address) &&
          detail.address.countryCode.trim(),
      );
    case "table-side":
      return present(detail.tableIdentifier);
    case "room-service":
      return present(detail.roomIdentifier) && present(detail.lastName);
  }
}

export function describeFulfillment(
  detail: FulfillmentDetail,
  locationId: string,
): FulfillmentDescription {
  const complete = isFulfillmentComplete(detail);

  switch (detail.mode) {
    case "takeout":
      return {
        modeLabel: fulfillmentModeLabels.takeout,
        summary: "Pick up at the restaurant",
        complete,
        changeHref: fulfillmentRoutes.mode(locationId),
      };
    case "delivery":
      return {
        modeLabel: fulfillmentModeLabels.delivery,
        summary: complete ? detail.address!.formattedLabel.trim() : "Add a delivery address",
        complete,
        changeHref: fulfillmentRoutes.address(locationId),
      };
    case "table-side":
      return {
        modeLabel: fulfillmentModeLabels["table-side"],
        summary: complete ? `Table ${detail.tableIdentifier!.trim()}` : "Add your table number",
        complete,
        changeHref: fulfillmentRoutes.table(locationId),
      };
    case "room-service":
      return {
        modeLabel: fulfillmentModeLabels["room-service"],
        summary: complete ? `Room ${detail.roomIdentifier!.trim()}` : "Add your room details",
        complete,
        changeHref: fulfillmentRoutes.room(locationId),
      };
  }
}
