// Legacy unit transport fixtures only. Loaded explicitly by the Node test hook;
// never imported by src or actual Supabase runtime tests.
import {createClient} from '@supabase/supabase-js';
import assert from 'node:assert/strict';
export async function createUserDataClient(){
  const url=new URL(process.env.SUPABASE_URL);assert.equal(url.hostname,'127.0.0.1');
  return createClient(url.origin,'public-unit-fixture-key',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
}
export async function getUserContext(){return {client:await createUserDataClient(),principal:{userId:'1645f432-b847-4e28-9ee7-f41beccccf46'}};}
