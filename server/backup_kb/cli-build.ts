import { buildProjectKb } from "./indexer";

async function main() {
  try {
    console.log("🧠 Building project knowledge base...");
    const kb = await buildProjectKb();
    console.log(`✅ KB built with ${kb.records.length} records.`);
  } catch (err) {
    console.error("❌ Failed to build KB:", err);
    process.exit(1);
  }
}

main();