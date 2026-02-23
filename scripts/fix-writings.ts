import { MongoClient } from "mongodb";
import { createClient } from "@supabase/supabase-js";

const mongo = new MongoClient(
  "mongodb+srv://Cluster96360:aVZYGBvgbvApFPQ7@cluster96360.zv9sz4h.mongodb.net/?retryWrites=true&w=majority",
  { tls: true, tlsAllowInvalidCertificates: true }
);
const supabase = createClient(
  "https://kujhoojkrxkoftcbrgun.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1amhvb2prcnhrb2Z0Y2JyZ3VuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTgwNzU5MiwiZXhwIjoyMDg3MzgzNTkyfQ.F6R4heb_RjmnaSSIbd1UHht7KGBJwOEblJUsDZREx7U",
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const NEW_USER_ID = "f2361037-bf9a-4811-bba2-ef3d1516db1c";
const OLD_USER_ID = "6777c2638974e1ff51fec267";

async function main() {
  await mongo.connect();
  const db = mongo.db("flow");
  const writings = await db
    .collection("writing")
    .find({ user_id: OLD_USER_ID })
    .toArray();

  // Deduplicate: keep the one with more content for each date
  const byDate: Record<string, any> = {};
  for (const w of writings) {
    const existing = byDate[w.date];
    if (existing === undefined) {
      byDate[w.date] = w;
    } else {
      const existingLen = JSON.stringify(existing.activityContent || {}).length;
      const newLen = JSON.stringify(w.activityContent || {}).length;
      if (newLen > existingLen) {
        byDate[w.date] = w;
      }
    }
  }

  const deduped = Object.values(byDate);
  console.log(`Deduped writings: ${deduped.length} (from ${writings.length})`);

  const rows = deduped.map((w: any) => ({
    user_id: NEW_USER_ID,
    date: w.date,
    activity_content: w.activityContent || {},
    start_time: w.start_time || null,
    end_time: w.end_time || null,
  }));

  // Use upsert to handle any that might already be there
  const { error } = await supabase
    .from("writings")
    .upsert(rows, { onConflict: "user_id,date" });
  if (error) {
    console.log("Error:", error.message);
  } else {
    console.log("✓ writings: " + rows.length + " rows upserted");
  }

  await mongo.close();
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
