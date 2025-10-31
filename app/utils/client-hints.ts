import { getHintUtils } from "@epic-web/client-hints";
import { clientHint as timeZoneHint } from "@epic-web/client-hints/time-zone";

export const hintsUtils = getHintUtils({
    timeZone: timeZoneHint,
});

export const { getHints } = hintsUtils;

