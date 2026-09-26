// Existing feature regression tests mock infrastructure, including admission.
// Security/atomicity evidence lives in admission-runtime.supabase.mjs.
import {randomUUID} from 'node:crypto';
import {storagePath} from '../../src/features/assets/schemas.ts';
export async function issueUpload(_client,projectId,productId,mime){const id=randomUUID();return {id,path:storagePath(projectId,productId,id,mime),async settle(){}};}
export async function withPaidOperation(_client,_project,_operation,_input,dispatch){return dispatch();}
