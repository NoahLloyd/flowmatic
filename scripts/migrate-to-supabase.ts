/**
 * MongoDB → Supabase Migration Script
 *
 * Prerequisites:
 *   1. Run `supabase/schema.sql` in the Supabase SQL Editor first.
 *   2. Install migration deps:
 *        npm install --save-dev mongodb @types/mongodb
 *   3. Run this script:
 *        npx tsx scripts/migrate-to-supabase.ts <your-new-password>
 *
 * What it does:
 *   - Connects to the existing MongoDB Atlas cluster (database: "flow")
 *   - Creates a Supabase Auth user with the password you provide
 *   - Migrates all data: sessions, tasks, writings, signals, notes, documents, weekly_reviews
 *   - Maps the old MongoDB user_id to the new Supabase Auth UUID
 *   - Skips test/mock users (e.g. test@example.com)
 *
 * Notes:
 *   - Old bcrypt passwords cannot be transferred to Supabase Auth.
 *   - The script uses the service_role key to bypass RLS.
 *   - This is a one-time migration for a single-user app.
 */

import { MongoClient } from "mongodb";
import { createClient } from "@supabase/supabase-js";

// ── Config ──────────────────────────────────────────────────

const MONGO_URI =
  "mongodb+srv://Cluster96360:aVZYGBvgbvApFPQ7@cluster96360.zv9sz4h.mongodb.net/?retryWrites=true&w=majority";
const MONGO_DB = "flow";

const SUPABASE_URL = "https://kujhoojkrxkoftcbrgun.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1amhvb2prcnhrb2Z0Y2JyZ3VuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTgwNzU5MiwiZXhwIjoyMDg3MzgzNTkyfQ.F6R4heb_RjmnaSSIbd1UHht7KGBJwOEblJUsDZREx7U";

// Emails to skip (test/mock users)
const SKIP_EMAILS = new Set(["test@example.com", "test@test.com"]);

// Create Supabase client with service_role key (bypasses RLS)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// ── Helpers ─────────────────────────────────────────────────

function log(msg: string) {
  console.log(`[migrate] ${msg}`);
}

function logCount(collection: string, count: number) {
  console.log(`  ✓ ${collection}: ${count} rows migrated`);
}

/** Convert a MongoDB date-like value to an ISO string, or return null */
function toISO(val: any): string | null {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString();
  if (typeof val === "string") {
    // Already an ISO-ish string – normalise it
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}

// ── Main ────────────────────────────────────────────────────

async function main() {
  // Get password from CLI args
  const password = process.argv[2];
  if (!password || password.length < 6) {
    console.error(
      "Usage: npx tsx scripts/migrate-to-supabase.ts <new-password>"
    );
    console.error("  Password must be at least 6 characters.");
    process.exit(1);
  }

  log("Starting MongoDB → Supabase migration");

  // 1. Connect to MongoDB
  log("Connecting to MongoDB...");
  const mongo = new MongoClient(MONGO_URI, {
    tls: true,
    // Node 22+ OpenSSL may reject older Atlas TLS; allow it
    tlsAllowInvalidCertificates: true,
  });
  await mongo.connect();
  const db = mongo.db(MONGO_DB);
  log("Connected to MongoDB ✓");

  // 2. Read the user from MongoDB
  const mongoUsers = await db.collection("user").find({}).toArray();
  if (mongoUsers.length === 0) {
    log("No users found in MongoDB. Nothing to migrate.");
    await mongo.close();
    return;
  }

  log(`Found ${mongoUsers.length} user(s) in MongoDB.`);

  for (const mongoUser of mongoUsers) {
    const oldUserId = mongoUser._id.toString();
    const email = mongoUser.email;
    const name = mongoUser.name || "";
    const preferences = mongoUser.preferences || {};
    const pictureUrl = mongoUser.picture_url || null;

    // Skip test/mock users
    if (!email || SKIP_EMAILS.has(email)) {
      log(`Skipping test user: ${email || "(no email)"}`);
      continue;
    }

    log(`\nMigrating user: ${name} <${email}> (Mongo _id: ${oldUserId})`);

    // 3. Create user in Supabase Auth via admin API
    // Check if user already exists in Supabase
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      (u: any) => u.email === email
    );

    let newUserId: string;

    if (existingUser) {
      log(
        `User ${email} already exists in Supabase Auth. Using existing ID.`
      );
      newUserId = existingUser.id;
    } else {
      const { data: authData, error: authError } =
        await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { name },
        });

      if (authError) {
        log(`Failed to create auth user: ${authError.message}`);
        continue;
      }

      newUserId = authData.user.id;
      log(`Created Supabase Auth user: ${newUserId}`);
    }

    // 4. Upsert profile (the trigger may have already created one)
    const { error: profileError } = await supabase.from("profiles").upsert(
      {
        id: newUserId,
        name,
        email,
        picture_url: pictureUrl,
        preferences,
      },
      { onConflict: "id" }
    );
    if (profileError) {
      log(`Warning: profile upsert error: ${profileError.message}`);
    } else {
      log("Profile upserted ✓");
    }

    // 5. Migrate sessions
    const sessions = await db
      .collection("session")
      .find({ user_id: oldUserId })
      .toArray();
    if (sessions.length > 0) {
      const rows = sessions.map((s) => ({
        user_id: newUserId,
        notes: s.notes || "",
        task: s.task || "",
        project: s.project || "",
        minutes: s.minutes ?? 60,
        focus: s.focus ?? 3,
        created_at: toISO(s.created_at) || new Date().toISOString(),
      }));

      const { error } = await supabase.from("sessions").insert(rows);
      if (error) log(`  ✗ sessions error: ${error.message}`);
      else logCount("sessions", rows.length);
    } else {
      logCount("sessions", 0);
    }

    // 6. Migrate tasks
    const tasks = await db
      .collection("task")
      .find({ user_id: oldUserId })
      .toArray();
    if (tasks.length > 0) {
      const rows = tasks.map((t) => ({
        user_id: newUserId,
        title: t.title,
        type: t.type,
        completed: t.completed ?? false,
        completed_at: toISO(t.completedAt),
        created_at: toISO(t.createdAt) || new Date().toISOString(),
      }));

      const { error } = await supabase.from("tasks").insert(rows);
      if (error) log(`  ✗ tasks error: ${error.message}`);
      else logCount("tasks", rows.length);
    } else {
      logCount("tasks", 0);
    }

    // 7. Migrate writings
    const writings = await db
      .collection("writing")
      .find({ user_id: oldUserId })
      .toArray();
    if (writings.length > 0) {
      const rows = writings.map((w) => ({
        user_id: newUserId,
        date: w.date,
        activity_content: w.activityContent || {},
        start_time: w.start_time || null,
        end_time: w.end_time || null,
      }));

      const { error } = await supabase.from("writings").insert(rows);
      if (error) log(`  ✗ writings error: ${error.message}`);
      else logCount("writings", rows.length);
    } else {
      logCount("writings", 0);
    }

    // 8. Migrate signals
    const signals = await db
      .collection("signals")
      .find({ user_id: oldUserId })
      .toArray();
    if (signals.length > 0) {
      const rows = signals.map((s) => ({
        user_id: newUserId,
        date: s.date,
        metric: s.metric,
        value: s.value,
        updated_at: toISO(s.updated_at) || new Date().toISOString(),
      }));

      // Insert in batches to avoid payload limits
      const BATCH_SIZE = 500;
      let totalInserted = 0;
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.from("signals").insert(batch);
        if (error) {
          log(`  ✗ signals batch error: ${error.message}`);
          break;
        }
        totalInserted += batch.length;
      }
      logCount("signals", totalInserted);
    } else {
      logCount("signals", 0);
    }

    // 9. Migrate notes
    const notes = await db
      .collection("note")
      .find({ user_id: oldUserId })
      .toArray();
    if (notes.length > 0) {
      const rows = notes.map((n) => ({
        user_id: newUserId,
        content: n.content || "",
        tags: n.tags || [],
        is_processed: n.is_processed ?? false,
        created_at: toISO(n.created_at) || new Date().toISOString(),
        updated_at: toISO(n.updated_at) || new Date().toISOString(),
      }));

      const { error } = await supabase.from("notes").insert(rows);
      if (error) log(`  ✗ notes error: ${error.message}`);
      else logCount("notes", rows.length);
    } else {
      logCount("notes", 0);
    }

    // 10. Migrate documents
    const documents = await db
      .collection("document")
      .find({ user_id: oldUserId })
      .toArray();
    if (documents.length > 0) {
      const rows = documents.map((d) => ({
        user_id: newUserId,
        title: d.title || "",
        content: d.content || "",
        publication_status: d.publication_status || "unpublished",
        created_at: toISO(d.created_at) || new Date().toISOString(),
        updated_at: toISO(d.updated_at) || new Date().toISOString(),
      }));

      const { error } = await supabase.from("documents").insert(rows);
      if (error) log(`  ✗ documents error: ${error.message}`);
      else logCount("documents", rows.length);
    } else {
      logCount("documents", 0);
    }

    // 11. Migrate weekly_reviews
    const reviews = await db
      .collection("weekly_reviews")
      .find({ user_id: oldUserId })
      .toArray();
    if (reviews.length > 0) {
      const rows = reviews.map((r) => ({
        user_id: newUserId,
        week_start: r.week_start,
        week_end: r.week_end || "",
        checklist: r.checklist || [],
        questions: r.questions || [],
        inbox_items: r.inbox_items || [],
        is_completed: r.is_completed ?? false,
        completed_at: toISO(r.completed_at),
        created_at: toISO(r.created_at) || new Date().toISOString(),
        updated_at: toISO(r.updated_at) || new Date().toISOString(),
      }));

      const { error } = await supabase.from("weekly_reviews").insert(rows);
      if (error) log(`  ✗ weekly_reviews error: ${error.message}`);
      else logCount("weekly_reviews", rows.length);
    } else {
      logCount("weekly_reviews", 0);
    }

    log(`\nMigration complete for ${email}!`);
  }

  // Clean up
  await mongo.close();
  log("\nAll done! MongoDB connection closed.");
  log("\nNext steps:");
  log("  1. Log in to Flowmatic with your email and new password.");
  log("  2. Verify your data looks correct.");
  log(
    "  3. Once confirmed, you can decommission the FastAPI backend and MongoDB."
  );
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
