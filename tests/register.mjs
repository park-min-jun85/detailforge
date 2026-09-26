import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

// Node 24의 내장 TypeScript 실행에서 앱의 @/* alias와 확장자 없는 import를 해석한다.
const root = fileURLToPath(new URL("../", import.meta.url));
if (process.argv[1]?.endsWith('.test.mjs')) process.env.DETAILFORGE_TICKET_SECRET = 'unit-only-ticket-secret-not-a-deployment-key';
registerHooks({
  resolve(specifier, context, nextResolve) {
    // Unit feature tests use loopback transport fixtures. Actual runtime scripts
    // and security boundary tests resolve the production modules unchanged.
    const unit = process.argv[1]?.endsWith('.test.mjs') && !/auth-foundation|admission-security/.test(process.argv[1]);
    const target = specifier.startsWith('@/') ? path.join(root,'src',specifier.slice(2))+'.ts'
      : specifier.startsWith('file:') ? fileURLToPath(specifier)
      : context.parentURL && specifier.startsWith('.') ? fileURLToPath(new URL(specifier,context.parentURL)) : '';
    if (unit && target.replaceAll('\\','/').endsWith('/src/lib/supabase/user.ts'))
      return nextResolve(pathToFileURL(path.join(root,'tests/helpers/user-data-mock.mjs')).href,context);
    if (unit && target.replaceAll('\\','/').endsWith('/src/lib/abuse/admission.ts'))
      return nextResolve(pathToFileURL(path.join(root,'tests/helpers/admission-mock.mjs')).href,context);
    // Next documents extensionless subpaths; Node's ESM runner needs the files.
    if (specifier === "next/navigation") {
      // Match Next's react-server alias; the default entry also loads client hooks.
      return nextResolve("next/dist/client/components/navigation.react-server.js", context);
    }
    if (["next/headers", "next/server"].includes(specifier)) {
      return nextResolve(specifier + ".js", context);
    }
    if (specifier.startsWith("@/")) {
      return nextResolve(pathToFileURL(path.join(root, "src", specifier.slice(2))).href + ".ts", context);
    }
    if (specifier.startsWith(".") && context.parentURL && !path.extname(specifier)) {
      const candidate = new URL(specifier + ".ts", context.parentURL);
      if (existsSync(candidate)) return nextResolve(candidate.href, context);
    }
    return nextResolve(specifier, context);
  },
});
