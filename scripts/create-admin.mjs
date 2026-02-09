import { createClient } from "@supabase/supabase-js";

function readArg(name) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return null;
  const value = process.argv[idx + 1];
  return value && !value.startsWith("--") ? value : null;
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const email = readArg("email") ?? process.env.ADMIN_EMAIL;
const password = readArg("password") ?? process.env.ADMIN_PASSWORD;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

if (!email || !password) {
  console.error("Missing --email/--password (or ADMIN_EMAIL/ADMIN_PASSWORD env vars)");
  process.exit(1);
}

const client = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findUserIdByEmail(targetEmail) {
  // Best effort lookup in case the user already exists.
  const perPage = 1000;
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const found = (data?.users ?? []).find(
      (u) => (u.email ?? "").toLowerCase() === targetEmail.toLowerCase(),
    );
    if (found?.id) return found.id;
    if ((data?.users ?? []).length < perPage) break;
  }
  return null;
}

const startedAt = new Date().toISOString();

let userId = null;
const created = await client.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});

if (created.error) {
  // If the user already exists, fall back to listUsers.
  const message = created.error.message ?? "";
  if (!/already|exists|registered/i.test(message)) {
    console.error(message);
    process.exit(1);
  }

  userId = await findUserIdByEmail(email);
  if (!userId) {
    console.error("Admin user exists but could not be found via listUsers()");
    process.exit(1);
  }
} else {
  userId = created.data?.user?.id ?? null;
}

const grant = await client
  .from("admin_users")
  .upsert({ id: userId }, { onConflict: "id" });

if (grant.error) {
  console.error(grant.error.message);
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      startedAt,
      finishedAt: new Date().toISOString(),
      admin_user_id: userId,
    },
    null,
    2,
  ),
);

