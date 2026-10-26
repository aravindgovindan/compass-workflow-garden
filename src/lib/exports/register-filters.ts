import { NO_OWNER } from "@/lib/schemas/registers";
export function ownerOr(owner:string[]){const ids=owner.filter(o=>o!==NO_OWNER);return [ids.length?`owner_id.in.(${ids.join(",")})`:null,owner.includes(NO_OWNER)?"owner_id.is.null":null].filter(Boolean).join(",");}
