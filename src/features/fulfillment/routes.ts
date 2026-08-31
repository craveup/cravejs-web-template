function segment(value: string) {
  return encodeURIComponent(value);
}

export const fulfillmentRoutes = {
  store(locationId: string) {
    return `/${segment(locationId)}`;
  },
  mode(locationId: string) {
    return `/${segment(locationId)}/fulfillment`;
  },
  time(locationId: string) {
    return `/${segment(locationId)}/fulfillment/time`;
  },
  address(locationId: string) {
    return `/${segment(locationId)}/fulfillment/address`;
  },
  delivery(locationId: string) {
    return `/${segment(locationId)}/fulfillment/delivery`;
  },
  table(locationId: string) {
    return `/${segment(locationId)}/fulfillment/table`;
  },
  room(locationId: string) {
    return `/${segment(locationId)}/fulfillment/room`;
  },
  stores() {
    return "/stores";
  },
  savedAddresses() {
    return "/addresses";
  },
} as const;
