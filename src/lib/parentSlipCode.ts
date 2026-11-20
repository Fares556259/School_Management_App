import { createHmac } from "node:crypto";
/** One reproducible delivery credential per parent, never per child or class. */
export function parentSlipCode(secret:string,schoolId:string,parentId:string){
 if(secret.length<32)throw new Error("La clé de génération des accès parents est indisponible.");
 const digest=createHmac("sha256",secret).update(JSON.stringify(["parent-paper-login-v1",schoolId,parentId])).digest();
 return String(10_000_000+Number(digest.readBigUInt64BE(0)%BigInt(90_000_000)));
}
